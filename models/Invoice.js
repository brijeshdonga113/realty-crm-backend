let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const INVOICE_STATUSES = [
  { value: 'draft',     label: 'Draft',     color: 'gray' },
  { value: 'sent',      label: 'Sent',      color: 'blue' },
  { value: 'paid',      label: 'Paid',      color: 'green' },
  { value: 'overdue',   label: 'Overdue',   color: 'red' },
  { value: 'cancelled', label: 'Cancelled', color: 'yellow' },
]

export const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'insurance',     label: 'Insurance' },
]

export function createLineItem(data = {}) {
  return {
    id:          data.id ?? uid(),
    description: data.description ?? '',
    quantity:    data.quantity ?? 1,
    unitPrice:   data.unitPrice ?? 0,
    total:       (data.quantity ?? 1) * (data.unitPrice ?? 0),
  }
}

export function calculateInvoiceTotals(lineItems, taxRate = 0, discount = 0) {
  const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0)
  const taxAmount = Math.round(subtotal * taxRate)
  const total = subtotal + taxAmount - discount
  return { subtotal, taxAmount, total }
}

export function createInvoice(data = {}) {
  const now = new Date().toISOString()
  const lineItems = (data.lineItems ?? []).map(createLineItem)
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(
    lineItems,
    data.taxRate ?? 0,
    data.discount ?? 0
  )

  return {
    id:              data.id ?? uid(),
    doctorId:        data.doctorId ?? '',
    patientId:       data.patientId ?? '',
    patientName:     data.patientName ?? '',
    patientPhone:    data.patientPhone ?? '',
    appointmentId:   data.appointmentId ?? null,
    invoiceNumber:   data.invoiceNumber ?? '',

    issueDate: data.issueDate ?? now.slice(0, 10),
    dueDate:   data.dueDate ?? '',

    lineItems,
    subtotal,
    taxRate:   data.taxRate ?? 0,
    taxAmount,
    discount:  data.discount ?? 0,
    total,
    currency:  data.currency ?? 'INR',

    status:        data.status ?? 'draft',
    paymentMethod: data.paymentMethod ?? null,
    paymentDate:   data.paymentDate ?? null,

    notes:     data.notes ?? '',
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  }
}

export function getInvoiceStatusMeta(status) {
  return INVOICE_STATUSES.find(s => s.value === status) ?? INVOICE_STATUSES[0]
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}
