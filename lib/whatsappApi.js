// WATI is configured server-side via WATI_API_ENDPOINT + WATI_API_TOKEN env vars.
// No per-doctor credentials needed.

export function isWhatsAppApiConnected() {
  // Always true — WATI is a shared service configured by the app owner.
  // The actual availability is checked server-side via env vars.
  return true
}

export async function sendWhatsAppMessage(_doctor, to, message) {
  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send WhatsApp message')
  return data
}
