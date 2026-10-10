import { verifyRequestUser } from '@/lib/whatsappCloud'
import { assignWhatsAppNumber, resolveCallerClinicId } from '@/lib/whatsappLeads'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const caller = await verifyRequestUser(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const doctorId = await resolveCallerClinicId(caller)
  const result = await assignWhatsAppNumber(doctorId, body?.phoneNumberId)
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ ok: true, doctorId })
}
