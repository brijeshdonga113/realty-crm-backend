'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAppointments } from '@/hooks/useAppointments'
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '@/models/Appointment'

const STATUS_COLOR = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function CalendarView({ appointments, onSelectDate, selectedDate }) {
  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)

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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Month nav */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h3 className="font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</h3>
        <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20 border-b border-r border-gray-50"/>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const dayAppts = apptsByDate[dateStr] ?? []
          const isToday  = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <div key={day}
              onClick={() => onSelectDate(dateStr)}
              className={`h-20 border-b border-r border-gray-50 p-1.5 cursor-pointer transition-colors
                ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                ${(firstDay + day - 1) % 7 === 6 ? 'border-r-0' : ''}
              `}
            >
              <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full
                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 2).map(a => (
                  <div key={a.id} className={`text-xs px-1 py-0.5 rounded font-medium truncate
                    ${a.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      a.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                      'bg-blue-100 text-blue-700'}`}>
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

export default function AppointmentsPage() {
  const router = useRouter()
  const { appointments, loading, update, remove } = useAppointments()
  const [view, setView]             = useState('list')  // 'list' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterStatus, setFilterStatus] = useState('all')
  const [changeStatusId, setChangeStatusId] = useState(null)
  const [newStatus, setNewStatus] = useState('')

  const filtered = appointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (view === 'calendar' && a.date !== selectedDate) return false
    return true
  })

  const handleStatusChange = async () => {
    if (!changeStatusId || !newStatus) return
    await update(changeStatusId, { status: newStatus })
    setChangeStatusId(null)
  }

  return (
    <AppLayout
      title="Appointments"
      action={
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {['list', 'calendar'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/appointments/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
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
          {view === 'calendar' && (
            <CalendarView
              appointments={appointments}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          <div className="flex items-center justify-between">
            {view === 'calendar' && (
              <h3 className="font-semibold text-gray-900">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'full' })}
              </h3>
            )}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="input-field w-40 ml-auto">
              <option value="all">All Statuses</option>
              {APPOINTMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={view === 'calendar' ? 'No appointments on this day' : 'No appointments yet'}
              description="Schedule an appointment to get started."
              action={() => router.push('/appointments/new')}
              actionLabel="Schedule Appointment"
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Patient', 'Date & Time', 'Type', 'Reason', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left first:pl-6 last:pr-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5 pl-6">
                        <p className="text-sm font-semibold text-gray-900">{appt.patientName}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">
                        <p className="font-medium">{appt.date}</p>
                        <p className="text-gray-400">{appt.time} · {appt.durationMinutes}min</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600 capitalize">{appt.type?.replace('_', ' ')}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">{appt.reason || '—'}</td>
                      <td className="px-4 py-3.5">
                        <Badge label={appt.status} color={STATUS_COLOR[appt.status] ?? 'gray'}/>
                      </td>
                      <td className="px-4 py-3.5 pr-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setChangeStatusId(appt.id); setNewStatus(appt.status) }}
                            className="text-xs text-blue-600 hover:underline font-medium">
                            Change
                          </button>
                          <button onClick={() => remove(appt.id)}
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
          )}
        </div>
      )}

      {/* Change status modal */}
      <Modal open={!!changeStatusId} onClose={() => setChangeStatusId(null)} title="Update Status" size="sm">
        <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input-field mb-5">
          {APPOINTMENT_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setChangeStatusId(null)}
            className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleStatusChange}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Update
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
