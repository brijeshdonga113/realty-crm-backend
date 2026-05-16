'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatient } from '@/hooks/usePatients'
import { useReferralSources } from '@/hooks/useReferralSources'
import { BLOOD_TYPES, GENDERS } from '@/models/Patient'
import { patientService } from '@/services/patientService'
import AutoTextarea from '@/components/ui/AutoTextarea'
import { useToast } from '@/components/ui/Toast'

const GENERALS_CONFIG = [
  { key: 'appetite',     label: 'Appetite'     },
  { key: 'taste',        label: 'Taste'        },
  { key: 'thirst',       label: 'Thirst'       },
  { key: 'urine',        label: 'Urine'        },
  { key: 'stool',        label: 'Stool'        },
  { key: 'thermal',      label: 'Thermal'      },
  { key: 'perspiration', label: 'Perspiration' },
  { key: 'speed',        label: 'Speed'        },
  { key: 'fastidious',   label: 'Fastidious'   },
  { key: 'sleep',        label: 'Sleep'        },
  { key: 'dreams',       label: 'Dreams'       },
]

const EMPTY_COMPLAINT = { complaint: '', location: '', sensation: '', modality: '', concomitant: '' }

const ACCENT = {
  teal:   'border-l-teal-500',
  blue:   'border-l-blue-500',
  green:  'border-l-green-500',
  purple: 'border-l-purple-500',
  orange: 'border-l-orange-500',
}

