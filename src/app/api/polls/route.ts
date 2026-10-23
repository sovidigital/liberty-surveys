import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { getSession } from '@/lib/auth';
import { Poll, PollOption, PollStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PollStatus | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let whereClause = '';
    const params: (string | number)[] = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    } else {
      whereClause = "WHERE status IN ('active', 'closed')";
    }

    const pollsResult = await query<Poll>(
      `SELECT id, question, status, scheduled_for, published_at, closed_at, created_at
       FROM polls
       ${whereClause}
       ORDER BY COALESCE(published_at, scheduled_for, created_at) DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const polls = pollsResult.rows;

    if (polls.length === 0) {
      return NextResponse.json({ polls: [], total: 0 });
    }

    const pollIds = polls.map(p => p.id);
    const optionsResult = await query<PollOption>(
      `SELECT id, poll_id, option_text, display_order
       FROM poll_options
       WHERE poll_id = ANY($1)
       ORDER BY display_order`,
      [pollIds]
    );

    const optionsByPoll = optionsResult.rows.reduce((acc, opt) => {
      if (!acc[opt.poll_id]) acc[opt.poll_id] = [];
      acc[opt.poll_id].push(opt);
      return acc;
    }, {} as Record<string, PollOption[]>);

    const votesResult = await query<{ poll_id: string; option_id: string; count: string }>(
      `SELECT poll_id, option_id, COUNT(*) as count
       FROM votes
       WHERE poll_id = ANY($1)
       GROUP BY poll_id, option_id`,
      [pollIds]
    );

    const votesByPollOption = votesResult.rows.reduce((acc, v) => {
      const key = `${v.poll_id}:${v.option_id}`;
      acc[key] = parseInt(v.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const pollsWithData = polls.map(poll => {
      const options = (optionsByPoll[poll.id] || []).map(opt => ({
        ...opt,
        vote_count: votesByPollOption[`${poll.id}:${opt.id}`] || 0,
      }));

      const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

      return {
        ...poll,
        options,
        total_votes: totalVotes,
      };
    });

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM polls ${whereClause}`,
      status ? [status] : []
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    return NextResponse.json({ polls: pollsWithData, total });
  } catch (error) {
    console.error('Get polls error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, options, status = 'draft', scheduled_for } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      return NextResponse.json(
        { error: 'Polls must have 2-6 options' },
        { status: 400 }
      );
    }

    for (const opt of options) {
      if (!opt.text || typeof opt.text !== 'string' || opt.text.trim().length === 0) {
        return NextResponse.json(
          { error: 'All options must have text' },
          { status: 400 }
        );
      }
    }

    const validStatuses = ['draft', 'scheduled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Status must be draft or scheduled' },
        { status: 400 }
      );
    }

    if (status === 'scheduled' && !scheduled_for) {
      return NextResponse.json(
        { error: 'Scheduled polls must have a scheduled_for date' },
        { status: 400 }
      );
    }

    const poll = await transaction(async (client) => {
      const pollId = generateId();
      const scheduledDate = scheduled_for ? new Date(scheduled_for) : null;

      await client.query(
        `INSERT INTO polls (id, question, status, scheduled_for, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [pollId, question.trim(), status, scheduledDate, session.userId]
      );

      for (let i = 0; i < options.length; i++) {
        const optionId = generateId();
        await client.query(
          `INSERT INTO poll_options (id, poll_id, option_text, display_order, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [optionId, pollId, options[i].text.trim(), i + 1]
        );
      }

      const result = await client.query<Poll>(
        'SELECT * FROM polls WHERE id = $1',
        [pollId]
      );

      const optionsResult = await client.query<PollOption>(
        'SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY display_order',
        [pollId]
      );

      return {
        ...result.rows[0],
        options: optionsResult.rows,
      };
    });

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    console.error('Create poll error:', error);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
