'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'

const SPECIALIZATION_LABELS = {
  general: 'General Practitioner',
  cardiology: 'Cardiology',
  dermatology: 'Dermatology',
  neurology: 'Neurology',
  orthopedics: 'Orthopedics',
  pediatrics: 'Pediatrics',
  psychiatry: 'Psychiatry',
  gynecology: 'Gynecology & Obstetrics',
  ophthalmology: 'Ophthalmology',
  ent: 'ENT',
  dentistry: 'Dentistry',
  other: 'Other',
}

const stats = [
  {
    label: 'Total Patients',
    value: '0',
    sub: 'Registered patients',
    color: 'blue',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Appointments Today',
    value: '0',
    sub: 'Scheduled today',
    color: 'green',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Pending Bills',
    value: '0',
    sub: 'Awaiting payment',
    color: 'yellow',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Prescriptions',
    value: '0',
    sub: 'Active prescriptions',
    color: 'purple',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
]

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

const quickActions = [
  { label: 'Add New Patient', color: 'blue',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> },
  { label: 'Schedule Appointment', color: 'green',  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { label: 'Generate Invoice', color: 'yellow', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { label: 'Write Prescription', color: 'purple', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> },
]

const quickActionColorMap = {
  blue:   { border: 'hover:border-blue-300',   bg: 'hover:bg-blue-50',   icon: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200' },
  green:  { border: 'hover:border-green-300',  bg: 'hover:bg-green-50',  icon: 'bg-green-100 text-green-600 group-hover:bg-green-200' },
  yellow: { border: 'hover:border-yellow-300', bg: 'hover:bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200' },
  purple: { border: 'hover:border-purple-300', bg: 'hover:bg-purple-50', icon: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200' },
}

function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function DashboardPage() {
  const { doctor, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !doctor) router.replace('/login')
  }, [doctor, loading, router])

  if (loading || !doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  const specLabel = SPECIALIZATION_LABELS[doctor.specialization] ?? doctor.specialization

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400">{today()}</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Patient
          </button>
        </header>

        <div className="px-8 py-8 space-y-8">

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">
                Good day, Dr. {doctor.firstName}! 👋
              </h2>
              <p className="text-blue-100 text-sm">
                {doctor.clinicName
                  ? `Welcome to ${doctor.clinicName} — here's your clinic overview.`
                  : `Here's your clinic overview for today.`}
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-blue-200 text-xs font-medium uppercase tracking-wide">Specialization</span>
              <span className="text-white font-semibold mt-0.5">{specLabel}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {stats.map(stat => {
              const c = colorMap[stat.color]
              return (
                <div key={stat.label} className="stat-card">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                    <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
                      <span className={c.icon}>{stat.icon}</span>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Recent patients + Quick actions */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Recent patients */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Patients</h3>
                <a href="/patients" className="text-sm text-blue-600 hover:underline font-medium">View all</a>
              </div>
              <div className="px-6 py-14 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-600">No patients yet</p>
                <p className="text-xs text-gray-400 mt-1">Add your first patient to get started</p>
                <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                  Add Patient
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-2">
                {quickActions.map(action => {
                  const c = quickActionColorMap[action.color]
                  return (
                    <button
                      key={action.label}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 ${c.border} ${c.bg} text-left transition-colors group`}
                    >
                      <div className={`w-8 h-8 ${c.icon} rounded-lg flex items-center justify-center flex-shrink-0 transition-colors`}>
                        {action.icon}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{action.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Doctor profile card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Your Profile</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: 'Full Name', value: `Dr. ${doctor.firstName} ${doctor.lastName}` },
                { label: 'Specialization', value: specLabel },
                { label: 'License No.', value: doctor.licenseNumber },
                { label: 'Phone', value: doctor.phone },
                { label: 'Email', value: doctor.email },
                { label: 'Clinic', value: doctor.clinicName || '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
