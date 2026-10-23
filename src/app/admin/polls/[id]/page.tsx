import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { Poll, PollOption } from '@/types';
import { BroadcastButton } from './BroadcastButton';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

async function getPoll(id: string) {
  try {
    const pollResult = await query<Poll>(
      `SELECT id, question, status, scheduled_for, published_at, closed_at, created_at, updated_at
       FROM polls
       WHERE id = $1`,
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

export default async function EditPollPage({ params }: Props) {
  const session = await getSession();
  
  if (!session) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const data = await getPoll(id);

  if (!data) {
    notFound();
  }

  const { poll, options, totalVotes } = data;

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-blue-100 text-blue-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <AdminNav />
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/admin/polls"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Polls
            </Link>
          </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Poll Details</h1>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(poll.status)}`}>
            {poll.status}
          </span>
        </div>
        <div className="flex gap-3">
          {(poll.status === 'scheduled' || poll.status === 'active') && (
            <BroadcastButton pollId={poll.id} pollStatus={poll.status} />
          )}
          <Link
            href={`/polls/${poll.id}`}
            target="_blank"
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            View Public Page
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Question</h2>
        <p className="text-lg text-gray-700">{poll.question}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Results</h2>
          <span className="text-gray-500">{totalVotes.toLocaleString()} total votes</span>
        </div>

        <div className="space-y-4">
          {options.map((option) => {
            const percentage = totalVotes > 0 
              ? Math.round((option.vote_count / totalVotes) * 100) 
              : 0;

            return (
              <div key={option.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-800">{option.option_text}</span>
                  <span className="text-gray-600 text-sm">
                    {percentage}% ({option.vote_count.toLocaleString()})
                  </span>
                </div>
                <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Poll Information</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatDate(poll.created_at)}</dd>
          </div>
          {poll.scheduled_for && (
            <div>
              <dt className="text-sm text-gray-500">Scheduled For</dt>
              <dd className="text-gray-900">{formatDate(poll.scheduled_for)}</dd>
            </div>
          )}
          {poll.published_at && (
            <div>
              <dt className="text-sm text-gray-500">Published</dt>
              <dd className="text-gray-900">{formatDate(poll.published_at)}</dd>
            </div>
          )}
          {poll.closed_at && (
            <div>
              <dt className="text-sm text-gray-500">Closed</dt>
              <dd className="text-gray-900">{formatDate(poll.closed_at)}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Poll ID</dt>
            <dd className="text-gray-900 font-mono text-sm">{poll.id}</dd>
          </div>
        </dl>
      </div>
        </div>
      </main>
    </>
  );
}
