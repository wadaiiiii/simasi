import { getDriveToken } from './googleDrive.ts'

async function deleteDriveFile(token: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (response.ok || response.status === 404) return
  const detail = await response.text()
  throw new Error(`Gagal menghapus file Google Drive (${response.status}): ${detail.slice(0, 180)}`)
}

export async function deleteSeminarRegistration(admin: any, registrationId: string) {
  const regResult = await admin
    .from('pendaftaran_seminar')
    .select('id,user_id,nim,nama,prodi,jenis_ujian')
    .eq('id', registrationId)
    .maybeSingle()
  if (regResult.error) throw regResult.error
  if (!regResult.data) throw new Error('Pengajuan seminar tidak ditemukan.')

  const docsResult = await admin
    .from('berkas_seminar')
    .select('id,drive_file_id,nama_berkas')
    .eq('pendaftaran_id', registrationId)
  if (docsResult.error) throw docsResult.error

  const docs = docsResult.data || []
  const fileIds = [...new Set(docs.map((d: any) => String(d.drive_file_id || '').trim()).filter(Boolean))]
  if (fileIds.length) {
    const token = await getDriveToken()
    for (const fileId of fileIds) await deleteDriveFile(token, fileId)
  }

  const deleted = await admin.from('pendaftaran_seminar').delete().eq('id', registrationId)
  if (deleted.error) throw deleted.error

  return {
    registration: regResult.data,
    deleted_documents: docs.length,
    deleted_drive_files: fileIds.length
  }
}

export async function deleteUserSeminarRegistrations(admin: any, userId: string) {
  const registrations = await admin
    .from('pendaftaran_seminar')
    .select('id')
    .eq('user_id', userId)
  if (registrations.error) throw registrations.error

  let deletedDocuments = 0
  let deletedDriveFiles = 0
  for (const row of registrations.data || []) {
    const result = await deleteSeminarRegistration(admin, row.id)
    deletedDocuments += Number(result.deleted_documents || 0)
    deletedDriveFiles += Number(result.deleted_drive_files || 0)
  }

  return {
    deleted_registrations: registrations.data?.length || 0,
    deleted_documents: deletedDocuments,
    deleted_drive_files: deletedDriveFiles
  }
}
