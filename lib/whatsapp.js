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
 * Build a wa.me URL. If no phone, opens WhatsApp Web compose with just the text.
 */
export function buildWAUrl(phone, text) {
  const full = formatWAPhone(phone)
  const encoded = text ? `?text=${encodeURIComponent(text)}` : ''
  return full ? `https://wa.me/${full}${encoded}` : `https://wa.me/${encoded}`
}
