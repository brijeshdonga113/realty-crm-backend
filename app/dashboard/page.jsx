'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useReports } from '@/hooks/useReports'
import { useAppointments } from '@/hooks/useAppointments'
import { usePreferences } from '@/hooks/usePreferences'
import { localDateStr } from '@/lib/preferences'
import { dataStore } from '@/lib/dataStore'

const SPECIALIZATION_LABELS = {
  general: 'General Practitioner', cardiology: 'Cardiology', dermatology: 'Dermatology',
  neurology: 'Neurology', orthopedics: 'Orthopedics', pediatrics: 'Pediatrics',
  psychiatry: 'Psychiatry', gynecology: 'Gynecology & Obstetrics', ophthalmology: 'Ophthalmology',
  ent: 'ENT', dentistry: 'Dentistry', other: 'Other',
}

const APPT_STATUS_COLOR = { scheduled: 'teal', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }

const WIDGET_DEFS = [
  { id: 'stats',              label: 'Statistics Cards',                  icon: '📊' },
  { id: 'appointments',       label: "Today's Patients & Quick Actions",  icon: '📅' },
  { id: 'followups',          label: 'Follow-ups Today & Tomorrow',       icon: '🔔' },
  { id: 'followups_two_days', label: 'Follow-ups in 2 Days',              icon: '⏳' },
  { id: 'recent_visits',      label: 'Recent Visits',                     icon: '🩺' },
]

const DEFAULT_LAYOUT = WIDGET_DEFS.map(w => ({ id: w.id, visible: true }))

function StatCard({ label, value, sub, color, icon, href }) {
  const colors = {
    teal:   { bg: 'bg-primary-50 dark:bg-primary-900/30',  text: 'text-primary-600 dark:text-primary-400',  ring: 'ring-primary-100 dark:ring-primary-800' },
    green:  { bg: 'bg-green-50 dark:bg-green-900/30',      text: 'text-green-600 dark:text-green-400',      ring: 'ring-green-100 dark:ring-green-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/30',    text: 'text-purple-600 dark:text-purple-400',    ring: 'ring-purple-100 dark:ring-purple-800' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/30',    text: 'text-orange-600 dark:text-orange-400',    ring: 'ring-orange-100 dark:ring-orange-800' },
    accent: { bg: 'bg-accent-50 dark:bg-accent-900/30',    text: 'text-accent-700 dark:text-accent-400',    ring: 'ring-accent-100 dark:ring-accent-800' },
  }
  const c = colors[color] ?? colors.teal
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 ${c.bg} ring-1 ${c.ring} rounded-lg flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
      {href && <p className={`text-xs font-medium mt-2 ${c.text} opacity-70`}>View →</p>}
    </>
  )
  if (href) return (
    <Link href={href} className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all">
      {inner}
    </Link>
  )
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-md transition-shadow">
      {inner}
    </div>
  )
}

