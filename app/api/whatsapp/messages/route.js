import {
  getWhatsAppConfig,
  listWhatsAppMessages,
  verifyRequestUser,
} from '@/lib/whatsappCloud'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const caller = await verifyRequestUser(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit')
  const cfg = getWhatsAppConfig()

  let messages = []
  let listError = null
  try {
    messages = await listWhatsAppMessages(limit)
  } catch (err) {
    console.error('whatsapp list failed', err)
    listError = 'Could not load messages. Check Firebase Admin credentials.'
  }

  return Response.json({
    messages,
    error: listError,
    config: {
      verifyTokenSet:   cfg.verifyTokenSet,
      appSecretSet:     cfg.appSecretSet,
      accessTokenSet:   cfg.accessTokenSet,
      phoneNumberIdSet: cfg.phoneNumberIdSet,
      graphVersion:     cfg.graphVersion,
      canVerify:        cfg.canVerify,
      canSend:          cfg.canSend,
      webhookPath:      '/api/whatsapp/webhook',
    },
  })
}
