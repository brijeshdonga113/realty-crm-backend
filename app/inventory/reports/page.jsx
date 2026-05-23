'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useInventory } from '@/hooks/useInventory'
import { useBilling } from '@/hooks/useBilling'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part, total) {
  if (!total) return '0'
  return ((part / total) * 100).toFixed(1)
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getMonthKey(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).slice(0, 7) // "YYYY-MM"
  return s.length === 7 ? s : null
}

function MonthLabel(key) {
  const [y, m] = key.split('-')
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`
}

// CSS-only bar
function Bar({ value, max, color }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }}/>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'products',  label: 'Product Analysis' },
  { key: 'revenue',   label: 'Revenue Analysis' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InventoryReportsPage() {
  const router   = useRouter()
  const { items }    = useInventory()
  const { invoices } = useBilling()
  const [tab, setTab]       = useState('overview')
  const [search, setSearch] = useState('')

  // ── Per-item invoice stats ─────────────────────────────────────────────────
  const itemStats = useMemo(() => {
    const map = {}
    items.forEach(item => {
      map[item.id] = {
        id:            item.id,
        name:          item.name,
        category:      item.category || '',
        purchasePrice: Number(item.mrp)          || 0,
        billingPrice:  Number(item.billingPrice) || 0,
        currentQty:    item.quantity             || 0,
        unitsSold:     0,
        grossRevenue:  0,
        discountAmt:   0,
        netRevenue:    0,
      }
    })
    invoices.forEach(inv => {
      ;(inv.lineItems || []).forEach(li => {
        if (!li.inventoryItemId || !map[li.inventoryItemId]) return
        const s     = map[li.inventoryItemId]
        const qty   = li.quantity  || 0
        const gross = (li.unitPrice || 0) * qty
        const net   = li.total != null ? li.total : gross
        s.unitsSold    += qty
        s.grossRevenue += gross
        s.discountAmt  += gross - net
        s.netRevenue   += net
      })
    })
    return Object.values(map)
  }, [items, invoices])

  // ── Inventory value (current stock) ───────────────────────────────────────
  const inventoryVal = useMemo(() => {
    let cost = 0, billing = 0
    items.forEach(i => {
      const qty = i.quantity || 0
      cost    += (Number(i.mrp)          || 0) * qty
      billing += (Number(i.billingPrice) || 0) * qty
    })
    return { cost, billing }
  }, [items])

  // ── Revenue totals ─────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let unitsSold = 0, grossRevenue = 0, discountAmt = 0, netRevenue = 0, cogs = 0
    itemStats.forEach(s => {
      unitsSold    += s.unitsSold
      grossRevenue += s.grossRevenue
      discountAmt  += s.discountAmt
      netRevenue   += s.netRevenue
      cogs         += s.purchasePrice * s.unitsSold
    })
    return { unitsSold, grossRevenue, discountAmt, netRevenue, profit: netRevenue - cogs }
  }, [itemStats])

  // ── Revenue Analysis data ──────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    let invRevenue = 0, svcRevenue = 0, invDiscount = 0, svcDiscount = 0
    let invUnits = 0, svcCount = 0
    const monthlyMap = {} // key: "YYYY-MM" → { inv, svc }
    const svcMap     = {} // description → { revenue, discount, count }

    invoices.forEach(inv => {
      const monthKey = getMonthKey(inv.issueDate || inv.createdAt)
      if (monthKey && !monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { inv: 0, svc: 0, invDisc: 0, svcDisc: 0 }
      }
      ;(inv.lineItems || []).forEach(li => {
        const gross = (li.unitPrice || 0) * (li.quantity || 0)
        const net   = li.total != null ? li.total : gross
        const disc  = gross - net

        const isMedicine = li.inventoryItemId || li.itemType === 'medicine'

        if (isMedicine) {
          invRevenue  += net
          invDiscount += disc
          invUnits    += li.quantity || 0
          if (monthKey) { monthlyMap[monthKey].inv += net; monthlyMap[monthKey].invDisc += disc }
        } else {
          svcRevenue  += net
          svcDiscount += disc
          svcCount    += 1
          if (monthKey) { monthlyMap[monthKey].svc += net; monthlyMap[monthKey].svcDisc += disc }
          const desc = li.description || 'Unnamed Service'
          if (!svcMap[desc]) svcMap[desc] = { revenue: 0, discount: 0, count: 0 }
          svcMap[desc].revenue  += net
          svcMap[desc].discount += disc
          svcMap[desc].count    += 1
        }
      })
    })

    const total = invRevenue + svcRevenue

    // Last 6 months sorted
    const allMonths = Object.keys(monthlyMap).sort()
    const last6     = allMonths.slice(-6)

    // Top services by revenue
    const topServices = Object.entries(svcMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    return { invRevenue, svcRevenue, total, invDiscount, svcDiscount, invUnits, svcCount, last6, monthlyMap, topServices }
  }, [invoices])

  // ── Filtered for product analysis ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = q
      ? itemStats.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      : itemStats
    return [...list].sort((a, b) => b.netRevenue - a.netRevenue)
  }, [itemStats, search])

  const maxMonthly = useMemo(() => {
    return revenueData.last6.reduce((m, k) => {
      const d = revenueData.monthlyMap[k]
      return Math.max(m, (d?.inv || 0) + (d?.svc || 0))
    }, 0)
  }, [revenueData])

  return (
    <AppLayout
      title="Inventory Reports"
      action={
        <button onClick={() => router.push('/inventory')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Inventory
        </button>
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Inventory Cost',  value: fmt(inventoryVal.cost),    sub: 'stock at purchase price',  color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
              { label: 'Billing Value',   value: fmt(inventoryVal.billing), sub: 'stock at billing price',   color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800' },
              { label: 'Total Revenue',   value: fmt(totals.netRevenue),    sub: `${totals.unitsSold} units sold`, color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
              { label: 'Gross Profit',    value: fmt(totals.profit),        sub: 'revenue − cost of goods',  color: totals.profit >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
              { label: 'Discount Given',  value: fmt(totals.discountAmt),   sub: 'total across all invoices', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
              { label: 'Gross Revenue',   value: fmt(totals.grossRevenue),  sub: 'before item discounts',    color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
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
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 ${i === 0 || i === 1 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {items.map(item => {
                    const purchase = Number(item.mrp)          || 0
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
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${margin >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                {margin.toFixed(1)}%
                              </span>
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

      {/* ── PRODUCT ANALYSIS TAB ─────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item name or category…"
            className="input-field w-full max-w-sm"
          />
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                  {[
                    ['Item',       'text-left'],
                    ['Buy ₹',      'text-right'],
                    ['Sell ₹',     'text-right'],
                    ['Margin',     'text-right'],
                    ['Qty Sold',   'text-right'],
                    ['Gross Rev',  'text-right'],
                    ['Discount',   'text-right'],
                    ['Net Rev',    'text-right'],
                    ['Profit',     'text-right'],
                  ].map(([h, align]) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 ${align}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(s => {
                  // Margin = (sell - buy) / sell × 100  (price-level gross margin)
                  const margin      = s.billingPrice > 0 ? ((s.billingPrice - s.purchasePrice) / s.billingPrice) * 100 : null
                  // Profit = net revenue received − cost of goods sold
                  const profit      = s.netRevenue - s.purchasePrice * s.unitsSold
                  const salesMargin = s.netRevenue > 0 ? (profit / s.netRevenue) * 100 : null
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
                              {salesMargin != null && <span className="ml-1 font-normal text-gray-400">({salesMargin.toFixed(1)}%)</span>}
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
                    <td className="px-4 py-3 text-right text-xs font-bold text-primary-600 dark:text-primary-400">
                      {filtered.reduce((s, x) => s + x.unitsSold, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200">
                      {fmt(filtered.reduce((s, x) => s + x.grossRevenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-orange-600 dark:text-orange-400">
                      {(() => { const d = filtered.reduce((s, x) => s + x.discountAmt, 0); return d > 0 ? `−${fmt(d)}` : '—' })()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-900 dark:text-white">
                      {fmt(filtered.reduce((s, x) => s + x.netRevenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-green-600 dark:text-green-400">
                      {(() => {
                        const nr = filtered.reduce((s, x) => s + x.netRevenue, 0)
                        const cg = filtered.reduce((s, x) => s + x.purchasePrice * x.unitsSold, 0)
                        const p  = nr - cg
                        if (!p) return '—'
                        const sm = nr > 0 ? (p / nr) * 100 : null
                        return `${p >= 0 ? '+' : ''}${fmt(p)}${sm != null ? ` (${sm.toFixed(1)}%)` : ''}`
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-12">No items match your search.</p>}
          </div>
        </div>
      )}

      {/* ── REVENUE ANALYSIS TAB ─────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="space-y-6">

          {/* Summary split cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{fmt(revenueData.total)}</p>
              <p className="text-xs text-gray-400 mt-1">across {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
              {/* Split bar */}
              {revenueData.total > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-teal-500 flex-shrink-0"/>
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                      <div className="h-full bg-teal-500 rounded-l-full transition-all" style={{ width: `${pct(revenueData.invRevenue, revenueData.total)}%` }}/>
                      <div className="h-full bg-primary-500 rounded-r-full transition-all" style={{ width: `${pct(revenueData.svcRevenue, revenueData.total)}%` }}/>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-teal-600 dark:text-teal-400 font-medium">Medicine {pct(revenueData.invRevenue, revenueData.total)}%</span>
                    <span className="text-primary-600 dark:text-primary-400 font-medium">Service {pct(revenueData.svcRevenue, revenueData.total)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-800 p-5">
              <p className="text-xs font-semibold text-teal-500 dark:text-teal-400 uppercase tracking-wider mb-1">Medicine / Inventory</p>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">{fmt(revenueData.invRevenue)}</p>
              <p className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-1">{pct(revenueData.invRevenue, revenueData.total)}% of total</p>
              <div className="mt-3 space-y-1 text-xs text-teal-700 dark:text-teal-300">
                <div className="flex justify-between"><span>Units sold</span><span className="font-semibold">{revenueData.invUnits}</span></div>
                <div className="flex justify-between"><span>Discount given</span><span className="font-semibold">{revenueData.invDiscount > 0 ? `−${fmt(revenueData.invDiscount)}` : '—'}</span></div>
              </div>
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-5">
              <p className="text-xs font-semibold text-primary-500 dark:text-primary-400 uppercase tracking-wider mb-1">Services</p>
              <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{fmt(revenueData.svcRevenue)}</p>
              <p className="text-xs text-primary-600/70 dark:text-primary-400/70 mt-1">{pct(revenueData.svcRevenue, revenueData.total)}% of total</p>
              <div className="mt-3 space-y-1 text-xs text-primary-700 dark:text-primary-300">
                <div className="flex justify-between"><span>Line items billed</span><span className="font-semibold">{revenueData.svcCount}</span></div>
                <div className="flex justify-between"><span>Discount given</span><span className="font-semibold">{revenueData.svcDiscount > 0 ? `−${fmt(revenueData.svcDiscount)}` : '—'}</span></div>
              </div>
            </div>
          </div>

          {/* Monthly trend */}
          {revenueData.last6.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Monthly Trend (last {revenueData.last6.length} months)</p>
              <div className="space-y-3">
                {revenueData.last6.map(monthKey => {
                  const d   = revenueData.monthlyMap[monthKey] || {}
                  const inv = d.inv || 0
                  const svc = d.svc || 0
                  const tot = inv + svc
                  return (
                    <div key={monthKey} className="grid grid-cols-[100px_1fr_80px] gap-3 items-center">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{MonthLabel(monthKey)}</span>
                      <div className="flex gap-1 h-5">
                        {tot > 0 ? (
                          <>
                            <div
                              className="bg-teal-400 dark:bg-teal-500 rounded-l h-full transition-all"
                              style={{ width: `${pct(inv, maxMonthly)}%`, minWidth: inv > 0 ? '4px' : '0' }}
                              title={`Medicine: ${fmt(inv)}`}
                            />
                            <div
                              className="bg-primary-400 dark:bg-primary-500 rounded-r h-full transition-all"
                              style={{ width: `${pct(svc, maxMonthly)}%`, minWidth: svc > 0 ? '4px' : '0' }}
                              title={`Service: ${fmt(svc)}`}
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded"/>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-right">{fmt(tot)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 rounded-sm bg-teal-400 dark:bg-teal-500"/>Medicine / Inventory
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 rounded-sm bg-primary-400 dark:bg-primary-500"/>Services
                </div>
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
                    {['Service', 'Billed', 'Discount', 'Net Revenue', 'Revenue Bar'].map((h, i) => (
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

          {/* Top inventory items sold */}
          {itemStats.some(s => s.unitsSold > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Top Medicine Items by Revenue</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    {['Item', 'Qty Sold', 'Discount', 'Net Revenue', 'Revenue Bar'].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {[...itemStats].filter(s => s.unitsSold > 0).sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 8).map(s => {
                    const maxInv = [...itemStats].filter(x => x.unitsSold > 0).sort((a, b) => b.netRevenue - a.netRevenue)[0]?.netRevenue || 1
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
                            <Bar value={s.netRevenue} max={[...itemStats].filter(x => x.unitsSold > 0).sort((a, b) => b.netRevenue - a.netRevenue)[0]?.netRevenue || 1} color="bg-teal-400 dark:bg-teal-500"/>
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

          {revenueData.total === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No invoice data yet. Revenue analysis will appear once invoices are created.</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  )
}
