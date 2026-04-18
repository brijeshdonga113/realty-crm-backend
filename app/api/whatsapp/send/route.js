export async function POST(request) {
  const { to, message } = await request.json()

  if (!to || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const phone = String(to).replace(/\D/g, '').replace(/^0+/, '')
  if (!phone) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const endpoint = process.env.WATI_API_ENDPOINT
  const token    = process.env.WATI_API_TOKEN

  if (!endpoint || !token) {
    return Response.json({ error: 'WATI not configured on server' }, { status: 500 })
  }

  const res = await fetch(
    `${endpoint}/api/v1/sendSessionMessage/${phone}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageText: message }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    return Response.json(
      { error: data.errors?.[0] || data.message || 'WATI API error' },
      { status: res.status }
    )
  }

  return Response.json({ success: true })
}
