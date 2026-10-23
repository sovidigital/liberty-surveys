'use client';

import { PollOption } from '@/types';

interface PollResultsProps {
  question: string;
  options: Array<PollOption & { vote_count: number }>;
  totalVotes: number;
  status: 'active' | 'closed';
  showPercentages?: boolean;
}

export function PollResults({
  question,
  options,
  totalVotes,
  status,
  showPercentages = true,
}: PollResultsProps) {
  const sortedOptions = [...options].sort((a, b) => b.vote_count - a.vote_count);

  const getPercentage = (count: number): number => {
    if (totalVotes === 0) return 0;
    return Math.round((count / totalVotes) * 100);
  };

  const barColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
  ];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{question}</h2>

      <div className="space-y-4">
        {sortedOptions.map((option, index) => {
          const percentage = getPercentage(option.vote_count);
          const barColor = barColors[index % barColors.length];

          return (
            <div key={option.id} className="relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-800 font-medium">{option.option_text}</span>
                <span className="text-gray-600 text-sm">
                  {showPercentages ? `${percentage}%` : ''} ({option.vote_count.toLocaleString()} votes)
                </span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
        <span>Total votes: {totalVotes.toLocaleString()}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === 'active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {status === 'active' ? 'Voting Open' : 'Voting Closed'}
        </span>
      </div>
    </div>
  );
}
