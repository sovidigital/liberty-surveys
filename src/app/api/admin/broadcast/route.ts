import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateVoteUrl, generateUnsubscribeUrl } from '@/lib/signatures';
import {
  triggerPollBroadcast,
  PollBroadcastSharedData,
  PollBroadcastSubscriberData,
  PollBroadcastOption,
  PollBroadcastSource,
} from '@/lib/customerio';
import { PollWithBriefing, PollOption, Subscriber, PollSource } from '@/types';

function getRequiredBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_BASE_URL must be configured for broadcasts');
  }
  return baseUrl;
}

async function getTodaysScheduledPoll(): Promise<PollWithBriefing | null> {
  const pollResult = await query<PollWithBriefing>(
    `SELECT id, question, status, scheduled_for, published_at, closed_at, created_by, created_at, updated_at,
            briefing_background, briefing_conservative, briefing_liberal, briefing_centrist,
            generation_run_id, is_auto_generated
     FROM polls 
     WHERE status = 'scheduled' 
     ORDER BY scheduled_for ASC, created_at DESC 
     LIMIT 1`
  );
  
  if (pollResult.rows.length > 0) {
    return pollResult.rows[0];
  }
  
  const activePollResult = await query<PollWithBriefing>(
    `SELECT id, question, status, scheduled_for, published_at, closed_at, created_by, created_at, updated_at,
            briefing_background, briefing_conservative, briefing_liberal, briefing_centrist,
            generation_run_id, is_auto_generated
     FROM polls 
     WHERE status = 'active' 
     ORDER BY published_at DESC 
     LIMIT 1`
  );
  
  return activePollResult.rows.length > 0 ? activePollResult.rows[0] : null;
}

async function getPollSources(pollId: string): Promise<PollSource[]> {
  const result = await query<PollSource>(
    `SELECT id, poll_id, source_name, source_url, article_title, article_snippet,
            political_lean, perspective_used, fetched_at, created_at
     FROM poll_sources
     WHERE poll_id = $1
     ORDER BY created_at ASC`,
    [pollId]
  );
  return result.rows;
}

