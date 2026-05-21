let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createCalendarEvent(data = {}) {
  const now = new Date().toISOString()
  return {
    id:          data.id          ?? uid(),
    doctorId:    data.doctorId    ?? '',
    title:       data.title       ?? '',
    date:        data.date        ?? '',
    allDay:      data.allDay      ?? true,
    startTime:   data.startTime   ?? '',
    endTime:     data.endTime     ?? '',
    description: data.description ?? '',
    createdAt:   data.createdAt   ?? now,
  }
}
