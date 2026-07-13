import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Browser/client client — anon key + RLS. This is the one dataStoreSupabase.js
// and AuthContext.jsx use everywhere on the client, mirroring how the Firebase
// client SDK is used directly from the browser today.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Service-role client — bypasses RLS entirely. Must only ever be constructed
// inside server-only code (API routes), never imported into client-bundled
// files. Lazy factory (not a module-level singleton) so the service key is
// never evaluated unless a server route explicitly asks for it.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
