'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatients } from '@/hooks/usePatients'
import { useAppointments } from '@/hooks/useAppointments'
import { getPatientAge } from '@/models/Patient'
import { buildWAUrl } from '@/lib/whatsapp'
import { localDateStr } from '@/lib/preferences'

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '')
}

function exportCSV(patients) {
  const headers = ['Name', 'Phone', 'Email', 'City', 'Address', 'Age', 'Gender', 'Blood Type', 'Conditions', 'Status']
  const rows = patients.map(p => [
    `${p.firstName} ${p.lastName}`,
    p.phone || '',
    p.email || '',
    p.address?.city || '',
    [p.address?.street, p.address?.city, p.address?.state].filter(Boolean).join(', '),
    getPatientAge(p) ?? '',
    p.gender || '',
    p.bloodType || '',
    (p.chronicConditions || []).join('; '),
    p.status || '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `contacts_${localDateStr()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function WAIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

export default function ContactsPage() {
  const router = useRouter()
  const { patients, loading: patientsLoading } = usePatients()
  const { appointments, loading: apptLoading }  = useAppointments()

  const [query,        setQuery]        = useState('')
  const [cityFilter,   setCityFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loading = patientsLoading || apptLoading

  // Build a set of normalized phones from existing patients for fast dedup lookup
  const patientPhones = useMemo(
    () => new Set(patients.map(p => normalizePhone(p.phone)).filter(Boolean)),
    [patients]
  )

  // Booking contacts: from booking_link appointments with no linked patient,
  // deduped by phone, excluding phones that already exist as patients.
  const bookingContacts = useMemo(() => {
    const byPhone = {}
    appointments
      .filter(a => a.source === 'booking_link' && !a.patientId)
      .forEach(a => {
        const phone = normalizePhone(a.patientPhone)
        if (!phone) return
        if (patientPhones.has(phone)) return  // already a patient
        // Keep entry with the latest date
        if (!byPhone[phone] || a.date > byPhone[phone].date) {
          byPhone[phone] = { name: a.patientName, phone, date: a.date, count: 0 }
        }
        byPhone[phone].count = (byPhone[phone].count || 0) + 1
      })
    return Object.values(byPhone).sort((a, b) => b.date.localeCompare(a.date))
  }, [appointments, patientPhones])

  const cities = useMemo(() => {
    const set = new Set(patients.map(p => p.address?.city).filter(Boolean))
    return Array.from(set).sort()
  }, [patients])

  const filteredPatients = useMemo(() => {
    const q = query.toLowerCase().trim()
    return patients.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (cityFilter && p.address?.city !== cityFilter) return false
      if (!q) return true
      const name  = `${p.firstName} ${p.lastName}`.toLowerCase()
      const phone = (p.phone || '').toLowerCase()
      const email = (p.email || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || email.includes(q)
    })
  }, [patients, query, cityFilter, statusFilter])

  const filteredBooking = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return bookingContacts
    return bookingContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [bookingContacts, query])

  return (
    <AppLayout
      title="Contacts"
      action={
        <button
          onClick={() => exportCSV(filteredPatients)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </button>
      }
    >
      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="input-field pl-9"
          />
        </div>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="input-field w-40">
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-36">
          <option value="all">All Status</option>
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
          Loading contacts…
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Booking contacts ─────────────────────────────────────────── */}
          {filteredBooking.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Booking Contacts</h2>
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
                  {filteredBooking.length}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500">Booked via appointment link — not yet registered as patients</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-blue-50 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10">
                      {['Name', 'Phone', 'Last Booked', 'Appointments', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredBooking.map(c => {
                      const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      const addUrl   = `/patients/new?name=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone)}`
                      return (
                        <tr key={c.phone} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                          <td className="px-4 py-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-700 dark:text-blue-300 font-semibold text-xs">{initials}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{c.phone}</span>
                              {c.phone && (
                                <a href={buildWAUrl(c.phone)} target="_blank" rel="noreferrer"
                                  className="text-green-500 hover:text-green-600 transition-colors">
                                  <WAIcon />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{c.date}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                              {c.count}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 pr-5">
                            <button
                              onClick={() => router.push(addUrl)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors whitespace-nowrap">
                              + Add as Patient
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Registered patients ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Registered Patients</h2>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                {filteredPatients.length} contact{filteredPatients.length !== 1 ? 's' : ''}
                {(query || cityFilter || statusFilter !== 'all') ? ' matching filters' : ''}
              </span>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No contacts found</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term or filter.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                      {['Name', 'Phone', 'Email', 'City / Address', 'Age', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredPatients.map(p => {
                      const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase()
                      const city     = p.address?.city || ''
                      const address  = [p.address?.street, city, p.address?.state].filter(Boolean).join(', ')
                      return (
                        <tr key={p.id}
                          className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/patients/${p.id}`)}>
                          <td className="px-4 py-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-primary-700 dark:text-primary-300 font-semibold text-xs">{initials}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {p.firstName} {p.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{p.phone || '—'}</span>
                              {p.phone && (
                                <a href={buildWAUrl(p.phone)} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-green-500 hover:text-green-600 transition-colors">
                                  <WAIcon />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                            {p.email ? (
                              <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()}
                                className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline truncate max-w-xs block">
                                {p.email}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{city || '—'}</p>
                            {address && city && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{address}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                            {getPatientAge(p) ? `${getPatientAge(p)} yrs` : '—'}
                            {p.gender ? ` / ${p.gender}` : ''}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                              ${p.status === 'active'   ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                p.status === 'deceased' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 pr-5">
                            <button
                              onClick={e => { e.stopPropagation(); router.push(`/patients/${p.id}`) }}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                              View →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}
    </AppLayout>
  )
}
