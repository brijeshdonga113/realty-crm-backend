'use client'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useReports } from '@/hooks/useReports'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { formatCurrency } from '@/models/Invoice'

const SPECIALIZATION_LABELS = {
  general: 'General Practitioner', cardiology: 'Cardiology', dermatology: 'Dermatology',
  neurology: 'Neurology', orthopedics: 'Orthopedics', pediatrics: 'Pediatrics',
  psychiatry: 'Psychiatry', gynecology: 'Gynecology & Obstetrics', ophthalmology: 'Ophthalmology',
  ent: 'ENT', dentistry: 'Dentistry', other: 'Other',
}

const APPT_STATUS_COLOR = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }

function StatCard({ label, value, sub, color, icon }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-100' },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  ring: 'ring-green-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   ring: 'ring-teal-100' },
  }
  const c = colors[color] ?? colors.blue
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 ${c.bg} ring-1 ${c.ring} rounded-lg flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { doctor }    = useAuth()
  const router        = useRouter()
  const { stats, loading: reportLoading } = useReports()
  const { appointments } = useAppointments()
  const { patients }     = usePatients()

  const todayStr   = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled').slice(0, 5)
  const specLabel  = SPECIALIZATION_LABELS[doctor?.specialization] ?? doctor?.specialization

  const quickActions = [
    { label: 'Add Patient',          href: '/patients/new',     icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
    )},
    { label: 'New Visit',            href: '/patients',         icon: (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
    )},
    { label: 'Schedule Appointment', href: '/appointments/new', icon: (
      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
    )},
    { label: 'Create Invoice',       href: '/billing/new',      icon: (
      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
    )},
  ]

  return (
    <AppLayout
      title={doctor?.clinicName || 'Dashboard'}
      action={
        <button onClick={() => router.push('/patients/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Patient
        </button>
      }
    >
      <div className="space-y-7">

        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            {doctor?.clinicName && (
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">{doctor.clinicName}</p>
            )}
            <h2 className="text-xl font-bold mb-0.5">Good day, Dr. {doctor?.firstName} {doctor?.lastName}!</h2>
            <p className="text-blue-100 text-sm">
              {stats
                ? `${stats.appointments.todayCount} appointment${stats.appointments.todayCount !== 1 ? 's' : ''} · ${stats.visits?.todayCount ?? 0} visit${stats.visits?.todayCount !== 1 ? 's' : ''} today.`
                : 'Loading your clinic overview…'}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Specialization</p>
            <p className="text-white font-semibold mt-0.5">{specLabel}</p>
          </div>
        </div>

        {/* Stat cards */}
        {reportLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-28"/>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total Patients" color="blue"
                value={stats?.patients.total ?? 0}
                sub="Registered"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
              />
              <StatCard
                label="Today's Visits" color="green"
                value={stats?.visits?.todayCount ?? 0}
                sub={`${stats?.appointments.todayCount ?? 0} appointments`}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
              />
              <StatCard
                label="Follow-ups Due" color="orange"
                value={stats?.visits?.followupToday ?? 0}
                sub="Today"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              />
              <StatCard
                label="Tomorrow Follow-ups" color="purple"
                value={stats?.visits?.followupTomorrow ?? 0}
                sub="Next 24 hrs"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
              />
            </div>

            {/* Today's Revenue — full width highlight */}
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-5 flex items-center justify-between text-white">
              <div>
                <p className="text-teal-100 text-xs font-semibold uppercase tracking-wider mb-1">Today's Revenue</p>
                <p className="text-3xl font-bold">
                  ₹ {(stats?.billing?.todayRevenue ?? 0).toLocaleString('en-IN')}
                </p>
                <p className="text-teal-100 text-xs mt-1">
                  Total: {formatCurrency(stats?.billing?.totalRevenue ?? 0)} · {stats?.billing?.pending ?? 0} pending
                </p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </>
        )}

        {/* Today's patients + quick actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Today's appointments */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Today's Patients</h3>
              <button onClick={() => router.push('/appointments')} className="text-sm text-blue-600 hover:underline font-medium">View all</button>
            </div>
            {todayAppts.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-gray-600">No appointments today</p>
                <p className="text-xs text-gray-400 mt-1">Schedule one to get started.</p>
                <button onClick={() => router.push('/appointments/new')}
                  className="mt-3 text-sm text-blue-600 hover:underline font-medium">
                  Schedule Appointment
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayAppts.map(appt => (
                  <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-semibold text-xs">
                        {appt.patientName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{appt.patientName}</p>
                      <p className="text-xs text-gray-400 capitalize">{appt.type?.replace('_',' ')} · {appt.reason || 'General'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700">{appt.time}</p>
                      <Badge label={appt.status} color={APPT_STATUS_COLOR[appt.status] ?? 'gray'}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-4 space-y-2">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => router.push(a.href)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 text-left transition-colors">
                  {a.icon}
                  <span className="text-sm font-medium text-gray-700">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent visits */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Visits</h3>
            <button onClick={() => router.push('/patients')} className="text-sm text-blue-600 hover:underline font-medium">View patients</button>
          </div>
          {!stats?.visits?.recent?.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-600">No visits recorded yet</p>
              <p className="text-xs text-gray-400 mt-1">Open a patient profile to record a visit.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.visits.recent.map(v => (
                <div key={v.id} onClick={() => router.push(`/patients/${v.patientId}`)}
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/60 transition-colors">
                  <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-700 font-semibold text-xs">
                      {v.patientName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.patientName}</p>
                    <p className="text-xs text-gray-400 truncate">{v.chiefComplaint || 'Visit recorded'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{v.visitDate}</p>
                    {v.followUpDate && (
                      <p className="text-xs text-orange-500 font-medium mt-0.5">Follow-up {v.followUpDate}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
