/**
 * WhatsApp Cloud API client helper.
 * Sending happens server-side (app/api/whatsapp/send) so the doctor's access
 * token never reaches the browser — this just calls that route with the
 * caller's Firebase ID token.
 */

export function isWhatsAppApiConnected(doctor) {
  return !!(doctor?.whatsappApi?.accessToken && doctor?.whatsappApi?.phoneNumberId)
}

export async function sendWhatsAppMessage({ to, message }) {
  const { getAuth } = await import('firebase/auth')
  const token = await getAuth().currentUser?.getIdToken()
  if (!token) return { success: false, error: 'Not signed in.' }

  try {
    const res  = await fetch('/api/whatsapp/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ to, message }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data?.error || 'Failed to send message.' }
    return { success: true, messageId: data.messageId }
  } catch {
    return { success: false, error: 'Network error — could not reach the server.' }
  }
}
