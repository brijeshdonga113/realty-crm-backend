'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppointments } from '@/hooks/useAppointments'
import { useFollowUps } from '@/hooks/useFollowUps'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { visitService } from '@/services/visitService'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { localDateStr } from '@/lib/preferences'

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const d = new Date(); d.setHours(+h, +m)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const LOCK_ICON = (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
  </svg>
)

const EVENT_ICON = (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
  </svg>
)

const BLANK_EVENT_FORM = { date: '', title: '', allDay: true, startTime: '09:00', endTime: '10:00', description: '' }

export default function CalendarPage() {
  const router  = useRouter()
  const { doctor } = useAuth()
  const { formatDateFull } = usePreferences()
  const { appointments } = useAppointments()
  const { followups }    = useFollowUps()
  const { blockedSlots, add: addBlock, remove: removeBlock } = useBlockedSlots()
  const { events: calEvents, add: addEvent, remove: removeEvent } = useCalendarEvents()

  const [visitFollowUps, setVisitFollowUps] = useState([])
  const [calYear,  setCalYear]  = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [filter,   setFilter]   = useState('all')
  const [selected, setSelected] = useState(() => localDateStr())

  // Block time modal state
  const [blockOpen,   setBlockOpen]   = useState(false)
  const [blockSaving, setBlockSaving] = useState(false)
  const [blockForm,   setBlockForm]   = useState({ date: '', allDay: true, startTime: '09:00', endTime: '17:00', reason: '' })

  // Add event modal state
  const [eventOpen,   setEventOpen]   = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventForm,   setEventForm]   = useState(BLANK_EVENT_FORM)

  const openBlock = () => {
    setBlockForm({ date: selected, allDay: true, startTime: '09:00', endTime: '17:00', reason: '' })
    setBlockOpen(true)
  }

  const openAddEvent = () => {
    setEventForm({ ...BLANK_EVENT_FORM, date: selected })
    setEventOpen(true)
  }

  const handleAddBlock = async () => {
    if (!blockForm.date) return
    setBlockSaving(true)
    try {
      await addBlock({
        date:      blockForm.date,
        allDay:    blockForm.allDay,
        startTime: blockForm.allDay ? '' : blockForm.startTime,
        endTime:   blockForm.allDay ? '' : blockForm.endTime,
        reason:    blockForm.reason.trim(),
      })
      setBlockOpen(false)
    } finally {
      setBlockSaving(false)
    }
  }

  const handleAddEvent = async () => {
    if (!eventForm.date || !eventForm.title.trim()) return
    setEventSaving(true)
    try {
      await addEvent({
        date:        eventForm.date,
        title:       eventForm.title.trim(),
        allDay:      eventForm.allDay,
        startTime:   eventForm.allDay ? '' : eventForm.startTime,
        endTime:     eventForm.allDay ? '' : eventForm.endTime,
        description: eventForm.description.trim(),
      })
      setEventOpen(false)
    } finally {
      setEventSaving(false)
    }
  }

  const load = useCallback(async () => {
    if (!doctor) return
    try {
      const all = await visitService.getAll()
      setVisitFollowUps(all.filter(v => v.followUpDate).map(v => ({
        id: v.id, patientId: v.patientId, patientName: v.patientName,
        date: v.followUpDate, type: 'follow_up', source: 'visit', note: v.chiefComplaint,
      })))
    } catch {}
  }, [doctor])

  useEffect(() => { load() }, [load])

  const eventsByDate = useMemo(() => {
    const map = {}
    const addEv = (dateStr, event) => {
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(event)
    }

    if (filter === 'all' || filter === 'appointments' || filter === 'new_cases') {
      appointments.forEach(a => {
        if (filter === 'new_cases' && a.type !== 'consultation') return
        addEv(a.date, { ...a, _kind: 'appointment' })
      })
    }

    if (filter === 'all' || filter === 'follow_ups') {
      followups.filter(f => f.status === 'pending').forEach(f => {
        addEv(f.dueDate, { id: f.id, patientId: f.patientId, patientName: f.patientName, time: '', note: f.note, status: f.status, _kind: 'followup' })
      })
      visitFollowUps.forEach(v => {
        addEv(v.date, { id: v.id, patientId: v.patientId, patientName: v.patientName, time: '', note: v.note, status: 'pending', _kind: 'visit_followup' })
      })
    }

    if (filter === 'all' || filter === 'events') {
      calEvents.forEach(ev => {
        addEv(ev.date, { ...ev, _kind: 'event' })
      })
    }

    // Always show blocked slots regardless of filter
    blockedSlots.forEach(b => {
      addEv(b.date, { ...b, _kind: 'blocked' })
    })

    return map
  }, [appointments, followups, visitFollowUps, blockedSlots, calEvents, filter])

  const blockedDates = useMemo(() => new Set(blockedSlots.map(b => b.date)), [blockedSlots])
  const eventDates   = useMemo(() => new Set(calEvents.map(e => e.date)), [calEvents])

  const today       = localDateStr()
  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }
  const goToday   = () => { const n = new Date(); setCalYear(n.getFullYear()); setCalMonth(n.getMonth()); setSelected(localDateStr()) }

  const selectedEvents = eventsByDate[selected] ?? []
  const selectedBlocks = selectedEvents.filter(e => e._kind === 'blocked')
  const selectedOthers = selectedEvents.filter(e => e._kind !== 'blocked')

  const kindColor = (kind, status) => {
    if (kind === 'event')        return 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
    if (kind === 'followup' || kind === 'visit_followup') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
    if (status === 'cancelled')  return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    if (status === 'completed')  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
  }

  return (
    <AppLayout
      title="Calendar"
      action={
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {[['all','All'],['appointments','Appointments'],['follow_ups','Follow-ups'],['new_cases','New Cases'],['events','Events']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors
                  ${filter === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Today
          </button>
          <button onClick={openAddEvent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-lg transition-colors">
            {EVENT_ICON}
            Add Event
          </button>
          <button onClick={openBlock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors">
            {LOCK_ICON}
            Block Time
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Calendar grid */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-white">{MONTHS[calMonth]} {calYear}</h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="h-24 border-b border-r border-gray-50 dark:border-gray-700"/>
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr    = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayEvents  = eventsByDate[dateStr] ?? []
              const isToday    = dateStr === today
              const isSel      = dateStr === selected
              const isBlocked  = blockedDates.has(dateStr)
              const hasEvent   = eventDates.has(dateStr)
              const apptCount  = dayEvents.filter(e => e._kind === 'appointment').length
              const fuCount    = dayEvents.filter(e => e._kind === 'followup' || e._kind === 'visit_followup').length
              const evCount    = dayEvents.filter(e => e._kind === 'event').length
              return (
                <div key={day} onClick={() => setSelected(dateStr)}
                  className={`h-24 border-b border-r border-gray-50 dark:border-gray-700 p-1.5 cursor-pointer transition-colors
                    ${isSel     ? 'bg-primary-50 dark:bg-primary-900/20'   : ''}
                    ${isBlocked && !isSel ? 'bg-red-50/60 dark:bg-red-900/10' : ''}
                    ${!isSel && !isBlocked ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''}
                    ${(firstDay + day - 1) % 7 === 6 ? 'border-r-0' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
                      ${isToday ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {day}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {hasEvent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" title="Has events"/>
                      )}
                      {isBlocked && (
                        <svg className="w-3 h-3 text-red-400 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {isBlocked && (
                      <div className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 py-0.5 rounded font-medium truncate">
                        Blocked
                      </div>
                    )}
                    {apptCount > 0 && (
                      <div className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1 py-0.5 rounded font-medium truncate">
                        {apptCount} appt{apptCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {fuCount > 0 && (
                      <div className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1 py-0.5 rounded font-medium truncate">
                        {fuCount} follow-up{fuCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {evCount > 0 && (
                      <div className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1 py-0.5 rounded font-medium truncate">
                        {evCount} event{evCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{formatDateFull(selected)}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {selectedOthers.length} event{selectedOthers.length !== 1 ? 's' : ''}
              {selectedBlocks.length > 0 && <span className="ml-1.5 text-red-500 dark:text-red-400">· {selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">

            {/* Blocked slots shown at top */}
            {selectedBlocks.map(b => (
              <div key={b.id} className="px-5 py-3 bg-red-50/60 dark:bg-red-900/10 flex items-start gap-3">
                <div className="text-red-400 dark:text-red-500 mt-0.5">{LOCK_ICON}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {b.allDay ? 'Full Day Blocked' : `${formatTime(b.startTime)} – ${formatTime(b.endTime)}`}
                  </p>
                  {b.reason && <p className="text-xs text-red-500 dark:text-red-500 truncate">{b.reason}</p>}
                </div>
                <button onClick={() => removeBlock(b.id)}
                  title="Remove block"
                  className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}

            {selectedOthers.length === 0 && selectedBlocks.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No events on this day</p>
                <div className="flex flex-col items-center gap-1 mt-3">
                  <button onClick={() => router.push('/appointments/new')}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    + Schedule Appointment
                  </button>
                  <button onClick={openAddEvent}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium">
                    + Add Event
                  </button>
                </div>
              </div>
            ) : (
              selectedOthers
                .sort((a,b) => (a.time||a.startTime||'').localeCompare(b.time||b.startTime||''))
                .map((e, idx) => {
                  const isFollowUp = e._kind === 'followup' || e._kind === 'visit_followup'
                  const isEvent    = e._kind === 'event'
                  const canAttend  = e._kind === 'appointment' && ['scheduled','confirmed'].includes(e.status) && e.patientId
                  return (
                    <div key={`${e._kind}-${e.id}-${idx}`}
                      className={`px-5 py-3.5 transition-colors ${isEvent ? 'bg-violet-50/40 dark:bg-violet-900/5 hover:bg-violet-50 dark:hover:bg-violet-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          isEvent    ? 'bg-violet-500' :
                          isFollowUp ? 'bg-orange-400' :
                          e.status === 'completed' ? 'bg-gray-400' : 'bg-primary-500'
                        }`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {isEvent ? e.title : e.patientName}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kindColor(e._kind, e.status)}`}>
                              {isEvent ? 'Event' : isFollowUp ? 'Follow-up' : e.type?.replace('_',' ') || 'Appointment'}
                            </span>
                          </div>
                          {isEvent ? (
                            <>
                              {!e.allDay && e.startTime && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatTime(e.startTime)}{e.endTime ? ` – ${formatTime(e.endTime)}` : ''}
                                </p>
                              )}
                              {e.allDay && <p className="text-xs text-violet-500 dark:text-violet-400">All day</p>}
                              {e.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{e.description}</p>}
                              <button onClick={() => removeEvent(e.id)}
                                className="mt-1.5 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:underline">
                                Remove event
                              </button>
                            </>
                          ) : (
                            <>
                              {e.time && <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(e.time)}</p>}
                              {(e.note || e.reason) && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.note || e.reason}</p>}
                              {canAttend && (
                                <button onClick={() => router.push(`/visits/new?patientId=${e.patientId}&appointmentId=${e.id}&reason=${encodeURIComponent(e.reason||'')}`)
                                } className="mt-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-2 py-0.5 rounded-lg transition-colors">
                                  Attend Now →
                                </button>
                              )}
                              {e.patientId && (
                                <button onClick={() => router.push(`/patients/${e.patientId}`)}
                                  className="mt-1 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">
                                  View profile
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
            <button onClick={() => router.push(`/appointments/new`)}
              className="w-full py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
              + Schedule Appointment
            </button>
            <button onClick={openAddEvent}
              className="w-full py-2 text-sm font-medium text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              {EVENT_ICON} Add Event
            </button>
            <button onClick={openBlock}
              className="w-full py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              {LOCK_ICON} Block This Day
            </button>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {eventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setEventOpen(false)}/>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center text-violet-600 dark:text-violet-400">
                  {EVENT_ICON}
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Event</h2>
              </div>
              <button onClick={() => setEventOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div>
              <label className="form-label">Event Title <span className="text-red-500">*</span></label>
              <input type="text" value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Team meeting, Patient birthday, Conference…"
                className="input-field"/>
            </div>

            <div>
              <label className="form-label">Date <span className="text-red-500">*</span></label>
              <input type="date" value={eventForm.date}
                onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                className="input-field"/>
            </div>

            <div>
              <label className="form-label">Duration</label>
              <div className="flex gap-3">
                {[{ v: true, l: 'All Day' }, { v: false, l: 'Specific Hours' }].map(({ v, l }) => (
                  <button key={String(v)} type="button"
                    onClick={() => setEventForm(f => ({ ...f, allDay: v }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${eventForm.allDay === v
                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {!eventForm.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">From</label>
                  <input type="time" value={eventForm.startTime}
                    onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))}
                    className="input-field"/>
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input type="time" value={eventForm.endTime}
                    onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))}
                    className="input-field"/>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={eventForm.description}
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add a note or details…"
                className="input-field"/>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEventOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAddEvent}
                disabled={!eventForm.date || !eventForm.title.trim() || eventSaving}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                {eventSaving
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                  : <>{EVENT_ICON} Save Event</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Time Modal */}
      {blockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setBlockOpen(false)}/>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400">
                  {LOCK_ICON}
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Block Time</h2>
              </div>
              <button onClick={() => setBlockOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div>
              <label className="form-label">Date</label>
              <input type="date" value={blockForm.date}
                onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                className="input-field"/>
            </div>

            <div>
              <label className="form-label">Block type</label>
              <div className="flex gap-3">
                {[{ v: true, l: 'Full Day' }, { v: false, l: 'Specific Hours' }].map(({ v, l }) => (
                  <button key={String(v)} type="button"
                    onClick={() => setBlockForm(f => ({ ...f, allDay: v }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${blockForm.allDay === v
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {!blockForm.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">From</label>
                  <input type="time" value={blockForm.startTime}
                    onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))}
                    className="input-field"/>
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input type="time" value={blockForm.endTime}
                    onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))}
                    className="input-field"/>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={blockForm.reason}
                onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Out of office, Surgery day, Conference…"
                className="input-field"/>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setBlockOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAddBlock} disabled={!blockForm.date || blockSaving}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                {blockSaving
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                  : <>{LOCK_ICON} Block Time</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
