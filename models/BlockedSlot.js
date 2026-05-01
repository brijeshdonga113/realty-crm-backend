let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createBlockedSlot(data = {}) {
  const now = new Date().toISOString()
  return {
    id:        data.id        ?? uid(),
    doctorId:  data.doctorId  ?? '',
    date:      data.date      ?? '',
    allDay:    data.allDay    ?? true,
    startTime: data.startTime ?? '',
    endTime:   data.endTime   ?? '',
    reason:    data.reason    ?? '',
    createdAt: data.createdAt ?? now,
  }
}
