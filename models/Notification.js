let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const NOTIFICATION_TYPES = {
  APPOINTMENT_NEW:       'appointment_new',
  APPOINTMENT_REMINDER:  'appointment_reminder',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  INVOICE_CREATED:       'invoice_created',
  INVOICE_PAID:          'invoice_paid',
  INVOICE_OVERDUE:       'invoice_overdue',
  PATIENT_NEW:           'patient_new',
  VISIT_COMPLETED:       'visit_completed',
  FOLLOW_UP_DUE:         'follow_up_due',
  SYSTEM:                'system',
}

const TYPE_META = {
  appointment_new:       { icon: '📅', color: 'blue' },
  appointment_reminder:  { icon: '⏰', color: 'yellow' },
  appointment_cancelled: { icon: '❌', color: 'red' },
  invoice_created:       { icon: '🧾', color: 'blue' },
  invoice_paid:          { icon: '✅', color: 'green' },
  invoice_overdue:       { icon: '⚠️', color: 'red' },
  patient_new:           { icon: '👤', color: 'teal' },
  visit_completed:       { icon: '🏥', color: 'green' },
  follow_up_due:         { icon: '📋', color: 'purple' },
  system:                { icon: 'ℹ️', color: 'gray' },
}

export function createNotification(data = {}) {
  const now = new Date().toISOString()
  return {
    id:      data.id ?? uid(),
    doctorId: data.doctorId ?? '',
    type:    data.type ?? 'system',
    title:   data.title ?? '',
    body:    data.body ?? '',
    relatedEntity: {
      type: data.relatedEntity?.type ?? null,
      id:   data.relatedEntity?.id ?? null,
    },
    read:      data.read ?? false,
    createdAt: data.createdAt ?? now,
  }
}

export function getNotificationMeta(type) {
  return TYPE_META[type] ?? TYPE_META.system
}
