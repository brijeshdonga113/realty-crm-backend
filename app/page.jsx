'use client'

import { useState } from 'react'
import Link from 'next/link'

const FEATURES = [
  {
    title: 'Patient Management',
    desc: 'Complete patient profiles with medical history, visit records, and documents — fully searchable.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    bg: 'bg-blue-50', fg: 'text-blue-600', border: 'hover:border-blue-200',
  },
  {
    title: 'Smart Scheduling',
    desc: 'Drag-and-drop calendar, blocked slots with visible reasons, and a shareable public booking link.',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    bg: 'bg-indigo-50', fg: 'text-indigo-600', border: 'hover:border-indigo-200',
  },
  {
    title: 'Billing & Invoices',
    desc: 'Generate professional invoices instantly, track payments, and reconcile revenue — all in one click.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    bg: 'bg-emerald-50', fg: 'text-emerald-600', border: 'hover:border-emerald-200',
  },
  {
    title: 'Visit Recording',
    desc: 'Document diagnoses, prescriptions, vitals, and follow-up notes during every consultation.',
    icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    bg: 'bg-teal-50', fg: 'text-teal-600', border: 'hover:border-teal-200',
  },
  {
    title: 'WhatsApp Reminders',
    desc: 'Automated follow-up reminders via WhatsApp so no patient falls through the cracks.',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    bg: 'bg-green-50', fg: 'text-green-600', border: 'hover:border-green-200',
  },
  {
    title: 'Analytics & Reports',
    desc: 'Revenue trends, patient stats, and appointment insights — visualized and ready to export.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    bg: 'bg-purple-50', fg: 'text-purple-600', border: 'hover:border-purple-200',
  },
  {
    title: 'Inventory Management',
    desc: 'Track medical supplies, medications, and equipment with low-stock alerts and usage logs.',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    bg: 'bg-orange-50', fg: 'text-orange-600', border: 'hover:border-orange-200',
  },
  {
    title: 'Staff Management',
    desc: 'Add receptionists with their own login. Role-based access so everyone sees only what they need.',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    bg: 'bg-rose-50', fg: 'text-rose-600', border: 'hover:border-rose-200',
  },
  {
    title: 'Online Booking Link',
    desc: 'Share a personalised booking link. Patients self-schedule 24/7 without calling your clinic.',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    bg: 'bg-cyan-50', fg: 'text-cyan-600', border: 'hover:border-cyan-200',
  },
]

const STATS = [
  { value: '500+', label: 'Doctors registered' },
  { value: '50k+', label: 'Appointments managed' },
  { value: '40%', label: 'Fewer no-shows' },
  { value: '4.9★', label: 'Average rating' },
]

const TESTIMONIALS = [
  {
    name: 'Dr. Priya Mehta', role: 'General Physician, Mumbai', initials: 'PM',
    text: 'ClinicCRM cut my admin time in half. The billing module and WhatsApp reminders are worth the subscription alone.',
  },
  {
    name: 'Dr. Arjun Sharma', role: 'Dentist, Bangalore', initials: 'AS',
    text: 'The online booking link is a game-changer. Patients book themselves and I wake up to a full schedule every morning.',
  },
  {
    name: 'Dr. Sneha Patel', role: 'Pediatrician, Ahmedabad', initials: 'SP',
    text: 'WhatsApp reminders reduced my no-shows by 40%. Patients actually appreciate the follow-ups.',
  },
]

