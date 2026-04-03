'use client'
import { useState, useMemo, useRef } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else current += ch
    }
    values.push(current.trim())
    const row = {}
    header.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function normalizeRow(row) {
  // Try to find common column names
  const keys = Object.keys(row)
  const find = (...names) => {
    for (const n of names) {
      const k = keys.find(k => k.toLowerCase().includes(n.toLowerCase()))
      if (k) return row[k]
    }
    return ''
  }
  return {
    name:       find('name', 'medicine', 'drug', 'item', 'product'),
    generic:    find('generic', 'molecule', 'composition', 'salt', 'formula'),
    category:   find('category', 'type', 'class', 'group'),
    quantity:   find('quantity', 'qty', 'stock', 'units', 'available'),
    unit:       find('unit', 'uom', 'pack', 'size'),
    mrp:        find('mrp', 'price', 'rate', 'cost', 'amount'),
    expiry:     find('expiry', 'exp', 'expire', 'expiration', 'validity'),
    batch:      find('batch', 'lot', 'batch_no', 'lot_no'),
    supplier:   find('supplier', 'vendor', 'distributor', 'manufacturer', 'company'),
    _raw:       row,
  }
}

const LOW_STOCK_THRESHOLD = 10

export default function InventoryPage() {
  const fileRef = useRef(null)
  const [medicines, setMedicines] = useState([])
  const [rawHeaders, setRawHeaders] = useState([])
  const [query,      setQuery]      = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [viewMode,   setViewMode]   = useState('normalized') // 'normalized' | 'raw'
  const [importing,  setImporting]  = useState(false)
  const [error,      setError]      = useState('')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target.result
        const rows = parseCSV(text)
        if (rows.length === 0) { setError('No data found in file. Please check the format.'); setImporting(false); return }
        setRawHeaders(Object.keys(rows[0]))
        setMedicines(rows.map(normalizeRow))
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
      }
      setImporting(false)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  const categories = useMemo(() => {
    const set = new Set(medicines.map(m => m.category).filter(Boolean))
    return Array.from(set).sort()
  }, [medicines])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return medicines.filter(m => {
      if (catFilter && m.category !== catFilter) return false
      if (!q) return true
      return (m.name || '').toLowerCase().includes(q) ||
        (m.generic || '').toLowerCase().includes(q) ||
        (m.supplier || '').toLowerCase().includes(q)
    })
  }, [medicines, query, catFilter])

  const lowStock = filtered.filter(m => {
    const qty = Number((m.quantity || '').replace(/[^0-9.]/g, ''))
    return !isNaN(qty) && qty <= LOW_STOCK_THRESHOLD && qty >= 0
  })

  const exportCSV = () => {
    const headers = ['Name', 'Generic/Composition', 'Category', 'Quantity', 'Unit', 'MRP', 'Expiry', 'Batch', 'Supplier']
    const rows = filtered.map(m => [m.name, m.generic, m.category, m.quantity, m.unit, m.mrp, m.expiry, m.batch, m.supplier])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory_export.csv'; a.click()
  }

  return (
    <AppLayout
      title="Medicine Inventory"
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const headers = ['Name', 'Generic/Composition', 'Category', 'Quantity', 'Unit', 'MRP', 'Expiry', 'Batch', 'Supplier']
            const sample  = ['Paracetamol 500mg', 'Paracetamol', 'Analgesic', '100', 'Tablets', '25', '2026-12-31', 'BTX-001', 'ABC Pharma']
            const csv = [headers, sample].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory_template.csv'; a.click()
          }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Template
          </button>
          {medicines.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export
            </button>
          )}
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
            </svg>
            {medicines.length > 0 ? 'Re-import CSV' : 'Import CSV / Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile}/>
        </div>
      }
    >
      <div className="space-y-6">

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {medicines.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
            <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">No Inventory Data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Import a CSV file with your medicine stock data.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Expected columns: Name, Quantity, MRP, Expiry, Category, Supplier, Batch (flexible — system auto-detects)
            </p>
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
              </svg>
              Import CSV File
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Items',  value: medicines.length,    color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
                { label: 'Filtered',     value: filtered.length,     color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
                { label: 'Low Stock',    value: lowStock.length,     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
                { label: 'Categories',  value: categories.length,   color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search medicines, generics, suppliers…"
                  className="input-field pl-9"/>
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-field w-44">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {[['normalized','Standard View'],['raw','Raw Data']].map(([v,l]) => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors
                      ${viewMode === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Low stock banner */}
            {lowStock.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                  {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} with low stock (≤{LOW_STOCK_THRESHOLD} units):
                  {' '}{lowStock.slice(0,3).map(m => m.name).join(', ')}{lowStock.length > 3 ? `…` : ''}
                </span>
              </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
              {viewMode === 'normalized' ? (
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                      {['Medicine Name', 'Generic / Composition', 'Category', 'Qty', 'MRP', 'Expiry', 'Batch', 'Supplier'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filtered.map((m, i) => {
                      const qty = Number((m.quantity||'').replace(/[^0-9.]/g,''))
                      const isLow = !isNaN(qty) && qty <= LOW_STOCK_THRESHOLD
                      return (
                        <tr key={i} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors ${isLow ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                          <td className="px-4 py-3 pl-6">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.name || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-48 truncate">{m.generic || '—'}</td>
                          <td className="px-4 py-3">
                            {m.category ? (
                              <span className="inline-block px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">{m.category}</span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${isLow ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                              {m.quantity || '—'}
                            </span>
                            {m.unit && <span className="text-xs text-gray-400 ml-1">{m.unit}</span>}
                            {isLow && <span className="ml-1 text-xs text-orange-500">⚠</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{m.mrp ? `₹${m.mrp}` : '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{m.expiry || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{m.batch || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{m.supplier || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                      {rawHeaders.map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filtered.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        {rawHeaders.map(h => (
                          <td key={h} className="px-4 py-3 first:pl-6 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-48 truncate">
                            {m._raw?.[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                  No items match your search.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
