'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { usePatientAppointments } from '@/hooks/useAppointments'
import { usePatientInvoices } from '@/hooks/useBilling'
import { getPatientAge, getPatientInitials, BLOOD_TYPES, GENDERS } from '@/models/Patient'
import { formatCurrency } from '@/models/Invoice'

const REFERRAL_SOURCES = [
  { value: '', label: 'Select source…' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'first_visit', label: 'First Visit' },
  { value: 'patient_referral', label: 'Patient Referral' },
  { value: 'doctor_referral', label: 'Doctor Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'returning', label: 'Returning Patient' },
  { value: 'other', label: 'Other' },
]

function EditPatientModal({ open, onClose, patient, onSave }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  // Initialize form when modal opens
  if (open && !form) {
    setForm({ ...patient })
  }
  if (!open && form) {
    setForm(null)
  }

  if (!open || !form) return null

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const age = form.dateOfBirth ? getPatientAge(form) : null

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Patient" size="xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">First Name *</label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input-field" required/>
          </div>
          <div>
            <label className="form-label">Last Name *</label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input-field" required/>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="form-label">Date of Birth</label>
            <input type="date" value={form.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} className="input-field"/>
            {age !== null && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Age: {age} years</p>}
          </div>
          <div>
            <label className="form-label">Age (if no DOB)</label>
            <input type="number" min="0" max="150"
              value={form.dateOfBirth ? (age ?? '') : (form.ageManual ?? '')}
              disabled={!!form.dateOfBirth}
              onChange={e => set('ageManual', e.target.value)}
              placeholder={form.dateOfBirth ? 'Calculated' : 'Enter age'}
              className="input-field disabled:opacity-50"/>
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select value={form.gender} onChange={e => set('gender', e.target.value)} className="input-field">
              {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Blood Type</label>
            <select value={form.bloodType || ''} onChange={e => set('bloodType', e.target.value)} className="input-field">
              <option value="">Select…</option>
              {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Patient ID #</label>
            <input type="number" value={form.patientNumber || ''} onChange={e => set('patientNumber', Number(e.target.value))} placeholder="e.g. 2001" className="input-field font-mono font-semibold"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Referral Source</label>
            <select value={form.referralSource || ''} onChange={e => set('referralSource', e.target.value)} className="input-field">
              {REFERRAL_SOURCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Referral Details</label>
            <input value={form.referralNotes || ''} onChange={e => set('referralNotes', e.target.value)} placeholder="e.g. referred by Dr. Sharma…" className="input-field"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Phone *</label>
            <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Alternate Phone</label>
            <input value={form.alternatePhone || ''} onChange={e => set('alternatePhone', e.target.value)} className="input-field"/>
          </div>
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="form-label">Address</label>
          <textarea value={form.address || ''} onChange={e => set('address', e.target.value)} rows={2} className="input-field resize-none"/>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
            {['active','inactive','deceased'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className="input-field resize-none"/>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 mt-4">
        <button onClick={onClose}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
          className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

const STATUS_COLORS = { active: 'green', inactive: 'gray', deceased: 'red' }
const APPT_COLORS   = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }
const INV_COLORS    = { draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'yellow' }

const TABS = ['Overview', 'Visits', 'Appointments', 'Billing']

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
    </div>
  )
}

function VisitCard({ visit }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={() => setOpen(true)}>
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {new Date(visit.visitDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(visit.visitDate).toLocaleTimeString('en-US', { timeStyle: 'short' })}</span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{visit.chiefComplaint || 'No complaint noted'}</p>
        {visit.diagnosis?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visit.diagnosis.slice(0, 3).map(d => <Badge key={d} label={d} color="teal" />)}
          </div>
        )}
        {visit.prescriptions?.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">💊 {visit.prescriptions.length} prescription{visit.prescriptions.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Visit Record" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Visit Date" value={new Date(visit.visitDate).toLocaleString()} />
            <InfoRow label="Follow-up" value={visit.followUpDate ?? 'None'} />
          </div>
          <InfoRow label="Chief Complaint" value={visit.chiefComplaint} />
          <InfoRow label="History" value={visit.history} />
          {visit.examination?.vitalSigns && Object.values(visit.examination.vitalSigns).some(Boolean) && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Vital Signs</p>
              <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                {Object.entries(visit.examination.vitalSigns).map(([k, v]) => v ? (
                  <div key={k}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{v}</p>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
          <InfoRow label="Findings" value={visit.examination?.findings} />
          {visit.diagnosis?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Diagnosis</p>
              <div className="flex flex-wrap gap-1.5">
                {visit.diagnosis.map(d => <Badge key={d} label={d} color="teal"/>)}
              </div>
            </div>
          )}
          <InfoRow label="Treatment" value={visit.treatment} />
          {visit.prescriptions?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Prescriptions</p>
              <div className="space-y-2">
                {visit.prescriptions.map(rx => (
                  <div key={rx.id} className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{rx.medication} — {rx.dosage}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">{rx.frequency} · {rx.duration}</p>
                    {rx.instructions && <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">{rx.instructions}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {visit.labOrders?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Lab Orders</p>
              <div className="flex flex-wrap gap-1.5">
                {visit.labOrders.map(l => <Badge key={l} label={l} color="purple"/>)}
              </div>
            </div>
          )}
          <InfoRow label="Notes" value={visit.notes} />
        </div>
      </Modal>
    </>
  )
}

function AddVisitModal({ open, onClose, patientId, patientName, onSave }) {
  const { add } = useVisits(patientId)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    chiefComplaint: '', history: '', findings: '', diagnosis: [],
    treatment: '', prescriptions: [], labOrders: [], followUpDate: '',
    notes: '',
    vitalSigns: { bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '' },
  })
  const [diagInput, setDiagInput] = useState('')
  const [labInput, setLabInput]   = useState('')
  const [rx, setRx] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setVital = (k, v) => setForm(p => ({ ...p, vitalSigns: { ...p.vitalSigns, [k]: v } }))

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await add({
        patientId,
        patientName,
        visitDate: new Date().toISOString(),
        chiefComplaint: form.chiefComplaint,
        history: form.history,
        examination: { vitalSigns: form.vitalSigns, findings: form.findings },
        diagnosis: form.diagnosis,
        treatment: form.treatment,
        prescriptions: form.prescriptions,
        labOrders: form.labOrders,
        followUpDate: form.followUpDate || null,
        notes: form.notes,
      })
      onSave?.()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Visit" size="xl">
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="form-label">Chief Complaint *</label>
          <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
            placeholder="Patient's main concern" className="input-field" required/>
        </div>
        <div>
          <label className="form-label">History of Present Illness</label>
          <textarea value={form.history} onChange={e => set('history', e.target.value)} rows={2}
            placeholder="Detailed history..." className="input-field resize-none"/>
        </div>

        {/* Vitals */}
        <div>
          <p className="form-label">Vital Signs</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['bloodPressure', 'Blood Pressure', 'e.g. 120/80'],
              ['heartRate', 'Heart Rate (bpm)', 'e.g. 72'],
              ['temperature', 'Temperature (°C)', 'e.g. 36.6'],
              ['weight', 'Weight (kg)', 'e.g. 70'],
              ['height', 'Height (cm)', 'e.g. 175'],
              ['oxygenSat', 'SpO₂ (%)', 'e.g. 98'],
            ].map(([k, lbl, ph]) => (
              <div key={k}>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{lbl}</label>
                <input value={form.vitalSigns[k]} onChange={e => setVital(k, e.target.value)}
                  placeholder={ph} className="input-field text-sm py-2"/>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Clinical Findings</label>
          <textarea value={form.findings} onChange={e => set('findings', e.target.value)} rows={2}
            placeholder="Physical examination findings..." className="input-field resize-none"/>
        </div>

        {/* Diagnosis */}
        <div>
          <label className="form-label">Diagnosis</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.diagnosis.map(d => (
              <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">
                {d} <button type="button" onClick={() => set('diagnosis', form.diagnosis.filter(x => x !== d))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') } }}}
              placeholder="Type diagnosis and press Enter" className="input-field flex-1"/>
            <button type="button" onClick={() => { if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
          </div>
        </div>

        <div>
          <label className="form-label">Treatment Plan</label>
          <textarea value={form.treatment} onChange={e => set('treatment', e.target.value)} rows={2}
            placeholder="Treatment approach..." className="input-field resize-none"/>
        </div>

        {/* Prescription */}
        <div>
          <label className="form-label">Prescriptions</label>
          {form.prescriptions.map((p, i) => (
            <div key={p.id ?? i} className="flex items-start gap-2 mb-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{p.medication} — {p.dosage}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{p.frequency} · {p.duration}</p>
              </div>
              <button type="button" onClick={() => set('prescriptions', form.prescriptions.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={rx.medication} onChange={e => setRx(p => ({...p, medication: e.target.value}))}
              placeholder="Medication name" className="input-field text-sm py-2"/>
            <input value={rx.dosage} onChange={e => setRx(p => ({...p, dosage: e.target.value}))}
              placeholder="Dosage (e.g. 500mg)" className="input-field text-sm py-2"/>
            <input value={rx.frequency} onChange={e => setRx(p => ({...p, frequency: e.target.value}))}
              placeholder="Frequency (e.g. Twice daily)" className="input-field text-sm py-2"/>
            <input value={rx.duration} onChange={e => setRx(p => ({...p, duration: e.target.value}))}
              placeholder="Duration (e.g. 7 days)" className="input-field text-sm py-2"/>
          </div>
          <input value={rx.instructions} onChange={e => setRx(p => ({...p, instructions: e.target.value}))}
            placeholder="Special instructions (e.g. Take after meals)" className="input-field text-sm py-2 mb-2"/>
          <button type="button" onClick={() => {
            if (rx.medication.trim()) {
              const id = `${Date.now()}`
              set('prescriptions', [...form.prescriptions, { ...rx, id }])
              setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
            }
          }} className="text-sm text-primary-600 hover:underline font-medium">+ Add prescription</button>
        </div>

        {/* Lab Orders */}
        <div>
          <label className="form-label">Lab Orders</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.labOrders.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                {l} <button type="button" onClick={() => set('labOrders', form.labOrders.filter(x => x !== l))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={labInput} onChange={e => setLabInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') } }}}
              placeholder="Lab test name" className="input-field flex-1 text-sm py-2"/>
            <button type="button" onClick={() => { if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Follow-up Date</label>
            <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes" className="input-field"/>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            {loading ? 'Saving…' : 'Save Visit'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function PatientProfilePage() {
  const { id } = useParams()
  const router  = useRouter()
  const { patient, loading } = usePatient(id)
  const { visits, reload: reloadVisits } = useVisits(id)
  const { appointments }     = usePatientAppointments(id)
  const { invoices }         = usePatientInvoices(id)
  const [tab, setTab]            = useState(0)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [showEditModal, setShowEditModal]   = useState(false)

  if (loading) return (
    <AppLayout title="Patient Profile">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading patient…
      </div>
    </AppLayout>
  )

  if (!patient) return (
    <AppLayout title="Patient Not Found">
      <EmptyState title="Patient not found" description="This patient may have been removed." action={() => router.push('/patients')} actionLabel="Back to Patients"/>
    </AppLayout>
  )

  const age = getPatientAge(patient)

  return (
    <AppLayout
      title="Patient Profile"
      action={
        <div className="flex gap-2">
          <button onClick={() => router.push('/patients')}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-1.5 transition-colors">
            ← Back
          </button>
          <button onClick={() => setShowEditModal(true)}
            className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit Patient
          </button>
          <button onClick={() => setShowVisitModal(true)}
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Record Visit
          </button>
        </div>
      }
    >
      {/* Profile header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-6 mb-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xl">{getPatientInitials(patient)}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h2>
            <Badge label={patient.status} color={STATUS_COLORS[patient.status] ?? 'gray'} />
            {patient.patientNumber && (
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                #{patient.patientNumber}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-primary-100 text-sm">
            {age && <span>{age} years old</span>}
            <span className="capitalize">{patient.gender}</span>
            {patient.bloodType && <span className="font-semibold text-white">{patient.bloodType}</span>}
            {patient.phone && <span>📞 {patient.phone}</span>}
            {patient.email && <span>✉️ {patient.email}</span>}
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-2 text-right text-sm text-primary-200">
          <span>{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
          <span>{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</span>
          <span>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === i ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Overview */}
      {tab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Date of Birth" value={patient.dateOfBirth} />
              <InfoRow label="National ID" value={patient.nationalId} />
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Alt Phone" value={patient.alternatePhone} />
            </div>
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Address" value={patient.address} />
            {patient.referralSource && (
              <InfoRow label="Referral Source" value={REFERRAL_SOURCES.find(r => r.value === patient.referralSource)?.label || patient.referralSource} />
            )}
            {patient.referralNotes && (
              <InfoRow label="Referral Details" value={patient.referralNotes} />
            )}
            {!patient.dateOfBirth && patient.ageManual && (
              <InfoRow label="Age" value={`${patient.ageManual} years (approx)`} />
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Medical Summary</h3>
              {patient.allergies?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.allergies.map(a => <Badge key={a} label={a} color="red"/>)}
                  </div>
                </div>
              )}
              {patient.chronicConditions?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.chronicConditions.map(c => <Badge key={c} label={c} color="orange"/>)}
                  </div>
                </div>
              )}
              {patient.currentMedications?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Current Medications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.currentMedications.map(m => <Badge key={m} label={m} color="blue"/>)}
                  </div>
                </div>
              )}
              {!patient.allergies?.length && !patient.chronicConditions?.length && !patient.currentMedications?.length && (
                <p className="text-sm text-gray-400">No medical history recorded.</p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Insurance</h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Provider" value={patient.insuranceProvider} />
                <InfoRow label="Policy #" value={patient.insurancePolicyNumber} />
                <InfoRow label="Group #" value={patient.insuranceGroupNumber} />
                <InfoRow label="Expiry" value={patient.insuranceExpiry} />
              </div>
              {!patient.insuranceProvider && <p className="text-sm text-gray-400">No insurance details on file.</p>}
            </div>

            {patient.emergencyContact?.name && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Emergency Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Name" value={patient.emergencyContact.name} />
                  <InfoRow label="Relationship" value={patient.emergencyContact.relationship} />
                  <InfoRow label="Phone" value={patient.emergencyContact.phone} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Visits */}
      {tab === 1 && (
        <div>
          {visits.length === 0 ? (
            <EmptyState title="No visits recorded" description="Record a visit to start tracking this patient's medical history."
              action={() => setShowVisitModal(true)} actionLabel="Record Visit"/>
          ) : (
            <div className="space-y-4">
              {visits.map(visit => <VisitCard key={visit.id} visit={visit}/>)}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Appointments */}
      {tab === 2 && (
        <div>
          {appointments.length === 0 ? (
            <EmptyState title="No appointments" description="This patient has no appointments scheduled."
              action={() => router.push(`/appointments/new?patientId=${id}`)} actionLabel="Schedule Appointment"/>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    {['Date & Time', 'Type', 'Reason', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {appointments.map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 pl-6 text-sm font-medium text-gray-900 dark:text-white">{appt.date} {appt.time}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">{appt.type?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{appt.reason || '—'}</td>
                      <td className="px-4 py-3"><Badge label={appt.status} color={APPT_COLORS[appt.status] ?? 'gray'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Billing */}
      {tab === 3 && (
        <div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="No billing history for this patient."
              action={() => router.push(`/billing/new?patientId=${id}`)} actionLabel="Create Invoice"/>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    {['Invoice #', 'Date', 'Amount', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-primary-600 dark:text-primary-400">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{inv.issueDate}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3"><Badge label={inv.status} color={INV_COLORS[inv.status] ?? 'gray'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AddVisitModal
        open={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        patientId={id}
        patientName={`${patient.firstName} ${patient.lastName}`}
        onSave={reloadVisits}
      />

      <EditPatientModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        patient={patient}
        onSave={async (data) => {
          await update(data)
          setShowEditModal(false)
        }}
      />
    </AppLayout>
  )
}
