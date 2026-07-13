/**
 * dataStoreSupabase.js — Supabase (Postgres) persistence layer
 *
 * Implements the exact same method surface as lib/dataStore.js's Firestore
 * implementation, so lib/dataStore.js can dispatch to either one and every
 * service in services/*.js stays completely unchanged.
 *
 * Postgres structure: one table per Firestore collection, each row scoped by
 * a real `doctor_id` column (+ `patient_id` for the two former subcollections,
 * visits/progress_notes). All non-indexed fields live in a `data jsonb`
 * column — see supabase/schema.sql for the full schema and RLS policies.
 */

import { supabase } from './supabase'

// camelCase Firestore collection names that don't match their snake_case
// Postgres table name 1:1. Everything else maps to itself.
const TABLE_NAME = {
  blockedSlots:   'blocked_slots',
  calendarEvents: 'calendar_events',
  progressNotes:  'progress_notes',
}

function tableFor(name) {
  return TABLE_NAME[name] ?? name
}

// Turns a dataStore collPath into a Postgres table + optional patient scope.
// 'patients'                    -> { table: 'patients' }
// 'patients/abc123/visits'      -> { table: 'visits', patientId: 'abc123' }
// 'patients/abc123/progressNotes' -> { table: 'progress_notes', patientId: 'abc123' }
function parsePath(collPath) {
  const parts = collPath.split('/')
  if (parts.length === 1) return { table: tableFor(parts[0]) }
  const [, patientId, subcollection] = parts
  return { table: tableFor(subcollection), patientId }
}

function rowToRecord(row) {
  return { id: row.id, ...row.data }
}

// Mirrors getCurrentDoctorId() in dataStore.js — same localStorage session
// shape is shared across both backends, only the "own session" fallback
// differs (Supabase auth session instead of Firebase's auth.currentUser).
// Supabase's session read is async, so a module-level cache kept current via
// onAuthStateChange is required for this to behave synchronously, the same
// way Firebase Auth's SDK warms up auth.currentUser internally before
// onAuthStateChanged first fires.
let _session = null

if (typeof window !== 'undefined' && supabase) {
  supabase.auth.getSession().then(({ data }) => { _session = data.session })
  supabase.auth.onAuthStateChange((_event, session) => { _session = session })
}

function getCurrentDoctorId() {
  try {
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    if (session?._role === 'receptionist' && session?.id) return session.id
  } catch {}
  return _session?.user?.id ?? null
}

