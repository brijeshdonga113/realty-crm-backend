'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { STAFF_MODULES, getStaffRoleLabel } from '@/models/Staff'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function adminFetch(path, opts = {}) {
  const token = await auth.currentUser?.getIdToken() ?? null
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubBadge({ sub }) {
  if (!sub?.status) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
  const cfg = {
    active:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    trial:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>
      {sub.status}
    </span>
  )
}

function LoginCell({ isoStr }) {
  if (!isoStr) return <span className="text-xs text-gray-400 dark:text-gray-500">Never</span>
  const diff = Date.now() - new Date(isoStr).getTime()
  const days = diff / 86400000
  const color = days < 1 ? 'text-green-600 dark:text-green-400'
    : days < 7  ? 'text-blue-600 dark:text-blue-400'
    : days < 30 ? 'text-gray-700 dark:text-gray-300'
    : 'text-red-500 dark:text-red-400'
  return (
    <div>
      <p className={`text-xs font-semibold ${color}`}>{timeAgo(isoStr)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(isoStr)}</p>
    </div>
  )
}

const TABLE_COLS = [
  { key: 'clinicName',     label: 'Clinic'         },
  { key: 'firstName',      label: 'Doctor'         },
  { key: 'specialization', label: 'Specialization' },
  { key: 'subscription',   label: 'Plan'           },
  { key: 'createdAt',      label: 'Joined'         },
  { key: 'lastSignInTime', label: 'Last Login'     },
]

