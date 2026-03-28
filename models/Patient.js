let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const GENDERS = ['male', 'female', 'other']
export const PATIENT_STATUSES = ['active', 'inactive', 'deceased']

/**
 * Create a new Patient record.
 * All fields optional except firstName, lastName, phone, doctorId.
 */
export function createPatient(data = {}) {
  const now = new Date().toISOString()
  return {
    id:               data.id ?? uid(),
    doctorId:         data.doctorId ?? '',

    // Demographics
    firstName:        data.firstName ?? '',
    lastName:         data.lastName ?? '',
    dateOfBirth:      data.dateOfBirth ?? '',
    gender:           data.gender ?? 'male',
    bloodType:        data.bloodType ?? '',
    nationalId:       data.nationalId ?? '',

    // Contact
    phone:            data.phone ?? '',
    alternatePhone:   data.alternatePhone ?? '',
    email:            data.email ?? '',
    address:          data.address ?? '',

    // Medical
    allergies:        data.allergies ?? [],
    chronicConditions: data.chronicConditions ?? [],
    currentMedications: data.currentMedications ?? [],
    familyHistory:    data.familyHistory ?? '',

    // Emergency contact
    emergencyContact: {
      name:         data.emergencyContact?.name ?? '',
      phone:        data.emergencyContact?.phone ?? '',
      relationship: data.emergencyContact?.relationship ?? '',
    },

    // Insurance
    insuranceProvider:     data.insuranceProvider ?? '',
    insurancePolicyNumber: data.insurancePolicyNumber ?? '',
    insuranceExpiry:       data.insuranceExpiry ?? '',
    insuranceGroupNumber:  data.insuranceGroupNumber ?? '',

    // Consent
    consentFormSigned:   data.consentFormSigned ?? false,
    consentSignedAt:     data.consentSignedAt ?? null,

    // Meta
    notes:     data.notes ?? '',
    status:    data.status ?? 'active',
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  }
}

export function getPatientAge(patient) {
  if (!patient.dateOfBirth) return null
  const dob = new Date(patient.dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function getPatientFullName(patient) {
  return `${patient.firstName} ${patient.lastName}`.trim()
}

export function getPatientInitials(patient) {
  return `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase()
}
