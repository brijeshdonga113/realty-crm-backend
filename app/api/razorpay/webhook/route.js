import crypto from 'crypto'

export async function POST(request) {
  const body      = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  // Verify webhook signature
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

  const db      = getFirestore()
  const docRef  = db.doc(`users/${doctorId}/profile/doctor`)
  const snap    = await docRef.get()
  const current = snap.data()?.subscription || {}

  if (event.event === 'subscription.charged') {
    const periodEnd = subData.current_end
      ? new Date(subData.current_end * 1000).toISOString()
      : null

    await docRef.update({
      subscription: {
        ...current,
        status:           'active',
        currentPeriodEnd: periodEnd,
        razorpaySubscriptionId: subData.id,
      },
    })
  }

  if (event.event === 'subscription.cancelled') {
    await docRef.update({
      subscription: { ...current, status: 'cancelled' },
    })
  }

  if (event.event === 'subscription.completed') {
    await docRef.update({
      subscription: { ...current, status: 'expired' },
    })
  }

  return Response.json({ ok: true })
}
