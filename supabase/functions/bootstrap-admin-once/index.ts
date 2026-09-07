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

    const existingAdmins = await admin.from('profiles').select('id,email').eq('role', 'admin')
    if (existingAdmins.error) throw new Error(`Cek admin gagal: ${existingAdmins.error.message}`)
    const foreignAdmin = (existingAdmins.data || []).find((row) => String(row.email || '').toLowerCase() !== ADMIN_EMAIL)
    if (foreignAdmin) return reply({ ok: false, message: 'Bootstrap dikunci karena sudah ada admin lain.' }, 409)

    const existing = await admin.from('profiles').select('id,email,role').eq('email', ADMIN_EMAIL).maybeSingle()
    if (existing.error) throw new Error(`Cek profil FMIPA gagal: ${existing.error.message}`)
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
      if (createdUser.error || !createdUser.data.user) throw new Error(`Buat akun admin gagal: ${createdUser.error?.message || 'unknown error'}`)
      userId = createdUser.data.user.id
      created = true
    }

    const profile = await admin.from('profiles').update({
      full_name: ADMIN_NAME,
      role: 'admin',
      must_change_password: true
    }).eq('id', userId)
    if (profile.error) throw new Error(`Promosi role admin gagal: ${profile.error.message}`)

    const recovery = await publicClient.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: SITE_URL })
    if (recovery.error) return reply({ ok: false, stage: 'recovery_email', admin_ready: true, message: recovery.error.message }, 500)

    return reply({ ok: true, created, admin_ready: true, email_sent: true, message: 'Admin siap dan email pengaturan password telah dikirim.' })
  } catch (error) {
    return reply({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500)
  }
})
