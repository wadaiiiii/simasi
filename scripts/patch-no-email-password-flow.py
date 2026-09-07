from pathlib import Path

# Patch reset helper in v4/data.js
p = Path('src/v4/data.js')
s = p.read_text()
old = "export async function resetUser(email){try{loading(true,'Mengirim reset password...');await edge('admin-users',{action:'reset_password',email});toast('Email reset password dikirim.')}catch(e){toast(e.message,'err')}finally{loading(false)}}"
new = """export async function resetUser(email){
  try{
    loading(true,'Mereset kata sandi...')
    const data=await edge('admin-users',{action:'reset_password',email})
    toast(data?.role==='mahasiswa'?'Password mahasiswa direset ke NIM.':'Password sementara baru berhasil dibuat.')
    await loadUsers()
    return data
  }catch(e){toast(e.message||'Reset kata sandi gagal.','err');return null}finally{loading(false)}
}"""
if old not in s:
    raise SystemExit('resetUser old block not found')
s = s.replace(old, new, 1)
s = s.replace('>Reset Password</button>', '>Reset Kata Sandi</button>')
p.write_text(s)

# Patch credential UI and reset click in app-v5.js
p = Path('src/app-v5.js')
s = p.read_text()
s = s.replace('Buat Akun & Kirim Email', 'Buat Akun')
start = s.index("function showStaffCredential(")
end = s.index("\n\nasync function createStaffScoped", start)
new_fn = r'''function showStaffCredential(data,name,role,prodi='',mode='create'){
  const email=String(data?.email||'')
  const password=String(data?.temporary_password||'')
  const isStudent=String(role||'').toLowerCase()==='mahasiswa'
  const username=String(data?.username||(isStudent?data?.nim:email)||'')
  const heading=mode==='reset'?'Password Berhasil Direset':'Akun Berhasil Dibuat'
  const title=mode==='reset'?'Kredensial Setelah Reset':'Kredensial Login Pertama'
  const notice=isStudent
    ? '<b>Mahasiswa:</b> password direset ke NIM. Mahasiswa wajib mengganti password setelah login.'
    : '<b>Simpan sekarang.</b> Password sementara hanya ditampilkan satu kali. Pengguna wajib menggantinya setelah login pertama.'
  document.body.insertAdjacentHTML('beforeend',`<div id="staffCredentialModal" class="fixed inset-0 z-[980] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"><div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div class="flex items-start justify-between gap-4"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-blue-700">${heading}</p><h3 class="mt-2 text-2xl font-extrabold">${title}</h3></div><button data-action="close-staff-credential" class="rounded-xl border px-3 py-2">✕</button></div><div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">${notice}</div><div id="staffCredentialText" class="mt-5 space-y-3 rounded-2xl bg-slate-50 p-5"><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Nama</p><p class="mt-1 font-bold">${name||'-'}</p></div><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Username</p><p id="staffCredentialEmail" class="mt-1 break-all font-mono font-bold">${username}</p></div><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Password Awal / Reset</p><p id="staffTempPassword" class="mt-1 select-all font-mono text-xl font-extrabold text-[#2636b7]">${password}</p></div>${prodi?`<div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Program Studi</p><p class="mt-1 font-bold">${prodi}</p></div>`:''}</div><div class="mt-5 grid gap-3 sm:grid-cols-2"><button data-action="copy-staff-credential" class="rounded-xl bg-[linear-gradient(90deg,#0a84bd,#2636b7,#4d1daf)] px-4 py-3 font-extrabold text-white">Salin Kredensial</button><button data-action="close-staff-credential" class="rounded-xl border px-4 py-3 font-extrabold">Sudah Disimpan</button></div><p class="mt-4 text-center text-[11px] leading-5 text-slate-500">SIMASI tidak mengirim password melalui email. Jika kredensial hilang, admin dapat melakukan Reset Kata Sandi kembali.</p></div></div>`)
}'''
s = s[:start] + new_fn + s[end:]
old_click = "  if(action==='reset-user')return resetUser(el.dataset.email)"
new_click = """  if(action==='reset-user'){
    const data=await resetUser(el.dataset.email)
    if(data)showStaffCredential(data,data.full_name||data.username||'User',data.role||'',data.prodi||'','reset')
    return
  }"""
if old_click not in s:
    raise SystemExit('reset-user click point not found')
s = s.replace(old_click, new_click, 1)
p.write_text(s)
