let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createFollowUp(data = {}) {
  const now = new Date().toISOString()
  return {
    id:          data.id ?? uid(),
    doctorId:    data.doctorId ?? '',
    patientId:   data.patientId ?? '',
    patientName: data.patientName ?? '',
    dueDate:     data.dueDate ?? '',        // YYYY-MM-DD
    note:        data.note ?? '',
    status:      data.status ?? 'pending',  // 'pending' | 'done'
    notificationId: data.notificationId ?? null,
    createdAt:   data.createdAt ?? now,
    updatedAt:   now,
  }
}
