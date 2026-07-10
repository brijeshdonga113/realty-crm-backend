import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

const GRAPH_VERSION = 'v21.0'

// Resolves the caller's Firebase ID token to the doctorId whose WhatsApp
// credentials should be used — either the doctor themselves, or a
// receptionist linked to that doctor (mirrors firestore.rules' isLinkedReceptionist).
async function resolveDoctorId(request, db) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }

  const doctorSnap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  if (doctorSnap.exists) return decoded.uid

  const receptionistSnap = await db.collection('receptionists').doc(decoded.uid).get()
  const receptionistData = receptionistSnap.data()
  return receptionistData?.doctorId ?? null
}

// Normalise a phone number to digits-only international format, using the
// doctor's saved country code (falls back to India, +91).
function normalisePhone(phone, countryCode) {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  const cc = (countryCode ?? '91').replace(/\D/g, '')
  return digits.length <= 10 ? `${cc}${digits}` : digits
}

export async function POST(request) {
  const db = getAdminDb()
  const doctorId = await resolveDoctorId(request, db)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, message } = await request.json().catch(() => ({}))
  if (!to?.trim() || !message?.trim()) {
    return Response.json({ error: 'to and message are required.' }, { status: 400 })
  }

  const doctorSnap = await db.collection('users').doc(doctorId).collection('profile').doc('doctor').get()
  const doctor = doctorSnap.data()
  const { accessToken, phoneNumberId } = doctor?.whatsappApi ?? {}
  if (!accessToken || !phoneNumberId) {
    return Response.json({ error: 'WhatsApp API is not connected. Add your access token and phone number ID in WhatsApp Templates settings.' }, { status: 400 })
  }

  const toNumber = normalisePhone(to, doctor?.waTemplates?.countryCode)
  if (!toNumber) return Response.json({ error: 'Invalid recipient phone number.' }, { status: 400 })

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:                 toNumber,
      type:               'text',
      text:               { body: message },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return Response.json({ error: data?.error?.message || 'WhatsApp API request failed.' }, { status: res.status })
  }

  return Response.json({ ok: true, messageId: data?.messages?.[0]?.id ?? null })
}
