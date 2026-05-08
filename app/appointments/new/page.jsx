'use client'
import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { useAuth } from '@/context/AuthContext'
import { APPOINTMENT_TYPES } from '@/models/Appointment'
import { generateSlotsFromWorkingHours, normalizeWorkingHours } from '@/lib/booking'

function toMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

function NewAppointmentForm() {
  const router            = useRouter()
  const searchParams      = useSearchParams()
  const { doctor }            = useAuth()
  const { add, appointments } = useAppointments()
  const { patients }          = usePatients()
  const { blockedSlots }      = useBlockedSlots()

  const availableSlots = useMemo(() => {
    const wh = normalizeWorkingHours(doctor?.workingHours ?? {})
    return generateSlotsFromWorkingHours(wh)
  }, [doctor?.workingHours])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({
    patientId:       searchParams.get('patientId') ?? '',
    date:            new Date().toISOString().slice(0, 10),
    time:            '09:00',
    durationMinutes: '30',
    type:            'consultation',
    reason:          '',
    notes:           '',
    status:          'scheduled',
  })

  const selectedPatient = patients.find(p => p.id === form.patientId)

  const clashes = useMemo(() => {
    if (!form.date || !form.time) return []
    const newStart = toMins(form.time)
    const newEnd   = newStart + (Number(form.durationMinutes) || 30)
    return appointments.filter(a => {
      if (a.date !== form.date) return false
      if (a.status === 'cancelled') return false
      const aStart = toMins(a.time || '00:00')
      const aEnd   = aStart + (Number(a.durationMinutes) || 30)
      return newStart < aEnd && newEnd > aStart
    })
  }, [appointments, form.date, form.time, form.durationMinutes])

  const activeBlock = useMemo(() => {
    if (!form.date) return null
    return blockedSlots.find(b => {
      if (b.date !== form.date) return false
      if (b.allDay) return true
      if (!form.time) return false
      const newStart = toMins(form.time)
      const newEnd   = newStart + (Number(form.durationMinutes) || 30)
      return newStart < toMins(b.endTime) && newEnd > toMins(b.startTime)
    }) ?? null
  }, [blockedSlots, form.date, form.time, form.durationMinutes])

  const set = (k, v) => { setForm(p => ({...p, [k]: v})); setErrors(e => ({...e, [k]: ''})) }

  const validate = () => {
    const errs = {}
    if (!form.patientId) errs.patientId = 'Please select a patient'
    if (!form.date)      errs.date      = 'Required'
    if (!form.time)      errs.time      = 'Required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setSaveError('')
    try {
      await add({
        ...form,
        patientName:  selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : '',
        patientPhone: selectedPatient?.phone ?? '',
        durationMinutes: Number(form.durationMinutes),
      })
      router.push('/appointments')
    } catch (err) {
      setSaveError(err?.message || 'Failed to save appointment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout title="Schedule Appointment"
      action={
        <button onClick={() => router.back()} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">
          ← Back
        </button>
      }
    >
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">

          {/* Patient */}
          <div>
            <label className="form-label">Patient <span className="text-red-500">*</span></label>
            <select value={form.patientId} onChange={e => set('patientId', e.target.value)}
              className={`input-field ${errors.patientId ? 'border-red-400' : ''}`}>
              <option value="">Select patient…</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.phone}</option>
              ))}
            </select>
            {errors.patientId && <p className="error-text">{errors.patientId}</p>}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className={`input-field ${errors.date ? 'border-red-400' : ''}`}/>
              {errors.date && <p className="error-text">{errors.date}</p>}
            </div>
            <div>
              <label className="form-label">Time <span className="text-red-500">*</span></label>
              {availableSlots.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto pr-1">
                  {availableSlots.map(t => (
                    <button key={t} type="button" onClick={() => set('time', t)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                        form.time === t
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500'
                      }`}>
                      {fmt12(t)}
                    </button>
                  ))}
                </div>
              )}
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                className={`input-field ${errors.time ? 'border-red-400' : ''}`}/>
              {errors.time && <p className="error-text">{errors.time}</p>}
            </div>
          </div>

          {/* Blocked time warning */}
          {activeBlock && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                {activeBlock.allDay ? 'This entire day is blocked' : `Blocked ${fmt12(activeBlock.startTime)} – ${fmt12(activeBlock.endTime)}`}
              </p>
              {activeBlock.reason && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-6">{activeBlock.reason}</p>
              )}
              <p className="text-xs text-red-500 dark:text-red-500 mt-1.5 ml-6">You are marked unavailable at this time. Remove the block from the calendar to allow bookings.</p>
            </div>
          )}

          {/* Clash warning */}
          {clashes.length > 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                ⚠ {clashes.length} appointment{clashes.length > 1 ? 's' : ''} already scheduled in this slot
              </p>
              <ul className="space-y-1">
                {clashes.map(a => {
                  const aStart = fmt12(a.time)
                  const aEndMins = toMins(a.time) + (Number(a.durationMinutes) || 30)
                  const aEnd = fmt12(`${String(Math.floor(aEndMins / 60)).padStart(2,'0')}:${String(aEndMins % 60).padStart(2,'0')}`)
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span className="font-medium">{a.patientName}</span>
                      <span className="text-amber-500 dark:text-amber-500">·</span>
                      <span>{aStart} – {aEnd}</span>
                      {a.type && <span className="text-xs text-amber-500 dark:text-amber-500 capitalize">({a.type})</span>}
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">You can still save — adjust time or duration to avoid overlap.</p>
            </div>
          )}

          {/* Type + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Appointment Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field">
                {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select value={form.durationMinutes} onChange={e => set('durationMinutes', e.target.value)} className="input-field">
                {[15, 20, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="form-label">Reason for Visit</label>
            <input value={form.reason} onChange={e => set('reason', e.target.value)}
              placeholder="e.g. Routine checkup, Follow-up for hypertension…" className="input-field"/>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes…" rows={2} className="input-field resize-none"/>
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary w-auto px-6">
              {loading ? 'Scheduling…' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default function NewAppointmentPage() {
  return (
    <Suspense>
      <NewAppointmentForm />
    </Suspense>
  )
}
