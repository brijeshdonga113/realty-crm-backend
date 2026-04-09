'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { visitService } from '@/services/visitService'
import { usePreferences } from '@/hooks/usePreferences'

function EditVisitForm() {
  const router = useRouter()
  const { id } = useParams()
  const { formatDateFull } = usePreferences()

  const [visit, setVisit]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm]       = useState(null)
  const [diagInput, setDiagInput] = useState('')
  const [labInput,  setLabInput]  = useState('')
  const [customDays, setCustomDays] = useState('')
  const [rx, setRx] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })

  useEffect(() => {
    if (!id) return
    visitService.getById(id).then(v => {
      setVisit(v)
      if (v) {
        setForm({
          chiefComplaint: v.chiefComplaint || '',
          history:        v.history || '',
          findings:       v.examination?.findings || '',
          diagnosis:      v.diagnosis || [],
          treatment:      v.treatment || '',
          prescriptions:  v.prescriptions || [],
          labOrders:      v.labOrders || [],
          followUpDate:   v.followUpDate || '',
          notes:          v.notes || '',
          vitalSigns:     v.examination?.vitalSigns || {
            bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: ''
          },
        })
      }
      setLoading(false)
    })
  }, [id])

  const set      = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setVital = (k, v) => setForm(p => ({ ...p, vitalSigns: { ...p.vitalSigns, [k]: v } }))

  const addFollowUpDays = (days) => {
    const d = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    set('followUpDate', d)
  }

  const handleSave = async () => {
    if (!form?.chiefComplaint?.trim()) return
    setSaving(true)
    try {
      await visitService.update(id, {
        chiefComplaint: form.chiefComplaint,
        history:        form.history,
        examination:    { vitalSigns: form.vitalSigns, findings: form.findings },
        diagnosis:      form.diagnosis,
        treatment:      form.treatment,
        prescriptions:  form.prescriptions,
        labOrders:      form.labOrders,
        followUpDate:   form.followUpDate || null,
        notes:          form.notes,
      })
      router.push(visit?.patientId ? `/patients/${visit.patientId}` : '/patients')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <AppLayout title="Edit Visit">
      <div className="flex justify-center items-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading visit…
      </div>
    </AppLayout>
  )

  if (!visit || !form) return (
    <AppLayout title="Visit Not Found">
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Visit not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:underline text-sm">Go back</button>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout
      title={`Edit Visit — ${visit.patientName}`}
      action={
        <button onClick={() => router.back()}
          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5">
          ← Back
        </button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-5 pb-10">

        {/* Visit info banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Editing visit for {visit.patientName}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Original visit: {new Date(visit.visitDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        {/* Clinical info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <h3 className="font-semibold text-gray-900 dark:text-white">Clinical Information</h3>

          <div>
            <label className="form-label">Chief Complaint <span className="text-red-500">*</span></label>
            <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
              placeholder="Patient's main concern" className="input-field"/>
          </div>

          <div>
            <label className="form-label">History of Present Illness</label>
            <textarea value={form.history} onChange={e => set('history', e.target.value)} rows={2}
              placeholder="Detailed history…" className="input-field resize-none"/>
          </div>

          {/* Vitals */}
          <div>
            <p className="form-label">Vital Signs</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['bloodPressure', 'Blood Pressure', 'e.g. 120/80'],
                ['heartRate',     'Heart Rate (bpm)', 'e.g. 72'],
                ['temperature',   'Temp (°C)',        'e.g. 36.6'],
                ['weight',        'Weight (kg)',      'e.g. 70'],
                ['height',        'Height (cm)',      'e.g. 175'],
                ['oxygenSat',     'SpO₂ (%)',         'e.g. 98'],
              ].map(([k, lbl, ph]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{lbl}</label>
                  <input value={form.vitalSigns[k] || ''} onChange={e => setVital(k, e.target.value)}
                    placeholder={ph} className="input-field text-sm py-2"/>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Clinical Findings</label>
            <textarea value={form.findings} onChange={e => set('findings', e.target.value)} rows={2}
              placeholder="Physical examination findings…" className="input-field resize-none"/>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="form-label">Diagnosis</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.diagnosis.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">
                  {d}
                  <button type="button" onClick={() => set('diagnosis', form.diagnosis.filter(x => x !== d))}
                    className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}}
                placeholder="Type and press Enter" className="input-field flex-1"/>
              <button type="button" onClick={() => { if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
            </div>
          </div>

          <div>
            <label className="form-label">Treatment Plan</label>
            <textarea value={form.treatment} onChange={e => set('treatment', e.target.value)} rows={2}
              placeholder="Treatment approach…" className="input-field resize-none"/>
          </div>

          {/* Prescriptions */}
          <div>
            <label className="form-label">Prescriptions</label>
            {form.prescriptions.map((p, i) => (
              <div key={p.id ?? i} className="flex items-start gap-2 mb-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white">{p.medication} — {p.dosage}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{p.frequency} · {p.duration}</p>
                </div>
                <button type="button" onClick={() => set('prescriptions', form.prescriptions.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={rx.medication}  onChange={e => setRx(p => ({...p, medication:  e.target.value}))} placeholder="Medication name"     className="input-field text-sm py-2"/>
              <input value={rx.dosage}      onChange={e => setRx(p => ({...p, dosage:      e.target.value}))} placeholder="Dosage (e.g. 500mg)" className="input-field text-sm py-2"/>
              <input value={rx.frequency}   onChange={e => setRx(p => ({...p, frequency:   e.target.value}))} placeholder="Frequency"          className="input-field text-sm py-2"/>
              <input value={rx.duration}    onChange={e => setRx(p => ({...p, duration:    e.target.value}))} placeholder="Duration"            className="input-field text-sm py-2"/>
            </div>
            <input value={rx.instructions} onChange={e => setRx(p => ({...p, instructions: e.target.value}))}
              placeholder="Special instructions" className="input-field text-sm py-2 mb-2"/>
            <button type="button" onClick={() => {
              if (rx.medication.trim()) {
                set('prescriptions', [...form.prescriptions, { ...rx, id: `${Date.now()}` }])
                setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
              }
            }} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">+ Add prescription</button>
          </div>

          {/* Lab Orders */}
          <div>
            <label className="form-label">Lab Orders</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.labOrders.map(l => (
                <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                  {l}
                  <button type="button" onClick={() => set('labOrders', form.labOrders.filter(x => x !== l))}
                    className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={labInput} onChange={e => setLabInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}}
                placeholder="Lab test name" className="input-field flex-1 text-sm py-2"/>
              <button type="button" onClick={() => { if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Additional notes…" className="input-field resize-none"/>
          </div>
        </div>

        {/* Follow-up date */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Follow-up Date</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Quick intervals or pick a custom date</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {[[7,'+7'],[10,'+10'],[15,'+15'],[21,'+21'],[30,'+30']].map(([days, label]) => (
              <button key={days} type="button" onClick={() => addFollowUpDays(days)}
                className="text-xs px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 rounded-lg font-medium transition-colors">
                {label}d
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input type="number" min="1" max="365" value={customDays} onChange={e => setCustomDays(e.target.value)}
                placeholder="Custom" className="input-field text-xs py-1.5 w-20"/>
              <button type="button"
                onClick={() => { const d = parseInt(customDays); if (d > 0) { addFollowUpDays(d); setCustomDays('') } }}
                disabled={!customDays || parseInt(customDays) < 1}
                className="text-xs px-2.5 py-1.5 bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 rounded-lg font-medium disabled:opacity-40 transition-colors">
                Set
              </button>
            </div>
          </div>
          <input type="date" value={form.followUpDate}
            onChange={e => set('followUpDate', e.target.value)} className="input-field"/>
          {form.followUpDate && (
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                📅 {formatDateFull(form.followUpDate)}
              </p>
              <button type="button" onClick={() => set('followUpDate', '')}
                className="text-xs text-gray-400 hover:text-red-500">Clear</button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={saving || !form.chiefComplaint.trim()}
            className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            {saving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

export default function EditVisitPage() {
  return (
    <Suspense>
      <EditVisitForm />
    </Suspense>
  )
}
