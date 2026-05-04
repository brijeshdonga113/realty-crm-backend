'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Modal } from '@/components/ui/Modal'
import { useInventory } from '@/hooks/useInventory'
import { dataStore } from '@/lib/dataStore'

// ─── CSV import helper ────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const values = []
    let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = '' }
      else cur += ch
    }
    values.push(cur.trim())
    const row = {}
    header.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function normalizeRow(row) {
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
    generic:    find('generic', 'molecule', 'composition', 'salt'),
    potency:    find('potency', 'strength', 'power', 'dilution'),
    dosageForm: find('dosage', 'form', 'preparation'),
    category:   find('category', 'type', 'class', 'group'),
    quantity:   Number((find('quantity', 'qty', 'stock', 'units') || '0').replace(/[^0-9.]/g, '')) || 0,
    unit:       find('unit', 'uom', 'pack', 'size'),
    mrp:        find('mrp', 'price', 'rate', 'cost'),
    expiry:     find('expiry', 'exp', 'expire', 'expiration'),
    batch:      find('batch', 'lot'),
    supplier:   find('supplier', 'vendor', 'distributor', 'manufacturer'),
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DOSAGE_FORMS = ['Globules','Drops','Tablets','Capsules','Syrup','Ointment','Cream','Powder','Tincture','Dilution','Injection','Gel','Lotion','Suppository','Other']

const ALL_COLS = [
  { key: 'name',       label: 'Medicine Name',       always: true },
  { key: 'generic',    label: 'Generic / Composition' },
  { key: 'potency',    label: 'Potency' },
  { key: 'dosageForm', label: 'Dosage Form' },
  { key: 'category',   label: 'Category' },
  { key: 'quantity',   label: 'Quantity',             always: true },
  { key: 'unit',       label: 'Unit' },
  { key: 'mrp',        label: 'MRP' },
  { key: 'expiry',     label: 'Expiry' },
  { key: 'batch',      label: 'Batch No.' },
  { key: 'supplier',   label: 'Supplier' },
  { key: 'notes',      label: 'Notes' },
]

const DEFAULT_VISIBLE = { name:true, generic:true, potency:true, dosageForm:true, category:true, quantity:true, unit:true, mrp:true, expiry:true, batch:false, supplier:true, notes:false }

const BLANK_FORM = { name:'', generic:'', potency:'', dosageForm:'', category:'', quantity:'', unit:'', mrp:'', expiry:'', batch:'', supplier:'', lowStockThreshold:'10', notes:'' }

// ─── Qty stepper cell ─────────────────────────────────────────────────────────
function QtyCell({ item, adjustQty, update }) {
  const [localQty, setLocalQty] = useState(String(item.quantity ?? 0))
  const [saving,   setSaving]   = useState(false)

  const commit = useCallback(async (val) => {
    const n = Math.max(0, Number(val) || 0)
    setLocalQty(String(n))
    if (n === item.quantity) return
    setSaving(true)
    await update(item.id, { quantity: n }).catch(() => {})
    setSaving(false)
  }, [item.id, item.quantity, update])

  const step = async (delta) => {
    const next = Math.max(0, (item.quantity ?? 0) + delta)
    setLocalQty(String(next))
    setSaving(true)
    await adjustQty(item.id, delta).catch(() => {})
    setSaving(false)
  }

  const threshold = item.lowStockThreshold ?? 10
  const isLow = (item.quantity ?? 0) <= threshold

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => step(-1)} disabled={saving || (item.quantity ?? 0) <= 0}
        className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 flex items-center justify-center transition-colors font-bold text-sm leading-none">
        −
      </button>
      <input
        type="number" min="0"
        value={localQty}
        onChange={e => setLocalQty(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value) }}
        className={`w-14 text-center text-sm font-semibold rounded-lg border px-1 py-0.5 outline-none transition-colors
          ${isLow
            ? 'text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20'
            : 'text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'}
          focus:border-primary-400 dark:focus:border-primary-500`}
      />
      <button onClick={() => step(1)} disabled={saving}
        className="w-6 h-6 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-40 flex items-center justify-center transition-colors font-bold text-sm leading-none">
        +
      </button>
      {saving && <span className="w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin ml-0.5"/>}
    </div>
  )
}

