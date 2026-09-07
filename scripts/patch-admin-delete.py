from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]}')
    p.write_text(text.replace(old, new, 1))

# Backend account deletion
replace_once(
    'supabase/functions/admin-users/index.ts',
    "import { corsHeaders, getContext, json } from '../_shared/auth.ts'\n",
    "import { corsHeaders, getContext, json } from '../_shared/auth.ts'\nimport { deleteUserSeminarRegistrations } from '../_shared/deleteSeminar.ts'\n"
)

marker = "    if (action === 'reset_password') {\n"
block = """    if (action === 'delete_user') {
      const userId = String(body.user_id || '').trim()
      if (!userId) return json({ ok: false, message: 'ID user tidak tersedia.' }, 400)
      if (userId === user.id) return json({ ok: false, message: 'Admin tidak dapat menghapus akun yang sedang digunakan.' }, 400)

      const targetResult = await admin.from('profiles').select('id,email,full_name,nim,prodi,role').eq('id', userId).maybeSingle()
      if (targetResult.error) throw targetResult.error
      const target = targetResult.data
      if (!target) return json({ ok: false, message: 'Profil user tidak ditemukan.' }, 404)

      const authTarget = await admin.auth.admin.getUserById(userId)
      if (authTarget.error || !authTarget.data.user) return json({ ok: false, message: 'Akun Auth tidak ditemukan.' }, 404)

      if (String(target.role || '').toLowerCase() === 'admin') {
        const admins = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
        if (admins.error) throw admins.error
        if ((admins.count || 0) <= 1) return json({ ok: false, message: 'Admin terakhir tidak dapat dihapus.' }, 400)
      }

      const cleanup = await deleteUserSeminarRegistrations(admin, userId)
      const removed = await admin.auth.admin.deleteUser(userId)
      if (removed.error) throw removed.error

      return json({
        ok: true,
        user_id: userId,
        full_name: target.full_name || authTarget.data.user.user_metadata?.full_name || null,
        email: target.email || authTarget.data.user.email || null,
        ...cleanup,
        message: 'Akun berhasil dihapus. Data master mahasiswa tetap dipertahankan.'
      })
    }

"""
replace_once('supabase/functions/admin-users/index.ts', marker, block + marker)

# Frontend users table: add delete action
old_user_cell = "<td class=\"p-4\">${u.email?`<button data-action=\"reset-user\" data-email=\"${esc(u.email)}\" class=\"text-xs font-extrabold text-emerald-700\">Reset Kata Sandi</button>`:'-'}</td>"
new_user_cell = "<td class=\"p-4\"><div class=\"flex flex-wrap gap-3\">${u.email?`<button data-action=\"reset-user\" data-email=\"${esc(u.email)}\" class=\"text-xs font-extrabold text-emerald-700\">Reset Kata Sandi</button>`:''}<button data-action=\"delete-user\" data-id=\"${u.id}\" data-name=\"${esc(u.full_name||u.email||u.nim||'User')}\" class=\"text-xs font-extrabold text-rose-600\">Hapus Akun</button></div></td>"
replace_once('src/v4/data.js', old_user_cell, new_user_cell)

reset_marker = "export async function createStaff(name,email,role){"
delete_user_fn = """export async function deleteUser(id,name='User'){
  if(!id)return null
  const ok=window.confirm(`Hapus akun ${name}?\\n\\nSemua pengajuan seminar dan file berkas terkait akun ini juga akan dihapus. Data master mahasiswa tetap dipertahankan. Tindakan ini tidak dapat dibatalkan.`)
  if(!ok)return null
  try{
    loading(true,'Menghapus akun dan data terkait...')
    const data=await edge('admin-users',{action:'delete_user',user_id:id})
    toast(`Akun ${data?.full_name||name} berhasil dihapus.`)
    await loadUsers()
    return data
  }catch(e){toast(e.message||'Gagal menghapus akun.','err');return null}finally{loading(false)}
}

"""
replace_once('src/v4/data.js', reset_marker, delete_user_fn + reset_marker)

# Registration list: admin-only delete button
old_reg_action = "<td class=\"p-4\"><button data-action=\"review-registration\" data-id=\"${r.id}\" class=\"rounded-xl bg-[#182e79] px-3 py-2 text-xs font-extrabold text-white\">Periksa Berkas</button></td>"
new_reg_action = "<td class=\"p-4\"><div class=\"flex flex-wrap gap-2\"><button data-action=\"review-registration\" data-id=\"${r.id}\" class=\"rounded-xl bg-[#182e79] px-3 py-2 text-xs font-extrabold text-white\">Periksa Berkas</button>${isAdmin()?`<button data-action=\"delete-registration\" data-id=\"${r.id}\" class=\"rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-700\">Hapus</button>`:''}</div></td>"
replace_once('src/v5/workflow.js', old_reg_action, new_reg_action)

# import edge helper in workflow.js
replace_once(
    'src/v5/workflow.js',
    "  supabaseClient, toast, loading, statusBadge, isAdmin\n",
    "  supabaseClient, toast, loading, statusBadge, isAdmin, edge\n"
)

mark_marker = "export async function loadStudentHistory(){\n"
delete_reg_fn = """export async function deleteRegistration(id){
  const reg=state.registrations.find(r=>r.id===id)
  if(!reg)return toast('Pengajuan tidak ditemukan.','err')
  if(!isAdmin())return toast('Hanya admin yang dapat menghapus pengajuan.','err')
  const ok=window.confirm(`Hapus pengajuan ${reg.jenis_ujian} atas nama ${reg.nama} (${reg.nim})?\\n\\nSemua dokumen PDF terkait juga akan dihapus dari Google Drive. Tindakan ini tidak dapat dibatalkan.`)
  if(!ok)return
  loading(true,'Menghapus pengajuan dan berkas Google Drive...')
  try{
    const data=await edge('admin-seminar',{action:'delete_registration',registration_id:id})
    document.querySelector('#registrationReviewModal')?.remove()
    toast(`Pengajuan dihapus (${Number(data?.deleted_documents||0)} dokumen).`)
    await loadRegistrations()
  }catch(e){toast(e.message||'Gagal menghapus pengajuan.','err')}finally{loading(false)}
}

"""
replace_once('src/v5/workflow.js', mark_marker, delete_reg_fn + mark_marker)

# app-v5 imports + click handlers
replace_once(
    'src/app-v5.js',
    "import { loadLandingData, parseImport, renderImportRows, doImport, downloadTemplate, loadUsers, renderUserRows, resetUser } from './v4/data.js'",
    "import { loadLandingData, parseImport, renderImportRows, doImport, downloadTemplate, loadUsers, renderUserRows, resetUser, deleteUser } from './v4/data.js'"
)
replace_once(
    'src/app-v5.js',
    "  editAnnouncement, saveAnnouncement, toggleAnnouncement, deleteAnnouncement\n",
    "  editAnnouncement, saveAnnouncement, toggleAnnouncement, deleteAnnouncement, deleteRegistration\n"
)
replace_once(
    'src/app-v5.js',
    "  if(action==='mark-complete')return markComplete(el.dataset.id)\n",
    "  if(action==='mark-complete')return markComplete(el.dataset.id)\n  if(action==='delete-registration')return deleteRegistration(el.dataset.id)\n"
)
replace_once(
    'src/app-v5.js',
    "  if(action==='reset-user'){\n",
    "  if(action==='delete-user')return deleteUser(el.dataset.id,el.dataset.name||'User')\n  if(action==='reset-user'){\n"
)

print('admin delete patch applied')
