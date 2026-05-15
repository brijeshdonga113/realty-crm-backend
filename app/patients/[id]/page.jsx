'use client'
import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { usePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { usePatientAppointments } from '@/hooks/useAppointments'
import { usePatientInvoices } from '@/hooks/useBilling'
import { useFollowUps } from '@/hooks/useFollowUps'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { useAuth } from '@/context/AuthContext'
import { getPatientAge, getPatientInitials, BLOOD_TYPES, GENDERS } from '@/models/Patient'
import { PAYMENT_METHODS } from '@/models/Invoice'
import { getBillingStatuses, buildStatusColorMap } from '@/lib/billingStatuses'
import { usePreferences } from '@/hooks/usePreferences'
import { useReferralSources } from '@/hooks/useReferralSources'
import { billingService } from '@/services/billingService'
import { patientService } from '@/services/patientService'
import { buildWAUrl, formatWAPhone } from '@/lib/whatsapp'
import { formatDate as fmtDateLib } from '@/lib/preferences'
import AutoTextarea from '@/components/ui/AutoTextarea'

function getWADateFormat(fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const s = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
    return s.dateFormat || fallback
  } catch { return fallback }
}

const WA_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

function daysBetween(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000)
}

/* ─────────────── TagInput (used in EditPatientModal) ─────────────── */
function TagInput({ label, items, onChange, suggestions = [] }) {
  const [input, setInput] = useState('')
  const add = (val) => {
    const trimmed = val.trim()
    if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed])
    setInput('')
  }
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full font-medium">
            {item}
            <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="hover:text-primary-900">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder="Type and press Enter"
          className="input-field flex-1"
          list={`tag-${label}`}
        />
        {suggestions.length > 0 && (
          <datalist id={`tag-${label}`}>{suggestions.map(s => <option key={s} value={s}/>)}</datalist>
        )}
        <button type="button" onClick={() => add(input)}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
          Add
        </button>
      </div>
    </div>
  )
}

const CONDITION_SUGGESTIONS = ['Hypertension', 'Diabetes Type 1', 'Diabetes Type 2', 'Asthma', 'COPD', 'Arthritis', 'Heart Disease', 'Thyroid Disorder', 'Cancer', 'Epilepsy', 'Depression', 'Anxiety']
const ALLERGY_SUGGESTIONS   = ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Latex', 'Pollen', 'Dust mites', 'Pet dander', 'Peanuts', 'Shellfish', 'Eggs', 'Milk']

const EDIT_TABS = ['Basic Info', 'Medical', 'Insurance', 'Emergency']

