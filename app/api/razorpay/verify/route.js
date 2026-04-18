import crypto from 'crypto'

export async function POST(request) {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan, doctorId } = await request.json()

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !doctorId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex')

  if (expected !== razorpay_signature) {
    return Response.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // Fetch subscription details from Razorpay to get period end
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${razorpay_subscription_id}`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const subData = await subRes.json()

  const currentPeriodEnd = subData.current_end
    ? new Date(subData.current_end * 1000).toISOString()
    : null

  // Update Firestore
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

  const db = getFirestore()
  await db.doc(`users/${doctorId}/profile/doctor`).update({
    subscription: {
      status:                 'active',
      plan:                   plan || 'monthly',
      trialEndsAt:            null,
      currentPeriodEnd,
      razorpaySubscriptionId: razorpay_subscription_id,
    },
  })

  return Response.json({ success: true })
}
