'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { APPOINTMENT_TYPES } from '@/models/Appointment'

function NewAppointmentForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { add }      = useAppointments()
  const { patients } = usePatients()

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
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                className={`input-field ${errors.time ? 'border-red-400' : ''}`}/>
              {errors.time && <p className="error-text">{errors.time}</p>}
            </div>
          </div>

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
