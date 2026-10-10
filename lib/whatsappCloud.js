/**
 * WhatsApp Cloud API helpers (Meta Graph API).
 * Used by the test webhook + send endpoints. Existing wa.me click-to-chat
 * helpers in lib/whatsapp.js are unchanged.
 */
import crypto from 'crypto'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

export const WHATSAPP_MESSAGES_COL = 'whatsappMessages'
export const DEFAULT_GRAPH_VERSION = 'v21.0'

export function getWhatsAppConfig() {
  const verifyToken   = process.env.WHATSAPP_VERIFY_TOKEN || ''
  const appSecret     = process.env.WHATSAPP_APP_SECRET || ''
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN || ''
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  const graphVersion  = process.env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION

  return {
    verifyToken,
    appSecret,
    accessToken,
    phoneNumberId,
    graphVersion,
    verifyTokenSet:   Boolean(verifyToken),
    appSecretSet:     Boolean(appSecret),
    accessTokenSet:   Boolean(accessToken),
    phoneNumberIdSet: Boolean(phoneNumberId),
    canVerify: Boolean(verifyToken),
    canReceive: true,
    canSend: Boolean(accessToken && phoneNumberId),
  }
}

export function formatCloudPhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '').replace(/^0+/, '')
}

/**
 * Validate X-Hub-Signature-256. When WHATSAPP_APP_SECRET is unset,
 * signature checks are skipped so local curl tests still work.
 */
export function verifyWhatsAppSignature(rawBody, signatureHeader) {
  const { appSecret } = getWhatsAppConfig()
  if (!appSecret) return { ok: true, skipped: true }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, skipped: false }
  }
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')
  const received = signatureHeader.slice('sha256='.length)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  if (a.length !== b.length) return { ok: false, skipped: false }
  return { ok: crypto.timingSafeEqual(a, b), skipped: false }
}

function previewOf(message) {
  if (!message) return ''
  if (message.type === 'text') return message.text?.body || ''
  if (message.type === 'image') return message.image?.caption || '[image]'
  if (message.type === 'video') return message.video?.caption || '[video]'
  if (message.type === 'audio') return '[audio]'
  if (message.type === 'document') return message.document?.filename || '[document]'
  if (message.type === 'sticker') return '[sticker]'
  if (message.type === 'location') return '[location]'
  if (message.type === 'contacts') return '[contacts]'
  if (message.type === 'button') return message.button?.text || '[button]'
  if (message.type === 'interactive') {
    return message.interactive?.button_reply?.title
      || message.interactive?.list_reply?.title
      || '[interactive]'
  }
  return `[${message.type || 'unknown'}]`
}

/**
 * Flatten a Meta Cloud API webhook payload into inbox events.
 */
export function parseWhatsAppWebhook(payload) {
  if (!payload || typeof payload !== 'object') return []

  // Simplified local-test payload: { from, text }
  if (!payload.object && (payload.text || payload.from)) {
    const now = new Date().toISOString()
    const id = payload.id || `local_${Date.now()}`
    return [{
      id,
      kind: 'message',
      direction: payload.direction === 'out' ? 'out' : 'in',
      type: 'text',
      text: String(payload.text || ''),
      from: formatCloudPhone(payload.from || ''),
      to: formatCloudPhone(payload.to || ''),
      contactName: payload.contactName || '',
      timestamp: now,
      status: payload.direction === 'out' ? 'sent' : 'received',
      phoneNumberId: '',
      displayPhone: '',
      wamid: id,
    }]
  }

  if (payload.object !== 'whatsapp_business_account') return []
  const events = []

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      const metadata = value.metadata || {}
      const contacts = value.contacts || []
      const nameByWaId = Object.fromEntries(
        contacts.map(c => [c.wa_id, c.profile?.name || '']).filter(([id]) => id)
      )

      for (const message of value.messages || []) {
        events.push({
          id: message.id,
          kind: 'message',
          direction: 'in',
          type: message.type || 'unknown',
          text: previewOf(message),
          from: message.from || '',
          to: metadata.phone_number_id || '',
          contactName: nameByWaId[message.from] || '',
          timestamp: message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          status: 'received',
          phoneNumberId: metadata.phone_number_id || '',
          displayPhone: metadata.display_phone_number || '',
          wamid: message.id,
        })
      }

      for (const status of value.statuses || []) {
        events.push({
          id: status.id,
          kind: 'status',
          direction: 'out',
          type: 'status',
          text: '',
          from: metadata.display_phone_number || metadata.phone_number_id || '',
          to: status.recipient_id || '',
          contactName: '',
          timestamp: status.timestamp
            ? new Date(Number(status.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          status: status.status || 'unknown',
          error: status.errors?.[0]?.title || status.errors?.[0]?.message || '',
          phoneNumberId: metadata.phone_number_id || '',
          displayPhone: metadata.display_phone_number || '',
          wamid: status.id,
        })
      }
    }
  }

  return events
}

