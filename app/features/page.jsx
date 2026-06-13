'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const NAV_SECTIONS = [
  { id: 'patient-management',   label: 'Patient Management' },
  { id: 'appointments',         label: 'Appointments & Scheduling' },
  { id: 'visit-recording',      label: 'Visit Recording' },
  { id: 'billing',              label: 'Billing & Invoices' },
  { id: 'whatsapp',             label: 'WhatsApp Reminders' },
  { id: 'leads',                label: 'Lead Management' },
  { id: 'follow-ups',           label: 'Follow-ups' },
  { id: 'inventory',            label: 'Inventory' },
  { id: 'staff',                label: 'Staff & Access Control' },
  { id: 'booking-link',         label: 'Online Booking Link' },
  { id: 'analytics',            label: 'Analytics & Reports' },
  { id: 'calendar',             label: 'Calendar' },
  { id: 'data-export',          label: 'Data Export' },
]

function FeatureBadge({ children, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-green-50 text-green-700 border-green-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    teal:   'bg-teal-50 text-teal-700 border-teal-100',
  }
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${colors[color] ?? colors.blue}`}>
      {children}
    </span>
  )
}

function SectionIcon({ path, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-600',
    green:  'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    teal:   'bg-teal-100 text-teal-600',
    rose:   'bg-rose-100 text-rose-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    cyan:   'bg-cyan-100 text-cyan-600',
    emerald:'bg-emerald-100 text-emerald-600',
    amber:  'bg-amber-100 text-amber-600',
  }
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] ?? colors.blue}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path}/>
      </svg>
    </div>
  )
}

function Check() {
  return (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
    </svg>
  )
}

function FeatureList({ items }) {
  return (
    <ul className="space-y-2.5 mt-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
          <Check />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ id, icon, iconColor, title, badge, badgeColor, tagline, children }) {
  return (
    <section id={id} className="scroll-mt-20 py-12 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-4 mb-6">
        <SectionIcon path={icon} color={iconColor} />
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {badge && <FeatureBadge color={badgeColor}>{badge}</FeatureBadge>}
          </div>
          {tagline && <p className="text-sm text-gray-500 mt-1">{tagline}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function SubSection({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoCard({ title, desc }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
    </div>
  )
}

export default function FeaturesPage() {
  const [activeSection, setActiveSection] = useState('patient-management')

  useEffect(() => {
    const NAV_OFFSET = 100
    const onScroll = () => {
      const scrollY = window.scrollY
      let active = NAV_SECTIONS[0].id
      NAV_SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (el && el.offsetTop - NAV_OFFSET <= scrollY) active = id
      })
      setActiveSection(active)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Cliniwayz</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">Features</Link>
            <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">Pricing</Link>
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Login</Link>
            <Link href="/signup" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Documentation</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2 leading-tight">
              Everything Cliniwayz can do
            </h1>
            <p className="text-base text-gray-500 mt-3 leading-relaxed">
              A complete reference of every feature — from patient records to WhatsApp reminders. No jargon, just what it does and how it helps your clinic.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-10 py-8">

        {/* Sidebar */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">On this page</p>
            <nav className="space-y-0.5">
              {NAV_SECTIONS.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    activeSection === s.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* ── Patient Management ─────────────────────────────────────────── */}
          <Section
            id="patient-management"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            iconColor="blue"
            title="Patient Management"
            tagline="A complete digital record for every patient — searchable, fast, and always up to date."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Every patient gets a dedicated profile with a unique UHID (patient number), full medical history, all past visits, appointment timeline, invoices, and contact details — all in one place.
            </p>
            <FeatureList items={[
              'Auto-generated UHID for every patient',
              'Full name, date of birth, gender, phone, email, and address',
              'Tags: active, inactive — filter your patient list in seconds',
              'Full visit history with diagnoses, prescriptions, and vitals',
              'Complete appointment timeline with status tracking',
              'Invoice and payment history linked to the patient',
              'Inline edit — update any field without leaving the profile',
              'Search by name, phone, or UHID across your entire patient list',
              'Add new patients manually or convert from a booking link lead',
            ]} />

            <SubSection title="Patient Profile Sections">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'Overview', desc: 'Contact info, registration date, and quick stats.' },
                  { title: 'Visit History', desc: 'Chronological list of all recorded visits.' },
                  { title: 'Appointments', desc: 'Past and upcoming appointments with status.' },
                  { title: 'Invoices', desc: 'All billing records and payment status.' },
                  { title: 'Follow-ups', desc: 'Scheduled and completed follow-up entries.' },
                  { title: 'Vitals Trend', desc: 'Blood pressure, weight, and other vitals over time.' },
                ].map(c => <InfoCard key={c.title} title={c.title} desc={c.desc} />)}
              </div>
            </SubSection>
          </Section>

          {/* ── Appointments & Scheduling ──────────────────────────────────── */}
          <Section
            id="appointments"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            iconColor="indigo"
            title="Appointments & Scheduling"
            tagline="Manage your full appointment book — from manual scheduling to patient self-booking."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Create, reschedule, and cancel appointments from the appointments list or calendar. Each appointment tracks status through its full lifecycle: scheduled → confirmed → completed or no-show.
            </p>
            <FeatureList items={[
              'Create appointments manually for any patient in seconds',
              'Status workflow: Scheduled → Confirmed → Completed / No-show / Cancelled',
              'Attach reason, type (consultation, follow-up, procedure), and notes',
              'Block time slots to prevent bookings during breaks or leave',
              '"Attend Now" button jumps straight into the visit recording flow',
              '"✓ Done" quick-mark button from the dashboard without opening a visit',
              'Appointments auto-marked completed when a visit is saved against them',
              'Filter by date, status, or patient',
              'Google Calendar sync — appointments appear in your personal calendar',
            ]} />

            <SubSection title="Appointment Statuses">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Scheduled', color: 'bg-blue-50 text-blue-700' },
                  { label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700' },
                  { label: 'Completed', color: 'bg-green-50 text-green-700' },
                  { label: 'No-show', color: 'bg-amber-50 text-amber-700' },
                  { label: 'Cancelled', color: 'bg-red-50 text-red-700' },
                ].map(s => (
                  <span key={s.label} className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-center ${s.color}`}>{s.label}</span>
                ))}
              </div>
            </SubSection>
          </Section>

          {/* ── Visit Recording ────────────────────────────────────────────── */}
          <Section
            id="visit-recording"
            icon="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            iconColor="teal"
            title="Visit Recording"
            tagline="Document the full consultation — vitals, diagnosis, prescriptions, and billing — in one flow."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              The visit recorder guides you through each step of a consultation. Save as a draft mid-way and come back later, or complete it in one go and auto-generate an invoice.
            </p>
            <FeatureList items={[
              'Chief complaint and detailed patient history',
              'Vital signs: blood pressure, heart rate, temperature, weight, height, oxygen saturation',
              'Clinical findings and examination notes',
              'Multiple diagnosis entries with free-text or structured input',
              'Treatment plan and procedure notes',
              'Prescriptions: medication, dosage, frequency, duration, and instructions',
              'Lab orders attached to the visit',
              'Follow-up date scheduling — auto-creates a follow-up reminder',
              'Save as draft and resume later without losing data',
              'Auto-generate an invoice from the visit in one click',
              'Per-medicine billing — add prescription items directly to the invoice',
              'Marks the linked appointment as completed automatically',
            ]} />

            <SubSection title="Prescriptions">
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 text-sm text-teal-800 leading-relaxed">
                Prescriptions link to your inventory. If a prescribed medicine exists in your stock, the billing price is pre-filled. Add it to the invoice with one click — no double entry.
              </div>
            </SubSection>
          </Section>

          {/* ── Billing & Invoices ─────────────────────────────────────────── */}
          <Section
            id="billing"
            icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            iconColor="emerald"
            title="Billing & Invoices"
            tagline="Professional invoices with tax, per-item discounts, and full payment tracking."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Create invoices during a visit or standalone. Each invoice supports multiple line items (services and medicines), a global tax rate, per-item discounts, and a clinic-level discount. Print or download as PDF.
            </p>
            <FeatureList items={[
              'Multiple line items: services, medicines, procedures',
              'Per-item discount percentage — shown on the printed invoice',
              'Per-item tax toggle — exempt specific items from GST',
              'Invoice-level discount in addition to per-item discounts',
              'GST / tax rate with automatic tax amount calculation',
              'Payment status: paid, unpaid, partial',
              'Payment methods: cash, UPI, card, bank transfer, insurance',
              'Collected-by field for multi-staff clinics',
              'Print-ready invoice with clinic logo, patient details, and itemized breakdown',
              'Auto-numbered invoices (INV-0001, INV-0002 …)',
              'Revenue reconciliation — see total billed vs collected',
              'Link invoices to a specific visit for full traceability',
            ]} />

            <SubSection title="Invoice Line Items">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard title="Services" desc="Consultation fees, procedures, therapies — any service with a unit price." />
                <InfoCard title="Medicines" desc="Prescription items pulled from your inventory with billing prices pre-filled." />
              </div>
            </SubSection>
          </Section>

          {/* ── WhatsApp Reminders ─────────────────────────────────────────── */}
          <Section
            id="whatsapp"
            icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            iconColor="green"
            title="WhatsApp Reminders"
            tagline="Send follow-up reminders and appointment confirmations directly from Cliniwayz."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              One-click WhatsApp links open the patient's chat with a pre-filled message. No API fees — it uses WhatsApp Web directly so there are no extra integration costs or compliance hurdles.
            </p>
            <FeatureList items={[
              'Pre-built message templates for follow-ups, appointments, and birthday wishes',
              'Custom template editor — write and save your own clinic messages',
              'Dynamic variables: patient name, date, time, clinic name auto-filled',
              'Send from the follow-ups list, patient profile, or appointment panel',
              'Birthday reminders with special offer templates',
              'Works on any device — opens WhatsApp Web or the mobile app',
              'No API keys or WhatsApp Business account required',
            ]} />
          </Section>

          {/* ── Lead Management ────────────────────────────────────────────── */}
          <Section
            id="leads"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            iconColor="cyan"
            title="Lead Management"
            badge="Leads"
            badgeColor="blue"
            tagline="Track prospective patients and convert them into your patient list."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              The Leads page is a lightweight CRM for prospects — people who have enquired or booked online but haven't become registered patients yet. Convert a lead to a patient in one click.
            </p>
            <FeatureList items={[
              'Add manual leads: name, phone, email, source, and note',
              'Lead sources: Walk-in, Referral, Booking Link, Social Media, Google Search, WhatsApp, Advertisement, Health Camp, Insurance, Other',
              'Booking link appointments automatically appear as leads',
              'Deduplicated — existing patients are excluded from the leads list',
              '"Convert to Patient" flow pre-fills name and phone in the new patient form',
              'Delete leads that are not relevant',
              'Source badges for quick visual reference',
            ]} />

            <SubSection title="Lead Sources">
              <div className="flex flex-wrap gap-2">
                {['Walk-in','Referral','Booking Link','Social Media','Google Search','WhatsApp','Advertisement','Health Camp','Insurance','Other'].map(s => (
                  <span key={s} className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">{s}</span>
                ))}
              </div>
            </SubSection>
          </Section>

          {/* ── Follow-ups ─────────────────────────────────────────────────── */}
          <Section
            id="follow-ups"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            iconColor="orange"
            title="Follow-ups"
            tagline="Never let a patient fall through the cracks after their visit."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              When you set a follow-up date during a visit, a follow-up reminder is automatically created. The follow-ups page shows what's due today, overdue, and upcoming — so you always know who needs attention.
            </p>
            <FeatureList items={[
              'Auto-created from visit recording when a follow-up date is set',
              'Add manual follow-ups from any patient profile',
              'Status: pending, done',
              'Overdue section — sorted by most overdue first',
              'Archived section — follow-ups 15+ days overdue, collapsed by default to reduce noise',
              'One-click WhatsApp reminder to the patient',
              'Mark as done without opening the patient profile',
              'Linked back to the originating visit for context',
            ]} />
          </Section>

          {/* ── Inventory ──────────────────────────────────────────────────── */}
          <Section
            id="inventory"
            icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            iconColor="orange"
            title="Inventory Management"
            tagline="Track medicines, supplies, and equipment. Get alerts before you run out."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Maintain a full inventory of medicines and clinic supplies. Inventory items link to prescriptions and billing — so when you prescribe a medicine, the billing price is pulled automatically.
            </p>
            <FeatureList items={[
              'Add medicines with generic name, potency, dosage form, and category',
              'Track quantity, unit, batch number, and expiry date',
              'Purchase price and billing price stored separately',
              'Supplier information for reordering',
              'Low-stock alerts when quantity falls below threshold',
              'Expiry date tracking — see what expires soon',
              'Inventory usage linked to prescriptions and invoices',
              'Filter by category, expiry status, or low-stock',
              'Export inventory as CSV',
            ]} />
          </Section>

          {/* ── Staff & Access Control ─────────────────────────────────────── */}
          <Section
            id="staff"
            icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            iconColor="rose"
            title="Staff & Access Control"
            tagline="Give your receptionist their own login with exactly the access they need."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Invite receptionists and other staff with their own email-based login. Role-based access ensures staff see only what's relevant to their role — not billing details or sensitive clinical notes.
            </p>
            <FeatureList items={[
              'Invite staff by email — they set up their own password',
              'Role: Receptionist — can manage appointments, patients, and check-ins',
              'Doctors retain full access to billing, reports, and clinical notes',
              'Staff see the same real-time data without sharing the doctor account',
              'Remove staff access instantly from Settings',
              'Each login is individually audited',
            ]} />

            <SubSection title="Role Access">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-gray-700 border border-gray-100 rounded-tl-lg">Feature</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-700 border border-gray-100 text-center">Doctor</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-700 border border-gray-100 rounded-tr-lg text-center">Receptionist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Appointments', true, true],
                      ['Patients', true, true],
                      ['Visit Recording', true, false],
                      ['Billing & Invoices', true, true],
                      ['Reports & Analytics', true, false],
                      ['Inventory', true, true],
                      ['Settings', true, false],
                    ].map(([feat, doc, rec]) => (
                      <tr key={feat} className="border-b border-gray-50">
                        <td className="px-4 py-2.5 text-gray-600 border border-gray-100">{feat}</td>
                        <td className="px-4 py-2.5 border border-gray-100 text-center">{doc ? '✓' : '–'}</td>
                        <td className="px-4 py-2.5 border border-gray-100 text-center">{rec ? '✓' : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SubSection>
          </Section>

          {/* ── Online Booking Link ────────────────────────────────────────── */}
          <Section
            id="booking-link"
            icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            iconColor="cyan"
            title="Online Booking Link"
            tagline="Share a link. Patients self-book 24/7 without calling your clinic."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Every clinic gets a unique public booking page at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">cliniwayz.com/book/your-slug</code>. Patients pick a date, choose an available slot, and confirm — no account needed.
            </p>
            <FeatureList items={[
              'Unique shareable URL — customize your slug in Settings',
              'Shows working hours and real-time slot availability',
              'Patients pick date → time → enter name, phone, and reason',
              'Step-by-step flow on mobile — no scrolling required',
              'Blocked dates and full-day leaves shown as unavailable',
              'Booking confirmations show clinic name and appointment details',
              'Booked appointments appear instantly in your appointments list',
              'Booking link patients automatically appear as leads for follow-up',
              'Verified Clinic badge displays your Cliniwayz verification',
            ]} />
          </Section>

          {/* ── Analytics & Reports ────────────────────────────────────────── */}
          <Section
            id="analytics"
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            iconColor="purple"
            title="Analytics & Reports"
            tagline="Understand your clinic's performance at a glance."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              The Reports page gives you a live snapshot of patient growth, revenue trends, appointment volumes, and follow-up completion — everything you need to run a healthy clinic.
            </p>
            <FeatureList items={[
              'Total revenue, monthly revenue, and payment collection rate',
              'Appointment volume — total, completed, no-shows, and upcoming',
              'New patient registrations over time',
              'Top diagnoses and most common chief complaints',
              'Follow-up completion rate',
              'Revenue breakdown by payment method',
              'Inventory usage and spending',
              'Date range filters for any time period',
              'Real-time data — refreshes as you work',
            ]} />
          </Section>

          {/* ── Calendar ───────────────────────────────────────────────────── */}
          <Section
            id="calendar"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            iconColor="indigo"
            title="Calendar"
            tagline="A full monthly view of everything happening at your clinic."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              The calendar overlays appointments, follow-ups, blocked slots, custom events, and patient birthdays on a single month grid. Click any date to see the day's full detail panel.
            </p>
            <FeatureList items={[
              'Monthly grid view with colour-coded event dots',
              'Filter by: All, Appointments, Follow-ups, New Cases, Events, Birthdays',
              'Appointments with patient name, time, and type',
              'Follow-up reminders with WhatsApp quick-send',
              'Blocked slots shown as red — prevents accidental double-booking',
              'Custom events: all-day or timed, with description',
              'Patient birthday reminders with one-click birthday message',
              'Google Calendar sync — events flow both ways',
              '"Attend Now" shortcut from the calendar panel into the visit flow',
            ]} />
          </Section>

          {/* ── Data Export ────────────────────────────────────────────────── */}
          <Section
            id="data-export"
            icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            iconColor="amber"
            title="Data Export"
            tagline="Your data, your way — download everything as CSV."
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              Export all your clinic data as CSV files with one click from Settings. A password is required to prevent accidental exports.
            </p>
            <FeatureList items={[
              'Patients CSV — UHID, name, DOB, gender, phone, email, address, status',
              'Visits CSV — patient, date, chief complaint, diagnosis, treatment, payment',
              'Appointments CSV — patient, date, time, type, reason, status, notes',
              'Invoices CSV — invoice number, patient, date, total, status, payment method',
              'Inventory CSV — name, generic, potency, dosage, quantity, price, expiry',
              'Password-protected export for security',
              'One-click download of all 5 files in sequence',
            ]} />

            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
              <strong>Note:</strong> Data export is available in Settings → Data Export. Keep your exported files in a secure location as they contain sensitive patient information.
            </div>
          </Section>

          {/* CTA */}
          <div className="py-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Ready to try it?</h2>
            <p className="text-sm text-gray-500 mt-2">7-day free trial. No credit card required.</p>
            <Link href="/signup" className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-8 py-3 rounded-xl transition-colors">
              Start for free →
            </Link>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Cliniwayz</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
            <Link href="/features" className="hover:text-gray-700 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-gray-700 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-gray-700 transition-colors">Login</Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Cliniwayz. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