const EQUALITY_OPS = { '==': 'eq', '!=': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' }

function matchesOp(op) {
  return {
    '==': (a, b) => a === b,
    '!=': (a, b) => a !== b,
    '<':  (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>':  (a, b) => a > b,
    '>=': (a, b) => a >= b,
  }[op] ?? ((a, b) => a === b)
}

// Every subscribe* variant re-runs `buildQuery` in full on any relevant
// Postgres change, rather than incrementally patching individual row events.
// Realtime's per-channel filter only supports one equality condition on a
// real column, so the channel is scoped broadly (doctor_id) and buildQuery
// does the precise filtering — same approach used for the {limit} case,
// which has no server-side "re-rank top-N" equivalent to diff against.
function watchAndRefetch(table, doctorId, buildQuery, callback) {
  if (!supabase) return () => {}
  let cancelled = false

  const emit = async () => {
    if (cancelled) return
    const { data, error } = await buildQuery()
    if (error) { console.error(`[dataStoreSupabase] refetch failed for ${table}`, error); return }
    callback((data ?? []).map(rowToRecord))
  }

  const channel = supabase
    .channel(`${table}:${doctorId}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter: `doctor_id=eq.${doctorId}` }, emit)
    .subscribe()

  emit()
  return () => { cancelled = true; supabase.removeChannel(channel) }
}

export const dataStoreSupabase = {
  async getAll(collPath) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return []
    const { table, patientId } = parsePath(collPath)
    let q = supabase.from(table).select('*').eq('doctor_id', doctorId)
    if (patientId) q = q.eq('patient_id', patientId)
    const { data, error } = await q
    if (error) { console.error(`[dataStoreSupabase.getAll] ${table}`, error); return [] }
    return data.map(rowToRecord)
  },

  async getAllGroup(collName) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return []
    const table = tableFor(collName)
    const { data, error } = await supabase.from(table).select('*').eq('doctor_id', doctorId)
    if (error) { console.error(`[dataStoreSupabase.getAllGroup] ${table}`, error); return [] }
    return data.map(rowToRecord)
  },

  async getById(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return null
    const { table, patientId } = parsePath(collPath)
    let q = supabase.from(table).select('*').eq('doctor_id', doctorId).eq('id', id)
    if (patientId) q = q.eq('patient_id', patientId)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return null
    return rowToRecord(data)
  },

  async getByIdGroup(collName, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return null
    const table = tableFor(collName)
    const { data, error } = await supabase.from(table).select('*').eq('doctor_id', doctorId).eq('id', id).maybeSingle()
    if (error || !data) return null
    return rowToRecord(data)
  },

  async create(collPath, record) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) throw new Error('Not authenticated')
    const { table, patientId } = parsePath(collPath)
    const now   = new Date().toISOString()
    const { id, ...rest } = record
    const saved = { ...rest, doctorId, createdAt: record.createdAt ?? now, updatedAt: now }
    const row = {
      doctor_id:  doctorId,
      id,
      ...(patientId ? { patient_id: patientId } : {}),
      data:       saved,
      created_at: saved.createdAt,
      updated_at: saved.updatedAt,
    }
    const { error } = await supabase.from(table).insert(row)
    if (error) throw error
    return { id, ...saved }
  },

  async update(collPath, id, patch) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return null
    const { table } = parsePath(collPath)
    const { data: existing, error: selErr } = await supabase
      .from(table).select('data').eq('doctor_id', doctorId).eq('id', id).maybeSingle()
    if (selErr || !existing) return null
    const now    = new Date().toISOString()
    const merged = { ...existing.data, ...patch, updatedAt: now }
    const { error: updErr } = await supabase
      .from(table).update({ data: merged, updated_at: now }).eq('doctor_id', doctorId).eq('id', id)
    if (updErr) { console.error(`[dataStoreSupabase.update] ${table}`, updErr); return null }
    return { id, ...merged }
  },

  async remove(collPath, id) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return false
    const { table } = parsePath(collPath)
    const { error } = await supabase.from(table).delete().eq('doctor_id', doctorId).eq('id', id)
    return !error
  },

  async query(collPath, filterFn) {
    const all = await this.getAll(collPath)
    return all.filter(filterFn)
  },

  async getWhere(collPath, field, op, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return []
    const { table, patientId } = parsePath(collPath)
    let q = supabase.from(table).select('*').eq('doctor_id', doctorId)
    if (patientId) q = q.eq('patient_id', patientId)
    q = q.filter(`data->>${field}`, EQUALITY_OPS[op] ?? 'eq', value)
    const { data, error } = await q
    if (error) { console.error(`[dataStoreSupabase.getWhere] ${table}`, error); return [] }
    return data.map(rowToRecord)
  },

  subscribeWhere(collPath, field, op, value, callback) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return () => {}
    const { table, patientId } = parsePath(collPath)
    const match = matchesOp(op)
    return watchAndRefetch(table, doctorId, () => {
      let q = supabase.from(table).select('*').eq('doctor_id', doctorId)
      if (patientId) q = q.eq('patient_id', patientId)
      return q
    }, records => callback(records.filter(r => match(r[field], value))))
  },

  async getMeta(key_) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return null
    const { data, error } = await supabase
      .from('meta').select('value').eq('doctor_id', doctorId).eq('key', key_).maybeSingle()
    if (error || !data) return null
    return data.value
  },

  async setMeta(key_, value) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return
    await supabase.from('meta').upsert({ doctor_id: doctorId, key: key_, value })
  },

  // options.limit — same contract as dataStore.js: cap to the N most recent
  // rows by created_at. Re-fetched in full on every relevant change (see
  // watchAndRefetch) since Realtime has no server-side top-N re-ranking.
  subscribe(collPath, callback, options = {}) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return () => {}
    const { table, patientId } = parsePath(collPath)
    return watchAndRefetch(table, doctorId, () => {
      let q = supabase.from(table).select('*').eq('doctor_id', doctorId)
      if (patientId) q = q.eq('patient_id', patientId)
      if (options.limit) q = q.order('created_at', { ascending: false }).limit(options.limit)
      return q
    }, callback)
  },

  subscribeGroup(collName, callback) {
    const doctorId = getCurrentDoctorId()
    if (!doctorId || !supabase) return () => {}
    const table = tableFor(collName)
    return watchAndRefetch(table, doctorId, () =>
      supabase.from(table).select('*').eq('doctor_id', doctorId), callback)
  },
}
