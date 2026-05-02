'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAppointments } from '@/hooks/useAppointments'
import { useAuth } from '@/context/AuthContext'
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '@/models/Appointment'
import { usePreferences } from '@/hooks/usePreferences'
import { buildWAUrl } from '@/lib/whatsapp'
import { isWhatsAppApiConnected, sendWhatsAppMessage } from '@/lib/whatsappApi'
import { formatDate as fmtDateLib } from '@/lib/preferences'

function getWADateFormat(fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const s = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
    return s.dateFormat || fallback
  } catch { return fallback }
}

const STATUS_COLOR = { scheduled: 'teal', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// formatDate is now provided by usePreferences()

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const d = new Date(); d.setHours(+h, +m)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function CalendarView({ appointments, onSelectDate, selectedDate, onAttend }) {
  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const today       = new Date().toISOString().slice(0, 10)

  const apptsByDate = useMemo(() => {
    const map = {}
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    })
    return map
  }, [appointments])

  const prev = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const next = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <button onClick={prev} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h3 className="font-semibold text-gray-900 dark:text-white">{MONTHS[calMonth]} {calYear}</h3>
        <button onClick={next} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20 border-b border-r border-gray-50 dark:border-gray-700"/>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr  = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const dayAppts = apptsByDate[dateStr] ?? []
          const isToday  = dateStr === today
          const isSel    = dateStr === selectedDate
          return (
            <div key={day} onClick={() => onSelectDate(dateStr)}
              className={`h-20 border-b border-r border-gray-50 dark:border-gray-700 p-1.5 cursor-pointer transition-colors
                ${isSel ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                ${(firstDay + day - 1) % 7 === 6 ? 'border-r-0' : ''}
              `}
            >
              <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
                ${isToday ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 2).map(a => (
                  <div key={a.id}
                    onClick={e => { e.stopPropagation(); if (['scheduled','confirmed'].includes(a.status) && a.patientId && onAttend) onAttend(a) }}
                    title={['scheduled','confirmed'].includes(a.status) && a.patientId ? 'Click to attend' : ''}
                    className={`text-xs px-1 py-0.5 rounded font-medium truncate
                    ${['scheduled','confirmed'].includes(a.status) && a.patientId ? 'cursor-pointer' : ''}
                    ${a.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      a.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                      'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}>
                    {a.time} {a.patientName.split(' ')[0]}
                  </div>
                ))}
                {dayAppts.length > 2 && (
                  <div className="text-xs text-gray-400 px-1">+{dayAppts.length - 2} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AppointmentTable({ appointments, formatDate, formatTime, router, onEdit, onRemind, onRemove, muted = false }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden overflow-x-auto ${muted ? 'border-gray-200 dark:border-gray-600 opacity-80' : 'border-gray-100 dark:border-gray-700'}`}>
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
            {['Patient', 'Date & Time', 'Type', 'Reason', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {appointments.map(appt => (
            <tr key={appt.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-4 py-3.5 pl-6">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{appt.patientName}</p>
              </td>
              <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium">{formatDate(appt.date)}</p>
                <p className="text-gray-400">{formatTime(appt.time)} · {appt.durationMinutes}min</p>
              </td>
              <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300 capitalize">{appt.type?.replace('_', ' ')}</td>
              <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-400">{appt.reason || '—'}</td>
              <td className="px-4 py-3.5">
                <Badge label={appt.status} color={STATUS_COLOR[appt.status] ?? 'gray'}/>
              </td>
              <td className="px-4 py-3.5 pr-4">
                <div className="flex items-center gap-1.5">
                  {['scheduled','confirmed'].includes(appt.status) && appt.patientId && (
                    <button
                      onClick={() => router.push(`/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&reason=${encodeURIComponent(appt.reason || '')}`)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-white dark:text-primary-300 bg-primary-50 hover:bg-primary-500 dark:bg-primary-900/30 dark:hover:bg-primary-600 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                      </svg>
                      Attend Now
                    </button>
                  )}
                  {['scheduled','confirmed'].includes(appt.status) && (
                    <button
                      onClick={() => onRemind(appt)}
                      className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 px-2 py-1 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Remind
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(appt)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium px-1"
                  >
                    Change
                  </button>
                  <button onClick={() => onRemove(appt.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AppointmentsPage() {
  const router  = useRouter()
  const { doctor } = useAuth()
  const { formatDate, formatDateFull, dateFormat } = usePreferences()
  const { appointments, loading, update, remove } = useAppointments()

  const [view, setView]                 = useState('list')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate]     = useState('')
  const [showArchive, setShowArchive]   = useState(false)
  const [editAppt, setEditAppt]         = useState(null)
  const [editForm, setEditForm]         = useState({ status: '', date: '', time: '' })
  const [remindAppt, setRemindAppt]     = useState(null)
  const [remindPhone, setRemindPhone]   = useState('')
  const [copied, setCopied]             = useState(false)
  const [apiSending, setApiSending]     = useState(false)
  const [apiResult, setApiResult]       = useState(null)

  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const cutoff   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  // Quick stats (always from all appointments)
  const todayCount     = appointments.filter(a => a.date === today && a.status !== 'cancelled').length
  const upcomingCount  = appointments.filter(a => a.date > today && ['scheduled','confirmed'].includes(a.status)).length
  const pendingCount   = appointments.filter(a => ['scheduled','confirmed'].includes(a.status)).length
  const completedToday = appointments.filter(a => a.date === today && a.status === 'completed').length

  const baseFiltered = appointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (view === 'calendar' && a.date !== selectedDate) return false
    if (view === 'list' && filterDate && a.date !== filterDate) return false
    return true
  })

  // When a specific date is selected, don't split — show everything for that date
  const splitByDate = view === 'list' && !filterDate
  const filtered         = splitByDate ? baseFiltered.filter(a => a.date >= cutoff) : baseFiltered
  const archivedFiltered = splitByDate ? baseFiltered.filter(a => a.date < cutoff)  : []

  const handleApptUpdate = async () => {
    if (!editAppt) return
    await update(editAppt.id, { status: editForm.status, date: editForm.date, time: editForm.time })
    setEditAppt(null)
  }

  // WhatsApp reminder message — uses WhatsApp Templates date format setting
  const getReminderMessage = (appt) => {
    const clinicName = doctor?.clinicName || 'our clinic'
    const waFmt = getWADateFormat(dateFormat)
    let tmpl = null
    try {
      const stored = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
      tmpl = stored.appointment?.template || null
    } catch {}
    const date = fmtDateLib(appt.date, waFmt)
    const time = formatTime(appt.time)
    if (tmpl) {
      return tmpl
        .replace(/\{name\}/g,   appt.patientName || '')
        .replace(/\{clinic\}/g, clinicName)
        .replace(/\{date\}/g,   date)
        .replace(/\{time\}/g,   time)
        .replace(/\{days\}/g,   '')
    }
    return `Hello ${appt.patientName},\n\nThis is a reminder for your appointment at ${clinicName} on *${date}* at *${time}*.\n\nPlease arrive 5 minutes early. If you need to reschedule, please contact us.\n\nThank you!`
  }

  const openRemind = (appt) => {
    setRemindAppt(appt)
    setRemindPhone(appt.patientPhone || '')
    setCopied(false)
    setApiResult(null)
  }

  const handleCopy = () => {
    if (!remindAppt) return
    navigator.clipboard.writeText(getReminderMessage(remindAppt))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    if (!remindAppt) return
    window.open(buildWAUrl(remindPhone, getReminderMessage(remindAppt)), '_blank')
  }

  const handleApiSend = async () => {
    if (!remindAppt) return
    const phone = remindPhone.trim() || remindAppt.patientPhone
    if (!phone) { setApiResult({ ok: false, msg: 'Enter a phone number first.' }); return }
    setApiSending(true)
    setApiResult(null)
    try {
      await sendWhatsAppMessage(doctor, phone, getReminderMessage(remindAppt))
      setApiResult({ ok: true, msg: 'Reminder sent successfully!' })
    } catch (err) {
      setApiResult({ ok: false, msg: err.message })
    } finally {
      setApiSending(false)
    }
  }

  return (
    <AppLayout
      title="Appointments"
      action={
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {['list', 'calendar'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors
                  ${view === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/appointments/new')}
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Schedule
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading appointments…
        </div>
      ) : (
        <div className="space-y-6">

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Today's",    value: todayCount,     sub: 'appointments', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
              { label: 'Upcoming',   value: upcomingCount,  sub: 'scheduled',    color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
              { label: 'Pending',    value: pendingCount,   sub: 'unconfirmed',  color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
              { label: 'Done Today', value: completedToday, sub: 'completed',    color: 'text-gray-600 dark:text-gray-400',     bg: 'bg-gray-50 dark:bg-gray-700/40 border-gray-100 dark:border-gray-600' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="font-semibold">{s.label}</span> {s.sub}
                </p>
              </div>
            ))}
          </div>

          {view === 'calendar' && (
            <CalendarView
              appointments={appointments}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onAttend={appt => router.push(`/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&reason=${encodeURIComponent(appt.reason || '')}`)}
            />
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            {view === 'calendar' ? (
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {formatDateFull(selectedDate)}
              </h3>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Filter by date:</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  className="input-field text-sm py-1.5 w-40"/>
                {filterDate && (
                  <button onClick={() => setFilterDate('')}
                    className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-medium">
                    Clear
                  </button>
                )}
                {filterDate && (
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    {filtered.length} appointment{filtered.length !== 1 ? 's' : ''} on {formatDate(filterDate)}
                  </span>
                )}
              </div>
            )}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="input-field w-40 ml-auto">
              <option value="all">All Statuses</option>
              {APPOINTMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 && archivedFiltered.length === 0 ? (
            <EmptyState
              title={view === 'calendar' ? 'No appointments on this day' : 'No appointments yet'}
              description="Schedule an appointment to get started."
              action={() => router.push('/appointments/new')}
              actionLabel="Schedule Appointment"
            />
          ) : (
            <>
              {filtered.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No appointments in the last 7 days or upcoming.
                </div>
              ) : (
                <AppointmentTable
                  appointments={filtered}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  router={router}
                  onEdit={(appt) => { setEditAppt(appt); setEditForm({ status: appt.status, date: appt.date, time: appt.time }) }}
                  onRemind={openRemind}
                  onRemove={remove}
                />
              )}

              {/* Archive section */}
              {archivedFiltered.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowArchive(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <svg className={`w-4 h-4 transition-transform duration-200 ${showArchive ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                      </svg>
                      Archived — older than 7 days
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">
                      {archivedFiltered.length}
                    </span>
                  </button>

                  {showArchive && (
                    <div className="mt-2">
                      <AppointmentTable
                        appointments={archivedFiltered}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        router={router}
                        onEdit={(appt) => { setEditAppt(appt); setEditForm({ status: appt.status, date: appt.date, time: appt.time }) }}
                        onRemind={openRemind}
                        onRemove={remove}
                        muted
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Update appointment modal */}
      <Modal open={!!editAppt} onClose={() => setEditAppt(null)} title="Update Appointment" size="sm">
        <div className="space-y-4 mb-5">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Time</label>
            <input type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="input-field">
              {APPOINTMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setEditAppt(null)}
            className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleApptUpdate}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            Update
          </button>
        </div>
      </Modal>

      {/* WhatsApp Remind modal */}
      <Modal open={!!remindAppt} onClose={() => setRemindAppt(null)} title="Send Appointment Reminder" size="md">
        {remindAppt && (
          <div className="space-y-5">
            {/* Patient + appt info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 dark:text-primary-300 font-bold text-xs">
                  {remindAppt.patientName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{remindAppt.patientName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(remindAppt.date)} at {formatTime(remindAppt.time)}
                </p>
              </div>
            </div>

            {/* Phone number */}
            <div>
              <label className="form-label">Patient's WhatsApp Number</label>
              <input
                type="tel"
                value={remindPhone}
                onChange={e => { setRemindPhone(e.target.value); setApiResult(null) }}
                placeholder="91XXXXXXXXXX (with country code)"
                className="input-field"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                {isWhatsAppApiConnected(doctor) ? 'Number auto-filled from patient record. Edit if needed.' : 'Enter number to send directly, or leave blank to open WhatsApp picker.'}
              </p>
            </div>

            {/* Message preview */}
            <div>
              <label className="form-label">Message Preview</label>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {getReminderMessage(remindAppt)}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={handleCopy}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors
                  ${copied
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {copied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                )}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              {isWhatsAppApiConnected(doctor) ? (
                <button onClick={handleApiSend} disabled={apiSending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                  {apiSending ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  )}
                  {apiSending ? 'Sending…' : 'Send Reminder'}
                </button>
              ) : (
                <button onClick={handleWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Open WhatsApp
                </button>
              )}
            </div>

            {apiResult && (
              <p className={`text-xs px-3 py-2 rounded-lg ${apiResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {apiResult.msg}
              </p>
            )}
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
