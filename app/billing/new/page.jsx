'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useBilling } from '@/hooks/useBilling'
import { usePatients } from '@/hooks/usePatients'
import { useAuth } from '@/context/AuthContext'
import { createLineItem, calculateInvoiceTotals, formatCurrency } from '@/models/Invoice'

const COMMON_ITEMS = [
  { description: 'Consultation', unitPrice: 500 },
  { description: 'Follow-up Consultation', unitPrice: 300 },
  { description: 'Blood Test (CBC)', unitPrice: 150 },
  { description: 'Blood Sugar Test', unitPrice: 80 },
  { description: 'ECG', unitPrice: 200 },
  { description: 'X-Ray', unitPrice: 350 },
  { description: 'Ultrasound', unitPrice: 600 },
  { description: 'Urine Test', unitPrice: 100 },
]

function NewInvoiceForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { add }      = useBilling()
  const { patients } = usePatients()
  const { doctor }   = useAuth()

  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({
    patientId: searchParams.get('patientId') ?? '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate:   '',
    taxRate:   15,
    discount:  0,
    notes:     '',
    status:    'draft',
  })
  const [lineItems, setLineItems] = useState([createLineItem()])

  const selectedPatient = patients.find(p => p.id === form.patientId)

  const set = (k, v) => { setForm(p => ({...p, [k]: v})); setErrors(e => ({...e, [k]: ''})) }

  const updateItem = (id, field, value) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: field === 'quantity' || field === 'unitPrice' ? Number(value) : value }
      return { ...updated, total: updated.quantity * updated.unitPrice }
    }))
  }

  const addItem = (preset) => {
    setLineItems(prev => [...prev, createLineItem(preset ?? {})])
  }

  const removeItem = (id) => {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter(i => i.id !== id))
  }

  const { subtotal, taxAmount, total } = calculateInvoiceTotals(lineItems, Number(form.taxRate) / 100, Number(form.discount))

  const validate = () => {
    const errs = {}
    if (!form.patientId) errs.patientId = 'Please select a patient'
    if (!form.issueDate) errs.issueDate = 'Required'
    if (!lineItems.every(i => i.description.trim())) errs.items = 'All items must have a description'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setSaveError('')
    try {
      await add({
        ...form,
        patientName:  selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : '',
        patientPhone: selectedPatient?.phone ?? '',
        lineItems,
        taxRate:      Number(form.taxRate) / 100,
        discount:     Number(form.discount),
        clinicName:   doctor?.clinicName ?? '',
        doctorName:   doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim() : '',
        doctorPhone:  doctor?.phone ?? '',
        doctorEmail:  doctor?.email ?? '',
      })
      router.push('/billing')
    } catch (err) {
      setSaveError(err?.message || 'Failed to save invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout title="New Invoice"
      action={<button onClick={() => router.back()} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">← Back</button>}
    >
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Invoice Details</h3>

            {/* Patient */}
            <div>
              <label className="form-label">Patient <span className="text-red-500">*</span></label>
              <select value={form.patientId} onChange={e => set('patientId', e.target.value)}
                className={`input-field ${errors.patientId ? 'border-red-400' : ''}`}>
                <option value="">Select patient…</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.phone}</option>
                ))}
              </select>
              {errors.patientId && <p className="error-text">{errors.patientId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Issue Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} className="input-field"/>
              </div>
              <div>
                <label className="form-label">Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className="input-field"/>
              </div>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
                <option value="draft">Draft</option>
                <option value="sent">Sent to Patient</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Line Items</h3>
            </div>

            {/* Quick add */}
            <div className="flex flex-wrap gap-2 mb-4">
              {COMMON_ITEMS.map(item => (
                <button key={item.description} type="button" onClick={() => addItem(item)}
                  className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg font-medium transition-colors">
                  + {item.description}
                </button>
              ))}
            </div>

            {errors.items && <p className="error-text mb-3">{errors.items}</p>}

            {/* Items table */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase px-1">
                <span className="col-span-6">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Unit Price</span>
                <span className="col-span-1 text-right">Total</span>
                <span className="col-span-1"/>
              </div>
              {lineItems.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Service description" className="input-field col-span-6 py-2 text-sm"/>
                  <input type="number" min="1" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                    className="input-field col-span-2 py-2 text-sm"/>
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                    className="input-field col-span-2 py-2 text-sm"/>
                  <span className="col-span-1 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.quantity * item.unitPrice)}</span>
                  <button type="button" onClick={() => removeItem(item.id)}
                    className="col-span-1 text-gray-400 hover:text-red-500 transition-colors flex justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => addItem()}
              className="mt-3 text-sm text-primary-600 hover:underline font-medium">
              + Add item
            </button>

            {/* Totals */}
            <div className="mt-5 border-t dark:border-gray-700 pt-4 space-y-2">
              <div className="grid grid-cols-2 gap-4 max-w-xs ml-auto">
                <div>
                  <label className="form-label text-xs">Tax Rate (%)</label>
                  <input type="number" min="0" max="100" value={form.taxRate} onChange={e => set('taxRate', e.target.value)} className="input-field py-2 text-sm"/>
                </div>
                <div>
                  <label className="form-label text-xs">Discount ({formatCurrency(0).replace(/[\d,.]/g, '')[0]})</label>
                  <input type="number" min="0" value={form.discount} onChange={e => set('discount', e.target.value)} className="input-field py-2 text-sm"/>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 mt-4 text-sm">
                <div className="flex gap-8 text-gray-600 dark:text-gray-300"><span>Subtotal</span><span className="font-medium w-24 text-right">{formatCurrency(subtotal)}</span></div>
                {taxAmount > 0 && <div className="flex gap-8 text-gray-600 dark:text-gray-300"><span>Tax ({form.taxRate}%)</span><span className="font-medium w-24 text-right">{formatCurrency(taxAmount)}</span></div>}
                {Number(form.discount) > 0 && <div className="flex gap-8 text-green-600 dark:text-green-400"><span>Discount</span><span className="font-medium w-24 text-right">-{formatCurrency(Number(form.discount))}</span></div>}
                <div className="flex gap-8 font-bold text-base border-t dark:border-gray-700 pt-2 text-gray-900 dark:text-white"><span>Total</span><span className="w-24 text-right text-primary-600 dark:text-primary-400">{formatCurrency(total)}</span></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Payment instructions, terms, etc." rows={2} className="input-field resize-none"/>
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary w-auto px-6">
              {loading ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceForm />
    </Suspense>
  )
}
