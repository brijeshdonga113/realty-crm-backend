import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

function generateSlug() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST /api/booking/generate-slug
// Called from Settings when the doctor doesn't have a booking slug yet.
// Uses Firebase Admin so it bypasses Firestore security rules — no rule changes needed.
export async function POST(request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const idToken    = authHeader.replace('Bearer ', '').trim()
  if (!idToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const adminAuth = await getAdminAuth()
    const decoded   = await adminAuth.verifyIdToken(idToken)
    const doctorId  = decoded.uid

    const db   = getAdminDb()
    const slug = generateSlug()

    // Write reverse mapping and update doctor profile in parallel
    await Promise.all([
      db.collection('bookingSlugs').doc(slug).set({
        doctorId,
        createdAt: new Date().toISOString(),
      }),
      db.collection('users').doc(doctorId)
        .collection('profile').doc('doctor')
        .set({ bookingSlug: slug }, { merge: true }),
    ])

    return Response.json({ slug })
  } catch (err) {
    console.error('generate-slug error:', err)
    return Response.json({ error: 'Failed to generate booking link' }, { status: 500 })
  }
}
