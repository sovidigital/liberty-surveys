import Link from 'next/link';
import Image from 'next/image';
import { SignupForm } from '@/components/SignupForm';
import { AdUnit } from '@/components/AdUnit';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faCheckToSlot, faChartBar } from '@fortawesome/free-solid-svg-icons';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header - White bar for logo visibility */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Liberty Surveys"
                width={200}
                height={60}
                className="h-14 w-auto"
                priority
              />
            </Link>
            <div className="space-x-6">
              <Link href="/polls" className="text-gray-600 hover:text-[#1a1a1a] transition-colors">
                Results
              </Link>
              <Link href="/archive" className="text-gray-600 hover:text-[#1a1a1a] transition-colors">
                Archive
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Brand colors: charcoal/blue gradient */}
      <section className="bg-gradient-to-b from-[#1a1a1a] to-[#0066b3] text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Your Voice Matters
            </h2>
            <p className="text-xl text-blue-100 mb-10">
              Share your views on the issues that matter most.
              Receive a daily poll on current events and see how your opinions compare.
            </p>
            
            <div className="flex justify-center">
              <SignupForm />
            </div>

            <p className="mt-4 text-sm text-blue-200">
              One email per day. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-[#1a1a1a] mb-12">
            How It Works
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#0066b3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faEnvelope} className="text-2xl text-[#0066b3]" />
              </div>
              <h4 className="text-xl font-semibold text-[#1a1a1a] mb-2">
                Daily Email
              </h4>
              <p className="text-gray-600">
                Receive a fresh political poll every morning covering the latest issues and debates.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#e31c23]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faCheckToSlot} className="text-2xl text-[#e31c23]" />
              </div>
              <h4 className="text-xl font-semibold text-[#1a1a1a] mb-2">
                One-Click Vote
              </h4>
              <p className="text-gray-600">
                Cast your vote instantly with a single click, directly from your inbox.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-[#0066b3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faChartBar} className="text-2xl text-[#0066b3]" />
              </div>
              <h4 className="text-xl font-semibold text-[#1a1a1a] mb-2">
                See Results
              </h4>
              <p className="text-gray-600">
                View real-time results and see how others responded to the same questions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ad Unit - Between sections */}
      <section className="py-4 bg-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Ad slot ID placeholder: Replace with real slot from AdSense console */}
          <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} format="horizontal" className="min-h-[90px]" />
        </div>
      </section>

      {/* Latest Poll Preview */}
      <section className="py-20 bg-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-[#1a1a1a] mb-6">
            See What We&apos;re Asking
          </h3>
          <p className="text-gray-600 mb-8">
            Browse our archive of past polls and see results from the community.
          </p>
          <div className="space-x-4">
            <Link
              href="/polls"
              className="inline-block px-6 py-3 bg-[#e31c23] text-white font-semibold rounded-lg hover:bg-[#c41920] transition-colors"
            >
              View Current Poll
            </Link>
            <Link
              href="/archive"
              className="inline-block px-6 py-3 bg-white text-[#0066b3] font-semibold rounded-lg border border-[#0066b3] hover:bg-[#0066b3]/5 transition-colors"
            >
              Browse Archive
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <Image
                src="/logo-white.png"
                alt="Liberty Surveys"
                width={180}
                height={54}
                className="h-12 w-auto mb-3"
              />
              <p className="text-sm">Making your voice heard, one poll at a time.</p>
            </div>
            <div className="flex space-x-8">
              <Link href="/polls" className="hover:text-white transition-colors">
                Results
              </Link>
              <Link href="/archive" className="hover:text-white transition-colors">
                Archive
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            © {new Date().getFullYear()} Liberty Surveys. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
