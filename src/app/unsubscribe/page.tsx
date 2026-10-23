import Link from 'next/link';

interface Props {
  searchParams: Promise<{ status?: string; error?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { status, error } = await searchParams;

  const getContent = () => {
    if (status === 'success') {
      return {
        icon: '👋',
        iconBg: 'bg-blue-100',
        title: 'Successfully Unsubscribed',
        message: 'You\'ve been unsubscribed from Liberty Surveys. We\'re sorry to see you go! You can resubscribe anytime.',
        showResubscribe: true,
      };
    }

    if (status === 'already_unsubscribed') {
      return {
        icon: '✓',
        iconBg: 'bg-gray-100',
        title: 'Already Unsubscribed',
        message: 'This email has already been unsubscribed from Liberty Surveys.',
        showResubscribe: true,
      };
    }

    if (error === 'invalid' || error === 'invalid_token') {
      return {
        icon: '✗',
        iconBg: 'bg-red-100',
        title: 'Invalid Link',
        message: 'This unsubscribe link is invalid. Please use the unsubscribe link from one of our emails.',
        showResubscribe: false,
      };
    }

    if (error === 'not_found') {
      return {
        icon: '?',
        iconBg: 'bg-gray-100',
        title: 'Not Found',
        message: 'We couldn\'t find this subscription in our records.',
        showResubscribe: false,
      };
    }

    if (error === 'server') {
      return {
        icon: '!',
        iconBg: 'bg-red-100',
        title: 'Something Went Wrong',
        message: 'An error occurred while processing your request. Please try again.',
        showResubscribe: false,
      };
    }

    return {
      icon: '📭',
      iconBg: 'bg-gray-100',
      title: 'Unsubscribe',
      message: 'Use the unsubscribe link in any of our emails to manage your subscription.',
      showResubscribe: false,
    };
  };

  const content = getContent();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 ${content.iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}>
          <span className="text-4xl">{content.icon}</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {content.title}
        </h1>
        
        <p className="text-gray-600 mb-8">
          {content.message}
        </p>

        <div className="space-y-4">
          {content.showResubscribe && (
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Resubscribe
            </Link>
          )}
          
          <Link
            href="/"
            className="block w-full px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