function ClinicRow({ d, uidMap, onSelect }) {
  const initials = `${d.firstName?.[0] ?? ''}${d.lastName?.[0] ?? ''}`.toUpperCase() || '?'
  return (
    <tr onClick={() => onSelect(d.uid)}
      className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
      <td className="px-4 py-3.5 pl-5">
        <div className="flex items-center gap-2.5">
          {d.logoUrl ? (
            <img src={d.logoUrl} alt={d.clinicName || 'logo'}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"/>
          ) : (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              d.clinicRole === 'clinic_admin'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
            }`}>{initials}</div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {d.clinicName || <span className="italic text-gray-400">No clinic name</span>}
            </p>
            {d.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{d.phone}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dr. {d.firstName} {d.lastName}</p>
          {d.clinicRole === 'clinic_admin' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 whitespace-nowrap">
              Clinic Admin · {d.managedDoctors?.length ?? 0} dr
            </span>
          )}
        </div>
        {d.managedBy && uidMap[d.managedBy] && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            via Dr. {uidMap[d.managedBy].firstName} {uidMap[d.managedBy].lastName}
          </p>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
          {d.specialization ? d.specialization.replace(/_/g, ' ') : '—'}
        </span>
      </td>
      <td className="px-4 py-3.5"><SubBadge sub={d.subscription} /></td>
      <td className="px-4 py-3.5"><p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(d.createdAt)}</p></td>
      <td className="px-4 py-3.5 pr-5"><LoginCell isoStr={d.lastSignInTime} /></td>
    </tr>
  )
}

function ClinicTable({ rows, title, emptyMsg, uidMap, toggleSort, SortIcon, onSelect }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-white flex-1 text-sm">{title}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{rows.length} clinic{rows.length !== 1 ? 's' : ''}</span>
      </div>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                {TABLE_COLS.map(col => (
                  <th key={col.label} onClick={() => col.key && toggleSort(col.key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide first:pl-5 last:pr-5 ${col.key ? 'cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none' : ''}`}>
                    {col.label}{col.key && <SortIcon k={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {rows.map(d => <ClinicRow key={d.uid} d={d} uidMap={uidMap} onSelect={onSelect} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ArchivedSection({ rows, uidMap, onSelect }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-red-100 dark:border-red-900/40 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-red-50 dark:bg-red-900/10 hover:bg-red-100/60 dark:hover:bg-red-900/20 transition-colors text-left">
        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4"/>
        </svg>
        <span className="font-semibold text-red-700 dark:text-red-400 text-sm flex-1">Archived (Expired)</span>
        <span className="text-xs text-red-400 dark:text-red-500 mr-1">{rows.length} clinic{rows.length !== 1 ? 's' : ''} · read-only</span>
        <svg className={`w-4 h-4 text-red-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="bg-white dark:bg-gray-800 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                {TABLE_COLS.map(col => (
                  <th key={col.label}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide first:pl-5 last:pr-5">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {rows.map(d => (
                <ClinicRow key={d.uid} d={d} uidMap={uidMap} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OrgCard({ org, onSelect, onEdit, onDelete }) {
  return (
    <div
      onClick={() => onSelect(org)}
      className="px-5 py-4 flex items-center gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{org.name}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {(org.branches ?? []).map(b => (
            <span key={b.uid} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {b.branchName}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Edit</button>
        <button onClick={onDelete} className="text-xs font-medium text-red-500 dark:text-red-400 hover:underline">Delete</button>
      </div>
      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </div>
  )
}

function OrgDrawer({ org, onClose, onEdit, onDelete }) {
  const [tab,     setTab]     = useState('overview')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    if (!org) return
    let cancelled = false
    setLoading(true); setErr(''); setData(null)
    adminFetch(`/api/admin/org-stats?orgId=${org.id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) throw new Error(d.error); setData(d) } })
      .catch(e => { if (!cancelled) setErr(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [org])

  const maxRevenue = data ? Math.max(...data.branches.map(b => b.revenue), 1) : 1

  const STATS = data ? [
    { label: 'Total Revenue',  value: fmt(data.totals.revenue),                    sub: 'from paid invoices',      color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'   },
    { label: 'Total Patients', value: data.totals.patients.toLocaleString(),        sub: 'across all branches',     color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'       },
    { label: 'Appointments',   value: data.totals.appointments.toLocaleString(),    sub: 'all time',                color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'},
    { label: 'Pending',        value: fmt(data.totals.pending),                     sub: 'awaiting payment',        color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'   },
    { label: 'Overdue',        value: fmt(data.totals.overdue),                     sub: 'past due date',           color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'           },
    { label: 'Net Revenue',    value: fmt(data.totals.revenue - data.totals.expenses), sub: 'revenue minus expenses', color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'    },
  ] : []

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{org.name}</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">{(org.branches ?? []).length} branches</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => { onClose(); onEdit() }}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Edit
            </button>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 flex-shrink-0 px-6">
          {['overview', 'branches'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              {t === 'overview' ? 'Overview' : 'Branches'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400 text-sm">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading organization data…
            </div>
          )}
          {err && <p className="text-sm text-red-500 dark:text-red-400">{err}</p>}

          {data && tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {STATS.map(s => (
                  <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color.split(' ').filter(c => c.startsWith('text')).join(' ')}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Branch revenue bars */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Revenue by Branch</h3>
                <div className="space-y-3">
                  {[...data.branches].sort((a, b) => b.revenue - a.revenue).map(b => (
                    <div key={b.uid}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1 mr-3">{b.branchName}</p>
                        <p className="text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">{fmt(b.revenue)}</p>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all"
                          style={{ width: `${(b.revenue / maxRevenue) * 100}%` }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delete zone */}
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Delete Organization</p>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">Branch clinics will be unlinked. Their data stays intact.</p>
                </div>
                <button onClick={() => { onClose(); onDelete() }}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex-shrink-0">
                  Delete
                </button>
              </div>
            </div>
          )}

          {data && tab === 'branches' && (
            <div className="space-y-3">
              {data.branches.map(b => (
                <div key={b.uid} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"/>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0 text-sm font-bold text-purple-700 dark:text-purple-300">
                        {(b.branchName?.[0] ?? 'B').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{b.branchName}</p>
                    </div>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">{fmt(b.revenue)}</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                      style={{ width: `${(b.revenue / maxRevenue) * 100}%` }}/>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Patients',  value: b.patients.toLocaleString(),   color: 'text-blue-600 dark:text-blue-400'  },
                      { label: 'Pending',   value: fmt(b.pending),                color: 'text-amber-600 dark:text-amber-400'},
                      { label: 'Overdue',   value: fmt(b.overdue),                color: 'text-red-500 dark:text-red-400'    },
                      { label: 'Expenses',  value: fmt(b.expenses),               color: 'text-rose-600 dark:text-rose-400'  },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                        <p className={`text-xs font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const cfg = {
    primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800',
    green:   'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800',
    blue:    'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    red:     'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',
    yellow:  'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${cfg[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  )
}

// ── Create Clinic Modal ───────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  { value: '',              label: 'Select specialization…' },
  { value: 'general',       label: 'General Practitioner' },
  { value: 'cardiology',    label: 'Cardiology' },
  { value: 'dermatology',   label: 'Dermatology' },
  { value: 'neurology',     label: 'Neurology' },
  { value: 'orthopedics',   label: 'Orthopedics' },
  { value: 'pediatrics',    label: 'Pediatrics' },
  { value: 'psychiatry',    label: 'Psychiatry' },
  { value: 'gynecology',    label: 'Gynecology & Obstetrics' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent',           label: 'ENT' },
  { value: 'dentistry',     label: 'Dentistry' },
  { value: 'homeopathy',    label: 'Homeopathy' },
  { value: 'ayurveda',      label: 'Ayurveda' },
  { value: 'other',         label: 'Other' },
]

const BLANK = { firstName: '', lastName: '', email: '', clinicName: '', specialization: '', phone: '', password: '', clinicRole: 'doctor', managedByUid: '' }

function CreateClinicModal({ open, onClose, onCreated, clinicAdmins = [] }) {
  const [form,    setForm]    = useState(BLANK)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(null)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = { ...form }
      if (form.clinicRole !== 'doctor') delete payload.managedByUid
      if (!payload.managedByUid) delete payload.managedByUid
      const res  = await adminFetch('/api/admin/create-doctor', { method: 'POST', body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone({ email: form.email, password: form.password, clinicRole: form.clinicRole })
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setForm(BLANK); setError(''); setDone(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Add New Clinic</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-300">
                  {done.clinicRole === 'clinic_admin' ? 'Clinic Admin account created' : 'Clinic account created'}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  {done.clinicRole === 'clinic_admin'
                    ? 'Share these credentials with the clinic admin.'
                    : 'Share these login credentials with the doctor.'}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Email</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5">{done.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Temporary Password</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5 select-all">{done.password}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">Ask them to change their password after first login from Settings.</p>
            <button onClick={handleClose}
              className="w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">First Name *</label>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)} required className="input-field"/>
              </div>
              <div>
                <label className="form-label">Last Name *</label>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)} required className="input-field"/>
              </div>
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="input-field"/>
            </div>
            <div>
              <label className="form-label">Clinic Name</label>
              <input value={form.clinicName} onChange={e => set('clinicName', e.target.value)} className="input-field"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Specialization</label>
                <select value={form.specialization} onChange={e => set('specialization', e.target.value)} className="input-field">
                  {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field"/>
              </div>
            </div>
            <div>
              <label className="form-label">Account Role *</label>
              <div className="flex gap-2 mt-1">
                {[{ value: 'doctor', label: 'Doctor' }, { value: 'clinic_admin', label: 'Clinic Admin' }].map(r => (
                  <button key={r.value} type="button" onClick={() => { set('clinicRole', r.value); set('managedByUid', '') }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                      form.clinicRole === r.value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                    }`}>{r.label}</button>
                ))}
              </div>
              {form.clinicRole === 'clinic_admin' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                  This account can transparently view and manage assigned doctors' data.
                </p>
              )}
            </div>
            {form.clinicRole === 'doctor' && clinicAdmins.length > 0 && (
              <div>
                <label className="form-label">Assign to Clinic Admin (optional)</label>
                <select value={form.managedByUid} onChange={e => set('managedByUid', e.target.value)} className="input-field">
                  <option value="">None — standalone doctor</option>
                  {clinicAdmins.map(a => (
                    <option key={a.uid} value={a.uid}>{a.clinicName || `Dr. ${a.firstName} ${a.lastName}`}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The admin will be able to access this doctor's data.</p>
              </div>
            )}
            <div>
              <label className="form-label">Temporary Password *</label>
              <input type="text" value={form.password} onChange={e => set('password', e.target.value)}
                required minLength={6} placeholder="Min 6 characters" className="input-field font-mono"/>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The doctor should change this after first login.</p>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {loading ? 'Creating…' : 'Create Clinic'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Clinic Profile Drawer ─────────────────────────────────────────────────────

const PLAN_STATUSES = [
  { value: 'trial',   label: 'Trial',   color: 'blue'  },
  { value: 'active',  label: 'Active',  color: 'green' },
  { value: 'expired', label: 'Expired', color: 'red'   },
]

function fmt(n) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n) }

function ClinicDrawer({ uid, onClose, onUpdated, allDoctors = [] }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')
  const [tab,     setTab]     = useState('overview')

  // Staff/receptionist accounts for this clinic
  const [staff,        setStaff]        = useState([])
  const [staffLoading, setStaffLoading] = useState(true)

  // Plan edit
  const [editPlan,    setEditPlan]    = useState(false)
  const [planStatus,  setPlanStatus]  = useState('')
  const [planExpiry,  setPlanExpiry]  = useState('')
  const [planSaving,  setPlanSaving]  = useState(false)

  // Role edit
  const [editRole,   setEditRole]   = useState(false)
  const [newRole,    setNewRole]    = useState('doctor')
  const [roleSaving, setRoleSaving] = useState(false)

  // Managed doctors
  const [mdSaving,     setMdSaving]     = useState(false)
  const [addDoctorUid, setAddDoctorUid] = useState('')

  useEffect(() => {
    if (!uid) return
    setLoading(true); setErr('')
    adminFetch(`/api/admin/clinic?uid=${uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setPlanStatus(d.profile.subscription?.status ?? 'trial')
        setPlanExpiry(d.profile.subscription?.expiresAt?.slice(0, 10) ?? d.profile.subscription?.trialEndsAt?.slice(0, 10) ?? '')
        setNewRole(d.profile.clinicRole ?? 'doctor')
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [uid])

  useEffect(() => {
    if (!uid) return
    setStaffLoading(true)
    adminFetch(`/api/admin/staff?doctorId=${uid}`)
      .then(r => r.json())
      .then(d => setStaff(d.staff ?? []))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false))
  }, [uid])

  const handlePlanSave = async () => {
    setPlanSaving(true)
    try {
      const subscription = {
        ...(data.profile.subscription ?? {}),
        status: planStatus,
        ...(planExpiry ? { expiresAt: planExpiry, trialEndsAt: planExpiry } : {}),
      }
      await adminFetch('/api/admin/clinic', {
        method: 'PATCH',
        body: JSON.stringify({ uid, subscription }),
      })
      setData(prev => ({ ...prev, profile: { ...prev.profile, subscription } }))
      setEditPlan(false)
      onUpdated?.()
    } finally {
      setPlanSaving(false)
    }
  }

  const handleAccessToggle = async () => {
    const next = !data.profile.viewOnly
    await adminFetch('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ uid, viewOnly: next }) })
    setData(prev => ({ ...prev, profile: { ...prev.profile, viewOnly: next } }))
    onUpdated?.()
  }

  const handleRoleSave = async () => {
    setRoleSaving(true)
    try {
      await adminFetch('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ uid, clinicRole: newRole }) })
      const newManagedDoctors = newRole === 'clinic_admin' ? [] : null
      setData(prev => ({
        ...prev,
        profile: { ...prev.profile, clinicRole: newRole, managedDoctors: newManagedDoctors ?? [] },
        managedDoctorProfiles: newRole === 'clinic_admin' ? [] : [],
      }))
      setEditRole(false)
      onUpdated?.()
    } finally {
      setRoleSaving(false)
    }
  }

  const handleAddManagedDoctor = async () => {
    if (!addDoctorUid) return
    setMdSaving(true)
    try {
      await adminFetch('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ uid, addManagedDoctor: addDoctorUid }) })
      const added = allDoctors.find(d => d.uid === addDoctorUid)
      if (added) {
        setData(prev => ({
          ...prev,
          profile: { ...prev.profile, managedDoctors: [...(prev.profile.managedDoctors ?? []), addDoctorUid] },
          managedDoctorProfiles: [...(prev.managedDoctorProfiles ?? []), { uid: added.uid, firstName: added.firstName, lastName: added.lastName, clinicName: added.clinicName, specialization: added.specialization }],
        }))
      }
      setAddDoctorUid('')
      onUpdated?.()
    } finally {
      setMdSaving(false)
    }
  }

  const handleRemoveManagedDoctor = async (doctorUid) => {
    setMdSaving(true)
    try {
      await adminFetch('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ uid, removeManagedDoctor: doctorUid }) })
      setData(prev => ({
        ...prev,
        profile: { ...prev.profile, managedDoctors: (prev.profile.managedDoctors ?? []).filter(u => u !== doctorUid) },
        managedDoctorProfiles: (prev.managedDoctorProfiles ?? []).filter(d => d.uid !== doctorUid),
      }))
      onUpdated?.()
    } finally {
      setMdSaving(false)
    }
  }

  if (!uid) return null

  const sub = data?.profile?.subscription
  const subColor = sub?.status === 'active' ? 'green' : sub?.status === 'trial' ? 'blue' : 'red'
  const subLabel = PLAN_STATUSES.find(p => p.value === sub?.status)?.label ?? sub?.status ?? '—'
  const expiryDate = sub?.expiresAt || sub?.trialEndsAt
  const isExpired  = expiryDate && new Date(expiryDate) < new Date()
  const daysLeft   = expiryDate ? Math.ceil((new Date(expiryDate) - new Date()) / 86400000) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-400 gap-3 text-sm">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading clinic data…
          </div>
        ) : err ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-red-500 dark:text-red-400">{err}</p>
          </div>
        ) : data && (
          <>
            {/* Top bar */}
            <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              {data.profile.logoUrl ? (
                <img src={data.profile.logoUrl} alt={data.profile.clinicName || 'logo'}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"/>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-lg font-bold text-primary-700 dark:text-primary-300">
                  {(data.profile.firstName?.[0] ?? '').toUpperCase()}{(data.profile.lastName?.[0] ?? '').toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {data.profile.clinicName || `Dr. ${data.profile.firstName} ${data.profile.lastName}`}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Dr. {data.profile.firstName} {data.profile.lastName} · {data.profile.specialization?.replace(/_/g,' ') || 'General'}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    subColor === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : subColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>{subLabel}</span>
                  {data.profile.viewOnly && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">View Only</span>
                  )}
                  {data.auth.emailVerified && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      Verified
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              {['overview', 'financials', 'patients', 'staff'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
                    tab === t
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {t}
                  {t === 'staff' && staff.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                      {staff.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── Overview ── */}
              {tab === 'overview' && (
                <>
                  {/* Plan card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Subscription Plan</h4>
                      {!editPlan && (
                        <button onClick={() => setEditPlan(true)}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                          Edit
                        </button>
                      )}
                    </div>

                    {editPlan ? (
                      <div className="space-y-3">
                        <div>
                          <label className="form-label">Status</label>
                          <div className="flex gap-2 mt-1">
                            {PLAN_STATUSES.map(p => (
                              <button key={p.value} type="button" onClick={() => setPlanStatus(p.value)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                                  planStatus === p.value
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                }`}>{p.label}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="form-label">Expiry / Trial End Date</label>
                          <input type="date" value={planExpiry} onChange={e => setPlanExpiry(e.target.value)} className="input-field"/>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditPlan(false)}
                            className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancel
                          </button>
                          <button onClick={handlePlanSave} disabled={planSaving}
                            className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                            {planSaving ? 'Saving…' : 'Save Plan'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-1">Status</p>
                          <span className={`text-sm font-bold capitalize ${
                            subColor === 'green' ? 'text-green-600 dark:text-green-400'
                            : subColor === 'blue' ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                          }`}>{subLabel}</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-1">
                            {sub?.status === 'trial' ? 'Trial Ends' : 'Expires'}
                          </p>
                          {expiryDate ? (
                            <div>
                              <p className={`text-sm font-semibold ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {fmtDate(expiryDate)}
                              </p>
                              <p className={`text-xs ${isExpired ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                {isExpired ? 'Expired' : `${daysLeft}d remaining`}
                              </p>
                            </div>
                          ) : <p className="text-sm text-gray-400">—</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Access control */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Access Control</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {data.profile.viewOnly ? 'This clinic is currently in view-only mode — no create/edit actions.' : 'This clinic has full access to all features.'}
                        </p>
                      </div>
                      <button onClick={handleAccessToggle}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                          data.profile.viewOnly
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                        }`}>
                        {data.profile.viewOnly ? 'Restore Full Access' : 'Restrict to View Only'}
                      </button>
                    </div>
                  </div>

                  {/* Role management */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Account Role</h4>
                      {!editRole && (
                        <button onClick={() => { setNewRole(data.profile.clinicRole ?? 'doctor'); setEditRole(true) }}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                          Edit
                        </button>
                      )}
                    </div>

                    {editRole ? (
                      <div className="space-y-3 mt-3">
                        <div className="flex gap-2">
                          {[{ value: 'doctor', label: 'Doctor' }, { value: 'clinic_admin', label: 'Clinic Admin' }].map(r => (
                            <button key={r.value} type="button" onClick={() => setNewRole(r.value)}
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                                newRole === r.value
                                  ? 'bg-primary-500 text-white border-primary-500'
                                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                              }`}>{r.label}</button>
                          ))}
                        </div>
                        {newRole === 'doctor' && data.profile.clinicRole === 'clinic_admin' && (data.profile.managedDoctors?.length > 0) && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Warning: this will unlink all {data.profile.managedDoctors.length} currently managed doctor(s).
                          </p>
                        )}
                        {newRole === 'clinic_admin' && data.profile.clinicRole !== 'clinic_admin' && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            This account will be able to transparently view and manage assigned doctors' data.
                          </p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditRole(false)}
                            className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancel
                          </button>
                          <button onClick={handleRoleSave} disabled={roleSaving || newRole === data.profile.clinicRole}
                            className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                            {roleSaving ? 'Saving…' : 'Save Role'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${data.profile.clinicRole === 'clinic_admin' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {data.profile.clinicRole === 'clinic_admin' ? 'Clinic Admin' : 'Doctor'}
                          </span>
                          {data.profile.clinicRole === 'clinic_admin' && (
                            <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                              Manages {data.profile.managedDoctors?.length ?? 0} doctor(s)
                            </span>
                          )}
                        </div>
                        {(() => {
                          const adminUid = data.profile.managedBy
                          if (!adminUid) return null
                          const admin = allDoctors.find(d => d.uid === adminUid)
                          return (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                              <span>
                                Managed by{' '}
                                {admin
                                  ? <span className="font-semibold text-amber-600 dark:text-amber-400">Dr. {admin.firstName} {admin.lastName}</span>
                                  : <span className="font-mono text-gray-400">{adminUid}</span>
                                }
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Clinic Hierarchy — shown when admin manages clinics AND/OR belongs to an org */}
                  {(data.profile.clinicRole === 'clinic_admin' || data.org) && (() => {
                    const managedProfiles = data.managedDoctorProfiles ?? []
                    const isAdmin = data.profile.clinicRole === 'clinic_admin'
                    if (!isAdmin && !data.org) return null
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Clinic Hierarchy</h4>
                        <div className="flex items-start gap-0">

                          {/* Left: Org membership */}
                          {data.org && (
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                </svg>
                              </div>
                              <div className="w-px flex-1 min-h-[12px] bg-purple-200 dark:bg-purple-800 mt-1"/>
                            </div>
                          )}

                          {data.org && (
                            <div className="ml-2.5 mr-4 pt-1 min-w-0">
                              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 truncate">{data.org.name}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">Organization · as "{data.profile.branchName || 'Branch'}"</p>
                            </div>
                          )}

                          {/* Connector arrow → */}
                          {data.org && isAdmin && managedProfiles.length > 0 && (
                            <div className="flex items-center self-center mx-1 text-gray-300 dark:text-gray-600 flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                              </svg>
                            </div>
                          )}

                          {/* Middle: This clinic (self) */}
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="relative">
                              {data.profile.logoUrl ? (
                                <img src={data.profile.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border-2 border-primary-400"/>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-xs font-bold border-2 border-primary-400">
                                  {(data.profile.firstName?.[0] ?? '').toUpperCase()}{(data.profile.lastName?.[0] ?? '').toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white dark:border-gray-800 flex items-center justify-center">
                                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                              </div>
                            </div>
                            {isAdmin && managedProfiles.length > 0 && (
                              <div className="w-px bg-primary-200 dark:bg-primary-800 mt-1" style={{ height: `${managedProfiles.length * 44 - 8}px` }}/>
                            )}
                          </div>

                          <div className="ml-2.5 pt-1 min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                              {data.profile.clinicName || `Dr. ${data.profile.firstName} ${data.profile.lastName}`}
                            </p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Clinic Admin</p>

                            {/* Managed clinics branching down */}
                            {isAdmin && managedProfiles.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {managedProfiles.map(d => (
                                  <div key={d.uid} className="flex items-center gap-2 pl-3 border-l-2 border-primary-200 dark:border-primary-800">
                                    {d.logoUrl ? (
                                      <img src={d.logoUrl} alt="" className="w-6 h-6 rounded-lg object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"/>
                                    ) : (
                                      <div className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                                        {(d.firstName?.[0] ?? '').toUpperCase()}{(d.lastName?.[0] ?? '').toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                                        {d.clinicName || `Dr. ${d.firstName} ${d.lastName}`}
                                      </p>
                                      {d.clinicName && (
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">Dr. {d.firstName} {d.lastName}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Managed Clinics — edit controls for clinic admins */}
                  {data.profile.clinicRole === 'clinic_admin' && (() => {
                    const managedProfiles = data.managedDoctorProfiles ?? []
                    const alreadyManaged  = new Set(managedProfiles.map(d => d.uid))
                    const available = allDoctors.filter(d =>
                      d.uid !== uid &&
                      d.clinicRole !== 'clinic_admin' &&
                      !alreadyManaged.has(d.uid) &&
                      (!d.managedBy || d.managedBy === uid)
                    )
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Managed Clinics</h4>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{managedProfiles.length} assigned</span>
                        </div>

                        <div className="space-y-2 mb-4">
                          {managedProfiles.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500">No clinics assigned yet.</p>
                          ) : managedProfiles.map(d => (
                            <div key={d.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                              {d.logoUrl ? (
                                <img src={d.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"/>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                                  {(d.firstName?.[0] ?? '').toUpperCase()}{(d.lastName?.[0] ?? '').toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                                  {d.clinicName || `Dr. ${d.firstName} ${d.lastName}`}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                  Dr. {d.firstName} {d.lastName}{d.specialization ? ` · ${d.specialization.replace(/_/g, ' ')}` : ''}
                                </p>
                              </div>
                              <button onClick={() => handleRemoveManagedDoctor(d.uid)} disabled={mdSaving}
                                className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50 flex-shrink-0">
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>

                        {available.length > 0 && (
                          <div className="flex gap-2">
                            <select value={addDoctorUid} onChange={e => setAddDoctorUid(e.target.value)}
                              className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-400">
                              <option value="">Add a clinic…</option>
                              {available.map(d => (
                                <option key={d.uid} value={d.uid}>
                                  {d.clinicName || `Dr. ${d.firstName} ${d.lastName}`}
                                </option>
                              ))}
                            </select>
                            <button onClick={handleAddManagedDoctor} disabled={!addDoctorUid || mdSaving}
                              className="px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                              {mdSaving ? '…' : 'Add'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Organization / Group info */}
                  {data.org && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{data.org.name}</h4>
                        <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                          {data.profile.branchName || 'Branch'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-2">All Branches</p>
                        {(data.org.branches ?? []).map(b => (
                          <div key={b.uid} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${b.uid === uid ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.uid === uid ? 'bg-primary-500' : 'bg-gray-400 dark:bg-gray-500'}`}/>
                            <p className={`text-xs font-semibold flex-1 ${b.uid === uid ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {b.branchName}
                            </p>
                            {b.uid === uid && <span className="text-xs text-primary-500 dark:text-primary-400">This clinic</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinic info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Clinic Details</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        { label: 'Email',           value: data.profile.email },
                        { label: 'Phone',           value: data.profile.phone || '—' },
                        { label: 'License No.',     value: data.profile.licenseNumber || '—' },
                        { label: 'Email Verified',  value: data.auth.emailVerified ? 'Yes ✓' : 'No' },
                        { label: 'Joined',          value: fmtDate(data.profile.createdAt) },
                        { label: 'Last Login',      value: data.auth.lastSignInTime ? `${timeAgo(data.auth.lastSignInTime)} (${fmtDate(data.auth.lastSignInTime)})` : 'Never' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
                          <p className="text-gray-800 dark:text-gray-200 mt-0.5 text-sm truncate">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Financials ── */}
              {tab === 'financials' && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Revenue', value: fmt(data.stats.totalRevenue), color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
                      { label: 'Pending',       value: fmt(data.stats.pendingAmount), color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
                      { label: 'Total Invoices', value: data.stats.totalInvoices, color: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
                        <p className="text-lg font-bold">{c.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly revenue chart (bar) */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Monthly Revenue (Last 6 Months)</h4>
                    {data.stats.revenueChart.every(m => m.revenue === 0) ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No revenue recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const max = Math.max(...data.stats.revenueChart.map(m => m.revenue), 1)
                          return data.stats.revenueChart.map(m => {
                            const pct = Math.round((m.revenue / max) * 100)
                            const [y, mo] = m.month.split('-')
                            const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                            return (
                              <div key={m.month} className="flex items-center gap-3">
                                <p className="text-xs text-gray-400 w-14 flex-shrink-0">{label}</p>
                                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-20 text-right">{fmt(m.revenue)}</p>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Patients ── */}
              {tab === 'patients' && (
                <>
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{data.stats.patientCount}</p>
                      <p className="text-sm text-primary-600 dark:text-primary-400">Total Registered Patients</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Recently Added Patients</h4>
                    {data.stats.recentPatients.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No patients yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {data.stats.recentPatients.map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700 dark:text-primary-300">
                              {(p.firstName?.[0] ?? '').toUpperCase()}{(p.lastName?.[0] ?? '').toUpperCase()}
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{p.firstName} {p.lastName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(p.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Staff ── */}
              {tab === 'staff' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Staff / Receptionist Login Accounts</h4>
                  {staffLoading ? (
                    <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Loading…
                    </div>
                  ) : staff.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No staff login accounts added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {staff.map(s => (
                        <div key={s.uid} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-purple-700 dark:text-purple-300">
                              {s.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{s.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.email}</p>
                            </div>
                            <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                              {getStaffRoleLabel(s.role ?? 'receptionist')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              s.viewOnly
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            }`}>
                              {s.viewOnly ? 'View Only' : 'Full Access'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pl-11">
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mr-0.5">Access:</span>
                            {STAFF_MODULES.map(m => (
                              <span key={m.value} className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                s.permissions?.[m.value]
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600'
                              }`}>
                                {m.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { doctor, updateProfile, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [tab,           setTab]          = useState(() => searchParams.get('tab') ?? 'dashboard')
  const [enriched,      setEnriched]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [apiError,      setApiError]     = useState('')
  const [search,        setSearch]       = useState('')
  const [sort,          setSort]         = useState({ key: 'createdAt', dir: -1 })
  const [showCreate,    setShowCreate]   = useState(false)
  const [selectedClinic, setSelectedClinic] = useState(null)
  // Organizations state
  const [orgs,          setOrgs]         = useState([])
  const [orgsLoading,   setOrgsLoading]  = useState(false)
  const [showOrgForm,   setShowOrgForm]  = useState(false)
  const [orgForm,       setOrgForm]      = useState({ name: '', branches: [] })
  const [orgSaving,     setOrgSaving]    = useState(false)
  const [orgErr,        setOrgErr]       = useState('')
  const [editOrg,       setEditOrg]      = useState(null) // org being edited
  const [selectedOrg,   setSelectedOrg]  = useState(null) // org drawer
  // Leads state
  const [leads,         setLeads]        = useState([])
  const [leadsLoading,  setLeadsLoading] = useState(false)
  const [selectedLead,  setSelectedLead] = useState(null)

  // Profile tab state
  const [profileForm,    setProfileForm]    = useState({ firstName: '', lastName: '', email: '' })
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileSaved,   setProfileSaved]   = useState(false)
  const [profileErr,     setProfileErr]     = useState('')
  const [pwForm,         setPwForm]         = useState({ current: '', next: '', confirm: '' })
  const [pwSaving,       setPwSaving]       = useState(false)
  const [pwErr,          setPwErr]          = useState('')
  const [pwDone,         setPwDone]         = useState(false)

  const fetchDoctors = async () => {
    try {
      const res  = await adminFetch('/api/admin/doctors')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setEnriched(data.doctors ?? [])
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrgs = async () => {
    setOrgsLoading(true)
    try {
      const res  = await adminFetch('/api/admin/organizations')
      const data = await res.json()
      setOrgs(data.orgs ?? [])
    } finally {
      setOrgsLoading(false)
    }
  }

  const fetchLeads = async () => {
    setLeadsLoading(true)
    try {
      const res  = await adminFetch('/api/contact')
      const data = await res.json()
      setLeads(data.leads ?? [])
    } finally {
      setLeadsLoading(false)
    }
  }

  const updateLeadStatus = async (id, status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status }))
    await adminFetch('/api/contact', { method: 'PATCH', body: JSON.stringify({ id, status }) })
  }

  useEffect(() => {
    const t = searchParams.get('tab') ?? 'dashboard'
    setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (authLoading || !doctor?.isAdmin) return
    fetchDoctors()
    fetchOrgs()
    fetchLeads()
    setProfileForm({ firstName: doctor.firstName ?? '', lastName: doctor.lastName ?? '', email: doctor.email ?? '' })
  }, [doctor, authLoading])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true); setProfileErr(''); setProfileSaved(false)
    try {
      await updateProfile({ firstName: profileForm.firstName.trim(), lastName: profileForm.lastName.trim() })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (err) {
      setProfileErr(err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.next.length < 8) { setPwErr('Password must be at least 8 characters.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwErr('Passwords do not match.'); return }
    setPwSaving(true); setPwErr(''); setPwDone(false)
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
      const user = auth.currentUser
      const cred = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, pwForm.next)
      setPwDone(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwDone(false), 4000)
    } catch (err) {
      const code = err.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setPwErr('Current password is incorrect.')
      else setPwErr(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const toggleSort = (key) =>
    setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 })

  const stats = useMemo(() => ({
    total:      enriched.length,
    active:     enriched.filter(d => d.subscription?.status === 'active').length,
    trial:      enriched.filter(d => d.subscription?.status === 'trial').length,
    expired:    enriched.filter(d => d.subscription?.status === 'expired').length,
    todayLogin: enriched.filter(d => d.lastSignInTime && Date.now() - new Date(d.lastSignInTime).getTime() < 86400000).length,
  }), [enriched])

  // uid → doctor lookup for resolving managedBy references
  const uidMap = useMemo(() => Object.fromEntries(enriched.map(d => [d.uid, d])), [enriched])

  const isExpired = (d) => d.subscription?.status === 'expired'

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = enriched.filter(d =>
      !q || `${d.firstName} ${d.lastName} ${d.clinicName} ${d.email} ${d.specialization}`.toLowerCase().includes(q)
    )
    const sorted = [...list].sort((a, b) => {
      const va = a[sort.key] ?? ''
      const vb = b[sort.key] ?? ''
      if (va < vb) return sort.dir
      if (va > vb) return -sort.dir
      return 0
    })
    return {
      active:   sorted.filter(d => !isExpired(d)),
      archived: sorted.filter(d => isExpired(d)),
    }
  }, [enriched, search, sort])

  if (doctor && !doctor.isAdmin) {
    return (
      <AppLayout title="Admin Panel">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
            You need administrator privileges to access this panel.
          </p>
          <button onClick={() => router.push('/dashboard')}
            className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            Back to Dashboard
          </button>
        </div>
      </AppLayout>
    )
  }

  const SortIcon = ({ k }) => (
    <svg className={`inline w-3 h-3 ml-1 ${sort.key === k ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'} ${sort.key === k && sort.dir === 1 ? 'rotate-180' : ''} transition-transform`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
    </svg>
  )

  return (
    <AppLayout title="Admin Panel">

      {/* ── Organizations tab ─────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Organizations</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Group clinics into multi-branch organizations</p>
            </div>
            <button onClick={() => { setOrgForm({ name: '', branches: [] }); setOrgErr(''); setEditOrg(null); setShowOrgForm(true) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              New Organization
            </button>
          </div>

          {showOrgForm && (
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30 space-y-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {editOrg ? 'Edit Organization' : 'New Organization'}
              </p>
              <div>
                <label className="form-label">Organization Name *</label>
                <input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Apollo Clinic Group" className="input-field"/>
              </div>
              <div>
                <label className="form-label">Branch Clinics</label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Select the clinic accounts that form the branches of this organization.</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {enriched.map(d => {
                    const isSelected = orgForm.branches.some(b => b.uid === d.uid)
                    const branch = orgForm.branches.find(b => b.uid === d.uid)
                    return (
                      <div key={d.uid} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${isSelected ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setOrgForm(f => ({ ...f, branches: [...f.branches, { uid: d.uid, branchName: d.clinicName || `Dr. ${d.firstName} ${d.lastName}` }] }))
                            } else {
                              setOrgForm(f => ({ ...f, branches: f.branches.filter(b => b.uid !== d.uid) }))
                            }
                          }}
                          className="rounded text-primary-500"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {d.clinicName || `Dr. ${d.firstName} ${d.lastName}`}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{d.email}</p>
                        </div>
                        {isSelected && (
                          <input value={branch.branchName}
                            onChange={e => setOrgForm(f => ({ ...f, branches: f.branches.map(b => b.uid === d.uid ? { ...b, branchName: e.target.value } : b) }))}
                            placeholder="Branch name"
                            className="text-xs border border-primary-300 dark:border-primary-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-36 focus:outline-none focus:ring-1 focus:ring-primary-400"
                            onClick={e => e.stopPropagation()}/>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {orgErr && <p className="text-xs text-red-600 dark:text-red-400">{orgErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowOrgForm(false); setEditOrg(null) }}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button disabled={orgSaving} onClick={async () => {
                  if (!orgForm.name.trim()) { setOrgErr('Name is required.'); return }
                  if (orgForm.branches.length < 1) { setOrgErr('Select at least one branch.'); return }
                  setOrgSaving(true); setOrgErr('')
                  try {
                    if (editOrg) {
                      await adminFetch('/api/admin/organizations', { method: 'PATCH', body: JSON.stringify({ id: editOrg.id, ...orgForm }) })
                    } else {
                      await adminFetch('/api/admin/organizations', { method: 'POST', body: JSON.stringify(orgForm) })
                    }
                    setShowOrgForm(false); setEditOrg(null)
                    fetchOrgs()
                  } catch (err) { setOrgErr(err.message) }
                  finally { setOrgSaving(false) }
                }}
                  className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors">
                  {orgSaving ? 'Saving…' : editOrg ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {orgsLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : orgs.length === 0 && !showOrgForm ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No organizations yet. Create one to link clinic branches.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {orgs.map(org => (
                <OrgCard
                  key={org.id}
                  org={org}
                  onSelect={setSelectedOrg}
                  onEdit={() => { setOrgForm({ name: org.name, branches: org.branches ?? [] }); setEditOrg(org); setShowOrgForm(true); setOrgErr('') }}
                  onDelete={async () => {
                    if (!window.confirm('Delete this organization? Branch clinics will be unlinked but their data stays intact.')) return
                    await adminFetch('/api/admin/organizations', { method: 'DELETE', body: JSON.stringify({ id: org.id }) })
                    fetchOrgs(); fetchDoctors()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Leads tab ─────────────────────────────────────────────────────────── */}
      {tab === 'leads' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Contact Leads</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Submitted via the landing page contact form</p>
            </div>
            <button onClick={fetchLeads} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Refresh</button>
          </div>

          {leadsLoading ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">No leads yet. They'll appear here when visitors submit the contact form.</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                      {['Name', 'Email', 'Phone', 'Type', 'Date', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide first:pl-5 last:pr-5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {leads.map(lead => {
                      const statusCfg = {
                        new:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                        read:      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                        contacted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                      }
                      const typeLabel = { pricing: 'Pricing', demo: 'Demo', support: 'Support', general: 'General' }
                      return (
                        <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3.5 pl-5">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{lead.name}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{lead.email}</a>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{lead.phone || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{typeLabel[lead.type] ?? lead.type}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(lead.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusCfg[lead.status] ?? ''}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 pr-5">
                            <select value={lead.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => updateLeadStatus(lead.id, e.target.value)}
                              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-400">
                              <option value="new">New</option>
                              <option value="read">Read</option>
                              <option value="contacted">Contacted</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lead detail drawer */}
          {selectedLead && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)}/>
              <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-bold text-gray-900 dark:text-white">Lead Details</h2>
                  <button onClick={() => setSelectedLead(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Name',    value: selectedLead.name  },
                      { label: 'Email',   value: selectedLead.email },
                      { label: 'Phone',   value: selectedLead.phone || '—' },
                      { label: 'Type',    value: { pricing: 'Pricing & Plans', demo: 'Request a Demo', support: 'Technical Support', general: 'General Inquiry' }[selectedLead.type] ?? selectedLead.type },
                      { label: 'Received', value: fmtDate(selectedLead.createdAt) },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{f.label}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{f.value}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Status</p>
                      <select value={selectedLead.status} onChange={e => updateLeadStatus(selectedLead.id, e.target.value)}
                        className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-400">
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="contacted">Contacted</option>
                      </select>
                    </div>
                  </div>
                  {selectedLead.message && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Message</p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedLead.message}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <a href={`mailto:${selectedLead.email}`}
                      className="flex-1 text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                      Reply via Email
                    </a>
                    {selectedLead.phone && (
                      <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        className="flex-1 text-center py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors">
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dashboard tab ─────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          <CreateClinicModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchDoctors() }}
            clinicAdmins={enriched.filter(d => d.clinicRole === 'clinic_admin')}
          />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Registered Clinics" value={stats.total}      color="primary" />
            <StatCard label="Active"              value={stats.active}     color="green"   />
            <StatCard label="Trial"               value={stats.trial}      color="blue"    />
            <StatCard label="Expired"             value={stats.expired}    color="red"     />
            <StatCard label="Logged In Today"     value={stats.todayLogin} color="yellow"  />
          </div>

          {/* Search + Add */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clinic, doctor, email…"
                className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 transition-all text-gray-900 dark:text-white placeholder-gray-400"/>
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Clinic
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-3 text-sm">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading all registered clients…
            </div>
          ) : apiError ? (
            <div className="p-6 text-sm text-red-600 dark:text-red-400">{apiError}</div>
          ) : (
            <ClinicTable
              rows={filtered.active}
              title="Active Clients"
              emptyMsg={search ? `No active clients matching "${search}"` : 'No active clients yet.'}
              uidMap={uidMap}
              toggleSort={toggleSort}
              SortIcon={SortIcon}
              onSelect={setSelectedClinic}
            />
          )}

          {/* Archived (expired) clinics */}
          {!loading && !apiError && filtered.archived.length > 0 && (
            <ArchivedSection
              rows={filtered.archived}
              uidMap={uidMap}
              onSelect={setSelectedClinic}
            />
          )}

        </div>
      )}

      {selectedClinic && (
        <ClinicDrawer
          uid={selectedClinic}
          onClose={() => setSelectedClinic(null)}
          onUpdated={() => fetchDoctors()}
          allDoctors={enriched}
        />
      )}

      {selectedOrg && (
        <OrgDrawer
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onEdit={() => {
            setOrgForm({ name: selectedOrg.name, branches: selectedOrg.branches ?? [] })
            setEditOrg(selectedOrg)
            setShowOrgForm(true)
            setOrgErr('')
            setTab('profile')
          }}
          onDelete={async () => {
            if (!window.confirm('Delete this organization? Branch clinics will be unlinked but their data stays intact.')) return
            await adminFetch('/api/admin/organizations', { method: 'DELETE', body: JSON.stringify({ id: selectedOrg.id }) })
            setSelectedOrg(null)
            fetchOrgs(); fetchDoctors()
          }}
        />
      )}

    </AppLayout>
  )
}
