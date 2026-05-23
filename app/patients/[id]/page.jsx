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
import { isHomeopathy } from '@/lib/patientIntakePresets'
import AutoTextarea from '@/components/ui/AutoTextarea'

const ACCENT_COLORS = ['border-l-blue-500','border-l-teal-500','border-l-green-500','border-l-purple-500','border-l-orange-500']

// Renders one specialty field in view or edit mode
function ClinicalField({ field, value, onChange, editing }) {
  const { label, type, options = [] } = field
  if (!editing) {
    let display = value
    if (type === 'chips' && Array.isArray(value)) display = value.join(', ')
    if (type === 'scale') display = value != null ? `${value} / 10` : null
    return (
      <div className={type === 'textarea' ? 'sm:col-span-2' : ''}>
        <p className="form-label text-xs">{label}</p>
        <p className={`text-sm mt-0.5 ${display ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
          {display || '—'}
        </p>
      </div>
    )
  }
  if (type === 'textarea') return (
    <div className="sm:col-span-2">
      <label className="form-label">{label}</label>
      <AutoTextarea value={value || ''} onChange={e => onChange(e.target.value)} className="input-field resize"/>
    </div>
  )
  if (type === 'number') return (
    <div>
      <label className="form-label">{label}</label>
      <input type="number" min="0" value={value || ''} onChange={e => onChange(e.target.value)} className="input-field"/>
    </div>
  )
  if (type === 'scale') return (
    <div className="sm:col-span-2">
      <label className="form-label">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400 w-4">0</span>
        <input type="range" min="0" max="10" step="1" value={value ?? 0}
          onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-primary-500"/>
        <span className="text-xs text-gray-400 w-4">10</span>
        <span className={`ml-2 text-sm font-bold w-6 text-center ${(value??0)>=8?'text-red-500':(value??0)>=5?'text-amber-500':'text-green-500'}`}>{value ?? 0}</span>
      </div>
    </div>
  )
  if (type === 'chips' && options.length > 0) {
    const sel = Array.isArray(value) ? value : (value ? [value] : [])
    const toggle = opt => onChange(sel.includes(opt) ? sel.filter(s => s !== opt) : [...sel, opt])
    return (
      <div className="sm:col-span-2">
        <label className="form-label">{label}</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                sel.includes(opt) ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400'
              }`}>{opt}</button>
          ))}
        </div>
      </div>
    )
  }
  if (type === 'select' && options.length > 0) return (
    <div>
      <label className="form-label">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="input-field">
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
  return (
    <div>
      <label className="form-label">{label}</label>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="input-field"/>
    </div>
  )
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
function VisitCard({ visit, onUpdate, onDelete, patientId, patientName, linkedInvoice, blockedSlots = [], linkedFollowUp, defaultExpanded = false }) {
  const { formatCurrency, formatDate, formatDateFull } = usePreferences()
  const toast = useToast()
  const [expanded, setExpanded] = useState(defaultExpanded)
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

      {/* ── Clickable summary row ── */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Date / Time */}
        <div className="flex-shrink-0 min-w-[72px]">
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatDate(visit.visitDate)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(visit.visitDate).toLocaleTimeString('en-US', { timeStyle: 'short' })}
          </p>
        </div>

        <div className="w-px h-9 bg-gray-100 dark:bg-gray-700 flex-shrink-0"/>

        {/* Chief complaint + diagnosis chips */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {visit.chiefComplaint || <span className="italic font-normal text-gray-400 dark:text-gray-500">No chief complaint</span>}
          </p>
          {visit.diagnosis?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {visit.diagnosis.slice(0, 3).map(d => (
                <span key={d} className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                  {d}
                </span>
              ))}
              {visit.diagnosis.length > 3 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 self-center">+{visit.diagnosis.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Follow-up badge */}
        {visit.followUpDate && (
          followUpDone ? (
            <span className="flex-shrink-0 hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
              Follow-up done
            </span>
          ) : (
            <span className={`flex-shrink-0 hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              daysRemaining < 0   ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800' :
              daysRemaining === 0 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-800' :
              'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800'
            }`}>
              {daysRemaining === 0 ? 'Follow-up today' : daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `Follow-up in ${daysRemaining}d`}
            </span>
          )
        )}

        {/* Payment badge */}
        {linkedInvoice && (
          <span className={`flex-shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
            linkedInvoice.status === 'paid'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
              : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800'
          }`}>
            {formatCurrency(linkedInvoice.total)}
            {linkedInvoice.status === 'paid'
              ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
              : <span className="opacity-60 font-normal">due</span>}
          </span>
        )}

        {/* Actions — stop propagation so they don't toggle expand */}
        <div className="flex-shrink-0 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={openEdit} title="Edit visit"
            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          {onDelete && (
            <button title="Delete visit"
              onClick={() => { if (window.confirm('Delete this visit record? This cannot be undone.')) onDelete(visit.id) }}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>

        {/* Chevron */}
        <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>

      {/* ── Expandable detail body ── */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
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
      )}

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
    const templates = doctor?.waTemplates ?? {}
    const defaults = {
      followup: 'Hello {name},\n\nThis is a reminder that your follow-up at {clinic} is scheduled on *{date}*.\n\nPlease let us know if you need to reschedule.\n\nThank you!',
      missed:   'Hello {name},\n\nWe noticed your follow-up scheduled on *{date}* was {days} day(s) ago. Please visit us at {clinic} soon.\n\nThank you!',
      today:    'Hello {name},\n\nYour follow-up at {clinic} is *today*. Please visit us at your earliest convenience.\n\nThank you!',
      tomorrow: 'Hello {name},\n\nJust a reminder — your follow-up at {clinic} is *tomorrow, {date}*.\n\nThank you!',
    }
    const tmpl = templates[waKey]?.template || defaults[waKey]
    const clinicName = doctor?.clinicName || 'our clinic'
    const formattedDate = fmtDateLib(entry.dueDate, templates.dateFormat || dateFormat)
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

/* ─────────────── Collapsible Section wrapper ─────────────── */
function Section({ title, subtitle, action, accentClass, defaultOpen = true, className = '', children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 ${accentClass ? `border-l-4 ${accentClass} bg-gray-50/60 dark:bg-gray-700/30` : ''}`}>
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 hidden sm:inline">{subtitle}</span>}
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {action && <div className="flex-shrink-0 ml-3">{action}</div>}
      </div>
      {open && children}
    </div>
  )
}

/* ─────────────── Main Page ─────────────── */
export default function PatientProfilePage() {
  const { id } = useParams()
  const router  = useRouter()
  const { doctor } = useAuth()
  const specialization = doctor?.specialization ?? ''
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]               = useState(false)
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
          <button onClick={() => router.push(`/patients/${id}/edit`)}
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
          {/* Personal Details */}
          <Section title="Personal Details"><div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Date of Birth" value={patient.dateOfBirth} />
              <InfoRow label="National ID" value={patient.nationalId} />
              <InfoRow label="Registration Date" value={patient.createdAt ? formatDate(patient.createdAt.slice(0, 10)) : null} />
              {patient.patientNumber && <InfoRow label="Patient / Case No." value={`#${patient.patientNumber}`} />}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Alt Phone" value={patient.alternatePhone} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Address" value={patient.address} />
            </div>
            {patient.education     && <InfoRow label="Education"     value={patient.education} />}
            {patient.occupation    && <InfoRow label="Occupation"    value={patient.occupation} />}
            {patient.maritalStatus && <InfoRow label="Marital Status" value={patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1)} />}
            {patient.referralSource && (
              <InfoRow label="Referral Source" value={referralSources.find(r => r.value === patient.referralSource)?.label || patient.referralSource} />
            )}
            {patient.referralNotes && <InfoRow label="Referral Details" value={patient.referralNotes} />}
            {!patient.dateOfBirth && patient.ageManual && (
              <InfoRow label="Age" value={`${patient.ageManual} years (approx)`} />
            )}
          </div>
          </Section>

          <div className="space-y-4">
            <Section title="Medical Summary"><div className="p-6">

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
            </div></Section>

            <Section title="Insurance" defaultOpen={false}><div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Provider" value={patient.insuranceProvider} />
                <InfoRow label="Policy #" value={patient.insurancePolicyNumber} />
                <InfoRow label="Group #" value={patient.insuranceGroupNumber} />
                <InfoRow label="Expiry" value={patient.insuranceExpiry} />
              </div>
              {!patient.insuranceProvider && <p className="text-sm text-gray-400">No insurance details on file.</p>}
            </div></Section>

            {patient.emergencyContact?.name && (
              <Section title="Emergency Contact" defaultOpen={false}><div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Name" value={patient.emergencyContact.name} />
                  <InfoRow label="Relationship" value={patient.emergencyContact.relationship} />
                  <InfoRow label="Phone" value={patient.emergencyContact.phone} />
                </div>
              </div></Section>
            )}
          </div>
        </div>

        {isHomeopathy(specialization) ? (<>
        {/* ── History & Life Span ── */}
        <Section title="History (H/o)"><div className="p-6">
          {(patient.observation || patient.pastHistory) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <label className="form-label text-xs">Observation</label>
                <p className={`text-sm mt-1 whitespace-pre-wrap ${patient.observation ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {patient.observation || 'Not recorded'}
                </p>
              </div>
              <div>
                <label className="form-label text-xs">Past History</label>
                <p className={`text-sm mt-1 whitespace-pre-wrap ${patient.pastHistory ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {patient.pastHistory || 'Not recorded'}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="form-label text-xs mb-0">Female / Male H/o</label>
                {patient.historyOf && (
                  <button type="button" onClick={() => setHistoryExpanded(e => !e)}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    {historyExpanded ? 'Collapse' : 'Expand'}
                    <svg className={`w-3 h-3 transition-transform ${historyExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                )}
              </div>
              {patient.historyOf ? (
                <p className={`text-sm mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${historyExpanded ? '' : 'line-clamp-3'}`}>
                  {patient.historyOf}
                </p>
              ) : (
                <p className="text-sm mt-1 text-gray-400 dark:text-gray-500 italic">Not recorded</p>
              )}
            </div>
            <div>
              <label className="form-label text-xs">Life Span</label>
              <p className={`text-sm mt-1 ${patient.lifeSpan ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                {patient.lifeSpan || '—'}
              </p>
            </div>
          </div>
        </div></Section>

        {/* ── Generals ── */}
        <Section title="Generals" subtitle="Constitutional symptoms"><div className="p-6">
          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[
                  ['appetite','Appetite'],['taste','Taste'],['thirst','Thirst'],['urine','Urine'],
                  ['stool','Stool'],['thermal','Thermal'],['perspiration','Perspiration'],
                  ['speed','Speed'],['fastidious','Fastidious'],['sleep','Sleep'],['dreams','Dreams'],
                ].map(([key, label], i) => (
                  <tr key={key} className={i % 2 === 0 ? 'bg-gray-50/60 dark:bg-gray-700/20' : ''}>
                    <td className="px-4 py-3 w-40 text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm whitespace-pre-wrap ${patient.generals?.[key] ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                        {patient.generals?.[key] || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(patient.customGenerals ?? []).filter(g => g.label).map((field, i) => (
                  <tr key={field.id} className={(11 + i) % 2 === 0 ? 'bg-gray-50/60 dark:bg-gray-700/20' : ''}>
                    <td className="px-4 py-3 w-40 text-sm font-semibold text-gray-700 dark:text-gray-300">{field.label}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm whitespace-pre-wrap ${field.value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                        {field.value || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div></Section>

        {/* ── Chief Complaints ── */}
        {(patient.chiefComplaints ?? []).some(c => c.complaint) && (
          <Section title="Chief Complaints (C/o)" accentClass="border-l-blue-500">
            <div className="p-4 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                    {['Complaint (C/O)','Location (LO)','Sensation (S)','Modality (M)','Concomitant (C)'].map(h => (
                      <th key={h} className="px-2 pb-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-left uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {(patient.chiefComplaints ?? []).filter(c => c.complaint).map((row, i) => (
                    <tr key={i}>
                      {['complaint','location','sensation','modality','concomitant'].map(field => (
                        <td key={field} className="px-1.5 py-2">
                          <span className="text-sm text-gray-700 dark:text-gray-300 px-2">{row[field] || '—'}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* ── Prescription Details ── */}
        {patient.prescriptionDetails && (
          <Section title="Prescription Details" accentClass="border-l-teal-500">
            <div className="p-6">
              <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{patient.prescriptionDetails}</p>
            </div>
          </Section>
        )}

        </>) : (() => {
          const fields = doctor?.patientFormFields ?? []
          if (!fields.length) return null
          const sections = [...new Set(fields.map(f => f.section || 'Clinical Information'))]
          return sections.map((sec, si) => (
            <Section key={sec} title={sec} accentClass={ACCENT_COLORS[si % ACCENT_COLORS.length]}>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.filter(f => (f.section || 'Clinical Information') === sec).map(field => (
                    <ClinicalField
                      key={field.id}
                      field={field}
                      editing={false}
                      value={(patient.specialtyData ?? {})[field.id]}
                      onChange={() => {}}
                    />
                  ))}
                </div>
              </div>
            </Section>
          ))
        })()}

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

          {/* Completed visits — timeline */}
          {(() => {
            const completedVisits = visits.filter(v => v.status !== 'draft')
            const draftCount = visits.filter(v => v.status === 'draft').length
            if (completedVisits.length === 0 && draftCount === 0) {
              return (
                <EmptyState title="No visits recorded" description="Record a visit to start tracking this patient's medical history."
                  action={() => router.push(`/visits/new?patientId=${id}`)} actionLabel="Record Visit"/>
              )
            }
            if (completedVisits.length === 0) {
              return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No completed visits yet.</p>
            }
            return (
              <div className="relative">
                {/* Timeline spine */}
                <div className="absolute left-5 top-10 bottom-6 w-0.5 bg-gradient-to-b from-primary-300 via-gray-200 to-transparent dark:from-primary-700 dark:via-gray-700 dark:to-transparent"/>

                <div className="space-y-3">
                  {completedVisits.map((visit, idx) => (
                    <div key={visit.id} className="relative flex gap-4 items-start">
                      {/* Timeline node */}
                      <div className="relative z-10 flex-shrink-0 flex flex-col items-center pt-2.5" style={{ width: 40 }}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-gray-900 shadow-sm ${
                          idx === 0
                            ? 'bg-primary-500 dark:bg-primary-500 text-white'
                            : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                        }`}>
                          {completedVisits.length - idx}
                        </div>
                      </div>

                      {/* Card */}
                      <div className="flex-1 min-w-0">
                        <VisitCard
                          visit={visit}
                          onUpdate={updateVisit}
                          onDelete={removeVisit}
                          patientId={id}
                          patientName={`${patient.firstName} ${patient.lastName}`}
                          linkedInvoice={invoices.find(inv => inv.visitId === visit.id) ?? null}
                          blockedSlots={blockedSlots}
                          linkedFollowUp={followupByVisitId[visit.id] ?? null}
                          defaultExpanded={idx === 0}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
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
