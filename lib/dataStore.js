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

// Active branch override — set when a doctor switches to another branch in their org
let _activeBranchUid = null

export function setActiveBranchUid(uid) {
  _activeBranchUid = uid ?? null
}

export function getActiveBranchUid() {
  return _activeBranchUid
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

export const dataStore = {
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
