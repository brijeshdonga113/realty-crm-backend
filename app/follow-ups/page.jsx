'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { visitService } from '@/services/visitService'
import { useAuth } from '@/context/AuthContext'

function daysBetween(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function FollowUpCard({ visit, router }) {
  const diff = daysBetween(visit.followUpDate)
  const isOverdue  = diff < 0
  const isToday    = diff === 0
  const isTomorrow = diff === 1

  let badge, badgeBg
  if (isOverdue)      { badge = `${Math.abs(diff)}d overdue`;  badgeBg = 'bg-red-100 text-red-700' }
  else if (isToday)   { badge = 'Today';                        badgeBg = 'bg-orange-100 text-orange-700' }
  else if (isTomorrow){ badge = 'Tomorrow';                     badgeBg = 'bg-yellow-100 text-yellow-700' }
  else                { badge = `in ${diff} days`;              badgeBg = 'bg-primary-50 text-primary-700' }

  const initials = visit.patientName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div
      onClick={() => router.push(`/patients/${visit.patientId}`)}
      className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${isOverdue ? 'border-l-4 border-red-400' : isToday ? 'border-l-4 border-orange-400' : ''}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-100' : 'bg-primary-100'}`}>
        <span className={`font-semibold text-xs ${isOverdue ? 'text-red-700' : 'text-primary-700'}`}>{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{visit.patientName}</p>
        <p className="text-xs text-gray-400 truncate">{visit.chiefComplaint || 'Follow-up visit'}</p>
      </div>
      <div className="text-right flex-shrink-0 space-y-1">
        <p className="text-xs text-gray-500">{visit.followUpDate}</p>
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>{badge}</span>
      </div>
    </div>
  )
}

function Section({ title, count, color, children, emptyMsg }) {
  const colors = {
    red:    'text-red-600 bg-red-50 border-red-200',
    orange: 'text-orange-600 bg-orange-50 border-orange-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    teal:   'text-primary-600 bg-primary-50 border-primary-200',
  }
  const badge = colors[color] ?? colors.teal

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge}`}>{count}</span>
      </div>
      {count === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">{emptyMsg}</div>
      ) : (
        <div className="divide-y divide-gray-50">{children}</div>
      )}
    </div>
  )
}

export default function FollowUpsPage() {
  const router = useRouter()
  const { doctor } = useAuth()
  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      const all = await visitService.getAll()
      setVisits(all.filter(v => v.followUpDate))
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const overdue  = visits.filter(v => v.followUpDate < today).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
  const todayF   = visits.filter(v => v.followUpDate === today)
  const tomorrowF= visits.filter(v => v.followUpDate === tomorrow)
  const upcoming = visits.filter(v => v.followUpDate > tomorrow).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))

  if (loading) return (
    <AppLayout title="Follow-ups">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading follow-ups…
      </div>
    </AppLayout>
  )

  const totalDue = overdue.length + todayF.length + tomorrowF.length

  return (
    <AppLayout
      title="Follow-ups"
      action={
        totalDue > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {totalDue} due
          </span>
        )
      }
    >
      <div className="space-y-6">

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Overdue',   count: overdue.length,   color: 'text-red-600',      bg: 'bg-red-50',      border: 'border-red-100' },
            { label: 'Today',     count: todayF.length,    color: 'text-orange-600',   bg: 'bg-orange-50',   border: 'border-orange-100' },
            { label: 'Tomorrow',  count: tomorrowF.length, color: 'text-yellow-600',   bg: 'bg-yellow-50',   border: 'border-yellow-100' },
            { label: 'Upcoming',  count: upcoming.length,  color: 'text-primary-600',  bg: 'bg-primary-50',  border: 'border-primary-100' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {visits.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-8 py-16 text-center">
            <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">No follow-ups scheduled</p>
            <p className="text-xs text-gray-400 mt-1">Follow-up dates are set when recording patient visits.</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <Section title="Overdue" count={overdue.length} color="red" emptyMsg="">
                {overdue.map(v => <FollowUpCard key={v.id} visit={v} router={router}/>)}
              </Section>
            )}

            <Section title="Today" count={todayF.length} color="orange" emptyMsg="No follow-ups today.">
              {todayF.map(v => <FollowUpCard key={v.id} visit={v} router={router}/>)}
            </Section>

            <Section title="Tomorrow" count={tomorrowF.length} color="yellow" emptyMsg="No follow-ups tomorrow.">
              {tomorrowF.map(v => <FollowUpCard key={v.id} visit={v} router={router}/>)}
            </Section>

            {upcoming.length > 0 && (
              <Section title="Upcoming" count={upcoming.length} color="teal" emptyMsg="">
                {upcoming.map(v => <FollowUpCard key={v.id} visit={v} router={router}/>)}
              </Section>
            )}
          </>
        )}

      </div>
    </AppLayout>
  )
}
