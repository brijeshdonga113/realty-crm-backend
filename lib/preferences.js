// ─── Date formats ─────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY',   label: 'DD/MM/YYYY',   example: '09/04/2026' },
  { value: 'MM/DD/YYYY',   label: 'MM/DD/YYYY',   example: '04/09/2026' },
  { value: 'YYYY-MM-DD',   label: 'YYYY-MM-DD',   example: '2026-04-09' },
  { value: 'DD MMM YYYY',  label: 'DD MMM YYYY',  example: '09 Apr 2026' },
  { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY', example: 'Apr 09, 2026' },
]

/**
 * Format a YYYY-MM-DD (or ISO datetime) string using the given format key.
 * Returns '—' for falsy input.
 */
export function formatDate(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr) return '—'
  const clean = String(dateStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  const [year, month, day] = parts
  const mon = MONTHS_SHORT[parseInt(month, 10) - 1] ?? month
  switch (format) {
    case 'DD/MM/YYYY':   return `${day}/${month}/${year}`
    case 'MM/DD/YYYY':   return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':   return `${year}-${month}-${day}`
    case 'DD MMM YYYY':  return `${day} ${mon} ${year}`
    case 'MMM DD, YYYY': return `${mon} ${day}, ${year}`
    default:             return `${day}/${month}/${year}`
  }
}

// ─── Currencies ───────────────────────────────────────────────────────────────

export const CURRENCIES = [
  { value: 'INR', label: 'INR — Indian Rupee (₹)',      locale: 'en-IN' },
  { value: 'USD', label: 'USD — US Dollar ($)',          locale: 'en-US' },
  { value: 'EUR', label: 'EUR — Euro (€)',               locale: 'en-DE' },
  { value: 'GBP', label: 'GBP — British Pound (£)',     locale: 'en-GB' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)',      locale: 'en-AE' },
  { value: 'SGD', label: 'SGD — Singapore Dollar (S$)', locale: 'en-SG' },
]

/**
 * Format an amount as currency. Falls back to INR.
 */
export function formatCurrency(amount, currency = 'INR') {
  const cur = CURRENCIES.find(c => c.value === currency)
  return new Intl.NumberFormat(cur?.locale ?? 'en-IN', {
    style: 'currency',
    currency,
  }).format(amount ?? 0)
}
