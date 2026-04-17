export async function POST(request) {
  const { phoneNumberId, accessToken, to, message } = await request.json()

  if (!phoneNumberId || !accessToken || !to || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const phone = String(to).replace(/\D/g, '').replace(/^0+/, '')
  if (!phone) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    return Response.json(
      { error: data.error?.message || 'WhatsApp API error' },
      { status: res.status }
    )
  }

  return Response.json({ success: true, messageId: data.messages?.[0]?.id })
}
