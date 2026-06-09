'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLeads } from '@/hooks/useLeads'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { buildWAUrl } from '@/lib/whatsapp'
import { localDateStr } from '@/lib/preferences'

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '')
}

const SOURCE_LABELS = {
  'walk-in':      'Walk-in',
  referral:       'Referral',
  booking:        'Booking Link',
  'social-media': 'Social Media',
  'google':       'Google Search',
  whatsapp:       'WhatsApp',
  advertisement:  'Advertisement',
  'health-camp':  'Health Camp',
  insurance:      'Insurance',
  other:          'Other',
}
const SOURCE_COLORS = {
  'walk-in':      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  referral:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  booking:        'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'social-media': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  google:         'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  whatsapp:       'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  advertisement:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'health-camp':  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  insurance:      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  other:          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

function WAIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function CollapsibleSection({ title, badge, badgeColor = 'blue', subtitle, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const colors = {
    blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300',
    gray:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  }
  return (
    <section>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 mb-3 w-full text-left">
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[badgeColor]}`}>{badge}</span>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </button>
      {open && children}
    </section>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const { leads, loading: leadsLoading, add: addLead, convert, remove: removeLead } = useLeads()
  const { appointments, loading: apptLoading } = useAppointments()
  const { patients, loading: patientsLoading }  = usePatients()

  const [query, setQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'walk-in', note: '' })
  const [converting, setConverting] = useState(null)

  const loading = leadsLoading || apptLoading || patientsLoading

  // Build a set of normalized phones from existing patients for dedup
  const patientPhones = useMemo(
    () => new Set(patients.map(p => normalizePhone(p.phone)).filter(Boolean)),
    [patients]
  )

  // Booking leads: from booking_link appointments with no linked patient
  const bookingLeads = useMemo(() => {
    const byPhone = {}
    appointments
      .filter(a => a.source === 'booking_link' && !a.patientId)
      .forEach(a => {
        const phone = normalizePhone(a.patientPhone)
        if (!phone) return
        if (patientPhones.has(phone)) return
        if (!byPhone[phone] || a.date > byPhone[phone].date) {
          byPhone[phone] = { name: a.patientName, phone, date: a.date, count: 0 }
        }
        byPhone[phone].count = (byPhone[phone].count || 0) + 1
      })
    return Object.values(byPhone).sort((a, b) => b.date.localeCompare(a.date))
  }, [appointments, patientPhones])

  const filteredLeads = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.email || '').toLowerCase().includes(q)
    )
  }, [leads, query])

  const filteredBooking = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return bookingLeads
    return bookingLeads.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }, [bookingLeads, query])

  async function handleAddLead(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await addLead(form)
      setForm({ name: '', phone: '', email: '', source: 'walk-in', note: '' })
      setShowAddForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleConvert(lead) {
    setConverting(lead.id ?? lead.phone)
    try {
      if (lead.id) {
        // Mark as converted in Firestore
        await convert(lead.id)
      }
      // Navigate to new patient pre-filled
      router.push(`/patients/new?name=${encodeURIComponent(lead.name)}&phone=${encodeURIComponent(lead.phone || '')}`)
    } finally {
      setConverting(null)
    }
  }

  return (
    <AppLayout
      title="Leads"
      action={
        <button
          onClick={() => setShowAddForm(o => !o)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Lead
        </button>
      }
    >
      {/* Add Lead Form */}
      {showAddForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">New Lead</h3>
          <form onSubmit={handleAddLead}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name *</label>
                <input
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  required className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
                <input
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 9876543210" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="optional" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="input-field">
                  <option value="walk-in">Walk-in</option>
                  <option value="referral">Referral</option>
                  <option value="social-media">Social Media</option>
                  <option value="google">Google Search</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="health-camp">Health Camp</option>
                  <option value="insurance">Insurance</option>
                  <option value="booking">Booking Link</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Note</label>
                <input
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Optional note about this lead" className="input-field" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving || !form.name.trim()}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search leads by name or phone…"
            className="input-field pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading leads…
        </div>
      ) : (
        <div className="space-y-8">

          {/* Manual Leads */}
          <CollapsibleSection
            title="Manual Leads"
            badge={filteredLeads.length}
            badgeColor="purple"
            subtitle="Walk-ins and referrals added manually">
            {filteredLeads.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No manual leads yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click "Add Lead" to add a walk-in or referral</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-50 dark:border-purple-900/30 bg-purple-50/40 dark:bg-purple-900/10">
                      {['Name', 'Phone', 'Source', 'Note', 'Added', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredLeads.map(lead => {
                      const initials = lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      const isConverting = converting === lead.id
                      return (
                        <tr key={lead.id} className="hover:bg-purple-50/20 dark:hover:bg-purple-900/10 transition-colors">
                          <td className="px-4 py-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-purple-700 dark:text-purple-300 font-semibold text-xs">{initials}</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{lead.name}</p>
                                {lead.email && <p className="text-xs text-gray-400 dark:text-gray-500">{lead.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{lead.phone || '—'}</span>
                              {lead.phone && (
                                <a href={buildWAUrl(lead.phone)} target="_blank" rel="noreferrer"
                                  className="text-green-500 hover:text-green-600 transition-colors">
                                  <WAIcon />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.other}`}>
                              {SOURCE_LABELS[lead.source] ?? lead.source}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                            {lead.note || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {lead.createdAt ? lead.createdAt.slice(0, 10) : '—'}
                          </td>
                          <td className="px-4 py-3.5 pr-5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleConvert(lead)}
                                disabled={isConverting}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-50 transition-colors whitespace-nowrap">
                                {isConverting ? '…' : 'Convert to Patient'}
                              </button>
                              <button
                                onClick={() => removeLead(lead.id)}
                                className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Booking Leads */}
          {filteredBooking.length > 0 && (
            <CollapsibleSection
              title="Booking Leads"
              badge={filteredBooking.length}
              badgeColor="blue"
              subtitle="Booked via appointment link — not yet registered as patients">
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
                      const initials    = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      const isConverting = converting === c.phone
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
                              onClick={() => handleConvert(c)}
                              disabled={isConverting}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-50 transition-colors whitespace-nowrap">
                              {isConverting ? '…' : 'Convert to Patient'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {filteredLeads.length === 0 && filteredBooking.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
              <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No leads yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {query ? 'No leads match your search.' : 'Add a walk-in or referral using "Add Lead" above.'}
              </p>
            </div>
          )}

        </div>
      )}
    </AppLayout>
  )
}