function SectionCard({ icon, title, accentColor = 'teal', children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-3 px-6 py-4 border-l-4 ${ACCENT[accentColor]} border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30`}>
        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{icon}</span>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  )
}

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

const CONDITION_SUGGESTIONS = ['Hypertension','Diabetes Type 1','Diabetes Type 2','Asthma','COPD','Arthritis','Heart Disease','Thyroid Disorder','Cancer','Epilepsy','Depression','Anxiety']
const ALLERGY_SUGGESTIONS   = ['Penicillin','Aspirin','Ibuprofen','Sulfa drugs','Latex','Pollen','Dust mites','Pet dander','Peanuts','Shellfish','Eggs','Milk']

function patientToForm(p) {
  return {
    patientNumber:    p.patientNumber != null ? String(p.patientNumber) : '',
    registrationDate: p.createdAt ? p.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    firstName:        p.firstName        ?? '',
    lastName:         p.lastName         ?? '',
    dateOfBirth:      p.dateOfBirth      ?? '',
    ageManual:        p.ageManual != null ? String(p.ageManual) : '',
    gender:           p.gender           ?? 'male',
    bloodType:        p.bloodType        ?? '',
    education:        p.education        ?? '',
    occupation:       p.occupation       ?? '',
    maritalStatus:    p.maritalStatus    ?? '',
    phone:            p.phone            ?? '',
    alternatePhone:   p.alternatePhone   ?? '',
    email:            p.email            ?? '',
    address:          p.address          ?? '',
    referralSource:   p.referralSource   ?? '',
    referralNotes:    p.referralNotes    ?? '',
    observation:      p.observation      ?? '',
    pastHistory:      p.pastHistory      ?? '',
    familyHistory:    p.familyHistory    ?? '',
    chiefComplaints:  p.chiefComplaints?.length ? p.chiefComplaints : [{ ...EMPTY_COMPLAINT }],
    generals: {
      appetite:     p.generals?.appetite     ?? '',
      taste:        p.generals?.taste        ?? '',
      thirst:       p.generals?.thirst       ?? '',
      urine:        p.generals?.urine        ?? '',
      stool:        p.generals?.stool        ?? '',
      thermal:      p.generals?.thermal      ?? '',
      perspiration: p.generals?.perspiration ?? '',
      speed:        p.generals?.speed        ?? '',
      fastidious:   p.generals?.fastidious   ?? '',
      sleep:        p.generals?.sleep        ?? '',
      dreams:       p.generals?.dreams       ?? '',
    },
    customGenerals:        p.customGenerals        ?? [],
    historyOf:             p.historyOf             ?? '',
    lifeSpan:              p.lifeSpan              ?? '',
    prescriptionDetails:   p.prescriptionDetails   ?? '',
    status:                p.status                ?? 'active',
    notes:                 p.notes                 ?? '',
    nationalId:            p.nationalId            ?? '',
    allergies:             p.allergies             ?? [],
    chronicConditions:     p.chronicConditions     ?? [],
    currentMedications:    p.currentMedications    ?? [],
    consentFormSigned:     p.consentFormSigned      ?? false,
    insuranceProvider:     p.insuranceProvider      ?? '',
    insurancePolicyNumber: p.insurancePolicyNumber  ?? '',
    insuranceExpiry:       p.insuranceExpiry        ?? '',
    insuranceGroupNumber:  p.insuranceGroupNumber   ?? '',
    emergencyContact: {
      name:         p.emergencyContact?.name         ?? '',
      phone:        p.emergencyContact?.phone        ?? '',
      relationship: p.emergencyContact?.relationship ?? '',
    },
  }
}

export default function EditPatientPage() {
  const { id }           = useParams()
  const router           = useRouter()
  const toast            = useToast()
  const referralSources  = useReferralSources()
  const { patient, loading } = usePatient(id)

  const [form,    setFormState] = useState(null)
  const [saving,  setSaving]   = useState(false)
  const [errors,  setErrors]   = useState({})

  useEffect(() => {
    if (patient && !form) setFormState(patientToForm(patient))
  }, [patient, form])

  if (loading || !form) return (
    <AppLayout title="Edit Patient">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading…
      </div>
    </AppLayout>
  )

  const set = (k, v) => { setFormState(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const setGeneral  = (k, v)    => setFormState(p => ({ ...p, generals: { ...p.generals, [k]: v } }))
  const setEc       = (k, v)    => setFormState(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }))
  const setComplaint = (i, field, v) => setFormState(p => {
    const list = [...p.chiefComplaints]; list[i] = { ...list[i], [field]: v }; return { ...p, chiefComplaints: list }
  })
  const addComplaint    = () => setFormState(p => ({ ...p, chiefComplaints: [...p.chiefComplaints, { ...EMPTY_COMPLAINT }] }))
  const removeComplaint = (i) => setFormState(p => ({ ...p, chiefComplaints: p.chiefComplaints.filter((_, j) => j !== i) }))
  const addCustomGeneral    = () => setFormState(p => ({ ...p, customGenerals: [...p.customGenerals, { id: Date.now().toString(36), label: '', value: '' }] }))
  const removeCustomGeneral = (gid) => setFormState(p => ({ ...p, customGenerals: p.customGenerals.filter(g => g.id !== gid) }))
  const setCustomGeneral    = (gid, field, v) => setFormState(p => ({ ...p, customGenerals: p.customGenerals.map(g => g.id === gid ? { ...g, [field]: v } : g) }))

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim())  errs.lastName  = 'Required'
    if (!form.phone.trim())     errs.phone     = 'Required'
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await patientService.update(id, {
        ...form,
        patientNumber: form.patientNumber ? Number(form.patientNumber) : patient.patientNumber,
        ageManual:     form.ageManual !== '' ? Number(form.ageManual) : null,
      })
      toast.success('Patient updated.')
      router.push(`/patients/${id}`)
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const ActionBar = ({ bottom = false }) => (
    <div className={`flex items-center ${bottom ? 'justify-between pt-2 border-t border-gray-100 dark:border-gray-700' : 'gap-2'}`}>
      <button type="button" onClick={() => router.push(`/patients/${id}`)}
        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        ← Cancel
      </button>
      <button type="button" onClick={handleSave} disabled={saving}
        className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
        {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <AppLayout title="Edit Patient" action={<ActionBar/>}>
      <div className="max-w-5xl mx-auto pb-12 space-y-5">

        {/* ── Patient Profile ───────────────────────────────────────────── */}
        <SectionCard accentColor="teal" title="Patient Profile"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}>

          {/* Name + Date + Patient No */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Name <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name"
                    className={`input-field ${errors.firstName ? 'border-red-400' : ''}`}/>
                  {errors.firstName && <p className="error-text">{errors.firstName}</p>}
                </div>
                <div>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name"
                    className={`input-field ${errors.lastName ? 'border-red-400' : ''}`}/>
                  {errors.lastName && <p className="error-text">{errors.lastName}</p>}
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Registration Date</label>
              <input type="date" value={form.registrationDate} onChange={e => set('registrationDate', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Patient No.</label>
              <input type="number" value={form.patientNumber} onChange={e => set('patientNumber', e.target.value)} placeholder="Auto" className="input-field font-mono"/>
            </div>
          </div>

          {/* DOB / Age / Sex / Blood / Status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Age <span className="text-xs text-gray-400">(if no DOB)</span></label>
              <input type="number" min="0" max="150"
                value={form.dateOfBirth ? '' : form.ageManual}
                disabled={!!form.dateOfBirth}
                onChange={e => set('ageManual', e.target.value)}
                placeholder={form.dateOfBirth ? 'Auto' : 'e.g. 45'}
                className="input-field disabled:opacity-50"/>
              {form.dateOfBirth && (() => {
                const [y, mo, d] = form.dateOfBirth.split('-').map(Number)
                const today = new Date()
                let age = today.getFullYear() - y
                const m = today.getMonth() - (mo - 1)
                if (m < 0 || (m === 0 && today.getDate() < d)) age--
                return <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium">{age} yrs</p>
              })()}
            </div>
            <div>
              <label className="form-label">Sex</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className="input-field">
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Blood Type</label>
              <select value={form.bloodType} onChange={e => set('bloodType', e.target.value)} className="input-field">
                <option value="">—</option>
                {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
                {['active','inactive','deceased'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Education + Occupation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Education</label>
              <input value={form.education} onChange={e => set('education', e.target.value)} placeholder="e.g. Graduate, Post-graduate" className="input-field"/>
            </div>
            <div>
              <label className="form-label">Occupation</label>
              <input value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="e.g. Engineer, Teacher" className="input-field"/>
            </div>
          </div>

          {/* Phone + Alt Phone + Email */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Mobile No. <span className="text-red-500">*</span></label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXXXXXXX"
                className={`input-field ${errors.phone ? 'border-red-400' : ''}`}/>
              {errors.phone && <p className="error-text">{errors.phone}</p>}
            </div>
            <div>
              <label className="form-label">Alternate Phone</label>
              <input value={form.alternatePhone} onChange={e => set('alternatePhone', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="patient@email.com" className="input-field"/>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="form-label">Address</label>
            <AutoTextarea value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Full address including city, state, zip" className="input-field resize"/>
          </div>

          {/* Marital Status */}
          <div>
            <label className="form-label">Marital Status</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Single','Married','Divorced','Widowed'].map(s => (
                <button key={s} type="button"
                  onClick={() => set('maritalStatus', form.maritalStatus === s.toLowerCase() ? '' : s.toLowerCase())}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.maritalStatus === s.toLowerCase()
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* National ID + Patient ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">National ID</label>
              <input value={form.nationalId} onChange={e => set('nationalId', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Consent</label>
              <label className="flex items-center gap-2 cursor-pointer mt-2.5">
                <input type="checkbox" checked={!!form.consentFormSigned} onChange={e => set('consentFormSigned', e.target.checked)} className="rounded border-gray-300"/>
                <span className="text-sm text-gray-700 dark:text-gray-300">Consent form signed</span>
              </label>
            </div>
          </div>

          {/* Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Reference</label>
              <select value={form.referralSource} onChange={e => set('referralSource', e.target.value)} className="input-field">
                <option value="">Select source…</option>
                {referralSources.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Reference Details</label>
              <input value={form.referralNotes} onChange={e => set('referralNotes', e.target.value)}
                placeholder="e.g. referred by Dr. Sharma" className="input-field"/>
            </div>
          </div>

          {/* Observation */}
          <div>
            <label className="form-label">Observation</label>
            <AutoTextarea value={form.observation} onChange={e => set('observation', e.target.value)}
              placeholder="Doctor's initial observations…" className="input-field resize"/>
          </div>

          {/* Past History */}
          <div>
            <label className="form-label">Past History</label>
            <AutoTextarea value={form.pastHistory} onChange={e => set('pastHistory', e.target.value)}
              placeholder="Significant past medical history, surgeries, hospitalisations…" className="input-field resize"/>
          </div>

          {/* Family History */}
          <div>
            <label className="form-label">Family History</label>
            <AutoTextarea value={form.familyHistory} onChange={e => set('familyHistory', e.target.value)}
              placeholder="Hereditary conditions, family medical background…" className="input-field resize"/>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <AutoTextarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize"/>
          </div>
        </SectionCard>

        {/* ── Medical ──────────────────────────────────────────────────── */}
        <SectionCard accentColor="blue" title="Medical Background"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}>
          <TagInput label="Chronic Conditions" items={form.chronicConditions} onChange={v => set('chronicConditions', v)} suggestions={CONDITION_SUGGESTIONS}/>
          <TagInput label="Allergies" items={form.allergies} onChange={v => set('allergies', v)} suggestions={ALLERGY_SUGGESTIONS}/>
          <TagInput label="Current Medications" items={form.currentMedications} onChange={v => set('currentMedications', v)}/>
        </SectionCard>

        {/* ── Chief Complaints ─────────────────────────────────────────── */}
        <SectionCard accentColor="blue" title="Chief Complaints (C/o)"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>}>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                  {['Complaint (C/O)','Location (LO)','Sensation (S)','Modality (M)','Concomitant (C)'].map(h => (
                    <th key={h} className="px-2 pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-left uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="w-8"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {form.chiefComplaints.map((row, i) => (
                  <tr key={i}>
                    {['complaint','location','sensation','modality','concomitant'].map(field => (
                      <td key={field} className="px-1.5 py-2">
                        <input value={row[field]} onChange={e => setComplaint(i, field, e.target.value)}
                          placeholder="—" className="input-field text-sm py-2 w-full"/>
                      </td>
                    ))}
                    <td className="px-1.5 py-2 text-center">
                      {form.chiefComplaints.length > 1 && (
                        <button type="button" onClick={() => removeComplaint(i)}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xl leading-none transition-colors">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addComplaint}
            className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Another Complaint
          </button>
        </SectionCard>

        {/* ── Physical Generals ────────────────────────────────────────── */}
        <SectionCard accentColor="green" title="Physical Generals"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>}>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50 -mt-2">
            {GENERALS_CONFIG.map(({ key, label }) => (
              <div key={key} className="flex items-start gap-4 py-3">
                <label className="w-28 text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0 pt-2.5">{label}</label>
                <AutoTextarea value={form.generals[key]} onChange={e => setGeneral(key, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}…`} className="input-field flex-1 text-sm py-2 resize"/>
              </div>
            ))}
            {form.customGenerals.map(g => (
              <div key={g.id} className="flex items-start gap-3 py-3">
                <input value={g.label} onChange={e => setCustomGeneral(g.id, 'label', e.target.value)}
                  placeholder="Parameter…" className="input-field w-28 flex-shrink-0 text-sm py-2 font-medium"/>
                <AutoTextarea value={g.value} onChange={e => setCustomGeneral(g.id, 'value', e.target.value)}
                  placeholder="Enter value…" className="input-field flex-1 text-sm py-2 resize"/>
                <button type="button" onClick={() => removeCustomGeneral(g.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xl leading-none mt-2.5 flex-shrink-0 transition-colors">×</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addCustomGeneral}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Another Parameter
          </button>
        </SectionCard>

        {/* ── History of (H/o) ─────────────────────────────────────────── */}
        <SectionCard accentColor="purple" title={`${form.gender === 'female' ? 'Female' : 'Male'} — History of (H/o)`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}>
          <AutoTextarea value={form.historyOf} onChange={e => set('historyOf', e.target.value)}
            placeholder="Gynaecological / obstetric / hormonal / systemic history relevant to the case…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Life Span ─────────────────────────────────────────────────── */}
        <SectionCard accentColor="orange" title="Life Span"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>}>
          <AutoTextarea value={form.lifeSpan} onChange={e => set('lifeSpan', e.target.value)}
            placeholder="Key life events, miasmatic background, constitutional timeline…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Prescription Details ──────────────────────────────────────── */}
        <SectionCard accentColor="teal" title="Prescription Details"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}>
          <AutoTextarea value={form.prescriptionDetails} onChange={e => set('prescriptionDetails', e.target.value)}
            placeholder="Remedy, potency, dosage, repetition, anamnesis, diet restrictions…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <SectionCard accentColor="orange" title="Emergency Contact"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Contact Name</label>
              <input value={form.emergencyContact.name} onChange={e => setEc('name', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input value={form.emergencyContact.phone} onChange={e => setEc('phone', e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="form-label">Relationship</label>
              <input value={form.emergencyContact.relationship} onChange={e => setEc('relationship', e.target.value)} placeholder="e.g. Spouse, Parent…" className="input-field"/>
            </div>
          </div>
        </SectionCard>

        {/* ── Insurance ────────────────────────────────────────────────── */}
        <SectionCard accentColor="green" title="Insurance"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}>
          <div>
            <label className="form-label">Insurance Provider</label>
            <input value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} className="input-field"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Policy Number</label>
              <input value={form.insurancePolicyNumber} onChange={e => set('insurancePolicyNumber', e.target.value)} className="input-field font-mono"/>
            </div>
            <div>
              <label className="form-label">Group Number</label>
              <input value={form.insuranceGroupNumber} onChange={e => set('insuranceGroupNumber', e.target.value)} className="input-field font-mono"/>
            </div>
            <div>
              <label className="form-label">Expiry Date</label>
              <input type="date" value={form.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} className="input-field"/>
            </div>
          </div>
        </SectionCard>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <ActionBar bottom/>

      </div>
    </AppLayout>
  )
}
