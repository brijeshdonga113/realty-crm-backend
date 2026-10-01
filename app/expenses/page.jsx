'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useExpenses } from '@/hooks/useExpenses'
import { usePreferences } from '@/hooks/usePreferences'
import { useRequireModuleAccess } from '@/hooks/useRequireModuleAccess'

export const EXPENSE_CATEGORIES = [
  { value: 'rent',      label: 'Rent / Lease' },
  { value: 'utilities', label: 'Utilities / Bills' },
  { value: 'salaries',  label: 'Salaries / Staff' },
  { value: 'supplies',  label: 'Medical Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other',     label: 'Other' },
]

const CATEGORY_COLORS = {
  rent:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  utilities: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  salaries:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  supplies:  'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  equipment: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  marketing: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  other:     'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
}

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'upi',    label: 'UPI' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'card',   label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

const today = new Date().toISOString().slice(0, 10)

const EMPTY = { description: '', category: 'other', amount: '', date: today, paymentMethod: '', notes: '' }

export default function ExpensesPage() {
  useRequireModuleAccess('expenses')
  const { expenses, loading, add, update, remove } = useExpenses()
  const { formatCurrency } = usePreferences()

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [search, setSearch]       = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (exp) => {
    setForm({ description: exp.description, category: exp.category, amount: String(exp.amount), date: exp.date, paymentMethod: exp.paymentMethod ?? '', notes: exp.notes ?? '' })
    setEditId(exp.id)
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditId(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || !form.date) return
    setSaving(true)
    try {
      const payload = { ...form, amount: Number(form.amount) }
      if (editId) await update(editId, payload)
      else        await add(payload)
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await remove(id)
    setDeleteId(null)
  }

  const filtered = useMemo(() => {
    return expenses.filter(exp => {
      if (filterCat !== 'all' && exp.category !== filterCat) return false
      if (filterMonth && !(exp.date ?? '').startsWith(filterMonth)) return false
      if (search && !exp.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [expenses, filterCat, filterMonth, search])

  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + (e.amount ?? 0), 0), [filtered])

  const categoryTotals = useMemo(() => {
    const map = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + (e.amount ?? 0) })
    return map
  }, [expenses])

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => (e.date ?? '').slice(0, 7)).filter(Boolean))
    return [...set].sort().reverse()
  }, [expenses])

  return (
    <AppLayout title="Expenses"
      action={
        <button onClick={openAdd}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Expense
        </button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Summary cards */}
        {expenses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EXPENSE_CATEGORIES.slice(0, 4).map(cat => (
              <div key={cat.value} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{cat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(categoryTotals[cat.value] ?? 0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search description…"
            className="input-field py-1.5 text-sm w-48 flex-shrink-0"/>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field py-1.5 text-sm w-44 flex-shrink-0">
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field py-1.5 text-sm w-36 flex-shrink-0">
            <option value="">All Months</option>
            {months.map(m => {
              const [y, mo] = m.split('-')
              const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              return <option key={m} value={m}>{label}</option>
            })}
          </select>
          {(filterCat !== 'all' || filterMonth || search) && (
            <button onClick={() => { setFilterCat('all'); setFilterMonth(''); setSearch('') }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded transition-colors">
              Clear filters
            </button>
          )}
          <div className="ml-auto text-sm font-semibold text-gray-700 dark:text-gray-300">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''} · {formatCurrency(totalFiltered)}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400 text-sm gap-3">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {expenses.length === 0 ? 'No expenses recorded yet. Click "Add Expense" to get started.' : 'No expenses match your filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 w-20"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {exp.date ? new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{exp.description}</p>
                      {exp.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">{exp.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.other}`}>
                        {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label ?? exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {PAYMENT_METHODS.find(m => m.value === exp.paymentMethod)?.label ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(exp.amount ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(exp)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => setDeleteId(exp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40">
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600 dark:text-gray-300">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(totalFiltered)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Add / Edit modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && closeForm()}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{editId ? 'Edit Expense' : 'Add Expense'}</h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="form-label">Description <span className="text-red-500">*</span></label>
                  <input value={form.description} onChange={e => set('description', e.target.value)}
                    placeholder="e.g. Office rent for June" className="input-field" required autoFocus/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Category</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Amount (₹) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
                      placeholder="0" className="input-field" required/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Date <span className="text-red-500">*</span></label>
                    <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field" required/>
                  </div>
                  <div>
                    <label className="form-label">Payment Method</label>
                    <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className="input-field">
                      <option value="">— Select —</option>
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    rows={2} placeholder="Optional details…" className="input-field resize-none"/>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeForm}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || !form.description.trim() || !form.amount || !form.date}
                    className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving && (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Delete Expense?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
