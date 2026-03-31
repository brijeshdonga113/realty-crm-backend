'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { usePatients } from '@/hooks/usePatients'
import { getPatientAge, getPatientInitials } from '@/models/Patient'

const BLOOD_COLORS = { 'A+': 'red', 'A-': 'red', 'B+': 'blue', 'B-': 'blue', 'AB+': 'purple', 'AB-': 'purple', 'O+': 'green', 'O-': 'green' }
const STATUS_COLORS = { active: 'green', inactive: 'gray', deceased: 'red' }

export default function PatientsPage() {
  const router = useRouter()
  const { patients, loading, remove, search } = usePatients()
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const handleSearch = (q) => { setQuery(q); search(q) }

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
          <p className="text-sm text-gray-500 mb-4">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Patient', 'Age / Gender', 'Blood', 'Phone', 'Conditions', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left first:pl-6 last:pr-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(patient => (
                  <tr key={patient.id}
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/patients/${patient.id}`)}
                  >
                    <td className="px-4 py-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 font-semibold text-sm">{getPatientInitials(patient)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs text-gray-400">{patient.email || patient.nationalId || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      {getPatientAge(patient) ? `${getPatientAge(patient)} yrs` : '—'} / {patient.gender}
                    </td>
                    <td className="px-4 py-3.5">
                      {patient.bloodType
                        ? <Badge label={patient.bloodType} color={BLOOD_COLORS[patient.bloodType] ?? 'gray'} />
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{patient.phone}</td>
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
                    <td className="px-4 py-3.5 pr-6 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(patient.id) }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Patient" size="sm">
        <p className="text-gray-600 text-sm mb-6">
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
