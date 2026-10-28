export const dynamic = 'force-dynamic';

export default function DailyEmailPreview() {
  const poll = {
    question: '[SAMPLE] Should Congress pass the proposed infrastructure modernization bill?',
    options: [
      { text: 'Yes, pass the bill as proposed', voteUrl: '#' },
      { text: 'Yes, but with spending reductions', voteUrl: '#' },
      { text: 'No, reject the proposal', voteUrl: '#' },
      { text: 'Undecided / Need more information', voteUrl: '#' },
    ],
    briefing: {
      background: 'Congress is currently debating a $500 billion infrastructure modernization bill that would fund repairs to roads, bridges, and broadband expansion. The bill has bipartisan sponsors but faces opposition over spending levels.',
      conservative: 'Conservative lawmakers argue the bill\'s price tag is excessive and would add to the national debt. They advocate for more targeted spending and greater private sector involvement.',
      liberal: 'Progressive advocates support the bill but argue it should go further to address climate change and expand public transit. They contend infrastructure investment creates jobs.',
      centrist: 'Moderate voices see the bill as a starting point for compromise. They support the core infrastructure goals while acknowledging concerns about cost and implementation.',
    },
    sources: [
      { name: 'Associated Press', url: 'https://apnews.com' },
      { name: 'Fox News', url: 'https://foxnews.com' },
      { name: 'CNN', url: 'https://cnn.com' },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-200 p-8">
      <div className="max-w-[600px] mx-auto bg-white shadow-lg">
        <div className="text-center text-xs text-gray-500 p-2 bg-yellow-100 border-b border-yellow-200">
          [SAMPLE EMAIL PREVIEW - For demonstration purposes only]
        </div>
        
        {/* Header */}
        <div className="bg-[#1a1a1a] text-white p-6 text-center">
          <img src="/logo.png" alt="Liberty Surveys" className="h-10 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Your Daily Political Poll</p>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {/* Date */}
          <p className="text-sm text-gray-500 text-center mb-4">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {/* Question */}
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-6 text-center">
            {poll.question.replace('[SAMPLE] ', '')}
          </h1>

          {/* Vote Buttons */}
          <h2 className="text-lg font-bold text-center mb-4 text-[#1a1a1a]">Cast Your Vote</h2>
          <div className="space-y-3 mb-6">
            {poll.options.map((option, i) => (
              <a
                key={i}
                href={option.voteUrl}
                className="block w-full py-3 px-4 text-center font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: i === 0 ? '#e31c23' : '#0066b3',
                  color: 'white',
                }}
              >
                {option.text}
              </a>
            ))}
          </div>

          {/* Results Link */}
          <p className="text-center mb-8 text-sm text-gray-600">
            <a href="#" className="text-[#0066b3] underline">View current results →</a>
          </p>

          {/* Understanding the Issue */}
          <h2 className="text-lg font-bold text-center mb-4 text-[#1a1a1a]">Understanding the Issue</h2>

          {/* Background */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">📋 Background</h3>
            <p className="text-gray-700 text-sm">{poll.briefing.background}</p>
          </div>

          {/* Perspectives Grid */}
          <div className="space-y-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-1 text-sm">🔴 Conservative View</h3>
              <p className="text-red-800 text-xs">{poll.briefing.conservative}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-1 text-sm">🔵 Liberal View</h3>
              <p className="text-blue-800 text-xs">{poll.briefing.liberal}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-1 text-sm">🟣 Centrist View</h3>
              <p className="text-purple-800 text-xs">{poll.briefing.centrist}</p>
            </div>
          </div>

          {/* Sources */}
          <p className="text-xs text-gray-500 text-center">
            Sources: {poll.sources.map((s, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                <a href={s.url} className="underline">{s.name}</a>
              </span>
            ))}
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-6 text-center text-xs text-gray-500">
          <p className="mb-2">Liberty Surveys · libertysurveys.com</p>
          <p>
            <a href="#" className="underline">Unsubscribe</a>
            {' · '}
            <a href="#" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
