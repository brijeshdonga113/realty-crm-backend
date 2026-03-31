'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { usePatients } from '@/hooks/usePatients'
import { useBilling } from '@/hooks/useBilling'
import { useFollowUps } from '@/hooks/useFollowUps'
import { getPatientAge, getPatientInitials } from '@/models/Patient'

const BLOOD_COLORS = { 'A+': 'red', 'A-': 'red', 'B+': 'teal', 'B-': 'teal', 'AB+': 'purple', 'AB-': 'purple', 'O+': 'green', 'O-': 'green' }
const STATUS_COLORS = { active: 'green', inactive: 'gray', deceased: 'red' }

export default function PatientsPage() {
  const router = useRouter()
  const { patients, loading, remove, search } = usePatients()
  const { invoices } = useBilling()
  const { add: addFollowUp } = useFollowUps()
  const [query, setQuery]               = useState('')
  const [deleteId, setDeleteId]         = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [followUpPatient, setFollowUpPatient] = useState(null)
  const [followUpForm, setFollowUpForm]       = useState({ dueDate: '', note: '' })
  const [followUpSaving, setFollowUpSaving]   = useState(false)

  // Build a map of patientId → total bill count
  const billCountByPatient = useMemo(() => {
    const map = {}
    invoices.forEach(inv => {
      if (inv.patientId) map[inv.patientId] = (map[inv.patientId] ?? 0) + 1
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

  const filtered = filterStatus === 'all'
    ? patients
    : patients.filter(p => p.status === filterStatus)

  return (
    <AppLayout
      title="Patients"
      action={
        <button onClick={() => router.push('/patients/new')}
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Patient
        </button>
      }
    >
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search patients by name, phone, email…"
            className="input-field pl-9"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-field w-40">
          <option value="all">All Patients</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deceased">Deceased</option>
        </select>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                  {['Patient', 'Age / Gender', 'Blood', 'Phone', 'Conditions', 'Status', 'Visits', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.map(patient => {
                  const visitCount = billCountByPatient[patient.id] ?? 0
                  return (
                    <tr key={patient.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/patients/${patient.id}`)}
                    >
                      <td className="px-4 py-3.5 pl-6">
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
                      <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                        {getPatientAge(patient) ? `${getPatientAge(patient)} yrs` : '—'} / {patient.gender}
                      </td>
                      <td className="px-4 py-3.5">
                        {patient.bloodType
                          ? <Badge label={patient.bloodType} color={BLOOD_COLORS[patient.bloodType] ?? 'gray'} />
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{patient.phone}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {patient.chronicConditions?.slice(0, 2).map(c => (
                            <Badge key={c} label={c} color="orange" />
                          ))}
                          {patient.chronicConditions?.length > 2 && (
                            <Badge label={`+${patient.chronicConditions.length - 2}`} color="gray" />
                          )}
                          {!patient.chronicConditions?.length && <span className="text-gray-400 text-xs">None</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge label={patient.status} color={STATUS_COLORS[patient.status] ?? 'gray'} />
                      </td>
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
                      <td className="px-4 py-3.5 pr-5">
                        <button
                          onClick={e => openFollowUp(e, patient)}
                          title="Set follow-up reminder"
                          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          Follow Up
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

      {/* Delete confirm modal — accessible from patient profile page */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Patient" size="sm">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          Are you sure you want to remove this patient? All their records, appointments, and invoices will be deleted permanently.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
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
