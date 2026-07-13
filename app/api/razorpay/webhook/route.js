import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'

async function getFirestoreDb() {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getFirestore }                  = await import('firebase-admin/firestore')
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

function nextSubscription(current, event, subData) {
  if (event === 'subscription.charged') {
    const periodEnd = subData.current_end ? new Date(subData.current_end * 1000).toISOString() : null
    return { ...current, status: 'active', currentPeriodEnd: periodEnd, razorpaySubscriptionId: subData.id }
  }
  if (event === 'subscription.cancelled') return { ...current, status: 'cancelled' }
  if (event === 'subscription.completed') return { ...current, status: 'expired' }
  return null
}

export async function POST(request) {
  const body      = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  if (expected !== signature) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event   = JSON.parse(body)
  const subData = event.payload?.subscription?.entity
  if (!subData) return Response.json({ ok: true })

  const doctorId = subData.notes?.doctorId
  if (!doctorId) return Response.json({ ok: true })

  // doctorId's backend isn't recorded on the Razorpay subscription — check
  // both, same dual-lookup pattern as the public booking route.
  const db = await getFirestoreDb()
  const [fbSnap, sbRow] = await Promise.all([
    db.doc(`users/${doctorId}/profile/doctor`).get(),
    createAdminClient().from('doctors').select('subscription').eq('id', doctorId).maybeSingle().then(r => r.data).catch(() => null),
  ])

  if (sbRow) {
    const updated = nextSubscription(sbRow.subscription || {}, event.event, subData)
    if (updated) await createAdminClient().from('doctors').update({ subscription: updated }).eq('id', doctorId)
    return Response.json({ ok: true })
  }

  if (fbSnap.exists) {
    const updated = nextSubscription(fbSnap.data()?.subscription || {}, event.event, subData)
    if (updated) await db.doc(`users/${doctorId}/profile/doctor`).update({ subscription: updated })
  }

  return Response.json({ ok: true })
}
