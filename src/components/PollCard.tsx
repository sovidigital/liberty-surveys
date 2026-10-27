import Link from 'next/link';
import { Poll, PollOption } from '@/types';

interface PollCardProps {
  poll: Poll & {
    options: Array<PollOption & { vote_count: number }>;
    total_votes: number;
  };
}

export function PollCard({ poll }: PollCardProps) {
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const displayDate = poll.published_at || poll.created_at;

  return (
    <Link
      href={`/polls/${poll.id}`}
      className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm text-gray-500">{formatDate(displayDate)}</span>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            poll.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {poll.status === 'active' ? 'Open' : 'Closed'}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
        {poll.question}
      </h3>

      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>{poll.options.length} options</span>
        <span>{poll.total_votes.toLocaleString()} votes</span>
      </div>

      {poll.options.length > 0 && poll.total_votes > 0 && (
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden flex">
          {poll.options.map((opt, idx) => {
            const percentage = (opt.vote_count / poll.total_votes) * 100;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
            return (
              <div
                key={opt.id}
                className={`h-full ${colors[idx % colors.length]}`}
                style={{ width: `${percentage}%` }}
              />
            );
          })}
        </div>
      )}
    </Link>
  );
}
