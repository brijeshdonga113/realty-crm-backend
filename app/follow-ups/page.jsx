'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useFollowUps } from '@/hooks/useFollowUps'
import { usePatients } from '@/hooks/usePatients'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { buildWAUrl } from '@/lib/whatsapp'
import { formatDate as fmtDateLib } from '@/lib/preferences'


const WA_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

function daysBetween(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function sendWhatsApp(entry, doctor, templateKey) {
  const templates = doctor?.waTemplates ?? {}

  const defaults = {
    followup:   'Hello {name},\n\nThis is a reminder that your follow-up at {clinic} is scheduled on *{date}*.\n\nPlease let us know if you need to reschedule.\n\nThank you!',
    tomorrow:   'Hello {name},\n\nJust a reminder — your follow-up at {clinic} is *tomorrow, {date}*.\n\nWe look forward to seeing you!\n\nThank you!',
    today:      'Hello {name},\n\nYour follow-up at {clinic} is *today*. Please visit us at your earliest convenience.\n\nThank you!',
    missed:     'Hello {name},\n\nWe noticed your follow-up scheduled on *{date}* was {days} day(s) ago. Please visit us at {clinic} soon.\n\nYour health is our priority. Thank you!',
  }
  const tmpl = templates[templateKey]?.template || defaults[templateKey] || defaults.followup
  const clinicName = doctor?.clinicName || 'our clinic'
  const diff = daysBetween(entry.dueDate || entry.followUpDate)
  const waFmt = templates.dateFormat || 'DD/MM/YYYY'
  const msg = tmpl
    .replace(/\{name\}/g, entry.patientName || 'Patient')
    .replace(/\{clinic\}/g, clinicName)
    .replace(/\{date\}/g,  fmtDateLib(entry.dueDate || entry.followUpDate || '', waFmt))
    .replace(/\{days\}/g,  String(Math.abs(diff)))

  window.open(buildWAUrl(entry.phone || '', msg), '_blank')
}

function FollowUpRow({ entry, router, doctor, onMarkDone }) {
  const { formatDate } = usePreferences()
  const diff      = daysBetween(entry.dueDate || entry.followUpDate)
  const isOverdue = diff < 0
  const isToday   = diff === 0
  const date      = entry.dueDate || entry.followUpDate
  const initials  = (entry.patientName || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?'
  const isStandalone = entry.source !== 'visit'

  let badge, badgeBg
  if (isOverdue)    { badge = `${Math.abs(diff)}d overdue`; badgeBg = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
  else if (isToday) { badge = 'Today';                       badgeBg = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' }
  else if (diff===1){ badge = 'Tomorrow';                    badgeBg = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' }
  else              { badge = `in ${diff}d`;                 badgeBg = 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' }

  const waKey = isOverdue ? 'missed' : isToday ? 'today' : diff === 1 ? 'tomorrow' : 'followup'

  return (
    <div className={`flex items-start gap-3 px-5 py-3.5 group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
      ${isOverdue ? 'border-l-4 border-red-400' : isToday ? 'border-l-4 border-orange-400' : ''}`}>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
        <span className={`font-semibold text-xs ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-primary-700 dark:text-primary-300'}`}>{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + date row */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 cursor-pointer"
          onClick={() => entry.patientId && router.push(`/patients/${entry.patientId}`)}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.patientName}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(date)}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>{badge}</span>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {entry.note || entry.chiefComplaint || (isStandalone ? 'Follow-up reminder' : 'Follow-up visit')}
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {entry.patientId && (
            <button onClick={() => router.push(`/appointments/new?patientId=${entry.patientId}`)}
              title="Set appointment"
              className="flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-1 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              Appt
            </button>
          )}
          <button onClick={() => sendWhatsApp(entry, doctor, waKey)}
            title="Send WhatsApp reminder"
            className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 px-2 py-1 rounded-lg transition-colors">
            {WA_ICON} Remind
          </button>
          {entry.status === 'pending' && onMarkDone && (
            <button onClick={() => onMarkDone(entry.id)}
              title="Mark as done"
              className="flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              Done
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

function Section({ title, count, color, children, emptyMsg, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const colors = {
    red:    'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-700',
    orange: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-700',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-700',
    teal:   'text-primary-600 bg-primary-50 border-primary-200 dark:text-primary-400 dark:bg-primary-900/20 dark:border-primary-700',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colors[color] ?? colors.teal}`}>{count}</span>
      </button>
      {open && (
        count === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">{emptyMsg}</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700">{children}</div>
        )
      )}
    </div>
  )
}

export default function FollowUpsPage() {
  const router = useRouter()
  const { doctor } = useAuth()
  const { formatDateFull } = usePreferences()
  const { followups, loading, markDone } = useFollowUps()
  const { patients }            = usePatients()

  const [filterDate, setFilterDate] = useState('')
  const [viewMode,   setViewMode]   = useState('all') // 'all' | 'missed'

  // Build patientId → phone map so phone is always current even for old records
  const patientPhoneMap = useMemo(() => {
    const map = {}
    patients.forEach(p => { map[p.id] = p.phone || '' })
    return map
  }, [patients])

  // followups collection already contains both standalone and visit-linked entries
  // (visitService.create writes to followupService with visitId set)
  // No collectionGroup query needed — avoids the Firestore index requirement
  const allEntries = useMemo(() => {
    return followups
      .filter(f => f.status === 'pending')
      .map(f => ({
        id:          f.id,
        patientId:   f.patientId,
        patientName: f.patientName,
        dueDate:     f.dueDate,
        note:        f.note,
        phone:       patientPhoneMap[f.patientId] || f.phone || '',
        status:      f.status,
        source:      f.visitId ? 'visit' : 'standalone',
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [followups, patientPhoneMap])

  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const displayed = useMemo(() => {
    let list = allEntries
    if (filterDate) list = list.filter(e => e.dueDate === filterDate)
    if (viewMode === 'missed') list = list.filter(e => e.dueDate < today)
    return list
  }, [allEntries, filterDate, viewMode, today])

  const overdue  = displayed.filter(e => e.dueDate < today).sort((a,b) => a.dueDate.localeCompare(b.dueDate))
  const todayF   = displayed.filter(e => e.dueDate === today)
  const tomorrowF= displayed.filter(e => e.dueDate === tomorrow)
  const upcoming = displayed.filter(e => e.dueDate > tomorrow).sort((a,b) => a.dueDate.localeCompare(b.dueDate))

  const totalDue = overdue.length + todayF.length


  return (
    <AppLayout
      title="Follow-ups"
      action={
        <div className="flex items-center gap-2">
          {totalDue > 0 && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold px-3 py-1.5 rounded-full">
              {totalDue} due
            </span>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading follow-ups…
        </div>
      ) : (
        <div className="space-y-6">

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Overdue',   count: allEntries.filter(e => e.dueDate < today).length,    color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' },
              { label: 'Today',     count: allEntries.filter(e => e.dueDate === today).length,   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
              { label: 'Tomorrow',  count: allEntries.filter(e => e.dueDate === tomorrow).length, color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800' },
              { label: 'Upcoming',  count: allEntries.filter(e => e.dueDate > tomorrow).length,  color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 text-center cursor-pointer transition-colors ${s.bg}`}
                onClick={() => { setFilterDate(''); setViewMode(s.label === 'Overdue' ? 'missed' : 'all') }}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {[['all','All'],['missed','Missed Only']].map(([v,l]) => (
                  <button key={v} onClick={() => { setViewMode(v); setFilterDate('') }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors
                      ${viewMode === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter by date:</label>
              <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setViewMode('all') }}
                className="input-field text-sm py-1.5 w-40"/>
              {filterDate && (
                <button onClick={() => setFilterDate('')}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-medium">
                  Clear
                </button>
              )}
            </div>
          </div>

          {filterDate && (
            <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
              Showing follow-ups on: {formatDateFull(filterDate)}
              {` (${displayed.length} result${displayed.length !== 1 ? 's' : ''})`}
            </p>
          )}

          {displayed.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-8 py-16 text-center">
              <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {filterDate ? 'No follow-ups on this date' : viewMode === 'missed' ? 'No missed follow-ups' : 'No follow-ups scheduled'}
              </p>
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <Section title={`Missed / Overdue`} count={overdue.length} color="red" emptyMsg="">
                  {overdue.map(e => (
                    <FollowUpRow key={`${e.source}-${e.id}`} entry={e} router={router} doctor={doctor}
                      onMarkDone={markDone}/>
                  ))}
                </Section>
              )}

              {!filterDate && viewMode !== 'missed' && (
                <>
                  <Section title="Today" count={todayF.length} color="orange" emptyMsg="No follow-ups today.">
                    {todayF.map(e => (
                      <FollowUpRow key={`${e.source}-${e.id}`} entry={e} router={router} doctor={doctor}
                        onMarkDone={markDone}/>
                    ))}
                  </Section>

                  <Section title="Tomorrow" count={tomorrowF.length} color="yellow" emptyMsg="No follow-ups tomorrow.">
                    {tomorrowF.map(e => (
                      <FollowUpRow key={`${e.source}-${e.id}`} entry={e} router={router} doctor={doctor}
                        onMarkDone={markDone}/>
                    ))}
                  </Section>

                  {upcoming.length > 0 && (
                    <Section title="Upcoming" count={upcoming.length} color="teal" emptyMsg="">
                      {upcoming.map(e => (
                        <FollowUpRow key={`${e.source}-${e.id}`} entry={e} router={router} doctor={doctor}
                          onMarkDone={markDone}/>
                      ))}
                    </Section>
                  )}
                </>
              )}

              {filterDate && (
                <Section title={`Follow-ups on ${filterDate}`} count={displayed.length} color="teal" emptyMsg="">
                  {displayed.map(e => (
                    <FollowUpRow key={`${e.source}-${e.id}`} entry={e} router={router} doctor={doctor}
                      onMarkDone={markDone}/>
                  ))}
                </Section>
              )}

              {viewMode === 'missed' && overdue.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
                  No missed follow-ups.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  )
}
