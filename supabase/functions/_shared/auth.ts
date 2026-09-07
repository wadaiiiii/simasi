import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

function readNamedKey(jsonName: string, legacyName: string): string {
  const json = Deno.env.get(jsonName)
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (typeof first === 'string') return first
    } catch (_) {}
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Missing ${jsonName}/${legacyName}`)
  return legacy
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export async function getContext(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Missing SUPABASE_URL')
  const publishable = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const secret = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw new Error('Unauthorized')

  const scoped = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const { data, error } = await scoped.auth.getUser()
  if (error || !data.user) throw new Error('Unauthorized')
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,full_name,nim,prodi,role,must_change_password')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profileError || !profile) throw new Error('Profile not found')
  return { user: data.user, profile, scoped, admin }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
