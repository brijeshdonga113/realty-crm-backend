'use client'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useReports } from '@/hooks/useReports'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { formatCurrency } from '@/models/Invoice'
import { getPatientInitials } from '@/models/Patient'

const SPECIALIZATION_LABELS = {
  general: 'General Practitioner', cardiology: 'Cardiology', dermatology: 'Dermatology',
  neurology: 'Neurology', orthopedics: 'Orthopedics', pediatrics: 'Pediatrics',
  psychiatry: 'Psychiatry', gynecology: 'Gynecology & Obstetrics', ophthalmology: 'Ophthalmology',
  ent: 'ENT', dentistry: 'Dentistry', other: 'Other',
}

const APPT_STATUS_COLOR = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }

export default function DashboardPage() {
  const { doctor } = useAuth()
  const router     = useRouter()
  const { stats, monthlyRevenue, loading: reportLoading } = useReports()
  const { appointments }  = useAppointments()
  const { patients }      = usePatients()

  const todayStr      = new Date().toISOString().slice(0, 10)
  const todayAppts    = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled').slice(0, 5)
  const recentPatients = patients.slice(0, 5)

  const specLabel = SPECIALIZATION_LABELS[doctor?.specialization] ?? doctor?.specialization

  const statCards = stats ? [
    {
      label: 'Total Patients', value: stats.patients.total,
      sub: `${stats.patients.thisMonth} added this month`,
      color: 'blue', bg: 'bg-blue-50', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
    },
    {
      label: "Today's Appointments", value: stats.appointments.todayCount,
      sub: `${stats.appointments.upcomingCount} upcoming`,
      color: 'green', bg: 'bg-green-50', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      ),
    },
    {
      label: 'Total Revenue', value: formatCurrency(stats.billing.totalRevenue),
      sub: `${stats.billing.paid} paid invoices`,
      color: 'purple', bg: 'bg-purple-50', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
    },
    {
      label: 'Pending Bills', value: formatCurrency(stats.billing.pendingAmount),
      sub: `${stats.billing.pending} invoices pending`,
      color: 'orange', bg: 'bg-orange-50', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      ),
    },
  ] : []

  const colorMap = {
    blue:   { text: 'text-blue-600' },
    green:  { text: 'text-green-600' },
    purple: { text: 'text-purple-600' },
    orange: { text: 'text-orange-600' },
  }

  const quickActions = [
    { label: 'Add Patient',           href: '/patients/new',      color: 'blue',   icon: '👤' },
    { label: 'Schedule Appointment',  href: '/appointments/new',  color: 'green',  icon: '📅' },
    { label: 'Create Invoice',        href: '/billing/new',       color: 'yellow', icon: '🧾' },
    { label: 'View Reports',          href: '/reports',           color: 'purple', icon: '📊' },
  ]

  const qColors = {
    blue:   'border-blue-200 hover:bg-blue-50 hover:border-blue-300',
    green:  'border-green-200 hover:bg-green-50 hover:border-green-300',
    yellow: 'border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300',
    purple: 'border-purple-200 hover:bg-purple-50 hover:border-purple-300',
  }

  return (
    <AppLayout
      title="Dashboard"
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
      <div className="space-y-8">

        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Good day, Dr. {doctor?.firstName}! 👋</h2>
            <p className="text-blue-100 text-sm">
              {doctor?.clinicName ? `Welcome to ${doctor.clinicName}.` : 'Here\'s your clinic overview.'}
              {stats ? ` ${stats.appointments.todayCount} appointment${stats.appointments.todayCount !== 1 ? 's' : ''} today.` : ''}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <span className="text-blue-200 text-xs font-medium uppercase tracking-wide">Specialization</span>
            <p className="text-white font-semibold mt-0.5">{specLabel}</p>
          </div>
        </div>

        {/* Stat cards */}
        {reportLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-24 mb-4"/>
                <div className="h-8 bg-gray-100 rounded w-16"/>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {statCards.map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">{card.label}</span>
                  <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center`}>
                    <span className={colorMap[card.color]?.text}>{card.icon}</span>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${colorMap[card.color]?.text}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Revenue mini-chart + quick actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Today's schedule */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Today's Appointments</h3>
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
                      <p className="text-xs text-gray-400 capitalize">{appt.type?.replace('_', ' ')} · {appt.reason || 'No reason specified'}</p>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 ${qColors[a.color]} text-left transition-colors`}>
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent patients */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Patients</h3>
            <button onClick={() => router.push('/patients')} className="text-sm text-blue-600 hover:underline font-medium">View all</button>
          </div>
          {recentPatients.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-600">No patients yet</p>
              <button onClick={() => router.push('/patients/new')}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                Add First Patient
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPatients.map(p => (
                <div key={p.id} onClick={() => router.push(`/patients/${p.id}`)}
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-semibold text-sm">{getPatientInitials(p)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-gray-400">{p.phone}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
