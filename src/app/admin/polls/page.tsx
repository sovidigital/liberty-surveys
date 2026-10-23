import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { Poll, PollOption } from '@/types';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

async function getPolls() {
  try {
    const pollsResult = await query<Poll>(
      `SELECT id, question, status, scheduled_for, published_at, closed_at, created_at, updated_at
       FROM polls
       ORDER BY created_at DESC
       LIMIT 100`
    );

    if (pollsResult.rows.length === 0) {
      return [];
    }

    const pollIds = pollsResult.rows.map(p => p.id);

    const optionsResult = await query<PollOption>(
      `SELECT poll_id, COUNT(*) as count
       FROM poll_options
       WHERE poll_id = ANY($1)
       GROUP BY poll_id`,
      [pollIds]
    );

    const votesResult = await query<{ poll_id: string; count: string }>(
      `SELECT poll_id, COUNT(*) as count
       FROM votes
       WHERE poll_id = ANY($1)
       GROUP BY poll_id`,
      [pollIds]
    );

    const optionCounts: Record<string, number> = {};
    for (const row of optionsResult.rows) {
      optionCounts[row.poll_id] = parseInt(String((row as unknown as { count: string }).count), 10);
    }

    const voteCounts: Record<string, number> = {};
    for (const row of votesResult.rows) {
      voteCounts[row.poll_id] = parseInt(row.count, 10);
    }

    return pollsResult.rows.map(poll => ({
      ...poll,
      option_count: optionCounts[poll.id] || 0,
      vote_count: voteCounts[poll.id] || 0,
    }));
  } catch (error) {
    console.error('Error fetching polls:', error);
    return [];
  }
}

export default async function AdminPollsPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/admin/login');
  }

  const polls = await getPolls();

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Polls</h1>
        <Link
          href="/admin/polls/new"
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Poll
        </Link>
      </div>

      {polls.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Question
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Options
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Votes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {polls.map((poll) => (
                <tr key={poll.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                      {poll.question}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(poll.status)}`}>
                      {poll.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {poll.option_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {poll.vote_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(poll.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-3">
                      <Link
                        href={`/admin/polls/${poll.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/polls/${poll.id}`}
                        target="_blank"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Polls Yet</h2>
          <p className="text-gray-600 mb-6">Create your first poll to get started.</p>
          <Link
            href="/admin/polls/new"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Poll
          </Link>
        </div>
      )}
        </div>
      </main>
    </>
  );
}
