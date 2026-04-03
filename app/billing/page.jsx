'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useBilling } from '@/hooks/useBilling'
import { formatCurrency, INVOICE_STATUSES, PAYMENT_METHODS } from '@/models/Invoice'

const STATUS_COLOR = { draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'yellow' }

function InvoicePrint({ invoice }) {
  return (
    <div id="invoice-print" className="p-8 font-sans text-sm text-gray-800 bg-white" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary-600">ClinicCRM</h1>
          <p className="text-gray-500 text-xs mt-1">Medical Invoice</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</p>
          <p className="text-gray-500 text-xs mt-1">Issue: {invoice.issueDate}</p>
          {invoice.dueDate && <p className="text-gray-500 text-xs">Due: {invoice.dueDate}</p>}
        </div>
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Billed To</p>
        <p className="font-semibold text-gray-900 text-base">{invoice.patientName}</p>
      </div>

      <table className="w-full mb-6">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems?.map(item => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-3">{item.description}</td>
              <td className="py-3 text-right">{item.quantity}</td>
              <td className="py-3 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="py-3 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-56 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {invoice.taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax ({(invoice.taxRate * 100).toFixed(0)}%)</span><span>{formatCurrency(invoice.taxAmount)}</span></div>}
          {invoice.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatCurrency(invoice.discount)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span className="text-primary-600">{formatCurrency(invoice.total)}</span></div>
        </div>
      </div>

      {invoice.status === 'paid' && (
        <div className="mt-8 border-2 border-green-500 text-green-600 font-bold text-xl text-center py-2 rounded-xl opacity-60 rotate-[-3deg]">
          PAID
        </div>
      )}
      {invoice.notes && <p className="mt-6 text-xs text-gray-400 border-t pt-4">{invoice.notes}</p>}
    </div>
  )
}

function buildWhatsAppMessage(inv) {
  const items = inv.lineItems?.map(i => `• ${i.description} x${i.quantity} — ${formatCurrency(i.quantity * i.unitPrice)}`).join('\n') ?? ''
  return encodeURIComponent(
    `Hello ${inv.patientName},\n\nYour invoice *${inv.invoiceNumber}* dated ${inv.issueDate} is ready.\n\n${items}\n\n*Total: ${formatCurrency(inv.total)}*\n\nThank you!`
  )
}

export default function BillingPage() {
  const router = useRouter()
  const { invoices, loading, markPaid, remove } = useBilling()
  const [filterStatus, setFilterStatus] = useState('all')
  const [printInvoice, setPrintInvoice] = useState(null)
  const [payModal, setPayModal]         = useState(null)
  const [payMethod, setPayMethod]       = useState('cash')

  const filtered = filterStatus === 'all' ? invoices : invoices.filter(inv => inv.status === filterStatus)

  const stats = invoices.reduce((acc, inv) => {
    if (inv.status === 'paid')    acc.revenue += inv.total
    if (inv.status === 'overdue') acc.overdue += inv.total
    if (['draft','sent'].includes(inv.status)) acc.pending += inv.total
    return acc
  }, { revenue: 0, overdue: 0, pending: 0 })

  const handlePrint = (inv) => {
    setPrintInvoice(inv)
    setTimeout(() => window.print(), 300)
  }

  return (
    <AppLayout
      title="Billing & Invoices"
      action={
        <button onClick={() => router.push('/billing/new')}
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New Invoice
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: formatCurrency(stats.revenue), color: 'green', sub: 'from paid invoices' },
          { label: 'Pending',       value: formatCurrency(stats.pending), color: 'teal',  sub: 'awaiting payment' },
          { label: 'Overdue',       value: formatCurrency(stats.overdue), color: 'red',   sub: 'past due date' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color === 'green' ? 'text-green-600 dark:text-green-400' : s.color === 'red' ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex justify-end mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field w-40">
          <option value="all">All Invoices</option>
          {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading invoices…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create your first invoice to start tracking payments."
          action={() => router.push('/billing/new')}
          actionLabel="Create Invoice"
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                {['Invoice #', 'Patient', 'Date', 'Items', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3.5 pl-6">
                    <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{inv.invoiceNumber}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{inv.patientName}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{inv.issueDate}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{inv.lineItems?.length ?? 0} item{inv.lineItems?.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3.5">
                    <Badge label={inv.status} color={STATUS_COLOR[inv.status] ?? 'gray'}/>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <button onClick={() => { setPayModal(inv.id); setPayMethod('cash') }}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium">
                          Mark Paid
                        </button>
                      )}
                      <button onClick={() => setPrintInvoice(inv)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                        Print
                      </button>
                      {inv.patientPhone && (
                        <a
                          href={`https://wa.me/${inv.patientPhone.replace(/\D/g, '')}?text=${buildWhatsAppMessage(inv)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium flex items-center gap-1"
                          title="Send via WhatsApp"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WA
                        </a>
                      )}
                      <button onClick={() => remove(inv.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Paid modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Mark as Paid" size="sm">
        <div className="space-y-4 mb-5">
          <div>
            <label className="form-label">Payment Method</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field">
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setPayModal(null)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={async () => { await markPaid(payModal, payMethod); setPayModal(null) }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
            Confirm Payment
          </button>
        </div>
      </Modal>

      {/* Print modal */}
      <Modal open={!!printInvoice} onClose={() => setPrintInvoice(null)} title="Invoice Preview" size="lg">
        {printInvoice && (
          <>
            <InvoicePrint invoice={printInvoice}/>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
              <button onClick={() => setPrintInvoice(null)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Close
              </button>
              <button onClick={() => window.print()}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
                🖨️ Print / Save PDF
              </button>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}