function canUseAdminDb() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID
    && process.env.FIREBASE_CLIENT_EMAIL
    && process.env.FIREBASE_PRIVATE_KEY
  )
}

const memoryMessages = []

function rememberMessage(doc) {
  const idx = memoryMessages.findIndex(m => m.id === doc.id)
  if (idx >= 0) memoryMessages[idx] = { ...memoryMessages[idx], ...doc }
  else memoryMessages.unshift(doc)
  if (memoryMessages.length > 200) memoryMessages.pop()
}

function persistEventsInMemory(events) {
  let saved = 0
  for (const event of events) {
    const id = event.wamid || event.id
    const existing = memoryMessages.find(m => m.id === id)
    if (event.kind === 'status' && existing) {
      rememberMessage({
        ...existing,
        status: event.status,
        statusAt: event.timestamp,
        error: event.error || '',
        updatedAt: new Date().toISOString(),
      })
      saved += 1
      continue
    }
    if (existing && event.kind === 'message') continue
    rememberMessage({
      ...event,
      id,
      createdAt: event.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    saved += 1
  }
  return { saved, persist: 'memory' }
}

export async function persistWhatsAppEvents(events) {
  if (!events.length) return { saved: 0 }
  if (!canUseAdminDb()) return persistEventsInMemory(events)

  const db = getAdminDb()
  const col = db.collection(WHATSAPP_MESSAGES_COL)
  let saved = 0

  for (const event of events) {
    const ref = col.doc(event.wamid || event.id)
    const snap = await ref.get()

    if (event.kind === 'status' && snap.exists) {
      await ref.update({
        status: event.status,
        statusAt: event.timestamp,
        error: event.error || '',
        updatedAt: FieldValue.serverTimestamp(),
      })
      saved += 1
      continue
    }

    if (snap.exists && event.kind === 'message') {
      continue
    }

    await ref.set({
      ...event,
      createdAt: event.timestamp || new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    saved += 1
  }

  return { saved, persist: 'firestore' }
}

export async function listWhatsAppMessages(limit = 50) {
  const take = Math.min(Number(limit) || 50, 200)
  if (!canUseAdminDb()) {
    return memoryMessages.slice(0, take)
  }

  const db = getAdminDb()
  const snap = await db.collection(WHATSAPP_MESSAGES_COL)
    .orderBy('createdAt', 'desc')
    .limit(take)
    .get()

  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
    }
  })
}

export async function sendWhatsAppText({ to, text }) {
  const { accessToken, phoneNumberId, graphVersion, canSend } = getWhatsAppConfig()
  const phone = formatCloudPhone(to)
  const body = String(text || '').trim()
  if (!canSend) {
    return { ok: false, status: 503, error: 'WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.' }
  }
  if (!phone) return { ok: false, status: 400, error: 'A destination phone number is required.' }
  if (!body) return { ok: false, status: 400, error: 'Message text is required.' }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = data?.error?.message || `Cloud API request failed (${res.status})`
    return { ok: false, status: res.status, error, raw: data }
  }

  const wamid = data?.messages?.[0]?.id || `out_${Date.now()}`
  const waId = data?.contacts?.[0]?.wa_id || phone
  const createdAt = new Date().toISOString()

  try {
    await persistWhatsAppEvents([{
      id: wamid,
      kind: 'message',
      direction: 'out',
      type: 'text',
      text: body,
      from: phoneNumberId,
      to: waId,
      contactName: '',
      timestamp: createdAt,
      status: 'sent',
      phoneNumberId,
      displayPhone: '',
      wamid,
    }])
  } catch (err) {
    console.error('whatsapp persist outbound failed', err)
  }

  return { ok: true, status: 200, wamid, to: waId }
}

export async function verifyRequestUser(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  try {
    const adminAuth = await getAdminAuth()
    return await adminAuth.verifyIdToken(idToken)
  } catch {
    return null
  }
}
