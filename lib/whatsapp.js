/**
 * Shared WhatsApp URL helpers.
 * Country code is read from the doctor's waTemplates profile setting,
 * falling back to the localStorage key (legacy) and then +91 (India).
 */

function getCountryCode() {
  if (typeof window === 'undefined') return '91'
  try {
    // Primary: doctor profile stored in session cache
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') || 'null')
    const fromProfile = session?.waTemplates?.countryCode
    if (fromProfile) return fromProfile.replace(/\D/g, '')
    // Legacy fallback
    const legacy = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
    return (legacy.countryCode || '+91').replace(/\D/g, '')
  } catch {
    return '91'
  }
}

/**
 * Normalise a raw phone number into a full international number string
 * (digits only, no +). Uses the stored country code unless the number
 * already starts with a country code (i.e. is 11+ digits).
 */
export function formatWAPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  const cc = getCountryCode()
  if (digits.length <= 10) return `${cc}${digits}`
  return digits
}

/**
 * Encode message text for WhatsApp URLs.
 * Iterates by Unicode code point (for...of), so 4-byte emoji surrogate pairs
 * are never split. Each code point is then UTF-8 encoded byte-by-byte so that
 * emojis like 🙏 become %F0%9F%99%8F instead of the broken %EF%BF%BD.
 */
function encodeWAText(text) {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
  let out = ''
  for (const char of text) {
    const cp = char.codePointAt(0)
    // RFC 3986 unreserved — pass through unchanged
    if ((cp >= 0x41 && cp <= 0x5A) ||
        (cp >= 0x61 && cp <= 0x7A) ||
        (cp >= 0x30 && cp <= 0x39) ||
        cp === 0x2D || cp === 0x5F || cp === 0x2E || cp === 0x7E) {
      out += char
      continue
    }
    if (enc) {
      // TextEncoder handles multi-byte chars and surrogate pairs correctly
      const bytes = enc.encode(char)
      for (const b of bytes) out += '%' + b.toString(16).toUpperCase().padStart(2, '0')
    } else {
      // Fallback for environments without TextEncoder
      out += encodeURIComponent(char)
    }
  }
  return out
}

/**
 * Build a wa.me URL. If no phone, opens WhatsApp Web compose with just the text.
 */
export function buildWAUrl(phone, text) {
  const full = formatWAPhone(phone)
  const encoded = text ? `?text=${encodeWAText(text)}` : ''
  return full ? `https://wa.me/${full}${encoded}` : `https://wa.me/${encoded}`
}

export const DEFAULT_BILLING_WA_TEMPLATE =
  'Hello {name},\n\nYour invoice *{invoice}* from *{clinic}* dated {date} is ready.\n\nStatus: *{status}*\n\n{items}\n\n*Total: {total}*\n\nThank you!'

function titleCaseStatus(value) {
  if (!value) return 'Due'
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Pre-filled WhatsApp text for sharing an invoice.
 * Always includes clinic name and billing status (custom labels when configured).
 */
export function buildInvoiceWhatsAppMessage(inv, { formatCurrency, formatDate, doctor, billingStatuses } = {}) {
  const clinicName = (inv?.clinicName || doctor?.clinicName || 'our clinic').trim() || 'our clinic'
  const statusLabel = (billingStatuses || []).find(s => s.value === inv?.status)?.label
    || titleCaseStatus(inv?.status)
  const fmtC = typeof formatCurrency === 'function' ? formatCurrency : (n => String(n ?? 0))
  const fmtD = typeof formatDate === 'function' ? formatDate : (d => d || '')
  const items = (inv?.lineItems || []).map(i => {
    const lineTotal = i.total ?? ((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))
    return `• ${i.description} x${i.quantity} — ${fmtC(lineTotal)}`
  }).join('\n')

  const tmpl = doctor?.waTemplates?.billing?.template || DEFAULT_BILLING_WA_TEMPLATE
  return tmpl
    .replace(/\{name\}/g, inv?.patientName || 'Patient')
    .replace(/\{clinic\}/g, clinicName)
    .replace(/\{date\}/g, fmtD(inv?.issueDate))
    .replace(/\{invoice\}/g, inv?.invoiceNumber || '')
    .replace(/\{status\}/g, statusLabel)
    .replace(/\{total\}/g, fmtC(inv?.total))
    .replace(/\{items\}/g, items)
}
