'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatients } from '@/hooks/usePatients'
import { BLOOD_TYPES, GENDERS } from '@/models/Patient'

const SPECIALIZATIONS = ['Hypertension', 'Diabetes Type 1', 'Diabetes Type 2', 'Asthma', 'COPD', 'Arthritis', 'Heart Disease', 'Thyroid Disorder', 'Cancer', 'Epilepsy', 'Depression', 'Anxiety']
const ALLERGIES_LIST  = ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Latex', 'Pollen', 'Dust mites', 'Pet dander', 'Peanuts', 'Shellfish', 'Eggs', 'Milk']

function TagInput({ label, items, onChange, suggestions }) {
  const [input, setInput] = useState('')
  const add = (val) => {
    const trimmed = val.trim()
    if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed])
    setInput('')
  }
  const remove = (item) => onChange(items.filter(i => i !== item))
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full font-medium">
            {item}
            <button type="button" onClick={() => remove(item)} className="hover:text-primary-900">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder="Type and press Enter"
          className="input-field flex-1"
          list={`${label}-suggestions`}
        />
        <datalist id={`${label}-suggestions`}>
          {suggestions?.map(s => <option key={s} value={s}/>)}
        </datalist>
        <button type="button" onClick={() => add(input)}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
          Add
        </button>
      </div>
    </div>
  )
}

const TABS = ['Basic Info', 'Medical', 'Insurance', 'Emergency']

function Field({ name, label, type = 'text', placeholder, required, nested, options, form, errors, set, setNested }) {
  const value = nested ? form[nested][name] : form[name]
  const onChange = nested
    ? (e) => setNested(nested, name, e.target.value)
    : (e) => set(name, e.target.value)
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {options ? (
        <select value={value} onChange={onChange} className={`input-field ${errors[name] ? 'border-red-400' : ''}`}>
          <option value="">Select…</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          className={`input-field ${errors[name] ? 'border-red-400' : ''}`}/>
      )}
      {errors[name] && <p className="error-text">{errors[name]}</p>}
    </div>
  )
}

export default function NewPatientPage() {
  const router = useRouter()
  const { add } = usePatients()
  const [tab, setTab]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: 'male', bloodType: '',
    nationalId: '', phone: '', alternatePhone: '', email: '', address: '',
    allergies: [], chronicConditions: [], currentMedications: [],
    familyHistory: '', notes: '', status: 'active',
    insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '', insuranceGroupNumber: '',
    consentFormSigned: false,
    emergencyContact: { name: '', phone: '', relationship: '' },
  })

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const setNested = (parent, field, value) =>
    setForm(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }))

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim())  errs.lastName  = 'Required'
    if (!form.phone.trim())     errs.phone     = 'Required'
    if (!form.gender)           errs.gender    = 'Required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); setTab(0); return }
    setLoading(true)
    try {
      const patient = await add(form)
      router.push(`/patients/${patient.id}`)
    } finally {
      setLoading(false)
    }
  }

  const fieldProps = { form, errors, set, setNested }

  return (
    <AppLayout title="Add New Patient"
      action={
        <button onClick={() => router.back()}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">
          ← Back
        </button>
      }
    >
      <div className="max-w-3xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === i ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">

            {/* Tab 0: Basic Info */}
            {tab === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field name="firstName" label="First Name" placeholder="John" required {...fieldProps} />
                  <Field name="lastName" label="Last Name" placeholder="Smith" required {...fieldProps} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field name="dateOfBirth" label="Date of Birth" type="date" {...fieldProps} />
                  <Field name="gender" label="Gender" required options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]} {...fieldProps} />
                  <Field name="bloodType" label="Blood Type" options={BLOOD_TYPES.map(b => ({ value: b, label: b }))} {...fieldProps} />
                </div>
                <Field name="nationalId" label="National ID / Patient ID" placeholder="e.g. PAN, Aadhaar, Passport" {...fieldProps} />
                <div className="grid grid-cols-2 gap-4">
                  <Field name="phone" label="Phone Number" placeholder="+1 234 567 8900" required {...fieldProps} />
                  <Field name="alternatePhone" label="Alternate Phone" placeholder="+1 234 567 8901" {...fieldProps} />
                </div>
                <Field name="email" label="Email Address" type="email" placeholder="patient@email.com" {...fieldProps} />
                <div>
                  <label className="form-label">Address</label>
                  <textarea value={form.address} onChange={e => set('address', e.target.value)}
                    placeholder="Full address including city, state, zip" rows={2}
                    className="input-field resize-none"/>
                </div>
                <Field name="status" label="Patient Status" options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]} {...fieldProps} />
              </>
            )}

            {/* Tab 1: Medical */}
            {tab === 1 && (
              <>
                <TagInput label="Allergies" items={form.allergies} onChange={v => set('allergies', v)} suggestions={ALLERGIES_LIST} />
                <TagInput label="Chronic Conditions" items={form.chronicConditions} onChange={v => set('chronicConditions', v)} suggestions={SPECIALIZATIONS} />
                <TagInput label="Current Medications" items={form.currentMedications} onChange={v => set('currentMedications', v)} />
                <div>
                  <label className="form-label">Family History</label>
                  <textarea value={form.familyHistory} onChange={e => set('familyHistory', e.target.value)}
                    placeholder="Any relevant family medical history…" rows={3} className="input-field resize-none"/>
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="General notes about this patient…" rows={3} className="input-field resize-none"/>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="consent" checked={form.consentFormSigned}
                    onChange={e => set('consentFormSigned', e.target.checked)}
                    className="w-4 h-4 accent-primary-600"/>
                  <label htmlFor="consent" className="text-sm text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                    Patient has signed the consent form
                  </label>
                </div>
              </>
            )}

            {/* Tab 2: Insurance */}
            {tab === 2 && (
              <>
                <Field name="insuranceProvider" label="Insurance Provider" placeholder="e.g. BlueCross, Aetna" {...fieldProps} />
                <div className="grid grid-cols-2 gap-4">
                  <Field name="insurancePolicyNumber" label="Policy Number" placeholder="POL-123456" {...fieldProps} />
                  <Field name="insuranceGroupNumber" label="Group Number" placeholder="GRP-789" {...fieldProps} />
                </div>
                <Field name="insuranceExpiry" label="Policy Expiry Date" type="date" {...fieldProps} />
              </>
            )}

            {/* Tab 3: Emergency Contact */}
            {tab === 3 && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">Emergency contact details for this patient.</p>
                <Field name="name" label="Contact Name" placeholder="Jane Smith" nested="emergencyContact" {...fieldProps} />
                <div className="grid grid-cols-2 gap-4">
                  <Field name="phone" label="Contact Phone" placeholder="+1 234 567 8900" nested="emergencyContact" {...fieldProps} />
                  <Field name="relationship" label="Relationship" placeholder="e.g. Spouse, Parent" nested="emergencyContact" {...fieldProps} />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {tab > 0 && (
                <button type="button" onClick={() => setTab(t => t - 1)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  ← Previous
                </button>
              )}
              {tab < TABS.length - 1 && (
                <button type="button" onClick={() => setTab(t => t + 1)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors">
                  Next →
                </button>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-auto px-6">
              {loading ? 'Saving…' : 'Save Patient'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
