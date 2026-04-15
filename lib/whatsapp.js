/**
 * Shared WhatsApp URL helpers.
 * Country code is read from the WhatsApp Templates settings (localStorage),
 * falling back to +91 (India) if not configured.
 */

function getCountryCode() {
  if (typeof window === 'undefined') return '91'
  try {
    const stored = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
    return (stored.countryCode || '+91').replace(/\D/g, '')
  } catch {
    return '91'
  }
}

/**
 * Normalise a raw phone number into a full international number string
 * (digits only, no +). Uses the stored country code unless the number
 * already starts with a country code (i.e. is 11+ digits or starts with 00).
 */
export function formatWAPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  // If already long enough to be an international number (10+ digits without cc)
  // and doesn't already have cc prepended, prepend it.
  // Simple heuristic: if 10 digits assume local, prepend cc; if longer assume already has cc.
  const cc = getCountryCode()
  if (digits.length <= 10) return `${cc}${digits}`
  return digits
}

/**
 * Build a wa.me URL. If no phone, opens WhatsApp Web compose with just the text.
 */
export function buildWAUrl(phone, text) {
  const full = formatWAPhone(phone)
  const encoded = text ? `?text=${encodeURIComponent(text)}` : ''
  return full ? `https://wa.me/${full}${encoded}` : `https://wa.me/${encoded}`
}
