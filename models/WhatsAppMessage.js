// A record of an outbound WhatsApp message sent via the Cloud API, for the
// per-doctor message log. Written server-side (app/api/whatsapp/send) right
// after the Graph API call, whether it succeeded or failed.
export function createWhatsAppMessage(data = {}) {
  const now = new Date().toISOString()
  return {
    doctorId:    data.doctorId ?? '',
    patientId:   data.patientId ?? null,
    patientName: data.patientName ?? '',
    to:          data.to ?? '',
    message:     data.message ?? '',
    type:        data.type ?? 'manual', // e.g. 'appointment_reminder', 'followup_reminder', 'test', 'manual'
    status:      data.status ?? 'sent', // 'sent' | 'failed'
    error:       data.error ?? null,
    messageId:   data.messageId ?? null, // Meta's returned WAMID, if sent
    createdAt:   data.createdAt ?? now,
  }
}
