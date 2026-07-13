'use client'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { usePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { useProgressNotes } from '@/hooks/useProgressNotes'
import { usePatientAppointments } from '@/hooks/useAppointments'
import { usePatientInvoices } from '@/hooks/useBilling'
import { useFollowUps } from '@/hooks/useFollowUps'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { useAuth } from '@/context/AuthContext'
import { getAuthToken } from '@/lib/clientAuth'
import { getPatientAge, getPatientInitials, BLOOD_TYPES, GENDERS } from '@/models/Patient'
import { PAYMENT_METHODS, COLLECTED_BY_OPTIONS } from '@/models/Invoice'
import { getBillingStatuses, buildStatusColorMap } from '@/lib/billingStatuses'
import { usePreferences } from '@/hooks/usePreferences'
import { useReferralSources } from '@/hooks/useReferralSources'
import { billingService } from '@/services/billingService'
import { patientService } from '@/services/patientService'
import { buildWAUrl, formatWAPhone } from '@/lib/whatsapp'
import { formatDate as fmtDateLib, localDateStr } from '@/lib/preferences'
import { isHomeopathy, getIntakeSections } from '@/lib/patientIntakePresets'
import { dataStore } from '@/lib/dataStore'
import AutoTextarea from '@/components/ui/AutoTextarea'
import RichTextEditor from '@/components/ui/RichTextEditor'

const ACCENT_COLORS = ['border-l-blue-500','border-l-teal-500','border-l-green-500','border-l-purple-500','border-l-orange-500']

// Renders one specialty field in view or edit mode
function ClinicalField({ field, value, onChange, editing }) {
  const { label, type, options = [] } = field
  const isHtml = v => typeof v === 'string' && /<[a-z][\s\S]*>/i.test(v)
  if (!editing) {
    let display = value
    if (type === 'chips' && Array.isArray(value)) display = value.join(', ')
    if (type === 'scale') display = value != null ? `${value} / 10` : null
    return (
      <div className={type === 'textarea' ? 'sm:col-span-2' : ''}>
        <p className="form-label">{label}</p>
        {display
          ? (type === 'textarea' && isHtml(display)
              ? <div className="rich-text-view text-sm mt-0.5 text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: display }}/>
              : <p className={`text-sm mt-0.5 whitespace-pre-wrap text-gray-700 dark:text-gray-300`}>{display}</p>)
          : <p className="text-sm mt-0.5 text-gray-400 dark:text-gray-500 italic">—</p>
        }
      </div>
    )
  }
  if (type === 'textarea') return (
    <div className="sm:col-span-2">
      <label className="form-label">{label}</label>
      <RichTextEditor value={value || ''} onChange={onChange} placeholder=""/>
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
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
    </div>
  )
}

/* ─────────────── VisitCard with edit + delete ─────────────── */
function VisitCard({ visit, onUpdate, onDelete, patientId, patientName, linkedInvoice, blockedSlots = [], linkedFollowUp, defaultExpanded = false }) {
  const { formatCurrency, formatDate, formatDateFull } = usePreferences()
  const { doctor } = useAuth()
  const toast = useToast()
  const router = useRouter()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [diagInput, setDiagInput] = useState('')

  const openEdit = () => {
    router.push(`/visits/new?patientId=${patientId}&editVisitId=${visit.id}`)
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

  const isHtml = v => typeof v === 'string' && v.trimStart().startsWith('<')
  const Field = ({ label, value }) => value ? (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      {isHtml(value)
        ? <div className="rich-text-view" dangerouslySetInnerHTML={{ __html: value }}/>
        : <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
      }
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
            {visit.createdAt ? new Date(visit.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short' }) : ''}
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
          {!doctor?.viewOnly && (
            <button onClick={openEdit} title="Edit visit"
              className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          )}
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
              <RichTextEditor value={editForm.history || ''} onChange={v => setEditForm(f => ({...f, history: v}))}
                placeholder="Detailed history, existing conditions, onset, duration…"/>
            </div>
            <div>
              <label className="form-label">Clinical Findings</label>
              <RichTextEditor value={editForm.findings || ''} onChange={v => setEditForm(f => ({...f, findings: v}))}
                placeholder="Examination findings…"/>
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
              <RichTextEditor value={editForm.treatment || ''} onChange={v => setEditForm(f => ({...f, treatment: v}))}
                placeholder="Treatment plan, medication, advice…"/>
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
              <RichTextEditor value={editForm.notes || ''} onChange={v => setEditForm(f => ({...f, notes: v}))}
                placeholder="Additional notes…"/>
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
              <button type="button" onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleUpdate} disabled={saving || !editForm.chiefComplaint.trim()}
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
function Section({ title, subtitle, action, accentClass, className = '', children }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 ${accentClass ? `border-l-4 ${accentClass} bg-gray-50/60 dark:bg-gray-700/30` : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 hidden sm:inline">{subtitle}</span>}
        </div>
        {action && <div className="flex-shrink-0 ml-3">{action}</div>}
      </div>
      {children}
    </div>
  )
}

/* ─────────────── Main Page ─────────────── */
function PatientPrintView({ patient, visits, progressNotes, doctor, formatDate, formatCurrency, effectiveLayout }) {
  const spec = doctor?.specialization ?? ''
  const isHom = isHomeopathy(spec)
  const age = patient.dateOfBirth
    ? `${Math.floor((Date.now() - new Date(patient.dateOfBirth)) / 31557600000)} yrs`
    : null

  const RichVal = ({ val }) => val
    ? (/<[a-z][\s\S]*>/i.test(val)
        ? <div dangerouslySetInnerHTML={{ __html: val }} style={{ fontSize: 12, lineHeight: 1.6 }}/>
        : <span style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{val}</span>)
    : <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12 }}>—</span>

  const Field = ({ label, value }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <RichVal val={value}/>
    </div>
  )

  const SectionHeader = ({ title }) => (
    <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 12, marginTop: 20 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
    </div>
  )

  // Visits + progress notes merged into one chronological timeline, matching the
  // Visits tab in the live UI — so the printed history reads the same way.
  const timelineItems = [
    ...(visits ?? []).filter(v => v.status !== 'draft').map(v => ({ type: 'visit', date: v.visitDate, data: v })),
    ...(progressNotes ?? []).map(n => ({ type: 'note', date: n.noteDate, data: n })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 15)

  // Mirrors the Overview tab's renderSection() so print follows the same doctor-customized
  // section order (effectiveLayout) instead of a separate hardcoded sequence.
  const renderPrintSection = (sectionId) => {
    switch (sectionId) {
      case 'personal': {
        const fields = [
          { label: 'National ID',       value: patient.nationalId },
          { label: 'Registration Date', value: patient.createdAt ? formatDate(patient.createdAt.slice(0, 10)) : null },
          { label: 'Patient / Case No.', value: patient.patientNumber ? `#${patient.patientNumber}` : null },
          { label: 'Alt Phone',         value: patient.alternatePhone },
          { label: 'Education',         value: patient.education },
          { label: 'Occupation',        value: patient.occupation },
          { label: 'Marital Status',    value: patient.maritalStatus ? patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1) : null },
        ].filter(f => f.value)
        if (!fields.length) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Personal Details"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {fields.map(f => <Field key={f.label} label={f.label} value={f.value}/>)}
            </div>
          </div>
        )
      }

      case 'medical_summary':
        if (!(patient.chronicConditions?.length || patient.allergies?.length || patient.currentMedications?.length)) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Medical Summary"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {patient.chronicConditions?.length > 0 && <Field label="Chronic Conditions" value={patient.chronicConditions.join(', ')}/>}
              {patient.allergies?.length > 0 && <Field label="Allergies" value={patient.allergies.join(', ')}/>}
              {patient.currentMedications?.length > 0 && <Field label="Current Medications" value={patient.currentMedications.join(', ')}/>}
            </div>
          </div>
        )

      case 'insurance':
        if (!patient.insuranceProvider) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Insurance"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Provider" value={patient.insuranceProvider}/>
              <Field label="Policy #" value={patient.insurancePolicyNumber}/>
              <Field label="Group #" value={patient.insuranceGroupNumber}/>
              <Field label="Expiry" value={patient.insuranceExpiry}/>
            </div>
          </div>
        )

      case 'emergency_contact':
        if (!patient.emergencyContact?.name) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Emergency Contact"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Name" value={patient.emergencyContact.name}/>
              <Field label="Phone" value={patient.emergencyContact.phone}/>
              <Field label="Relationship" value={patient.emergencyContact.relationship}/>
            </div>
          </div>
        )

      case 'history_ho':
        if (!(patient.observation || patient.pastHistory || patient.familyHistory || patient.notes || patient.historyOf || patient.lifeSpan)) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="History (H/o)"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {patient.observation   && <Field label="Observation" value={patient.observation}/>}
              {patient.pastHistory   && <Field label="Past History" value={patient.pastHistory}/>}
              {patient.familyHistory && <Field label="Family History" value={patient.familyHistory}/>}
              {patient.notes         && <Field label="Notes" value={patient.notes}/>}
              {patient.historyOf     && <Field label="Female / Male H/o" value={patient.historyOf}/>}
              {patient.lifeSpan      && <Field label="Life Span" value={patient.lifeSpan}/>}
            </div>
          </div>
        )

      case 'generals': {
        const rows = [
          ['appetite','Appetite'],['taste','Taste'],['thirst','Thirst'],['urine','Urine'],
          ['stool','Stool'],['thermal','Thermal'],['perspiration','Perspiration'],
          ['speed','Speed'],['fastidious','Fastidious'],['sleep','Sleep'],['dreams','Dreams'],
        ].filter(([key]) => patient.generals?.[key])
        const customRows = (patient.customGenerals ?? []).filter(g => g.label && g.value)
        if (!rows.length && !customRows.length) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Generals"/>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map(([key, label]) => (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', width: 140, fontWeight: 700, color: '#374151' }}>{label}</td>
                    <td style={{ padding: '6px 8px' }}>{patient.generals[key]}</td>
                  </tr>
                ))}
                {customRows.map(field => (
                  <tr key={field.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', width: 140, fontWeight: 700, color: '#374151' }}>{field.label}</td>
                    <td style={{ padding: '6px 8px' }}>{field.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      case 'chief_complaints':
        if (!patient.chiefComplaints?.some(c => c.complaint)) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Chief Complaints (C/o)"/>
            {patient.chiefComplaints.filter(c => c.complaint).map((row, i) => (
              <div key={i} style={{ marginBottom: 10, paddingLeft: 8, borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{i + 1}. {row.complaint}</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
                  {row.location    && <span><b>Location:</b> {row.location}</span>}
                  {row.sensation   && <span><b>Sensation:</b> {row.sensation}</span>}
                  {row.modality    && <span><b>Modality:</b> {row.modality}</span>}
                  {row.concomitant && <span><b>Concomitant:</b> {row.concomitant}</span>}
                </div>
              </div>
            ))}
          </div>
        )

      case 'prescription_details':
        if (!patient.prescriptionDetails) return null
        return (
          <div key={sectionId}>
            <SectionHeader title="Prescription Details"/>
            <RichVal val={patient.prescriptionDetails}/>
          </div>
        )

      default: {
        if (isHom) return null

        if (sectionId.startsWith('preset__')) {
          const secTitle = sectionId.slice('preset__'.length)
          const sec = getIntakeSections(spec).find(s => s.title === secTitle)
          if (!sec) return null
          const fields = sec.fields.filter(f => {
            const v = patient.specialtyData?.[f.key]
            return v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)
          })
          if (!fields.length) return null
          return (
            <div key={sectionId}>
              <SectionHeader title={sec.title}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fields.map(f => <Field key={f.key} label={f.label} value={
                  f.type === 'chips' && Array.isArray(patient.specialtyData[f.key])
                    ? patient.specialtyData[f.key].join(', ')
                    : f.type === 'scale'
                      ? `${patient.specialtyData[f.key]} / 10`
                      : String(patient.specialtyData[f.key] ?? '')
                }/>)}
              </div>
            </div>
          )
        }

        if (sectionId.startsWith('section__')) {
          const secName = sectionId.slice('section__'.length)
          const fields = (doctor?.patientFormFields ?? []).filter(f => (f.section || 'Additional Info') === secName)
            .filter(f => {
              const v = patient.specialtyData?.[f.id]
              return v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)
            })
          if (!fields.length) return null
          return (
            <div key={sectionId}>
              <SectionHeader title={secName}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fields.map(f => <Field key={f.id} label={f.label} value={
                  f.type === 'chips' && Array.isArray(patient.specialtyData[f.id])
                    ? patient.specialtyData[f.id].join(', ')
                    : f.type === 'scale'
                      ? `${patient.specialtyData[f.id]} / 10`
                      : String(patient.specialtyData[f.id] ?? '')
                }/>)}
              </div>
            </div>
          )
        }

        return null
      }
    }
  }

  return (
    <div id="patient-print" style={{ display: 'none', fontFamily: 'Arial, sans-serif', color: '#111827', padding: '32px 40px', maxWidth: 800, margin: '0 auto', fontSize: 13 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #111827' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{doctor?.clinicName || `Dr. ${doctor?.firstName} ${doctor?.lastName}`}</div>
          {doctor?.clinicName && <div style={{ fontSize: 13, color: '#6b7280' }}>Dr. {doctor?.firstName} {doctor?.lastName}</div>}
          {doctor?.phone && <div style={{ fontSize: 12, color: '#6b7280' }}>{doctor.phone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Patient Record</div>
        </div>
      </div>

      {/* Patient name + UHID */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          {patient.firstName} {patient.lastName}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: 12, color: '#374151' }}>
          {patient.patientNumber && <span><b>UHID:</b> {patient.patientNumber}</span>}
          {patient.dateOfBirth && <span><b>DOB:</b> {formatDate(patient.dateOfBirth)}{age ? ` (${age})` : ''}</span>}
          {patient.gender && <span><b>Gender:</b> {patient.gender}</span>}
          {patient.bloodType && <span><b>Blood Type:</b> {patient.bloodType}</span>}
          {patient.phone && <span><b>Phone:</b> {patient.phone}</span>}
          {patient.email && <span><b>Email:</b> {patient.email}</span>}
        </div>
        {patient.address && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}><b>Address:</b> {patient.address}</div>}
      </div>

      {/* Ordered sections — same order as the doctor-customized Overview tab layout */}
      {(effectiveLayout ?? []).filter(item => item.visible).map(item => renderPrintSection(item.id))}

      {/* Visit History */}
      {timelineItems.length > 0 ? (
        <>
          <SectionHeader title={`Visit History (${timelineItems.length} shown)`}/>
          {timelineItems.map((item, i) => {
            if (item.type === 'note') {
              const n = item.data
              return (
                <div key={n.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < timelineItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{n.noteDate ? formatDate(n.noteDate) : '—'}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress Note</span>
                  </div>
                  <div style={{ fontSize: 12 }}><RichVal val={n.note}/></div>
                </div>
              )
            }
            const v = item.data
            return (
              <div key={v.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < timelineItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{v.visitDate ? formatDate(v.visitDate) : '—'}</span>
                  {v.followUpDate && <span style={{ fontSize: 11, color: '#6b7280' }}>Follow-up: {formatDate(v.followUpDate)}</span>}
                </div>
                {v.chiefComplaint && <div style={{ fontSize: 12, marginBottom: 3 }}><b>Chief Complaint:</b> {v.chiefComplaint}</div>}
                {v.diagnosis?.length > 0 && <div style={{ fontSize: 12, marginBottom: 3 }}><b>Diagnosis:</b> {v.diagnosis.join(', ')}</div>}
                {v.treatment && <div style={{ fontSize: 12, marginBottom: 3 }}><b>Treatment:</b> <RichVal val={v.treatment}/></div>}
                {v.prescriptions?.length > 0 && (
                  <div style={{ fontSize: 12, marginBottom: 3 }}>
                    <b>Prescriptions:</b> {v.prescriptions.map(rx => `${rx.medication} ${rx.dosage} ${rx.frequency}`).join('; ')}
                  </div>
                )}
                {v.payment?.amount > 0 && <div style={{ fontSize: 12, color: '#059669' }}><b>Payment:</b> {formatCurrency(v.payment.amount)} ({v.payment.status})</div>}
              </div>
            )
          })}
        </>
      ) : null}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
        This document is confidential and intended solely for the patient and authorised medical personnel.
      </div>
    </div>
  )
}

export default function PatientProfilePage() {
  const { id } = useParams()
  const router  = useRouter()
  const { doctor, isReceptionist } = useAuth()
  const specialization = doctor?.specialization ?? ''
  const { formatCurrency, formatDate, formatDateFull } = usePreferences()
  const toast = useToast()
  const referralSources  = useReferralSources()
  const billingStatuses  = getBillingStatuses(doctor?.billingStatuses)
  const INV_COLORS       = buildStatusColorMap(billingStatuses)
  const { patient, loading, update } = usePatient(id)
  const { visits, update: updateVisit, add: addVisit, remove: removeVisit } = useVisits(id)
  const { notes: progressNotes, add: addProgressNote, remove: removeProgressNote } = useProgressNotes(id)
  const { appointments }     = usePatientAppointments(id)
  const { invoices }         = usePatientInvoices(id)
  const { followups, markDone } = useFollowUps()
  const { blockedSlots }        = useBlockedSlots()
  // Receptionists skip to Appointments tab (index 3) — Overview/Follow-ups/Visits are hidden
  const [tab, setTab]            = useState(isReceptionist ? 3 : 0)
  // Receptionists only see invoices they created
  const visibleInvoices = useMemo(
    () => isReceptionist ? invoices.filter(i => i.createdBy?.uid === doctor?._receptionistUid) : invoices,
    [invoices, isReceptionist, doctor?._receptionistUid]
  )
  // Documents tab state
  const [documents,     setDocuments]     = useState([])
  const [docsLoading,   setDocsLoading]   = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [uploadErr,     setUploadErr]     = useState('')

  const loadDocuments = useCallback(async () => {
    if (!doctor?.uid || !id) return
    setDocsLoading(true)
    try {
      const token = await getAuthToken(doctor)
      const res   = await fetch(`/api/upload-file?patientId=${id}&doctorId=${doctor.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setDocuments(data.documents ?? [])
    } catch {} finally { setDocsLoading(false) }
  }, [doctor?.uid, id])

  useEffect(() => { if (tab === 5) loadDocuments() }, [tab, loadDocuments])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !doctor?.uid) return
    setUploading(true); setUploadErr('')
    try {
      const token  = await getAuthToken(doctor)
      const form   = new FormData()
      form.append('file', file)
      form.append('patientId', id)
      form.append('doctorId', doctor.uid)
      const res  = await fetch('/api/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setDocuments(prev => [data.document, ...prev])
    } catch (err) { setUploadErr(err.message) }
    finally { setUploading(false) }
  }

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    try {
      const token = await getAuthToken(doctor)
      await fetch('/api/upload-file', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctor.uid, patientId: id, docId: doc.id, url: doc.url }),
      })
    } catch { loadDocuments() }
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const [editInvoice,   setEditInvoice]   = useState(null)
  const [editInvForm,   setEditInvForm]   = useState({ description: '', amount: '', method: 'cash', status: 'draft', collectedBy: '' })
  const [editInvSaving, setEditInvSaving] = useState(false)
  const [payModal,      setPayModal]      = useState(null) // invoice to mark paid
  const [payMethod,     setPayMethod]     = useState('cash')
  const [payCollectedBy, setPayCollectedBy] = useState('doctor')
  const [payMarking,    setPayMarking]    = useState(false)

  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteDate,      setNoteDate]      = useState(() => localDateStr())
  const [noteText,      setNoteText]      = useState('')
  const [savingNote,    setSavingNote]    = useState(false)

  const handleAddProgressNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await addProgressNote({
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : '',
        noteDate,
        note: noteText.trim(),
      })
      setNoteText('')
      setNoteDate(localDateStr())
      setShowNoteModal(false)
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this progress note?')) return
    await removeProgressNote(noteId)
  }

  // History (H/o) / Generals / Chief Complaints / Prescription Details are
  // editable for every doctor on the Edit page regardless of specialization —
  // show them for every doctor here too, so nothing entered in Edit mode
  // silently disappears from View just because the doctor isn't tagged
  // "homeopathy". Specialty-preset and custom fields remain additive extras
  // for non-homeopathy doctors, since Edit mode has no UI for those at all.
  const sectionDefs = useMemo(() => {
    const base = [
      { id: 'personal',             label: 'Personal Details',       icon: '👤' },
      { id: 'medical_summary',      label: 'Medical Summary',        icon: '🏥' },
      { id: 'insurance',            label: 'Insurance',              icon: '🛡️' },
      { id: 'emergency_contact',    label: 'Emergency Contact',      icon: '🚨' },
      { id: 'history_ho',           label: 'History (H/o)',          icon: '📖' },
      { id: 'generals',             label: 'Generals',               icon: '🔬' },
      { id: 'chief_complaints',     label: 'Chief Complaints (C/o)', icon: '📋' },
      { id: 'prescription_details', label: 'Prescription Details',   icon: '💊' },
    ]
    if (isHomeopathy(specialization)) return base
    const presetSecs = getIntakeSections(specialization)
      .map(s => ({ id: `preset__${s.title}`, label: s.title, icon: '📋' }))
    const customSecs = [...new Set((doctor?.patientFormFields ?? []).map(f => f.section || 'Additional Info'))]
      .map(s => ({ id: `section__${s}`, label: s, icon: '📋' }))
    return [...base, ...presetSecs, ...customSecs]
  }, [doctor?.id, specialization]) // eslint-disable-line react-hooks/exhaustive-deps

  const [sectionLayout,      setSectionLayout]      = useState([])
  const [draftSectionLayout, setDraftSectionLayout] = useState([])
  const [customizingProfile, setCustomizingProfile] = useState(false)
  const [savingLayout,       setSavingLayout]       = useState(false)
  const dragSectionId = useRef(null)

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

  useEffect(() => {
    if (!doctor?.id || !sectionDefs.length) return
    dataStore.getMeta('patientProfileLayout').then(saved => {
      const defaultLayout = sectionDefs.map(d => ({ id: d.id, visible: true }))
      if (!saved?.sections?.length) {
        setSectionLayout(defaultLayout)
        setDraftSectionLayout(defaultLayout)
        return
      }
      const savedIds = saved.sections.map(s => s.id)
      const merged = [
        ...saved.sections.filter(s => sectionDefs.some(d => d.id === s.id)),
        ...sectionDefs.filter(d => !savedIds.includes(d.id)).map(d => ({ id: d.id, visible: true })),
      ]
      setSectionLayout(merged)
      setDraftSectionLayout(merged)
    }).catch(() => {
      setSectionLayout(sectionDefs.map(d => ({ id: d.id, visible: true })))
    })
  }, [doctor?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Profile layout drag-and-drop ────────────────────────────────────────

  function handleSectionDragStart(e, id) {
    dragSectionId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleSectionDragOver(e, targetId) {
    e.preventDefault()
    if (!dragSectionId.current || dragSectionId.current === targetId) return
    setDraftSectionLayout(prev => {
      const fromIdx = prev.findIndex(s => s.id === dragSectionId.current)
      const toIdx   = prev.findIndex(s => s.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  function handleSectionDrop(e) {
    e.preventDefault()
    dragSectionId.current = null
  }

  function toggleSectionVisible(id) {
    setDraftSectionLayout(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  async function saveProfileLayout() {
    setSavingLayout(true)
    try {
      await dataStore.setMeta('patientProfileLayout', { sections: draftSectionLayout })
      setSectionLayout(draftSectionLayout)
      setCustomizingProfile(false)
    } finally {
      setSavingLayout(false)
    }
  }

  function cancelCustomizeProfile() {
    setDraftSectionLayout(sectionLayout)
    setCustomizingProfile(false)
  }

  // ─── Invoice edit handlers ────────────────────────────────────────────────

  function openInvEdit(inv) {
    setEditInvoice(inv)
    setEditInvForm({
      description: inv.lineItems?.[0]?.description || '',
      amount:      String(inv.total ?? ''),
      method:      inv.paymentMethod || 'cash',
      status:      inv.status || 'draft',
      collectedBy: inv.collectedBy || '',
    })
  }

  async function handleInvEdit() {
    if (!editInvoice) return
    setEditInvSaving(true)
    try {
      const newTotal = Number(editInvForm.amount)
      await billingService.update(editInvoice.id, {
        lineItems: editInvoice.lineItems?.length
          ? [{ ...editInvoice.lineItems[0], description: editInvForm.description, unitPrice: newTotal, quantity: 1, total: newTotal }]
          : editInvoice.lineItems,
        total:         newTotal,
        subtotal:      newTotal,
        status:        editInvForm.status,
        paymentMethod: editInvForm.method,
        collectedBy:   editInvForm.collectedBy,
        paymentDate:   editInvForm.status === 'paid' ? (editInvoice.paymentDate || editInvoice.issueDate) : null,
      })
      setEditInvoice(null)
    } catch {
      toast.error('Failed to update invoice. Please try again.')
    } finally {
      setEditInvSaving(false)
    }
  }

  async function handleMarkPaid() {
    if (!payModal) return
    setPayMarking(true)
    try {
      await billingService.update(payModal.id, {
        status:        'paid',
        paymentMethod: payMethod,
        collectedBy:   payCollectedBy,
        paymentDate:   new Date().toISOString().slice(0, 10),
      })
      setPayModal(null)
    } catch {
      toast.error('Failed to mark as paid. Please try again.')
    } finally {
      setPayMarking(false)
    }
  }

  // ─── Section renderer (Overview tab) ─────────────────────────────────────

  const renderSection = (sectionId) => {
    switch (sectionId) {

      case 'personal':
        return (
          <Section key="personal" title="Personal Details"><div className="p-6 space-y-4">
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
            {patient.consentFormSigned && <InfoRow label="Consent" value="Form signed" />}
          </div></Section>
        )

      case 'medical_summary':
        return (
          <Section key="medical_summary" title="Medical Summary"><div className="p-6">
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
            {visits.length > 0 && (() => {
              const allDiagnoses = [...new Set(visits.flatMap(v => v.diagnosis || []).filter(Boolean))]
              const allLabOrders = [...new Set(visits.flatMap(v => v.labOrders  || []).filter(Boolean))]
              const recentRx     = visits.slice(0, 3).flatMap(v => (v.prescriptions || []).map(p => p.medication).filter(Boolean))
              const uniqueRx     = [...new Set(recentRx)]
              if (!allDiagnoses.length && !allLabOrders.length && !uniqueRx.length) return null
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">From Visit History</p>
                  {allDiagnoses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Diagnoses</p>
                      <div className="flex flex-wrap gap-1.5">{allDiagnoses.map(d => <Badge key={d} label={d} color="purple"/>)}</div>
                    </div>
                  )}
                  {uniqueRx.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Recent Prescriptions</p>
                      <div className="flex flex-wrap gap-1.5">{uniqueRx.map(m => <Badge key={m} label={m} color="teal"/>)}</div>
                    </div>
                  )}
                  {allLabOrders.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Lab Orders</p>
                      <div className="flex flex-wrap gap-1.5">{allLabOrders.map(l => <Badge key={l} label={l} color="gray"/>)}</div>
                    </div>
                  )}
                </div>
              )
            })()}
            {!patient.allergies?.length && !patient.chronicConditions?.length && !patient.currentMedications?.length && !visits.length && (
              <p className="text-sm text-gray-400">No medical history recorded.</p>
            )}
          </div></Section>
        )

      case 'insurance':
        return (
          <Section key="insurance" title="Insurance"><div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Provider" value={patient.insuranceProvider} />
              <InfoRow label="Policy #" value={patient.insurancePolicyNumber} />
              <InfoRow label="Group #" value={patient.insuranceGroupNumber} />
              <InfoRow label="Expiry" value={patient.insuranceExpiry} />
            </div>
            {!patient.insuranceProvider && <p className="text-sm text-gray-400">No insurance details on file.</p>}
          </div></Section>
        )

      case 'emergency_contact':
        if (!patient.emergencyContact?.name) return null
        return (
          <Section key="emergency_contact" title="Emergency Contact"><div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Name" value={patient.emergencyContact.name} />
              <InfoRow label="Relationship" value={patient.emergencyContact.relationship} />
              <InfoRow label="Phone" value={patient.emergencyContact.phone} />
            </div>
          </div></Section>
        )

      case 'history_ho': {
        const hoFields = [
          { key: 'observation',   label: 'Observation',       value: patient.observation   },
          { key: 'pastHistory',   label: 'Past History',      value: patient.pastHistory   },
          { key: 'familyHistory', label: 'Family History',    value: patient.familyHistory },
          { key: 'notes',         label: 'Notes',             value: patient.notes         },
          { key: 'historyOf',     label: 'Female / Male H/o', value: patient.historyOf     },
          { key: 'lifeSpan',      label: 'Life Span',         value: patient.lifeSpan      },
        ].filter(f => f.value)
        if (!hoFields.length) return null
        return (
          <Section key="history_ho" title="History (H/o)">
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {hoFields.map(f => (
                <div key={f.key} className="px-6 py-4">
                  <p className="form-label mb-1">{f.label}</p>
                  {/<[a-z][\s\S]*>/i.test(f.value)
                    ? <div className="rich-text-view text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: f.value }}/>
                    : <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{f.value}</p>
                  }
                </div>
              ))}
            </div>
          </Section>
        )
      }

      case 'generals':
        return (
          <Section key="generals" title="Generals" subtitle="Constitutional symptoms"><div className="p-6">
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
        )

      case 'chief_complaints':
        if (!(patient.chiefComplaints ?? []).some(c => c.complaint)) return null
        return (
          <Section key="chief_complaints" title="Chief Complaints (C/o)" accentClass="border-l-blue-500">
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {(patient.chiefComplaints ?? []).filter(c => c.complaint).map((row, i) => (
                <div key={i} className="px-5 py-4">
                  {/* Complaint heading */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-snug">{row.complaint}</p>
                  </div>
                  {/* Sub-fields — only render if they have content */}
                  {(row.location || row.sensation || row.modality || row.concomitant) && (
                    <div className="ml-9 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                      {[['Location','location'],['Sensation','sensation'],['Modality','modality'],['Concomitant','concomitant']].map(([label, key]) =>
                        row[key] ? (
                          <div key={key}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{row[key]}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )

      case 'prescription_details':
        if (!patient.prescriptionDetails) return null
        return (
          <Section key="prescription_details" title="Prescription Details" accentClass="border-l-teal-500">
            <div className="p-6">
              {/<[a-z][\s\S]*>/i.test(patient.prescriptionDetails)
                ? <div className="rich-text-view text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: patient.prescriptionDetails }}/>
                : <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{patient.prescriptionDetails}</p>
              }
            </div>
          </Section>
        )

      default: {
        // ── Preset specialty section ─────────────────────────────────────────
        if (sectionId.startsWith('preset__')) {
          const secTitle = sectionId.slice('preset__'.length)
          const allPreset = getIntakeSections(specialization)
          const sec = allPreset.find(s => s.title === secTitle)
          if (!sec) return null
          const hasData = sec.fields.some(f => {
            const v = (patient.specialtyData ?? {})[f.key]
            return v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)
          })
          if (!hasData) return null
          const presetIdx = allPreset.indexOf(sec)
          return (
            <Section key={sectionId} title={sec.title} accentClass={ACCENT_COLORS[presetIdx % ACCENT_COLORS.length]}>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sec.fields.map(field => {
                  const val = (patient.specialtyData ?? {})[field.key]
                  if (val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)) return null
                  return (
                    <div key={field.key} className={field.type === 'textarea' || field.type === 'chips' || field.type === 'scale' ? 'sm:col-span-2' : ''}>
                      <p className="form-label">{field.label}</p>
                      {field.type === 'scale' ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${val >= 8 ? 'bg-red-500' : val >= 5 ? 'bg-amber-400' : 'bg-green-500'}`}
                              style={{ width: `${val * 10}%` }}/>
                          </div>
                          <span className={`text-sm font-bold w-6 text-center ${val >= 8 ? 'text-red-500' : val >= 5 ? 'text-amber-500' : 'text-green-500'}`}>{val}</span>
                        </div>
                      ) : field.type === 'textarea' && typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val) ? (
                        <div className="rich-text-view text-sm mt-0.5 text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: val }}/>
                      ) : (
                        <p className={`text-sm mt-0.5 whitespace-pre-wrap ${val ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                          {Array.isArray(val) ? val.join(', ') : (val || '—')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )
        }

        // ── Custom doctor-added field section ────────────────────────────────
        if (!sectionId.startsWith('section__')) return null
        const secName = sectionId.slice('section__'.length)
        const fields  = (doctor?.patientFormFields ?? []).filter(f => (f.section || 'Additional Info') === secName)
        if (!fields.length) return null
        const allSecNames = [...new Set((doctor?.patientFormFields ?? []).map(f => f.section || 'Additional Info'))]
        const si = allSecNames.indexOf(secName)
        return (
          <Section key={sectionId} title={secName} accentClass={ACCENT_COLORS[si % ACCENT_COLORS.length]}>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map(field => (
                  <ClinicalField key={field.id} field={field} editing={false}
                    value={(patient.specialtyData ?? {})[field.id]} onChange={() => {}} />
                ))}
              </div>
            </div>
          </Section>
        )
      }
    }
  }

  const effectiveLayout = sectionLayout.length ? sectionLayout : sectionDefs.map(d => ({ id: d.id, visible: true }))

  return (
    <AppLayout
      title="Patient Profile"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.push('/patients')}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1.5 transition-colors">
            ← Back
          </button>
          {!doctor?.viewOnly && (
            <button onClick={() => router.push(`/patients/${id}/edit`)}
              className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
          )}
          <button onClick={() => window.print()}
            className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export PDF
          </button>
          {!doctor?.viewOnly && (
            <button onClick={() => setShowDeleteModal(true)}
              className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Delete
            </button>
          )}
          {!doctor?.viewOnly && (
            <button onClick={() => router.push(`/visits/new?patientId=${id}`)}
              className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Record Visit
            </button>
          )}
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
          {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length > 0 && (
            <span className="text-red-300 font-semibold">
              {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} due
            </span>
          )}
          <span>{patientFollowUps.length} follow-up{patientFollowUps.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tabs — receptionists only see Appointments and Billing */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map((t, i) => {
          if (isReceptionist && (t === 'Overview' || t === 'Follow-ups' || t === 'Visits' || t === 'Documents')) return null
          return (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5
              ${tab === i ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t}
            {t === 'Follow-ups' && followUpDueCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {followUpDueCount}
              </span>
            )}
            {t === 'Billing' && invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} due
              </span>
            )}
          </button>
          )
        })}
      </div>

      {/* Tab 0: Overview */}
      {tab === 0 && (
        <div className="space-y-5">

          {/* ── Customize panel ── */}
          {customizingProfile && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-primary-200 dark:border-primary-700 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Customize Profile Layout</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Drag to reorder · Toggle eye to show / hide sections</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={cancelCustomizeProfile}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveProfileLayout} disabled={savingLayout}
                    className="px-4 py-1.5 text-sm font-medium bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center gap-1.5">
                    {savingLayout && (
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    Save Layout
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {draftSectionLayout.map(item => {
                  const def = sectionDefs.find(d => d.id === item.id)
                  if (!def) return null
                  return (
                    <div key={item.id}
                      draggable
                      onDragStart={e => handleSectionDragStart(e, item.id)}
                      onDragOver={e => handleSectionDragOver(e, item.id)}
                      onDrop={handleSectionDrop}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 cursor-move select-none hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                      <span className="text-base">{def.icon}</span>
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{def.label}</span>
                      <button type="button" onClick={() => toggleSectionVisible(item.id)}
                        title={item.visible ? 'Hide section' : 'Show section'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.visible
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40'
                            : 'text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                        }`}>
                        {item.visible
                          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Customize button ── */}
          {!customizingProfile && (
            <div className="flex justify-end">
              <button onClick={() => { setDraftSectionLayout(sectionLayout.length ? sectionLayout : effectiveLayout); setCustomizingProfile(true) }}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                </svg>
                Customize Layout
              </button>
            </div>
          )}

          {/* ── Ordered sections ── */}
          {effectiveLayout.map(item => {
            if (!item.visible) return null
            return renderSection(item.id)
          })}

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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Visit History</h3>
            {!doctor?.viewOnly && (
              <button onClick={() => setShowNoteModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add Progress Note
              </button>
            )}
          </div>

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

          {/* Completed visits + progress notes — merged timeline */}
          {(() => {
            const completedVisits = visits.filter(v => v.status !== 'draft')
            const draftCount = visits.filter(v => v.status === 'draft').length
            const timelineItems = [
              ...completedVisits.map(v => ({ type: 'visit', date: v.visitDate, data: v })),
              ...progressNotes.map(n => ({ type: 'note', date: n.noteDate, data: n })),
            ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

            if (timelineItems.length === 0 && draftCount === 0) {
              return (
                <EmptyState title="No visits recorded" description="Record a visit to start tracking this patient's medical history."
                  action={() => router.push(`/visits/new?patientId=${id}`)} actionLabel="Record Visit"/>
              )
            }
            if (timelineItems.length === 0) {
              return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No completed visits yet.</p>
            }
            const firstVisitIdx = timelineItems.findIndex(t => t.type === 'visit')
            let visitNumber = completedVisits.length
            return (
              <div className="relative">
                {/* Timeline spine */}
                <div className="absolute left-5 top-10 bottom-6 w-0.5 bg-gradient-to-b from-primary-300 via-gray-200 to-transparent dark:from-primary-700 dark:via-gray-700 dark:to-transparent"/>

                <div className="space-y-3">
                  {timelineItems.map((item, idx) => {
                    if (item.type === 'note') {
                      const noteItem = item.data
                      return (
                        <div key={`note-${noteItem.id}`} className="relative flex gap-4 items-start group">
                          {/* Timeline node */}
                          <div className="relative z-10 flex-shrink-0 flex flex-col items-center pt-2.5" style={{ width: 40 }}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm ring-2 ring-white dark:ring-gray-900 shadow-sm bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700">
                              📝
                            </div>
                          </div>

                          {/* Card */}
                          <div className="flex-1 min-w-0 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                                  Progress Note · {formatDate(noteItem.noteDate)}
                                  {noteItem.createdAt && ` · ${new Date(noteItem.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}`}
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{noteItem.note}</p>
                              </div>
                              {!doctor?.viewOnly && (
                                <button onClick={() => handleDeleteNote(noteItem.id)} title="Delete note"
                                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-all">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    const visit = item.data
                    const number = visitNumber
                    visitNumber -= 1
                    return (
                      <div key={visit.id} className="relative flex gap-4 items-start">
                        {/* Timeline node */}
                        <div className="relative z-10 flex-shrink-0 flex flex-col items-center pt-2.5" style={{ width: 40 }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-gray-900 shadow-sm ${
                            idx === firstVisitIdx
                              ? 'bg-primary-500 dark:bg-primary-500 text-white'
                              : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                          }`}>
                            {number}
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
                            defaultExpanded={idx === firstVisitIdx}
                          />
                        </div>
                      </div>
                    )
                  })}
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
        <div className="space-y-4">
          {isReceptionist && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Showing only invoices you created.
            </div>
          )}
          {/* Due bills alert */}
          {visibleInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {visibleInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} unpaid invoice{visibleInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {formatCurrency(visibleInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + (i.total || 0), 0))} pending collection
                </p>
              </div>
            </div>
          )}
          {visibleInvoices.length === 0 ? (
            <EmptyState title="No invoices" description={isReceptionist ? "You haven't created any invoices for this patient yet." : "No billing history for this patient."}
              action={!doctor?.viewOnly ? () => router.push(`/billing/new?patientId=${id}`) : undefined} actionLabel="Create Invoice"/>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    {['Invoice #', 'Date', 'Description', 'Method', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {visibleInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!doctor?.viewOnly && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button onClick={() => { setPayModal(inv); setPayMethod('cash'); setPayCollectedBy(isReceptionist ? 'receptionist' : 'doctor') }}
                              className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline transition-colors">
                              Mark Paid
                            </button>
                          )}
                          {!doctor?.viewOnly && (
                            <button onClick={() => openInvEdit(inv)}
                              className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors">
                              Edit
                            </button>
                          )}
                          <button onClick={() => router.push(`/billing?invoice=${inv.id}`)}
                            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline transition-colors">
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {visibleInvoices.filter(i => i.status === 'paid').length} paid · {visibleInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} pending
                </span>
                {!isReceptionist && (
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Total: {formatCurrency(visibleInvoices.filter(i => i.status === 'paid').reduce((s,i) => s + (i.total || 0), 0))} collected
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Invoice Modal */}
      <Modal open={!!editInvoice} onClose={() => setEditInvoice(null)} title="Edit Invoice" size="sm">
        {editInvoice && (
          <div className="space-y-4 mb-5">
            <div>
              <label className="form-label">Description</label>
              <input value={editInvForm.description} onChange={e => setEditInvForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Consultation Fee" className="input-field"/>
            </div>
            <div>
              <label className="form-label">Amount</label>
              <input type="number" min="0" value={editInvForm.amount} onChange={e => setEditInvForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" className="input-field"/>
            </div>
            <div>
              <label className="form-label">Payment Method</label>
              <select value={editInvForm.method} onChange={e => setEditInvForm(f => ({ ...f, method: e.target.value }))} className="input-field">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Collected By</label>
              <select value={editInvForm.collectedBy} onChange={e => setEditInvForm(f => ({ ...f, collectedBy: e.target.value }))} className="input-field">
                <option value="">— Select —</option>
                {COLLECTED_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select value={editInvForm.status} onChange={e => setEditInvForm(f => ({ ...f, status: e.target.value }))} className="input-field">
                {billingStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t dark:border-gray-700">
              <button type="button" onClick={() => setEditInvoice(null)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleInvEdit} disabled={editInvSaving}
                className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {editInvSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mark Paid Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Mark as Paid" size="sm">
        {payModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Invoice <span className="font-semibold text-gray-900 dark:text-white">{payModal.invoiceNumber}</span> — {formatCurrency(payModal.total)}
            </p>
            <div>
              <label className="form-label">Payment Method</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.value} type="button"
                    onClick={() => setPayMethod(m.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      payMethod === m.value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400'
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Collected By</label>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm font-medium">
                {COLLECTED_BY_OPTIONS.map(o => (
                  <button key={o.value} type="button"
                    onClick={() => setPayCollectedBy(o.value)}
                    className={`flex-1 py-2 transition-colors ${
                      payCollectedBy === o.value
                        ? 'bg-primary-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setPayModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleMarkPaid} disabled={payMarking}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {payMarking ? 'Saving…' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tab 5: Documents */}
      {tab === 5 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Patient Documents</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Reports, prescriptions, lab results, images — up to 20 MB each</p>
            </div>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}>
              {uploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                  Upload File
                </>
              )}
              <input type="file" className="hidden" disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleUpload}/>
            </label>
          </div>

          {uploadErr && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {uploadErr}
            </div>
          )}

          {docsLoading ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Loading documents…</div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No documents yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload reports, prescriptions, or images</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm divide-y divide-gray-50 dark:divide-gray-700/50">
              {documents.map(doc => {
                const isImage = doc.type?.startsWith('image/')
                const isPdf   = doc.type === 'application/pdf'
                const icon    = isImage ? '🖼️' : isPdf ? '📄' : doc.type?.includes('word') ? '📝' : doc.type?.includes('excel') || doc.type?.includes('sheet') ? '📊' : '📎'
                const sizeKb  = doc.size ? (doc.size / 1024).toFixed(0) : null
                const sizeMb  = sizeKb > 999 ? `${(doc.size / 1048576).toFixed(1)} MB` : `${sizeKb} KB`
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {sizeMb && `${sizeMb} · `}
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-700 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                        Open
                      </a>
                      <button onClick={() => handleDeleteDoc(doc)}
                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
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
          <button type="button" onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={deleting} onClick={async () => {
            setDeleting(true)
            try { await patientService.remove(id); router.push('/patients') } catch { setDeleting(false) }
          }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
            {deleting ? 'Deleting…' : 'Delete Patient'}
          </button>
        </div>
      </Modal>

      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Progress Note" size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={noteDate} max={localDateStr()}
              onChange={e => setNoteDate(e.target.value)} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Note</label>
            <AutoTextarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Quick update — e.g. Called patient, feeling better, continuing current meds."
              className="input-field" rows={2}/>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button type="button" onClick={() => setShowNoteModal(false)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={savingNote || !noteText.trim()} onClick={handleAddProgressNote}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
            {savingNote ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </Modal>

      <PatientPrintView
        patient={patient}
        visits={visits}
        progressNotes={progressNotes}
        doctor={doctor}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        effectiveLayout={effectiveLayout}
      />
    </AppLayout>
  )
}
