import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const ADMIN_EMAIL = 'fmipa@unsulbar.ac.id'
const ADMIN_NAME = 'Administrator FMIPA Unsulbar'
const SITE_URL = 'https://simasimipa.vercel.app'
const headers = { 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return reply({ ok: false, message: 'Method not allowed' }, 405)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })

    const admins = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (admins.error) throw admins.error
    if ((admins.count || 0) > 0) return reply({ ok: false, message: 'Bootstrap sudah terkunci karena admin telah tersedia.' }, 409)

    const existing = await admin.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle()
    if (existing.error) throw existing.error
    let userId = existing.data?.id || null
    let created = false

    if (!userId) {
      const password = `A9!${crypto.randomUUID()}${crypto.randomUUID()}`
      const createdUser = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME },
        app_metadata: { simasi_account_type: 'admin' }
      })
      if (createdUser.error || !createdUser.data.user) throw createdUser.error || new Error('Akun admin gagal dibuat')
      userId = createdUser.data.user.id
      created = true
    }

    const profile = await admin.from('profiles').update({
      full_name: ADMIN_NAME,
      role: 'admin',
      must_change_password: true
    }).eq('id', userId)
    if (profile.error) throw profile.error

    const recovery = await publicClient.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: SITE_URL })
    if (recovery.error) throw recovery.error

    return reply({ ok: true, created, email_sent: true, message: 'Admin siap dan email pengaturan password telah dikirim.' })
  } catch (error) {
    return reply({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500)
  }
})
