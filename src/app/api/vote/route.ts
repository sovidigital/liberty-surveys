import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { verifyVoteSignature } from '@/lib/signatures';
import { trackEvent, identifySubscriber } from '@/lib/customerio';
import { buildRedirectUrl } from '@/lib/url';
import { Poll, PollOption, Subscriber } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('p');
    const optionId = searchParams.get('o');
    const subscriberId = searchParams.get('s');
    const signature = searchParams.get('sig');

    if (!pollId || !optionId || !subscriberId || !signature) {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=invalid_link'));
    }

    if (!verifyVoteSignature(pollId, optionId, subscriberId, signature)) {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=invalid_signature'));
    }

    const subscriberResult = await query<Subscriber>(
      'SELECT id, email, status FROM subscribers WHERE id = $1',
      [subscriberId]
    );

    if (subscriberResult.rows.length === 0) {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=subscriber_not_found'));
    }

    const subscriber = subscriberResult.rows[0];

    if (subscriber.status !== 'active') {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=not_subscribed'));
    }

    const pollResult = await query<Poll>(
      'SELECT id, question, status FROM polls WHERE id = $1',
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=poll_not_found'));
    }

    const poll = pollResult.rows[0];

    if (poll.status !== 'active') {
      return NextResponse.redirect(
        buildRedirectUrl(request, `/polls/${pollId}?error=poll_closed`)
      );
    }

    const optionResult = await query<PollOption>(
      'SELECT id, poll_id, option_text FROM poll_options WHERE id = $1 AND poll_id = $2',
      [optionId, pollId]
    );

    if (optionResult.rows.length === 0) {
      return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=invalid_option'));
    }

    const existingVote = await query(
      'SELECT id FROM votes WHERE poll_id = $1 AND subscriber_id = $2',
      [pollId, subscriberId]
    );

    if (existingVote.rows.length > 0) {
      return NextResponse.redirect(
        buildRedirectUrl(request, `/polls/${pollId}?status=already_voted`)
      );
    }

    const voteId = generateId();
    await query(
      `INSERT INTO votes (id, poll_id, option_id, subscriber_id, voted_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [voteId, pollId, optionId, subscriberId]
    );

    const voteCountResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM votes WHERE subscriber_id = $1',
      [subscriberId]
    );
    const totalVotes = parseInt(voteCountResult.rows[0]?.count || '0', 10);

    await trackEvent(subscriberId, 'poll_voted', {
      poll_id: pollId,
      option_id: optionId,
      poll_question: poll.question,
    });

    await identifySubscriber(subscriberId, {
      email: subscriber.email,
      subscription_status: 'active',
      total_polls_voted: totalVotes,
      last_vote_at: Math.floor(Date.now() / 1000),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request, `/polls/${pollId}?status=voted`)
    );
  } catch (error) {
    console.error('Vote error:', error);
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      const { searchParams: errorParams } = new URL(request.url);
      const errorPollId = errorParams.get('p');
      return NextResponse.redirect(
        buildRedirectUrl(request, `/polls/${errorPollId}?status=already_voted`)
      );
    }
    
    return NextResponse.redirect(buildRedirectUrl(request, '/polls?error=server'));
  }
}
