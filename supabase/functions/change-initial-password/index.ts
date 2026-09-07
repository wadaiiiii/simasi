import { corsHeaders, getContext, json } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)
  try {
    const { user, profile, admin } = await getContext(req)
    const body = await req.json()
    const password = String(body.new_password ?? '')
    if (password.length < 8) return json({ ok: false, message: 'Password baru minimal 8 karakter.' }, 400)
    if (profile.nim && password.toUpperCase() === String(profile.nim).toUpperCase()) return json({ ok: false, message: 'Password baru tidak boleh sama dengan NIM.' }, 400)
    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password })
    if (passwordError) throw passwordError
    const { error: profileError } = await admin.from('profiles').update({ must_change_password: false }).eq('id', user.id)
    if (profileError) throw profileError
    return json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