const STEPS = [
  { num: '1', title: 'Sign up free', desc: 'Create your account in 2 minutes. No credit card required for the 7-day trial.' },
  { num: '2', title: 'Set up your clinic', desc: 'Set working hours, add staff, and import or enter your patient list.' },
  { num: '3', title: 'Go live', desc: 'Share your booking link, schedule appointments, and run your clinic from one dashboard.' },
]

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — every new account gets a full 7-day free trial with access to all features. No credit card required.' },
  { q: 'Can my receptionist use it too?', a: 'Yes. You can add receptionists and staff with their own login. Role-based access ensures they only see what they need to.' },
  { q: 'Is patient data secure?', a: "All data is stored in Firebase with 256-bit SSL encryption and strict access controls. Your patients' data is private and never shared." },
  { q: 'Can patients book appointments themselves?', a: 'Yes. Each doctor gets a shareable public booking link. Patients pick a date and time without calling your clinic.' },
  { q: 'What happens after my trial ends?', a: "Reach out to us at prijeshdonga14@gmail.com and we'll set you up with the right plan. We'll notify you before your trial expires — no surprise charges." },
]

const PRICING_ITEMS = [
  'Unlimited patients & appointments',
  'Billing & invoice management',
  'Visit recording & prescriptions',
  'Inventory management',
  'Staff & receptionist access',
  'Public online booking link',
  'Google Calendar sync',
  'WhatsApp & in-app reminders',
  'Analytics & reports',
  'Priority support',
]

