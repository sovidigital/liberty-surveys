import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { PollCard } from '@/components/PollCard';
import { AdUnit } from '@/components/AdUnit';
import { Poll, PollOption } from '@/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox } from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';

const ARCHIVE_MIN_VOTES = parseInt(process.env.ARCHIVE_MIN_VOTES || '10', 10);

interface PollWithResults extends Poll {
  options: Array<PollOption & { vote_count: number }>;
  total_votes: number;
}

async function getPolls(): Promise<PollWithResults[]> {
  try {
    const pollsResult = await query<Poll>(
      `SELECT id, question, status, scheduled_for, published_at, closed_at, created_at
       FROM polls
       WHERE status IN ('active', 'closed')
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 50`
    );

    if (pollsResult.rows.length === 0) {
      return [];
    }

    const pollIds = pollsResult.rows.map(p => p.id);

    const optionsResult = await query<PollOption>(
      `SELECT id, poll_id, option_text, display_order
       FROM poll_options
       WHERE poll_id = ANY($1)
       ORDER BY display_order`,
      [pollIds]
    );

    const votesResult = await query<{ poll_id: string; option_id: string; count: string }>(
      `SELECT poll_id, option_id, COUNT(*) as count
       FROM votes
       WHERE poll_id = ANY($1)
       GROUP BY poll_id, option_id`,
      [pollIds]
    );

    const optionsByPoll: Record<string, PollOption[]> = {};
    for (const opt of optionsResult.rows) {
      if (!optionsByPoll[opt.poll_id]) optionsByPoll[opt.poll_id] = [];
      optionsByPoll[opt.poll_id].push(opt);
    }

    const votesByPollOption: Record<string, number> = {};
    for (const v of votesResult.rows) {
      votesByPollOption[`${v.poll_id}:${v.option_id}`] = parseInt(v.count, 10);
    }

    const pollsWithVotes = pollsResult.rows.map(poll => {
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

    return pollsWithVotes.filter(poll => poll.total_votes >= ARCHIVE_MIN_VOTES);
  } catch (error) {
    console.error('Error fetching polls:', error);
    return [];
  }
}

export default async function ArchivePage() {
  const polls = await getPolls();

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Liberty Surveys"
                width={200}
                height={60}
                className="h-14 w-auto"
              />
            </Link>
            <div className="space-x-6">
              <Link href="/polls" className="text-gray-600 hover:text-[#1a1a1a]">
                Results
              </Link>
              <Link href="/archive" className="text-[#e31c23] font-medium">
                Archive
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Poll Archive
        </h1>
        <p className="text-gray-600 mb-8">
          Browse through our history of polls and see how opinions have evolved over time.
        </p>

        {polls.length > 0 ? (
          <>
            <div className="grid gap-4">
              {polls.map((poll, index) => (
                <div key={poll.id}>
                  <PollCard poll={poll} />
                  {/* Ad unit after every 5th poll */}
                  {(index + 1) % 5 === 0 && index < polls.length - 1 && (
                    <div className="my-4">
                      {/* Ad slot ID placeholder: Replace with real slot from AdSense console */}
                      <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARCHIVE} format="fluid" className="min-h-[100px]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Polls Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Polls will appear here once they&apos;ve been published.
            </p>
            <Link
              href="/"
              className="text-[#e31c23] hover:text-[#c41920] font-medium"
            >
              Subscribe to get notified →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
