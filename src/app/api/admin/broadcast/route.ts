import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateVoteUrl, generateUnsubscribeUrl } from '@/lib/signatures';
import { triggerBroadcast } from '@/lib/customerio';
import { Poll, PollOption, Subscriber } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { poll_id } = body;

    if (!poll_id) {
      return NextResponse.json(
        { error: 'poll_id is required' },
        { status: 400 }
      );
    }

    const pollResult = await query<Poll>(
      "SELECT * FROM polls WHERE id = $1 AND status IN ('scheduled', 'active')",
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const environmentId = process.env.CUSTOMERIO_ENVIRONMENT_ID;
    const broadcastCampaignId = process.env.CUSTOMERIO_BROADCAST_CAMPAIGN_ID;

    if (!environmentId || !broadcastCampaignId) {
      console.log('[DEV MODE] Broadcast would be sent with the following data:');
      console.log('Poll:', poll.question);
      console.log('Options:', optionsResult.rows.map(o => o.option_text));
      console.log('Subscribers:', subscribersResult.rows.length);

      const sampleSubscriber = subscribersResult.rows[0];
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
        subscribers_count: subscribersResult.rows.length,
      });
    }

    const subscribers = subscribersResult.rows;
    const perUserData = subscribers.map(sub => {
      const options = optionsResult.rows.map(opt => ({
        id: opt.id,
        text: opt.option_text,
        vote_url: generateVoteUrl(baseUrl, poll.id, opt.id, sub.id),
      }));

      return {
        id: sub.id,
        email: sub.email,
        poll_question: poll.question,
        poll_id: poll.id,
        options,
        results_url: `${baseUrl}/polls/${poll.id}`,
        unsubscribe_url: generateUnsubscribeUrl(baseUrl, sub.id, sub.email),
      };
    });

    await triggerBroadcast(environmentId, {
      campaignId: parseInt(broadcastCampaignId, 10),
      data: {
        poll_id: poll.id,
        poll_question: poll.question,
      },
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
      subscribers_count: perUserData.length,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger broadcast' },
      { status: 500 }
    );
  }
}
