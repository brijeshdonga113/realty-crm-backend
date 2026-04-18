export async function POST(request) {
  const { plan, doctorId, doctorEmail, doctorName } = await request.json()

  if (!plan || !doctorId) {
    return Response.json({ error: 'Missing plan or doctorId' }, { status: 400 })
  }

  const planId = plan === 'yearly'
    ? process.env.RAZORPAY_YEARLY_PLAN_ID
    : process.env.RAZORPAY_MONTHLY_PLAN_ID

  if (!planId) {
    return Response.json({ error: 'Plan ID not configured' }, { status: 500 })
  }

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id:        planId,
      customer_notify: 1,
      total_count:    plan === 'yearly' ? 10 : 120,
      quantity:       1,
      notes: {
        doctorId,
        doctorEmail: doctorEmail || '',
        doctorName:  doctorName  || '',
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return Response.json({ error: data.error?.description || 'Failed to create subscription' }, { status: res.status })
  }

  return Response.json({ subscriptionId: data.id })
}
