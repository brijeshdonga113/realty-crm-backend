let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const APPOINTMENT_TYPES = [
  { value: 'consultation',  label: 'Consultation' },
  { value: 'follow_up',     label: 'Follow-up' },
  { value: 'procedure',     label: 'Procedure' },
  { value: 'emergency',     label: 'Emergency' },
  { value: 'checkup',       label: 'Checkup' },
  { value: 'vaccination',   label: 'Vaccination' },
]

export const APPOINTMENT_STATUSES = [
  { value: 'scheduled',  label: 'Scheduled',  color: 'blue' },
  { value: 'confirmed',  label: 'Confirmed',  color: 'green' },
  { value: 'completed',  label: 'Completed',  color: 'gray' },
  { value: 'cancelled',  label: 'Cancelled',  color: 'red' },
  { value: 'no_show',    label: 'No Show',    color: 'yellow' },
]

export function createAppointment(data = {}) {
  const now = new Date().toISOString()
  return {
    id:              data.id ?? uid(),
    doctorId:        data.doctorId ?? '',
    patientId:       data.patientId ?? '',
    patientName:     data.patientName ?? '',   // denormalized
    patientPhone:    data.patientPhone ?? '',  // denormalized for quick WhatsApp access
    date:            data.date ?? '',           // YYYY-MM-DD
    time:            data.time ?? '',           // HH:MM
    durationMinutes: data.durationMinutes ?? 30,
    type:            data.type ?? 'consultation',
    reason:          data.reason ?? '',
    status:          data.status ?? 'scheduled',
    notes:           data.notes ?? '',
    visitRecordId:   data.visitRecordId ?? null,
    createdAt:       data.createdAt ?? now,
    updatedAt:       now,
  }
}

export function getAppointmentStatusMeta(status) {
  return APPOINTMENT_STATUSES.find(s => s.value === status) ?? APPOINTMENT_STATUSES[0]
}

export function getAppointmentDateTime(appt) {
  if (!appt.date || !appt.time) return null
  return new Date(`${appt.date}T${appt.time}`)
}

export function isToday(appt) {
  const today = new Date().toISOString().slice(0, 10)
  return appt.date === today
}
