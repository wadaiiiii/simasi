import { corsHeaders, getContext, json } from '../_shared/auth.ts'
import { getDriveToken } from '../_shared/googleDrive.ts'

const safeName = (value: string) => value.replace(/[\r\n"\\/]+/g, ' ').trim().slice(0, 120) || 'berkas-seminar.pdf'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { user, profile, admin } = await getContext(req)
    const body = await req.json().catch(() => ({}))
    const documentId = String(body.document_id || '').trim()
    if (!documentId) return json({ ok: false, message: 'ID berkas tidak tersedia.' }, 400)

    const { data: doc, error } = await admin
      .from('berkas_seminar')
      .select('id,nama_berkas,storage_provider,drive_file_id,pendaftaran_seminar!inner(user_id,prodi)')
      .eq('id', documentId)
      .maybeSingle()

    if (error) throw error
    if (!doc) return json({ ok: false, message: 'Berkas tidak ditemukan.' }, 404)

    const registration = (doc as any).pendaftaran_seminar
    const reg = Array.isArray(registration) ? registration[0] : registration
    const ownerId = reg?.user_id
    const registrationProdi = String(reg?.prodi || '').trim().toLowerCase()
    const role = String(profile.role || '').trim().toLowerCase()
    const profileProdi = String(profile.prodi || '').trim().toLowerCase()
    const canManage = role === 'admin' || (role === 'dosen' && Boolean(profileProdi) && profileProdi === registrationProdi)

    if (ownerId !== user.id && !canManage) {
      return json({ ok: false, message: 'Akses ditolak. Staf hanya dapat membuka berkas mahasiswa pada program studinya.' }, 403)
    }
    if (doc.storage_provider !== 'google_drive' || !doc.drive_file_id) {
      return json({ ok: false, message: 'Preview hanya tersedia untuk berkas Google Drive.' }, 409)
    }

    const token = await getDriveToken()
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.drive_file_id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Google Drive preview gagal (${response.status}): ${detail.slice(0, 180)}`)
    }

    const filename = safeName(String(doc.nama_berkas || 'berkas-seminar.pdf'))
    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename.endsWith('.pdf') ? filename : `${filename}.pdf`}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
