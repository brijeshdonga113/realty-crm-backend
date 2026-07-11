'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useReports } from '@/hooks/useReports'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuth } from '@/context/AuthContext'
import { getReferralSources, buildLabelMap } from '@/lib/referralSources'
import { PAYMENT_METHODS, COLLECTED_BY_OPTIONS } from '@/models/Invoice'
import { useInventory } from '@/hooks/useInventory'
import { useBilling } from '@/hooks/useBilling'
import { useExpenses } from '@/hooks/useExpenses'
import { useRequireModuleAccess } from '@/hooks/useRequireModuleAccess'
import { EXPENSE_CATEGORIES } from '@/app/expenses/page'

// ─── Shared helpers ────────────────────────────────────────────────────────────

const today      = new Date().toISOString().slice(0, 10)
const firstOfYear = `${new Date().getUTCFullYear()}-01-01`

// All stored timestamps (createdAt, issueDate, etc.) are recorded via toISOString(),
// i.e. UTC calendar days — so period boundaries must use UTC getters too, or the
// "This Month"/"Last Month" range can invert (from > to) in timezones ahead of UTC
// (e.g. IST) during the first few hours after local midnight, silently returning no data.
function periodRange(period) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  switch (period) {
    case 'this_month': {
      const from = `${y}-${pad(m + 1)}-01`
      return { from, to: today }
    }
    case 'last_month': {
      const d    = new Date(Date.UTC(y, m - 1, 1))
      const last = new Date(Date.UTC(y, m, 0))
      return {
        from: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`,
        to:   `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`,
      }
    }
    case '3m': { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - 3); return { from: d.toISOString().slice(0, 10), to: today } }
    case '6m': { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - 6); return { from: d.toISOString().slice(0, 10), to: today } }
    case 'this_year': return { from: firstOfYear, to: today }
    case 'all':
    default:   return { from: '2000-01-01', to: today }
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
  const LABELS   = buildLabelMap(getReferralSources(doctorSources))
  const filtered = patients.filter(p => { const d = (p.createdAt ?? '').slice(0, 10); return d >= from && d <= to })
  const counts   = {}
  filtered.forEach(p => { const key = p.referralSource || ''; counts[key] = (counts[key] ?? 0) + 1 })
  return Object.entries(counts)
    .map(([key, count]) => ({ key, label: LABELS[key] ?? (key || 'Unknown'), count }))
    .sort((a, b) => b.count - a.count)
}

// ─── Inventory helpers ─────────────────────────────────────────────────────────

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function pct(part, total) { return total ? ((part / total) * 100).toFixed(1) : '0' }

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function getMonthKey(dateStr) { if (!dateStr) return null; const s = String(dateStr).slice(0, 7); return s.length === 7 ? s : null }
function MonthLabel(key) { const [y, m] = key.split('-'); return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}` }

function Bar({ value, max, color }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }}/>
    </div>
  )
}

// ─── General report components ─────────────────────────────────────────────────

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
          <input type="date" value={customFrom} max={customTo} onChange={e => onCustomFrom(e.target.value)} className="input-field py-1 text-xs w-32"/>
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={customTo} min={customFrom} max={today} onChange={e => onCustomTo(e.target.value)} className="input-field py-1 text-xs w-32"/>
        </div>
      )}
    </div>
  )
}

function LineChart({ data, valueKey, labelKey, color = 'blue', fmtValue }) {
  if (!data?.length || data.every(d => d[valueKey] === 0)) return (
    <div className="h-52 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  )
  const W = 800, H = 180, padL = 8, padR = 8, padT = 24, padB = 32
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const max  = Math.max(...data.map(d => d[valueKey]), 1)
  const pts  = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padT + innerH - (d[valueKey] / max) * innerH,
    v: d[valueKey],
    l: d[labelKey],
  }))
  const colors = {
    green: { stroke: '#22c55e', fill: 'rgba(34,197,94,0.12)',  dot: '#16a34a', label: '#15803d' },
    blue:  { stroke: '#6366f1', fill: 'rgba(99,102,241,0.12)', dot: '#4338ca', label: '#4338ca' },
  }
  const c        = colors[color] ?? colors.blue
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${pts[0].x},${padT + innerH} ` + pts.map(p => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length-1].x},${padT + innerH} Z`
  const step     = data.length > 8 ? 2 : 1
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padL} x2={W - padR} y1={padT + innerH - t * innerH} y2={padT + innerH - t * innerH} stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"/>
        ))}
        <path d={areaPath} fill={c.fill}/>
        <polyline points={polyline} fill="none" stroke={c.stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={c.dot}/>
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fill={c.label} fontWeight="600">
              {fmtValue ? fmtValue(p.v) : p.v}
            </text>
          </g>
        ))}
        {pts.map((p, i) => i % step === 0 && (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">{p.l}</text>
        ))}
      </svg>
    </div>
  )
}

const BAR_COLORS = ['bg-primary-500','bg-green-500','bg-orange-500','bg-purple-500','bg-yellow-400','bg-teal-500','bg-red-400','bg-pink-400']

