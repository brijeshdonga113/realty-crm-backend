let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// A lightweight, one-line update logged in between full visits (e.g. a phone
// check-in or a quick observation) — distinct from a VisitRecord, which
// captures a full clinical encounter.
export function createProgressNote(data = {}) {
  const now = new Date().toISOString()
  return {
    id:          data.id ?? uid(),
    doctorId:    data.doctorId ?? '',
    patientId:   data.patientId ?? '',
    patientName: data.patientName ?? '',
    noteDate:    data.noteDate ?? now.slice(0, 10),
    note:        data.note ?? '',
    createdAt:   data.createdAt ?? now,
    updatedAt:   now,
  }
}
