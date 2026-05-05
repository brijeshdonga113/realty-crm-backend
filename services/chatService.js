import { db, auth } from '@/lib/firebase'
import {
  collection, doc, addDoc, updateDoc,
  query, orderBy, limit, startAfter, getDocs, onSnapshot,
} from 'firebase/firestore'

function getDoctorId() {
  try {
    const s = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    if (s?._role === 'receptionist' && s?.id) return s.id
  } catch {}
  return auth?.currentUser?.uid ?? null
}

function chatCol(doctorId) {
  return collection(db, 'users', doctorId, 'chat')
}

export const chatService = {
  // Real-time listener — latest `count` messages, returned oldest-first
  subscribeRecent(count, cb) {
    const doctorId = getDoctorId()
    if (!doctorId) return () => {}
    const q = query(chatCol(doctorId), orderBy('createdAt', 'desc'), limit(count))
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse())
    })
  },

  // One-shot fetch — `count` messages older than `beforeCreatedAt`, returned oldest-first
  async loadBefore(beforeCreatedAt, count) {
    const doctorId = getDoctorId()
    if (!doctorId) return []
    const q = query(
      chatCol(doctorId),
      orderBy('createdAt', 'desc'),
      startAfter(beforeCreatedAt),
      limit(count),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()
  },

  async send({ text, senderId, senderName, senderRole }) {
    const doctorId = getDoctorId()
    if (!doctorId) throw new Error('Not authenticated')
    const msg = {
      text: text.trim(),
      senderId,
      senderName,
      senderRole,
      doctorId,
      createdAt: new Date().toISOString(),
      readByDoctor:       senderRole === 'doctor',
      readByReceptionist: senderRole === 'receptionist',
    }
    const ref = await addDoc(chatCol(doctorId), msg)
    return { id: ref.id, ...msg }
  },

  async markRead(ids, role) {
    const doctorId = getDoctorId()
    if (!doctorId) return
    const field = role === 'doctor' ? 'readByDoctor' : 'readByReceptionist'
    await Promise.all(
      ids.map(id => updateDoc(doc(db, 'users', doctorId, 'chat', id), { [field]: true }))
    )
  },
}
