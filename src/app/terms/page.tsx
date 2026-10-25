import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Terms of Use - Liberty Surveys',
  description: 'Terms of Use for Liberty Surveys',
};

export default function TermsPage() {
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
        <article className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Use</h1>

          <h2>1. BINDING AGREEMENT</h2>
          <p className="uppercase text-sm font-medium">
            READ THE ENTIRE TERMS OF USE AGREEMENT (&quot;AGREEMENT&quot;) CAREFULLY BEFORE USING THIS PUBLISHER&apos;S WEBSITE, EMAILS, ONLINE PROPERTIES OR PUBLICATIONS.
          </p>
          <p>
            This Agreement is a binding legal contract between LibertySurveys.com (also referred to as &quot;Publisher,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) and the end user (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) that governs your use of one or more of Publisher&apos;s emails and online properties, including, without limitation, all content such as text, information, images, applications and audio (collectively, &quot;Content&quot;) and all services (&quot;Services&quot;) made available to you through the Publisher by us and/or third-parties (this website and the Content and Services are collectively referred to herein as the &quot;Site&quot;). Site refers to the pages within the Publisher&apos;s websites and emails.
          </p>
          <p>
            By using Publisher&apos;s Content and Services in any manner whatsoever, you indicate your conclusive acceptance of this Agreement. If you do not agree to this Agreement, do not access or use this Site in any manner whatsoever.
          </p>

          <h2>2. MEDICAL INFORMATION DISCLAIMER</h2>
          <p className="uppercase text-sm">
            THE INFORMATION PRESENTED BY THIS PUBLISHER IN E-MAIL AND ONLINE WEB PAGES IS FOR ENTERTAINMENT, EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY AND SHOULD NOT BE RELIED UPON AS QUALIFIED HEALTH OR MEDICAL ADVICE. ANY ACTION YOU TAKE ON THE BASIS OF THIS INFORMATION IS SOLELY AT YOUR OWN RISK AND EXPENSE. READERS ARE ADVISED TO CONSULT A QUALIFIED HEALTHCARE PROFESSIONAL ABOUT ANY ISSUE CONCERNING THEIR HEALTH AND WELLNESS.
          </p>

          <h2>3. EMAIL FROM THIS PUBLISHER</h2>
          <p>
            Users may subscribe or unsubscribe easily. If you have received an email newsletter or third-party email promotion from this Publisher and you wish to be removed from the list, please unsubscribe or opt-out by clicking on the unsubscribe or opt-out link found on the footer of every email sent by this Publisher. Please do not simply click &quot;report as spam&quot; or delete the email if you wish to remove yourself from our lists, as this does not remove you from the list effectively. Only the official unsubscribe link on the footer of the email itself or a manual removal by an official email administrator will add you to our permanent Do Not Email list ensuring you will no longer receive any further communications from the Publisher.
          </p>
          <p>Additionally or alternatively if you wish to contact Publisher via postal mail, you may write and mail to the following address:</p>
          <address className="not-italic my-4 pl-4 border-l-2 border-gray-300">
            LibertySurveys.com<br />
            Domain Administrator<br />
            124 Broadkill Rd #495<br />
            Milton, DE 19968-1008
          </address>
          <p>
            Electronic unsubscribe requests take effect immediately. If you wish to unsubscribe through other methods of contact, please allow up to 10 business days to process requests manually.
          </p>
          <p>
            Keep in mind if you opt-in to another website property we operate using a different email address, you may still receive materials from us at that new address.
          </p>

          <h2>4. YOUR USE OF CONTENT</h2>
          <p>
            The Content within the Site includes copyrighted works proprietary to us or to third-parties who have provided us with Content (&quot;Content Providers&quot;). You may download and print a single copy of the Content solely for your internal non-commercial use, provided that such Content must not be altered in any way and must contain all copyright and proprietary rights notices that accompany such Content.
          </p>
          <p className="uppercase text-sm">
            ANY UNAUTHORIZED OR UNAPPROVED USE OF ANY OF THE CONTENT CONSTITUTES COPYRIGHT INFRINGEMENT AND SUBJECTS YOU AND YOUR SUBSCRIBER OR EMPLOYER TO ALL CIVIL AND CRIMINAL PENALTIES PROVIDED FOR UNDER DOMESTIC AND INTERNATIONAL COPYRIGHT, TRADEMARK, AND OTHER LAWS AND TREATIES.
          </p>
          <p>
            RSS feeds of content headlines, limited text and a source link (&quot;RSS Content&quot;) are available for downloading and displaying in their original form. You must use the RSS feeds as provided by Publisher, and you may not edit or modify the text, content or links supplied by Publisher which link the reader to access the original full length article on Publisher&apos;s site (&quot;Source Content&quot;). The RSS Content may only be used with platforms that display a functional link that when accessed, takes the viewer directly to the Source Content on Publisher&apos;s own site.
          </p>

          <h2>5. INTELLECTUAL PROPERTY OWNERSHIP</h2>
          <p>
            You agree that we (or our Content Providers) own all worldwide rights, titles and interests in and to the Site and all intellectual property rights therein. No other rights or licenses, whether express, implied, arising by estoppel, or otherwise are conveyed or intended by this Agreement.
          </p>

          <h2>6. INTERACTIVE AREAS</h2>
          <p>
            You may be permitted to access and use the user generated content systems such as discussion forums, commenting systems, rating and review systems, blogging systems, and other forms of electronic communications available through the Site (&quot;Interactive Areas&quot;). If you participate in or use any Interactive Area, you are responsible for your own communications and the consequences of posting your communications.
          </p>
          <p>
            If you choose to post material using such Interactive Areas, you agree to do so solely for lawful purposes and in compliance with all applicable laws. You expressly agree that we have no responsibility for or control over the content you may post on or using these Interactive Areas.
          </p>
          <p>You also expressly agree that you will not post any material that:</p>
          <ul>
            <li>Is defamatory, libelous, abusive, or obscene</li>
            <li>Infringes on the copyright or any other proprietary right of a third-party</li>
            <li>Would invade the privacy of any other person</li>
            <li>Is intended to advertise to or solicit others without our express permission</li>
            <li>Constitutes charity solicitations, chain letters or pyramid schemes</li>
            <li>Contains a virus, worm, trojan horse, time bomb, or any other harmful program or component</li>
            <li>Does not generally pertain to the designated topic or theme of the Site</li>
          </ul>
          <p>
            You hereby grant to this Publisher a non-exclusive, worldwide, royalty-free, perpetual license, with right to sublicense, to reproduce, distribute, transmit, create derivative works of, publicly display and publicly perform any materials and other information you submit to the Interactive Areas by all means and in any media now known or hereafter developed for any use or purpose.
          </p>

          <h2>7. ADVERTISEMENTS AND LINKS</h2>
          <p>
            This Publisher&apos;s Content includes advertisements and other types of links to third-party websites including but not limited to co-branded links, links to services, references and promotions in Content. These third-party websites are not under this Publisher&apos;s control and we are not responsible for any linked third-party websites or for the content, products and/or services they provide.
          </p>
          <p className="uppercase text-sm">
            YOUR USE OF LINKED THIRD-PARTY WEBSITES IS AT YOUR RISK AND SUBJECT TO THE TERMS AND CONDITIONS OF USE FOR SUCH SITES. UNLESS EXPRESSLY STATED BY US, WE DO NOT RECOMMEND OR ENDORSE THE CONTENT, PARTICULAR PRODUCTS, SERVICES OR WEBSITES OF ANY THIRD-PARTIES OR MAKE ANY DETERMINATION WHETHER ANY SUCH CONTENT, PRODUCT, SERVICE, OR WEBSITE MAY BE ACCURATE, NECESSARY OR APPROPRIATE FOR YOU OR FOR YOUR USE.
          </p>
          <p>
            This Publisher uses third-party advertising companies to provide banner ads, links and text-based advertisements which are presented in various parts of the Publisher&apos;s content. Advertising companies may use information about your visits to this and other Websites in order to provide more targeted advertisements about goods and services of interest to you.
          </p>

          <h2>8. GENERAL DISCLAIMERS</h2>
          <p className="uppercase text-sm">
            THE SITE IS PROVIDED TO YOU ON AN &quot;AS IS, WITH ALL FAULTS&quot; BASIS, AND YOUR USE THEREOF IS AT YOUR OWN RISK. WE MAKE NO WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT, OR WARRANTIES ARISING BY COURSE OF DEALING OR CUSTOM OF TRADE. WE MAKE NO REPRESENTATION OR WARRANTY THAT ANY CONTENT IS ACCURATE, COMPLETE, APPROPRIATE, RELIABLE, OR TIMELY.
          </p>
          <p className="uppercase text-sm">
            WE ALSO MAKE NO REPRESENTATIONS OR WARRANTIES THAT YOUR ACCESS TO AND USE OF THE SITE (1) WILL BE UNINTERRUPTED OR ERROR-FREE, (2) IS FREE OF VIRUSES, UNAUTHORIZED CODE, OR OTHER HARMFUL COMPONENTS, OR (3) IS COMPLETELY SECURE. YOU ARE RESPONSIBLE FOR TAKING ALL PRECAUTIONS YOU BELIEVE NECESSARY OR ADVISABLE TO PROTECT YOU AGAINST ANY CLAIM, DAMAGE, LOSS OR HAZARD THAT MAY ARISE BY VIRTUE OF YOUR USE OF THE SITE.
          </p>
          <p>
            Some jurisdictions do not permit the exclusion or limitation of implied warranties. Therefore, only if required by applicable law, some or all of the exclusions or limitations above may not apply to you.
          </p>

          <h2>9. EXCLUSION OF DAMAGES</h2>
          <p className="uppercase text-sm">
            UNDER NO CIRCUMSTANCES WHATSOEVER WILL WE BE RESPONSIBLE OR LIABLE TO YOU OR ANY OTHER ENTITY FOR ANY DIRECT, COMPENSATORY, INDIRECT, INCIDENTAL, CONSEQUENTIAL (INCLUDING LOST PROFITS AND LOST BUSINESS OPPORTUNITIES), SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES THAT RESULT FROM OR RELATE IN ANY MANNER WHATSOEVER TO (1) YOUR USE OF THE SITE, OR RELIANCE ON THE CONTENT, OR (2) ERRORS, INACCURACIES, OMISSIONS, DEFECTS, UNTIMELINESS, SECURITY BREACHES, OR ANY OTHER FAILURE TO PERFORM BY US OR OUR CONTENT PROVIDERS.
          </p>
          <p>
            Some jurisdictions do not permit the exclusion of certain types of damages. Therefore, only if required by applicable law, some or all of the exclusions above may not apply to you.
          </p>

          <h2>10. INDEMNITY</h2>
          <p>
            You agree to defend, indemnify and hold us harmless against any losses, expenses, costs or damages (including our reasonable attorneys&apos; fees, expert fees&apos; and other reasonable costs of litigation) arising from, incurred as a result of, or in any manner related to (1) your breach of the terms of this Agreement, (2) your unauthorized or unlawful use of the Site, and (3) the unauthorized or unlawful use of the Site by any other person using your IDs.
          </p>

          <h2>11. YOUR PRIVACY</h2>
          <p>
            Your use of the Site is also subject to the terms and conditions of our <Link href="/privacy">Privacy Policy</Link>, which are incorporated into this Agreement by reference only. Please read it carefully to ensure that you understand and agree to how we collect, use, and protect information collected about you and your use of the Site.
          </p>

          <h2>12. ENTIRE AGREEMENT</h2>
          <p>
            This Agreement, including our Privacy Policy, contains the entire agreement between you and us relating to the subject matter hereof, and supersedes any other oral or written communications relating thereto. This Agreement may not be amended or supplemented by (1) any purchase order or similar form originated by you relating to the subject matter hereof, or (2) statements of any of our employees.
          </p>

          <h2>13. TERMINATION</h2>
          <p>
            Your right to access and use the Site immediately terminates without further notice upon your breach of this Agreement. We may terminate this Agreement and your right to access and use the Site, or any part thereof, at any time, with or without cause. You may terminate this Agreement by providing us with written notice of your termination and ceasing to use or access the Site.
          </p>
          <p>
            The following sections of this Agreement survive the expiration or termination of this Agreement for any reason whatsoever: Intellectual Property Ownership, General Disclaimers, Exclusion of Damages, Indemnity, Entire Agreement, Termination, and Other. We reserve the right to discontinue or make changes to the Site at any time.
          </p>

          <h2>14. ASSIGNMENT AND ENFORCEMENT</h2>
          <p>
            We may assign this Agreement, in whole or in part, at our sole discretion. You may not assign your rights under this Agreement without our prior written permission. Any attempt by you to assign your rights under this Agreement without our permission shall be void. The waiver by us of a breach of any provision of this Agreement shall not operate or be construed as a waiver of any other or a subsequent breach of the same or a different kind.
          </p>

          <h2>15. PROCEDURE FOR MAKING CLAIMS OF COPYRIGHT INFRINGEMENT</h2>
          <p>
            This Publisher respects the intellectual property of others. If you believe that another user has posted your copyrighted work in a way that is accessible on the Site and constitutes copyright infringement, please contact us to report possible copyright infringement.
          </p>
          <p>When contacting us, please provide the following information to our legal agent:</p>
          <ul>
            <li>A full description of the copyrighted work that you claim has been infringed</li>
            <li>The URL where the material that you claim is infringing is located on the site</li>
            <li>Your name, address, telephone number, and e-mail address</li>
            <li>A statement by you that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law</li>
            <li>A statement by you, made under penalty of perjury, that the above information in your notice is accurate and that you are the copyright or intellectual property owner or are authorized to act on the copyright or intellectual property owner&apos;s behalf</li>
          </ul>
          <p>Publisher&apos;s legal agent can be reached as follows:</p>
          <p>By e-mail: <a href="mailto:support@libertysurveys.com">support@libertysurveys.com</a></p>
          <p>By postal mail:</p>
          <address className="not-italic my-4 pl-4 border-l-2 border-gray-300">
            LibertySurveys.com Legal Agent<br />
            124 Broadkill Rd #495<br />
            Milton, DE 19968-1008
          </address>

          <h2>16. RIGHT TO REVISE AGREEMENT AT ANY TIME</h2>
          <p>
            We may revise this Agreement or this Site at any time at our sole discretion without notice. An amended form of Agreement will be effectively immediately upon its posting on this Site. You are responsible for reviewing the most current form of this Agreement before using this Site to ensure that you agree to any revisions to this Agreement.
          </p>
          <p>
            If at any time you do not agree to the revisions we make to this Agreement or this Site, you should immediately stop accessing or using this Site in any manner whatsoever. Your continued use of this Site means that you accept those revisions.
          </p>
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
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-white font-medium">Terms of Use</Link>
          </div>
          © {new Date().getFullYear()} Liberty Surveys. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
