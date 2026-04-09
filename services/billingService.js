import { dataStore } from '@/lib/dataStore'
import { createInvoice, calculateInvoiceTotals } from '@/models/Invoice'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

const COLLECTION = 'invoices'
const COUNTER_KEY = 'invoiceCounter'

async function nextInvoiceNumber() {
  const year    = new Date().getFullYear()
  const current = (await dataStore.getMeta(COUNTER_KEY)) ?? 0
  const next    = current + 1
  await dataStore.setMeta(COUNTER_KEY, next)
  return `INV-${year}-${String(next).padStart(4, '0')}`
}

export const billingService = {
  async getAll() {
    const invoices = await dataStore.getAll(COLLECTION)
    return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async getById(id) {
    return dataStore.getById(COLLECTION, id)
  },

  async getForPatient(patientId) {
    return dataStore.query(COLLECTION, inv => inv.patientId === patientId)
  },

  async create(data) {
    // Counter wrapped in try/catch so a Firestore meta permission error never blocks invoice creation
    let invoiceNumber = data.invoiceNumber ?? null
    try {
      invoiceNumber = await nextInvoiceNumber()
    } catch {
      const year = new Date().getFullYear()
      invoiceNumber = `INV-${year}-${Date.now().toString().slice(-5)}`
    }
    const invoice = createInvoice({ ...data, invoiceNumber })
    const saved = await dataStore.create(COLLECTION, invoice)

    // Fire-and-forget — never let notification failure block invoice creation
    notificationService.create({
      type:  NOTIFICATION_TYPES.INVOICE_CREATED,
      title: 'Invoice created',
      body:  `${saved.invoiceNumber} for ${saved.patientName} — ${saved.total}`,
      relatedEntity: { type: 'invoice', id: saved.id },
    }).catch(() => {})

    return saved
  },

  async update(id, patch) {
    // Recalculate totals if lineItems changed
    if (patch.lineItems) {
      const { subtotal, taxAmount, total } = calculateInvoiceTotals(
        patch.lineItems,
        patch.taxRate,
        patch.discount ?? 0
      )
      patch = { ...patch, subtotal, taxAmount, total }
    }
    return dataStore.update(COLLECTION, id, patch)
  },

  async markPaid(id, paymentMethod) {
    const updated = await dataStore.update(COLLECTION, id, {
      status: 'paid',
      paymentMethod,
      paymentDate: new Date().toISOString().slice(0, 10),
    })

    await notificationService.create({
      type:  NOTIFICATION_TYPES.INVOICE_PAID,
      title: 'Payment received',
      body:  `${updated.invoiceNumber} from ${updated.patientName} marked as paid.`,
      relatedEntity: { type: 'invoice', id: updated.id },
    })

    return updated
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },

  async getStats() {
    const all = await dataStore.getAll(COLLECTION)
    const paid    = all.filter(inv => inv.status === 'paid')
    const pending = all.filter(inv => ['draft', 'sent'].includes(inv.status))
    const overdue = all.filter(inv => inv.status === 'overdue')
    const totalRevenue  = paid.reduce((s, inv) => s + inv.total, 0)
    const pendingAmount = pending.reduce((s, inv) => s + inv.total, 0)
    const today = new Date().toISOString().slice(0, 10)
    const todayRevenue = paid
      .filter(inv => inv.issueDate === today)
      .reduce((s, inv) => s + inv.total, 0)
    return { total: all.length, paid: paid.length, pending: pending.length, overdue: overdue.length, totalRevenue, pendingAmount, todayRevenue }
  },

  async getMonthlyRevenue(months = 6) {
    const all = await dataStore.getAll(COLLECTION)
    const now  = new Date()
    const result = []

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const revenue = all
        .filter(inv => inv.status === 'paid' && inv.issueDate?.startsWith(prefix))
        .reduce((s, inv) => s + inv.total, 0)
      result.push({ label, revenue })
    }
    return result
  },
}
