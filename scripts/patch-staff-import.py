from pathlib import Path

# 1) Staff navigation + page title + quick access
p = Path('src/v5/views.js')
s = p.read_text()
s = s.replace(
'''    <button data-page="staff-dashboard" class="simasi-nav">▦ Dashboard Staf</button>\n    <button data-page="admin-registrations" class="simasi-nav">☷ Monitoring Pendaftar</button>\n    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`''',
'''    <button data-page="staff-dashboard" class="simasi-nav">▦ Dashboard Staf</button>\n    <button data-page="admin-registrations" class="simasi-nav">☷ Monitoring Pendaftar</button>\n    <button data-page="admin-import" class="simasi-nav">⇧ Import Data Mahasiswa</button>\n    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`''')
s = s.replace(
'''    'admin-import':['Import Data Mahasiswa','Administrator SIMASI'],''',
'''    'admin-import':['Import Data Mahasiswa',isStaff()&&!isAdmin()?'Staf Akademik SIMASI':'Administrator SIMASI'],''')
s = s.replace(
'''<button data-page="admin-registrations" class="rounded-xl bg-[#182e79] px-4 py-3 text-left text-sm font-extrabold text-white">Monitoring Pendaftar</button>${staff?'':`<button data-page="admin-announcements" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Informasi Akademik</button><button data-page="admin-import" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Import Mahasiswa</button>`}''',
'''<button data-page="admin-registrations" class="rounded-xl bg-[#182e79] px-4 py-3 text-left text-sm font-extrabold text-white">Monitoring Pendaftar</button>${staff?`<button data-page="admin-import" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Import Mahasiswa</button>`:`<button data-page="admin-announcements" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Informasi Akademik</button><button data-page="admin-import" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Import Mahasiswa</button>`}''')
p.write_text(s)

# 2) Router permits staff import page, and shows scope notice
p = Path('src/app-v5.js')
s = p.read_text()
s = s.replace(
'''  if(page==='admin-users'||page==='admin-import'||page==='admin-announcements'||page==='admin-dashboard')return isAdmin()\n  if(page==='admin-registrations'||page==='staff-dashboard')return isStaff()''',
'''  if(page==='admin-users'||page==='admin-announcements'||page==='admin-dashboard')return isAdmin()\n  if(page==='admin-registrations'||page==='staff-dashboard'||page==='admin-import')return isStaff()''')
s = s.replace(
'''  if(state.page==='admin-import'){main.innerHTML=importHtml();state.importRows=[];renderImportRows();return}''',
'''  if(state.page==='admin-import'){\n    main.innerHTML=importHtml();state.importRows=[];renderImportRows()\n    if(isStaff()&&!isAdmin()){\n      const scope=normalizeProdi(state.profile?.prodi||'')\n      const host=main.querySelector('div')\n      if(host)host.insertAdjacentHTML('afterbegin',`<div class="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><b>Import Staff ${scope||'Program Studi belum ditetapkan'}</b><div class="mt-1 text-xs leading-5">Staff hanya dapat mengimpor atau memperbarui mahasiswa dari Program Studi akun sendiri. Data Prodi lain akan ditolak sebelum proses import berjalan.</div></div>`)\n    }\n    return\n  }''')
p.write_text(s)

# 3) Frontend preflight blocks cross-program import for staff
p = Path('src/v4/data.js')
s = p.read_text()
old = '''export async function doImport(){\n  if(!state.importRows.length)return\n  const box=$('#importResult');loading(true,`Mengimpor ${state.importRows.length} mahasiswa...`)'''
new = '''export async function doImport(){\n  if(!state.importRows.length)return\n  const actorRole=String(state.profile?.role||'').toLowerCase()\n  const staffScope=actorRole==='staff'?normalizeProdi(state.profile?.prodi||''):''\n  if(actorRole==='staff'){\n    if(!staffScope)return toast('Program Studi akun Staff belum ditetapkan. Hubungi Admin.','err')\n    const outside=state.importRows.filter(r=>normalizeProdi(r.prodi)!==staffScope)\n    if(outside.length)return toast(`Import ditolak: ${outside.length} data berada di luar Prodi ${staffScope}. Pisahkan file sesuai Program Studi Staff.`,'err')\n  }\n  const box=$('#importResult');loading(true,`Mengimpor ${state.importRows.length} mahasiswa...`)'''
if old not in s:
    raise SystemExit('doImport anchor not found')
s = s.replace(old,new)
p.write_text(s)

# 4) Backend permits staff but validates all rows are in own prodi BEFORE mutations
p = Path('supabase/functions/import-mahasiswa/index.ts')
s = p.read_text()
old = '''    const { profile, admin } = await getContext(req)\n    if (String(profile.role || '').toLowerCase() !== 'admin') {\n      return json({ ok: false, message: 'Hanya admin yang dapat mengimpor mahasiswa.' }, 403)\n    }\n\n    const body = await req.json()\n    const students = Array.isArray(body.students) ? body.students.slice(0, 500) : []\n    if (!students.length) return json({ ok: false, message: 'Tidak ada data mahasiswa untuk diimpor.' }, 400)'''
new = '''    const { profile, admin } = await getContext(req)\n    const actorRole = String(profile.role || '').toLowerCase()\n    if (!['admin', 'staff'].includes(actorRole)) {\n      return json({ ok: false, message: 'Hanya Admin atau Staff Akademik yang dapat mengimpor mahasiswa.' }, 403)\n    }\n    const staffProdi = actorRole === 'staff' ? normalizeProdi(profile.prodi) : ''\n    if (actorRole === 'staff' && !staffProdi) {\n      return json({ ok: false, message: 'Program Studi akun Staff belum ditetapkan. Hubungi Admin.' }, 403)\n    }\n\n    const body = await req.json()\n    const students = Array.isArray(body.students) ? body.students.slice(0, 500) : []\n    if (!students.length) return json({ ok: false, message: 'Tidak ada data mahasiswa untuk diimpor.' }, 400)\n\n    if (actorRole === 'staff') {\n      const outside = students.filter((raw: any) => normalizeProdi(raw?.prodi) !== staffProdi)\n      if (outside.length) {\n        return json({\n          ok: false,\n          message: `Import ditolak: ${outside.length} data berada di luar Program Studi ${staffProdi}. Staff hanya dapat mengelola mahasiswa Prodinya sendiri.`\n        }, 403)\n      }\n    }'''
if old not in s:
    raise SystemExit('backend auth anchor not found')
s = s.replace(old,new)
p.write_text(s)

print('Staff import patch applied')
