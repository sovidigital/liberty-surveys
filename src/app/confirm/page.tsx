import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCircleCheck, 
  faCircleXmark, 
  faClock, 
  faCircleQuestion, 
  faTriangleExclamation,
  faEnvelope 
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface Props {
  searchParams: Promise<{ status?: string; error?: string }>;
}

interface ContentConfig {
  icon: IconDefinition;
  iconBg: string;
  iconColor: string;
  title: string;
  message: string;
  showSubscribe: boolean;
}

export default async function ConfirmPage({ searchParams }: Props) {
  const { status, error } = await searchParams;

  const getContent = (): ContentConfig => {
    if (status === 'success') {
      return {
        icon: faCircleCheck,
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        title: 'Subscription Confirmed!',
        message: 'Thank you for confirming your email. You\'re now subscribed to Liberty Surveys and will receive daily polls in your inbox.',
        showSubscribe: false,
      };
    }

    if (status === 'already_confirmed') {
      return {
        icon: faCircleCheck,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        title: 'Already Confirmed',
        message: 'Your email is already confirmed. You\'re all set to receive our daily polls!',
        showSubscribe: false,
      };
    }

    if (error === 'invalid' || error === 'invalid_token') {
      return {
        icon: faCircleXmark,
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        title: 'Invalid Link',
        message: 'This confirmation link is invalid. Please make sure you clicked the correct link from your email.',
        showSubscribe: true,
      };
    }

    if (error === 'expired') {
      return {
        icon: faClock,
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        title: 'Link Expired',
        message: 'This confirmation link has expired. Please subscribe again to receive a new confirmation email.',
        showSubscribe: true,
      };
    }

    if (error === 'not_found') {
      return {
        icon: faCircleQuestion,
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        title: 'Not Found',
        message: 'We couldn\'t find this subscription. Please try subscribing again.',
        showSubscribe: true,
      };
    }

    if (error === 'server') {
      return {
        icon: faTriangleExclamation,
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        title: 'Something Went Wrong',
        message: 'An error occurred while confirming your subscription. Please try again or contact support.',
        showSubscribe: true,
      };
    }

    return {
      icon: faEnvelope,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: 'Confirm Your Email',
      message: 'Please check your email and click the confirmation link to complete your subscription.',
      showSubscribe: false,
    };
  };

  const content = getContent();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 ${content.iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}>
          <FontAwesomeIcon icon={content.icon} className={`text-4xl ${content.iconColor}`} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {content.title}
        </h1>
        
        <p className="text-gray-600 mb-8">
          {content.message}
        </p>

        <div className="space-y-4">
          {content.showSubscribe && (
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Subscribe Again
            </Link>
          )}
          
          <Link
            href="/polls"
            className="block w-full px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            View Current Poll
          </Link>
        </div>

        <div className="mt-8">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
