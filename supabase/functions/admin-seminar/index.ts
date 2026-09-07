import { corsHeaders, getContext, json } from '../_shared/auth.ts'
import { deleteSeminarRegistration } from '../_shared/deleteSeminar.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { profile, admin } = await getContext(req)
    if (String(profile.role || '').toLowerCase() !== 'admin') {
      return json({ ok: false, message: 'Hanya admin yang dapat menghapus pengajuan seminar.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    if (action !== 'delete_registration') return json({ ok: false, message: 'Aksi tidak dikenali.' }, 400)

    const registrationId = String(body.registration_id || '').trim()
    if (!registrationId) return json({ ok: false, message: 'ID pengajuan tidak tersedia.' }, 400)

    const result = await deleteSeminarRegistration(admin, registrationId)
    return json({
      ok: true,
      ...result,
      message: 'Pengajuan beserta seluruh dokumen berhasil dihapus.'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
