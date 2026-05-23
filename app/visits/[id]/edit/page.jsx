'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { useInventory } from '@/hooks/useInventory'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuth } from '@/context/AuthContext'
import { visitService } from '@/services/visitService'
import AutoTextarea from '@/components/ui/AutoTextarea'
import { getDiagnosisSuggestions } from '@/lib/specialtyPresets'

function EditVisitForm() {
  const router = useRouter()
  const { id } = useParams()
  const { formatDateFull } = usePreferences()
  const { doctor } = useAuth()

  const [visit,   setVisit]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState(null)

  const [diagInput,  setDiagInput]  = useState('')
  const [labInput,   setLabInput]   = useState('')
  const [customDays, setCustomDays] = useState('')
  const [rx, setRx] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
  const [expandedVisitId, setExpandedVisitId] = useState(null)

  // Load the visit being edited
  useEffect(() => {
    if (!id) return
    visitService.getById(id).then(v => {
      setVisit(v)
      if (v) {
        setForm({
          visitDate:      v.visitDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
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
            bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '',
          },
        })
      }
      setLoading(false)
    })
  }, [id])

  const patientId = visit?.patientId || ''
  const { patient } = usePatient(patientId)
  const { visits: allVisits, loading: visitsLoading } = useVisits(patientId)
  const { items: inventoryItems } = useInventory()

  // Past visits excluding the one being edited
  const pastVisits = (allVisits ?? []).filter(v => v.status !== 'draft' && v.id !== id)

  const set      = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setVital = (k, v) => setForm(p => ({ ...p, vitalSigns: { ...p.vitalSigns, [k]: v } }))

  const addFollowUpDays = (days) => {
    const base = form.visitDate ? new Date(form.visitDate) : new Date()
    const d = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10)
    set('followUpDate', d)
  }

  const handleSave = async () => {
    if (!form?.chiefComplaint?.trim()) return
    const finalPrescriptions = rx.medication.trim()
      ? [...form.prescriptions, { ...rx, id: `${Date.now()}` }]
      : form.prescriptions
    if (rx.medication.trim()) setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })

    setSaving(true)
    setSaveError('')
    try {
      await visitService.update(id, {
        chiefComplaint: form.chiefComplaint,
        history:        form.history,
        examination:    { vitalSigns: form.vitalSigns, findings: form.findings },
        diagnosis:      form.diagnosis,
        treatment:      form.treatment,
        prescriptions:  finalPrescriptions,
        labOrders:      form.labOrders,
        followUpDate:   form.followUpDate || null,
        notes:          form.notes,
      }, patientId || null)
      router.push(patientId ? `/patients/${patientId}` : '/patients')
    } catch (err) {
      setSaveError(err?.message || 'Failed to save. Please try again.')
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
      <div className="max-w-6xl mx-auto pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

      {/* ── Left: Form ── */}
      <div className="space-y-5">

        {/* Edit banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Editing visit for {visit.patientName}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Original: {new Date(visit.visitDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        {/* Patient banner */}
        {patient && (
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 dark:text-primary-300 font-bold text-sm">
                {patient.firstName?.[0]}{patient.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {patient.phone}
                {patient.bloodType && ` · ${patient.bloodType}`}
                {patient.chronicConditions?.length > 0 && ` · ${patient.chronicConditions.join(', ')}`}
              </p>
            </div>
            <button onClick={() => router.push(`/patients/${patientId}`)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium flex-shrink-0">
              View Profile →
            </button>
          </div>
        )}

        {/* Clinical info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Clinical Information</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Visit Date</label>
              <input type="date" value={form.visitDate}
                onChange={e => set('visitDate', e.target.value)}
                className="input-field text-sm py-1.5 w-auto"/>
            </div>
          </div>

          <div>
            <label className="form-label">Chief Complaint <span className="text-red-500">*</span></label>
            <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
              placeholder="Patient's main concern" className="input-field"/>
          </div>

          <div>
            <label className="form-label">History of Present Illness</label>
            <AutoTextarea value={form.history} onChange={e => set('history', e.target.value)}
              placeholder="Detailed history, existing conditions, onset, duration…"
              className="input-field resize"/>
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
            <AutoTextarea value={form.findings} onChange={e => set('findings', e.target.value)}
              placeholder="Physical examination findings…" className="input-field resize"/>
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
            <div className="flex gap-2 mb-2">
              <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}}
                placeholder="Type and press Enter" className="input-field flex-1"/>
              <button type="button" onClick={() => { if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getDiagnosisSuggestions(doctor?.specialization)
                .filter(s => !form.diagnosis.includes(s) && (!diagInput || s.toLowerCase().includes(diagInput.toLowerCase())))
                .map(s => (
                  <button key={s} type="button"
                    onClick={() => { set('diagnosis', [...form.diagnosis, s]); setDiagInput('') }}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-300 rounded-full transition-colors">
                    + {s}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label className="form-label">Treatment Plan</label>
            <AutoTextarea value={form.treatment} onChange={e => set('treatment', e.target.value)}
              placeholder="Treatment approach…" className="input-field resize"/>
          </div>

          {/* Prescriptions */}
          <div>
            <label className="form-label">Prescriptions</label>
            {form.prescriptions.map((p, i) => (
              <div key={p.id ?? i} className="flex items-start gap-2 mb-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white">{p.medication} — {p.dosage}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{p.frequency} · {p.duration}</p>
                  {p.instructions && <p className="text-gray-400 dark:text-gray-500 text-xs italic">{p.instructions}</p>}
                </div>
                <button type="button" onClick={() => set('prescriptions', form.prescriptions.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="relative">
                <input value={rx.medication}
                  onChange={e => setRx(p => ({...p, medication: e.target.value}))}
                  placeholder="Medication name"
                  className="input-field text-sm py-2 w-full"
                  autoComplete="off"
                />
                {rx.medication.trim().length > 0 && (() => {
                  const q = rx.medication.toLowerCase()
                  const matches = inventoryItems.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8)
                  return matches.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                      {matches.map(it => (
                        <button key={it.id} type="button"
                          onMouseDown={() => setRx(p => ({...p, medication: it.name}))}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-between gap-2 transition-colors">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{it.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{it.category || it.unit || ''}</span>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
              <input value={rx.dosage}    onChange={e => setRx(p => ({...p, dosage:    e.target.value}))} placeholder="Dosage (e.g. 500mg)"        className="input-field text-sm py-2"/>
              <input value={rx.frequency} onChange={e => setRx(p => ({...p, frequency: e.target.value}))} placeholder="Frequency (e.g. Twice daily)" className="input-field text-sm py-2"/>
              <input value={rx.duration}  onChange={e => setRx(p => ({...p, duration:  e.target.value}))} placeholder="Duration (e.g. 7 days)"      className="input-field text-sm py-2"/>
            </div>
            <input value={rx.instructions} onChange={e => setRx(p => ({...p, instructions: e.target.value}))}
              placeholder="Special instructions (e.g. Take after meals)" className="input-field text-sm py-2 mb-2"/>
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
            <AutoTextarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes…" className="input-field resize"/>
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
              <input type="number" min="1" max="365" value={customDays}
                onChange={e => setCustomDays(e.target.value)}
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
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ({Math.round((new Date(form.followUpDate) - new Date()) / 86400000)} days from today)
              </p>
              <button type="button" onClick={() => set('followUpDate', '')}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear</button>
            </div>
          )}
        </div>

        {/* Actions */}
        {saveError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}
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

      </div>{/* end form column */}

      {/* ── Right: Visit History ── */}
      <div className="xl:sticky xl:top-4 space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Visit History</h3>
            {!visitsLoading && (
              <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                {pastVisits.length} {pastVisits.length === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>

          {visitsLoading ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {[1,2,3].map(i => (
                <div key={i} className="p-4 space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24"/>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-40"/>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32"/>
                </div>
              ))}
            </div>
          ) : pastVisits.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">No other visits</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
              {pastVisits.map(v => {
                const vDate = v.visitDate ? new Date(v.visitDate) : null
                const dateStr = vDate
                  ? vDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                const vitals = v.examination?.vitalSigns ?? {}
                const vitalPairs = [
                  ['BP', vitals.bloodPressure],
                  ['HR', vitals.heartRate ? `${vitals.heartRate} bpm` : ''],
                  ['Temp', vitals.temperature ? `${vitals.temperature}°C` : ''],
                  ['Wt', vitals.weight ? `${vitals.weight} kg` : ''],
                  ['Ht', vitals.height ? `${vitals.height} cm` : ''],
                  ['SpO₂', vitals.oxygenSat ? `${vitals.oxygenSat}%` : ''],
                ].filter(([, val]) => val)
                const isExpanded = expandedVisitId === v.id
                return (
                  <div key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <button type="button"
                      onClick={() => setExpandedVisitId(isExpanded ? null : v.id)}
                      className="w-full text-left p-4 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{dateStr}</p>
                        <div className="flex items-center gap-1.5">
                          {v.followUpDate && (
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded font-medium">
                              FU {new Date(v.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>
                      {v.chiefComplaint && (
                        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium leading-snug mb-1.5">{v.chiefComplaint}</p>
                      )}
                      {(v.diagnosis ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {v.diagnosis.map(d => (
                            <span key={d} className="text-[10px] px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded font-medium">{d}</span>
                          ))}
                        </div>
                      )}
                      {!isExpanded && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(v.prescriptions ?? []).length > 0 && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded font-medium">{v.prescriptions.length} Rx</span>
                          )}
                          {(v.labOrders ?? []).length > 0 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded font-medium">{v.labOrders.length} Lab</span>
                          )}
                          {vitalPairs.slice(0, 2).map(([lbl, val]) => (
                            <span key={lbl} className="text-[10px] text-gray-400 dark:text-gray-500">{lbl} {val}</span>
                          ))}
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-50 dark:border-gray-700/50 pt-3">
                        {v.history && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">History</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.history}</p>
                          </div>
                        )}
                        {v.examination?.findings && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Findings</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.examination.findings}</p>
                          </div>
                        )}
                        {v.treatment && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Treatment</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.treatment}</p>
                          </div>
                        )}
                        {(v.prescriptions ?? []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Prescriptions</p>
                            <div className="space-y-1.5">
                              {v.prescriptions.map(rx => (
                                <div key={rx.id} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-2.5 py-1.5">
                                  <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">{rx.medication}{rx.dosage && ` — ${rx.dosage}`}</p>
                                  {(rx.frequency || rx.duration) && (
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400">{[rx.frequency, rx.duration].filter(Boolean).join(' · ')}</p>
                                  )}
                                  {rx.instructions && (
                                    <p className="text-[10px] text-purple-500 italic">{rx.instructions}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(v.labOrders ?? []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Lab Orders</p>
                            <div className="flex flex-wrap gap-1">
                              {v.labOrders.map(l => (
                                <span key={l} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded font-medium">{l}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {vitalPairs.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Vitals</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {vitalPairs.map(([lbl, val]) => (
                                <div key={lbl} className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 w-10 flex-shrink-0">{lbl}</span>
                                  <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {v.notes && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Notes</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      </div>{/* end grid */}
      </div>{/* end max-w-6xl */}
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
