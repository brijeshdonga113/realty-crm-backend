/**
 * dataStore.js — Persistence abstraction layer
 *
 * Automatically uses Firestore when NEXT_PUBLIC_FIREBASE_* env vars are set,
 * otherwise falls back to localStorage for local development.
 *
 * Firestore structure:
 *   users/{doctorId}/{collection}/{docId}
 *   users/{doctorId}/patients/{patientId}/visits/{visitId}  ← nested subcollection
 *
 * API:
 *   dataStore.getAll(collPath)           — e.g. 'patients' or 'patients/abc/visits'
 *   dataStore.getAllGroup(collName)       — collectionGroup query (e.g. 'visits' across all patients)
 *   dataStore.getById(collPath, id)
 *   dataStore.getByIdGroup(collName, id) — find doc in any subcollection by id
 *   dataStore.create(collPath, record)
 *   dataStore.update(collPath, id, patch)
 *   dataStore.remove(collPath, id)
 *   dataStore.query(collPath, filterFn)
 *   dataStore.getMeta(key)
 *   dataStore.setMeta(key, value)
 */

import { isFirebaseConfigured, db, getCurrentDoctorId } from './firebase'

/* ─────────────────────────── Firestore helpers ─────────────────────────── */

function getCollectionRef(doctorId, collPath) {
  const {
    collection: fsCollection,
    doc: fsDoc,
  } = require('firebase/firestore')

  // collPath examples: 'patients', 'patients/abc123/visits'
  const parts = collPath.split('/')
  let ref = fsCollection(db, 'users', doctorId)

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      ref = fsCollection(ref, parts[i])
    } else {
      ref = fsDoc(ref, parts[i])
    }
  }
  return ref
}

const firestoreStore = {
  async getAll(collPath) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return []
    const { getDocs } = await import('firebase/firestore')
    const snap = await getDocs(getCollectionRef(doctorId, collPath))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getAllGroup(collName) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return []
    const { collectionGroup, query, where, getDocs } = await import('firebase/firestore')
    const q = query(
      collectionGroup(db, collName),
      where('doctorId', '==', doctorId)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const { doc, getDoc } = await import('firebase/firestore')
    const ref  = doc(getCollectionRef(doctorId, collPath), id)
    const snap = await getDoc(ref)
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async getByIdGroup(collName, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const { collectionGroup, query, where, limit, getDocs } = await import('firebase/firestore')
    const q = query(
      collectionGroup(db, collName),
      where('doctorId', '==', doctorId),
      where('id', '==', id),
      limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  },

  async create(collPath, record) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) throw new Error('Not authenticated')
    const { doc, setDoc } = await import('firebase/firestore')
    const now   = new Date().toISOString()
    const saved = { ...record, doctorId, createdAt: record.createdAt ?? now, updatedAt: now }
    const ref   = doc(getCollectionRef(doctorId, collPath), record.id)
    await setDoc(ref, saved)
    return saved
  },

  async update(collPath, id, patch) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const { doc, getDoc, updateDoc } = await import('firebase/firestore')
    const ref  = doc(getCollectionRef(doctorId, collPath), id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const updated = { ...snap.data(), ...patch, updatedAt: new Date().toISOString() }
    await updateDoc(ref, updated)
    return { id, ...updated }
  },

  async remove(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return false
    const { doc, deleteDoc } = await import('firebase/firestore')
    const ref = doc(getCollectionRef(doctorId, collPath), id)
    await deleteDoc(ref)
    return true
  },

  async query(collPath, filterFn) {
    const all = await this.getAll(collPath)
    return all.filter(filterFn)
  },

  async getMeta(key_) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const { doc, getDoc } = await import('firebase/firestore')
    const ref  = doc(db, 'users', doctorId, 'meta', key_)
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data().value : null
  },

  async setMeta(key_, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return
    const { doc, setDoc } = await import('firebase/firestore')
    const ref = doc(db, 'users', doctorId, 'meta', key_)
    await setDoc(ref, { value })
  },
}

/* ─────────────────────────── localStorage helpers ──────────────────────── */

const PREFIX = 'clinic_crm'

function lsKey(doctorId, collPath) {
  // 'patients/abc/visits' → 'clinic_crm_{doctorId}_patients_abc_visits'
  return `${PREFIX}_${doctorId}_${collPath.replace(/\//g, '_')}`
}

function lsRead(collPath) {
  const doctorId = getCurrentDoctorId()
  if (!doctorId) return []
  try {
    const raw = localStorage.getItem(lsKey(doctorId, collPath))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function lsWrite(collPath, records) {
  const doctorId = getCurrentDoctorId()
  if (!doctorId) throw new Error('Not authenticated')
  localStorage.setItem(lsKey(doctorId, collPath), JSON.stringify(records))
}

const localStore = {
  getAll(collPath) {
    return Promise.resolve(lsRead(collPath))
  },

  getAllGroup(collName) {
    // Scan all localStorage keys matching the pattern for this doctor
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return Promise.resolve([])
    const prefix  = `${PREFIX}_${doctorId}_`
    const suffix  = `_${collName}`
    const results = []
    const seen    = new Set()

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(prefix)) continue
        if (!k.endsWith(suffix) && !k.endsWith(`_${collName}`)) continue
        // Match exact suffix or nested suffix like _patients_abc_visits
        const segment = k.slice(prefix.length)
        if (segment === collName || segment.endsWith(`_${collName}`)) {
          try {
            const records = JSON.parse(localStorage.getItem(k) || '[]')
            records.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); results.push(r) } })
          } catch {}
        }
      }
    } catch {}

    return Promise.resolve(results)
  },

  getById(collPath, id) {
    const record = lsRead(collPath).find(r => r.id === id) ?? null
    return Promise.resolve(record)
  },

  getByIdGroup(collName, id) {
    return this.getAllGroup(collName).then(all => all.find(r => r.id === id) ?? null)
  },

  create(collPath, record) {
    const records = lsRead(collPath)
    const now     = new Date().toISOString()
    const saved   = { ...record, createdAt: record.createdAt ?? now, updatedAt: now }
    records.push(saved)
    lsWrite(collPath, records)
    return Promise.resolve(saved)
  },

  update(collPath, id, patch) {
    const records = lsRead(collPath)
    const idx     = records.findIndex(r => r.id === id)
    if (idx === -1) return Promise.resolve(null)
    records[idx] = { ...records[idx], ...patch, updatedAt: new Date().toISOString() }
    lsWrite(collPath, records)
    return Promise.resolve(records[idx])
  },

  remove(collPath, id) {
    const records = lsRead(collPath)
    lsWrite(collPath, records.filter(r => r.id !== id))
    return Promise.resolve(true)
  },

  query(collPath, filterFn) {
    return Promise.resolve(lsRead(collPath).filter(filterFn))
  },

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

/* ─────────────────────── Export the right implementation ─────────────────── */

export const dataStore = isFirebaseConfigured ? firestoreStore : localStore
