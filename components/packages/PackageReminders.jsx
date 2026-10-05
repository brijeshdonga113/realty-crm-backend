'use client'
import { useMemo, useState } from 'react'
import { buildPackageReminders } from '@/models/Package'
import { buildPackageWhatsAppMessage, buildWAUrl } from '@/lib/whatsapp'
import { formatDate as fmtDateLib, localDateStr } from '@/lib/preferences'
import { usePreferences } from '@/hooks/usePreferences'
import { EmptyState } from '@/components/ui/EmptyState'

const WA_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

function daysBetween(dateStr) {
  if (!dateStr) return 0
  const today = localDateStr()
  const a = new Date(`${today}T00:00:00`)
  const b = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

function sendWhatsApp(entry, doctor, formatCurrency, formatDate) {
  const waFmt = doctor?.waTemplates?.dateFormat
  const msg = buildPackageWhatsAppMessage(entry, {
    template: doctor?.waTemplates?.package?.template,
    clinicName: doctor?.clinicName,
    formatCurrency,
    formatDate: d => waFmt ? fmtDateLib(d, waFmt) : formatDate(d),
  })
  window.open(buildWAUrl(entry.phone || '', msg), '_blank')
}

function ReminderRow({ entry, doctor, onOpen }) {
  const { formatCurrency, formatDate } = usePreferences()
  const diff = daysBetween(entry.dueDate)
  const isOverdue = diff < 0
  const isToday = diff === 0
  const initials = (entry.patientName || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  let badge, badgeBg
  if (isOverdue)     { badge = `${Math.abs(diff)}d overdue`; badgeBg = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
  else if (isToday)  { badge = 'Today';                      badgeBg = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' }
  else if (diff === 1){ badge = 'Tomorrow';                  badgeBg = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' }
  else               { badge = `in ${diff}d`;                badgeBg = 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' }

  return (
    <div className={`flex items-start gap-3 px-5 py-3.5 group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
      ${isOverdue ? 'border-l-4 border-red-400' : isToday ? 'border-l-4 border-orange-400' : ''}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
        <span className={`font-semibold text-xs ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-primary-700 dark:text-primary-300'}`}>{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 cursor-pointer"
          onClick={() => onOpen?.(entry.packageId)}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.patientName}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(entry.dueDate)}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>{badge}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {entry.packageName} · installment #{entry.installmentNumber}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
          {formatCurrency(entry.dueAmount)} due
          {entry.remaining !== entry.dueAmount ? ` · ${formatCurrency(entry.remaining)} remaining on package` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <button onClick={() => onOpen?.(entry.packageId)}
            className="flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-2 py-1 rounded-lg transition-colors">
            Open package
          </button>
          <button onClick={() => sendWhatsApp(entry, doctor, formatCurrency, formatDate)}
            title="Send WhatsApp reminder"
            className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 px-2 py-1 rounded-lg transition-colors">
            {WA_ICON} Remind
          </button>
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

export function PackageReminders({
  packages = [],
  patients = [],
  doctor,
  loading = false,
  onOpenPackage,
  onAssign,
  viewOnly = false,
}) {
  const { formatDateFull } = usePreferences()
  const [filterDate, setFilterDate] = useState('')
  const [viewMode, setViewMode] = useState('all')

  const patientsById = useMemo(
    () => Object.fromEntries(patients.map(p => [p.id, p])),
    [patients],
  )

  const allEntries = useMemo(
    () => buildPackageReminders(packages, patientsById),
    [packages, patientsById],
  )

  const today = localDateStr()
  const tomorrow = localDateStr(1)

  const displayed = useMemo(() => {
    let list = allEntries
    if (filterDate) list = list.filter(e => e.dueDate === filterDate)
    if (viewMode === 'missed') list = list.filter(e => e.dueDate < today)
    return list
  }, [allEntries, filterDate, viewMode, today])

  const overdue = displayed.filter(e => e.dueDate < today)
  const todayE = displayed.filter(e => e.dueDate === today)
  const tomorrowE = displayed.filter(e => e.dueDate === tomorrow)
  const upcoming = displayed.filter(e => e.dueDate > tomorrow)

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading reminders…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overdue',  count: allEntries.filter(e => e.dueDate < today).length,     color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800', mode: 'missed' },
          { label: 'Today',    count: allEntries.filter(e => e.dueDate === today).length,   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', mode: 'all' },
          { label: 'Tomorrow', count: allEntries.filter(e => e.dueDate === tomorrow).length, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800', mode: 'all' },
          { label: 'Upcoming', count: allEntries.filter(e => e.dueDate > tomorrow).length,  color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800', mode: 'all' },
        ].map(s => (
          <button key={s.label} type="button"
            onClick={() => { setFilterDate(''); setViewMode(s.mode) }}
            className={`rounded-xl border p-4 text-center transition-colors ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          {[['all', 'All'], ['missed', 'Overdue only']].map(([v, l]) => (
            <button key={v} onClick={() => { setViewMode(v); setFilterDate('') }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors
                ${viewMode === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter by date:</label>
          <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setViewMode('all') }}
            className="input-field text-sm py-1.5 w-40"/>
          {filterDate && (
            <button onClick={() => setFilterDate('')}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 font-medium">
              Clear
            </button>
          )}
        </div>
      </div>

      {filterDate && (
        <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
          Showing installments due on {formatDateFull(filterDate)}
          {` (${displayed.length} result${displayed.length !== 1 ? 's' : ''})`}
        </p>
      )}

      {displayed.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <EmptyState
            title={filterDate ? 'No installments on this date' : viewMode === 'missed' ? 'No overdue installments' : 'No package reminders'}
            description={packages.length === 0
              ? 'Assign a package to a patient to start tracking installment due dates.'
              : 'Outstanding installments will appear here as they come due.'}
            action={!viewOnly && packages.length === 0 && onAssign ? onAssign : undefined}
            actionLabel="Assign Package"
          />
        </div>
      ) : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length} color="red" emptyMsg="">
              {overdue.map(e => (
                <ReminderRow key={e.id} entry={e} doctor={doctor} onOpen={onOpenPackage}/>
              ))}
            </Section>
          )}

          {!filterDate && viewMode !== 'missed' && (
            <>
              <Section title="Today" count={todayE.length} color="orange" emptyMsg="No installments due today.">
                {todayE.map(e => (
                  <ReminderRow key={e.id} entry={e} doctor={doctor} onOpen={onOpenPackage}/>
                ))}
              </Section>
              <Section title="Tomorrow" count={tomorrowE.length} color="yellow" emptyMsg="No installments due tomorrow.">
                {tomorrowE.map(e => (
                  <ReminderRow key={e.id} entry={e} doctor={doctor} onOpen={onOpenPackage}/>
                ))}
              </Section>
              {upcoming.length > 0 && (
                <Section title="Upcoming" count={upcoming.length} color="teal" emptyMsg="">
                  {upcoming.map(e => (
                    <ReminderRow key={e.id} entry={e} doctor={doctor} onOpen={onOpenPackage}/>
                  ))}
                </Section>
              )}
            </>
          )}

          {filterDate && (
            <Section title={`Due on ${filterDate}`} count={displayed.length} color="teal" emptyMsg="">
              {displayed.map(e => (
                <ReminderRow key={e.id} entry={e} doctor={doctor} onOpen={onOpenPackage}/>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

export function packageReminderDueCount(packages = []) {
  const today = localDateStr()
  return buildPackageReminders(packages).filter(e => e.dueDate <= today).length
}
