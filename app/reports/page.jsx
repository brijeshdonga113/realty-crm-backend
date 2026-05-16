'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useReports } from '@/hooks/useReports'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuth } from '@/context/AuthContext'
import { getReferralSources, buildLabelMap } from '@/lib/referralSources'
import { PAYMENT_METHODS, COLLECTED_BY_OPTIONS } from '@/models/Invoice'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const firstOfYear = `${new Date().getFullYear()}-01-01`

function periodRange(period) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  switch (period) {
    case 'this_month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      return { from, to: today }
    }
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
        to:   `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
      }
    }
    case '3m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case '6m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 6)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case 'this_year':
      return { from: firstOfYear, to: today }
    case 'all':
    default:
      return { from: '2000-01-01', to: today }
  }
}

function computeMonthlyData(items, dateKey, valueKey, from, to) {
  const start = new Date(from + 'T00:00:00')
  const end   = new Date(to   + 'T00:00:00')
  const months = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  while (d <= end) {
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label  = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const value  = items
      .filter(item => (item[dateKey] ?? '').startsWith(prefix))
      .reduce((s, item) => s + (valueKey === 'count' ? 1 : (item[valueKey] ?? 0)), 0)
    months.push({ label, [valueKey === 'count' ? 'count' : valueKey]: value })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

function computeReferralForPeriod(patients, from, to, doctorSources) {
  const LABELS = buildLabelMap(getReferralSources(doctorSources))
  const filtered = patients.filter(p => {
    const d = (p.createdAt ?? '').slice(0, 10)
    return d >= from && d <= to
  })
  const counts = {}
  filtered.forEach(p => {
    const key = p.referralSource || ''
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .map(([key, count]) => ({ key, label: LABELS[key] ?? (key || 'Unknown'), count }))
    .sort((a, b) => b.count - a.count)
}

// Simple period filter bar (compact) — supports custom date range
const PERIOD_OPTS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m',         label: '3M' },
  { value: '6m',         label: '6M' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'all',        label: 'All Time' },
  { value: 'custom',     label: 'Custom' },
]

function SectionFilter({ value, onChange, customFrom, customTo, onCustomFrom, onCustomTo }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIOD_OPTS.map(p => (
        <button key={p.value} onClick={() => onChange(p.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
            ${value === p.value
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
          {p.label}
        </button>
      ))}
      {value === 'custom' && onCustomFrom && (
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={customFrom} max={customTo}
            onChange={e => onCustomFrom(e.target.value)}
            className="input-field py-1 text-xs w-32"/>
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={customTo} min={customFrom} max={today}
            onChange={e => onCustomTo(e.target.value)}
            className="input-field py-1 text-xs w-32"/>
        </div>
      )}
    </div>
  )
}

// ─── Chart components ─────────────────────────────────────────────────────────

// SVG line chart with area fill
function LineChart({ data, valueKey, labelKey, color = 'blue', fmtValue }) {
  if (!data?.length || data.every(d => d[valueKey] === 0)) return (
    <div className="h-52 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  )

  const W = 800, H = 180, padL = 8, padR = 8, padT = 24, padB = 32
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padT + innerH - (d[valueKey] / max) * innerH,
    v: d[valueKey],
    l: d[labelKey],
  }))

  const colors = {
    green:  { stroke: '#22c55e', fill: 'rgba(34,197,94,0.12)',  dot: '#16a34a', label: '#15803d' },
    blue:   { stroke: '#6366f1', fill: 'rgba(99,102,241,0.12)', dot: '#4338ca', label: '#4338ca' },
  }
  const c = colors[color] ?? colors.blue

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${pts[0].x},${padT + innerH} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length-1].x},${padT + innerH} Z`

  // show every other label if many months
  const step = data.length > 8 ? 2 : 1

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {/* horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padL} x2={W - padR}
            y1={padT + innerH - t * innerH} y2={padT + innerH - t * innerH}
            stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"/>
        ))}
        {/* area fill */}
        <path d={areaPath} fill={c.fill}/>
        {/* line */}
        <polyline points={polyline} fill="none" stroke={c.stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {/* dots + value labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={c.dot}/>
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fill={c.label} fontWeight="600">
              {fmtValue ? fmtValue(p.v) : p.v}
            </text>
          </g>
        ))}
        {/* x-axis labels */}
        {pts.map((p, i) => i % step === 0 && (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
            {p.l}
          </text>
        ))}
      </svg>
    </div>
  )
}

