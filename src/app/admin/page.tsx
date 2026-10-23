import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

async function getDashboardStats() {
  try {
    const [subscribersResult, pollsResult, votesResult] = await Promise.all([
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count 
         FROM subscribers 
         GROUP BY status`
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count 
         FROM polls 
         GROUP BY status`
      ),
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM votes'
      ),
    ]);

    const subscriberStats = subscribersResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      },
      { pending: 0, active: 0, unsubscribed: 0 } as Record<string, number>
    );

    const pollStats = pollsResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      },
      { draft: 0, scheduled: 0, active: 0, closed: 0 } as Record<string, number>
    );

    const totalVotes = parseInt(votesResult.rows[0]?.count || '0', 10);

    return {
      subscribers: subscriberStats,
      polls: pollStats,
      totalVotes,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      subscribers: { pending: 0, active: 0, unsubscribed: 0 },
      polls: { draft: 0, scheduled: 0, active: 0, closed: 0 },
      totalVotes: 0,
    };
  }
}

export default async function AdminDashboard() {
  const session = await getSession();
  
  if (!session) {
    redirect('/admin/login');
  }

  const stats = await getDashboardStats();

  return (
    <>
      <AdminNav />
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Active Subscribers</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.subscribers.active.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.subscribers.pending} pending · {stats.subscribers.unsubscribed} unsubscribed
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Polls</h3>
          <p className="text-3xl font-bold text-gray-900">
            {Object.values(stats.polls).reduce((a, b) => a + b, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.polls.active} active · {stats.polls.scheduled} scheduled
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Votes Cast</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.totalVotes.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Quick Actions</h3>
          <div className="mt-2 space-y-2">
            <Link
              href="/admin/polls/new"
              className="block text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + Create New Poll
            </Link>
            <Link
              href="/admin/polls"
              className="block text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All Polls
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
        </div>
        <div className="p-6">
          <div className="prose prose-sm max-w-none text-gray-600">
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <strong>Create a poll</strong> - Go to{' '}
                <Link href="/admin/polls/new" className="text-blue-600 hover:underline">
                  Create Poll
                </Link>{' '}
                and add your question with 2-4 answer options.
              </li>
              <li>
                <strong>Schedule or publish</strong> - Save as draft, schedule for a future date, or publish immediately.
              </li>
              <li>
                <strong>Send to subscribers</strong> - Once published, trigger a broadcast to send the poll to all active subscribers.
              </li>
              <li>
                <strong>Monitor results</strong> - Watch votes come in and view results on the public results page.
              </li>
            </ol>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> This is a development environment. To send actual emails, configure Customer.io 
                credentials in your environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>
    </>
  );
}
