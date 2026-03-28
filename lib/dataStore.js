/**
 * dataStore.js — Persistence abstraction layer
 *
 * All services use this API exclusively — never localStorage directly.
 * Firebase migration = only this file changes.
 *
 * API:
 *   dataStore.getAll(collection)
 *   dataStore.getById(collection, id)
 *   dataStore.create(collection, record)
 *   dataStore.update(collection, id, patch)
 *   dataStore.remove(collection, id)
 *   dataStore.query(collection, filterFn)
 */

const PREFIX = 'clinic_crm'

function getCurrentDoctorId() {
  try {
    const raw = localStorage.getItem('clinic_crm_doctor')
    return raw ? JSON.parse(raw).id : null
  } catch {
    return null
  }
}

function key(doctorId, collection) {
  return `${PREFIX}_${doctorId}_${collection}`
}

function read(collection) {
  const doctorId = getCurrentDoctorId()
  if (!doctorId) return []
  try {
    const raw = localStorage.getItem(key(doctorId, collection))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(collection, records) {
  const doctorId = getCurrentDoctorId()
  if (!doctorId) throw new Error('Not authenticated')
  localStorage.setItem(key(doctorId, collection), JSON.stringify(records))
}

export const dataStore = {
  getAll(collection) {
    return Promise.resolve(read(collection))
  },

  getById(collection, id) {
    const record = read(collection).find(r => r.id === id) ?? null
    return Promise.resolve(record)
  },

  create(collection, record) {
    const records = read(collection)
    const now = new Date().toISOString()
    const saved = { ...record, createdAt: record.createdAt ?? now, updatedAt: now }
    records.push(saved)
    write(collection, records)
    return Promise.resolve(saved)
  },

  update(collection, id, patch) {
    const records = read(collection)
    const idx = records.findIndex(r => r.id === id)
    if (idx === -1) return Promise.resolve(null)
    records[idx] = { ...records[idx], ...patch, updatedAt: new Date().toISOString() }
    write(collection, records)
    return Promise.resolve(records[idx])
  },

  remove(collection, id) {
    const records = read(collection)
    const next = records.filter(r => r.id !== id)
    write(collection, next)
    return Promise.resolve(true)
  },

  query(collection, filterFn) {
    return Promise.resolve(read(collection).filter(filterFn))
  },

  /** Read/write a single JSON value (used for counters, settings) */
  getMeta(key_) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return Promise.resolve(null)
    try {
      const raw = localStorage.getItem(`${PREFIX}_${doctorId}_meta_${key_}`)
      return Promise.resolve(raw ? JSON.parse(raw) : null)
    } catch {
      return Promise.resolve(null)
    }
  },

  setMeta(key_, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return Promise.resolve()
    localStorage.setItem(`${PREFIX}_${doctorId}_meta_${key_}`, JSON.stringify(value))
    return Promise.resolve()
  },
}
