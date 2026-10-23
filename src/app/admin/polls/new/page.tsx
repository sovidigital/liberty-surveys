'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';

interface Option {
  id: string;
  text: string;
}

export default function CreatePollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<Option[]>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ]);
  const [status, setStatus] = useState<'draft' | 'scheduled'>('draft');
  const [scheduledFor, setScheduledFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addOption() {
    if (options.length >= 6) return;
    setOptions([...options, { id: String(Date.now()), text: '' }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions(options.filter(opt => opt.id !== id));
  }

  function updateOption(id: string, text: string) {
    setOptions(options.map(opt => 
      opt.id === id ? { ...opt, text } : opt
    ));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      setError('Please enter at least 2 options');
      return;
    }

    if (status === 'scheduled' && !scheduledFor) {
      setError('Please select a scheduled date');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions.map(opt => ({ text: opt.text.trim() })),
          status,
          scheduled_for: status === 'scheduled' ? scheduledFor : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/admin/polls');
        router.refresh();
      } else {
        setError(data.error || 'Failed to create poll');
      }
    } catch {
      setError('Unable to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminNav />
      <main className="py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/admin/polls"
              className="text-[#0066b3] hover:text-[#004d8a] text-sm"
            >
          ← Back to Polls
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Poll</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
            Poll Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066b3] focus:border-transparent resize-none"
            placeholder="Enter your poll question..."
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Answer Options ({options.length}/6)
          </label>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={option.id} className="flex gap-3">
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => updateOption(option.id, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066b3] focus:border-transparent"
                  placeholder={`Option ${index + 1}`}
                  disabled={loading}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(option.id)}
                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 text-[#0066b3] hover:text-[#004d8a] text-sm font-medium"
              disabled={loading}
            >
              + Add Another Option
            </button>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="draft"
                checked={status === 'draft'}
                onChange={() => setStatus('draft')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-gray-700">Save as Draft</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="scheduled"
                checked={status === 'scheduled'}
                onChange={() => setStatus('scheduled')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-gray-700">Schedule</span>
            </label>
          </div>
        </div>

        {status === 'scheduled' && (
          <div className="mb-6">
            <label htmlFor="scheduledFor" className="block text-sm font-medium text-gray-700 mb-2">
              Schedule For
            </label>
            <input
              type="datetime-local"
              id="scheduledFor"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066b3] focus:border-transparent"
              disabled={loading}
            />
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-[#e31c23] text-white font-semibold rounded-lg hover:bg-[#c41920] focus:outline-none focus:ring-2 focus:ring-[#e31c23] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Poll'}
          </button>
          <Link
            href="/admin/polls"
            className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
        </div>
      </main>
    </>
  );
}
