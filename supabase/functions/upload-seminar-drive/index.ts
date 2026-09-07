import { corsHeaders, getContext, json } from '../_shared/auth.ts'
import { findOrCreateFolder, getDriveToken, uploadFile, verifyFolderAccess } from '../_shared/googleDrive.ts'

const ROOT_FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || '19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv'
const MAX_FILE_BYTES = 2 * 1024 * 1024
const PDF_TYPE = 'application/pdf'
const ALLOWED_EXAMS = ['Seminar Proposal', 'Seminar Hasil']
const ALLOWED_UPLOAD_STATUSES = ['diajukan', 'perbaikan', 'gagal_upload']
const clean = (v: string) => v.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { user, profile, admin } = await getContext(req)
    if (profile.must_change_password) {
      return json({ ok: false, message: 'Ganti password awal sebelum mengunggah berkas.' }, 403)
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ ok: false, message: 'File tidak ditemukan.' }, 400)
    if (file.size > MAX_FILE_BYTES) return json({ ok: false, message: 'Ukuran file maksimal 2 MB.' }, 400)
    if (file.type !== PDF_TYPE && !file.name.toLowerCase().endsWith('.pdf')) {
      return json({ ok: false, message: 'Format file harus PDF.' }, 400)
    }

    const nim = String(form.get('nim') || '').trim().toUpperCase()
    const nama = String(form.get('nama') || '').trim()
    const prodi = String(form.get('prodi') || '').trim()
    const examType = String(form.get('exam_type') || '').trim()
    const registrationId = String(form.get('registration_id') || '').trim()
    const documentKey = String(form.get('document_key') || 'dokumen').trim()
    const documentLabel = String(form.get('document_label') || documentKey).trim()
    const persistMetadata = String(form.get('persist_metadata') || '').toLowerCase() === 'true'

    if (!registrationId) return json({ ok: false, message: 'ID pendaftaran tidak tersedia.' }, 400)
    if (!nim || !nama || !prodi || !ALLOWED_EXAMS.includes(examType)) {
      return json({ ok: false, message: 'Data pendaftaran tidak lengkap atau jenis seminar tidak valid.' }, 400)
    }
    if (profile.role === 'mahasiswa' && String(profile.nim || '').toUpperCase() !== nim) {
      return json({ ok: false, message: 'NIM tidak sesuai dengan akun login.' }, 403)
    }

    const { data: registration, error: regError } = await admin
      .from('pendaftaran_seminar')
      .select('id,user_id,nim,nama,prodi,jenis_ujian,status')
      .eq('id', registrationId)
      .maybeSingle()

    if (regError) throw regError
    if (!registration) return json({ ok: false, message: 'Pendaftaran seminar tidak ditemukan.' }, 404)

    if (profile.role === 'mahasiswa' && registration.user_id !== user.id) {
      return json({ ok: false, message: 'Pendaftaran ini bukan milik akun Anda.' }, 403)
    }
    if (String(registration.nim || '').toUpperCase() !== nim || registration.prodi !== prodi || registration.jenis_ujian !== examType) {
      return json({ ok: false, message: 'Data upload tidak sesuai dengan data pendaftaran.' }, 409)
    }
    if (!ALLOWED_UPLOAD_STATUSES.includes(String(registration.status || ''))) {
      return json({ ok: false, message: 'Berkas pada pendaftaran ini tidak dapat diubah pada status saat ini.' }, 409)
    }

    const token = await getDriveToken()
    await verifyFolderAccess(token, ROOT_FOLDER_ID)

    const prodiFolder = await findOrCreateFolder(token, clean(prodi), ROOT_FOLDER_ID)
    const studentFolder = await findOrCreateFolder(token, clean(`${nim} - ${nama}`), prodiFolder)
    const examFolder = await findOrCreateFolder(token, examType, studentFolder)
    const submissionFolder = await findOrCreateFolder(
      token,
      `${new Date().toISOString().slice(0, 10)}_${registrationId.slice(0, 8)}`,
      examFolder
    )

    const finalName = `${clean(`${documentKey}_${documentLabel}`)}.pdf`
    const uploaded = await uploadFile(token, submissionFolder, file, finalName)
    const webViewLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`

    if (persistMetadata) {
      const { error: persistError } = await admin
        .from('berkas_seminar')
        .upsert({
          pendaftaran_id: registrationId,
          jenis_berkas: documentKey,
          nama_berkas: documentLabel,
          file_url: webViewLink,
          file_path: `drive:${uploaded.id}`,
          status: 'terunggah',
          storage_provider: 'google_drive',
          drive_file_id: uploaded.id,
          drive_folder_id: submissionFolder,
          catatan_verifikator: null,
          verified_at: null,
          verified_by: null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'pendaftaran_id,jenis_berkas' })

      if (persistError) throw persistError

      // Saat mahasiswa memperbaiki beberapa berkas, pendaftaran kembali ke antrean
      // setelah tidak ada lagi item berstatus perbaikan.
      if (registration.status === 'perbaikan') {
        const { count, error: countError } = await admin
          .from('berkas_seminar')
          .select('id', { count: 'exact', head: true })
          .eq('pendaftaran_id', registrationId)
          .eq('status', 'perbaikan')
        if (countError) throw countError
        if ((count || 0) === 0) {
          const { error: parentError } = await admin
            .from('pendaftaran_seminar')
            .update({
              status: 'diajukan',
              revision_submitted_at: new Date().toISOString()
            })
            .eq('id', registrationId)
          if (parentError) throw parentError
        }
      }
    }

    return json({
      ok: true,
      storage_provider: 'google_drive',
      file_id: uploaded.id,
      file_name: uploaded.name,
      web_view_link: webViewLink,
      folder_id: submissionFolder,
      root_folder_id: ROOT_FOLDER_ID,
      metadata_persisted: persistMetadata
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
