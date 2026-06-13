'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatients } from '@/hooks/usePatients'
import { BLOOD_TYPES } from '@/models/Patient'
import { patientService } from '@/services/patientService'
import { useReferralSources } from '@/hooks/useReferralSources'
import AutoTextarea from '@/components/ui/AutoTextarea'
import { useAuth } from '@/context/AuthContext'

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

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function NewCaseForm() {
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const { doctor }        = useAuth()
  const { add, patients } = usePatients()
  const referralSources   = useReferralSources()

  useEffect(() => {
    if (doctor?.viewOnly) router.replace('/patients')
  }, [doctor?.viewOnly])

  const [loading,      setLoading]      = useState(false)
  const [errors,       setErrors]       = useState({})
  const [saveError,    setSaveError]    = useState('')
  const [duplicates,   setDuplicates]   = useState([])
  const [forceSubmit,  setForceSubmit]  = useState(false)

  const [form, setFormState] = useState({
    patientNumber:    '',
    registrationDate: new Date().toISOString().slice(0, 10),
    // Profile
    firstName: '', lastName: '',
    dateOfBirth: '', ageManual: '', gender: 'male', bloodType: '',
    education: '', occupation: '', maritalStatus: '',
    phone: '', alternatePhone: '', email: '', address: '',
    referralSource: '', referralNotes: '',
    // Clinical intake
    observation: '', pastHistory: '', familyHistory: '',
    // Chief complaints
    chiefComplaints: [{ ...EMPTY_COMPLAINT }],
    // Physical generals
    generals: {
      appetite: '', taste: '', thirst: '', urine: '', stool: '',
      thermal: '', perspiration: '', speed: '', fastidious: '', sleep: '', dreams: '',
    },
    customGenerals: [],
    // History sections
    historyOf: '', lifeSpan: '', prescriptionDetails: '',
    // Meta / other
    status: 'active', notes: '',
    allergies: [], chronicConditions: [], currentMedications: [],
    nationalId: '',
    emergencyContact: { name: '', phone: '', relationship: '' },
    insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '', insuranceGroupNumber: '',
    consentFormSigned: false,
  })

  useEffect(() => {
    const name  = searchParams.get('name')  || ''
    const phone = searchParams.get('phone') || ''
    if (name || phone) {
      const parts = name.trim().split(' ')
      setFormState(p => ({
        ...p,
        firstName: parts[0] ?? '',
        lastName:  parts.slice(1).join(' '),
        ...(phone ? { phone } : {}),
      }))
    }
  }, [searchParams])

  useEffect(() => {
    patientService.peekNextPatientNumber().then(n => {
      setFormState(p => ({ ...p, patientNumber: String(n) }))
    }).catch(() => {})
  }, [])

  const set = (k, v) => {
    setFormState(p => ({ ...p, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    if (['firstName', 'lastName', 'phone'].includes(k)) {
      setDuplicates([])
      setForceSubmit(false)
    }
  }

  const setGeneral   = (k, v) => setFormState(p => ({ ...p, generals: { ...p.generals, [k]: v } }))

  const setComplaint = (i, field, v) =>
    setFormState(p => {
      const list = [...p.chiefComplaints]
      list[i] = { ...list[i], [field]: v }
      return { ...p, chiefComplaints: list }
    })

  const addComplaint    = () => setFormState(p => ({ ...p, chiefComplaints: [...p.chiefComplaints, { ...EMPTY_COMPLAINT }] }))
  const removeComplaint = (i) => setFormState(p => ({ ...p, chiefComplaints: p.chiefComplaints.filter((_, j) => j !== i) }))

  const addCustomGeneral    = () => setFormState(p => ({ ...p, customGenerals: [...p.customGenerals, { id: Date.now().toString(36), label: '', value: '' }] }))
  const removeCustomGeneral = (id) => setFormState(p => ({ ...p, customGenerals: p.customGenerals.filter(g => g.id !== id) }))
  const setCustomGeneral    = (id, field, v) =>
    setFormState(p => ({ ...p, customGenerals: p.customGenerals.map(g => g.id === id ? { ...g, [field]: v } : g) }))

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim())  errs.lastName  = 'Required'
    if (!form.phone.trim())     errs.phone     = 'Required'
    return errs
  }

  const handleSubmit = async (checkDuplicate = true) => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    if (checkDuplicate && !forceSubmit) {
      const nameMatch  = `${form.firstName} ${form.lastName}`.toLowerCase()
      const phoneDigits = form.phone.replace(/\D/g, '')
      const found = patients.filter(p => {
        const pName  = `${p.firstName} ${p.lastName}`.toLowerCase()
        const pPhone = (p.phone || '').replace(/\D/g, '')
        return pName === nameMatch || (phoneDigits && pPhone === phoneDigits)
      })
      if (found.length) { setDuplicates(found); return }
    }

    setSaveError('')
    setLoading(true)
    try {
      const saved = await add({
        ...form,
        patientNumber: form.patientNumber ? Number(form.patientNumber) : undefined,
        createdAt: form.registrationDate ? new Date(form.registrationDate).toISOString() : undefined,
      })
      router.push(`/patients/${saved.id}`)
    } catch (err) {
      setSaveError(err?.message || 'Failed to save. Please try again.')
      setLoading(false)
    }
  }

  const ActionButtons = ({ compact = false }) => (
    <div className={`flex items-center gap-2 ${compact ? '' : 'justify-end'}`}>
      <button type="button" onClick={() => router.back()}
        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancel
      </button>
      <button type="button" onClick={() => handleSubmit(false)} disabled={loading}
        className="px-4 py-2 border border-amber-300 dark:border-amber-600 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60 flex items-center gap-2">
        {loading && <Spinner/>}
        Save Draft
      </button>
      <button type="button" onClick={() => handleSubmit(true)} disabled={loading}
        className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60">
        {loading ? <Spinner/> : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        )}
        Finalize Case
      </button>
    </div>
  )

  return (
    <AppLayout
      title="New Case"
      action={<ActionButtons compact/>}
    >
      <div className="max-w-5xl mx-auto pb-12 space-y-5">

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create a high-fidelity digital case record. Complete all clinical parameters to ensure holistic remedy selection.
        </p>

        {saveError && (
          <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
              ⚠ Possible duplicate{duplicates.length > 1 ? 's' : ''} found
            </p>
            <div className="space-y-1.5 mb-3">
              {duplicates.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-sm text-amber-700 dark:text-amber-300">{p.firstName} {p.lastName} · {p.phone}</span>
                  <button type="button" onClick={() => router.push(`/patients/${p.id}`)}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                    Open →
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDuplicates([]); setForceSubmit(true) }}
                className="text-xs font-semibold px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors">
                Save anyway (new patient)
              </button>
              <button type="button" onClick={() => setDuplicates([])}
                className="text-xs font-medium px-3 py-1.5 text-amber-700 dark:text-amber-400 hover:underline">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Patient Profile ───────────────────────────────────────────────── */}
        <SectionCard
          accentColor="teal"
          title="Patient Profile"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          }
        >
          {/* Name + Date + Patient No */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Name <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    placeholder="First name"
                    className={`input-field ${errors.firstName ? 'border-red-400' : ''}`}/>
                  {errors.firstName && <p className="error-text">{errors.firstName}</p>}
                </div>
                <div>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    placeholder="Last name"
                    className={`input-field ${errors.lastName ? 'border-red-400' : ''}`}/>
                  {errors.lastName && <p className="error-text">{errors.lastName}</p>}
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" value={form.registrationDate} onChange={e => set('registrationDate', e.target.value)}
                className="input-field"/>
            </div>
            <div>
              <label className="form-label">
                Patient No. <span className="text-xs text-gray-400 font-normal">(auto)</span>
              </label>
              <input type="number" value={form.patientNumber} onChange={e => set('patientNumber', e.target.value)}
                placeholder="Auto" className="input-field font-mono"/>
            </div>
          </div>

          {/* DOB / Age / Sex / Blood */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                className="input-field"/>
            </div>
            <div>
              <label className="form-label">Age <span className="text-xs text-gray-400">(if no DOB)</span></label>
              <input type="number" min="0" max="150"
                value={form.dateOfBirth ? '' : form.ageManual}
                disabled={!!form.dateOfBirth}
                onChange={e => set('ageManual', e.target.value)}
                placeholder={form.dateOfBirth ? 'Auto' : 'e.g. 45'}
                className="input-field disabled:opacity-50"/>
              {form.dateOfBirth && (
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium">
                  {(() => {
                    const [y, mo, d] = form.dateOfBirth.split('-').map(Number)
                    const today = new Date()
                    let age = today.getFullYear() - y
                    const m = today.getMonth() - (mo - 1)
                    if (m < 0 || (m === 0 && today.getDate() < d)) age--
                    return `${age} yrs`
                  })()}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Sex</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className="input-field">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Blood Type</label>
              <select value={form.bloodType} onChange={e => set('bloodType', e.target.value)} className="input-field">
                <option value="">—</option>
                {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Education + Occupation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Education</label>
              <input value={form.education} onChange={e => set('education', e.target.value)}
                placeholder="e.g. Graduate, Post-graduate" className="input-field"/>
            </div>
            <div>
              <label className="form-label">Occupation</label>
              <input value={form.occupation} onChange={e => set('occupation', e.target.value)}
                placeholder="e.g. Engineer, Teacher" className="input-field"/>
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Mobile No. <span className="text-red-500">*</span></label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                className={`input-field ${errors.phone ? 'border-red-400' : ''}`}/>
              {errors.phone && <p className="error-text">{errors.phone}</p>}
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="patient@email.com" className="input-field"/>
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
              {['Single', 'Married', 'Divorced', 'Widowed'].map(s => (
                <button key={s} type="button"
                  onClick={() => set('maritalStatus', form.maritalStatus === s.toLowerCase() ? '' : s.toLowerCase())}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.maritalStatus === s.toLowerCase()
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}>
                  {s}
                </button>
              ))}
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
        </SectionCard>

        {/* ── Chief Complaints ─────────────────────────────────────────────── */}
        <SectionCard
          accentColor="blue"
          title="Chief Complaints (C/o)"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
          }
        >
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                  {[
                    'Complaint (C/O)',
                    'Location (LO)',
                    'Sensation (S)',
                    'Modality (M)',
                    'Concomitant (C)',
                  ].map(h => (
                    <th key={h} className="px-2 pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-left uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                  <th className="w-8"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {form.chiefComplaints.map((row, i) => (
                  <tr key={i}>
                    {['complaint', 'location', 'sensation', 'modality', 'concomitant'].map(field => (
                      <td key={field} className="px-1.5 py-2">
                        <input
                          value={row[field]}
                          onChange={e => setComplaint(i, field, e.target.value)}
                          placeholder="—"
                          className="input-field text-sm py-2 w-full"
                        />
                      </td>
                    ))}
                    <td className="px-1.5 py-2 text-center">
                      {form.chiefComplaints.length > 1 && (
                        <button type="button" onClick={() => removeComplaint(i)}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xl leading-none transition-colors">
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addComplaint}
            className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Another Complaint
          </button>
        </SectionCard>

        {/* ── Physical Generals ────────────────────────────────────────────── */}
        <SectionCard
          accentColor="green"
          title="Physical Generals"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          }
        >
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50 -mt-2">
            {GENERALS_CONFIG.map(({ key, label }) => (
              <div key={key} className="flex items-start gap-4 py-3">
                <label className="w-28 text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0 pt-2.5">
                  {label}
                </label>
                <AutoTextarea
                  value={form.generals[key]}
                  onChange={e => setGeneral(key, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                  className="input-field flex-1 text-sm py-2 resize"
                />
              </div>
            ))}

            {form.customGenerals.map(g => (
              <div key={g.id} className="flex items-start gap-3 py-3">
                <input
                  value={g.label}
                  onChange={e => setCustomGeneral(g.id, 'label', e.target.value)}
                  placeholder="Parameter…"
                  className="input-field w-28 flex-shrink-0 text-sm py-2 font-medium"
                />
                <AutoTextarea
                  value={g.value}
                  onChange={e => setCustomGeneral(g.id, 'value', e.target.value)}
                  placeholder="Enter value…"
                  className="input-field flex-1 text-sm py-2 resize"
                />
                <button type="button" onClick={() => removeCustomGeneral(g.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xl leading-none mt-2.5 flex-shrink-0 transition-colors">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addCustomGeneral}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Another Parameter
          </button>
        </SectionCard>

        {/* ── History of (H/o) ─────────────────────────────────────────────── */}
        <SectionCard
          accentColor="purple"
          title={`${form.gender === 'female' ? 'Female' : 'Male'} — History of (H/o)`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          }
        >
          <AutoTextarea value={form.historyOf} onChange={e => set('historyOf', e.target.value)}
            placeholder="Gynaecological / obstetric / hormonal / systemic history relevant to the case…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Life Span ─────────────────────────────────────────────────────── */}
        <SectionCard
          accentColor="orange"
          title="Life Span"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          }
        >
          <AutoTextarea value={form.lifeSpan} onChange={e => set('lifeSpan', e.target.value)}
            placeholder="Key life events, miasmatic background, constitutional timeline…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Prescription Details ──────────────────────────────────────────── */}
        <SectionCard
          accentColor="teal"
          title="Prescription Details"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          }
        >
          <AutoTextarea value={form.prescriptionDetails} onChange={e => set('prescriptionDetails', e.target.value)}
            placeholder="Remedy, potency, dosage, repetition, anamnesis, diet restrictions…"
            className="input-field resize min-h-[96px]"/>
        </SectionCard>

        {/* ── Footer Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            ← Cancel
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => handleSubmit(false)} disabled={loading}
              className="px-5 py-2.5 border border-amber-300 dark:border-amber-600 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60 flex items-center gap-2">
              {loading && <Spinner/>}
              Save Draft
            </button>
            <button type="button" onClick={() => handleSubmit(true)} disabled={loading}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60">
              {loading ? <Spinner/> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              )}
              Finalize Case
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}

export default function NewPatientPage() {
  return (
    <Suspense>
      <NewCaseForm />
    </Suspense>
  )
}
