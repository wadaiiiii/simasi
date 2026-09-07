from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'Expected block not found in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

# 1. Frontend role helpers.
replace_once(
    'src/v4/core.js',
    "export const isStaff = () => ['dosen','admin'].includes(role())\nexport const isStudent = () => role() === 'mahasiswa'",
    "export const isStaff = () => ['staff','admin'].includes(role())\nexport const isLecturer = () => role() === 'dosen'\nexport const isStudent = () => role() === 'mahasiswa'"
)

# 2. Canonical schema role constraint.
replace_once(
    'supabase/schema.sql',
    "role text not null default 'mahasiswa' check (role in ('mahasiswa','dosen','admin'))",
    "role text not null default 'mahasiswa' check (role in ('mahasiswa','staff','dosen','admin'))"
)

# 3. Production RLS migration: introduce staff role and restrict seminar management to staff/admin.
p = Path('supabase/staff_prodi_scope.sql')
s = p.read_text()
s = s.replace('-- Admin can manage all programs; Dosen/Staf only their own profile.prodi.', '-- Admin can manage all programs; Staff only their own profile.prodi. Dosen is a separate academic role.')
s = s.replace("p.role = 'dosen'", "p.role = 'staff'")
if 'profiles_role_check' not in s:
    s = """-- Split operational Staff from Dosen role.\nalter table public.profiles drop constraint if exists profiles_role_check;\nalter table public.profiles add constraint profiles_role_check check (role in ('mahasiswa','staff','dosen','admin'));\n\n""" + s
if 'mahasiswa read own/academic/prodi staff' not in s:
    marker = "create index if not exists idx_profiles_role_prodi on public.profiles(role, prodi);"
    addition = """\n-- Staff may read student rows only for their assigned program study.\ndrop policy if exists \"mahasiswa read own/prodi staff\" on public.mahasiswa;\ncreate policy \"mahasiswa read own/prodi staff\"\non public.mahasiswa\nfor select to authenticated\nusing (user_id = auth.uid() or public.is_staff() or public.can_manage_prodi(prodi));\n\n"""
    s = s.replace(marker, addition + marker)
p.write_text(s)

# 4. Secure Drive preview: operational staff only, not lecturer.
replace_once(
    'supabase/functions/preview-seminar-drive/index.ts',
    "const canManage = role === 'admin' || (role === 'dosen' && Boolean(profileProdi) && profileProdi === registrationProdi)",
    "const canManage = role === 'admin' || (role === 'staff' && Boolean(profileProdi) && profileProdi === registrationProdi)"
)

