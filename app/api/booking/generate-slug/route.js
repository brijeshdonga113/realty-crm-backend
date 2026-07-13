import { getAdminDb } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'
import { verifyBearerToken } from '@/lib/serverAuth'

function generateSlug() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST /api/booking/generate-slug
// Called from Settings when the doctor doesn't have a booking slug yet.
// Uses the Admin SDK / service-role client so it bypasses security rules/RLS
// on the reverse-mapping table — no rule changes needed.
export async function POST(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const doctorId = caller.uid
  const slug     = generateSlug()

  try {
    if (caller.backend === 'SB') {
      const supabaseAdmin = createAdminClient()
      await Promise.all([
        supabaseAdmin.from('booking_slugs').insert({ slug, doctor_id: doctorId, created_at: new Date().toISOString() }),
        supabaseAdmin.from('doctors').update({ booking_slug: slug }).eq('id', doctorId),
      ])
      return Response.json({ slug })
    }

    const db = getAdminDb()
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