const BAR_COLORS = ['bg-primary-500','bg-green-500','bg-orange-500','bg-purple-500','bg-yellow-400','bg-teal-500','bg-red-400','bg-pink-400']

function HorizontalBar({ items, totalKey = 'count', labelKey = 'label' }) {
  if (!items?.length) return <div className="text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  const max = Math.max(...items.map(i => i[totalKey]), 1)
  const total = items.reduce((s, i) => s + i[totalKey], 0)
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.key ?? idx}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">{item[labelKey]}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{total > 0 ? Math.round((item[totalKey]/total)*100) : 0}%</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{item[totalKey]}</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2.5 rounded-full transition-all`}
              style={{ width: `${(item[totalKey] / max) * 100}%` }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'text-primary-600 dark:text-primary-400',
    green:  'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red:    'text-red-600 dark:text-red-400',
    teal:   'text-teal-600 dark:text-teal-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color] ?? colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Period filter bar ────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m',         label: '3 Months' },
  { value: '6m',         label: '6 Months' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'all',        label: 'All Time' },
  { value: 'custom',     label: 'Custom' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { formatCurrency } = usePreferences()
  const { doctor } = useAuth()
  const { stats, rawInvoices, rawPatients, rawAppointments, rawVisits, loading } = useReports()

  const [period,      setPeriod]      = useState('this_month')
  const [customFrom,  setCustomFrom]  = useState(firstOfYear)
  const [customTo,    setCustomTo]    = useState(today)
  // Per-section filters
  const [incomePeriod,  setIncomePeriod]  = useState('6m')
  const [patientPeriod, setPatientPeriod] = useState('6m')
  const [sourcePeriod,  setSourcePeriod]  = useState('all')
  // Custom date ranges per section
  const [incomeFrom,  setIncomeFrom]  = useState(firstOfYear)
  const [incomeTo,    setIncomeTo]    = useState(today)
  const [patientFrom, setPatientFrom] = useState(firstOfYear)
  const [patientTo,   setPatientTo]   = useState(today)
  const [sourceFrom,  setSourceFrom]  = useState(firstOfYear)
  const [sourceTo,    setSourceTo]    = useState(today)

  // Resolve date range for the active period
  const { from, to } = useMemo(() => {
    return period === 'custom'
      ? { from: customFrom, to: customTo }
      : periodRange(period)
  }, [period, customFrom, customTo])

  // Filtered KPI stats for selected period
  const filteredStats = useMemo(() => {
    if (!rawPatients.length && !rawInvoices.length && !rawAppointments.length && !rawVisits.length) return null
    const inRange = (dateStr) => dateStr >= from && dateStr <= to

    const patients     = rawPatients.filter(p => inRange((p.createdAt ?? '').slice(0, 10)))
    const visits       = rawVisits.filter(v => inRange((v.visitDate ?? '').slice(0, 10)))
    const appointments = rawAppointments.filter(a => inRange(a.date ?? ''))
    const paidInvoices = rawInvoices.filter(i => i.status === 'paid' && inRange(i.issueDate ?? ''))
    const dueInvoices  = rawInvoices.filter(i => ['draft', 'sent'].includes(i.status) && inRange(i.issueDate ?? ''))
    const overdueInvoices = rawInvoices.filter(i => i.status === 'overdue' && inRange(i.issueDate ?? ''))

    return {
      patients:      patients.length,
      activePatients: patients.filter(p => p.status === 'active').length,
      visits:        visits.length,
      revenue:       paidInvoices.reduce((s, i) => s + i.total, 0),
      paidCount:     paidInvoices.length,
      pending:       dueInvoices.length,
      pendingAmount: dueInvoices.reduce((s, i) => s + i.total, 0),
      overdueCount:  overdueInvoices.length,
      totalInvoices: paidInvoices.length + dueInvoices.length + overdueInvoices.length,
      appointments:  appointments.length,
      completed:     appointments.filter(a => a.status === 'completed').length,
      noShow:        appointments.filter(a => a.status === 'no_show').length,
      upcoming:      appointments.filter(a => a.status === 'scheduled').length,
    }
  }, [rawPatients, rawVisits, rawAppointments, rawInvoices, from, to])

  // Section-specific computed data
  const incomeRange  = useMemo(() => incomePeriod  === 'custom' ? { from: incomeFrom,  to: incomeTo  } : periodRange(incomePeriod),  [incomePeriod,  incomeFrom,  incomeTo])
  const patientRange = useMemo(() => patientPeriod === 'custom' ? { from: patientFrom, to: patientTo } : periodRange(patientPeriod), [patientPeriod, patientFrom, patientTo])
  const sourceRange  = useMemo(() => sourcePeriod  === 'custom' ? { from: sourceFrom,  to: sourceTo  } : periodRange(sourcePeriod),  [sourcePeriod,  sourceFrom,  sourceTo])

  const incomeChartData  = useMemo(() =>
    computeMonthlyData(rawInvoices.filter(i => i.status === 'paid'), 'issueDate', 'total', incomeRange.from, incomeRange.to),
    [rawInvoices, incomeRange])

  const paymentMethodData = useMemo(() => {
    const paid = rawInvoices.filter(i =>
      i.status === 'paid' && (i.issueDate ?? '') >= from && (i.issueDate ?? '') <= to
    )
    const map = {}
    paid.forEach(inv => {
      const key = inv.paymentMethod || 'unknown'
      if (!map[key]) map[key] = { amount: 0, count: 0 }
      map[key].amount += inv.total ?? 0
      map[key].count++
    })
    return Object.entries(map)
      .map(([key, { amount, count }]) => ({
        key,
        label: PAYMENT_METHODS.find(m => m.value === key)?.label ?? (key === 'unknown' ? 'Not specified' : key),
        amount,
        count,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [rawInvoices, from, to])

  const collectedByData = useMemo(() => {
    const paid = rawInvoices.filter(i =>
      i.status === 'paid' && (i.issueDate ?? '') >= from && (i.issueDate ?? '') <= to && i.collectedBy
    )
    const map = {}
    paid.forEach(inv => {
      const key = inv.collectedBy
      if (!map[key]) map[key] = { amount: 0, count: 0 }
      map[key].amount += inv.total ?? 0
      map[key].count++
    })
    return Object.entries(map)
      .map(([key, { amount, count }]) => ({
        key,
        label: COLLECTED_BY_OPTIONS.find(o => o.value === key)?.label ?? key,
        amount,
        count,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [rawInvoices, from, to])

  const patientChartData = useMemo(() =>
    computeMonthlyData(rawPatients, 'createdAt', 'count', patientRange.from, patientRange.to),
    [rawPatients, patientRange])

  const sourceChartData  = useMemo(() =>
    computeReferralForPeriod(rawPatients, sourceRange.from, sourceRange.to, doctor?.referralSources),
    [rawPatients, sourceRange, doctor])

  if (loading) return (
    <AppLayout title="Reports & Analytics">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading reports…
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="Reports & Analytics">
      <div className="space-y-8">

        {/* ── Period filter ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${period === p.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-1">
                <input type="date" value={customFrom} max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="input-field py-1.5 text-xs w-36"/>
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={customTo} min={customFrom} max={today}
                  onChange={e => setCustomTo(e.target.value)}
                  className="input-field py-1.5 text-xs w-36"/>
              </div>
            )}
          </div>
        </div>

        {/* ── Filtered KPI row ─────────────────────────────────────────────── */}
        {filteredStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="New Patients"     value={filteredStats.patients}                        sub={`registered in period`}           color="blue"/>
            <StatCard label="Visits"           value={filteredStats.visits}                          sub="recorded in period"               color="teal"/>
            <StatCard label="Revenue"          value={formatCurrency(filteredStats.revenue)}         sub="from paid invoices"               color="green"/>
            <StatCard label="Due / Pending"    value={formatCurrency(filteredStats.pendingAmount)}   sub={`${filteredStats.pending} invoices`} color="orange"/>
          </div>
        )}

        {/* ── Revenue chart with section filter ────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Income / Revenue</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">Paid invoices by month — {formatCurrency(incomeChartData.reduce((s, d) => s + d.total, 0))} total</p>
            </div>
          </div>
          <div className="mb-5">
            <SectionFilter value={incomePeriod} onChange={setIncomePeriod}
              customFrom={incomeFrom} customTo={incomeTo}
              onCustomFrom={setIncomeFrom} onCustomTo={setIncomeTo}/>
          </div>
          <LineChart data={incomeChartData} valueKey="total" labelKey="label" color="green"
            fmtValue={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}/>
        </div>

        {/* ── Patient Growth with section filter ──────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Patient Registrations</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">New patients registered per month — {patientChartData.reduce((s, d) => s + d.count, 0)} total</p>
            </div>
          </div>
          <div className="mb-5">
            <SectionFilter value={patientPeriod} onChange={setPatientPeriod}
              customFrom={patientFrom} customTo={patientTo}
              onCustomFrom={setPatientFrom} onCustomTo={setPatientTo}/>
          </div>
          <LineChart data={patientChartData} valueKey="count" labelKey="label" color="blue"/>
        </div>

        {/* ── Referral breakdown + Appointment breakdown ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Patient Sources</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Where patients are coming from</p>
              </div>
            </div>
            <div className="mb-4">
              <SectionFilter value={sourcePeriod} onChange={setSourcePeriod}
                customFrom={sourceFrom} customTo={sourceTo}
                onCustomFrom={setSourceFrom} onCustomTo={setSourceTo}/>
            </div>
            <HorizontalBar items={sourceChartData} totalKey="count" labelKey="label"/>
          </div>

          {filteredStats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Appointment Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Scheduled',  value: filteredStats.upcoming,   color: 'bg-primary-500' },
                  { label: 'Completed',  value: filteredStats.completed,   color: 'bg-green-500' },
                  { label: 'No Shows',   value: filteredStats.noShow,      color: 'bg-yellow-400' },
                  { label: 'Total',      value: filteredStats.appointments, color: 'bg-gray-300 dark:bg-gray-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
                {filteredStats.appointments > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                      No-show rate: {((filteredStats.noShow / filteredStats.appointments) * 100).toFixed(1)}%
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: `${(filteredStats.noShow / filteredStats.appointments) * 100}%` }}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Patient Analytics + Billing Summary ─────────────────────────── */}
        {filteredStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Patient Analytics</h3>
              <div className="space-y-3">
                {[
                  { label: 'New Patients (period)',  value: filteredStats.patients,       color: 'bg-primary-500' },
                  { label: 'Active Patients',         value: filteredStats.activePatients, color: 'bg-green-500' },
                  { label: 'Visits',                  value: filteredStats.visits,         color: 'bg-teal-500' },
                  { label: 'Appointments No-Show',    value: filteredStats.noShow,         color: 'bg-yellow-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Paid Invoices',  value: filteredStats.paidCount,    amount: filteredStats.revenue,        color: 'bg-green-500' },
                  { label: 'Due / Pending',  value: filteredStats.pending,       amount: filteredStats.pendingAmount,  color: 'bg-orange-400' },
                  { label: 'Overdue',        value: filteredStats.overdueCount,  amount: 0,                            color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.value}{item.amount > 0 ? ` · ${formatCurrency(item.amount)}` : ''}
                    </span>
                  </div>
                ))}
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total invoices in period: <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredStats.totalInvoices}</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Payment Collection Breakdown ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Payment Method</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">How payments were collected in the selected period</p>
            {paymentMethodData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No paid invoices in this period</p>
            ) : (
              <div className="space-y-3">
                {paymentMethodData.map((item, idx) => {
                  const total = paymentMethodData.reduce((s, i) => s + i.amount, 0)
                  const pct   = total > 0 ? Math.round((item.amount / total) * 100) : 0
                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.count} inv · {pct}%</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`}
                          style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Collected By</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Revenue by person who collected the payment</p>
            {collectedByData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No collection data in this period</p>
            ) : (
              <div className="space-y-3">
                {collectedByData.map((item, idx) => {
                  const total = collectedByData.reduce((s, i) => s + i.amount, 0)
                  const pct   = total > 0 ? Math.round((item.amount / total) * 100) : 0
                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.count} inv · {pct}%</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`}
                          style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </AppLayout>
  )
}
