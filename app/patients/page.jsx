'use client'
import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { usePatients } from '@/hooks/usePatients'
import { useBilling } from '@/hooks/useBilling'
import { useFollowUps } from '@/hooks/useFollowUps'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { useAuth } from '@/context/AuthContext'
import { getPatientAge, getPatientInitials } from '@/models/Patient'
import { buildWAUrl } from '@/lib/whatsapp'
import { getReferralSources } from '@/lib/referralSources'
import { importPatientsCsv, CSV_HEADERS } from '@/lib/patientCsvUtils'
import { patientService } from '@/services/patientService'
import { visitService } from '@/services/visitService'

export default function PatientsPage() {
  const router = useRouter()
  const { doctor } = useAuth()
  const { patients, loading, remove, search } = usePatients()
  const { invoices } = useBilling()
  const { add: addFollowUp } = useFollowUps()
  const { blockedSlots }     = useBlockedSlots()
  const [query, setQuery]               = useState('')
  const [deleteId, setDeleteId]         = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey]           = useState(null)
  const [sortDir, setSortDir]           = useState('asc')
  const [followUpPatient, setFollowUpPatient] = useState(null)
  const [followUpForm, setFollowUpForm]       = useState({ dueDate: '', note: '' })
  const [followUpSaving, setFollowUpSaving]   = useState(false)
  const [filterOpen, setFilterOpen]     = useState(false)
  const [visibleCols, setVisibleCols]   = useState({
    uhid: true, ageGender: true, source: true, phone: true,
    invoice: true, visits: true, duebills: true, whatsapp: true, followup: true,
  })
  const [activeFilters, setActiveFilters] = useState({ gender: [], source: [], ageRange: '' })

  const toggleCol    = (col) => setVisibleCols(v => ({ ...v, [col]: !v[col] }))
  const toggleFilter = (group, val) => setActiveFilters(f => ({
    ...f,
    [group]: f[group].includes(val) ? f[group].filter(x => x !== val) : [...f[group], val],
  }))
  const activeFilterCount = activeFilters.gender.length + activeFilters.source.length + (activeFilters.ageRange ? 1 : 0)

  // Import state
  const importRef = useRef(null)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState(null) // { imported, skipped, errors }
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [promptCopied, setPromptCopied]       = useState(false)

  const CHATGPT_PROMPT = `You are a data conversion assistant. Convert the patient data I paste below into a CSV file that exactly matches the following format.

REQUIRED COLUMN HEADERS (use these exact names, in this exact order):
UHID,First Name,Last Name,Date of Birth,Gender,Blood Type,National ID,Phone,Alternate Phone,Email,Address,Allergies,Chronic Conditions,Current Medications,Family History,Emergency Contact Name,Emergency Contact Phone,Emergency Contact Relationship,Insurance Provider,Insurance Policy Number,Insurance Expiry,Insurance Group Number,Referral Source,Referral Notes,Status,Patient Notes,Visit Date,Chief Complaint,History,Blood Pressure,Heart Rate,Temperature,Weight,Height,Oxygen Saturation,Clinical Findings,Diagnosis,Treatment Plan,Prescriptions,Lab Orders,Follow-up Date,Visit Notes

FORMATTING RULES:
1. One row per visit. If a patient has multiple visits, repeat their patient info on each row with different visit data.
2. If a patient has no visit history, include one row with empty visit columns (Visit Date onwards).
3. Multi-value fields (Allergies, Chronic Conditions, Current Medications, Diagnosis, Lab Orders) → separate values with | (pipe). Example: Penicillin|Dust|Pollen
4. Prescriptions format → each medicine: Medication|Dosage|Frequency|Duration|Instructions — separate multiple medicines with ;; (double semicolon). Example: Amoxicillin|500mg|TID|7 days|Take with food;;Ibuprofen|400mg|BID|5 days|After food
5. Date format: YYYY-MM-DD (e.g. 1990-05-15)
6. Gender: use lowercase male / female / other
7. Status: use active / inactive / deceased
8. If a field is unknown or missing, leave it empty (do not write "N/A" or "Unknown")
9. Wrap any cell value that contains a comma in double quotes.
10. Output only the raw CSV text — no explanations, no markdown code blocks, no extra formatting.

Now here is the patient data to convert:
[PASTE YOUR DATA HERE]`

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(CHATGPT_PROMPT).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2500)
    }).catch(() => {})
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const { patientMap, visitMap } = importPatientsCsv(text)
      // Fetch ALL patients fresh — bypasses the search-filtered `patients` state
      const allExisting = await patientService.getAll()
      const existingKeys = new Set(
        allExisting.map(p => {
          const phone = (p.phone || '').replace(/\D/g, '')
          const first = (p.firstName || '').toLowerCase()
          const last  = (p.lastName  || '').toLowerCase()
          return phone ? `${phone}__${first}__${last}` : `${first}__${last}__${p.dateOfBirth || ''}`
        })
      )

      let imported = 0, skipped = 0, duplicates = 0
      const errors = []
      for (const [key, patientData] of patientMap) {
        // Skip if already in DB (matched by phone + name, or name + DOB)
        if (existingKeys.has(key)) {
          duplicates++
          continue
        }
        try {
          const created = await patientService.create(patientData)
          existingKeys.add(key) // prevent double-create within the same import
          const visits  = visitMap.get(key) ?? []
          for (const v of visits) {
            await visitService.create({
              ...v,
              patientId:   created.id,
              patientName: `${created.firstName} ${created.lastName}`,
              patientPhone: created.phone || '',
            }).catch(() => {})
          }
          imported++
        } catch (err) {
          errors.push(`${patientData.firstName} ${patientData.lastName}: ${err.message}`)
          skipped++
        }
      }
      setImportResult({ imported, skipped, duplicates, errors })
    } catch (err) {
      setImportResult({ imported: 0, skipped: 0, duplicates: 0, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  const referralSources = useMemo(() => getReferralSources(doctor?.referralSources), [doctor?.referralSources])

  const sourceLabelMap = useMemo(() => {
    const map = {}
    getReferralSources(doctor?.referralSources).forEach(s => { map[s.value] = s.label })
    return map
  }, [doctor?.referralSources])

  // Build a map of patientId → total bill count
  const billCountByPatient = useMemo(() => {
    const map = {}
    invoices.forEach(inv => {
      if (inv.patientId) map[inv.patientId] = (map[inv.patientId] ?? 0) + 1
    })
    return map
  }, [invoices])

  // Build a map of patientId → due (unpaid) invoice count
  const dueBillsByPatient = useMemo(() => {
    const map = {}
    invoices.forEach(inv => {
      if (inv.patientId && inv.status !== 'paid') {
        map[inv.patientId] = (map[inv.patientId] ?? 0) + 1
      }
    })
    return map
  }, [invoices])

  const handleSearch = (q) => { setQuery(q); search(q) }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const openFollowUp = (e, patient) => {
    e.stopPropagation()
    setFollowUpPatient(patient)
    setFollowUpForm({ dueDate: tomorrow, note: '' })
  }

  const handleFollowUpSave = async () => {
    if (!followUpPatient || !followUpForm.dueDate) return
    setFollowUpSaving(true)
    try {
      await addFollowUp({
        patientId:   followUpPatient.id,
        patientName: `${followUpPatient.firstName} ${followUpPatient.lastName}`,
        dueDate:     followUpForm.dueDate,
        note:        followUpForm.note,
      })
      setFollowUpPatient(null)
    } finally {
      setFollowUpSaving(false)
    }
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = filterStatus === 'all' ? patients : patients.filter(p => p.status === filterStatus)
    if (activeFilters.gender.length > 0)
      list = list.filter(p => activeFilters.gender.includes(p.gender))
    if (activeFilters.source.length > 0)
      list = list.filter(p => activeFilters.source.includes(p.referralSource))
    if (activeFilters.ageRange) {
      list = list.filter(p => {
        const age = getPatientAge(p)
        if (age == null) return false
        if (activeFilters.ageRange === '<18')   return age < 18
        if (activeFilters.ageRange === '18-40') return age >= 18 && age < 40
        if (activeFilters.ageRange === '40-60') return age >= 40 && age < 60
        if (activeFilters.ageRange === '60+')   return age >= 60
        return true
      })
    }
    if (!sortKey) return list
    return [...list].sort((a, b) => {
      let av, bv
      if (sortKey === 'name')   { av = `${a.firstName} ${a.lastName}`.toLowerCase(); bv = `${b.firstName} ${b.lastName}`.toLowerCase() }
      if (sortKey === 'age')    { av = getPatientAge(a) ?? -1; bv = getPatientAge(b) ?? -1 }
      if (sortKey === 'visits') { av = billCountByPatient[a.id] ?? 0; bv = billCountByPatient[b.id] ?? 0 }
      if (sortKey === 'uhid')   { av = a.patientNumber ?? 0; bv = b.patientNumber ?? 0 }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [patients, filterStatus, sortKey, sortDir, billCountByPatient, activeFilters])

  return (
    <AppLayout
      title="Patients"
      action={
        <div className="flex items-center gap-2">
          {/* Hidden file input — triggered by label to avoid programmatic .click() which Chrome intercepts */}
          <input id="patient-csv-import" ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile}/>

          <button onClick={() => setShowImportGuide(true)} disabled={importing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-60">
            {importing ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            )}
            {importing ? 'Importing…' : 'Import CSV'}
          </button>

          <button onClick={() => router.push('/patients/new')}
            className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Patient
          </button>
        </div>
      }
    >
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input value={query} onChange={e => handleSearch(e.target.value)}
              placeholder="Search patients by name, phone, email…" className="input-field pl-9"/>
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field w-40">
            <option value="all">All Patients</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deceased">Deceased</option>
          </select>
          {/* Filter toggle button */}
          <button onClick={() => setFilterOpen(o => !o)}
            className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
              ${filterOpen || activeFilterCount > 0
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 space-y-5">

            {/* Columns */}
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Columns</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { col: 'uhid',     label: 'UHID' },
                  { col: 'ageGender',label: 'Age / Gender' },
                  { col: 'source',   label: 'Source' },
                  { col: 'phone',    label: 'Phone' },
                  { col: 'invoice',  label: 'Invoice' },
                  { col: 'visits',   label: 'Visits' },
                  { col: 'duebills', label: 'Due Bills' },
                  { col: 'whatsapp', label: 'WhatsApp' },
                  { col: 'followup', label: 'Follow Up' },
                ].map(({ col, label }) => (
                  <button key={col} onClick={() => toggleCol(col)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${visibleCols[col]
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 line-through'}`}>
                    {visibleCols[col] && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700"/>

            {/* Field filters */}
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Filter by</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

                {/* Gender */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Gender</p>
                  <div className="space-y-2">
                    {['male', 'female', 'other'].map(g => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={activeFilters.gender.includes(g)}
                          onChange={() => toggleFilter('gender', g)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary-600"/>
                        <span className="text-sm capitalize text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Age range */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Age Range</p>
                  <div className="space-y-2">
                    {[
                      { value: '',      label: 'Any age' },
                      { value: '<18',   label: 'Under 18' },
                      { value: '18-40', label: '18 – 40' },
                      { value: '40-60', label: '40 – 60' },
                      { value: '60+',   label: '60 and above' },
                    ].map(r => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="ageRange" checked={activeFilters.ageRange === r.value}
                          onChange={() => setActiveFilters(f => ({ ...f, ageRange: r.value }))}
                          className="text-primary-600"/>
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Source */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Visit Source</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {referralSources.map(s => (
                      <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={activeFilters.source.includes(s.value)}
                          onChange={() => toggleFilter('source', s.value)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary-600"/>
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setActiveFilters({ gender: [], source: [], ageRange: '' })}
                  className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading patients…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'No patients match your search' : 'No patients yet'}
          description={query ? 'Try a different name or phone number.' : 'Start by adding your first patient to the system.'}
          action={!query ? () => router.push('/patients/new') : null}
          actionLabel="Add First Patient"
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                  {[
                    { label: 'UHID',         key: 'uhid',   cls: 'pl-6', col: 'uhid' },
                    { label: 'Patient',      key: 'name',   cls: '',     col: null },
                    { label: 'Age / Gender', key: 'age',    cls: '',     col: 'ageGender' },
                    { label: 'Source',       key: null,     cls: '',     col: 'source' },
                    { label: 'Phone',        key: null,     cls: '',     col: 'phone' },
                    { label: 'Invoice',      key: null,     cls: '',     col: 'invoice' },
                    { label: 'Visits',       key: 'visits', cls: '',     col: 'visits' },
                    { label: 'Due Bills',    key: null,     cls: '',     col: 'duebills' },
                    { label: '',             key: null,     cls: '',     col: 'whatsapp' },
                    { label: '',             key: null,     cls: '',     col: 'followup' },
                    { label: '',             key: null,     cls: 'pr-4', col: null },
                  ].filter(c => c.col === null || visibleCols[c.col]).map(({ label, key, cls }) => (
                    <th key={label || key || Math.random()}
                      className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left ${cls ?? ''} ${key ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
                      onClick={key ? () => handleSort(key) : undefined}>
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {key && (
                          <span className="flex flex-col leading-none">
                            <svg className={`w-2.5 h-2.5 ${sortKey === key && sortDir === 'asc' ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l8 8H4z"/></svg>
                            <svg className={`w-2.5 h-2.5 ${sortKey === key && sortDir === 'desc' ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l-8-8h16z"/></svg>
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.map(patient => {
                  const visitCount = billCountByPatient[patient.id] ?? 0
                  const waPhone = patient.phone
                  return (
                    <tr key={patient.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/patients/${patient.id}`)}
                    >
                      {visibleCols.uhid && (
                        <td className="px-4 py-3.5 pl-6">
                          {patient.patientNumber
                            ? <span className="text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded font-mono">#{patient.patientNumber}</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-700 dark:text-primary-300 font-semibold text-sm">{getPatientInitials(patient)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{patient.email || patient.nationalId || '—'}</p>
                          </div>
                        </div>
                      </td>
                      {visibleCols.ageGender && (
                        <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                          {getPatientAge(patient) != null ? `${getPatientAge(patient)} yrs` : '—'} / {patient.gender}
                        </td>
                      )}
                      {visibleCols.source && (
                        <td className="px-4 py-3.5">
                          {patient.referralSource
                            ? <Badge label={sourceLabelMap[patient.referralSource] ?? patient.referralSource} color="blue" />
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      )}
                      {visibleCols.phone && (
                        <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{patient.phone || '—'}</td>
                      )}
                      {visibleCols.invoice && (
                        <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/billing/new?patientId=${patient.id}`) }}
                            title="Create invoice"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            Invoice
                          </button>
                        </td>
                      )}
                      {visibleCols.visits && (
                        <td className="px-4 py-3.5 text-center">
                          {visitCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold px-2.5 py-1 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                              {visitCount}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                          )}
                        </td>
                      )}
                      {visibleCols.duebills && (() => {
                        const due = dueBillsByPatient[patient.id] ?? 0
                        return (
                          <td className="px-4 py-3.5 text-center">
                            {due > 0 ? (
                              <span className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                {due} due
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )
                      })()}
                      {visibleCols.whatsapp && (
                        <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                          {waPhone ? (
                            <a href={buildWAUrl(waPhone)} target="_blank" rel="noopener noreferrer"
                              title="Open WhatsApp chat"
                              className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 px-2.5 py-1.5 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Chat
                            </a>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      )}
                      {visibleCols.followup && (
                        <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                          <button onClick={e => openFollowUp(e, patient)} title="Set follow-up reminder"
                            className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Follow Up
                          </button>
                        </td>
                      )}
                      {/* Delete */}
                      <td className="px-2 py-3.5 pr-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(patient.id) }}
                          title="Delete patient"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Follow Up modal */}
      <Modal open={!!followUpPatient} onClose={() => setFollowUpPatient(null)} title="Schedule Follow-up Reminder" size="sm">
        {followUpPatient && (
          <div className="space-y-4 mb-5">
            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 dark:text-primary-300 font-bold text-xs">
                  {getPatientInitials(followUpPatient)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {followUpPatient.firstName} {followUpPatient.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{followUpPatient.phone || 'No phone on record'}</p>
              </div>
            </div>
            <div>
              <label className="form-label">Follow-up Due Date</label>
              <input
                type="date"
                value={followUpForm.dueDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setFollowUpForm(f => ({ ...f, dueDate: e.target.value }))}
                className="input-field"
              />
              {followUpForm.dueDate && blockedSlots.some(b => b.date === followUpForm.dueDate) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  You are blocked on this day — consider picking another date.
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Reminder Note <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={followUpForm.note}
                onChange={e => setFollowUpForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Check blood pressure, review medication…"
                className="input-field"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              A notification will be created and shown on the dashboard when this date arrives.
            </p>
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={() => setFollowUpPatient(null)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleFollowUpSave}
            disabled={!followUpForm.dueDate || followUpSaving}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2">
            {followUpSaving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            Set Reminder
          </button>
        </div>
      </Modal>

      {/* Import guide modal */}
      <Modal open={showImportGuide} onClose={() => setShowImportGuide(false)} title="Import Patients from CSV" size="lg">
        <div className="space-y-5">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Before you import</p>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Your CSV must use the <strong>exact column names</strong> shown below — spelling and capitalisation matter.</li>
              <li>Each row represents <strong>one visit</strong>. A patient with 3 visits needs 3 rows with the same patient details.</li>
              <li>A patient row with no <strong>Visit Date</strong> is imported as a patient with no visit history.</li>
              <li>Duplicates are skipped using <strong>Phone + First Name + Last Name</strong> (or First Name + Last Name + DOB if no phone). Existing patients with the same match are never overwritten.</li>
            </ul>
          </div>

          {/* Column reference */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Column reference</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 max-h-56 overflow-y-auto pr-1">
              {[
                { cols: ['UHID', 'First Name *', 'Last Name *', 'Date of Birth', 'Gender', 'Blood Type', 'National ID'], label: 'Patient basics' },
                { cols: ['Phone', 'Alternate Phone', 'Email', 'Address'], label: 'Contact' },
                { cols: ['Allergies', 'Chronic Conditions', 'Current Medications', 'Family History'], label: 'Medical background' },
                { cols: ['Emergency Contact Name', 'Emergency Contact Phone', 'Emergency Contact Relationship'], label: 'Emergency contact' },
                { cols: ['Insurance Provider', 'Insurance Policy Number', 'Insurance Expiry', 'Insurance Group Number'], label: 'Insurance' },
                { cols: ['Referral Source', 'Referral Notes', 'Status', 'Patient Notes'], label: 'Other' },
                { cols: ['Visit Date', 'Chief Complaint', 'History', 'Blood Pressure', 'Heart Rate', 'Temperature', 'Weight', 'Height', 'Oxygen Saturation'], label: 'Visit / vitals' },
                { cols: ['Clinical Findings', 'Diagnosis', 'Treatment Plan', 'Prescriptions', 'Lab Orders', 'Follow-up Date', 'Visit Notes'], label: 'Clinical' },
              ].map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-0.5">{group.label}</p>
                  {group.cols.map(c => (
                    <p key={c} className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 mb-0.5 inline-block mr-1">{c}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Array / prescription format notes */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Format notes for multi-value fields</p>
            <div className="space-y-1.5 text-amber-700 dark:text-amber-400 text-xs">
              <p><span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Allergies</span>, <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Diagnosis</span>, <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Lab Orders</span> etc. — separate multiple values with <strong>|</strong></p>
              <p className="font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">Penicillin|Dust|Pollen</p>
              <p className="mt-1"><span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Prescriptions</span> — each medicine's fields separated by <strong>|</strong>, multiple medicines separated by <strong>;;</strong></p>
              <p className="font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">Amoxicillin|500mg|TID|7 days|With food;;Ibuprofen|400mg|BID|5 days|</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Fields in order: Medication | Dosage | Frequency | Duration | Instructions</p>
            </div>
          </div>

          {/* ChatGPT prompt */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Convert your data with ChatGPT</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Copy this prompt → paste into ChatGPT → add your data at the bottom → paste the output CSV here.
                </p>
              </div>
              <button onClick={handleCopyPrompt}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex-shrink-0 ${
                  promptCopied
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400'
                }`}>
                {promptCopied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    Copy Prompt
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono select-all">
{CHATGPT_PROMPT}
            </pre>
          </div>

          <div className="flex items-center justify-end pt-1 border-t border-gray-100 dark:border-gray-700">
            <div className="flex gap-3">
              <button onClick={() => setShowImportGuide(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <label htmlFor="patient-csv-import" onClick={() => setShowImportGuide(false)}
                className="cursor-pointer px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Choose CSV File
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Import result modal */}
      <Modal open={!!importResult} onClose={() => setImportResult(null)} title="Import Complete" size="sm">
        {importResult && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.imported}</p>
                <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-0.5">Imported</p>
              </div>
              {importResult.duplicates > 0 && (
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{importResult.duplicates}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 font-medium mt-0.5">Skipped (duplicate)</p>
                </div>
              )}
              {importResult.skipped > 0 && (
                <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult.skipped}</p>
                  <p className="text-xs text-red-600 dark:text-red-500 font-medium mt-0.5">Failed</p>
                </div>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Errors</p>
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setImportResult(null)}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm modal — accessible from patient profile page */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Patient" size="sm">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          Are you sure you want to remove this patient? All their records, appointments, and invoices will be deleted permanently.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { await remove(deleteId); setDeleteId(null) }}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
            Remove Patient
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
