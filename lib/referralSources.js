export const DEFAULT_REFERRAL_SOURCES = [
  { value: 'walk_in',          label: 'Walk-in' },
  { value: 'first_visit',      label: 'First Visit' },
  { value: 'patient_referral', label: 'Patient Referral' },
  { value: 'doctor_referral',  label: 'Doctor Referral' },
  { value: 'social_media',     label: 'Social Media' },
  { value: 'google_ads',       label: 'Google Ads' },
  { value: 'facebook_ads',     label: 'Facebook Ads' },
  { value: 'advertisement',    label: 'Advertisement' },
  { value: 'returning',        label: 'Returning Patient' },
  { value: 'other',            label: 'Other' },
]

/**
 * Returns active referral sources — custom ones from profile, or defaults.
 */
export function getReferralSources(customSources) {
  if (Array.isArray(customSources) && customSources.length > 0) return customSources
  return DEFAULT_REFERRAL_SOURCES
}

/**
 * Build a value→label map for reports. Always includes '' → 'Unknown'.
 */
export function buildLabelMap(sources) {
  const map = { '': 'Unknown' }
  sources.forEach(s => { map[s.value] = s.label })
  return map
}
