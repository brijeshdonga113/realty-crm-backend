import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Cliniwayz',
  description: 'Terms and conditions for using the Cliniwayz clinic management platform.',
}

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: [
      'By accessing or using Cliniwayz ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
      'These terms apply to all users including doctors, clinic owners, and staff members (receptionists) who access the platform.',
    ],
  },
  {
    title: '2. Description of Service',
    body: [
      'Cliniwayz is a clinic management platform that provides tools for patient record management, appointment scheduling, billing, staff management, and related features.',
      'The Service is intended for use by licensed healthcare professionals and their authorised staff in India.',
      'We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.',
    ],
  },
  {
    title: '3. Account Registration',
    body: [
      'You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials.',
      'Each account is for a single clinic or practice. You may add staff members (receptionists) via invite codes under your account.',
      'You are responsible for all activity that occurs under your account.',
      'You must be at least 18 years old and a registered healthcare professional (or authorised staff) to use this Service.',
    ],
  },
  {
    title: '4. Patient Data Responsibility',
    body: [
      'You are solely responsible for the accuracy and legality of any patient data you enter into Cliniwayz.',
      'You must obtain appropriate consent from patients before recording their personal and medical information on the platform, in compliance with applicable Indian laws including the DPDP Act 2023.',
      'Cliniwayz acts as a data processor; you (the clinic/doctor) are the data controller for all patient records.',
      'You agree not to enter false, misleading, or illegally obtained patient data.',
    ],
  },
  {
    title: '5. Acceptable Use',
    body: [
      'You agree to use Cliniwayz only for lawful purposes and in accordance with these Terms.',
      'You must not attempt to gain unauthorised access to other accounts, systems, or networks connected to the Service.',
      'You must not upload malicious files, spam, or content that violates any law.',
      'You must not use the Service to store or transmit content that is defamatory, obscene, or infringes intellectual property rights.',
      'Violation of these terms may result in immediate account suspension or termination.',
    ],
  },
  {
    title: '6. Subscription & Billing',
    body: [
      'Access to Cliniwayz may be subject to a subscription fee. Details of current pricing are available by contacting us at ideasring11@gmail.com.',
      'All fees are exclusive of applicable taxes. You are responsible for any GST or other taxes applicable to your subscription.',
      'Subscriptions are billed in advance. Refunds are not provided for partial months or unused features unless required by applicable law.',
      'We reserve the right to change our pricing with 30 days\' notice to active subscribers.',
    ],
  },
  {
    title: '7. Intellectual Property',
    body: [
      'Cliniwayz and its original content, features, and functionality are owned by Cliniwayz and protected by applicable copyright and intellectual property laws.',
      'Your patient data and clinic records remain your property. We claim no ownership over data you create within the platform.',
      'You may not copy, modify, distribute, or reverse-engineer any part of the Cliniwayz platform.',
    ],
  },
  {
    title: '8. Limitation of Liability',
    body: [
      'Cliniwayz is provided "as is" without warranties of any kind, express or implied.',
      'We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including data loss or service interruptions.',
      'Our total liability to you for any claim shall not exceed the amount you paid to us in the 3 months preceding the claim.',
      'Cliniwayz is a management tool and does not provide medical advice. All clinical decisions remain the sole responsibility of the licensed healthcare professional.',
    ],
  },
  {
    title: '9. Data Security & Availability',
    body: [
      'We take reasonable technical and organisational measures to protect your data. However, no system is completely secure and we cannot guarantee absolute security.',
      'We aim for high availability but do not guarantee uninterrupted access to the Service. Scheduled maintenance will be communicated in advance where possible.',
      'You are encouraged to export and maintain your own backups of critical patient data.',
    ],
  },
  {
    title: '10. Termination',
    body: [
      'You may close your account at any time by contacting us at ideasring11@gmail.com.',
      'We may suspend or terminate your account if you violate these Terms, with or without notice.',
      'Upon termination, your right to use the Service ceases immediately. We will retain your data for 90 days to allow for export, after which it will be permanently deleted.',
    ],
  },
  {
    title: '11. Governing Law',
    body: [
      'These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in India.',
      'Any dispute that cannot be resolved informally shall be referred to binding arbitration under the Arbitration and Conciliation Act, 1996.',
    ],
  },
  {
    title: '12. Changes to Terms',
    body: [
      'We may update these Terms from time to time. We will notify you of significant changes via email or an in-app notice at least 14 days before they take effect.',
      'Continued use of the Service after changes take effect constitutes your acceptance of the new Terms.',
    ],
  },
  {
    title: '13. Contact',
    body: [
      'For questions about these Terms, please contact us at ideasring11@gmail.com.',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">Cliniwayz</span>
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Home</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400 mb-8">Last updated: June 2025</p>

          <p className="text-gray-600 leading-relaxed mb-10">
            Please read these Terms of Service carefully before using Cliniwayz. These terms govern your access to and use of our clinic management platform and constitute a legally binding agreement between you and Cliniwayz.
          </p>

          <div className="space-y-8">
            {SECTIONS.map(({ title, body }) => (
              <section key={title}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
                <ul className="space-y-2">
                  {body.map((para, i) => (
                    <li key={i} className="flex gap-2 text-gray-600 leading-relaxed text-sm">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400"/>
                      <span>{para}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-400">
            <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            <span>·</span>
            <a href="mailto:ideasring11@gmail.com" className="hover:text-gray-600">ideasring11@gmail.com</a>
            <span>·</span>
            <span>© {new Date().getFullYear()} Cliniwayz</span>
          </div>
        </div>
      </main>
    </div>
  )
}
