// A record of a WhatsApp message (sent by us, or received from a patient) via
// the Cloud API, for the per-doctor conversation log. Outbound records are
// written by app/api/whatsapp/send right after the Graph API call; inbound
// records are written by app/api/whatsapp/webhook when Meta delivers an event.
export function createWhatsAppMessage(data = {}) {
  const now = new Date().toISOString()
  return {
    doctorId:     data.doctorId ?? '',
    direction:    data.direction ?? 'outbound',   // 'outbound' | 'inbound'
    contactPhone: data.contactPhone ?? data.to ?? '', // the other party's number — threads a conversation together
    patientId:    data.patientId ?? null,
    patientName:  data.patientName ?? '',
    to:           data.to ?? '',
    message:      data.message ?? '',
    type:         data.type ?? 'manual', // 'appointment_reminder' | 'followup_reminder' | 'test' | 'manual' | 'incoming'
    status:       data.status ?? 'sent', // 'sent' | 'failed' | 'received'
    error:        data.error ?? null,
    messageId:    data.messageId ?? null, // Meta's WAMID
    createdAt:    data.createdAt ?? now,
  }
}
