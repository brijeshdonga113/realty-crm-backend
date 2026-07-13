import { put, del } from '@vercel/blob'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { createAdminClient } from '@/lib/supabase'
import { verifyBearerToken } from '@/lib/serverAuth'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

// GET /api/upload-file?patientId=&doctorId=  — list documents
export async function GET(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const doctorId  = searchParams.get('doctorId')
  if (!patientId || !doctorId) return Response.json({ error: 'patientId and doctorId required' }, { status: 400 })
  if (caller.uid !== doctorId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (caller.backend === 'SB') {
    const { data: rows } = await createAdminClient().from('documents')
      .select('id, data, uploaded_at').eq('doctor_id', doctorId).eq('patient_id', patientId)
      .order('uploaded_at', { ascending: false })
    const documents = (rows ?? []).map(r => ({ ...r.data, id: r.id, uploadedAt: r.uploaded_at }))
    return Response.json({ documents })
  }

  const db   = getAdminDb()
  const snap = await db.collection('users').doc(doctorId)
                .collection('patients').doc(patientId)
                .collection('documents').orderBy('uploadedAt', 'desc').get()

  const documents = snap.docs.map(d => ({
    ...d.data(),
    id:         d.id,
    uploadedAt: d.data().uploadedAt?.toDate?.()?.toISOString() ?? null,
  }))
  return Response.json({ documents })
}

// POST /api/upload-file  — upload a patient document
export async function POST(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: 'Storage not configured' }, { status: 500 })
  }

  let formData
  try { formData = await request.formData() } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file      = formData.get('file')
  const patientId = formData.get('patientId')
  const doctorId  = formData.get('doctorId')

  if (!file || !patientId || !doctorId) {
    return Response.json({ error: 'file, patientId and doctorId are required' }, { status: 400 })
  }
  if (caller.uid !== doctorId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: 'File type not allowed. Accepted: PDF, images, Word, Excel, text.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File must be under 20 MB.' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path     = `patient-files/${doctorId}/${patientId}/${Date.now()}_${safeName}`
  const blob     = await put(path, file, { access: 'public', addRandomSuffix: false })

  const docData = { name: file.name, url: blob.url, size: file.size, type: file.type }

  if (caller.backend === 'SB') {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const uploadedAt = new Date().toISOString()
    await createAdminClient().from('documents').insert({
      doctor_id: doctorId, id, patient_id: patientId, data: docData, uploaded_at: uploadedAt,
    })
    return Response.json({ document: { ...docData, id, uploadedAt } })
  }

  const db   = getAdminDb()
  const ref  = db.collection('users').doc(doctorId)
               .collection('patients').doc(patientId)
               .collection('documents').doc()

  const doc = { id: ref.id, ...docData, uploadedAt: FieldValue.serverTimestamp() }
  await ref.set(doc)

  return Response.json({ document: { ...doc, id: ref.id, uploadedAt: new Date().toISOString() } })
}

// DELETE /api/upload-file  — remove a patient document
export async function DELETE(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { doctorId, patientId, docId, url } = await request.json()
  if (!doctorId || !patientId || !docId || !url) {
    return Response.json({ error: 'doctorId, patientId, docId and url required' }, { status: 400 })
  }
  if (caller.uid !== doctorId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (caller.backend === 'SB') {
    await Promise.all([
      del(url).catch(() => {}),
      createAdminClient().from('documents').delete().eq('doctor_id', doctorId).eq('id', docId),
    ])
    return Response.json({ ok: true })
  }

  await Promise.all([
    del(url).catch(() => {}),
    getAdminDb()
      .collection('users').doc(doctorId)
      .collection('patients').doc(patientId)
      .collection('documents').doc(docId)
      .delete(),
  ])

  return Response.json({ ok: true })
}
