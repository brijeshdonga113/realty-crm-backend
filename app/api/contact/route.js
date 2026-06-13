import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

async function verifyAdmin(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  return snap.data()?.isAdmin ? decoded : null
}

// POST /api/contact — public, saves a contact lead
export async function POST(request) {
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, email, phone, type, message } = body
  if (!name?.trim() || !email?.trim()) {
    return Response.json({ error: 'Name and email are required.' }, { status: 400 })
  }

  const db = getAdminDb()
  await db.collection('contact_leads').add({
    name:      name.trim(),
    email:     email.trim(),
    phone:     phone?.trim() ?? '',
    type:      type ?? 'general',
    message:   message?.trim() ?? '',
    status:    'new',
    createdAt: FieldValue.serverTimestamp(),
  })

  return Response.json({ ok: true })
}

// GET /api/contact — admin only, list all leads
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db    = getAdminDb()
  const snaps = await db.collection('contact_leads').orderBy('createdAt', 'desc').get()
  const leads = snaps.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null }))
  return Response.json({ leads })
}

// PATCH /api/contact — admin only, update lead status
export async function PATCH(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await request.json()
  if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 })

  const db = getAdminDb()
  await db.collection('contact_leads').doc(id).update({ status })
  return Response.json({ ok: true })
}
