'use client'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useReports } from '@/hooks/useReports'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { useFollowUps } from '@/hooks/useFollowUps'
import { formatCurrency } from '@/models/Invoice'

const SPECIALIZATION_LABELS = {
  general: 'General Practitioner', cardiology: 'Cardiology', dermatology: 'Dermatology',
  neurology: 'Neurology', orthopedics: 'Orthopedics', pediatrics: 'Pediatrics',
  psychiatry: 'Psychiatry', gynecology: 'Gynecology & Obstetrics', ophthalmology: 'Ophthalmology',
  ent: 'ENT', dentistry: 'Dentistry', other: 'Other',
}

const APPT_STATUS_COLOR = { scheduled: 'teal', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }

function StatCard({ label, value, sub, color, icon }) {
  const colors = {
    teal:   { bg: 'bg-primary-50 dark:bg-primary-900/30',  text: 'text-primary-600 dark:text-primary-400',  ring: 'ring-primary-100 dark:ring-primary-800' },
    green:  { bg: 'bg-green-50 dark:bg-green-900/30',      text: 'text-green-600 dark:text-green-400',      ring: 'ring-green-100 dark:ring-green-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/30',    text: 'text-purple-600 dark:text-purple-400',    ring: 'ring-purple-100 dark:ring-purple-800' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/30',    text: 'text-orange-600 dark:text-orange-400',    ring: 'ring-orange-100 dark:ring-orange-800' },
    accent: { bg: 'bg-accent-50 dark:bg-accent-900/30',    text: 'text-accent-700 dark:text-accent-400',    ring: 'ring-accent-100 dark:ring-accent-800' },
  }
  const c = colors[color] ?? colors.teal
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 ${c.bg} ring-1 ${c.ring} rounded-lg flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { doctor }    = useAuth()
  const router        = useRouter()
  const { stats, loading: reportLoading } = useReports()
  const { appointments } = useAppointments()
  const { patients }     = usePatients()
  const { followups }    = useFollowUps()

  const todayStr     = new Date().toISOString().slice(0, 10)
  const twoDaysStr   = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled').slice(0, 5)
  const specLabel  = SPECIALIZATION_LABELS[doctor?.specialization] ?? doctor?.specialization

  const quickActions = [
    { label: 'Add Patient',          href: '/patients/new',     icon: (
      <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
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
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Patient
        </button>
      }
    >
      <div className="space-y-7">

        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            {doctor?.clinicName && (
              <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-1">{doctor.clinicName}</p>
            )}
            <h2 className="text-xl font-bold mb-0.5">Good day, Dr. {doctor?.firstName} {doctor?.lastName}!</h2>
            <p className="text-primary-100 text-sm">
              {stats
                ? `${stats.appointments.todayCount} appointment${stats.appointments.todayCount !== 1 ? 's' : ''} · ${stats.visits?.todayCount ?? 0} visit${stats.visits?.todayCount !== 1 ? 's' : ''} today.`
                : 'Loading your clinic overview…'}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-primary-200 text-xs font-medium uppercase tracking-wide">Specialization</p>
            <p className="text-white font-semibold mt-0.5">{specLabel}</p>
          </div>
        </div>

        {/* Stat cards */}
        {reportLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse h-28"/>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total Patients" color="teal"
                value={patients.length}
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
                value={(stats?.followups?.todayCount ?? 0) + (stats?.followups?.overdueCount ?? 0)}
                sub={`${stats?.followups?.overdueCount ?? 0} overdue · ${stats?.followups?.todayCount ?? 0} today`}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              />
              <StatCard
                label="Tomorrow Follow-ups" color="accent"
                value={stats?.followups?.tomorrowCount ?? 0}
                sub={`${stats?.followups?.upcomingCount ?? 0} upcoming total`}
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
          <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Today's Patients</h3>
              <button onClick={() => router.push('/appointments')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">View all</button>
            </div>
            {todayAppts.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No appointments today</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Schedule one to get started.</p>
                <button onClick={() => router.push('/appointments/new')}
                  className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                  Schedule Appointment
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {todayAppts.map(appt => (
                  <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 dark:text-primary-300 font-semibold text-xs">
                        {appt.patientName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => appt.patientId && router.push(`/patients/${appt.patientId}`)}
                        className="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-primary-600 dark:hover:text-primary-400 text-left">
                        {appt.patientName}
                      </button>
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{appt.type?.replace('_',' ')} · {appt.reason || 'General'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{appt.time}</p>
                      <Badge label={appt.status} color={APPT_STATUS_COLOR[appt.status] ?? 'gray'}/>
                      {['scheduled','confirmed'].includes(appt.status) && appt.patientId && (
                        <button
                          onClick={() => router.push(`/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&reason=${encodeURIComponent(appt.reason||'')}`)}
                          className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                          Attend →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            </div>
            <div className="p-4 space-y-2">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => router.push(a.href)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-200 text-left transition-colors">
                  {a.icon}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2-days upcoming follow-ups */}
        {(() => {
          const twoDayFollowups = followups.filter(f => f.dueDate === twoDaysStr && f.status === 'pending')
          if (!twoDayFollowups.length && !(stats?.followups?.twoDaysCount > 0)) return null
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Follow-ups in 2 Days</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                    {stats?.followups?.twoDaysCount ?? twoDayFollowups.length}
                  </span>
                </div>
                <button onClick={() => router.push('/follow-ups')}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                  View all
                </button>
              </div>
              {twoDayFollowups.length === 0 ? (
                <div className="px-6 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  Follow-ups from visits are included in the count above.
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {twoDayFollowups.map(f => (
                    <div key={f.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{f.patientName}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{f.note || 'Scheduled follow-up'}</p>
                      </div>
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400 flex-shrink-0">{f.dueDate}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Recent visits */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Visits</h3>
            <button onClick={() => router.push('/patients')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">View patients</button>
          </div>
          {!stats?.visits?.recent?.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No visits recorded yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Open a patient profile to record a visit.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {stats.visits.recent.map(v => (
                <div key={v.id} onClick={() => router.push(`/patients/${v.patientId}`)}
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 dark:text-primary-300 font-semibold text-xs">
                      {v.patientName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{v.patientName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{v.chiefComplaint || 'Visit recorded'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{v.visitDate}</p>
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
