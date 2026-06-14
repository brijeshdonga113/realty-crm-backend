import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Cliniwayz',
  description: 'How Cliniwayz collects, uses, and protects your data.',
}

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: [
      'When you register as a doctor or clinic owner, we collect your name, email address, clinic name, and specialization.',
      'Patient records you create within the app (demographics, visit history, billing details, documents) are stored on your behalf and remain your property.',
      'We collect usage data such as login timestamps, pages visited, and feature interactions to improve the product.',
      'Files uploaded to patient profiles (reports, images, documents) are stored securely via Vercel Blob storage.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    body: [
      'To provide, operate, and improve the Cliniwayz platform.',
      'To send transactional communications such as appointment reminders and billing confirmations via WhatsApp or email (only with your authorisation).',
      'To respond to your support queries and feedback.',
      'We do not sell, rent, or share your personal data or your patients\' data with third parties for marketing purposes.',
    ],
  },
  {
    title: '3. Data Storage & Security',
    body: [
      'All data is stored in Google Firebase (Firestore) and Vercel infrastructure, both of which maintain SOC 2 compliance and 256-bit SSL encryption in transit and at rest.',
      'Access to patient data is restricted to the authenticated doctor account that owns it. Receptionists can only access records explicitly permitted by the doctor.',
      'We implement role-based access controls, authentication via Firebase Auth, and server-side token verification on every API request.',
    ],
  },
  {
    title: '4. Patient Data & DPDP Compliance',
    body: [
      'As a clinic management tool, Cliniwayz acts as a data processor on behalf of the healthcare provider (you). You are responsible for obtaining consent from patients whose data you enter into the system.',
      'We are committed to compliance with India\'s Digital Personal Data Protection Act, 2023 (DPDP Act).',
      'Patient data is never shared with any third party without the express consent of the clinic/doctor who owns that data.',
    ],
  },
  {
    title: '5. Cookies & Analytics',
    body: [
      'We use minimal session cookies required for authentication. We do not use third-party advertising or tracking cookies.',
      'Basic analytics (page views, error rates) may be collected via privacy-respecting tools to help us improve the platform.',
    ],
  },
  {
    title: '6. Data Retention',
    body: [
      'Your account data is retained for as long as your account is active.',
      'Upon account deletion, your personal account data is removed within 30 days. Patient records will be permanently deleted within 90 days unless you export them before account closure.',
      'Backup copies may persist for up to 30 additional days for disaster recovery purposes.',
    ],
  },
  {
    title: '7. Your Rights',
    body: [
      'You may request access to, correction of, or deletion of your personal data at any time by contacting us.',
      'You may export your patient data from the app at any time.',
      'You may close your account at any time. We will process deletion requests within 30 days.',
    ],
  },
  {
    title: '8. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date below and notify active users via email.',
      'Continued use of Cliniwayz after changes constitutes your acceptance of the updated policy.',
    ],
  },
  {
    title: '9. Contact Us',
    body: [
      'If you have questions about this Privacy Policy or how your data is handled, please email us at ideasring11@gmail.com.',
    ],
  },
]

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mb-8">Last updated: June 2025</p>

          <p className="text-gray-600 leading-relaxed mb-10">
            At Cliniwayz, we take the privacy of doctors, clinic staff, and patient data seriously. This policy explains what information we collect, how we use it, and the choices you have over your data. By using Cliniwayz, you agree to the practices described here.
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
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
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
