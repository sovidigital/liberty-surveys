import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { verifyVoteSignature } from '@/lib/signatures';
import { trackEvent, identifySubscriber } from '@/lib/customerio';
import { Poll, PollOption, Subscriber } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('p');
    const optionId = searchParams.get('o');
    const subscriberId = searchParams.get('s');
    const signature = searchParams.get('sig');

    if (!pollId || !optionId || !subscriberId || !signature) {
      return NextResponse.redirect(new URL('/polls?error=invalid_link', request.url));
    }

    if (!verifyVoteSignature(pollId, optionId, subscriberId, signature)) {
      return NextResponse.redirect(new URL('/polls?error=invalid_signature', request.url));
    }

    const subscriberResult = await query<Subscriber>(
      'SELECT id, email, status FROM subscribers WHERE id = $1',
      [subscriberId]
    );

    if (subscriberResult.rows.length === 0) {
      return NextResponse.redirect(new URL('/polls?error=subscriber_not_found', request.url));
    }

    const subscriber = subscriberResult.rows[0];

    if (subscriber.status !== 'active') {
      return NextResponse.redirect(new URL('/polls?error=not_subscribed', request.url));
    }

    const pollResult = await query<Poll>(
      'SELECT id, question, status FROM polls WHERE id = $1',
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      return NextResponse.redirect(new URL('/polls?error=poll_not_found', request.url));
    }

    const poll = pollResult.rows[0];

    if (poll.status !== 'active') {
      return NextResponse.redirect(
        new URL(`/polls/${pollId}?error=poll_closed`, request.url)
      );
    }

    const optionResult = await query<PollOption>(
      'SELECT id, poll_id, option_text FROM poll_options WHERE id = $1 AND poll_id = $2',
      [optionId, pollId]
    );

    if (optionResult.rows.length === 0) {
      return NextResponse.redirect(new URL('/polls?error=invalid_option', request.url));
    }

    const existingVote = await query(
      'SELECT id FROM votes WHERE poll_id = $1 AND subscriber_id = $2',
      [pollId, subscriberId]
    );

    if (existingVote.rows.length > 0) {
      return NextResponse.redirect(
        new URL(`/polls/${pollId}?status=already_voted`, request.url)
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
      new URL(`/polls/${pollId}?status=voted`, request.url)
    );
  } catch (error) {
    console.error('Vote error:', error);
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      const pollId = new URL(request.url).searchParams.get('p');
      return NextResponse.redirect(
        new URL(`/polls/${pollId}?status=already_voted`, request.url)
      );
    }
    
    return NextResponse.redirect(new URL('/polls?error=server', request.url));
  }
}
