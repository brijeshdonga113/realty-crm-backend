'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppointments } from '@/hooks/useAppointments'
import { useFollowUps } from '@/hooks/useFollowUps'
import { visitService } from '@/services/visitService'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const d = new Date(); d.setHours(+h, +m)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function CalendarPage() {
  const router  = useRouter()
  const { doctor } = useAuth()
  const { formatDateFull } = usePreferences()
  const { appointments } = useAppointments()
  const { followups }    = useFollowUps()

  const [visitFollowUps, setVisitFollowUps] = useState([])
  const [calYear,  setCalYear]  = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [filter,   setFilter]   = useState('all')  // all | appointments | follow_ups | new_cases
  const [selected, setSelected] = useState(new Date().toISOString().slice(0,10))

  const load = useCallback(async () => {
    if (!doctor) return
    try {
      const all = await visitService.getAll()
      setVisitFollowUps(all.filter(v => v.followUpDate).map(v => ({
        id:          v.id,
        patientId:   v.patientId,
        patientName: v.patientName,
        date:        v.followUpDate,
        type:        'follow_up',
        source:      'visit',
        note:        v.chiefComplaint,
      })))
    } catch {}
  }, [doctor])

  useEffect(() => { load() }, [load])

  // Unified events map by date
  const eventsByDate = useMemo(() => {
    const map = {}
    const addEvent = (dateStr, event) => {
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(event)
    }

    if (filter === 'all' || filter === 'appointments' || filter === 'new_cases') {
      appointments.forEach(a => {
        if (filter === 'new_cases' && a.type !== 'consultation') return
        addEvent(a.date, { ...a, _kind: 'appointment' })
      })
    }

    if (filter === 'all' || filter === 'follow_ups') {
      followups.filter(f => f.status === 'pending').forEach(f => {
        addEvent(f.dueDate, { id: f.id, patientId: f.patientId, patientName: f.patientName, time: '', note: f.note, status: f.status, _kind: 'followup' })
      })
      visitFollowUps.forEach(v => {
        addEvent(v.date, { id: v.id, patientId: v.patientId, patientName: v.patientName, time: '', note: v.note, status: 'pending', _kind: 'visit_followup' })
      })
    }

    return map
  }, [appointments, followups, visitFollowUps, filter])

  const today      = new Date().toISOString().slice(0, 10)
  const firstDay   = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }
  const goToday   = () => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setSelected(today) }

  const selectedEvents = eventsByDate[selected] ?? []

  const kindColor = (kind, status) => {
    if (kind === 'followup' || kind === 'visit_followup') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
    if (status === 'cancelled') return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    if (status === 'completed') return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
  }

  return (
    <AppLayout
      title="Calendar"
      action={
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {[['all','All'],['appointments','Appointments'],['follow_ups','Follow-ups'],['new_cases','New Cases']].map(([v,l]) => (
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
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Calendar grid */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Header */}
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

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="h-24 border-b border-r border-gray-50 dark:border-gray-700"/>
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const events   = eventsByDate[dateStr] ?? []
              const isToday  = dateStr === today
              const isSel    = dateStr === selected
              const apptCount = events.filter(e => e._kind === 'appointment').length
              const fuCount   = events.filter(e => e._kind === 'followup' || e._kind === 'visit_followup').length
              return (
                <div key={day} onClick={() => setSelected(dateStr)}
                  className={`h-24 border-b border-r border-gray-50 dark:border-gray-700 p-1.5 cursor-pointer transition-colors
                    ${isSel ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}
                    ${(firstDay + day - 1) % 7 === 6 ? 'border-r-0' : ''}`}>
                  <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
                    ${isToday ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {formatDateFull(selected)}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
            {selectedEvents.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No events on this day</p>
                <button onClick={() => router.push('/appointments/new')}
                  className="mt-3 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                  + Schedule Appointment
                </button>
              </div>
            ) : (
              selectedEvents
                .sort((a,b) => (a.time||'').localeCompare(b.time||''))
                .map((e, idx) => {
                  const isFollowUp = e._kind === 'followup' || e._kind === 'visit_followup'
                  const canAttend  = e._kind === 'appointment' && ['scheduled','confirmed'].includes(e.status) && e.patientId
                  const initials   = (e.patientName||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?'
                  return (
                    <div key={`${e._kind}-${e.id}-${idx}`} className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isFollowUp ? 'bg-orange-400' : e.status === 'completed' ? 'bg-gray-400' : 'bg-primary-500'}`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{e.patientName}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kindColor(e._kind, e.status)}`}>
                              {isFollowUp ? 'Follow-up' : e.type?.replace('_',' ') || 'Appointment'}
                            </span>
                          </div>
                          {e.time && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(e.time)}</p>
                          )}
                          {(e.note || e.reason) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.note || e.reason}</p>
                          )}
                          {canAttend && (
                            <button
                              onClick={() => router.push(`/visits/new?patientId=${e.patientId}&appointmentId=${e.id}&reason=${encodeURIComponent(e.reason||'')}`)}
                              className="mt-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 px-2 py-0.5 rounded-lg transition-colors">
                              Attend Now →
                            </button>
                          )}
                          {e.patientId && (
                            <button onClick={() => router.push(`/patients/${e.patientId}`)}
                              className="mt-1 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline block">
                              View profile
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={() => router.push('/appointments/new')}
              className="w-full py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
              + Schedule Appointment
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