export async function POST(request: NextRequest) {
  try {
    const isScheduledJob = request.headers.get('x-scheduled-job') === 'true';
    const schedulerSecret = request.headers.get('x-scheduler-secret');
    const expectedSecret = process.env.SCHEDULER_SECRET;
    
    if (isScheduledJob) {
      if (expectedSecret && schedulerSecret !== expectedSecret) {
        return NextResponse.json(
          { error: 'Invalid scheduler secret' },
          { status: 401 }
        );
      }
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { poll_id: providedPollId } = body;
    
    let poll_id = providedPollId;
    
    if (isScheduledJob && !poll_id) {
      const todaysPoll = await getTodaysScheduledPoll();
      if (!todaysPoll) {
        return NextResponse.json(
          { error: 'No scheduled or active poll found for today' },
          { status: 404 }
        );
      }
      poll_id = todaysPoll.id;
      console.log(`[API] Scheduler auto-selected poll: ${poll_id} (${todaysPoll.question.substring(0, 50)}...)`);
    }

    if (!poll_id) {
      return NextResponse.json(
        { error: 'poll_id is required' },
        { status: 400 }
      );
    }

    const pollResult = await query<PollWithBriefing>(
      `SELECT id, question, status, scheduled_for, published_at, closed_at, created_by, created_at, updated_at,
              briefing_background, briefing_conservative, briefing_liberal, briefing_centrist,
              generation_run_id, is_auto_generated
       FROM polls 
       WHERE id = $1 AND status IN ('scheduled', 'active')`,
      [poll_id]
    );

    if (pollResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poll not found or not ready for broadcast' },
        { status: 404 }
      );
    }

    const poll = pollResult.rows[0];

    const optionsResult = await query<PollOption>(
      'SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY display_order',
      [poll_id]
    );

    if (optionsResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poll has no options' },
        { status: 400 }
      );
    }

    const subscribersResult = await query<Subscriber>(
      "SELECT id, email FROM subscribers WHERE status = 'active'",
      []
    );

    if (subscribersResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No active subscribers to send to' },
        { status: 400 }
      );
    }

    const broadcastCampaignId = process.env.CUSTOMERIO_BROADCAST_CAMPAIGN_ID;

    if (!broadcastCampaignId) {
      const devBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      console.log('[DEV MODE] Broadcast would be sent with the following data:');
      console.log('Poll:', poll.question);
      console.log('Briefing background:', poll.briefing_background?.substring(0, 100) + '...');
      console.log('Options:', optionsResult.rows.map(o => o.option_text));
      console.log('Subscribers:', subscribersResult.rows.length);

      const sampleSubscriber = subscribersResult.rows[0];
      console.log('\nSample vote URLs for subscriber', sampleSubscriber.id);
      for (const option of optionsResult.rows) {
        const voteUrl = generateVoteUrl(devBaseUrl, poll.id, option.id, sampleSubscriber.id);
        console.log(`  ${option.option_text}: ${voteUrl}`);
      }

      await query(
        `UPDATE polls 
         SET status = 'active', 
             published_at = COALESCE(published_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [poll_id]
      );

      return NextResponse.json({
        success: true,
        message: '[DEV] Broadcast simulated - poll set to active',
        scheduled: isScheduledJob,
        poll_id,
        subscribers_count: subscribersResult.rows.length,
      });
    }
    
    const baseUrl = getRequiredBaseUrl();
    
    console.log(`[API] Broadcast triggered (scheduled: ${isScheduledJob}, poll: ${poll_id})`);

    const pollSources = await getPollSources(poll.id);
    
    const sources: PollBroadcastSource[] = pollSources.map(s => ({
      name: s.source_name,
      url: s.source_url,
      title: s.article_title || s.source_name,
    }));

    const sharedData: PollBroadcastSharedData = {
      poll_id: poll.id,
      poll_question: poll.question,
      results_url: `${baseUrl}/polls/${poll.id}`,
      briefing_background: poll.briefing_background || undefined,
      briefing_conservative: poll.briefing_conservative || undefined,
      briefing_liberal: poll.briefing_liberal || undefined,
      briefing_centrist: poll.briefing_centrist || undefined,
      sources: sources.length > 0 ? sources : undefined,
    };

    const subscribers: PollBroadcastSubscriberData[] = subscribersResult.rows.map(sub => {
      const options: PollBroadcastOption[] = optionsResult.rows.map(opt => ({
        id: opt.id,
        text: opt.option_text,
        vote_url: generateVoteUrl(baseUrl, poll.id, opt.id, sub.id),
      }));

      return {
        id: sub.id,
        options,
        unsubscribe_url: generateUnsubscribeUrl(baseUrl, sub.id, sub.email),
      };
    });

    const result = await triggerPollBroadcast({ sharedData, subscribers });

    await query(
      `UPDATE polls 
       SET status = 'active', 
           published_at = COALESCE(published_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [poll_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Broadcast triggered successfully',
      scheduled: isScheduledJob,
      poll_id,
      subscribers_count: result.subscriberCount,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger broadcast', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.json({
    message: 'Daily poll broadcast endpoint',
    usage: {
      method: 'POST',
      body: {
        poll_id: 'string - required for admin calls, auto-selected for scheduled jobs',
      },
      headers: {
        'x-scheduled-job': 'true - for EventBridge scheduled jobs',
        'x-scheduler-secret': 'secret - required for scheduled jobs if SCHEDULER_SECRET is set',
      },
    },
    notes: [
      'Admin calls require valid session cookie and poll_id in body',
      'Scheduled calls auto-select the next scheduled poll, or most recent active poll',
      'Campaign ID: 8 (CUSTOMERIO_BROADCAST_CAMPAIGN_ID)',
      'Requires NEXT_PUBLIC_BASE_URL to be set (no localhost fallback in production)',
    ],
  });
}