// ─── Add / Edit form modal ────────────────────────────────────────────────────
function ItemFormModal({ open, onClose, initial, onSave, title }) {
  const [form, setForm] = useState(initial ?? BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // reset when re-opened
  useState(() => { if (open) setForm(initial ?? BLANK_FORM) }, [open])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="form-label">Medicine / Product Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field" placeholder="e.g. Arnica Montana"/>
        </div>
        <div>
          <label className="form-label">Generic / Composition</label>
          <input value={form.generic} onChange={e => set('generic', e.target.value)} className="input-field" placeholder="e.g. Arnica"/>
        </div>
        <div>
          <label className="form-label">Potency / Strength</label>
          <input value={form.potency} onChange={e => set('potency', e.target.value)} className="input-field" placeholder="e.g. 30C"/>
        </div>
        <div>
          <label className="form-label">Dosage Form</label>
          <select value={form.dosageForm} onChange={e => set('dosageForm', e.target.value)} className="input-field">
            <option value="">Select form</option>
            {DOSAGE_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Category</label>
          <input value={form.category} onChange={e => set('category', e.target.value)} className="input-field" placeholder="e.g. Homoeopathic"/>
        </div>
        <div>
          <label className="form-label">Quantity</label>
          <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="form-label">Unit</label>
          <input value={form.unit} onChange={e => set('unit', e.target.value)} className="input-field" placeholder="e.g. gm, ml, strips"/>
        </div>
        <div>
          <label className="form-label">MRP (₹)</label>
          <input value={form.mrp} onChange={e => set('mrp', e.target.value)} className="input-field" placeholder="e.g. 150"/>
        </div>
        <div>
          <label className="form-label">Expiry Date</label>
          <input type="date" value={form.expiry} onChange={e => set('expiry', e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="form-label">Batch No.</label>
          <input value={form.batch} onChange={e => set('batch', e.target.value)} className="input-field" placeholder="e.g. BTX-001"/>
        </div>
        <div>
          <label className="form-label">Supplier</label>
          <input value={form.supplier} onChange={e => set('supplier', e.target.value)} className="input-field" placeholder="e.g. SBL Pvt Ltd"/>
        </div>
        <div>
          <label className="form-label">Low Stock Alert (qty)</label>
          <input type="number" min="0" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} className="input-field"/>
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input-field resize-none" placeholder="Storage instructions, remarks…"/>
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-5 pt-4 border-t dark:border-gray-700">
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving || !form.name.trim()}
          className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"/>}
          {saving ? 'Saving…' : 'Save Item'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { items, loading, create, update, adjustQty, remove, bulkCreate } = useInventory()

  const fileRef = useRef(null)
  const [query,      setQuery]      = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [formFilter, setFormFilter] = useState('')
  const [colsOpen,   setColsOpen]   = useState(false)
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE)

  useEffect(() => {
    dataStore.getMeta('inventoryColumns').then(saved => {
      if (saved && typeof saved === 'object') setVisibleCols({ ...DEFAULT_VISIBLE, ...saved })
    }).catch(() => {})
  }, [])

  const [importing,  setImporting]  = useState(false)
  const [importErr,  setImportErr]  = useState('')
  const [addOpen,    setAddOpen]    = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [deleteId,   setDeleteId]   = useState(null)

  const toggleCol = (key) => setVisibleCols(v => {
    const next = { ...v, [key]: !v[key] }
    dataStore.setMeta('inventoryColumns', next).catch(() => {})
    return next
  })

  // ── CSV import ──────────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportErr('')
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (!rows.length) { setImportErr('No data rows found.'); return }
      await bulkCreate(rows.map(normalizeRow))
    } catch (err) {
      setImportErr('Failed to import: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // ── CSV export ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Name','Generic/Composition','Potency','Dosage Form','Category','Quantity','Unit','MRP','Expiry','Batch','Supplier','Notes']
    const rows = items.map(m => [m.name,m.generic,m.potency,m.dosageForm,m.category,m.quantity,m.unit,m.mrp,m.expiry,m.batch,m.supplier,m.notes])
    const csv = [headers,...rows].map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const categories = useMemo(() => [...new Set(items.map(m => m.category).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter(m => {
      if (catFilter  && m.category   !== catFilter)  return false
      if (formFilter && m.dosageForm !== formFilter)  return false
      if (!q) return true
      return [m.name,m.generic,m.supplier,m.potency,m.category].some(v => (v||'').toLowerCase().includes(q))
    })
  }, [items, query, catFilter, formFilter])

  const lowStock = useMemo(() => filtered.filter(m => (m.quantity ?? 0) <= (m.lowStockThreshold ?? 10)), [filtered])

  const visibleColDefs = ALL_COLS.filter(c => c.always || visibleCols[c.key])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAdd = async (form) => {
    await create({ ...form, quantity: Number(form.quantity)||0, lowStockThreshold: Number(form.lowStockThreshold)||10 })
    setAddOpen(false)
  }

  const handleEdit = async (form) => {
    await update(editItem.id, { ...form, quantity: Number(form.quantity)||0, lowStockThreshold: Number(form.lowStockThreshold)||10 })
    setEditItem(null)
  }

  return (
    <AppLayout
      title="Inventory"
      action={
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile}/>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-60">
            {importing
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"/>Importing…</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Import CSV</>}
          </button>
          {items.length > 0 && (
            <button onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export
            </button>
          )}
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Item
          </button>
        </div>
      }
    >
      <div className="space-y-5">

        {importErr && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">{importErr}</div>
        )}

        {/* Stats */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label:'Total Items',  value: items.length,       color:'text-primary-600 dark:text-primary-400', bg:'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
              { label:'Showing',      value: filtered.length,    color:'text-green-600 dark:text-green-400',     bg:'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
              { label:'Low Stock',    value: lowStock.length,    color:'text-orange-600 dark:text-orange-400',   bg:'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
              { label:'Categories',   value: categories.length,  color:'text-purple-600 dark:text-purple-400',   bg:'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters + column toggle */}
        {items.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search medicine, generic, supplier…" className="input-field pl-9"/>
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-field w-40">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={formFilter} onChange={e => setFormFilter(e.target.value)} className="input-field w-36">
              <option value="">All Forms</option>
              {DOSAGE_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Column toggle */}
            <button onClick={() => setColsOpen(o => !o)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                ${colsOpen ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
              </svg>
              Columns
            </button>
          </div>
        )}

        {/* Column picker panel */}
        {colsOpen && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Toggle columns</p>
            <div className="flex flex-wrap gap-2">
              {ALL_COLS.map(c => (
                <button key={c.key} onClick={() => !c.always && toggleCol(c.key)} disabled={c.always}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${(c.always || visibleCols[c.key])
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 line-through'}
                    ${c.always ? 'opacity-70 cursor-default' : ''}`}>
                  {(c.always || visibleCols[c.key]) && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Low stock banner */}
        {lowStock.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span className="text-sm text-orange-800 dark:text-orange-300 font-medium">
              {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} at or below low-stock threshold:
              {' '}{lowStock.slice(0,4).map(m => m.name).join(', ')}{lowStock.length > 4 ? `…` : ''}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
            <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">No Inventory Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add items manually or import from a CSV file.</p>
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Add Item
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Import CSV
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                  {visibleColDefs.map(c => (
                    <th key={c.key} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(item => {
                  const isLow = (item.quantity ?? 0) <= (item.lowStockThreshold ?? 10)
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors ${isLow ? 'bg-orange-50/30 dark:bg-orange-900/5' : ''}`}>
                      {visibleColDefs.map(c => (
                        <td key={c.key} className="px-4 py-3 first:pl-6">
                          {c.key === 'name' && (
                            <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                              {item.name || '—'}
                              {isLow && <span className="ml-1.5 text-xs text-orange-500">⚠</span>}
                            </p>
                          )}
                          {c.key === 'quantity' && (
                            <QtyCell item={item} adjustQty={adjustQty} update={update}/>
                          )}
                          {c.key === 'potency' && (
                            item.potency
                              ? <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">{item.potency}</span>
                              : <span className="text-gray-400 text-xs">—</span>
                          )}
                          {c.key === 'dosageForm' && (
                            item.dosageForm
                              ? <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">{item.dosageForm}</span>
                              : <span className="text-gray-400 text-xs">—</span>
                          )}
                          {c.key === 'category' && (
                            item.category
                              ? <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">{item.category}</span>
                              : <span className="text-gray-400 text-xs">—</span>
                          )}
                          {c.key === 'unit'     && <span className="text-sm text-gray-600 dark:text-gray-400">{item.unit     || '—'}</span>}
                          {c.key === 'generic'  && <span className="text-xs text-gray-500 dark:text-gray-400 max-w-36 truncate block">{item.generic  || '—'}</span>}
                          {c.key === 'mrp'      && <span className="text-sm text-gray-700 dark:text-gray-300">{item.mrp ? `₹${item.mrp}` : '—'}</span>}
                          {c.key === 'expiry'   && <span className="text-sm text-gray-600 dark:text-gray-400">{item.expiry   || '—'}</span>}
                          {c.key === 'batch'    && <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{item.batch    || '—'}</span>}
                          {c.key === 'supplier' && <span className="text-xs text-gray-500 dark:text-gray-400">{item.supplier || '—'}</span>}
                          {c.key === 'notes'    && <span className="text-xs text-gray-400 max-w-40 truncate block">{item.notes    || '—'}</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditItem(item)}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                          <button onClick={() => setDeleteId(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No items match your filters.</div>
            )}
          </div>
        )}
      </div>

      {/* Add modal */}
      <ItemFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initial={BLANK_FORM}
        onSave={handleAdd}
        title="Add Inventory Item"
      />

      {/* Edit modal */}
      <ItemFormModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        initial={editItem ? {
          name: editItem.name, generic: editItem.generic, potency: editItem.potency,
          dosageForm: editItem.dosageForm, category: editItem.category,
          quantity: String(editItem.quantity ?? ''), unit: editItem.unit,
          mrp: editItem.mrp, expiry: editItem.expiry, batch: editItem.batch,
          supplier: editItem.supplier, lowStockThreshold: String(editItem.lowStockThreshold ?? 10),
          notes: editItem.notes,
        } : BLANK_FORM}
        onSave={handleEdit}
        title="Edit Inventory Item"
      />

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Item" size="sm">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Remove this item from inventory? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={async () => { await remove(deleteId); setDeleteId(null) }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">Remove</button>
        </div>
      </Modal>
    </AppLayout>
  )
}