function CheckIcon({ className = 'w-4 h-4 text-green-500' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ChevronDown({ open }) {
  return (
    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">ClinicCRM</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#contact" className="hover:text-gray-900 transition-colors">Contact</a>
            <a href="#testimonials" className="hover:text-gray-900 transition-colors">Testimonials</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pt-16 pb-0">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              7-day free trial — No credit card required
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-5">
              The clinic management<br />
              <span className="text-blue-600">doctors actually love</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
              Appointments, patient records, billing, and WhatsApp reminders — all in one place.
              Built for solo practitioners and small clinics in India.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <Link href="/signup" className="w-full sm:w-auto bg-blue-600 text-white font-semibold text-base px-7 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                Start Free Trial →
              </Link>
              <Link href="/login" className="w-full sm:w-auto border border-gray-200 text-gray-700 font-semibold text-base px-7 py-3.5 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors">
                Sign In
              </Link>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="rounded-t-2xl border border-b-0 border-gray-200 shadow-2xl shadow-slate-200/80 overflow-hidden">
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 bg-white rounded px-3 py-1 text-xs text-gray-400 font-mono">cliniccrm.app/dashboard</div>
            </div>
            <div className="flex bg-white" style={{ height: '340px' }}>
              {/* Sidebar */}
              <div className="w-44 bg-gray-900 flex-shrink-0 flex flex-col py-4 px-2.5 gap-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-3">
                  <div className="w-5 h-5 bg-blue-500 rounded flex-shrink-0" />
                  <span className="text-white text-xs font-bold">ClinicCRM</span>
                </div>
                {[
                  ['Dashboard', true], ['Patients', false], ['Appointments', false],
                  ['Calendar', false], ['Billing', false], ['Follow-ups', false],
                  ['Inventory', false], ['Reports', false],
                ].map(([label, active]) => (
                  <div key={label} className={`px-2 py-1.5 rounded text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                    {label}
                  </div>
                ))}
              </div>
              {/* Main */}
              <div className="flex-1 bg-gray-50 p-4 overflow-hidden">
                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {[
                    { label: "Today's Appointments", val: '8', cls: 'bg-blue-50 text-blue-700' },
                    { label: 'Total Patients', val: '248', cls: 'bg-green-50 text-green-700' },
                    { label: 'Revenue (Month)', val: '₹68,400', cls: 'bg-purple-50 text-purple-700' },
                    { label: 'Pending Follow-ups', val: '12', cls: 'bg-orange-50 text-orange-700' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-xl p-3 ${c.cls}`}>
                      <div className="text-lg font-bold">{c.val}</div>
                      <div className="text-xs mt-0.5 opacity-75 leading-tight">{c.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2.5">Today's Schedule</div>
                  <div className="space-y-2">
                    {[
                      { time: '9:00 AM', name: 'Rahul Verma', type: 'Consultation', status: 'confirmed' },
                      { time: '9:30 AM', name: 'Priya Singh', type: 'Follow-up', status: 'scheduled' },
                      { time: '10:00 AM', name: 'Amit Kumar', type: 'Consultation', status: 'confirmed' },
                      { time: '11:00 AM', name: 'Sunita Patel', type: 'Check-up', status: 'scheduled' },
                    ].map(a => (
                      <div key={a.time} className="flex items-center gap-2.5 py-1 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">{a.time}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{a.name}</div>
                          <div className="text-xs text-gray-400">{a.type}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${a.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-y border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="text-3xl font-extrabold text-gray-900">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="bg-gray-50 py-6 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-4">Trusted by doctors across India</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-400">
            {['General Physicians', 'Dentists', 'Pediatricians', 'Dermatologists', 'Orthopedic Surgeons', 'Psychiatrists'].map(s => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Everything your clinic needs</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">One subscription. All features included. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className={`p-6 rounded-2xl border border-gray-100 ${f.border} hover:shadow-md transition-all group cursor-default`}>
                <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <svg className={`w-5 h-5 ${f.fg}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature spotlight — Scheduling */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-3">Smart Scheduling</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight">Never miss an appointment again</h2>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              Let patients self-book via your personal link, set working hours, block time off with a visible reason,
              and get automatic WhatsApp reminders before every appointment.
            </p>
            <ul className="space-y-3">
              {[
                'Public booking link — patients self-schedule 24/7',
                'Blocked calendar reasons shown to patients',
                'WhatsApp reminders reduce no-shows by 40%',
                'Google Calendar two-way sync',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-blue-100 text-sm">
                  <svg className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Calendar mockup */}
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="text-xs font-semibold text-gray-700 mb-3">May 2026</div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {/* May 2026 starts on Friday — 5 empty cells */}
              {Array(5).fill(null).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <div key={d} className={`text-center text-xs py-1.5 rounded-lg font-medium ${
                  d === 7 ? 'bg-blue-600 text-white' :
                  [11, 12].includes(d) ? 'bg-gray-100 text-gray-300' :
                  [3, 17, 24].includes(d) ? 'bg-red-50 text-red-400' :
                  'text-gray-700 hover:bg-blue-50 cursor-pointer'
                }`}>{d}</div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { time: '9:00', name: 'Rahul Verma', badge: 'confirmed', cls: 'bg-green-50 text-green-600' },
                { time: '10:30', name: 'Priya Singh', badge: 'scheduled', cls: 'bg-blue-50 text-blue-600' },
                { time: '2:00 PM', name: 'Blocked — Surgery day', badge: 'blocked', cls: 'bg-red-50 text-red-500' },
              ].map(s => (
                <div key={s.time} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 w-12 flex-shrink-0">{s.time}</span>
                  <span className="text-xs text-gray-700 flex-1">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature spotlight — Patient Records */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Patient card mockup */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">RV</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">Rahul Verma</div>
                <div className="text-xs text-gray-400">DOB: 14 Mar 1985 · Male · +91 98765 43210</div>
              </div>
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[['Blood Group', 'B+'], ['Allergies', 'Penicillin'], ['Last Visit', '28 Apr 2026'], ['Total Visits', '14']].map(([l, v]) => (
                <div key={l}>
                  <div className="text-xs text-gray-400">{l}</div>
                  <div className="text-sm font-medium text-gray-800">{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Latest Visit Note</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Mild fever (101°F) and throat pain. Dx: Viral pharyngitis. Rx: Azithromycin 500mg × 5 days. Follow-up in 1 week.
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">Patient Management</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-5 leading-tight">
              Every patient's story at your fingertips
            </h2>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              Complete patient profiles with medical history, allergies, prescriptions, visit notes, and documents —
              all searchable in seconds.
            </p>
            <ul className="space-y-3">
              {[
                'Full medical history with visit-by-visit records',
                'Prescription tracking and renewal reminders',
                'Document storage — lab reports, scans, and more',
                'Quick search by name, phone, or condition',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-gray-600 text-sm">
                  <CheckIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Works with tools you already use</h2>
          <p className="text-gray-500 mb-10">One-click integrations. Zero technical setup.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            {[
              { name: 'Google Calendar', desc: 'Two-way appointment sync', cls: 'bg-red-50 border-red-100' },
              { name: 'WhatsApp', desc: 'Automated patient reminders', cls: 'bg-green-50 border-green-100' },
              { name: 'Razorpay', desc: 'Online payment collection', cls: 'bg-blue-50 border-blue-100' },
            ].map(i => (
              <div key={i.name} className={`rounded-2xl border ${i.cls} px-8 py-5 text-left min-w-[190px]`}>
                <div className="font-bold text-gray-800">{i.name}</div>
                <div className="text-gray-500 text-sm mt-1">{i.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Up and running in minutes</h2>
            <p className="text-gray-500 text-lg">No installation. No IT team. Just sign up and go.</p>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="hidden sm:block absolute top-6 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200" />
            {STEPS.map(s => (
              <div key={s.num} className="text-center relative">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-5 relative z-10 shadow-lg shadow-blue-200">
                  {s.num}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Loved by doctors</h2>
            <p className="text-gray-500 text-lg">Real feedback from real clinics.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact for Pricing */}
      <section id="contact" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Pricing & Setup</h2>
            <p className="text-gray-500 text-lg">Get a plan tailored to your clinic. Reach out and we'll set everything up for you.</p>
          </div>
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-3xl border-2 border-blue-600 shadow-2xl shadow-blue-100 p-8 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">Contact Us for Pricing</div>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Every clinic is different. Mail us and we'll share pricing details and get your clinic set up quickly.
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-3 mb-8">
                {PRICING_ITEMS.map(item => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:prijeshdonga14@gmail.com?subject=ClinicCRM%20Pricing%20%26%20Setup"
                className="block w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Mail Us for Pricing
              </a>
              <p className="text-xs text-gray-400 mt-3">prijeshdonga14@gmail.com</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Frequently asked questions</h2>
            <p className="text-gray-500 text-lg">Can't find what you're looking for? Reach out to our support team.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
                  <ChevronDown open={openFaq === i} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 pt-4 text-gray-500 text-sm leading-relaxed border-t border-gray-100">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security strip */}
      <section className="py-10 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { path: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: '256-bit SSL encryption' },
              { path: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z', label: 'Firebase cloud storage' },
              { path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Secure authentication' },
              { path: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Works on any device' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.path} />
                </svg>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to modernize your clinic?</h2>
          <p className="text-blue-200 text-lg mb-10">
            Join hundreds of doctors who spend less time on admin and more time with patients.
          </p>
          <Link href="/signup" className="inline-block bg-white text-blue-700 font-bold text-lg px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-xl shadow-blue-900/20">
            Start Free Trial →
          </Link>
          <p className="text-blue-300 text-sm mt-4">7 days free · Cancel anytime · No contracts</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-white font-bold">ClinicCRM</span>
              </div>
              <p className="text-sm leading-relaxed">Clinic management built for Indian doctors and small practices.</p>
            </div>
            <div>
              <div className="text-white font-semibold text-sm mb-3">Product</div>
              <ul className="space-y-2 text-sm">
                {[['#features','Features'], ['#how-it-works','How it works'], ['#pricing','Pricing'], ['#testimonials','Testimonials'], ['#faq','FAQ']].map(([href, label]) => (
                  <li key={label}><a href={href} className="hover:text-white transition-colors">{label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold text-sm mb-3">Features</div>
              <ul className="space-y-2 text-sm">
                {['Patient Management', 'Smart Scheduling', 'Billing & Invoices', 'Analytics & Reports', 'Inventory', 'Staff Management'].map(f => (
                  <li key={f}><span>{f}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold text-sm mb-3">Account</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Create Account</Link></li>
                <li><Link href="/signup/receptionist" className="hover:text-white transition-colors">Receptionist Sign Up</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
            <span>© {new Date().getFullYear()} ClinicCRM. All rights reserved.</span>
            <span>Built for doctors across India.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
