import {
  getWhatsAppConfig,
  verifyWhatsAppSignature,
  parseWhatsAppWebhook,
  persistWhatsAppEvents,
} from '@/lib/whatsappCloud'

export const dynamic = 'force-dynamic'

/**
 * GET /api/whatsapp/webhook
 * Meta Cloud API verification handshake.
 * Returns hub.challenge as plain text when the verify token matches.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (!mode && !token && !challenge) {
    const cfg = getWhatsAppConfig()
    return Response.json({
      ok: true,
      service: 'whatsapp-webhook',
      verifyTokenSet: cfg.verifyTokenSet,
      hint: 'Meta verification uses hub.mode, hub.verify_token, and hub.challenge query params.',
    })
  }

  const { verifyToken, canVerify } = getWhatsAppConfig()
  if (!canVerify) {
    return new Response('WhatsApp verify token is not configured', { status: 503 })
  }
  if (mode === 'subscribe' && token === verifyToken && challenge != null) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response('Forbidden', { status: 403 })
}

/**
 * POST /api/whatsapp/webhook
 * Inbound messages and delivery status updates from Meta.
 */
export async function POST(request) {
  const raw = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const verified = verifyWhatsAppSignature(raw, signature)
  if (!verified.ok) {
    return Response.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let payload
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const events = parseWhatsAppWebhook(payload)
  if (!events.length) return Response.json({ ok: true, saved: 0 })

  try {
    const { saved } = await persistWhatsAppEvents(events)
    return Response.json({ ok: true, saved })
  } catch (err) {
    console.error('whatsapp webhook persist failed', err)
    return Response.json({ ok: true, saved: 0, persist: 'failed' })
  }
}
