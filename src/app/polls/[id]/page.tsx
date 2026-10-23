import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { PollResults } from '@/components/PollResults';
import { Poll, PollOption } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}

async function getPoll(id: string) {
  try {
    const pollResult = await query<Poll>(
      `SELECT id, question, status, published_at, closed_at, created_at
       FROM polls
       WHERE id = $1 AND status IN ('active', 'closed')`,
      [id]
    );

    if (pollResult.rows.length === 0) {
      return null;
    }

    const poll = pollResult.rows[0];

    const optionsResult = await query<PollOption & { vote_count: string }>(
      `SELECT po.id, po.poll_id, po.option_text, po.display_order,
              COALESCE(v.vote_count, 0) as vote_count
       FROM poll_options po
       LEFT JOIN (
         SELECT option_id, COUNT(*) as vote_count
         FROM votes
         WHERE poll_id = $1
         GROUP BY option_id
       ) v ON po.id = v.option_id
       WHERE po.poll_id = $1
       ORDER BY po.display_order`,
      [id]
    );

    const options = optionsResult.rows.map(opt => ({
      ...opt,
      vote_count: parseInt(String(opt.vote_count), 10),
    }));

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

    return { poll, options, totalVotes };
  } catch (error) {
    console.error('Error fetching poll:', error);
    return null;
  }
}

export default async function PollPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { status: statusMessage, error: errorMessage } = await searchParams;
  const data = await getPoll(id);

  if (!data) {
    notFound();
  }

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Liberty Surveys
            </Link>
            <div className="space-x-6">
              <Link href="/polls" className="text-blue-600 font-medium">
                Results
              </Link>
              <Link href="/archive" className="text-gray-600 hover:text-gray-900">
                Archive
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            statusMessage === 'voted' 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : statusMessage === 'already_voted'
              ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {statusMessage === 'voted' && '✓ Your vote has been recorded! Thank you for participating.'}
            {statusMessage === 'already_voted' && 'You have already voted on this poll.'}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
            {errorMessage === 'poll_closed' && 'This poll is no longer accepting votes.'}
            {errorMessage !== 'poll_closed' && 'An error occurred.'}
          </div>
        )}

        <div className="mb-6">
          <Link
            href="/archive"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Archive
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            {formatDate(data.poll.published_at || data.poll.created_at)}
          </p>

          <PollResults
            question={data.poll.question}
            options={data.options}
            totalVotes={data.totalVotes}
            status={data.poll.status as 'active' | 'closed'}
          />
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/archive"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Browse all polls
          </Link>
          <Link
            href="/polls"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View current poll →
          </Link>
        </div>
      </div>
    </main>
  );
}
