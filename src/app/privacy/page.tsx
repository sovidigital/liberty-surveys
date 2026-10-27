import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Privacy Policy - Liberty Surveys',
  description: 'Privacy Policy for Liberty Surveys',
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: Feb. 17, 2024</p>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Who We Are</h2>
            <p className="text-gray-700 leading-relaxed mb-4">Our website address is: https://libertysurveys.com.</p>
            <p className="text-gray-700 leading-relaxed">
              LibertySurveys.com is concerned about privacy issues and wants you to be familiar with how we collect, use and disclose information. This Privacy Policy describes our practices in connection with information that we collect through this website owned and controlled by us which display or link to this Privacy Policy (the &quot;Site&quot;). By using our Sites, you agree to the terms and conditions of this Privacy Policy.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Text Messaging Opt-Ins</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>These terms ONLY apply to text messaging opt-ins:</strong> No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3"><strong>LibertySurveys.com text messaging program:</strong></p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Message frequency – message frequency varies</li>
              <li>Customer care information – Reply HELP for help</li>
              <li>Customer care email – <a href="mailto:info@libertysurveys.com" className="text-[#0066b3] hover:underline">info@libertysurveys.com</a></li>
              <li>Opt out instructions – Reply STOP to end. You will then be unsubscribed from LibertySurveys.com and no further msgs will be delivered.</li>
              <li>Link to Terms of Service – <Link href="/terms" className="text-[#0066b3] hover:underline">Terms of Use</Link></li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Carriers are not liable for delayed or undelivered messages. Message and data rates may apply. Mobile subscribers&apos; phone number will NEVER be shared or sold to third parties.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Personal Information</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">Personal Information We Collect</h3>
            <p className="text-gray-700 leading-relaxed mb-3">&quot;Personal Information&quot; is information that identifies you as an individual, such as:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700">
              <li>Name</li>
              <li>Postal address</li>
              <li>Telephone number</li>
              <li>Email address</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              In some cases, we may collect information, such as your age, weight, health conditions, insurance type, and whether you&apos;re a non-smoker, combined with your Personal Information. We will treat all such information as Personal Information as long as it is combined with Personal Information.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We collect Personal Information when you interact with us on the Site. We may associate Personal Information you provide through the Site with Personal Information collected from other sources. We will use the combined information in accordance with this Privacy Policy as long as it is combined.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">How We Use Personal Information</h3>
            <p className="text-gray-700 leading-relaxed mb-3">We may use Personal Information:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>When you request, to connect you with vendors who will provide you with information about products and services.</li>
              <li>To respond to your inquiries and fulfill your requests, such as to send you newsletters.</li>
              <li>To send you important information regarding the Site, changes to our terms, conditions, and policies and/or other administrative information.</li>
              <li>To send you surveys and marketing communications that we believe may be of interest to you.</li>
              <li>To personalize your experience on the Site and our other websites by presenting advertising, products and offers tailored to you.</li>
              <li>To allow you to participate in sweepstakes, contests and similar promotions and to administer these activities.</li>
              <li>To allow you to send messages to a friend through the Site. By using this functionality, you are telling us that you are entitled to use and provide us with your friend&apos;s name and email address.</li>
              <li>For our business purposes, such as data analysis, audits, developing new products, enhancing our website, improving our services, identifying usage trends and determining the effectiveness of our promotional campaigns.</li>
              <li>If you purchase a product or service from us, to complete and fulfill your purchase, for example, to have your payments processed, communicate with you regarding your purchase and provide you with related customer service.</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">How Personal Information is Disclosed</h3>
            <p className="text-gray-700 leading-relaxed mb-3">Your Personal Information may be disclosed:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>To our affiliates, for the purposes described in this Privacy Policy. LibertySurveys.com is the party responsible for the management of the jointly-used Personal Information.</li>
              <li>To our third party service providers who provide services such as contact information verification, payment processing, order fulfillment, customer service, website hosting, data analysis, infrastructure provision, IT services, email delivery services, auditing services and other similar services to enable them to provide services.</li>
              <li>If you request information from vendors so that they (or so that third parties who provide similar services) can provide you with information about their products and services. <strong>WE ARE NOT RESPONSIBLE OR LIABLE FOR VENDORS&apos; USE OF YOUR PERSONAL INFORMATION.</strong></li>
              <li>If you choose to download a white paper, eBook, or other resource, to our clients, partners and current and future sponsors of that resource.</li>
              <li>To third party sponsors of sweepstakes, contests and similar promotions.</li>
              <li>If you choose to send messages through the Site, to identify you as the sender to the recipient indicated by you.</li>
              <li>By you, on message boards, chat, profile pages and blogs and other services to which you are able to post information and materials. Please note that any information you post or disclose through these services will become public information.</li>
              <li>To a third party in the event of any reorganization, merger, sale, joint venture, assignment, transfer or other disposition of all or any portion of our business, assets or stock (including in connection with any bankruptcy or similar proceedings).</li>
              <li>As we believe to be necessary or appropriate: (a) under applicable law; (b) to comply with legal process; (c) to respond to requests from public and government authorities; (d) to enforce our terms and conditions; (e) to protect our operations or those of any of our affiliates; (f) to protect our rights, privacy, safety or property, and/or that of our affiliates, you or others; and (g) to allow us to pursue available remedies or limit the damages that we may sustain.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Non-Personal Information</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Non-Personal Information We Collect</h3>
            <p className="text-gray-700 leading-relaxed mb-3">&quot;Non-Personal Information&quot; is any information that does not reveal your specific identity, such as:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700">
              <li>Browser information</li>
              <li>Information collected through cookies, pixel tags and other technologies</li>
              <li>Demographic information and other information provided by you</li>
              <li>Aggregated information</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">How We Collect Non-Personal Information</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We and our third party service providers may collect Non-Personal Information from you, including your MAC address, your computer type, screen resolution, OS version, Internet browser, as well as demographic data. We also aggregate Personal Information in a manner such that the end-product does not personally identify you or any other user of the Site. We also collect Non-Personal Information through the use of cookies, pixel tags, web beacons, or other similar technologies.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">How We Use and Disclose Non-Personal Information</h3>
            <p className="text-gray-700 leading-relaxed">
              Because Non-Personal Information does not personally identify you, we may use and disclose Non-Personal Information for any purpose. In some instances, we may combine Non-Personal Information with Personal Information. If we combine any Non-Personal Information with Personal Information, the combined information will be treated by us as Personal Information as long as it is combined.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">IP Addresses</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your &quot;IP Address&quot; is a number that is automatically assigned to the computer that you are using by your Internet Service Provider (ISP).
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-3">How We Log IP Addresses</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              An IP Address is identified and logged automatically in our server log files whenever a user visits the Site, along with the time of the visit and the page(s) that were visited. Collecting IP Addresses is standard practice on the Internet and is done automatically by many web sites.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-6">How We Use and Disclose IP Addresses</h3>
            <p className="text-gray-700 leading-relaxed">
              We use IP Addresses for purposes such as calculating Site usage levels, helping diagnose server problems, geographic mapping and administering the Site. We may also use and disclose IP Addresses for all the purposes for which we use and disclose Personal Information. Please note that we treat IP Addresses, server log files and related information as Non-Personal Information, except where we are required to do otherwise under applicable law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Third Party Sites</h2>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy does not address, and we are not responsible for, the privacy, information or other practices of any third parties, including any third party operating any site to which this Site contains a link or a widget on our site. The inclusion of a link on the Site does not imply endorsement of the linked site by us or by our affiliates.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Third Party Vendors</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We also work with vendors and partners in operating and improving the Site. These vendors and other partners include advertisers (including both banner and text advertising), retargeters and web analytics companies. These partners and vendors use cookies, web beacons and other technologies to collect information about your online activity in order to help manage ad campaigns, understand user interests and trends and deliver personalized content and advertising to you.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use third-party advertising companies to serve ads when you visit our Web site. These companies may use aggregated information (not including your name, address, email address or telephone number) about your visits to this and other Web sites in order to provide advertisements about goods and services of interest to you.
            </p>
            <p className="text-gray-700 leading-relaxed font-semibold">
              PLEASE NOTE THAT WE ARE NOT RESPONSIBLE OR LIABLE FOR THE ACTS AND/OR OMISSIONS OF THIRD PARTY VENDORS.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Consumer Privacy &amp; Third-Party Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Notwithstanding anything else in this policy, we and/or our partners may place or read use IP and/or cookies to enable you to receive personalized ads or content. These cookies contain zero personally identifiable information. Users may express their choices for display advertising through the following platforms: Digital Advertising Alliance opt-out platform or the Network Advertising Initiative opt-out platform.
            </p>
            <p className="text-gray-700 leading-relaxed">
              To opt out, go to: <Link href="/unsubscribe" className="text-[#0066b3] hover:underline">https://www.libertysurveys.com/unsubscribe/</Link>
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use reasonable organizational, technical and administrative measures to protect Personal Information under our control. Unfortunately, no data transmission over the Internet or data storage system can be guaranteed to be 100% secure. If you have reason to believe that your interaction with us is no longer secure, please immediately notify us of the problem by contacting us in accordance with the &quot;Contacting Us&quot; section below.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The security of your personal information is important to us. When you enter sensitive information (such as credit card number and personal health information) on our forms, we encrypt that information once it is entered.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Choices and Access</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Your choices regarding our use and disclosure of your Personal Information</h3>
            <p className="text-gray-700 leading-relaxed mb-3">We give you choices regarding our use and disclosure of your Personal Information for marketing purposes. You may opt-out from:</p>
            <ul className="list-disc pl-6 mb-4 space-y-3 text-gray-700">
              <li>
                <strong>Receiving electronic communications from us and our affiliates:</strong> If you no longer want to receive marketing-related emails from us and our affiliates on a going-forward basis, you may opt-out of receiving these marketing-related emails by emailing <a href="mailto:support@libertysurveys.com" className="text-[#0066b3] hover:underline">support@libertysurveys.com</a> and following the instructions to unsubscribe.
              </li>
              <li>
                <strong>Our sharing of your Personal Information with unaffiliated third parties:</strong> If you would prefer that we do not share your Personal Information on a going-forward basis with unaffiliated third parties for their marketing purposes, you may opt-out of this sharing by contacting us and requesting that we suppress all of your Personal Information on a going-forward basis.
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-6">
              We will seek to comply with your request(s) as soon as reasonably practicable. Please note that if you do opt-out of receiving marketing-related messages from us, we may still send you important administrative messages, and you cannot opt-out from receiving administrative messages.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-3">How you can access, change or suppress your Personal Information</h3>
            <p className="text-gray-700 leading-relaxed">
              If you would like to review, correct, update, suppress, delete or otherwise limit our use of your Personal Information that has been previously provided to us, you may do so by contacting us at <a href="mailto:support@libertysurveys.com" className="text-[#0066b3] hover:underline">support@libertysurveys.com</a> and provide the name of the service for which information was provided, your full name, mailing address, phone number and email address so that we may identify you in the opt-out process.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Data Retention Period</h2>
            <p className="text-gray-700 leading-relaxed">
              We will retain your Personal Information for as long as your account is active or as needed to provide you services and for the period necessary to fulfill the purposes outlined in this Privacy Policy unless a longer retention period is required or allowed by law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Use of Site by Minors</h2>
            <p className="text-gray-700 leading-relaxed">
              The Site is not directed to individuals under the age of thirteen (13), and we request that these individuals do not provide Personal Information through the Site.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Cross-Border Transfer</h2>
            <p className="text-gray-700 leading-relaxed">
              Your Personal Information may be stored and processed in any country where we have facilities, and by providing any PII to us, you consent to the transfer of such Personal Information to countries outside of your country of residence, including the United States, which may have different data protection rules from your country of residence.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Sensitive Information</h2>
            <p className="text-gray-700 leading-relaxed">
              We ask that you not send us, and you not disclose, any sensitive Personal Information (e.g., Social Security number, driver&apos;s license number, credit card number, information related to racial or ethnic origin, political opinions, religion or other beliefs, criminal background or trade union membership) on or through the Site or otherwise to us.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Your California Privacy Rights</h2>
            <p className="text-gray-700 leading-relaxed">
              California has passed legislation requiring certain specific disclosures be made available to California residents who use the Internet and provide information that may be used for marketing purposes. That legislation requires any business that discloses a customer&apos;s personal information to any third party for direct marketing purposes to provide the customer a method for obtaining the names, addresses and certain other specified details of anyone who might have received that personal information. If you are a California resident you may request this information by writing to us at the address below. LibertySurveys.com is not obligated to respond to more than one such request from you per calendar year.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Updates to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may change this Privacy Policy. Please take a look at the &quot;LAST UPDATED&quot; legend at the top of this page to see when this Privacy Policy was last revised. We reserve the right to modify this privacy statement at any time, so please review it frequently. If we make material changes to this policy, we will notify you here in this policy, by email, or by means of a notice on our home page. Any changes to this Privacy Policy will become effective when we post the revised Privacy Policy on the Site. Your use of the Site following these changes means that you accept the revised Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Contacting Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, please contact us by email at <a href="mailto:support@libertysurveys.com" className="text-[#0066b3] hover:underline">support@libertysurveys.com</a>, or please write to the following address:
            </p>
            <address className="not-italic text-gray-700 pl-4 border-l-4 border-[#0066b3] bg-gray-50 py-3">
              Domain Administrator<br />
              LibertySurveys.com<br />
              124 Broadkill Rd #495<br />
              Milton, DE 19968-1008
            </address>
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
          <div className="flex justify-center space-x-6 mb-4">
            <Link href="/privacy" className="text-white font-medium">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
          </div>
          © {new Date().getFullYear()} Liberty Surveys. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