function HorizontalBar({ items, totalKey = 'count', labelKey = 'label' }) {
  if (!items?.length) return <div className="text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  const max   = Math.max(...items.map(i => i[totalKey]), 1)
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
            <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2.5 rounded-full transition-all`} style={{ width: `${(item[totalKey] / max) * 100}%` }}/>
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

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m',         label: '3 Months' },
  { value: '6m',         label: '6 Months' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'all',        label: 'All Time' },
  { value: 'custom',     label: 'Custom' },
]

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'general',      label: 'General' },
  { key: 'inv_overview', label: 'Inventory Overview' },
  { key: 'products',     label: 'Product Analysis' },
  { key: 'revenue',      label: 'Revenue Analysis' },
  { key: 'expenses',     label: 'Expenses' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  useRequireModuleAccess('reports')
  const { formatCurrency } = usePreferences()
  const { doctor }         = useAuth()
  const { stats, rawInvoices, rawPatients, rawAppointments, rawVisits, loading } = useReports()
  const { items }    = useInventory()
  const { invoices } = useBilling()
  const { expenses } = useExpenses()

  const [activeTab, setActiveTab] = useState('general')

  // General tab state
  const [period,       setPeriod]       = useState('this_month')
  const [customFrom,   setCustomFrom]   = useState(firstOfYear)
  const [customTo,     setCustomTo]     = useState(today)
  const [incomePeriod, setIncomePeriod] = useState('6m')
  const [patientPeriod,setPatientPeriod]= useState('6m')
  const [sourcePeriod, setSourcePeriod] = useState('all')
  const [incomeFrom,   setIncomeFrom]   = useState(firstOfYear)
  const [incomeTo,     setIncomeTo]     = useState(today)
  const [patientFrom,  setPatientFrom]  = useState(firstOfYear)
  const [patientTo,    setPatientTo]    = useState(today)
  const [sourceFrom,   setSourceFrom]   = useState(firstOfYear)
  const [sourceTo,     setSourceTo]     = useState(today)

  // Product analysis state
  const [search, setSearch] = useState('')

  // Revenue analysis period filter
  const [revPeriod,     setRevPeriod]     = useState('all')
  const [revCustomFrom, setRevCustomFrom] = useState(firstOfYear)
  const [revCustomTo,   setRevCustomTo]   = useState(today)

  // ── General computed ───────────────────────────────────────────────────────
  const { from, to } = useMemo(() =>
    period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period),
    [period, customFrom, customTo])

  const filteredStats = useMemo(() => {
    if (!rawPatients.length && !rawInvoices.length && !rawAppointments.length && !rawVisits.length) return null
    const inRange = (dateStr) => dateStr >= from && dateStr <= to
    const patients     = rawPatients.filter(p => inRange((p.createdAt ?? '').slice(0, 10)))
    const visits       = rawVisits.filter(v => inRange((v.visitDate ?? '').slice(0, 10)))
    const appointments = rawAppointments.filter(a => inRange(a.date ?? ''))
    const paidInvoices    = rawInvoices.filter(i => i.status === 'paid'  && inRange(i.issueDate ?? ''))
    const dueInvoices     = rawInvoices.filter(i => ['draft','sent'].includes(i.status) && inRange(i.issueDate ?? ''))
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

  const incomeRange  = useMemo(() => incomePeriod  === 'custom' ? { from: incomeFrom,  to: incomeTo  } : periodRange(incomePeriod),  [incomePeriod,  incomeFrom,  incomeTo])
  const patientRange = useMemo(() => patientPeriod === 'custom' ? { from: patientFrom, to: patientTo } : periodRange(patientPeriod), [patientPeriod, patientFrom, patientTo])
  const sourceRange  = useMemo(() => sourcePeriod  === 'custom' ? { from: sourceFrom,  to: sourceTo  } : periodRange(sourcePeriod),  [sourcePeriod,  sourceFrom,  sourceTo])

  const incomeChartData  = useMemo(() => computeMonthlyData(rawInvoices.filter(i => i.status === 'paid'), 'issueDate', 'total', incomeRange.from, incomeRange.to), [rawInvoices, incomeRange])
  const patientChartData = useMemo(() => computeMonthlyData(rawPatients, 'createdAt', 'count', patientRange.from, patientRange.to), [rawPatients, patientRange])
  const sourceChartData  = useMemo(() => computeReferralForPeriod(rawPatients, sourceRange.from, sourceRange.to, doctor?.referralSources), [rawPatients, sourceRange, doctor])

  const paymentMethodData = useMemo(() => {
    const paid = rawInvoices.filter(i => i.status === 'paid' && (i.issueDate ?? '') >= from && (i.issueDate ?? '') <= to)
    const map  = {}
    paid.forEach(inv => {
      const key = inv.paymentMethod || 'unknown'
      if (!map[key]) map[key] = { amount: 0, count: 0 }
      map[key].amount += inv.total ?? 0
      map[key].count++
    })
    return Object.entries(map)
      .map(([key, { amount, count }]) => ({ key, label: PAYMENT_METHODS.find(m => m.value === key)?.label ?? (key === 'unknown' ? 'Not specified' : key), amount, count }))
      .sort((a, b) => b.amount - a.amount)
  }, [rawInvoices, from, to])

  const collectedByData = useMemo(() => {
    const paid = rawInvoices.filter(i => i.status === 'paid' && (i.issueDate ?? '') >= from && (i.issueDate ?? '') <= to && i.collectedBy)
    const map  = {}
    paid.forEach(inv => {
      const key = inv.collectedBy
      if (!map[key]) map[key] = { amount: 0, count: 0 }
      map[key].amount += inv.total ?? 0
      map[key].count++
    })
    return Object.entries(map)
      .map(([key, { amount, count }]) => ({ key, label: COLLECTED_BY_OPTIONS.find(o => o.value === key)?.label ?? key, amount, count }))
      .sort((a, b) => b.amount - a.amount)
  }, [rawInvoices, from, to])

  // ── Revenue analysis period filter ────────────────────────────────────────
  const revRange = useMemo(() =>
    revPeriod === 'custom' ? { from: revCustomFrom, to: revCustomTo } : periodRange(revPeriod),
    [revPeriod, revCustomFrom, revCustomTo])

  const revInvoices = useMemo(() =>
    invoices.filter(inv => {
      if (inv.status !== 'paid') return false
      const d = String(inv.issueDate || inv.createdAt || '').slice(0, 10)
      return d >= revRange.from && d <= revRange.to
    }),
    [invoices, revRange])

  // ── Inventory computed ─────────────────────────────────────────────────────
  const itemStats = useMemo(() => {
    const map = {}
    items.forEach(item => {
      map[item.id] = { id: item.id, name: item.name, category: item.category || '', purchasePrice: Number(item.mrp) || 0, billingPrice: Number(item.billingPrice) || 0, currentQty: item.quantity || 0, unitsSold: 0, grossRevenue: 0, discountAmt: 0, netRevenue: 0 }
    })
    invoices.forEach(inv => {
      const lineItems = inv.lineItems || []
      const subtotal  = lineItems.reduce((s, li) => s + (li.total != null ? li.total : (li.unitPrice || 0) * (li.quantity || 0)), 0)
      const invoiceDiscount = inv.discount ?? 0
      lineItems.forEach(li => {
        if (!li.inventoryItemId || !map[li.inventoryItemId]) return
        const s = map[li.inventoryItemId]
        const qty      = li.quantity  || 0
        const gross    = (li.unitPrice || 0) * qty
        const net      = li.total != null ? li.total : gross
        const share    = subtotal > 0 ? net / subtotal : 0
        const discShare = invoiceDiscount * share
        s.unitsSold    += qty
        s.grossRevenue += gross
        s.discountAmt  += (gross - net) + discShare
        s.netRevenue   += net - discShare
      })
    })
    return Object.values(map)
  }, [items, invoices])

  const inventoryVal = useMemo(() => {
    let cost = 0, billing = 0
    items.forEach(i => { const qty = i.quantity || 0; cost += (Number(i.mrp) || 0) * qty; billing += (Number(i.billingPrice) || 0) * qty })
    return { cost, billing }
  }, [items])

  const totals = useMemo(() => {
    let unitsSold = 0, grossRevenue = 0, discountAmt = 0, netRevenue = 0, cogs = 0
    itemStats.forEach(s => { unitsSold += s.unitsSold; grossRevenue += s.grossRevenue; discountAmt += s.discountAmt; netRevenue += s.netRevenue; cogs += s.purchasePrice * s.unitsSold })
    return { unitsSold, grossRevenue, discountAmt, netRevenue, profit: netRevenue - cogs }
  }, [itemStats])

  const revenueData = useMemo(() => {
    let invRevenue = 0, svcRevenue = 0, invDiscount = 0, svcDiscount = 0, invUnits = 0, svcCount = 0
    const monthlyMap = {}, svcMap = {}
    revInvoices.forEach(inv => {
      const monthKey = getMonthKey(inv.issueDate || inv.createdAt)
      if (monthKey && !monthlyMap[monthKey]) monthlyMap[monthKey] = { inv: 0, svc: 0, invDisc: 0, svcDisc: 0 }
      const lineItems = inv.lineItems || []
      // subtotal = sum of line totals (after per-line discountPct), matching invoice.subtotal
      const subtotal = lineItems.reduce((s, li) => s + (li.total != null ? li.total : (li.unitPrice || 0) * (li.quantity || 0)), 0)
      // invoice-level flat discount and tax, prorated across line items so both the
      // revenue total AND the discount total reconcile with invoice.total (Billing page)
      const invoiceDiscount = inv.discount ?? 0
      const invoiceTax      = inv.taxAmount ?? 0
      lineItems.forEach(li => {
        const gross      = (li.unitPrice || 0) * (li.quantity || 0)
        const netBase    = li.total != null ? li.total : gross
        const share      = subtotal > 0 ? netBase / subtotal : 0
        const discShare  = invoiceDiscount * share
        const taxShare   = invoiceTax * share
        const net        = netBase - discShare + taxShare
        const disc       = (gross - netBase) + discShare
        const isMedicine = li.inventoryItemId || li.itemType === 'medicine'
        if (isMedicine) {
          invRevenue += net; invDiscount += disc; invUnits += li.quantity || 0
          if (monthKey) { monthlyMap[monthKey].inv += net; monthlyMap[monthKey].invDisc += disc }
        } else {
          svcRevenue += net; svcDiscount += disc; svcCount += 1
          if (monthKey) { monthlyMap[monthKey].svc += net; monthlyMap[monthKey].svcDisc += disc }
          const desc = li.description || 'Unnamed Service'
          if (!svcMap[desc]) svcMap[desc] = { revenue: 0, discount: 0, count: 0 }
          svcMap[desc].revenue += net; svcMap[desc].discount += disc; svcMap[desc].count += 1
        }
      })
    })
    const total       = invRevenue + svcRevenue
    const months      = Object.keys(monthlyMap).sort()
    const topServices = Object.entries(svcMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    return { invRevenue, svcRevenue, total, invDiscount, svcDiscount, invUnits, svcCount, months, monthlyMap, topServices }
  }, [revInvoices])

  const expenseData = useMemo(() => {
    const revFrom = revRange.from
    const revTo   = revRange.to
    const inRange = expenses.filter(e => {
      const d = (e.date ?? '').slice(0, 10)
      return d >= revFrom && d <= revTo
    })
    const total = inRange.reduce((s, e) => s + (e.amount ?? 0), 0)
    const byCategory = {}
    inRange.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.amount ?? 0)
    })
    const monthly = {}
    inRange.forEach(e => {
      const mk = getMonthKey(e.date)
      if (mk) monthly[mk] = (monthly[mk] ?? 0) + (e.amount ?? 0)
    })
    return { total, byCategory, monthly, count: inRange.length }
  }, [expenses, revRange])

  const revItemStats = useMemo(() => {
    const map = {}
    items.forEach(item => {
      map[item.id] = { id: item.id, name: item.name, category: item.category || '', purchasePrice: Number(item.mrp) || 0, billingPrice: Number(item.billingPrice) || 0, unitsSold: 0, grossRevenue: 0, discountAmt: 0, netRevenue: 0 }
    })
    revInvoices.forEach(inv => {
      const lineItems = inv.lineItems || []
      const subtotal  = lineItems.reduce((s, li) => s + (li.total != null ? li.total : (li.unitPrice || 0) * (li.quantity || 0)), 0)
      const invoiceDiscount = inv.discount ?? 0
      lineItems.forEach(li => {
        if (!li.inventoryItemId || !map[li.inventoryItemId]) return
        const s = map[li.inventoryItemId]
        const qty      = li.quantity  || 0
        const gross    = (li.unitPrice || 0) * qty
        const net      = li.total != null ? li.total : gross
        const share    = subtotal > 0 ? net / subtotal : 0
        const discShare = invoiceDiscount * share
        s.unitsSold    += qty
        s.grossRevenue += gross
        s.discountAmt  += (gross - net) + discShare
        s.netRevenue   += net - discShare
      })
    })
    return Object.values(map)
  }, [items, revInvoices])

  const filtered = useMemo(() => {
    const q    = search.toLowerCase()
    const list = q ? itemStats.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) : itemStats
    return [...list].sort((a, b) => b.netRevenue - a.netRevenue)
  }, [itemStats, search])

  const allMonthlyKeys = useMemo(() => {
    const keys = new Set([...revenueData.months, ...Object.keys(expenseData.monthly)])
    return [...keys].sort()
  }, [revenueData.months, expenseData.monthly])

  const maxMonthly = useMemo(() =>
    allMonthlyKeys.reduce((m, k) => {
      const d   = revenueData.monthlyMap[k]
      const rev = (d?.inv || 0) + (d?.svc || 0)
      const exp = expenseData.monthly[k] || 0
      return Math.max(m, rev, exp)
    }, 0),
    [allMonthlyKeys, revenueData.monthlyMap, expenseData.monthly])

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

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch('') }}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === t.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          GENERAL TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'general' && (
        <div className="space-y-8">

          {/* Period filter */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
              <div className="flex flex-wrap gap-1.5">
                {PERIODS.map(p => (
                  <button key={p.value} onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${period === p.value ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-2 ml-1">
                  <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} className="input-field py-1.5 text-xs w-36"/>
                  <span className="text-gray-400 text-xs">to</span>
                  <input type="date" value={customTo} min={customFrom} max={today} onChange={e => setCustomTo(e.target.value)} className="input-field py-1.5 text-xs w-36"/>
                </div>
              )}
            </div>
          </div>

          {/* KPI row */}
          {filteredStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="New Patients"  value={filteredStats.patients}              sub="registered in period"               color="blue"/>
              <StatCard label="Visits"        value={filteredStats.visits}                sub="recorded in period"                 color="teal"/>
              <StatCard label="Revenue"       value={formatCurrency(filteredStats.revenue)} sub="from paid invoices"               color="green"/>
              <StatCard label="Due / Pending" value={formatCurrency(filteredStats.pendingAmount)} sub={`${filteredStats.pending} invoices`} color="orange"/>
            </div>
          )}

          {/* Revenue chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Income / Revenue</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Paid invoices by month — {formatCurrency(incomeChartData.reduce((s, d) => s + d.total, 0))} total</p>
              </div>
            </div>
            <div className="mb-5">
              <SectionFilter value={incomePeriod} onChange={setIncomePeriod} customFrom={incomeFrom} customTo={incomeTo} onCustomFrom={setIncomeFrom} onCustomTo={setIncomeTo}/>
            </div>
            <LineChart data={incomeChartData} valueKey="total" labelKey="label" color="green"
              fmtValue={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}/>
          </div>

          {/* Patient growth chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Patient Registrations</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">New patients registered per month — {patientChartData.reduce((s, d) => s + d.count, 0)} total</p>
              </div>
            </div>
            <div className="mb-5">
              <SectionFilter value={patientPeriod} onChange={setPatientPeriod} customFrom={patientFrom} customTo={patientTo} onCustomFrom={setPatientFrom} onCustomTo={setPatientTo}/>
            </div>
            <LineChart data={patientChartData} valueKey="count" labelKey="label" color="blue"/>
          </div>

          {/* Referral + Appointment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Patient Sources</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Where patients are coming from</p>
                </div>
              </div>
              <div className="mb-4">
                <SectionFilter value={sourcePeriod} onChange={setSourcePeriod} customFrom={sourceFrom} customTo={sourceTo} onCustomFrom={setSourceFrom} onCustomTo={setSourceTo}/>
              </div>
              <HorizontalBar items={sourceChartData} totalKey="count" labelKey="label"/>
            </div>

            {filteredStats && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Appointment Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Scheduled', value: filteredStats.upcoming,    color: 'bg-primary-500' },
                    { label: 'Completed', value: filteredStats.completed,    color: 'bg-green-500' },
                    { label: 'No Shows',  value: filteredStats.noShow,       color: 'bg-yellow-400' },
                    { label: 'Total',     value: filteredStats.appointments, color: 'bg-gray-300 dark:bg-gray-500' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                      <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
                    </div>
                  ))}
                  {filteredStats.appointments > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">No-show rate: {((filteredStats.noShow / filteredStats.appointments) * 100).toFixed(1)}%</div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${(filteredStats.noShow / filteredStats.appointments) * 100}%` }}/>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Patient analytics + Billing summary */}
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
                    { label: 'Paid Invoices', value: filteredStats.paidCount,   amount: filteredStats.revenue,       color: 'bg-green-500' },
                    { label: 'Due / Pending', value: filteredStats.pending,      amount: filteredStats.pendingAmount, color: 'bg-orange-400' },
                    { label: 'Overdue',       value: filteredStats.overdueCount, amount: 0,                           color: 'bg-red-500' },
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total invoices in period: <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredStats.totalInvoices}</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment collection breakdown */}
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
                    const p     = total > 0 ? Math.round((item.amount / total) * 100) : 0
                    return (
                      <div key={item.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{item.count} inv · {p}%</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`} style={{ width: `${p}%` }}/>
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
                    const p     = total > 0 ? Math.round((item.amount / total) * 100) : 0
                    return (
                      <div key={item.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{item.count} inv · {p}%</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`} style={{ width: `${p}%` }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          INVENTORY OVERVIEW TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inv_overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Inventory Cost',  value: fmt(inventoryVal.cost),    sub: 'stock at purchase price',   color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
              { label: 'Billing Value',   value: fmt(inventoryVal.billing), sub: 'stock at billing price',    color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800' },
              { label: 'Total Revenue',   value: fmt(totals.netRevenue),    sub: `${totals.unitsSold} units sold`, color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
              { label: 'Gross Profit',    value: fmt(totals.profit),        sub: 'revenue − cost of goods',   color: totals.profit >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
              { label: 'Discount Given',  value: fmt(totals.discountAmt),   sub: 'total across all invoices',  color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
              { label: 'Gross Revenue',   value: fmt(totals.grossRevenue),  sub: 'before item discounts',     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-5 ${c.bg}`}>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{c.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Purchase vs Billing Price — All Items</p>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                    {['Item', 'Category', 'Purchase ₹', 'Billing ₹', 'Margin', 'Stock'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {items.map(item => {
                    const purchase = Number(item.mrp) || 0
                    const billing  = Number(item.billingPrice) || 0
                    const margin   = billing > 0 ? ((billing - purchase) / billing) * 100 : null
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                        <td className="px-4 py-3">
                          {item.category
                            ? <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">{item.category}</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{purchase ? fmt(purchase) : '—'}</td>
                        <td className="px-4 py-3 text-right text-teal-700 dark:text-teal-300 font-medium">{billing ? fmt(billing) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {margin != null
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${margin >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>{margin.toFixed(1)}%</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.quantity ?? 0} {item.unit || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {items.length === 0 && <p className="text-center text-sm text-gray-400 py-12">No inventory items yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PRODUCT ANALYSIS TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by item name or category…" className="input-field w-full max-w-sm"/>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                  {[['Item','text-left'],['Buy ₹','text-right'],['Sell ₹','text-right'],['Margin','text-right'],['Qty Sold','text-right'],['Gross Rev','text-right'],['Discount','text-right'],['Net Rev','text-right'],['Profit','text-right']].map(([h, align]) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 ${align}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(s => {
                  const profit   = s.netRevenue - s.purchasePrice * s.unitsSold
                  const hasSales = s.unitsSold > 0 && s.netRevenue > 0
                  const margin   = hasSales
                    ? (profit / s.netRevenue) * 100
                    : s.billingPrice > 0 ? ((s.billingPrice - s.purchasePrice) / s.billingPrice) * 100 : null
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                        {s.category && <p className="text-xs text-gray-400 mt-0.5">{s.category}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">{s.purchasePrice ? fmt(s.purchasePrice) : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs text-teal-700 dark:text-teal-300 font-medium">{s.billingPrice ? fmt(s.billingPrice) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {margin != null
                          ? <span className={`text-xs font-semibold ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {!hasSales && <span className="font-normal text-gray-400 mr-0.5">~</span>}
                              {margin.toFixed(1)}%
                            </span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.unitsSold > 0
                          ? <span className="font-semibold text-primary-600 dark:text-primary-400">{s.unitsSold}</span>
                          : <span className="text-xs text-gray-400">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">{s.grossRevenue > 0 ? fmt(s.grossRevenue) : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs text-orange-600 dark:text-orange-400">{s.discountAmt > 0 ? `−${fmt(s.discountAmt)}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 dark:text-white">{s.netRevenue > 0 ? fmt(s.netRevenue) : '—'}</td>
                      <td className="px-4 py-3 text-right text-xs">
                        {s.unitsSold > 0
                          ? <span className={`font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {profit >= 0 ? '+' : ''}{fmt(profit)}
                            </span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40">
                    <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200" colSpan={4}>Totals</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-primary-600 dark:text-primary-400">{filtered.reduce((s, x) => s + x.unitsSold, 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200">{fmt(filtered.reduce((s, x) => s + x.grossRevenue, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-orange-600 dark:text-orange-400">
                      {(() => { const d = filtered.reduce((s, x) => s + x.discountAmt, 0); return d > 0 ? `−${fmt(d)}` : '—' })()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-900 dark:text-white">{fmt(filtered.reduce((s, x) => s + x.netRevenue, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-green-600 dark:text-green-400">
                      {(() => {
                        const nr = filtered.reduce((s, x) => s + x.netRevenue, 0)
                        const cg = filtered.reduce((s, x) => s + x.purchasePrice * x.unitsSold, 0)
                        const p  = nr - cg
                        if (!nr && !cg) return '—'
                        const m = nr > 0 ? (p / nr) * 100 : null
                        return `${p >= 0 ? '+' : ''}${fmt(p)}${m != null ? ` (${m.toFixed(1)}%)` : ''}`
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-12">No items match your search.</p>}
            <p className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
              Margin = Profit ÷ Net Revenue · Profit = Net Revenue − (Buy Price × Qty Sold) · <span className="font-medium">~</span> = theoretical (no sales yet)
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          REVENUE ANALYSIS TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">

          {/* Period filter */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
              <SectionFilter
                value={revPeriod}
                onChange={setRevPeriod}
                customFrom={revCustomFrom}
                customTo={revCustomTo}
                onCustomFrom={setRevCustomFrom}
                onCustomTo={setRevCustomTo}
              />
            </div>
          </div>

          {/* Summary split cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 lg:col-span-1">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(revenueData.total)}</p>
              <p className="text-xs text-gray-400 mt-1">{revInvoices.length} invoice{revInvoices.length !== 1 ? 's' : ''}</p>
              {revenueData.total > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div className="h-full bg-teal-500 transition-all" style={{ width: `${pct(revenueData.invRevenue, revenueData.total)}%` }}/>
                    <div className="h-full bg-primary-500 transition-all" style={{ width: `${pct(revenueData.svcRevenue, revenueData.total)}%` }}/>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-teal-600 dark:text-teal-400">Med {pct(revenueData.invRevenue, revenueData.total)}%</span>
                    <span className="text-primary-600 dark:text-primary-400">Svc {pct(revenueData.svcRevenue, revenueData.total)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-800 p-5">
              <p className="text-xs font-semibold text-teal-500 dark:text-teal-400 uppercase tracking-wider mb-1">Medicine</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{fmt(revenueData.invRevenue)}</p>
              <p className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-1">{pct(revenueData.invRevenue, revenueData.total)}% of revenue</p>
              <div className="mt-2 space-y-0.5 text-xs text-teal-700 dark:text-teal-300">
                <div className="flex justify-between"><span>Units sold</span><span className="font-semibold">{revenueData.invUnits}</span></div>
                <div className="flex justify-between"><span>Discount</span><span className="font-semibold">{revenueData.invDiscount > 0 ? `−${fmt(revenueData.invDiscount)}` : '—'}</span></div>
              </div>
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-5">
              <p className="text-xs font-semibold text-primary-500 dark:text-primary-400 uppercase tracking-wider mb-1">Services</p>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{fmt(revenueData.svcRevenue)}</p>
              <p className="text-xs text-primary-600/70 dark:text-primary-400/70 mt-1">{pct(revenueData.svcRevenue, revenueData.total)}% of revenue</p>
              <div className="mt-2 space-y-0.5 text-xs text-primary-700 dark:text-primary-300">
                <div className="flex justify-between"><span>Line items</span><span className="font-semibold">{revenueData.svcCount}</span></div>
                <div className="flex justify-between"><span>Discount</span><span className="font-semibold">{revenueData.svcDiscount > 0 ? `−${fmt(revenueData.svcDiscount)}` : '—'}</span></div>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 p-5">
              <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{fmt(expenseData.total)}</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{expenseData.count} record{expenseData.count !== 1 ? 's' : ''}</p>
              <div className="mt-2 space-y-0.5 text-xs text-red-700 dark:text-red-300">
                {Object.entries(expenseData.byCategory).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between">
                    <span className="truncate">{EXPENSE_CATEGORIES.find(c=>c.value===cat)?.label ?? cat}</span>
                    <span className="font-semibold ml-1">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const netProfit = revenueData.total - expenseData.total
              const isProfit  = netProfit >= 0
              return (
                <div className={`rounded-xl border p-5 ${isProfit ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isProfit ? 'text-green-500 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>Net Profit / Loss</p>
                  <p className={`text-2xl font-bold ${isProfit ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {isProfit ? '+' : ''}{fmt(netProfit)}
                  </p>
                  <p className={`text-xs mt-1 ${isProfit ? 'text-green-600/70 dark:text-green-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                    Revenue − Expenses
                  </p>
                  {revenueData.total > 0 && (
                    <div className={`mt-2 text-xs font-semibold ${isProfit ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                      Margin: {((netProfit / revenueData.total) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Monthly trend */}
          {allMonthlyKeys.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Monthly Trend — Revenue vs Expenses</p>
              <div className="space-y-4">
                {allMonthlyKeys.map(monthKey => {
                  const d   = revenueData.monthlyMap[monthKey] || {}
                  const inv = d.inv || 0
                  const svc = d.svc || 0
                  const rev = inv + svc
                  const exp = expenseData.monthly[monthKey] || 0
                  const net = rev - exp
                  return (
                    <div key={monthKey}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-20">{MonthLabel(monthKey)}</span>
                        <div className="flex items-center gap-3 text-xs">
                          {rev > 0 && <span className="text-green-600 dark:text-green-400 font-medium">+{fmt(rev)}</span>}
                          {exp > 0 && <span className="text-red-500 dark:text-red-400 font-medium">−{fmt(exp)}</span>}
                          <span className={`font-bold ${net >= 0 ? 'text-gray-800 dark:text-white' : 'text-orange-600 dark:text-orange-400'}`}>{net >= 0 ? '' : '−'}{fmt(Math.abs(net))}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {rev > 0 && (
                          <div className="flex gap-0.5 h-3">
                            <div className="bg-teal-400 dark:bg-teal-500 rounded-l h-full transition-all" style={{ width: `${pct(inv, maxMonthly)}%`, minWidth: inv > 0 ? '3px' : '0' }} title={`Medicine: ${fmt(inv)}`}/>
                            <div className="bg-primary-400 dark:bg-primary-500 rounded-r h-full transition-all" style={{ width: `${pct(svc, maxMonthly)}%`, minWidth: svc > 0 ? '3px' : '0' }} title={`Service: ${fmt(svc)}`}/>
                            {inv === 0 && svc === 0 && <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded"/>}
                          </div>
                        )}
                        {exp > 0 && (
                          <div className="flex h-2">
                            <div className="bg-red-400 dark:bg-red-500 rounded h-full transition-all opacity-80" style={{ width: `${pct(exp, maxMonthly)}%`, minWidth: '3px' }} title={`Expenses: ${fmt(exp)}`}/>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-5 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><div className="w-3 h-3 rounded-sm bg-teal-400 dark:bg-teal-500"/>Medicine</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><div className="w-3 h-3 rounded-sm bg-primary-400 dark:bg-primary-500"/>Services</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500"/>Expenses</div>
              </div>
            </div>
          )}

          {/* Top services */}
          {revenueData.topServices.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Top Services by Revenue</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    {['Service','Billed','Discount','Net Revenue','Revenue Bar'].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {revenueData.topServices.map((svc, i) => {
                    const maxSvc = revenueData.topServices[0]?.revenue || 1
                    return (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{svc.name}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">{svc.count}×</td>
                        <td className="px-4 py-3 text-right text-xs text-orange-600 dark:text-orange-400">{svc.discount > 0 ? `−${fmt(svc.discount)}` : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-primary-700 dark:text-primary-300">{fmt(svc.revenue)}</td>
                        <td className="px-4 py-3 pl-2">
                          <div className="flex items-center gap-2">
                            <Bar value={svc.revenue} max={maxSvc} color="bg-primary-400 dark:bg-primary-500"/>
                            <span className="text-xs text-gray-400 w-10 text-right">{pct(svc.revenue, revenueData.svcRevenue)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Top inventory items */}
          {revItemStats.some(s => s.unitsSold > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Top Medicine Items by Revenue</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    {['Item','Qty Sold','Discount','Net Revenue','Revenue Bar'].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {[...revItemStats].filter(s => s.unitsSold > 0).sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 8).map(s => {
                    const maxInv = [...revItemStats].filter(x => x.unitsSold > 0).sort((a, b) => b.netRevenue - a.netRevenue)[0]?.netRevenue || 1
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                          {s.category && <p className="text-xs text-gray-400 mt-0.5">{s.category}</p>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-teal-700 dark:text-teal-300">{s.unitsSold}</td>
                        <td className="px-4 py-3 text-right text-xs text-orange-600 dark:text-orange-400">{s.discountAmt > 0 ? `−${fmt(s.discountAmt)}` : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-teal-700 dark:text-teal-300">{fmt(s.netRevenue)}</td>
                        <td className="px-4 py-3 pl-2">
                          <div className="flex items-center gap-2">
                            <Bar value={s.netRevenue} max={maxInv} color="bg-teal-400 dark:bg-teal-500"/>
                            <span className="text-xs text-gray-400 w-10 text-right">{pct(s.netRevenue, revenueData.invRevenue)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Expense breakdown by category */}
          {expenseData.total > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expense Breakdown by Category</p>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(expenseData.total)} total</span>
              </div>
              <div className="p-5 space-y-3">
                {EXPENSE_CATEGORIES.filter(c => expenseData.byCategory[c.value] > 0)
                  .sort((a, b) => (expenseData.byCategory[b.value] ?? 0) - (expenseData.byCategory[a.value] ?? 0))
                  .map((cat, idx) => {
                    const amt = expenseData.byCategory[cat.value] ?? 0
                    const p   = expenseData.total > 0 ? Math.round((amt / expenseData.total) * 100) : 0
                    return (
                      <div key={cat.value}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{cat.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{p}%</span>
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(amt)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`} style={{ width: `${p}%` }}/>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {revenueData.total === 0 && expenseData.total === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No data yet. Revenue analysis will appear once invoices or expenses are recorded.</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          EXPENSES TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">

          {/* Period filter */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
              <SectionFilter
                value={revPeriod}
                onChange={setRevPeriod}
                customFrom={revCustomFrom}
                customTo={revCustomTo}
                onCustomFrom={setRevCustomFrom}
                onCustomTo={setRevCustomTo}
              />
            </div>
          </div>

          {/* Summary KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Expenses', value: fmt(expenseData.total), sub: `${expenseData.count} records`, color: 'text-red-600 dark:text-red-400' },
              { label: 'Total Revenue',  value: fmt(revenueData.total), sub: `${revInvoices.length} invoices`, color: 'text-green-600 dark:text-green-400' },
              { label: 'Net Profit / Loss', value: `${revenueData.total - expenseData.total >= 0 ? '+' : ''}${fmt(revenueData.total - expenseData.total)}`, sub: 'Revenue − Expenses', color: revenueData.total - expenseData.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400' },
              { label: 'Profit Margin', value: revenueData.total > 0 ? `${(((revenueData.total - expenseData.total) / revenueData.total) * 100).toFixed(1)}%` : '—', sub: 'Net ÷ Revenue', color: 'text-primary-600 dark:text-primary-400' },
            ].map(c => (
              <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {expenseData.total > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Expenses by Category</h3>
                <div className="space-y-3">
                  {EXPENSE_CATEGORIES.filter(c => expenseData.byCategory[c.value] > 0)
                    .sort((a, b) => (expenseData.byCategory[b.value] ?? 0) - (expenseData.byCategory[a.value] ?? 0))
                    .map((cat, idx) => {
                      const amt = expenseData.byCategory[cat.value] ?? 0
                      const p   = expenseData.total > 0 ? Math.round((amt / expenseData.total) * 100) : 0
                      return (
                        <div key={cat.value}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{cat.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{p}%</span>
                              <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(amt)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`} style={{ width: `${p}%` }}/>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Monthly expense trend */}
              {Object.keys(expenseData.monthly).length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Expenses</h3>
                  <div className="space-y-3">
                    {(() => {
                      const maxExp = Math.max(...Object.values(expenseData.monthly), 1)
                      return Object.keys(expenseData.monthly).sort().map(mk => {
                        const amt = expenseData.monthly[mk] ?? 0
                        return (
                          <div key={mk} className="grid grid-cols-[80px_1fr_90px] gap-3 items-center">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{MonthLabel(mk)}</span>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                              <div className="bg-red-400 dark:bg-red-500 h-3 rounded-full transition-all" style={{ width: `${(amt / maxExp) * 100}%` }}/>
                            </div>
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400 text-right">{fmt(amt)}</span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No expenses recorded in this period. Add expenses from the Expenses page.</p>
            </div>
          )}

        </div>
      )}

    </AppLayout>
  )
}
