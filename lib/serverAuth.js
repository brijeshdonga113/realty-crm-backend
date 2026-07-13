import { getAdminAuth } from './firebaseAdmin'
import { createAdminClient } from './supabase'

// Verifies a Bearer token from either backend — the caller could be a Firebase
// ID token or a Supabase access token, and there's no header telling us which.
// Firebase's verifyIdToken rejects a non-Firebase JWT immediately (different
// signing key/issuer), so trying it first and falling back to Supabase is a
// clean, cheap way to support both without the client declaring its backend.
// Returns { uid, backend } or null.
export async function verifyBearerToken(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null

  try {
    const adminAuth = await getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(idToken)
    return { uid: decoded.uid, backend: 'FB' }
  } catch {}

  try {
    const { data, error } = await createAdminClient().auth.getUser(idToken)
    if (error || !data.user) return null
    return { uid: data.user.id, backend: 'SB' }
  } catch {
    return null
  }
}