/* ─────────────── EditPatientModal ─────────────── */
function EditPatientModal({ open, onClose, patient, onSave }) {
  const referralSources = useReferralSources()
  const toast = useToast()
  const [form, setForm]   = useState(null)
  const [tab, setTab]     = useState(0)
  const [saving, setSaving] = useState(false)

  if (open && !form) { setForm({ ...patient, emergencyContact: { ...patient.emergencyContact } }); setTab(0) }
  if (!open && form) setForm(null)
  if (!open || !form) return null

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setEc  = (k, v) => setForm(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }))
  const age    = form.dateOfBirth ? getPatientAge(form) : null

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(form) } catch { toast.error('Failed to save patient. Please try again.') } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Patient" size="xl">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700 mb-4 -mt-1">
        {EDIT_TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === i
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">

        {/* ── Basic Info ── */}
        {tab === 0 && <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">First Name *</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input-field"/>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Date of Birth</label>
              <input type="date" value={form.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} className="input-field"/>
              {age !== null && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Age: {age} yrs</p>}
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Blood Type</label>
              <select value={form.bloodType || ''} onChange={e => set('bloodType', e.target.value)} className="input-field">
                <option value="">Select…</option>
                {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">National ID</label>
              <input value={form.nationalId || ''} onChange={e => set('nationalId', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Patient ID #</label>
              <input type="number" value={form.patientNumber || ''} onChange={e => set('patientNumber', Number(e.target.value))} placeholder="e.g. 2001" className="input-field font-mono font-semibold"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Registration Date</label>
              <input type="date" value={form.registrationDate || ''} onChange={e => set('registrationDate', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
                {['active','inactive','deceased'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
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
            <AutoTextarea value={form.address || ''} onChange={e => set('address', e.target.value)} className="input-field resize"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Referral Source</label>
              <select value={form.referralSource || ''} onChange={e => set('referralSource', e.target.value)} className="input-field">
                <option value="">Select source…</option>
                {referralSources.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Referral Details</label>
              <input value={form.referralNotes || ''} onChange={e => set('referralNotes', e.target.value)} placeholder="e.g. referred by Dr. Sharma…" className="input-field"/>
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <AutoTextarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="input-field resize"/>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.consentFormSigned} onChange={e => set('consentFormSigned', e.target.checked)} className="rounded border-gray-300"/>
            <span className="text-sm text-gray-700 dark:text-gray-300">Consent form signed</span>
          </label>
        </>}

        {/* ── Medical ── */}
        {tab === 1 && <>
          <TagInput label="Chronic Conditions" items={form.chronicConditions ?? []} onChange={v => set('chronicConditions', v)} suggestions={CONDITION_SUGGESTIONS}/>
          <TagInput label="Allergies" items={form.allergies ?? []} onChange={v => set('allergies', v)} suggestions={ALLERGY_SUGGESTIONS}/>
          <TagInput label="Current Medications" items={form.currentMedications ?? []} onChange={v => set('currentMedications', v)}/>
          <div>
            <label className="form-label">Family History</label>
            <AutoTextarea value={form.familyHistory || ''} onChange={e => set('familyHistory', e.target.value)} className="input-field resize" placeholder="Relevant family medical history…"/>
          </div>
        </>}

        {/* ── Insurance ── */}
        {tab === 2 && <>
          <div>
            <label className="form-label">Insurance Provider</label>
            <input value={form.insuranceProvider || ''} onChange={e => set('insuranceProvider', e.target.value)} className="input-field"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Policy Number</label>
              <input value={form.insurancePolicyNumber || ''} onChange={e => set('insurancePolicyNumber', e.target.value)} className="input-field font-mono"/>
            </div>
            <div>
              <label className="form-label">Group Number</label>
              <input value={form.insuranceGroupNumber || ''} onChange={e => set('insuranceGroupNumber', e.target.value)} className="input-field font-mono"/>
            </div>
          </div>
          <div>
            <label className="form-label">Expiry Date</label>
            <input type="date" value={form.insuranceExpiry || ''} onChange={e => set('insuranceExpiry', e.target.value)} className="input-field"/>
          </div>
        </>}

        {/* ── Emergency Contact ── */}
        {tab === 3 && <>
          <div>
            <label className="form-label">Contact Name</label>
            <input value={form.emergencyContact?.name || ''} onChange={e => setEc('name', e.target.value)} className="input-field"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Contact Phone</label>
              <input value={form.emergencyContact?.phone || ''} onChange={e => setEc('phone', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Relationship</label>
              <input value={form.emergencyContact?.relationship || ''} onChange={e => setEc('relationship', e.target.value)} placeholder="e.g. Spouse, Parent…" className="input-field"/>
            </div>
          </div>
        </>}

      </div>

      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 mt-4">
        <button onClick={onClose}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !form.firstName?.trim() || !form.lastName?.trim()}
          className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

const STATUS_COLORS = { active: 'green', inactive: 'gray', deceased: 'red' }
const APPT_COLORS   = { scheduled: 'blue', confirmed: 'green', completed: 'gray', cancelled: 'red', no_show: 'yellow' }
// INV_COLORS built dynamically from doctor.billingStatuses — see PatientPage component

const TABS = ['Overview', 'Follow-ups', 'Visits', 'Appointments', 'Billing']

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
    </div>
  )
}

/* ─────────────── VisitCard with edit + delete ─────────────── */
function VisitCard({ visit, onUpdate, onDelete, patientId, patientName, linkedInvoice, blockedSlots = [], linkedFollowUp }) {
  const { formatCurrency, formatDate, formatDateFull } = usePreferences()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [diagInput, setDiagInput] = useState('')

  const openEdit = () => {
    setEditForm({
      chiefComplaint: visit.chiefComplaint || '',
      history:        visit.history || '',
      findings:       visit.examination?.findings || '',
      diagnosis:      [...(visit.diagnosis || [])],
      treatment:      visit.treatment || '',
      notes:          visit.notes || '',
      followUpDate:   visit.followUpDate || '',
      paymentAmount:  linkedInvoice ? String(linkedInvoice.total ?? '') : '',
      paymentMethod:  linkedInvoice?.paymentMethod || 'cash',
      paymentStatus:  linkedInvoice?.status || 'paid',
    })
    setEditing(true)
  }

  const handleUpdate = async () => {
    if (!onUpdate || !editForm) return
    setSaving(true)
    try {
      await onUpdate(visit.id, {
        chiefComplaint: editForm.chiefComplaint,
        history:        editForm.history,
        examination:    { ...visit.examination, findings: editForm.findings },
        diagnosis:      editForm.diagnosis,
        treatment:      editForm.treatment,
        notes:          editForm.notes,
        followUpDate:   editForm.followUpDate || null,
      })
      if (linkedInvoice && editForm.paymentAmount) {
        await billingService.update(linkedInvoice.id, {
          total:         Number(editForm.paymentAmount),
          paymentMethod: editForm.paymentMethod,
          status:        editForm.paymentStatus,
        })
      }
      setEditing(false)
    } catch (err) {
      toast.error('Failed to update visit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const daysRemaining  = visit.followUpDate ? daysBetween(visit.followUpDate) : null
  const followUpDone   = linkedFollowUp?.status === 'done'
  const hasVitals = visit.examination?.vitalSigns && Object.values(visit.examination.vitalSigns).some(Boolean)

  const Field = ({ label, value }) => value ? (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
    </div>
  ) : null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(visit.visitDate)}</p>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(visit.visitDate).toLocaleTimeString('en-US', { timeStyle: 'short' })}
          </span>
          {visit.followUpDate && (
            followUpDone ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                Follow-up: {formatDate(visit.followUpDate)} ✓ Done
              </span>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                daysRemaining < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                daysRemaining === 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              }`}>
                Follow-up: {formatDate(visit.followUpDate)}
                {daysRemaining === 0 ? ' (Today)' : daysRemaining < 0 ? ` (${Math.abs(daysRemaining)}d overdue)` : ` (in ${daysRemaining}d)`}
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button onClick={() => { if (window.confirm('Delete this visit record? This cannot be undone.')) onDelete(visit.id) }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
          <button onClick={openEdit}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline px-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit
          </button>
        </div>
      </div>

      {/* Full visit detail — always visible */}
      <div className="p-5 space-y-4">
        <Field label="Chief Complaint" value={visit.chiefComplaint} />
        <Field label="History" value={visit.history} />

        {hasVitals && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Vital Signs</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
              {Object.entries(visit.examination.vitalSigns).map(([k, v]) => v ? (
                <div key={k}>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{v}</p>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        <Field label="Clinical Findings" value={visit.examination?.findings} />

        {visit.diagnosis?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Diagnosis</p>
            <div className="flex flex-wrap gap-1.5">
              {visit.diagnosis.map(d => <Badge key={d} label={d} color="teal"/>)}
            </div>
          </div>
        )}

        <Field label="Treatment Plan" value={visit.treatment} />

        {visit.prescriptions?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Prescriptions</p>
            <div className="space-y-2">
              {visit.prescriptions.map(rx => (
                <div key={rx.id} className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{rx.medication}</p>
                    {rx.dosage && <span className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/40 px-2 py-0.5 rounded-full">{rx.dosage}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {rx.frequency && <span>{rx.frequency}</span>}
                    {rx.duration  && <span>· {rx.duration}</span>}
                  </div>
                  {rx.instructions && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{rx.instructions}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {visit.labOrders?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Lab Orders</p>
            <div className="flex flex-wrap gap-1.5">
              {visit.labOrders.map(l => <Badge key={l} label={l} color="purple"/>)}
            </div>
          </div>
        )}

        <Field label="Notes" value={visit.notes} />

        {linkedInvoice && (
          <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
            linkedInvoice.status === 'paid'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
          }`}>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Payment</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {linkedInvoice.invoiceNumber}
                {linkedInvoice.paymentMethod && (
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2 capitalize">
                    via {linkedInvoice.paymentMethod.replace('_', ' ')}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${linkedInvoice.status === 'paid' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {formatCurrency(linkedInvoice.total)}
              </p>
              <Badge label={linkedInvoice.status} color={linkedInvoice.status === 'paid' ? 'green' : 'yellow'} />
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Visit" size="lg">
        {editing && editForm && (
          <div className="space-y-4">
            <div>
              <label className="form-label">Chief Complaint *</label>
              <input value={editForm.chiefComplaint} onChange={e => setEditForm(f => ({...f, chiefComplaint: e.target.value}))}
                className="input-field"/>
            </div>
            <div>
              <label className="form-label">History</label>
              <AutoTextarea value={editForm.history} onChange={e => setEditForm(f => ({...f, history: e.target.value}))}
                className="input-field resize"/>
            </div>
            <div>
              <label className="form-label">Clinical Findings</label>
              <AutoTextarea value={editForm.findings} onChange={e => setEditForm(f => ({...f, findings: e.target.value}))}
                className="input-field resize"/>
            </div>
            <div>
              <label className="form-label">Diagnosis</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editForm.diagnosis.map(d => (
                  <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">
                    {d}
                    <button type="button" onClick={() => setEditForm(f => ({...f, diagnosis: f.diagnosis.filter(x => x !== d)}))} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { setEditForm(f => ({...f, diagnosis: [...f.diagnosis, diagInput.trim()]})); setDiagInput('') } }}}
                  placeholder="Type and press Enter" className="input-field flex-1"/>
                <button type="button" onClick={() => { if (diagInput.trim()) { setEditForm(f => ({...f, diagnosis: [...f.diagnosis, diagInput.trim()]})); setDiagInput('') }}}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Add</button>
              </div>
            </div>
            <div>
              <label className="form-label">Treatment Plan</label>
              <AutoTextarea value={editForm.treatment} onChange={e => setEditForm(f => ({...f, treatment: e.target.value}))}
                className="input-field resize"/>
            </div>
            <div>
              <label className="form-label">Follow-up Date</label>
              <input type="date" value={editForm.followUpDate}
                onChange={e => setEditForm(f => ({...f, followUpDate: e.target.value}))}
                className="input-field"/>
              {editForm.followUpDate && blockedSlots.some(b => b.date === editForm.followUpDate) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  You are blocked on this day — consider picking another date.
                </p>
              )}
              {editForm.followUpDate && (
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                  {daysBetween(editForm.followUpDate) >= 0
                    ? `${daysBetween(editForm.followUpDate)} days from today`
                    : `${Math.abs(daysBetween(editForm.followUpDate))} days ago`}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Notes</label>
              <AutoTextarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                className="input-field resize"/>
            </div>
            {linkedInvoice && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.paymentAmount}
                      onChange={e => setEditForm(f => ({...f, paymentAmount: e.target.value}))}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="form-label">Method</label>
                    <select
                      value={editForm.paymentMethod}
                      onChange={e => setEditForm(f => ({...f, paymentMethod: e.target.value}))}
                      className="input-field"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select
                      value={editForm.paymentStatus}
                      onChange={e => setEditForm(f => ({...f, paymentStatus: e.target.value}))}
                      className="input-field"
                    >
                      <option value="paid">Paid</option>
                      <option value="draft">Unpaid</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2 border-t dark:border-gray-700">
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleUpdate} disabled={saving || !editForm.chiefComplaint.trim()}
                className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ─────────────── FollowUpRow for patient profile tab ─────────────── */
function ProfileFollowUpRow({ entry, phone, router, doctor, onMarkDone }) {
  const { formatDate, dateFormat } = usePreferences()
  const diff = daysBetween(entry.dueDate)
  const isOverdue = diff < 0
  const isToday   = diff === 0
  const waKey = isOverdue ? 'missed' : isToday ? 'today' : diff === 1 ? 'tomorrow' : 'followup'

  let badge, badgeBg
  if (isOverdue)    { badge = `${Math.abs(diff)}d overdue`; badgeBg = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
  else if (isToday) { badge = 'Today';                       badgeBg = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' }
  else if (diff===1){ badge = 'Tomorrow';                    badgeBg = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' }
  else              { badge = `in ${diff}d`;                 badgeBg = 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' }

  const sendWhatsApp = () => {
    let templates = {}
    try { templates = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}') } catch {}
    const defaults = {
      followup: 'Hello {name},\n\nThis is a reminder that your follow-up at {clinic} is scheduled on *{date}*.\n\nPlease let us know if you need to reschedule.\n\nThank you!',
      missed:   'Hello {name},\n\nWe noticed your follow-up scheduled on *{date}* was {days} day(s) ago. Please visit us at {clinic} soon.\n\nThank you!',
      today:    'Hello {name},\n\nYour follow-up at {clinic} is *today*. Please visit us at your earliest convenience.\n\nThank you!',
      tomorrow: 'Hello {name},\n\nJust a reminder — your follow-up at {clinic} is *tomorrow, {date}*.\n\nThank you!',
    }
    const tmpl = templates[waKey]?.template || defaults[waKey]
    const clinicName = doctor?.clinicName || 'our clinic'
    const formattedDate = fmtDateLib(entry.dueDate, getWADateFormat(dateFormat))
    const msg = tmpl
      .replace(/\{name\}/g, entry.patientName || 'Patient')
      .replace(/\{clinic\}/g, clinicName)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{days\}/g, String(Math.abs(diff)))
    window.open(buildWAUrl(phone || entry.phone || '', msg), '_blank')
  }

  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
      ${isOverdue ? 'border-l-4 border-red-400' : isToday ? 'border-l-4 border-orange-400' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(entry.dueDate)}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>{badge}</span>
          {entry.source === 'standalone' && (
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Reminder</span>
          )}
          {entry.source === 'visit' && (
            <span className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">Visit follow-up</span>
          )}
        </div>
        {entry.note && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{entry.note}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={sendWhatsApp}
          className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 px-2.5 py-1.5 rounded-lg transition-colors">
          {WA_ICON} Remind
        </button>
        {entry.hasRecord && entry.status === 'pending' && onMarkDone && (
          <button onClick={() => onMarkDone(entry.id)}
            className="flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2.5 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            Done
          </button>
        )}
      </div>
    </div>
  )
}

/* ─────────────── Main Page ─────────────── */
export default function PatientProfilePage() {
  const { id } = useParams()
  const router  = useRouter()
  const { doctor } = useAuth()
  const { formatCurrency, formatDate, formatDateFull } = usePreferences()
  const toast = useToast()
  const referralSources  = useReferralSources()
  const billingStatuses  = getBillingStatuses(doctor?.billingStatuses)
  const INV_COLORS       = buildStatusColorMap(billingStatuses)
  const { patient, loading, update } = usePatient(id)
  const { visits, update: updateVisit, add: addVisit, remove: removeVisit } = useVisits(id)
  const { appointments }     = usePatientAppointments(id)
  const { invoices }         = usePatientInvoices(id)
  const { followups, markDone } = useFollowUps()
  const { blockedSlots }        = useBlockedSlots()
  const [tab, setTab]            = useState(0)
  const [showEditModal, setShowEditModal]     = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const [editingOverview, setEditingOverview] = useState(false)
  const [overviewForm, setOverviewForm]       = useState({})
  const [overviewSaving, setOverviewSaving]   = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // Index follow-ups by visitId so VisitCard can reflect the done status in real time
  const followupByVisitId = useMemo(() => {
    const map = {}
    followups.forEach(f => { if (f.visitId) map[f.visitId] = f })
    return map
  }, [followups])

  // Merge follow-ups for this patient from the followups collection (includes visit-linked ones)
  // plus a fallback for older visits that predate the auto-sync (no followup record yet).
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
  const patientFollowUps = useMemo(() => {
    // Pending follow-ups from collection for display
    const fromCollection = followups
      .filter(f => f.patientId === id && f.status === 'pending')
      .map(f => ({
        id:          f.id,
        dueDate:     f.dueDate,
        note:        f.note,
        patientName: f.patientName || patientName,
        source:      f.visitId ? 'visit' : 'standalone',
        status:      f.status,
        phone:       f.phone || '',
        visitId:     f.visitId ?? null,
        hasRecord:   true,
      }))

    // Track visit IDs with ANY follow-up record (any status) so that marking a
    // visit-linked follow-up done doesn't cause the visit to re-appear via legacy.
    const syncedVisitIds = new Set(
      followups
        .filter(f => f.patientId === id && f.visitId)
        .map(f => f.visitId)
    )

    // Fallback for old visits that predate the auto-sync (no collection record yet)
    const legacy = visits
      .filter(v => v.followUpDate && !syncedVisitIds.has(v.id))
      .map(v => ({
        id:          v.id,
        dueDate:     v.followUpDate,
        note:        v.chiefComplaint,
        patientName: v.patientName || patientName,
        source:      'visit',
        status:      'pending',
        phone:       '',
        visitId:     v.id,
        hasRecord:   false,
      }))

    return [...fromCollection, ...legacy]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [visits, followups, id, patientName])

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
  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const startOverviewEdit = () => {
    setOverviewForm({
      phone:          patient.phone          || '',
      alternatePhone: patient.alternatePhone || '',
      email:          patient.email          || '',
      address:        patient.address        || '',
      education:      patient.education      || '',
      occupation:     patient.occupation     || '',
      maritalStatus:  patient.maritalStatus  || '',
      observation:    patient.observation    || '',
      pastHistory:    patient.pastHistory    || '',
      historyOf:      patient.historyOf      || '',
      lifeSpan:       patient.lifeSpan       || '',
      chiefComplaints: patient.chiefComplaints?.length
        ? patient.chiefComplaints.map(c => ({ ...c }))
        : [{ complaint: '', location: '', sensation: '', modality: '', concomitant: '' }],
      prescriptionDetails: patient.prescriptionDetails || '',
      generals: {
        appetite:     patient.generals?.appetite     || '',
        taste:        patient.generals?.taste        || '',
        thirst:       patient.generals?.thirst       || '',
        urine:        patient.generals?.urine        || '',
        stool:        patient.generals?.stool        || '',
        thermal:      patient.generals?.thermal      || '',
        perspiration: patient.generals?.perspiration || '',
        speed:        patient.generals?.speed        || '',
        fastidious:   patient.generals?.fastidious   || '',
        sleep:        patient.generals?.sleep        || '',
        dreams:       patient.generals?.dreams       || '',
      },
      customGenerals: patient.customGenerals ? [...patient.customGenerals.map(g => ({ ...g }))] : [],
      customFields:   patient.customFields   ? [...patient.customFields]                        : [],
    })
    setEditingOverview(true)
  }

  const saveOverview = async () => {
    setOverviewSaving(true)
    try {
      await update(overviewForm)   // uses usePatient's update which calls setPatient(updated)
      setEditingOverview(false)
    } catch (err) {
      toast.error('Failed to save. Please try again.')
    } finally {
      setOverviewSaving(false)
    }
  }

  const overdueFollowUps  = patientFollowUps.filter(e => e.dueDate < today)
  const todayFollowUps    = patientFollowUps.filter(e => e.dueDate === today)
  const tomorrowFollowUps = patientFollowUps.filter(e => e.dueDate === tomorrow)
  const upcomingFollowUps = patientFollowUps.filter(e => e.dueDate > tomorrow)

  const followUpDueCount = overdueFollowUps.length + todayFollowUps.length

  return (
    <AppLayout
      title="Patient Profile"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.push('/patients')}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1.5 transition-colors">
            ← Back
          </button>
          <button onClick={() => setShowEditModal(true)}
            className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit
          </button>
          <button onClick={() => setShowDeleteModal(true)}
            className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
          <button onClick={() => router.push(`/visits/new?patientId=${id}`)}
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
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
            {followUpDueCount > 0 && (
              <span className="bg-red-500/80 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {followUpDueCount} follow-up{followUpDueCount !== 1 ? 's' : ''} due
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-primary-100 text-sm">
            {age != null && <span>{age} years old</span>}
            <span className="capitalize">{patient.gender}</span>
            {patient.bloodType && <span className="font-semibold text-white">{patient.bloodType}</span>}
            {patient.phone && (
              <span className="flex items-center gap-1.5">
                📞 {patient.phone}
                {patient.phone && (
                  <a href={buildWAUrl(patient.phone)} target="_blank" rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-1 bg-green-500/80 hover:bg-green-500 px-2 py-0.5 rounded-full text-white text-xs font-medium transition-colors">
                    {WA_ICON} WhatsApp
                  </a>
                )}
              </span>
            )}
            {patient.email && <span>✉️ {patient.email}</span>}
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-2 text-right text-sm text-primary-200">
          <span>{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
          <span>{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</span>
          <span>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
          <span>{patientFollowUps.length} follow-up{patientFollowUps.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5
              ${tab === i ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t}
            {t === 'Follow-ups' && followUpDueCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {followUpDueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0: Overview */}
      {tab === 0 && (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Details — inline editable */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Personal Details</h3>
              {!editingOverview ? (
                <button onClick={startOverviewEdit}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingOverview(false)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
                  <button onClick={saveOverview} disabled={overviewSaving}
                    className="text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 px-3 py-1 rounded-lg transition-colors">
                    {overviewSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Read-only fixed fields */}
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Date of Birth" value={patient.dateOfBirth} />
              <InfoRow label="National ID" value={patient.nationalId} />
              <InfoRow label="Registration Date" value={patient.createdAt ? formatDate(patient.createdAt.slice(0, 10)) : null} />
              {patient.patientNumber && <InfoRow label="Patient / Case No." value={`#${patient.patientNumber}`} />}
            </div>

            {/* Editable fields */}
            {editingOverview ? (
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-xs">Phone</label>
                    <input value={overviewForm.phone} onChange={e => setOverviewForm(f => ({ ...f, phone: e.target.value }))}
                      className="input-field py-2 text-sm" placeholder="Phone number"/>
                  </div>
                  <div>
                    <label className="form-label text-xs">Alt Phone</label>
                    <input value={overviewForm.alternatePhone} onChange={e => setOverviewForm(f => ({ ...f, alternatePhone: e.target.value }))}
                      className="input-field py-2 text-sm" placeholder="Alternate phone"/>
                  </div>
                </div>
                <div>
                  <label className="form-label text-xs">Email</label>
                  <input type="email" value={overviewForm.email} onChange={e => setOverviewForm(f => ({ ...f, email: e.target.value }))}
                    className="input-field py-2 text-sm" placeholder="Email address"/>
                </div>
                <div>
                  <label className="form-label text-xs">Address</label>
                  <AutoTextarea value={overviewForm.address} onChange={e => setOverviewForm(f => ({ ...f, address: e.target.value }))}
                    className="input-field py-2 text-sm resize" placeholder="Address"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-xs">Education</label>
                    <input value={overviewForm.education || ''} onChange={e => setOverviewForm(f => ({ ...f, education: e.target.value }))}
                      className="input-field py-2 text-sm" placeholder="e.g. Graduate"/>
                  </div>
                  <div>
                    <label className="form-label text-xs">Occupation</label>
                    <input value={overviewForm.occupation || ''} onChange={e => setOverviewForm(f => ({ ...f, occupation: e.target.value }))}
                      className="input-field py-2 text-sm" placeholder="e.g. Engineer"/>
                  </div>
                </div>
                <div>
                  <label className="form-label text-xs">Marital Status</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {['Single','Married','Divorced','Widowed'].map(s => (
                      <button key={s} type="button"
                        onClick={() => setOverviewForm(f => ({ ...f, maritalStatus: f.maritalStatus === s.toLowerCase() ? '' : s.toLowerCase() }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          overviewForm.maritalStatus === s.toLowerCase()
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                <InfoRow label="Phone" value={patient.phone} />
                <InfoRow label="Alt Phone" value={patient.alternatePhone} />
                <InfoRow label="Email" value={patient.email} />
                <InfoRow label="Address" value={patient.address} />
              </div>
            )}

            {patient.education     && <InfoRow label="Education"     value={patient.education} />}
            {patient.occupation    && <InfoRow label="Occupation"    value={patient.occupation} />}
            {patient.maritalStatus && <InfoRow label="Marital Status" value={patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1)} />}
            {patient.referralSource && (
              <InfoRow label="Referral Source" value={referralSources.find(r => r.value === patient.referralSource)?.label || patient.referralSource} />
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

              {/* From patient record */}
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
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Current Medications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.currentMedications.map(m => <Badge key={m} label={m} color="blue"/>)}
                  </div>
                </div>
              )}

              {/* Aggregated from visits */}
              {visits.length > 0 && (() => {
                const allDiagnoses   = [...new Set(visits.flatMap(v => v.diagnosis || []).filter(Boolean))]
                const allLabOrders   = [...new Set(visits.flatMap(v => v.labOrders  || []).filter(Boolean))]
                const recentRx = visits
                  .slice(0, 3)
                  .flatMap(v => (v.prescriptions || []).map(p => p.medication).filter(Boolean))
                const uniqueRx = [...new Set(recentRx)]
                if (!allDiagnoses.length && !allLabOrders.length && !uniqueRx.length) return null
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">From Visit History</p>
                    {allDiagnoses.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Diagnoses</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allDiagnoses.map(d => <Badge key={d} label={d} color="purple"/>)}
                        </div>
                      </div>
                    )}
                    {uniqueRx.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Recent Prescriptions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueRx.map(m => <Badge key={m} label={m} color="teal"/>)}
                        </div>
                      </div>
                    )}
                    {allLabOrders.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Lab Orders</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allLabOrders.map(l => <Badge key={l} label={l} color="gray"/>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {!patient.allergies?.length && !patient.chronicConditions?.length && !patient.currentMedications?.length && !visits.length && (
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
        </div>{/* end 2-col grid */}

        {/* ── History & Life Span ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">History (H/o)</h3>
            {!editingOverview ? (
              <button onClick={startOverviewEdit}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingOverview(false)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
                <button onClick={saveOverview} disabled={overviewSaving}
                  className="text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 px-3 py-1 rounded-lg transition-colors">
                  {overviewSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
          {/* Observation + Past History */}
          {(patient.observation || patient.pastHistory || editingOverview) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <label className="form-label text-xs">Observation</label>
                {editingOverview ? (
                  <AutoTextarea value={overviewForm.observation || ''} onChange={e => setOverviewForm(f => ({ ...f, observation: e.target.value }))}
                    className="input-field text-sm resize w-full" placeholder="Doctor's initial observations…"/>
                ) : (
                  <p className={`text-sm mt-1 whitespace-pre-wrap ${patient.observation ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                    {patient.observation || 'Not recorded'}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label text-xs">Past History</label>
                {editingOverview ? (
                  <AutoTextarea value={overviewForm.pastHistory || ''} onChange={e => setOverviewForm(f => ({ ...f, pastHistory: e.target.value }))}
                    className="input-field text-sm resize w-full" placeholder="Past medical history, surgeries…"/>
                ) : (
                  <p className={`text-sm mt-1 whitespace-pre-wrap ${patient.pastHistory ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                    {patient.pastHistory || 'Not recorded'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="form-label text-xs mb-0">Female / Male H/o</label>
                {!editingOverview && patient.historyOf && (
                  <button type="button" onClick={() => setHistoryExpanded(e => !e)}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    {historyExpanded ? 'Collapse' : 'Expand'}
                    <svg className={`w-3 h-3 transition-transform ${historyExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                )}
              </div>
              {editingOverview ? (
                <AutoTextarea value={overviewForm.historyOf}
                  onChange={e => setOverviewForm(f => ({ ...f, historyOf: e.target.value }))}
                  className="input-field text-sm resize w-full" placeholder="History of present illness, past medical history…"/>
              ) : patient.historyOf ? (
                <p className={`text-sm mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${historyExpanded ? '' : 'line-clamp-3'}`}>
                  {patient.historyOf}
                </p>
              ) : (
                <p className="text-sm mt-1 text-gray-400 dark:text-gray-500 italic">Not recorded</p>
              )}
            </div>
            <div>
              <label className="form-label text-xs">Life Span</label>
              {editingOverview ? (
                <input value={overviewForm.lifeSpan}
                  onChange={e => setOverviewForm(f => ({ ...f, lifeSpan: e.target.value }))}
                  className="input-field text-sm" placeholder="e.g. 45 years"/>
              ) : (
                <p className={`text-sm mt-1 ${patient.lifeSpan ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {patient.lifeSpan || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Generals + Custom Rows ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Generals</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Constitutional symptoms · custom rows can be added below</p>
            </div>
            {!editingOverview ? (
              <button onClick={startOverviewEdit}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingOverview(false)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
                <button onClick={saveOverview} disabled={overviewSaving}
                  className="text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 px-3 py-1 rounded-lg transition-colors">
                  {overviewSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">

                {/* ── Fixed generals rows ── */}
                {[
                  ['appetite',     'Appetite'],
                  ['taste',        'Taste'],
                  ['thirst',       'Thirst'],
                  ['urine',        'Urine'],
                  ['stool',        'Stool'],
                  ['thermal',      'Thermal'],
                  ['perspiration', 'Perspiration'],
                  ['speed',        'Speed'],
                  ['fastidious',   'Fastidious'],
                  ['sleep',        'Sleep'],
                  ['dreams',       'Dreams'],
                ].map(([key, label], i) => (
                  <tr key={key} className={i % 2 === 0 ? 'bg-gray-50/60 dark:bg-gray-700/20' : ''}>
                    <td className="px-4 py-3 w-40 text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">{label}</td>
                    <td className="px-4 py-2">
                      {editingOverview ? (
                        <AutoTextarea
                          value={overviewForm.generals?.[key] ?? ''}
                          onChange={e => setOverviewForm(f => ({ ...f, generals: { ...f.generals, [key]: e.target.value } }))}
                          className="input-field text-sm py-1.5 w-full resize"
                          placeholder={`Describe ${label.toLowerCase()}…`}
                        />
                      ) : (
                        <span className={`text-sm whitespace-pre-wrap ${patient.generals?.[key] ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                          {patient.generals?.[key] || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* ── Custom generals rows ── */}
                {editingOverview
                  ? (overviewForm.customGenerals ?? []).map((field, i) => (
                      <tr key={field.id} className={(11 + i) % 2 === 0 ? 'bg-gray-50/60 dark:bg-gray-700/20' : ''}>
                        <td className="px-4 py-2 w-40">
                          <input
                            value={field.label}
                            onChange={e => setOverviewForm(f => ({
                              ...f,
                              customGenerals: f.customGenerals.map((g, j) => j === i ? { ...g, label: e.target.value } : g),
                            }))}
                            className="input-field text-sm py-1.5 w-full font-semibold"
                            placeholder="Parameter name"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <AutoTextarea
                              value={field.value}
                              onChange={e => setOverviewForm(f => ({
                                ...f,
                                customGenerals: f.customGenerals.map((g, j) => j === i ? { ...g, value: e.target.value } : g),
                              }))}
                              className="input-field text-sm py-1.5 flex-1 resize"
                              placeholder="Value"
                            />
                            <button type="button"
                              onClick={() => setOverviewForm(f => ({ ...f, customGenerals: f.customGenerals.filter((_, j) => j !== i) }))}
                              className="text-gray-400 hover:text-red-500 transition-colors text-xl leading-none flex-shrink-0">×</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : (patient.customGenerals ?? []).filter(g => g.label).map((field, i) => (
                      <tr key={field.id} className={(11 + i) % 2 === 0 ? 'bg-gray-50/60 dark:bg-gray-700/20' : ''}>
                        <td className="px-4 py-3 w-40 text-sm font-semibold text-gray-700 dark:text-gray-300">{field.label}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm whitespace-pre-wrap ${field.value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                            {field.value || '—'}
                          </span>
                        </td>
                      </tr>
                    ))
                }

                {/* ── Add row button (edit mode only) ── */}
                {editingOverview && (
                  <tr>
                    <td colSpan={2} className="px-4 py-2">
                      <button type="button"
                        onClick={() => setOverviewForm(f => ({
                          ...f,
                          customGenerals: [...(f.customGenerals ?? []), { id: `${Date.now()}`, label: '', value: '' }],
                        }))}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                        </svg>
                        Add Parameter
                      </button>
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        </div>

        {/* ── Chief Complaints ── */}
        {(editingOverview || (patient.chiefComplaints ?? []).some(c => c.complaint)) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30 border-l-4 border-l-blue-500">
              <h3 className="font-semibold text-gray-900 dark:text-white">Chief Complaints (C/o)</h3>
              {editingOverview && (
                <button type="button"
                  onClick={() => setOverviewForm(f => ({ ...f, chiefComplaints: [...(f.chiefComplaints ?? []), { complaint: '', location: '', sensation: '', modality: '', concomitant: '' }] }))}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Add Row
                </button>
              )}
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                    {['Complaint (C/O)','Location (LO)','Sensation (S)','Modality (M)','Concomitant (C)'].map(h => (
                      <th key={h} className="px-2 pb-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-left uppercase tracking-wide">{h}</th>
                    ))}
                    {editingOverview && <th className="w-8"/>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {(editingOverview ? (overviewForm.chiefComplaints ?? []) : (patient.chiefComplaints ?? []).filter(c => c.complaint)).map((row, i) => (
                    <tr key={i}>
                      {['complaint','location','sensation','modality','concomitant'].map(field => (
                        <td key={field} className="px-1.5 py-2">
                          {editingOverview ? (
                            <input value={row[field] ?? ''} onChange={e => setOverviewForm(f => {
                              const list = [...(f.chiefComplaints ?? [])]
                              list[i] = { ...list[i], [field]: e.target.value }
                              return { ...f, chiefComplaints: list }
                            })} placeholder="—" className="input-field text-sm py-2 w-full"/>
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300 px-2">{row[field] || '—'}</span>
                          )}
                        </td>
                      ))}
                      {editingOverview && (
                        <td className="px-1.5 py-2 text-center">
                          {(overviewForm.chiefComplaints ?? []).length > 1 && (
                            <button type="button"
                              onClick={() => setOverviewForm(f => ({ ...f, chiefComplaints: f.chiefComplaints.filter((_, j) => j !== i) }))}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xl leading-none transition-colors">×</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Prescription Details ── */}
        {(editingOverview || patient.prescriptionDetails) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30 border-l-4 border-l-teal-500">
              <h3 className="font-semibold text-gray-900 dark:text-white">Prescription Details</h3>
              {!editingOverview && (
                <button onClick={startOverviewEdit}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Edit
                </button>
              )}
            </div>
            <div className="p-6">
              {editingOverview ? (
                <AutoTextarea value={overviewForm.prescriptionDetails || ''} onChange={e => setOverviewForm(f => ({ ...f, prescriptionDetails: e.target.value }))}
                  className="input-field text-sm resize w-full min-h-[80px]" placeholder="Remedy, potency, dosage, repetition, diet…"/>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{patient.prescriptionDetails}</p>
              )}
            </div>
          </div>
        )}

        </div>
      )}

      {/* Tab 1: Follow-ups */}
      {tab === 1 && (
        <div className="space-y-4">
          {patientFollowUps.length === 0 ? (
            <EmptyState
              title="No follow-ups scheduled"
              description="Follow-up dates are set when recording a visit. You can also set a reminder from the patient list."
              action={() => router.push(`/visits/new?patientId=${id}`)}
              actionLabel="Record Visit with Follow-up"
            />
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Overdue',  count: overdueFollowUps.length,  color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' },
                  { label: 'Today',    count: todayFollowUps.length,    color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
                  { label: 'Tomorrow', count: tomorrowFollowUps.length, color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800' },
                  { label: 'Upcoming', count: upcomingFollowUps.length, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Overdue */}
              {overdueFollowUps.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
                    <h3 className="font-semibold text-red-700 dark:text-red-300">Overdue</h3>
                    <span className="text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-700">{overdueFollowUps.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {overdueFollowUps.map(e => <ProfileFollowUpRow key={`${e.source}-${e.id}`} entry={e} phone={patient.phone} router={router} doctor={doctor} onMarkDone={e.hasRecord ? markDone : null}/>)}
                  </div>
                </div>
              )}

              {/* Today */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Today</h3>
                  <span className="text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-700">{todayFollowUps.length}</span>
                </div>
                {todayFollowUps.length === 0
                  ? <div className="px-4 py-6 text-center text-sm text-gray-400">No follow-ups today.</div>
                  : <div className="divide-y divide-gray-50 dark:divide-gray-700">{todayFollowUps.map(e => <ProfileFollowUpRow key={`${e.source}-${e.id}`} entry={e} phone={patient.phone} router={router} doctor={doctor} onMarkDone={e.hasRecord ? markDone : null}/>)}</div>
                }
              </div>

              {/* Tomorrow */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Tomorrow</h3>
                  <span className="text-xs font-bold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2.5 py-1 rounded-full border border-yellow-200 dark:border-yellow-700">{tomorrowFollowUps.length}</span>
                </div>
                {tomorrowFollowUps.length === 0
                  ? <div className="px-4 py-6 text-center text-sm text-gray-400">No follow-ups tomorrow.</div>
                  : <div className="divide-y divide-gray-50 dark:divide-gray-700">{tomorrowFollowUps.map(e => <ProfileFollowUpRow key={`${e.source}-${e.id}`} entry={e} phone={patient.phone} router={router} doctor={doctor} onMarkDone={e.hasRecord ? markDone : null}/>)}</div>
                }
              </div>

              {/* Upcoming */}
              {upcomingFollowUps.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming</h3>
                    <span className="text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-700">{upcomingFollowUps.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {upcomingFollowUps.map(e => <ProfileFollowUpRow key={`${e.source}-${e.id}`} entry={e} phone={patient.phone} router={router} doctor={doctor} onMarkDone={e.hasRecord ? markDone : null}/>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Visits */}
      {tab === 2 && (
        <div>
          {/* Draft visits */}
          {visits.filter(v => v.status === 'draft').map(draft => (
            <div key={draft.id} className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-center gap-4">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">Draft</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {draft.chiefComplaint || 'Untitled visit'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last saved {formatDate(draft.updatedAt?.slice(0, 10) || draft.visitDate?.slice(0, 10))}
                </p>
              </div>
              <button onClick={() => router.push(`/visits/new?patientId=${id}&draftId=${draft.id}`)}
                className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors">
                Continue →
              </button>
            </div>
          ))}

          {/* Completed visits */}
          {visits.filter(v => v.status !== 'draft').length === 0 && visits.filter(v => v.status === 'draft').length === 0 ? (
            <EmptyState title="No visits recorded" description="Record a visit to start tracking this patient's medical history."
              action={() => router.push(`/visits/new?patientId=${id}`)} actionLabel="Record Visit"/>
          ) : visits.filter(v => v.status !== 'draft').length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No completed visits yet.</p>
          ) : (
            <div className="space-y-4">
              {visits.filter(v => v.status !== 'draft').map(visit => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  onUpdate={updateVisit}
                  onDelete={removeVisit}
                  patientId={id}
                  patientName={`${patient.firstName} ${patient.lastName}`}
                  linkedInvoice={invoices.find(inv => inv.visitId === visit.id) ?? null}
                  blockedSlots={blockedSlots}
                  linkedFollowUp={followupByVisitId[visit.id] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Appointments */}
      {tab === 3 && (
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

      {/* Tab 4: Billing */}
      {tab === 4 && (
        <div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="No billing history for this patient."
              action={() => router.push(`/billing/new?patientId=${id}`)} actionLabel="Create Invoice"/>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    {['Invoice #', 'Date', 'Description', 'Method', 'Amount', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/billing?invoice=${inv.id}`)}>
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-primary-600 dark:text-primary-400">{inv.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[180px] truncate">
                        {inv.lineItems?.[0]?.description || '—'}
                        {inv.lineItems?.length > 1 && <span className="text-gray-400 ml-1">+{inv.lineItems.length - 1}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">{inv.paymentMethod?.replace('_',' ') || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3">
                        <Badge label={billingStatuses.find(s => s.value === inv.status)?.label ?? inv.status} color={INV_COLORS[inv.status] ?? 'gray'}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {invoices.filter(i => i.status === 'paid').length} paid · {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} pending
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  Total: {formatCurrency(invoices.filter(i => i.status === 'paid').reduce((s,i) => s + (i.total || 0), 0))} collected
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <EditPatientModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        patient={patient}
        onSave={async (data) => {
          await update(data)
          setShowEditModal(false)
        }}
      />

      {/* Delete Patient Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Patient Record" size="sm">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
          Are you sure you want to permanently delete <span className="font-semibold text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</span>?
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mb-6">All visits, appointments, and billing records will be removed. This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button disabled={deleting} onClick={async () => {
            setDeleting(true)
            try { await patientService.remove(id); router.push('/patients') } catch { setDeleting(false) }
          }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
            {deleting ? 'Deleting…' : 'Delete Patient'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
