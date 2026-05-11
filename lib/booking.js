export const DEFAULT_WORKING_HOURS = {
  slotMinutes: 30,
  workDays: [1, 2, 3, 4, 5], // Mon–Fri
  session1: { start: '09:00', end: '13:00' },
  session2: { enabled: false, start: '17:00', end: '20:00' },
}

// Handles old {start, end} top-level format and new sessions format
export function normalizeWorkingHours(wh = {}) {
  const base = { ...DEFAULT_WORKING_HOURS, ...wh }
  if (!base.session1) {
    base.session1 = { start: wh.start ?? '09:00', end: wh.end ?? '17:00' }
    base.session2 = { enabled: false, start: '17:00', end: '20:00' }
  }
  return base
}

export function generateSlots(start, end, slotMinutes) {
  const slots = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em
  while (cur + slotMinutes <= endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0')
    const m = String(cur % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
    cur += slotMinutes
  }
  return slots
}

export function generateSlotsFromWorkingHours(wh) {
  const norm = normalizeWorkingHours(wh)
  const s1 = generateSlots(norm.session1.start, norm.session1.end, norm.slotMinutes)
  const s2 = norm.session2?.enabled
    ? generateSlots(norm.session2.start, norm.session2.end, norm.slotMinutes)
    : []
  return [...new Set([...s1, ...s2])].sort()
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayStr() {
  return toDateStr(new Date())
}