export default function DashboardPage() {
  const { doctor, isReceptionist, activeBranch, activeManagedDoctor } = useAuth()
  const router = useRouter()
  const { formatCurrency, formatDate } = usePreferences()
  const { update: updateAppt } = useAppointments()
  const [markingDone, setMarkingDone] = useState(null)

  useEffect(() => {
    if (doctor?.isAdmin) router.replace('/admin')
  }, [doctor?.isAdmin])
  const { stats, rawAppointments: appointments, rawPatients: patients, rawFollowups: followups, loading: reportLoading } = useReports()

  async function handleMarkDone(appt) {
    setMarkingDone(appt.id)
    try { await updateAppt(appt.id, { status: 'completed' }) } finally { setMarkingDone(null) }
  }

  const [layout, setLayout]         = useState(DEFAULT_LAYOUT)
  const [customizing, setCustomizing] = useState(false)
  const [draftLayout, setDraftLayout] = useState(DEFAULT_LAYOUT)
  const [saving, setSaving]         = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const dragId = useRef(null)

  // Load saved layout from Firestore
  useEffect(() => {
    if (!doctor) return
    dataStore.getMeta('dashboardLayout').then(saved => {
      if (saved?.widgets?.length) {
        // Merge saved with WIDGET_DEFS in case new widgets were added
        const savedIds = saved.widgets.map(w => w.id)
        const merged = [
          ...saved.widgets.filter(w => WIDGET_DEFS.some(d => d.id === w.id)),
          ...WIDGET_DEFS.filter(d => !savedIds.includes(d.id)).map(d => ({ id: d.id, visible: true })),
        ]
        setLayout(merged)
        setDraftLayout(merged)
      }
    }).catch(() => {})
  }, [doctor])

  const todayStr    = localDateStr()
  const tomorrowStr = localDateStr(1)
  const twoDaysStr  = localDateStr(2)

  const todayAppts        = useMemo(() => appointments.filter(a => a.date === todayStr && a.status !== 'cancelled').slice(0, 5), [appointments, todayStr])
  const todayFollowups    = useMemo(() => followups.filter(f => f.dueDate === todayStr    && f.status === 'pending'), [followups, todayStr])
  const tomorrowFollowups = useMemo(() => followups.filter(f => f.dueDate === tomorrowStr && f.status === 'pending'), [followups, tomorrowStr])
  const twoDayFollowups   = useMemo(() => followups.filter(f => f.dueDate === twoDaysStr  && f.status === 'pending'), [followups, twoDaysStr])
  const specLabel = SPECIALIZATION_LABELS[doctor?.specialization] ?? doctor?.specialization

  const quickActions = [
    { label: 'Add Patient',          href: '/patients/new',     icon: <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg> },
    { label: 'New Visit',            href: '/patients',         icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
    { label: 'Schedule Appointment', href: '/appointments/new', icon: <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
    { label: 'Create Invoice',       href: '/billing/new',      icon: <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
  ]

  // ─── Drag-and-drop handlers ───────────────────────────────────────────────

  function handleDragStart(e, id) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, targetId) {
    e.preventDefault()
    if (!dragId.current || dragId.current === targetId) return
    setDraftLayout(prev => {
      const fromIdx = prev.findIndex(w => w.id === dragId.current)
      const toIdx   = prev.findIndex(w => w.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  function handleDrop(e) {
    e.preventDefault()
    dragId.current = null
  }

  function toggleVisible(id) {
    setDraftLayout(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w))
  }

  async function saveLayout() {
    setSaving(true)
    try {
      await dataStore.setMeta('dashboardLayout', { widgets: draftLayout })
      setLayout(draftLayout)
      setCustomizing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelCustomize() {
    setDraftLayout(layout)
    setCustomizing(false)
  }

  // ─── Widget renderers ─────────────────────────────────────────────────────

  function renderStats() {
    if (reportLoading) return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse h-28"/>
        ))}
      </div>
    )
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients" color="teal" href="/patients" value={patients.length} sub="Registered"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
        <StatCard label="Today's Visits" color="green" href="/appointments" value={stats?.visits?.todayCount ?? 0} sub={`${stats?.appointments?.todayCount ?? 0} appointments`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
        />
        <StatCard label="Follow-ups Due" color="orange" href="/follow-ups" value={(stats?.followups?.todayCount ?? 0) + (stats?.followups?.overdueCount ?? 0)} sub={`${stats?.followups?.overdueCount ?? 0} overdue · ${stats?.followups?.todayCount ?? 0} today`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard label="Tomorrow Follow-ups" color="accent" href="/follow-ups" value={stats?.followups?.tomorrowCount ?? 0} sub={`${stats?.followups?.upcomingCount ?? 0} upcoming total`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />
      </div>
    )
  }

  function renderAppointments() {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                    {['scheduled','confirmed'].includes(appt.status) && (
                      <div className="flex items-center gap-1">
                        {appt.patientId && (
                          <button
                            onClick={() => router.push(`/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&reason=${encodeURIComponent(appt.reason||'')}`)}
                            className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                            Attend →
                          </button>
                        )}
                        <button
                          onClick={() => handleMarkDone(appt)}
                          disabled={markingDone === appt.id}
                          title="Mark as done"
                          className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 disabled:opacity-50 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                          {markingDone === appt.id ? '…' : '✓ Done'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
    )
  }

  function renderFollowups() {
    if (!todayFollowups.length && !tomorrowFollowups.length) return null
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-4 border-b border-orange-100 dark:border-orange-900/30 flex items-center justify-between bg-orange-50/40 dark:bg-orange-900/10 rounded-t-xl">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Follow-ups Today</h3>
              {todayFollowups.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-full">
                  {todayFollowups.length}
                </span>
              )}
            </div>
            <button onClick={() => router.push('/follow-ups')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">View all</button>
          </div>
          {todayFollowups.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No follow-ups today.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {todayFollowups.map(f => (
                <div key={f.id} className="px-6 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => f.patientId && router.push(`/patients/${f.patientId}`)}>
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-700 dark:text-orange-300 font-semibold text-xs">
                      {(f.patientName||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{f.patientName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{f.note || 'Follow-up visit'}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full flex-shrink-0">Today</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-4 border-b border-yellow-100 dark:border-yellow-900/30 flex items-center justify-between bg-yellow-50/40 dark:bg-yellow-900/10 rounded-t-xl">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Follow-ups Tomorrow</h3>
              {tomorrowFollowups.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-full">
                  {tomorrowFollowups.length}
                </span>
              )}
            </div>
            <button onClick={() => router.push('/follow-ups')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">View all</button>
          </div>
          {tomorrowFollowups.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No follow-ups tomorrow.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {tomorrowFollowups.map(f => (
                <div key={f.id} className="px-6 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => f.patientId && router.push(`/patients/${f.patientId}`)}>
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-yellow-700 dark:text-yellow-300 font-semibold text-xs">
                      {(f.patientName||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{f.patientName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{f.note || 'Follow-up visit'}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full flex-shrink-0">Tomorrow</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderFollowupsTwoDays() {
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
          <button onClick={() => router.push('/follow-ups')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">View all</button>
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
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 flex-shrink-0">{formatDate(f.dueDate)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderRecentVisits() {
    return (
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(v.visitDate)}</p>
                  {v.followUpDate && (
                    <p className="text-xs text-orange-500 font-medium mt-0.5">Follow-up {formatDate(v.followUpDate)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderWidget(id) {
    switch (id) {
      case 'stats':              return renderStats()
      case 'appointments':       return renderAppointments()
      case 'followups':          return renderFollowups()
      case 'followups_two_days': return renderFollowupsTwoDays()
      case 'recent_visits':      return renderRecentVisits()
      default:                   return null
    }
  }

  // ─── Customize panel ──────────────────────────────────────────────────────

  if (customizing) {
    return (
      <AppLayout
        title={activeManagedDoctor?.clinicName || activeBranch?.branchName || doctor?.clinicName || 'Dashboard'}
        action={
          <div className="flex items-center gap-2">
            <button onClick={cancelCustomize}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={saveLayout} disabled={saving}
              className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
              {saving ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              )}
              Save Layout
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-5 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Drag sections to reorder them. Toggle the eye icon to show or hide a section. Click <strong>Save Layout</strong> to apply.
            </p>
          </div>

          {/* Always-visible welcome banner (locked) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 flex items-center gap-4 opacity-60">
            <div className="text-gray-300 dark:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Welcome Banner</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Always shown — cannot be hidden</p>
            </div>
            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>

          {/* Draggable widget list */}
          {draftLayout.map(item => {
            const def = WIDGET_DEFS.find(d => d.id === item.id)
            if (!def) return null
            return (
              <div
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(e, item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDrop={handleDrop}
                className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-4 flex items-center gap-4 cursor-grab active:cursor-grabbing select-none transition-all ${
                  item.visible
                    ? 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'
                    : 'border-dashed border-gray-200 dark:border-gray-700 opacity-50'
                }`}
              >
                {/* Drag handle */}
                <div className="text-gray-300 dark:text-gray-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6a2 2 0 110-4 2 2 0 010 4zM8 14a2 2 0 110-4 2 2 0 010 4zM8 22a2 2 0 110-4 2 2 0 010 4zM16 6a2 2 0 110-4 2 2 0 010 4zM16 14a2 2 0 110-4 2 2 0 010 4zM16 22a2 2 0 110-4 2 2 0 010 4z"/>
                  </svg>
                </div>

                {/* Label */}
                <span className="text-lg flex-shrink-0">{def.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{def.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{item.visible ? 'Visible' : 'Hidden'}</p>
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => toggleVisible(item.id)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    item.visible
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100'
                      : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                  }`}
                  title={item.visible ? 'Hide section' : 'Show section'}
                >
                  {item.visible ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </AppLayout>
    )
  }

  // ─── Normal dashboard view ────────────────────────────────────────────────

  return (
    <AppLayout
      title={doctor?.clinicName || 'Dashboard'}
      action={
        <div className="flex items-center gap-2">
          {doctor?.bookingSlug && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/book/${doctor.bookingSlug}`
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                })
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                linkCopied
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400'
                  : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              }`}>
              {linkCopied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              )}
              {linkCopied ? 'Copied!' : 'Copy Booking Link'}
            </button>
          )}
          <button onClick={() => { setDraftLayout(layout); setCustomizing(true) }}
            className="text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
            </svg>
            Customize
          </button>
          <button
            onClick={() => doctor?.viewOnly ? alert('Adding patients is restricted on your current plan. Contact your administrator to upgrade.') : router.push('/patients/new')}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${doctor?.viewOnly ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-primary-500 hover:bg-primary-600 text-white'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Patient
          </button>
        </div>
      }
    >
      <div className="space-y-7">

        {/* Welcome banner — always shown */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-6 text-white flex items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          </div>
          <div className="relative">
            {doctor?.clinicName && (
              <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-1">{doctor.clinicName}</p>
            )}
            <h2 className="text-xl font-bold mb-0.5">
              {isReceptionist
                ? `Good day, ${doctor?._receptionistName ?? 'there'}!`
                : `Good day, Dr. ${doctor?.firstName} ${doctor?.lastName}!`}
            </h2>
            <p className="text-primary-100 text-sm">
              {stats
                ? `${stats.appointments.todayCount} appointment${stats.appointments.todayCount !== 1 ? 's' : ''} · ${stats.visits?.todayCount ?? 0} visit${stats.visits?.todayCount !== 1 ? 's' : ''} today.`
                : 'Loading your clinic overview…'}
            </p>
          </div>

          {/* Right: logo (if set) or specialization chip */}
          {doctor?.logoUrl ? (
            <div className="hidden sm:flex flex-col items-center gap-1.5 flex-shrink-0 relative">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 overflow-hidden">
                <img
                  src={doctor.logoUrl}
                  alt={doctor.clinicName || 'Clinic logo'}
                  className="w-full h-full object-contain"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              </div>
              {specLabel && (
                <span className="text-xs text-primary-200 font-medium text-center leading-tight">{specLabel}</span>
              )}
            </div>
          ) : specLabel ? (
            <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2 flex-shrink-0">
              <svg className="w-4 h-4 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <span className="text-white font-semibold text-sm">{specLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Customizable widgets in saved order */}
        {layout.filter(w => w.visible).map(item => {
          const content = renderWidget(item.id)
          if (!content) return null
          return <div key={item.id}>{content}</div>
        })}

      </div>
    </AppLayout>
  )
}
