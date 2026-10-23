'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  pollId: string;
  pollStatus: string;
}

export function BroadcastButton({ pollId, pollStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleBroadcast() {
    if (!confirm('Are you sure you want to send this poll to all active subscribers?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: pollId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Broadcast sent to ${data.subscribers_count} subscribers!`);
        router.refresh();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }

  if (pollStatus === 'active') {
    return (
      <div className="text-right">
        <button
          onClick={handleBroadcast}
          disabled={loading}
          className="px-4 py-2 bg-[#0066b3] text-white font-medium rounded-lg hover:bg-[#004d8a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending...' : 'Resend Broadcast'}
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={handleBroadcast}
        disabled={loading}
        className="px-4 py-2 bg-[#e31c23] text-white font-medium rounded-lg hover:bg-[#c41920] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Publishing...' : 'Publish & Send Broadcast'}
      </button>
      {message && (
        <p className={`mt-2 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
