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
import { getPatientAge, getPatientInitials } from '@/models/Patient'
import { formatCurrency } from '@/models/Invoice'

const STATUS_COLORS = { active: 'green', inactive: 'gray', deceased: 'red' }
const APPT_COLORS   = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }
const INV_COLORS    = { draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'yellow' }

const TABS = ['Overview', 'Visits', 'Appointments', 'Billing']

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  )
}

function VisitCard({ visit }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={() => setOpen(true)}>
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">
            {new Date(visit.visitDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
          <span className="text-xs text-gray-400">{new Date(visit.visitDate).toLocaleTimeString('en-US', { timeStyle: 'short' })}</span>
        </div>
        <p className="text-sm text-gray-700 font-medium">{visit.chiefComplaint || 'No complaint noted'}</p>
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
              <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                {Object.entries(visit.examination.vitalSigns).map(([k, v]) => v ? (
                  <div key={k}>
                    <p className="text-xs text-gray-400">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-sm font-semibold text-gray-800">{v}</p>
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
                  <div key={rx.id} className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-gray-800">{rx.medication} — {rx.dosage}</p>
                    <p className="text-gray-600 text-xs">{rx.frequency} · {rx.duration}</p>
                    {rx.instructions && <p className="text-gray-500 text-xs mt-1">{rx.instructions}</p>}
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
                <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
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
              <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                {d} <button type="button" onClick={() => set('diagnosis', form.diagnosis.filter(x => x !== d))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') } }}}
              placeholder="Type diagnosis and press Enter" className="input-field flex-1"/>
            <button type="button" onClick={() => { if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">Add</button>
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
            <div key={p.id ?? i} className="flex items-start gap-2 mb-2 bg-blue-50 rounded-lg p-3 text-sm">
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{p.medication} — {p.dosage}</p>
                <p className="text-gray-500 text-xs">{p.frequency} · {p.duration}</p>
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
          }} className="text-sm text-blue-600 hover:underline font-medium">+ Add prescription</button>
        </div>

        {/* Lab Orders */}
        <div>
          <label className="form-label">Lab Orders</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.labOrders.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                {l} <button type="button" onClick={() => set('labOrders', form.labOrders.filter(x => x !== l))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={labInput} onChange={e => setLabInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') } }}}
              placeholder="Lab test name" className="input-field flex-1 text-sm py-2"/>
            <button type="button" onClick={() => { if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">Add</button>
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
            className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
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
  const { visits }           = useVisits(id)
  const { appointments }     = usePatientAppointments(id)
  const { invoices }         = usePatientInvoices(id)
  const [tab, setTab]            = useState(0)
  const [showVisitModal, setShowVisitModal] = useState(false)

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
            className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 transition-colors">
            ← Back
          </button>
          <button onClick={() => setShowVisitModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Record Visit
          </button>
        </div>
      }
    >
      {/* Profile header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 mb-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xl">{getPatientInitials(patient)}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h2>
            <Badge label={patient.status} color={STATUS_COLORS[patient.status] ?? 'gray'} />
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-blue-100 text-sm">
            {age && <span>{age} years old</span>}
            <span className="capitalize">{patient.gender}</span>
            {patient.bloodType && <span className="font-semibold text-white">{patient.bloodType}</span>}
            {patient.phone && <span>📞 {patient.phone}</span>}
            {patient.email && <span>✉️ {patient.email}</span>}
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-2 text-right text-sm text-blue-200">
          <span>{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
          <span>{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</span>
          <span>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Overview */}
      {tab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Date of Birth" value={patient.dateOfBirth} />
              <InfoRow label="National ID" value={patient.nationalId} />
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Alt Phone" value={patient.alternatePhone} />
            </div>
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Address" value={patient.address} />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Medical Summary</h3>
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

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Insurance</h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Provider" value={patient.insuranceProvider} />
                <InfoRow label="Policy #" value={patient.insurancePolicyNumber} />
                <InfoRow label="Group #" value={patient.insuranceGroupNumber} />
                <InfoRow label="Expiry" value={patient.insuranceExpiry} />
              </div>
              {!patient.insuranceProvider && <p className="text-sm text-gray-400">No insurance details on file.</p>}
            </div>

            {patient.emergencyContact?.name && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Emergency Contact</h3>
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Date & Time', 'Type', 'Reason', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appointments.map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 pl-6 text-sm font-medium text-gray-900">{appt.date} {appt.time}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{appt.type?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{appt.reason || '—'}</td>
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Invoice #', 'Date', 'Amount', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-blue-600">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{inv.issueDate}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
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
      />
    </AppLayout>
  )
}