# 5. Admin user backend role model.
p = Path('supabase/functions/admin-users/index.ts')
s = p.read_text()
s = s.replace("const ALLOWED_ROLES = ['mahasiswa', 'dosen', 'admin']", "const ALLOWED_ROLES = ['mahasiswa', 'staff', 'dosen', 'admin']")
s = s.replace("const requestedRole = String(body.role || 'dosen')", "const requestedRole = String(body.role || 'staff')")
s = s.replace("const requestedProdi = requestedRole === 'dosen' ? String(body.prodi || '').trim() : ''", "const requestedProdi = ['staff', 'dosen'].includes(requestedRole) ? String(body.prodi || '').trim() : ''")
s = s.replace("!['dosen', 'admin'].includes(requestedRole)", "!['staff', 'dosen', 'admin'].includes(requestedRole)")
s = s.replace("requestedRole === 'dosen' && !ALLOWED_PRODI.includes(requestedProdi)", "['staff', 'dosen'].includes(requestedRole) && !ALLOWED_PRODI.includes(requestedProdi)")
s = s.replace("'Program studi staf wajib dipilih dan harus valid.'", "'Program studi Staff/Dosen wajib dipilih dan harus valid.'")
s = s.replace("prodi: requestedRole === 'dosen' ? requestedProdi : null", "prodi: ['staff', 'dosen'].includes(requestedRole) ? requestedProdi : null")
s = s.replace("message: 'Akun staf siap. Password sementara ditampilkan satu kali kepada admin dan tidak dikirim melalui email.'", "message: 'Akun pengguna siap. Password sementara ditampilkan satu kali kepada admin dan tidak dikirim melalui email.'")
old = """      const updated = await admin.from('profiles').update({ role: newRole }).eq('id', userId)\n      if (updated.error) throw updated.error\n      return json({ ok: true, message: 'Role user diperbarui.' })"""
new = """      const targetProfile = await admin.from('profiles').select('prodi').eq('id', userId).maybeSingle()\n      if (targetProfile.error) throw targetProfile.error\n      if (['staff', 'dosen'].includes(newRole) && !ALLOWED_PRODI.includes(String(targetProfile.data?.prodi || ''))) {\n        return json({ ok: false, message: 'Tetapkan Program Studi terlebih dahulu sebelum mengubah role menjadi Staff/Dosen.' }, 400)\n      }\n      const updated = await admin.from('profiles').update({ role: newRole }).eq('id', userId)\n      if (updated.error) throw updated.error\n      return json({ ok: true, message: 'Role user diperbarui.' })"""
if old not in s:
    raise SystemExit('set_role backend block not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 6. User table: show Staff as its own role.
p = Path('src/v4/data.js')
s = p.read_text()
s = s.replace("<option value=\"dosen\" ${u.role==='dosen'?'selected':''}>Dosen</option><option value=\"admin\"", "<option value=\"staff\" ${u.role==='staff'?'selected':''}>Staff</option><option value=\"dosen\" ${u.role==='dosen'?'selected':''}>Dosen</option><option value=\"admin\"")
p.write_text(s)

# 7. Management screen labels/filter.
p = Path('src/v4/views.js')
s = p.read_text()
s = s.replace('Tambah Staf', 'Tambah Dosen / Staff')
s = s.replace('<option value="dosen">Dosen</option><option value="admin">Admin</option>', '<option value="staff">Staff</option><option value="dosen">Dosen</option><option value="admin">Admin</option>')
p.write_text(s)

# 8. V5 shell: distinct Staff and Lecturer navigation/dashboard.
p = Path('src/v5/views.js')
s = p.read_text()
s = s.replace("import { logo, PRODI, DOCS, state, isAdmin, isStaff, esc, normalizeProdi } from '../v4/core.js'", "import { logo, PRODI, DOCS, state, isAdmin, isStaff, isLecturer, esc, normalizeProdi } from '../v4/core.js'")
staff_nav = """function staffNav(){\n  return `<p class=\"px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400\">Staf Akademik</p>\n    <button data-page=\"staff-dashboard\" class=\"simasi-nav\">▦ Dashboard Staf</button>\n    <button data-page=\"admin-registrations\" class=\"simasi-nav\">☷ Monitoring Pendaftar</button>\n    <div class=\"my-4 border-t border-white/10\"></div><button data-action=\"logout\" class=\"simasi-nav text-rose-200\">← Keluar</button>`\n}\n"""
lecturer_nav = staff_nav + """function lecturerNav(){\n  return `<p class=\"px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400\">Dosen</p>\n    <button data-page=\"lecturer-dashboard\" class=\"simasi-nav\">▦ Dashboard Dosen</button>\n    <div class=\"my-4 border-t border-white/10\"></div>\n    <button class=\"simasi-nav disabled\" disabled>▤ Manajemen Kuliah <span class=\"ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]\">Segera</span></button>\n    <button class=\"simasi-nav disabled\" disabled>✎ Bimbingan Skripsi <span class=\"ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]\">Segera</span></button>\n    <div class=\"my-4 border-t border-white/10\"></div><button data-action=\"logout\" class=\"simasi-nav text-rose-200\">← Keluar</button>`\n}\n"""
if staff_nav not in s:
    raise SystemExit('staffNav block not found')
s = s.replace(staff_nav, lecturer_nav, 1)
s = s.replace("const nav=isAdmin()?adminNav():isStaff()?staffNav():studentNav()", "const nav=isAdmin()?adminNav():isStaff()?staffNav():isLecturer()?lecturerNav():studentNav()")
s = s.replace("'staff-dashboard':['Dashboard Staf','Staf Akademik SIMASI'],", "'staff-dashboard':['Dashboard Staf','Staf Akademik SIMASI'],\n    'lecturer-dashboard':['Dashboard Dosen','Dosen SIMASI'],")
marker = "export function registrationsHtml(){"
lecturer_dash = """export function lecturerDashboardHtml(){\n  const prodi=normalizeProdi(state.profile?.prodi||'')||'-'\n  return `<div class=\"simasi-hero rounded-3xl p-7 text-white\"><p class=\"text-xs font-extrabold uppercase tracking-[.16em] text-cyan-100\">Dosen SIMASI</p><h2 class=\"mt-3 text-3xl font-extrabold\">Dashboard Dosen</h2><p class=\"mt-2 text-sm text-slate-200\">Akun dosen dipisahkan dari Staff Akademik. Modul dosen akan tersedia pada pengembangan berikutnya.</p></div><div class=\"mt-6 grid gap-4 md:grid-cols-2\"><div class=\"simasi-card p-6\"><p class=\"text-xs font-extrabold uppercase tracking-[.14em] text-slate-400\">Program Studi</p><p class=\"mt-2 text-xl font-extrabold\">${esc(prodi)}</p></div><div class=\"simasi-card p-6\"><p class=\"text-xs font-extrabold uppercase tracking-[.14em] text-slate-400\">Akses Saat Ini</p><p class=\"mt-2 text-xl font-extrabold\">Modul Dosen Segera</p><p class=\"mt-2 text-sm text-slate-500\">Dosen tidak memiliki akses Monitoring Pendaftar Seminar.</p></div></div>`\n}\n\n"""
if marker not in s:
    raise SystemExit('registrations marker not found')
s = s.replace(marker, lecturer_dash + marker, 1)
p.write_text(s)

# 9. App router and account creation UI.
p = Path('src/app-v5.js')
s = p.read_text()
s = s.replace("isAdmin, isStaff, normalizeProdi", "isAdmin, isStaff, isLecturer, isStudent, normalizeProdi")
s = s.replace("adminDashboardHtml, registrationsHtml", "adminDashboardHtml, lecturerDashboardHtml, registrationsHtml")
old_initial = """function initialPrivatePage(){\n  if(isAdmin())return 'admin-dashboard'\n  if(isStaff())return 'staff-dashboard'\n  return 'student-dashboard'\n}"""
new_initial = """function initialPrivatePage(){\n  if(isAdmin())return 'admin-dashboard'\n  if(isStaff())return 'staff-dashboard'\n  if(isLecturer())return 'lecturer-dashboard'\n  return 'student-dashboard'\n}"""
if old_initial not in s:
    raise SystemExit('initialPrivatePage block not found')
s = s.replace(old_initial, new_initial, 1)
old_allowed = """function pageAllowed(page){\n  if(page==='admin-users'||page==='admin-import'||page==='admin-announcements'||page==='admin-dashboard')return isAdmin()\n  if(page==='admin-registrations'||page==='staff-dashboard')return isStaff()\n  if(page==='student-dashboard'||page==='student-applications'||page==='seminar')return !isStaff()\n  return true\n}"""
new_allowed = """function pageAllowed(page){\n  if(page==='admin-users'||page==='admin-import'||page==='admin-announcements'||page==='admin-dashboard')return isAdmin()\n  if(page==='admin-registrations'||page==='staff-dashboard')return isStaff()\n  if(page==='lecturer-dashboard')return isLecturer()\n  if(page==='student-dashboard'||page==='student-applications'||page==='seminar')return isStudent()\n  return true\n}"""
if old_allowed not in s:
    raise SystemExit('pageAllowed block not found')
s = s.replace(old_allowed, new_allowed, 1)
s = s.replace("if(state.page==='staff-dashboard'){main.innerHTML=adminDashboardHtml(true);await loadAdminDashboard();return}", "if(state.page==='staff-dashboard'){main.innerHTML=adminDashboardHtml(true);await loadAdminDashboard();return}\n  if(state.page==='lecturer-dashboard'){main.innerHTML=lecturerDashboardHtml();return}")
s = s.replace('<h3 class="text-xl font-extrabold">Tambah Staf</h3>', '<h3 class="text-xl font-extrabold">Tambah Dosen / Staff</h3>')
s = s.replace('Staf hanya dapat mengelola pengajuan mahasiswa pada program studinya.', 'Staff mengelola pengajuan seminar berdasarkan Prodi. Dosen adalah role terpisah untuk modul akademik yang akan datang.')
s = s.replace('<option value="dosen">Dosen/Staf</option><option value="admin">Admin</option>', '<option value="staff">Staff Akademik</option><option value="dosen">Dosen</option><option value="admin">Admin</option>')
s = s.replace('Monitoring, verifikasi, dan preview berkas akan dibatasi ke Prodi ini.', 'Program Studi wajib untuk Staff dan Dosen. Hanya Staff yang mendapat akses monitoring/verifikasi seminar.')
s = s.replace("${role==='dosen'?`<div>", "${['staff','dosen'].includes(role)?`<div>")
s = s.replace("const staff=t.value==='dosen',field=$('#staffProdiField'),select=$('#staffProdi')\n    field?.classList.toggle('hidden',!staff)\n    if(select){select.required=staff;if(!staff)select.value=''}", "const scoped=['staff','dosen'].includes(t.value),field=$('#staffProdiField'),select=$('#staffProdi')\n    field?.classList.toggle('hidden',!scoped)\n    if(select){select.required=scoped;if(!scoped)select.value=''}")
s = s.replace("const role=$('#staffRole').value,prodi=role==='dosen'?$('#staffProdi').value:''\n    if(role==='dosen'&&!PRODI.includes(prodi))return toast('Pilih program studi staf.','info')", "const role=$('#staffRole').value,scoped=['staff','dosen'].includes(role),prodi=scoped?$('#staffProdi').value:''\n    if(scoped&&!PRODI.includes(prodi))return toast('Pilih program studi Staff/Dosen.','info')")
p.write_text(s)

# 10. Deployment marker content; direct connector will touch trigger after this commit.
Path('deploy/role-split-applied.txt').write_text('SIMASI role split applied: admin | staff | dosen | mahasiswa\n')
