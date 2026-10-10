/**
 * Turn inbound Cloud API messages into clinic CRM leads and conversation threads.
 * Leads live at users/{doctorId}/leads. Threads live at
 * users/{doctorId}/whatsappThreads/{phoneKey}/messages/{wamid}.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { canUseAdminDb, formatCloudPhone } from '@/lib/whatsappCloud'

export function phoneKey(phone) {
  const digits = formatCloudPhone(phone)
  if (!digits) return ''
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function displayWhatsAppName(event) {
  const name = String(event?.contactName || '').trim()
  if (name) return name
  const phone = formatCloudPhone(event?.from || event?.to || '')
  return phone ? `WhatsApp ${phone}` : 'WhatsApp lead'
}

const memoryLeads = []
const memoryThreads = new Map()

function memoryThreadKey(doctorId, key) {
  return `${doctorId}:${key}`
}

export async function resolveClinicDoctorId({ phoneNumberId, fallbackUid } = {}) {
  if (canUseAdminDb() && phoneNumberId) {
    try {
      const db = getAdminDb()
      const mapped = await db.collection('whatsappNumbers').doc(String(phoneNumberId)).get()
      if (mapped.exists && mapped.data()?.doctorId) return mapped.data().doctorId
    } catch (err) {
      console.warn('whatsapp number map lookup failed', err?.message)
    }
  }
  if (process.env.WHATSAPP_DEFAULT_DOCTOR_ID) return process.env.WHATSAPP_DEFAULT_DOCTOR_ID
  return fallbackUid || null
}

export async function resolveCallerClinicId(decoded) {
  if (!decoded?.uid) return null
  if (!canUseAdminDb()) return decoded.uid
  try {
    const db = getAdminDb()
    const rec = await db.collection('receptionists').doc(decoded.uid).get()
    if (rec.exists && rec.data()?.doctorId) return rec.data().doctorId
  } catch (err) {
    console.warn('whatsapp caller clinic lookup failed', err?.message)
  }
  return decoded.uid
}

function upsertMemoryLead(doctorId, event) {
  const key = phoneKey(event.from)
  if (!key) return { skipped: 'no-phone' }
  const mapKey = memoryThreadKey(doctorId, key)
  const existingThread = memoryThreads.get(mapKey)
  if (existingThread?.messages.some(m => m.id === (event.wamid || event.id))) {
    return { id: existingThread.leadId, created: false, phone: existingThread.phone, duplicate: true }
  }
  const now = event.timestamp || new Date().toISOString()
  const existing = memoryLeads.find(l => l.doctorId === doctorId && l.phoneKey === key && l.status !== 'converted')
  const preview = event.text || `[${event.type || 'message'}]`
  if (existing) {
    existing.lastMessage = preview
    existing.lastMessageAt = now
    existing.note = preview
    existing.unreadCount = (existing.unreadCount || 0) + 1
    existing.updatedAt = now
    if (event.contactName && existing.name.startsWith('WhatsApp ')) existing.name = event.contactName
    upsertMemoryThread(doctorId, existing, event)
    return { id: existing.id, created: false, phone: existing.phone }
  }
  const lead = {
    id: `lead-wa-${key}`,
    doctorId,
    name: displayWhatsAppName(event),
    phone: formatCloudPhone(event.from),
    phoneKey: key,
    email: '',
    source: 'whatsapp',
    note: preview,
    status: 'new',
    lastMessage: preview,
    lastMessageAt: now,
    unreadCount: 1,
    waThreadId: key,
    createdAt: now,
    updatedAt: now,
  }
  memoryLeads.unshift(lead)
  upsertMemoryThread(doctorId, lead, event)
  return { id: lead.id, created: true, phone: lead.phone }
}

function upsertMemoryThread(doctorId, lead, event) {
  const mapKey = memoryThreadKey(doctorId, lead.phoneKey)
  const existing = memoryThreads.get(mapKey) || {
    id: lead.phoneKey,
    doctorId,
    waId: formatCloudPhone(event.from),
    phone: lead.phone,
    name: lead.name,
    leadId: lead.id,
    messages: [],
  }
  if (!existing.messages.some(m => m.id === (event.wamid || event.id))) {
    existing.messages.push({
      id: event.wamid || event.id,
      ...event,
      createdAt: event.timestamp || new Date().toISOString(),
    })
  }
  existing.lastMessage = event.text || existing.lastMessage
  existing.lastMessageAt = event.timestamp || new Date().toISOString()
  existing.lastDirection = event.direction
  existing.unreadCount = event.direction === 'in' ? (existing.unreadCount || 0) + (event.kind === 'status' ? 0 : 1) : 0
  existing.name = lead.name
  existing.leadId = lead.id
  memoryThreads.set(mapKey, existing)
}

async function findOpenLeadByPhone(db, doctorId, key) {
  const col = db.collection('users').doc(doctorId).collection('leads')
  const snap = await col.where('phoneKey', '==', key).limit(10).get()
  const open = snap.docs.find(d => d.data().status !== 'converted')
  return open || null
}

async function upsertFirestoreLead(doctorId, event) {
  const key = phoneKey(event.from)
  if (!key) return { skipped: 'no-phone' }
  const db = getAdminDb()
  const now = event.timestamp || new Date().toISOString()
  const preview = event.text || `[${event.type || 'message'}]`
  const phone = formatCloudPhone(event.from)
  const leadsCol = db.collection('users').doc(doctorId).collection('leads')
  const threadRef = db.collection('users').doc(doctorId).collection('whatsappThreads').doc(key)
  const msgRef = threadRef.collection('messages').doc(event.wamid || event.id)
  const msgSnap = await msgRef.get()
  if (msgSnap.exists) {
    const existingLead = await findOpenLeadByPhone(db, doctorId, key)
    return { id: existingLead?.id || `lead-wa-${key}`, created: false, phone, duplicate: true }
  }

  const existing = await findOpenLeadByPhone(db, doctorId, key)

  let leadId
  let created = false
  if (existing) {
    leadId = existing.id
    const prev = existing.data()
    const name = prev.name && !String(prev.name).startsWith('WhatsApp ')
      ? prev.name
      : (event.contactName || prev.name || displayWhatsAppName(event))
    await existing.ref.update({
      name,
      phone: prev.phone || phone,
      phoneKey: key,
      source: prev.source || 'whatsapp',
      note: preview,
      lastMessage: preview,
      lastMessageAt: now,
      unreadCount: (prev.unreadCount || 0) + 1,
      waThreadId: key,
      updatedAt: now,
    })
  } else {
    leadId = `lead-wa-${key}`
    created = true
    await leadsCol.doc(leadId).set({
      id: leadId,
      doctorId,
      name: displayWhatsAppName(event),
      phone,
      phoneKey: key,
      email: '',
      source: 'whatsapp',
      note: preview,
      status: 'new',
      lastMessage: preview,
      lastMessageAt: now,
      unreadCount: 1,
      waThreadId: key,
      createdAt: now,
      updatedAt: now,
    }, { merge: true })
  }

  await threadRef.set({
    id: key,
    doctorId,
    waId: phone,
    phone,
    name: displayWhatsAppName(event),
    leadId,
    lastMessage: preview,
    lastMessageAt: now,
    lastDirection: 'in',
    unreadCount: FieldValue.increment(1),
    updatedAt: now,
  }, { merge: true })

  await msgRef.set({
    id: event.wamid || event.id,
    doctorId,
    kind: event.kind,
    direction: event.direction,
    type: event.type,
    text: event.text || '',
    from: event.from || '',
    to: event.to || '',
    status: event.status || 'received',
    wamid: event.wamid || event.id,
    createdAt: now,
    timestamp: now,
  }, { merge: true })

  return { id: leadId, created, phone }
}

export async function ingestWhatsAppLeads(events) {
  const inbound = (events || []).filter(e => e.kind === 'message' && e.direction === 'in' && e.from)
  const results = []
  for (const event of inbound) {
    const doctorId = await resolveClinicDoctorId({ phoneNumberId: event.phoneNumberId })
    if (!doctorId) {
      results.push({ skipped: 'no-clinic', phone: formatCloudPhone(event.from) })
      continue
    }
    try {
      const result = canUseAdminDb()
        ? await upsertFirestoreLead(doctorId, event)
        : upsertMemoryLead(doctorId, event)
      results.push({ doctorId, ...result })
    } catch (err) {
      console.error('whatsapp lead ingest failed', err)
      results.push({ skipped: 'error', phone: formatCloudPhone(event.from) })
    }
  }
  return results
}

export async function recordWhatsAppOutbound(doctorId, event) {
  const key = phoneKey(event.to)
  if (!doctorId || !key) return { skipped: 'no-phone' }
  const now = event.timestamp || new Date().toISOString()
  const preview = event.text || `[${event.type || 'message'}]`
  const phone = formatCloudPhone(event.to)

  if (!canUseAdminDb()) {
    const existing = memoryLeads.find(l => l.doctorId === doctorId && l.phoneKey === key)
    if (existing) {
      existing.lastMessage = preview
      existing.lastMessageAt = now
      existing.unreadCount = 0
      existing.updatedAt = now
      upsertMemoryThread(doctorId, existing, { ...event, from: event.to })
    }
    return { ok: true, persist: 'memory' }
  }

  const db = getAdminDb()
  const threadRef = db.collection('users').doc(doctorId).collection('whatsappThreads').doc(key)
  await threadRef.set({
    id: key,
    doctorId,
    waId: phone,
    phone,
    lastMessage: preview,
    lastMessageAt: now,
    lastDirection: 'out',
    unreadCount: 0,
    updatedAt: now,
  }, { merge: true })
  await threadRef.collection('messages').doc(event.wamid || event.id).set({
    id: event.wamid || event.id,
    doctorId,
    kind: 'message',
    direction: 'out',
    type: event.type || 'text',
    text: preview,
    from: event.from || '',
    to: phone,
    status: event.status || 'sent',
    wamid: event.wamid || event.id,
    createdAt: now,
    timestamp: now,
  }, { merge: true })

  const open = await findOpenLeadByPhone(db, doctorId, key)
  if (open) {
    await open.ref.update({
      lastMessage: preview,
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: now,
    })
  }
  return { ok: true, persist: 'firestore' }
}

export function listMemoryLeads(doctorId) {
  return memoryLeads.filter(l => !doctorId || l.doctorId === doctorId)
}

export async function assignWhatsAppNumber(doctorId, phoneNumberId) {
  const id = String(phoneNumberId || '').trim()
  if (!doctorId || !id) return { ok: false, error: 'doctorId and phoneNumberId are required.' }
  if (!canUseAdminDb()) return { ok: true, persist: 'skipped' }
  const db = getAdminDb()
  await db.collection('whatsappNumbers').doc(id).set({
    doctorId,
    phoneNumberId: id,
    updatedAt: new Date().toISOString(),
  })
  await db.collection('users').doc(doctorId).collection('profile').doc('doctor').set({
    waPhoneNumberId: id,
  }, { merge: true })
  return { ok: true }
}

