// WhatsApp Cloud API webhook (Meta for Developers > WhatsApp > Configuration).
// GET handles Meta's one-time verification handshake; POST receives message/status events.

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(request) {
  const body = await request.json().catch(() => null)

  // TODO: process incoming messages / delivery-status updates here.
  // Meta expects a fast 200 response regardless — do heavier work async
  // (e.g. write to a queue/Firestore) rather than inline in this handler.
  console.log('WhatsApp webhook event:', JSON.stringify(body))

  return Response.json({ ok: true })
}
