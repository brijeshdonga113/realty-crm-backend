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
 * Uses TextEncoder to guarantee correct UTF-8 percent-encoding for all
 * characters including 4-byte emojis (e.g. 🙏 → %F0%9F%99%8F).
 * Plain encodeURIComponent can produce %EF%BF%BD for surrogate-pair emojis.
 */
function encodeWAText(text) {
  if (typeof TextEncoder === 'undefined') return encodeURIComponent(text)
  const bytes = new TextEncoder().encode(text)
  return Array.from(bytes)
    .map(b => {
      // Leave unreserved chars unencoded for readability
      if ((b >= 0x41 && b <= 0x5A) || // A-Z
          (b >= 0x61 && b <= 0x7A) || // a-z
          (b >= 0x30 && b <= 0x39) || // 0-9
          b === 0x2D || b === 0x5F || b === 0x2E || b === 0x7E) { // - _ . ~
        return String.fromCharCode(b)
      }
      return '%' + b.toString(16).toUpperCase().padStart(2, '0')
    })
    .join('')
}

/**
 * Build a wa.me URL. If no phone, opens WhatsApp Web compose with just the text.
 */
export function buildWAUrl(phone, text) {
  const full = formatWAPhone(phone)
  const encoded = text ? `?text=${encodeWAText(text)}` : ''
  return full ? `https://wa.me/${full}${encoded}` : `https://wa.me/${encoded}`
}
