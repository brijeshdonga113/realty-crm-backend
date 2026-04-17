export function isWhatsAppApiConnected(doctor) {
  return !!(doctor?.whatsapp?.phoneNumberId && doctor?.whatsapp?.accessToken)
}

// Sends via WhatsApp Cloud API through our server-side route
export async function sendWhatsAppMessage(doctor, to, message) {
  const { phoneNumberId, accessToken } = doctor?.whatsapp || {}
  if (!phoneNumberId || !accessToken) throw new Error('WhatsApp Business API not configured in Settings.')

  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumberId, accessToken, to, message }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send WhatsApp message')
  return data
}
