import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'SMS Terms - Liberty Surveys',
  description: 'SMS Terms and Conditions for Liberty Surveys text messaging program',
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Liberty Surveys"
                width={200}
                height={60}
                className="h-14 w-auto"
              />
            </Link>
            <div className="space-x-6">
              <Link href="/polls" className="text-gray-600 hover:text-[#1a1a1a]">
                Results
              </Link>
              <Link href="/archive" className="text-gray-600 hover:text-[#1a1a1a]">
                Archive
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <article className="bg-white rounded-xl shadow-sm p-8 md:p-12 border border-gray-200">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">SMS Terms &amp; Conditions</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Program Description</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Liberty Surveys</strong> offers a text messaging program that delivers daily poll alerts and links about current events directly to your mobile device. By opting in to our SMS program, you consent to receive recurring automated marketing and informational text messages related to our daily political polls and surveys.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Message Frequency</h2>
            <p className="text-gray-700 leading-relaxed">
              Message frequency varies. You may receive up to 1 message per day. The number of messages you receive may vary based on your interaction with our service and current events.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Message and Data Rates</h2>
            <p className="text-gray-700 leading-relaxed">
              <strong>Message and data rates may apply.</strong> Please contact your wireless carrier for details about your text messaging plan and any charges that may apply. You are responsible for all charges and fees associated with text messaging imposed by your wireless carrier.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">How to Opt Out</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can cancel the SMS service at any time. To stop receiving text messages from Liberty Surveys, simply text <strong>STOP</strong> to the number from which you received the message. After texting STOP, you will receive a one-time confirmation message confirming that you have been unsubscribed. After this, you will no longer receive SMS messages from us.
            </p>
            <p className="text-gray-700 leading-relaxed">
              If you are experiencing issues with the messaging program, you can reply with the keyword <strong>HELP</strong> for more assistance, or you can get help directly at{' '}
              <a href="mailto:support@libertysurveys.com" className="text-[#0066b3] hover:underline">support@libertysurveys.com</a>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Carrier Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              Carriers are not liable for delayed or undelivered messages. Message delivery is subject to effective transmission from your network operator and is outside of our control. T-Mobile is not liable for delayed or undelivered messages.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Consent Not Required for Purchase</h2>
            <p className="text-gray-700 leading-relaxed">
              Consent to receive automated marketing text messages is not a condition of any purchase. You may opt out at any time without affecting any other rights or services.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Data Sharing</h2>
            <p className="text-gray-700 leading-relaxed">
              <strong>Mobile opt-in data and consent will not be shared with third parties or affiliates for marketing or promotional purposes.</strong> Your phone number and opt-in consent information is used solely to deliver messages from Liberty Surveys and will not be sold, rented, or otherwise disclosed to third parties for their marketing purposes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Supported Carriers</h2>
            <p className="text-gray-700 leading-relaxed">
              Our SMS program is supported by major U.S. carriers including AT&amp;T, Verizon Wireless, Sprint, T-Mobile, U.S. Cellular, and other participating carriers. Supported carriers may change without notice.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about these SMS Terms or our text messaging program, please contact us:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:support@libertysurveys.com" className="text-[#0066b3] hover:underline">support@libertysurveys.com</a>
              </li>
              <li>
                <strong>Text:</strong> Reply <strong>HELP</strong> to any message
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Related Policies</h2>
            <p className="text-gray-700 leading-relaxed">
              By participating in our SMS program, you also agree to our{' '}
              <a
                href="https://www.dailytrendsmedia.com/privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0066b3] hover:underline"
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="https://www.dailytrendsmedia.com/terms-of-service/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0066b3] hover:underline"
              >
                Terms of Use
              </a>.
            </p>
          </section>
        </article>

        <div className="mt-8 text-center">
          <Link href="/" className="text-[#0066b3] hover:text-[#004d86] font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>

      <footer className="bg-[#1a1a1a] text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
            <a
              href="https://www.dailytrendsmedia.com/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://www.dailytrendsmedia.com/terms-of-service/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Terms of Use
            </a>
            <a
              href="https://www.dailytrendsmedia.com/dont-sell/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Do Not Sell
            </a>
            <Link href="/sms-terms" className="text-white font-medium">
              SMS Terms
            </Link>
          </div>
          © {new Date().getFullYear()} Liberty Surveys. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
