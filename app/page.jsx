'use client'

import { useState } from 'react'
import Link from 'next/link'

const features = [
  {
    icon: '👥',
    title: 'Patient Management',
    desc: 'Complete patient profiles, medical history, and visit records — all in one place.',
  },
  {
    icon: '📅',
    title: 'Smart Scheduling',
    desc: 'Drag-and-drop calendar with Google Calendar sync and automated reminders.',
  },
  {
    icon: '🧾',
    title: 'Billing & Invoices',
    desc: 'Generate professional invoices instantly and track payments with ease.',
  },
  {
    icon: '🩺',
    title: 'Visit Recording',
    desc: 'Document diagnoses, prescriptions, and follow-ups during every consultation.',
  },
  {
    icon: '🔔',
    title: 'Follow-up Reminders',
    desc: 'Automated WhatsApp and in-app reminders so no patient falls through the cracks.',
  },
  {
    icon: '📊',
    title: 'Analytics & Reports',
    desc: 'Revenue trends, patient stats, and appointment insights at a glance.',
  },
]

const testimonials = [
  {
    name: 'Dr. Priya Mehta',
    role: 'General Physician, Mumbai',
    avatar: 'PM',
    text: 'ClinicCRM cut my admin time in half. I can focus on patients instead of paperwork. The billing module alone is worth it.',
  },
  {
    name: 'Dr. Arjun Sharma',
    role: 'Dentist, Bangalore',
    avatar: 'AS',
    text: 'The Google Calendar sync is seamless. My receptionist and I stay perfectly in sync without any back-and-forth.',
  },
  {
    name: 'Dr. Sneha Patel',
    role: 'Pediatrician, Ahmedabad',
    avatar: 'SP',
    text: 'WhatsApp reminders reduced my no-shows by 40%. Patients actually appreciate the follow-ups.',
  },
]

const steps = [
  { num: '1', title: 'Sign up free', desc: 'Create your account in 30 seconds. No credit card required for the 7-day trial.' },
  { num: '2', title: 'Add your patients', desc: 'Import or manually add patients. Everything is securely stored in the cloud.' },
  { num: '3', title: 'Run your clinic', desc: 'Schedule, consult, bill, and follow up — all from one dashboard.' },
]

export default function LandingPage() {
  const [billing, setBilling] = useState('monthly')

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600 tracking-tight">ClinicCRM</span>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-blue-600 transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
            7-day free trial · No credit card required
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            The clinic management software<br />
            <span className="text-blue-600">doctors actually love</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Appointments, patient records, billing, and WhatsApp reminders — all in one place.
            Built for solo practitioners and small clinics in India.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-blue-600 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Start Free Trial →
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto border border-gray-200 text-gray-700 font-semibold text-base px-8 py-3.5 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="max-w-4xl mx-auto mt-16 px-4 sm:px-6">
          <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-blue-100 overflow-hidden bg-white">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 text-xs text-gray-400 font-mono">cliniccrm.app/dashboard</span>
            </div>
            <div className="p-6 grid grid-cols-3 sm:grid-cols-4 gap-4 bg-white">
              {[
                { label: "Today's Appointments", val: '8', color: 'bg-blue-50 text-blue-700' },
                { label: 'Total Patients', val: '248', color: 'bg-green-50 text-green-700' },
                { label: "This Month's Revenue", val: '₹68,400', color: 'bg-purple-50 text-purple-700' },
                { label: 'Pending Follow-ups', val: '12', color: 'bg-orange-50 text-orange-700' },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl p-4 ${card.color}`}>
                  <div className="text-2xl font-bold">{card.val}</div>
                  <div className="text-xs mt-1 opacity-80">{card.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by banner */}
      <section className="bg-gray-50 border-y border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-gray-400 font-medium uppercase tracking-widest mb-4">Trusted by doctors across India</p>
          <div className="flex flex-wrap justify-center gap-8 text-gray-500 text-sm font-medium">
            {['General Physicians', 'Dentists', 'Pediatricians', 'Dermatologists', 'Orthopedic Surgeons'].map((s) => (
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
            <p className="text-gray-500 text-lg max-w-xl mx-auto">One subscription. No per-feature pricing. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Works with tools you already use</h2>
          <p className="text-blue-200 mb-10">One-click integrations, zero technical setup.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            {[
              { name: 'Google Calendar', desc: 'Two-way appointment sync' },
              { name: 'WhatsApp', desc: 'Automated patient reminders' },
            ].map((i) => (
              <div key={i.name} className="bg-white/10 backdrop-blur rounded-2xl px-8 py-5 text-white text-left min-w-[220px]">
                <div className="font-bold text-lg">{i.name}</div>
                <div className="text-blue-200 text-sm mt-1">{i.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
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
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex text-yellow-400 text-sm mb-4">{'★★★★★'}</div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {t.avatar}
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

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-lg mb-8">Start with a 7-day free trial. No credit card required.</p>
            {/* Billing toggle */}
            <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billing === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billing === 'yearly' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Yearly
                <span className="ml-1.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">Save 30%</span>
              </button>
            </div>
          </div>
          <div className="max-w-sm mx-auto">
            <div className="bg-white rounded-3xl border-2 border-blue-600 shadow-xl p-8 text-center">
              <div className="text-sm font-semibold text-blue-600 mb-2">All Features Included</div>
              <div className="text-5xl font-extrabold text-gray-900 mb-1">
                ₹{billing === 'monthly' ? '600' : '5,000'}
              </div>
              <div className="text-gray-400 text-sm mb-8">
                per {billing === 'monthly' ? 'month' : 'year'}
                {billing === 'yearly' && (
                  <span className="ml-2 text-green-600 font-medium">(≈ ₹417/mo)</span>
                )}
              </div>
              <ul className="text-left text-sm text-gray-600 space-y-3 mb-8">
                {[
                  'Unlimited patients & appointments',
                  'Billing & invoice management',
                  'Visit recording & prescriptions',
                  'Google Calendar sync',
                  'WhatsApp reminders',
                  'Analytics & reports',
                  'Priority support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-green-500 font-bold">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-center"
              >
                Start Free 7-Day Trial
              </Link>
              <p className="text-xs text-gray-400 mt-3">No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security strip */}
      <section className="py-10 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
            {['🔒 256-bit SSL encryption', '☁️ Firebase cloud storage', '🔐 Secure authentication', '📱 Works on any device'].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to modernize your clinic?
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            Join hundreds of doctors who spend less time on admin and more time with patients.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-blue-700 font-bold text-lg px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-xl"
          >
            Start Free Trial →
          </Link>
          <p className="text-blue-300 text-sm mt-4">7 days free · Cancel anytime · No contracts</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div>
              <div className="text-white font-bold text-lg mb-1">ClinicCRM</div>
              <div className="text-sm">© {new Date().getFullYear()} ClinicCRM. All rights reserved.</div>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
