import { auth } from './firebase'
import { supabase } from './supabase'

// Returns a Bearer token for the CURRENT session's backend — a Firebase ID
// token for FB accounts, a Supabase access token for SB accounts. Every API
// route that authenticates a doctor/receptionist request verifies via
// lib/serverAuth.js's verifyBearerToken(), which accepts either.
export async function getAuthToken(doctor) {
  if (doctor?.backend === 'SB') {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }
  return auth.currentUser?.getIdToken() ?? null
}
