export const dynamic = 'force-dynamic';

export default function RecapEmailPreview() {
  const results = {
    question: '[SAMPLE] Should Congress pass the proposed infrastructure modernization bill?',
    options: [
      { text: 'Yes, pass the bill as proposed', percentage: 43 },
      { text: 'Yes, but with spending reductions', percentage: 29 },
      { text: 'No, reject the proposal', percentage: 14 },
      { text: 'Undecided / Need more information', percentage: 14 },
    ],
    briefingExcerpt: 'Congress is currently debating a $500 billion infrastructure modernization bill that would fund repairs to roads, bridges, and broadband expansion.',
    resultsUrl: 'https://libertysurveys.com/polls/01MOCK0001',
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
          <p className="text-sm text-gray-400">Today&apos;s Results Are In</p>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {/* Date */}
          <p className="text-sm text-gray-500 text-center mb-4">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {/* Question */}
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-6 text-center">
            {results.question.replace('[SAMPLE] ', '')}
          </h1>

          {/* Results */}
          <div className="space-y-4 mb-6">
            {results.options.map((option, i) => {
              const colors = ['#0066b3', '#e31c23', '#1a1a1a', '#666666'];
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-800">{option.text}</span>
                    <span className="text-sm font-bold text-gray-900">{option.percentage}%</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(option.percentage, 3)}%`,
                        backgroundColor: colors[i % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Briefing Excerpt */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p className="text-gray-700 text-sm italic">
              &ldquo;{results.briefingExcerpt}&rdquo;
            </p>
          </div>

          {/* CTA Button */}
          <a
            href={results.resultsUrl}
            className="block w-full py-3 px-4 text-center font-semibold rounded-lg bg-[#0066b3] text-white"
          >
            View Full Results & Discussion →
          </a>

          {/* Tomorrow teaser */}
          <p className="text-center mt-6 text-sm text-gray-600">
            Check your inbox tomorrow at 7:00 AM ET for a new poll!
          </p>
        </div>

        {/* Footer */}
        <div className="bg-[#1a1a1a] p-6 text-center text-xs text-white leading-relaxed">
          <p className="mb-1">Liberty Surveys</p>
          <p className="mb-3">160 Greentree Drive, Suite 101<br />Dover, DE 19904</p>
          <p>
            <a href="#" className="underline text-gray-300 hover:text-white">Unsubscribe</a>
            {' · '}
            <a href="#" className="underline text-gray-300 hover:text-white">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
