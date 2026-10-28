import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { PollResults } from '@/components/PollResults';
import { PollBriefing } from '@/components/PollBriefing';
import { AdUnit } from '@/components/AdUnit';
import { PollOption, PollWithBriefing, PollSource } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}

interface PollData {
  poll: PollWithBriefing;
  options: Array<PollOption & { vote_count: number }>;
  totalVotes: number;
  sources: PollSource[];
}

async function getPoll(id: string): Promise<PollData | null> {
  try {
    const pollResult = await query<PollWithBriefing>(
      `SELECT id, question, status, published_at, closed_at, created_at,
              briefing_background, briefing_conservative, briefing_liberal, briefing_centrist,
              generation_run_id, is_auto_generated
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

    const sourcesResult = await query<PollSource>(
      `SELECT id, poll_id, source_name, source_url, article_title, article_snippet, 
              political_lean, perspective_used, fetched_at, created_at
       FROM poll_sources
       WHERE poll_id = $1
       ORDER BY created_at`,
      [id]
    );

    return { poll, options, totalVotes, sources: sourcesResult.rows };
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
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Liberty Surveys"
                width={200}
                height={60}
                className="h-14 w-auto"
                priority
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
            {errorMessage === 'poll_closed' && 'This poll is no longer accepting votes.'}
            {errorMessage !== 'poll_closed' && 'An error occurred.'}
          </div>
        )}

        <div className="mb-6">
          <Link
            href="/archive"
            className="text-[#0066b3] hover:text-[#004d8a] text-sm"
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

        {(data.poll.briefing_background || data.poll.briefing_conservative) && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Understanding the Issue</h2>
            <PollBriefing
              background={data.poll.briefing_background}
              conservative={data.poll.briefing_conservative}
              liberal={data.poll.briefing_liberal}
              centrist={data.poll.briefing_centrist}
              sources={data.sources}
            />
          </div>
        )}

        {/* Ad Unit - After poll results */}
        <div className="mt-8">
          {/* Ad slot ID placeholder: Replace with real slot from AdSense console */}
          <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_POLL} format="auto" className="min-h-[250px]" />
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/archive"
            className="text-[#0066b3] hover:text-[#004d8a] font-medium"
          >
            ← Browse all polls
          </Link>
          <Link
            href="/polls"
            className="text-[#0066b3] hover:text-[#004d8a] font-medium"
          >
            View current poll →
          </Link>
        </div>
      </div>
    </main>
  );
}
