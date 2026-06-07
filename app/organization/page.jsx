'use client'

import { useState, useEffect, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { formatCurrency } from '@/lib/preferences'

function fmtCur(val, currency = 'INR') {
  return formatCurrency(val, currency)
}

function StatCard({ label, value, sub, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red:    'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    amber:  'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    teal:   'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// Simple sparkline-style bar chart for monthly revenue
function RevenueChart({ revenueByMonth, currency }) {
  const months = useMemo(() => {
    const now   = new Date()
    const out   = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      out.push({ key: k, label: d.toLocaleString('default', { month: 'short' }), value: revenueByMonth[k] ?? 0 })
    }
    return out
  }, [revenueByMonth])

  const max = Math.max(...months.map(m => m.value), 1)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Monthly Revenue (last 12 months)</h3>
      <div className="flex items-end gap-1.5 h-28">
        {months.map(m => (
          <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-primary-500 dark:bg-primary-600 rounded-t-sm opacity-80 hover:opacity-100 transition-all cursor-default"
              style={{ height: `${Math.max((m.value / max) * 100, m.value > 0 ? 4 : 0)}%` }}
            />
            {/* Tooltip */}
            {m.value > 0 && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow">
                {fmtCur(m.value, currency)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {months.map(m => (
          <div key={m.key} className="flex-1 text-center text-[9px] text-gray-400 dark:text-gray-500">{m.label}</div>
        ))}
      </div>
    </div>
  )
}

function BranchRow({ b, currency, maxRevenue }) {
  const pct = maxRevenue > 0 ? (b.revenue / maxRevenue) * 100 : 0
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700 dark:text-primary-300">
          {(b.branchName?.[0] ?? 'B').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{b.branchName}</p>
          {b.clinicName && b.clinicName !== b.branchName && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{b.clinicName}</p>
          )}
        </div>
        <p className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">{fmtCur(b.revenue, currency)}</p>
      </div>

      {/* Revenue bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all" style={{ width: `${pct}%` }}/>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Patients</p>
          <p className="text-sm font-bold text-gray-800 dark:text-white">{b.patients.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Pending</p>
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmtCur(b.pending, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Expenses</p>
          <p className="text-sm font-bold text-red-500 dark:text-red-400">{fmtCur(b.expenses, currency)}</p>
        </div>
      </div>
    </div>
  )
}

export default function OrganizationPage() {
  const { doctor, org, isReceptionist } = useAuth()
  const currency = doctor?.currency ?? 'INR'

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    if (!org) return
    let cancelled = false
    setLoading(true); setErr('')
    auth.currentUser?.getIdToken().then(token =>
      fetch('/api/organization/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then(r => r.json()).then(d => {
      if (cancelled) return
      if (d.error) throw new Error(d.error)
      setData(d)
    }).catch(e => {
      if (!cancelled) setErr(e.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [org])

  const maxRevenue = useMemo(() =>
    Math.max(...(data?.branches ?? []).map(b => b.revenue), 1)
  , [data])

  if (isReceptionist) {
    return (
      <AppLayout title="Organization">
        <div className="flex items-center justify-center py-32 text-gray-400 text-sm">
          Organization overview is available to doctors only.
        </div>
      </AppLayout>
    )
  }

  if (!org) {
    return (
      <AppLayout title="Organization">
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold">Not in an organization</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Ask your platform admin to add you to an organization to see the combined overview.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Organization">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{data?.org?.name ?? org.name}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Combined overview across {data?.branches?.length ?? org.branches?.length ?? '—'} branches
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400 text-sm">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading organization data…
          </div>
        )}

        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {err}
          </div>
        )}

        {data && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard
                label="Total Revenue"
                value={fmtCur(data.totals.revenue, currency)}
                sub="from paid invoices"
                color="green"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              />
              <StatCard
                label="Total Patients"
                value={data.totals.patients.toLocaleString()}
                sub="across all branches"
                color="blue"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
              />
              <StatCard
                label="Total Appointments"
                value={data.totals.appointments.toLocaleString()}
                sub="all time"
                color="purple"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
              />
              <StatCard
                label="Pending / Overdue"
                value={fmtCur(data.totals.pending + data.totals.overdue, currency)}
                sub={`${fmtCur(data.totals.overdue, currency)} overdue`}
                color="amber"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              />
              <StatCard
                label="Total Expenses"
                value={fmtCur(data.totals.expenses, currency)}
                sub="all branches combined"
                color="red"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
              />
              <StatCard
                label="Net Revenue"
                value={fmtCur(data.totals.revenue - data.totals.expenses, currency)}
                sub="revenue minus expenses"
                color="teal"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
              />
            </div>

            {/* Monthly chart */}
            <RevenueChart revenueByMonth={data.totals.revenueByMonth} currency={currency} />

            {/* Per-branch breakdown */}
            <div>
              <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3">
                Branch Breakdown
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {data.branches.map(b => (
                  <BranchRow key={b.uid} b={b} currency={currency} maxRevenue={maxRevenue} />
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </AppLayout>
  )
}
