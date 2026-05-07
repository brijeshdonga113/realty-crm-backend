// ─── Date formats ─────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

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

/**
 * Full date display: adds weekday name + month name, respects the user's format.
 * e.g. "Wednesday, 09 Apr 2026" or "Wednesday, Apr 09, 2026"
 * Used for prominent date headers and follow-up confirmations.
 */
export function formatDateFull(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr) return '—'
  const clean = String(dateStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  const [year, month, day] = parts
  const d = new Date(`${year}-${month}-${day}T00:00:00`)
  const weekday = WEEKDAYS[d.getDay()] ?? ''
  const monShort = MONTHS_SHORT[parseInt(month, 10) - 1] ?? month
  const monFull  = MONTHS_FULL[parseInt(month, 10) - 1] ?? month
  switch (format) {
    case 'DD/MM/YYYY':   return `${weekday}, ${day} ${monFull} ${year}`
    case 'MM/DD/YYYY':   return `${weekday}, ${monFull} ${day}, ${year}`
    case 'YYYY-MM-DD':   return `${weekday}, ${year}-${month}-${day}`
    case 'DD MMM YYYY':  return `${weekday}, ${day} ${monShort} ${year}`
    case 'MMM DD, YYYY': return `${weekday}, ${monShort} ${day}, ${year}`
    default:             return `${weekday}, ${day} ${monFull} ${year}`
  }
}

// Returns YYYY-MM-DD in the local timezone (never UTC).
// Use this instead of new Date().toISOString().slice(0,10) which gives UTC date.
export function localDateStr(offsetDays = 0) {
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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
