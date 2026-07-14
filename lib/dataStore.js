/**
 * dataStore.js — Firestore persistence layer
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

import { db, auth } from './firebase'
import { dataStoreSupabase } from './dataStoreSupabase'
import {
  collection as fsCollection,
  doc as fsDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'

// Active branch override — set when a doctor switches to another branch in their org.
// FB (Firebase) accounts only — branch-switching for SB accounts is deferred, see plan.
let _activeBranchUid = null

export function setActiveBranchUid(uid) {
  _activeBranchUid = uid ?? null
}

export function getActiveBranchUid() {
  return _activeBranchUid
}

// Which backend the current account uses. Missing/legacy sessions (every
// account created before this field existed) default to FB — the hard
// requirement is zero behavior change for existing Firebase clinics. Only
// accounts explicitly created with backend:'SB' route to Supabase.
function getCurrentBackend() {
  try {
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    return session?.backend === 'SB' ? 'SB' : 'FB'
  } catch {
    return 'FB'
  }
}

function getCurrentDoctorId() {
  if (_activeBranchUid) return _activeBranchUid
  try {
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    if (session?._role === 'receptionist' && session?.id) return session.id
  } catch {}
  return auth?.currentUser?.uid ?? null
}

function getCollectionRef(doctorId, collPath) {
  const parts = collPath.split('/')
  let ref = fsDoc(db, 'users', doctorId)
  for (let i = 0; i < parts.length; i++) {
    ref = i % 2 === 0 ? fsCollection(ref, parts[i]) : fsDoc(ref, parts[i])
  }
  return ref
}

const dataStoreFirebase = {
  async getAll(collPath) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return []
    const snap = await getDocs(getCollectionRef(doctorId, collPath))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getAllGroup(collName) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return []
    const q = query(collectionGroup(db, collName), where('doctorId', '==', doctorId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async getById(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const ref  = fsDoc(getCollectionRef(doctorId, collPath), id)
    const snap = await getDoc(ref)
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  },

  async getByIdGroup(collName, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
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
    const now   = new Date().toISOString()
    const saved = { ...record, doctorId, createdAt: record.createdAt ?? now, updatedAt: now }
    const ref   = fsDoc(getCollectionRef(doctorId, collPath), record.id)
    await setDoc(ref, saved)
    return saved
  },

  async update(collPath, id, patch) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const ref  = fsDoc(getCollectionRef(doctorId, collPath), id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const updated = { ...snap.data(), ...patch, updatedAt: new Date().toISOString() }
    await updateDoc(ref, updated)
    return { id, ...updated }
  },

  async remove(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return false
    const ref = fsDoc(getCollectionRef(doctorId, collPath), id)
    await deleteDoc(ref)
    return true
  },

  async query(collPath, filterFn) {
    const all = await this.getAll(collPath)
    return all.filter(filterFn)
  },

  // Server-side equality filter — use instead of query()/subscribe() + a JS
  // predicate whenever the filter is a single field equality check (e.g.
  // patientId === x). query() fetches the *entire* collection and filters in
  // JS, which bills for every document every time; these only read matches.
  async getWhere(collPath, field, op, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return []
    const q    = query(getCollectionRef(doctorId, collPath), where(field, op, value))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  subscribeWhere(collPath, field, op, value, callback) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return () => {}
    const q = query(getCollectionRef(doctorId, collPath), where(field, op, value))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  },

  async getMeta(key_) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return null
    const ref  = fsDoc(db, 'users', doctorId, 'meta', key_)
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data().value : null
  },

  async setMeta(key_, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return
    const ref = fsDoc(db, 'users', doctorId, 'meta', key_)
    await setDoc(ref, { value })
  },

  // options.limit — cap to the N most recent docs (by createdAt) instead of
  // streaming the entire collection on every write. Use for collections that
  // grow unbounded over a clinic's lifetime (e.g. notifications) so a single
  // write doesn't re-sort/re-render the full history on every snapshot.
  subscribe(collPath, callback, options = {}) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return () => {}
    const ref = options.limit
      ? query(getCollectionRef(doctorId, collPath), orderBy('createdAt', 'desc'), limit(options.limit))
      : getCollectionRef(doctorId, collPath)
    return onSnapshot(ref, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  },

  subscribeGroup(collName, callback) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId) return () => {}
    const q = query(collectionGroup(db, collName), where('doctorId', '==', doctorId))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  },
}

// ── In-memory read cache ─────────────────────────────────────────────────────
// Caches one-time reads (getAll/getById/getWhere/getAllGroup/getByIdGroup) for
// a short TTL and invalidates on any write to the same collection — cuts
// redundant reads (e.g. revisiting Dashboard within the same session) without
// ever risking stale data after a write. Deliberately excludes subscribe()/
// subscribeWhere()/subscribeGroup(): a live listener already only updates
// when something actually changes, so caching adds nothing there and would
// only add complexity. Backend-agnostic by design — lives at the dispatcher
// layer, above both implementations, so it benefits FB and SB equally.
const READ_METHODS  = new Set(['getAll', 'getById', 'getWhere', 'getAllGroup', 'getByIdGroup'])
const WRITE_METHODS = new Set(['create', 'update', 'remove'])
const CACHE_TTL_MS  = 30000

const _cache = new Map() // key -> { data, expiresAt, scope }

// The doctorId a cache entry belongs to — same resolution used for FB/SB/
// receptionist sessions alike (session.id is always the owning doctor's id
// regardless of role or backend), plus the FB-only branch-switch override.
function resolveCacheDoctorId() {
  if (_activeBranchUid) return _activeBranchUid
  try {
    return JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')?.id ?? null
  } catch {
    return null
  }
}

// Collapses a collPath/collName to its collection scope so a write to
// 'patients/abc/visits' correctly invalidates a cached getAllGroup('visits')
// too, not just exact-path matches.
function scopeOf(collPathOrName) {
  const parts = collPathOrName.split('/')
  return parts[parts.length - 1]
}

function cacheKey(backend, doctorId, method, args) {
  return `${backend}|${doctorId}|${method}|${JSON.stringify(args)}`
}

function invalidateScope(backend, doctorId, collPath) {
  const prefix = `${backend}|${doctorId}|`
  const scope  = scopeOf(collPath)
  for (const [key, entry] of _cache) {
    if (key.startsWith(prefix) && entry.scope === scope) _cache.delete(key)
  }
}

// Exposed for logout — avoids any lingering cached data surviving into a
// different account signing in on the same tab (harmless either way, since
// entries are keyed by doctorId, but cheap to be explicit about).
export function clearDataStoreCache() {
  _cache.clear()
}

// Dispatcher — every method picks the Firebase or Supabase implementation
// based on the current account's backend. This is the only place backend
// choice is resolved; every service in services/*.js keeps calling
// dataStore.X(...) exactly as before, unaware which backend is behind it.
const METHODS = [
  'getAll', 'getAllGroup', 'getById', 'getByIdGroup', 'create', 'update', 'remove',
  'query', 'getWhere', 'subscribeWhere', 'getMeta', 'setMeta', 'subscribe', 'subscribeGroup',
]

export const dataStore = Object.fromEntries(
  METHODS.map(method => [
    method,
    (...args) => {
      const backend = getCurrentBackend()
      const impl    = backend === 'SB' ? dataStoreSupabase : dataStoreFirebase

      if (READ_METHODS.has(method)) {
        const doctorId = resolveCacheDoctorId()
        const key      = cacheKey(backend, doctorId, method, args)
        const cached   = _cache.get(key)
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data)
        return impl[method](...args).then(data => {
          _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS, scope: scopeOf(args[0]) })
          return data
        })
      }

      if (WRITE_METHODS.has(method)) {
        return impl[method](...args).then(result => {
          invalidateScope(backend, resolveCacheDoctorId(), args[0])
          return result
        })
      }

      return impl[method](...args)
    },
  ])
)
