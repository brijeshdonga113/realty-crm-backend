import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

// Saves a doctor's WhatsApp Cloud API credentials AND keeps a lookup index
// (whatsappPhoneIndex/{phoneNumberId} -> { doctorId }) in sync, so the webhook
// can resolve an incoming Meta event to the right doctor by phone number ID
// without a Firestore composite index / collectionGroup query.
async function resolveDoctorId(request, db) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }

  const doctorSnap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  if (doctorSnap.exists) return decoded.uid

  const receptionistSnap = await db.collection('receptionists').doc(decoded.uid).get()
  return receptionistSnap.data()?.doctorId ?? null
}

export async function POST(request) {
  const db = getAdminDb()
  const doctorId = await resolveDoctorId(request, db)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { accessToken, phoneNumberId, templateName, templateLanguage } = await request.json().catch(() => ({}))
  if (!accessToken?.trim() || !phoneNumberId?.trim()) {
    return Response.json({ error: 'accessToken and phoneNumberId are required.' }, { status: 400 })
  }

  const doctorRef = db.collection('users').doc(doctorId).collection('profile').doc('doctor')
  const existing  = (await doctorRef.get()).data()?.whatsappApi ?? {}

  // If the phone number changed, drop the old index entry so it doesn't keep
  // routing incoming messages for a number this doctor no longer owns.
  if (existing.phoneNumberId && existing.phoneNumberId !== phoneNumberId.trim()) {
    await db.collection('whatsappPhoneIndex').doc(existing.phoneNumberId).delete().catch(() => {})
  }

  await Promise.all([
    doctorRef.set({
      whatsappApi: {
        accessToken:      accessToken.trim(),
        phoneNumberId:    phoneNumberId.trim(),
        templateName:     (templateName ?? '').trim(),
        templateLanguage: (templateLanguage ?? '').trim() || 'en_US',
      },
    }, { merge: true }),
    db.collection('whatsappPhoneIndex').doc(phoneNumberId.trim()).set({ doctorId }),
  ])

  return Response.json({ ok: true })
}
