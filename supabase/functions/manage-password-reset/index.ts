import { getContext, corsHeaders, json } from '../_shared/auth.ts'

const normalizeProdi = (value: unknown) => {
  const allowed = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
  const text = String(value ?? '').toLowerCase()
  return allowed.find((p) => text.includes(p.toLowerCase())) || ''
}

function createTemporaryPassword(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return `SIMASI@${String(value).padStart(6, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { user, profile, admin } = await getContext(req)
    const actorRole = String(profile.role || '').toLowerCase()
    if (!['admin', 'staff'].includes(actorRole)) {
      return json({ ok: false, message: 'Akses hanya untuk Admin atau Staff Akademik.' }, 403)
    }

    const actorProdi = actorRole === 'staff' ? normalizeProdi(profile.prodi) : ''
    if (actorRole === 'staff' && !actorProdi) {
      return json({ ok: false, message: 'Program Studi akun Staff belum ditetapkan.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'list')

    if (action === 'list') {
      let query = admin
        .from('password_reset_requests')
        .select('id,user_id,full_name,nim,email,role,prodi,status,requested_at,processed_at,processed_by')
        .order('requested_at', { ascending: false })
        .limit(200)

      if (actorRole === 'staff') {
        query = query.eq('role', 'mahasiswa')
      }

      const result = await query
      if (result.error) throw result.error

      const requests = actorRole === 'staff'
        ? (result.data || []).filter((row: any) => normalizeProdi(row?.prodi) === actorProdi)
        : (result.data || [])

      return json({ ok: true, requests })
    }

    if (action === 'process') {
      const requestId = String(body.request_id || '').trim()
      if (!requestId) return json({ ok: false, message: 'ID permintaan tidak tersedia.' }, 400)

      const requestResult = await admin
        .from('password_reset_requests')
        .select('id,user_id,full_name,nim,email,role,prodi,status')
        .eq('id', requestId)
        .maybeSingle()
      if (requestResult.error) throw requestResult.error
      const resetRequest = requestResult.data
      if (!resetRequest) return json({ ok: false, message: 'Permintaan reset tidak ditemukan.' }, 404)
      if (resetRequest.status !== 'menunggu') {
        return json({ ok: false, message: 'Permintaan ini sudah diproses atau sedang diproses.' }, 409)
      }

      const targetProfileResult = await admin
        .from('profiles')
        .select('id,email,full_name,nim,prodi,role')
        .eq('id', resetRequest.user_id)
        .maybeSingle()
      if (targetProfileResult.error) throw targetProfileResult.error
      const target = targetProfileResult.data
      if (!target) return json({ ok: false, message: 'Profil pengguna tidak ditemukan.' }, 404)

      const targetRole = String(target.role || '').toLowerCase()
      const targetProdi = normalizeProdi(target.prodi)

      if (actorRole === 'staff') {
        if (targetRole !== 'mahasiswa' || targetProdi !== actorProdi) {
          return json({ ok: false, message: 'Staff hanya dapat mereset password mahasiswa Program Studinya sendiri.' }, 403)
        }
      }

      if (targetRole === 'admin' && target.id === user.id) {
        return json({ ok: false, message: 'Admin tidak dapat memproses reset password akun sendiri.' }, 400)
      }

      const claimed = await admin
        .from('password_reset_requests')
        .update({ status: 'diproses', processed_by: user.id })
        .eq('id', requestId)
        .eq('status', 'menunggu')
        .select('id')
        .maybeSingle()
      if (claimed.error) throw claimed.error
      if (!claimed.data) return json({ ok: false, message: 'Permintaan sedang diproses oleh petugas lain.' }, 409)

      try {
        const temporaryPassword = targetRole === 'mahasiswa'
          ? String(target.nim || '').trim()
          : createTemporaryPassword()
        if (!temporaryPassword) throw new Error('NIM mahasiswa belum tersedia sehingga password tidak dapat direset.')

        const authUpdate = await admin.auth.admin.updateUserById(target.id, { password: temporaryPassword })
        if (authUpdate.error) throw authUpdate.error

        const profileUpdate = await admin
          .from('profiles')
          .update({ must_change_password: true })
          .eq('id', target.id)
        if (profileUpdate.error) throw profileUpdate.error

        const completed = await admin
          .from('password_reset_requests')
          .update({ status: 'selesai', processed_at: new Date().toISOString(), processed_by: user.id })
          .eq('id', requestId)
        if (completed.error) throw completed.error

        const username = targetRole === 'mahasiswa'
          ? String(target.nim || '')
          : String(target.email || '')

        return json({
          ok: true,
          request_id: requestId,
          user_id: target.id,
          full_name: target.full_name || resetRequest.full_name || null,
          username,
          nim: target.nim || null,
          email: target.email || null,
          role: targetRole,
          prodi: target.prodi || null,
          temporary_password: temporaryPassword,
          must_change_password: true,
          message: targetRole === 'mahasiswa'
            ? 'Password mahasiswa direset ke NIM dan wajib diganti setelah login.'
            : 'Password sementara baru dibuat dan wajib diganti setelah login.'
        })
      } catch (error) {
        await admin
          .from('password_reset_requests')
          .update({ status: 'menunggu', processed_by: null })
          .eq('id', requestId)
        throw error
      }
    }

    return json({ ok: false, message: 'Aksi tidak dikenali.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'Unauthorized' ? 401 : message === 'Profile not found' ? 403 : 500
    return json({ ok: false, message }, status)
  }
})
