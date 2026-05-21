'use client'
import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useBilling } from '@/hooks/useBilling'
import { usePatients } from '@/hooks/usePatients'
import { useAuth } from '@/context/AuthContext'
import { useInventory } from '@/hooks/useInventory'
import { createLineItem, PAYMENT_METHODS, COLLECTED_BY_OPTIONS } from '@/models/Invoice'
import { inventoryService } from '@/services/inventoryService'
import { usePreferences } from '@/hooks/usePreferences'
import AutoTextarea from '@/components/ui/AutoTextarea'
import { getBillingItems } from '@/lib/specialtyPresets'

function StockBadge({ invItem, qty }) {
  if (!invItem) return null
  const available = invItem.quantity ?? 0
  const unit      = invItem.unit || 'units'
  if (qty > available)
    return <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">⚠ Only {available} {unit} in stock</p>
  if (available === 0)
    return <p className="text-xs text-red-500 dark:text-red-400 mt-1">Out of stock</p>
  if (available <= (invItem.lowStockThreshold ?? 10))
    return <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">{available} {unit} left (low stock)</p>
  return <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{available} {unit} in stock</p>
}

function NewInvoiceForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { add }                    = useBilling()
  const { patients }               = usePatients()
  const { doctor, isReceptionist } = useAuth()
  const { items: inventory }              = useInventory()
  const { formatCurrency }         = usePreferences()

  const [loading,   setLoading]   = useState(false)
  const [errors,    setErrors]    = useState({})
  const [saveError, setSaveError] = useState('')

  const [form, setForm] = useState({
    patientId:     searchParams.get('patientId') ?? '',
    issueDate:     new Date().toISOString().slice(0, 10),
    dueDate:       '',
    taxRate:       0,
    discount:      0,
    notes:         '',
    status:        'draft',
    paymentMethod: '',
    collectedBy:   isReceptionist ? 'receptionist' : 'doctor',
  })

  const [lineItems, setLineItems] = useState([createLineItem({ itemType: 'service' })])

  const selectedPatient = patients.find(p => p.id === form.patientId)

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  // ── Line item helpers ────────────────────────────────────────────────────────

  const updateItem = (id, field, raw) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const value   = (field === 'quantity' || field === 'unitPrice' || field === 'discountPct') ? Number(raw) : raw
      const updated = { ...item, [field]: value }
      const lineTotal  = updated.quantity * updated.unitPrice
      const discAmount = lineTotal * (Number(updated.discountPct) || 0) / 100
      return { ...updated, total: lineTotal - discAmount }
    }))
  }

  const handleMedicineSelect = (id, invId) => {
    const inv = inventory.find(i => i.id === invId) ?? null
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const desc      = inv ? `${inv.name}${inv.potency ? ` (${inv.potency})` : ''}` : ''
      const unitPrice = inv ? (inv.billingPrice ? Number(inv.billingPrice) : (inv.mrp ? Number(inv.mrp) : 0)) : 0
      const lineTotal  = item.quantity * unitPrice
      const discAmount = lineTotal * (Number(item.discountPct) || 0) / 100
      return { ...item, inventoryItemId: invId || null, description: desc, unitPrice, total: lineTotal - discAmount }
    }))
  }

  const addMedicine = () => setLineItems(p => [...p, createLineItem({ itemType: 'medicine' })])
  const addService  = (preset) => setLineItems(p => [...p, createLineItem({ ...(preset ?? {}), itemType: 'service' })])

  const removeItem = (id) => {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter(i => i.id !== id))
  }

  // ── Stock warnings (qty > available) ────────────────────────────────────────

  const stockWarnings = useMemo(() => {
    const map = {}
    lineItems.forEach(item => {
      if (!item.inventoryItemId) return
      const inv = inventory.find(i => i.id === item.inventoryItemId)
      if (inv && item.quantity > (inv.quantity ?? 0)) map[item.id] = inv.quantity
    })
    return map
  }, [lineItems, inventory])

  const subtotal         = lineItems.reduce((s, i) => s + i.total, 0)
  const taxableSubtotal  = lineItems.filter(i => i.taxable !== false).reduce((s, i) => s + i.total, 0)
  const taxAmount        = Math.round(taxableSubtotal * Number(form.taxRate) / 100)
  const total            = subtotal + taxAmount - Number(form.discount)

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {}
    if (!form.patientId) errs.patientId = 'Please select a patient'
    if (!form.issueDate) errs.issueDate = 'Required'
    if (!lineItems.every(i => i.description.trim())) errs.items = 'All items need a description'
    return errs
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setSaveError('')

    const withTimeout = (promise, ms = 15000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out — check your connection and try again.')), ms)
        ),
      ])

    try {
      await withTimeout(add({
        ...form,
        patientName:   selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : '',
        patientPhone:  selectedPatient?.phone ?? '',
        lineItems,
        taxRate:       Number(form.taxRate) / 100,
        discount:      Number(form.discount),
        paymentMethod: form.paymentMethod || null,
        collectedBy:   form.collectedBy,
        paymentDate:   form.status === 'paid' ? form.issueDate : null,
        clinicName:  doctor?.clinicName ?? '',
        doctorName:  doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim() : '',
        doctorPhone: doctor?.phone ?? '',
        doctorEmail: doctor?.email ?? '',
        createdBy: isReceptionist
          ? { role: 'receptionist', name: doctor._receptionistName ?? '', uid: doctor._receptionistUid ?? '' }
          : { role: 'doctor', name: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim() : '', uid: doctor?.id ?? '' },
      }))

      // Deduct inventory stock for medicine items (fire-and-forget on individual failures)
      const medicineItems = lineItems.filter(i => i.inventoryItemId && i.quantity > 0)
      if (medicineItems.length) {
        await Promise.allSettled(
          medicineItems.map(i => inventoryService.adjustQty(i.inventoryItemId, -i.quantity))
        )
      }

      router.push('/billing')
    } catch (err) {
      setSaveError(err?.message || 'Failed to save invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasStockWarning = Object.keys(stockWarnings).length > 0

  return (
    <AppLayout title="New Invoice"
      action={
        <button onClick={() => router.back()}
          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5">
          ← Back
        </button>
      }
    >
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Invoice Details ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Invoice Details</h3>

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
              <label className="form-label">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className="input-field">
                <option value="">Not specified</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {form.paymentMethod && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Status</label>
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm font-medium">
                    <button type="button" onClick={() => set('status', 'paid')}
                      className={`flex-1 py-2 transition-colors flex items-center justify-center gap-1.5 ${form.status === 'paid' ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      Paid
                    </button>
                    <button type="button" onClick={() => set('status', 'draft')}
                      className={`flex-1 py-2 transition-colors flex items-center justify-center gap-1.5 ${form.status === 'draft' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Due
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Collected By</label>
                  <select value={form.collectedBy} onChange={e => set('collectedBy', e.target.value)} className="input-field">
                    {COLLECTED_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Line Items ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">

            {/* Header + Add buttons */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Line Items</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={addMedicine}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                  </svg>
                  Add Medicine
                </button>
                <button type="button" onClick={() => addService()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  Add Service
                </button>
              </div>
            </div>

            {/* Quick-add service presets */}
            {getBillingItems(doctor?.specialization).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 self-center mr-1">Quick add:</span>
                {getBillingItems(doctor?.specialization).map(item => (
                  <button key={item.description} type="button" onClick={() => addService(item)}
                    className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-600 hover:border-blue-300 rounded-lg font-medium transition-colors">
                    + {item.description}
                  </button>
                ))}
              </div>
            )}

            {/* Stock over-dispense warning */}
            {hasStockWarning && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span>Some medicine quantities exceed available stock. Inventory will be set to 0 for those items.</span>
              </div>
            )}

            {errors.items && <p className="error-text mb-3">{errors.items}</p>}

            {/* Items */}
            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3">
                <span className="col-span-4">Description / Medicine</span>
                <span className="col-span-1 text-center">Tax</span>
                <span className="col-span-1 text-center">Disc</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2">Unit Price</span>
                <span className="col-span-1 text-right">Total</span>
                <span className="col-span-1"/>
              </div>

              {lineItems.map(item => {
                const isMedicine = item.itemType === 'medicine'
                const linkedInv  = isMedicine && item.inventoryItemId
                  ? inventory.find(i => i.id === item.inventoryItemId)
                  : null

                return (
                  <div key={item.id}
                    className={`grid grid-cols-12 gap-2 items-start p-3 rounded-xl border transition-colors ${
                      isMedicine
                        ? 'bg-teal-50/40 dark:bg-teal-900/10 border-teal-100 dark:border-teal-800'
                        : 'bg-blue-50/30 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/40'
                    }`}>

                    {/* Description / Medicine select */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isMedicine
                            ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        }`}>
                          {isMedicine ? 'Medicine' : 'Service'}
                        </span>
                      </div>

                      {isMedicine ? (
                        <>
                          <select
                            value={item.inventoryItemId || ''}
                            onChange={e => handleMedicineSelect(item.id, e.target.value)}
                            className={`input-field text-sm py-2 w-full ${stockWarnings[item.id] !== undefined ? 'border-amber-400' : ''}`}
                          >
                            <option value="">Select medicine from inventory…</option>
                            {inventory.length === 0 && (
                              <option disabled>No inventory items found</option>
                            )}
                            {inventory
                              .slice()
                              .sort((a, b) => (b.quantity > 0 ? 1 : -1) - (a.quantity > 0 ? 1 : -1) || a.name.localeCompare(b.name))
                              .map(inv => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name}{inv.potency ? ` (${inv.potency})` : ''}{inv.dosageForm ? ` · ${inv.dosageForm}` : ''} — {inv.quantity} {inv.unit || 'units'} {inv.quantity === 0 ? '(out of stock)' : ''}
                                </option>
                              ))
                            }
                          </select>
                          <StockBadge invItem={linkedInv} qty={item.quantity}/>
                          {linkedInv && (linkedInv.mrp || linkedInv.billingPrice) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {linkedInv.mrp && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  Purchase: <span className="font-semibold text-gray-600 dark:text-gray-300">₹{linkedInv.mrp}</span>
                                </span>
                              )}
                              {linkedInv.billingPrice && (
                                <span className="text-xs text-teal-600 dark:text-teal-400">
                                  Billing: <span className="font-semibold">₹{linkedInv.billingPrice}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <input
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Service description"
                          className="input-field text-sm py-2 w-full"
                        />
                      )}
                    </div>

                    {/* Tax toggle */}
                    <div className="col-span-1 pt-7 flex justify-center">
                      <button type="button"
                        title={item.taxable !== false ? 'Click to exempt from tax' : 'Click to apply tax'}
                        onClick={() => updateItem(item.id, 'taxable', item.taxable !== false ? false : true)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                          item.taxable !== false
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}>
                        {item.taxable !== false
                          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        }
                      </button>
                    </div>

                    {/* Discount toggle */}
                    <div className="col-span-1 pt-7 flex flex-col items-center gap-1">
                      <button type="button"
                        title={item.discountPct > 0 ? 'Remove item discount' : 'Add item discount (%)'}
                        onClick={() => updateItem(item.id, 'discountPct', item.discountPct > 0 ? 0 : 10)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors text-xs font-bold ${
                          item.discountPct > 0
                            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}>
                        %
                      </button>
                      {item.discountPct > 0 && (
                        <input
                          type="number" min="0" max="100"
                          value={item.discountPct}
                          onChange={e => updateItem(item.id, 'discountPct', e.target.value)}
                          className="w-12 text-center text-xs py-1 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        />
                      )}
                    </div>

                    {/* Qty */}
                    <div className="col-span-2 pt-7">
                      <input
                        type="number" min="1"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        className={`input-field text-sm py-2 text-center w-full ${stockWarnings[item.id] !== undefined ? 'border-amber-400' : ''}`}
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-2 pt-7">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                        placeholder="0"
                        className="input-field text-sm py-2 w-full"
                      />
                    </div>

                    {/* Total */}
                    <div className="col-span-1 pt-8 text-right">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.total)}
                      </span>
                      {item.discountPct > 0 && (
                        <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                          -{item.discountPct}%
                        </p>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 pt-8 flex justify-center">
                      <button type="button" onClick={() => removeItem(item.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="mt-5 border-t dark:border-gray-700 pt-4 space-y-2">
              <div className="grid grid-cols-2 gap-4 max-w-xs ml-auto">
                <div>
                  <label className="form-label text-xs">Tax Rate (%)</label>
                  <input type="number" min="0" max="100" value={form.taxRate}
                    onChange={e => set('taxRate', e.target.value)} className="input-field py-2 text-sm"/>
                </div>
                <div>
                  <label className="form-label text-xs">Discount (₹)</label>
                  <input type="number" min="0" value={form.discount}
                    onChange={e => set('discount', e.target.value)} className="input-field py-2 text-sm"/>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 mt-4 text-sm">
                <div className="flex gap-8 text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-medium w-28 text-right">{formatCurrency(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex gap-8 text-gray-600 dark:text-gray-300">
                    <span>
                      Tax ({form.taxRate}%)
                      {taxableSubtotal < subtotal && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">on {formatCurrency(taxableSubtotal)}</span>
                      )}
                    </span>
                    <span className="font-medium w-28 text-right">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {Number(form.discount) > 0 && (
                  <div className="flex gap-8 text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span className="font-medium w-28 text-right">-{formatCurrency(Number(form.discount))}</span>
                  </div>
                )}
                <div className="flex gap-8 font-bold text-base border-t dark:border-gray-700 pt-2 text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span className="w-28 text-right text-primary-600 dark:text-primary-400">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <label className="form-label">Notes</label>
            <AutoTextarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Payment instructions, terms, etc." className="input-field resize"/>
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
            <button type="submit" disabled={loading} className="btn-primary w-auto px-6 flex items-center gap-2">
              {loading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
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
