// WhatsApp Cloud API webhook (Meta for Developers > WhatsApp > Configuration).
// GET handles Meta's one-time verification handshake; POST receives message/status events.

import { getAdminDb } from '@/lib/firebaseAdmin'
import { createWhatsAppMessage } from '@/models/WhatsAppMessage'

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

// Best-effort match of an incoming sender number to a known patient — compares
// digit suffixes so it's tolerant of country-code/formatting differences
// between what's stored on the patient record and what Meta sends as "from".
function matchPatient(patients, fromDigits) {
  return patients.find(p => {
    const pDigits = (p.phone ?? '').replace(/\D/g, '')
    if (!pDigits || !fromDigits) return false
    return fromDigits.endsWith(pDigits) || pDigits.endsWith(fromDigits)
  })
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  // Meta expects a fast 200 regardless of what we do with the event, so
  // swallow any processing error rather than making Meta retry forever.
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value
    const phoneNumberId    = value?.metadata?.phone_number_id
    const incomingMessages = value?.messages ?? []

    if (phoneNumberId && incomingMessages.length > 0) {
      const db = getAdminDb()
      const indexSnap = await db.collection('whatsappPhoneIndex').doc(phoneNumberId).get()
      const doctorId  = indexSnap.data()?.doctorId

      if (doctorId) {
        const patientsSnap = await db.collection('users').doc(doctorId).collection('patients').get()
        const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const logsRef  = db.collection('users').doc(doctorId).collection('whatsappMessages')

        for (const msg of incomingMessages) {
          const fromDigits = (msg.from ?? '').replace(/\D/g, '')
          const patient     = matchPatient(patients, fromDigits)
          const contactName = value.contacts?.[0]?.profile?.name || ''

          await logsRef.add(createWhatsAppMessage({
            doctorId,
            direction:    'inbound',
            contactPhone: msg.from,
            patientId:    patient?.id ?? null,
            patientName:  patient ? `${patient.firstName} ${patient.lastName}` : contactName,
            message:      msg.text?.body ?? `[${msg.type || 'unsupported'} message]`,
            type:         'incoming',
            status:       'received',
            messageId:    msg.id ?? null,
          }))
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp webhook processing error:', err)
  }

  return Response.json({ ok: true })
}
