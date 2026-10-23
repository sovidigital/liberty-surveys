import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { PollResults } from '@/components/PollResults';
import { Poll, PollOption } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  error?: string;
}

async function getLatestActivePoll() {
  try {
    const pollResult = await query<Poll>(
      `SELECT id, question, status, published_at, closed_at, created_at
       FROM polls
       WHERE status IN ('active', 'closed')
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 1`
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
      [poll.id]
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

export default async function PollsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getLatestActivePoll();
  const statusMessage = params.status;
  const errorMessage = params.error;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Liberty Surveys"
                width={160}
                height={48}
                className="h-10 w-auto"
              />
            </Link>
            <div className="space-x-6">
              <Link href="/polls" className="text-[#e31c23] font-medium">
                Results
              </Link>
              <Link href="/archive" className="text-gray-600 hover:text-[#1a1a1a]">
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
            {errorMessage === 'invalid_link' && 'Invalid voting link. Please use the link from your email.'}
            {errorMessage === 'invalid_signature' && 'This voting link is invalid or has been tampered with.'}
            {errorMessage === 'poll_closed' && 'This poll is no longer accepting votes.'}
            {errorMessage === 'poll_not_found' && 'Poll not found.'}
            {errorMessage === 'not_subscribed' && 'Only active subscribers can vote.'}
            {errorMessage === 'server' && 'An error occurred. Please try again.'}
            {!['invalid_link', 'invalid_signature', 'poll_closed', 'poll_not_found', 'not_subscribed', 'server'].includes(errorMessage) && 'An error occurred.'}
          </div>
        )}

        {data ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
              Current Poll Results
            </h1>
            <p className="text-gray-600 text-center mb-8">
              See how others have voted on today&apos;s question
            </p>

            <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
              <PollResults
                question={data.poll.question}
                options={data.options}
                totalVotes={data.totalVotes}
                status={data.poll.status as 'active' | 'closed'}
              />
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/archive"
                className="text-[#0066b3] hover:text-[#004d86] font-medium"
              >
                ← Browse all past polls
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🗳️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              No Active Polls
            </h1>
            <p className="text-gray-600 mb-8">
              There are no polls available right now. Subscribe to be notified when the next poll is published!
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-[#e31c23] text-white font-semibold rounded-lg hover:bg-[#c41920] transition-colors"
            >
              Subscribe Now
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
