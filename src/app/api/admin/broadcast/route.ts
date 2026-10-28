import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateVoteUrl, generateUnsubscribeUrl } from '@/lib/signatures';
import { triggerPollBroadcast, PollBroadcastSubscriberData, PollBroadcastSharedData, fetchSegmentMembers, identifySubscriber, CIOSegmentMember } from '@/lib/customerio';
import { getRequiredBaseUrl } from '@/lib/url';
import { generateId } from '@/lib/ulid';
import { Poll, PollOption, PollSource, PollWithBriefing, Subscriber } from '@/types';

interface LocalSubscriber {
  id: string;
  email: string;
  hasExternalId: boolean;
}

/**
 * Upsert segment members into DSQL using batched operations.
 * 
 * IMPORTANT: To avoid creating duplicate CIO people:
 * 1. First check if email already exists in DSQL - use existing DSQL ID
 * 2. If not, use the CIO person's identifiers.id as the DSQL subscriber ID
 * 3. Only identify back to CIO if we had to generate a new ID (rare)
 * 
 * PERFORMANCE: Uses batched queries instead of N sequential operations.
 * For ~400 members, this reduces ~1200 queries to ~10 queries.
 */
async function upsertSegmentMembers(members: CIOSegmentMember[]): Promise<LocalSubscriber[]> {
  if (members.length === 0) return [];
  
  const startTime = Date.now();
  const results: LocalSubscriber[] = [];
  const membersNeedingIdentify: Array<{ id: string; email: string }> = [];
  
  const normalizedMembers = members.map(m => ({
    ...m,
    email: m.email.toLowerCase(),
    proposedId: m.id && m.id.length > 0 ? m.id : generateId(),
    needsIdentify: !m.hasExternalId,
  }));
  
  const emails = normalizedMembers.map(m => m.email);
  const existingByEmail = await query<{ id: string; email: string; status: string }>(
    `SELECT id, email, status FROM subscribers WHERE email = ANY($1)`,
    [emails]
  );
  const emailToExisting = new Map(existingByEmail.rows.map(r => [r.email, r]));
  
  const proposedIds = normalizedMembers
    .filter(m => !emailToExisting.has(m.email))
    .map(m => m.proposedId);
  
  let idToExisting = new Map<string, { id: string }>();
  if (proposedIds.length > 0) {
    const existingByIdResult = await query<{ id: string }>(
      `SELECT id FROM subscribers WHERE id = ANY($1)`,
      [proposedIds]
    );
    idToExisting = new Map(existingByIdResult.rows.map(r => [r.id, r]));
  }
  
  const toReactivate: string[] = [];
  const toUpdateEmail: Array<{ id: string; email: string }> = [];
  const toInsert: Array<{ id: string; email: string }> = [];
  
  for (const member of normalizedMembers) {
    const existing = emailToExisting.get(member.email);
    
    if (existing) {
      if (existing.status !== 'active') {
        toReactivate.push(existing.id);
      }
      results.push({ id: existing.id, email: member.email, hasExternalId: member.hasExternalId });
    } else {
      const idConflict = idToExisting.has(member.proposedId);
      
      if (idConflict) {
        toUpdateEmail.push({ id: member.proposedId, email: member.email });
        results.push({ id: member.proposedId, email: member.email, hasExternalId: member.hasExternalId });
      } else {
        toInsert.push({ id: member.proposedId, email: member.email });
        results.push({ id: member.proposedId, email: member.email, hasExternalId: member.hasExternalId });
        
        if (member.needsIdentify) {
          membersNeedingIdentify.push({ id: member.proposedId, email: member.email });
        }
      }
    }
  }
  
  if (toReactivate.length > 0) {
    await query(
      `UPDATE subscribers 
       SET status = 'active', 
           subscribed_at = COALESCE(subscribed_at, NOW()),
           unsubscribed_at = NULL,
           updated_at = NOW()
       WHERE id = ANY($1)`,
      [toReactivate]
    );
    console.log(`[Broadcast] Re-activated ${toReactivate.length} subscribers`);
  }
  
  if (toUpdateEmail.length > 0) {
    for (const { id, email } of toUpdateEmail) {
      await query(
        `UPDATE subscribers SET email = $1, updated_at = NOW() WHERE id = $2`,
        [email, id]
      );
    }
    console.log(`[Broadcast] Updated email for ${toUpdateEmail.length} subscribers`);
  }
  
  if (toInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((sub, idx) => {
        const offset = idx * 2;
        placeholders.push(`($${offset + 1}, $${offset + 2}, 'active', NOW(), NOW(), NOW())`);
        values.push(sub.id, sub.email);
      });
      
      await query(
        `INSERT INTO subscribers (id, email, status, subscribed_at, created_at, updated_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        values
      );
    }
    console.log(`[Broadcast] Inserted ${toInsert.length} new subscribers`);
  }
  
  if (membersNeedingIdentify.length > 0) {
    console.log(`[Broadcast] Identifying ${membersNeedingIdentify.length} new subscribers to CIO...`);
    for (const { id, email } of membersNeedingIdentify) {
      try {
        await identifySubscriber(id, {
          email,
          subscription_status: 'active',
          subscribed_at: Math.floor(Date.now() / 1000),
        });
      } catch (err) {
        console.warn(`[Broadcast] Failed to identify ${id} to CIO:`, err);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Broadcast] Upserted ${results.length} subscribers in ${duration}ms (reactivated: ${toReactivate.length}, updated: ${toUpdateEmail.length}, inserted: ${toInsert.length})`);
  
  return results;
}

async function getTodaysScheduledPoll(): Promise<Poll | null> {
  const pollResult = await query<Poll>(
    `SELECT * FROM polls 
     WHERE status = 'scheduled' 
     ORDER BY scheduled_for ASC, created_at DESC 
     LIMIT 1`
  );
  
  if (pollResult.rows.length > 0) {
    return pollResult.rows[0];
  }
  
  const activePollResult = await query<Poll>(
    `SELECT * FROM polls 
     WHERE status = 'active' 
     ORDER BY published_at DESC 
     LIMIT 1`
  );
  
  return activePollResult.rows.length > 0 ? activePollResult.rows[0] : null;
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
    const { poll_id: providedPollId, skip_sync: skipSync } = body;
    
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
      `SELECT id, question, status, scheduled_for, published_at, closed_at, 
              created_by, created_at, updated_at,
              briefing_background, briefing_conservative, briefing_liberal, briefing_centrist,
              generation_run_id, is_auto_generated
       FROM polls WHERE id = $1 AND status IN ('scheduled', 'active')`,
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

    const segmentId = process.env.CUSTOMERIO_BROADCAST_SEGMENT_ID;
    let subscribers: LocalSubscriber[];
    let syncSkipped = false;
    
    if (segmentId) {
      console.log(`[API] Using CIO segment ${segmentId} for broadcast audience`);
      
      if (skipSync) {
        console.log(`[API] Skipping CIO segment sync (skip_sync=true), using DSQL subscribers`);
        const dsqlSubscribers = await query<{ id: string; email: string }>(
          "SELECT id, email FROM subscribers WHERE status = 'active'",
          []
        );
        
        if (dsqlSubscribers.rows.length === 0) {
          return NextResponse.json(
            { error: 'No active subscribers in DSQL. Run /api/admin/sync-segment first.' },
            { status: 400 }
          );
        }
        
        subscribers = dsqlSubscribers.rows.map(s => ({ 
          id: s.id, 
          email: s.email,
          hasExternalId: true,
        }));
        syncSkipped = true;
        console.log(`[API] Using ${subscribers.length} existing DSQL subscribers`);
      } else {
        try {
          const segmentMembers = await fetchSegmentMembers(parseInt(segmentId, 10));
          
          if (segmentMembers.length === 0) {
            return NextResponse.json(
              { error: 'No members in the configured CIO segment' },
              { status: 400 }
            );
          }
          
          subscribers = await upsertSegmentMembers(segmentMembers);
          console.log(`[API] Synced ${subscribers.length} subscribers from CIO segment`);
        } catch (err) {
          console.error('[API] Failed to fetch CIO segment:', err);
          return NextResponse.json(
            { error: 'Failed to fetch CIO segment members', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          );
        }
      }
    } else {
      console.log('[API] No CUSTOMERIO_BROADCAST_SEGMENT_ID configured, using all active DSQL subscribers');
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
      
      subscribers = subscribersResult.rows.map(s => ({ 
        id: s.id, 
        email: s.email, 
        hasExternalId: true,
      }));
    }

    let baseUrl: string;
    try {
      baseUrl = getRequiredBaseUrl();
    } catch (error) {
      console.error('[API] Base URL validation failed:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Base URL configuration error' },
        { status: 500 }
      );
    }

    const broadcastCampaignId = process.env.CUSTOMERIO_BROADCAST_CAMPAIGN_ID;

    const sourcesResult = await query<PollSource>(
      `SELECT source_name, source_url, article_title 
       FROM poll_sources 
       WHERE poll_id = $1 
       ORDER BY created_at`,
      [poll_id]
    );

    if (!broadcastCampaignId) {
      console.log('[DEV MODE] Broadcast would be sent with the following data:');
      console.log('Poll:', poll.question);
      console.log('Options:', optionsResult.rows.map(o => o.option_text));
      console.log('Subscribers:', subscribers.length);
      console.log('Sources:', sourcesResult.rows.length);
      console.log('Audience source:', segmentId ? `CIO segment ${segmentId}` : 'DSQL active subscribers');

      const sampleSubscriber = subscribers[0];
      console.log('\nSample vote URLs for subscriber', sampleSubscriber.id);
      for (const option of optionsResult.rows) {
        const voteUrl = generateVoteUrl(baseUrl, poll.id, option.id, sampleSubscriber.id);
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
        subscribers_count: subscribers.length,
        audience_source: segmentId ? `cio_segment_${segmentId}` : 'dsql_active',
      });
    }
    
    console.log(`[API] Broadcast triggered (scheduled: ${isScheduledJob}, poll: ${poll_id}, audience: ${segmentId ? `segment ${segmentId}` : 'dsql'})`);
    
    const sharedData: PollBroadcastSharedData = {
      poll_id: poll.id,
      poll_question: poll.question,
      results_url: `${baseUrl}/polls/${poll.id}`,
      briefing_background: poll.briefing_background || undefined,
      briefing_conservative: poll.briefing_conservative || undefined,
      briefing_liberal: poll.briefing_liberal || undefined,
      briefing_centrist: poll.briefing_centrist || undefined,
      sources: sourcesResult.rows.length > 0 
        ? sourcesResult.rows.map(s => ({
            name: s.source_name,
            url: s.source_url,
            title: s.article_title || s.source_name,
          }))
        : undefined,
    };

    const subscriberData: PollBroadcastSubscriberData[] = subscribers.map(sub => ({
      subscriber_id: sub.id,
      email: sub.email,
      options: optionsResult.rows.map(opt => ({
        id: opt.id,
        text: opt.option_text,
        vote_url: generateVoteUrl(baseUrl, poll.id, opt.id, sub.id),
      })),
      unsubscribe_url: generateUnsubscribeUrl(baseUrl, sub.id, sub.email),
      hasExternalId: sub.hasExternalId,
    }));

    const result = await triggerPollBroadcast({
      sharedData,
      subscribers: subscriberData,
    });

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
      sync_skipped: syncSkipped,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger broadcast' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const segmentId = process.env.CUSTOMERIO_BROADCAST_SEGMENT_ID;
  
  return NextResponse.json({
    message: 'Daily poll broadcast endpoint',
    usage: {
      method: 'POST',
      body: {
        poll_id: 'string - required for admin calls, auto-selected for scheduled jobs',
        skip_sync: 'boolean - skip CIO segment fetch, use existing DSQL subscribers (faster)',
      },
      headers: {
        'x-scheduled-job': 'true - for EventBridge scheduled jobs',
        'x-scheduler-secret': 'secret - required for scheduled jobs if SCHEDULER_SECRET is set',
      },
    },
    config: {
      audience_source: segmentId 
        ? `CIO segment ${segmentId} (CUSTOMERIO_BROADCAST_SEGMENT_ID)` 
        : 'DSQL active subscribers (no segment configured)',
      campaign_id: process.env.CUSTOMERIO_BROADCAST_CAMPAIGN_ID || 'not set',
    },
    notes: [
      'Admin calls require valid session cookie and poll_id in body',
      'Scheduled calls auto-select the next scheduled poll, or most recent active poll',
      'When CUSTOMERIO_BROADCAST_SEGMENT_ID is set, audience comes from that CIO segment',
      'Segment members are synced to DSQL before broadcast to enable signed vote URLs',
      'Without segment ID, falls back to all active DSQL subscribers',
      'Use skip_sync=true after running /api/admin/sync-segment for faster broadcasts',
      'Recommended: Run sync-segment at 6:45 AM, then broadcast at 7:00 AM with skip_sync=true',
    ],
  });
}
