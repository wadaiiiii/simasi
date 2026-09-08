import { $, esc, fmt, state, supabaseClient, edge, toast, loading } from '../v4/core.js'

let requests = []

const roleLabel = (role) => ({
  mahasiswa: 'Mahasiswa',
  dosen: 'Dosen',
  staff: 'Staff',
  admin: 'Admin'
}[String(role || '').toLowerCase()] || role || '-')

const statusLabel = (status) => ({
  menunggu: 'Menunggu',
  diproses: 'Diproses',
  selesai: 'Selesai'
}[String(status || '').toLowerCase()] || status || '-')

const statusClass = (status) => ({
  menunggu: 'bg-amber-50 text-amber-700',
  diproses: 'bg-blue-50 text-blue-700',
  selesai: 'bg-emerald-50 text-emerald-700'
}[String(status || '').toLowerCase()] || 'bg-slate-100 text-slate-600')

function openRequestModal(){
  $('#passwordResetRequestModal')?.remove()
  $('#loginModal')?.classList.add('hidden')
  document.body.insertAdjacentHTML('beforeend',`<div id="passwordResetRequestModal" class="fixed inset-0 z-[920] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
    <div class="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div class="h-2 bg-[linear-gradient(90deg,#eb485d,#0a7bb5,#2235ae,#491699)]"></div>
      <div class="p-6 sm:p-8">
        <div class="flex items-start justify-between gap-4">
          <div><p class="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2235ae]">Pemulihan Akun</p><h2 class="mt-1 text-2xl font-extrabold">Ajukan Reset Password</h2></div>
          <button data-action="close-reset-request" class="rounded-xl border px-3 py-2 text-slate-500">✕</button>
        </div>
        <p class="mt-4 text-sm leading-6 text-slate-500">Masukkan <b>NIM</b> untuk mahasiswa atau <b>email</b> untuk dosen/staff/admin. Password tidak akan direset otomatis; permintaan harus diproses petugas SIMASI.</p>
        <form id="passwordResetRequestForm" class="mt-6 space-y-4">
          <div><label class="mb-2 block text-sm font-bold text-slate-700">NIM / Email</label><input id="resetRequestIdentifier" required autocomplete="username" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-[#2235ae] focus:bg-white focus:ring-4 focus:ring-[#2235ae]/10" placeholder="Contoh: E0124001 atau dosen@unsulbar.ac.id"></div>
          <div id="resetRequestMessage" class="hidden rounded-xl border p-4 text-sm leading-6"></div>
          <button id="resetRequestSubmit" class="w-full rounded-2xl bg-[linear-gradient(90deg,#0a7bb5,#2235ae,#491699)] px-5 py-3.5 font-extrabold text-white">Kirim Permintaan</button>
        </form>
        <button data-action="close-reset-request" class="mt-4 w-full text-center text-xs font-extrabold text-[#2235ae]">← Kembali ke Login</button>
      </div>
    </div>
  </div>`)
}

function closeRequestModal(){
  $('#passwordResetRequestModal')?.remove()
  $('#loginModal')?.classList.remove('hidden')
}

async function submitPublicRequest(){
  const identifier = String($('#resetRequestIdentifier')?.value || '').trim()
  const message = $('#resetRequestMessage')
  if(!identifier)return
  loading(true,'Mengirim permintaan reset...')
  try{
    const { data, error } = await supabaseClient.functions.invoke('request-password-reset',{ body:{ identifier } })
    if(error)throw error
    if(message){
      message.className='rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800'
      message.textContent=data?.message || 'Jika akun terdaftar, permintaan akan diteruskan ke pengelola SIMASI.'
      message.classList.remove('hidden')
    }
    const button=$('#resetRequestSubmit');if(button)button.disabled=true
  }catch(error){
    if(message){
      message.className='rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700'
      message.textContent='Permintaan belum dapat dikirim. Silakan coba kembali.'
      message.classList.remove('hidden')
    }
  }finally{loading(false)}
}

export function passwordResetRequestsHtml(){
  const isAdmin=String(state.profile?.role||'').toLowerCase()==='admin'
  return `<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#2235ae]">Pemulihan Akun</p><h2 class="mt-2 text-2xl font-extrabold">Permintaan Reset Password</h2><p class="mt-1 text-sm text-slate-500">${isAdmin?'Admin dapat memproses mahasiswa, dosen, staff, dan admin lain.':'Staff hanya dapat memproses mahasiswa dari Program Studi sendiri.'}</p></div>
    <button data-action="refresh-password-reset-requests" class="rounded-xl border px-4 py-2 text-sm font-extrabold">↻ Refresh</button>
  </div>
  <div class="mt-6 grid gap-4 sm:grid-cols-3">
    <div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">Menunggu</p><p id="resetWaitingCount" class="mt-2 text-3xl font-extrabold">-</p></div>
    <div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">Diproses</p><p id="resetProcessingCount" class="mt-2 text-3xl font-extrabold">-</p></div>
    <div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">Selesai</p><p id="resetDoneCount" class="mt-2 text-3xl font-extrabold">-</p></div>
  </div>
  <div class="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800"><b>Alur reset:</b> Mahasiswa → password kembali ke NIM. Dosen/Staff/Admin → password sementara SIMASI@######. Semua akun wajib mengganti password setelah login.</div>
  <div class="mt-4 simasi-card overflow-hidden"><div class="overflow-x-auto"><table class="simasi-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">Pemohon</th><th class="p-4 text-left">Role / Prodi</th><th class="p-4 text-left">Diajukan</th><th class="p-4 text-left">Status</th><th class="p-4 text-left">Aksi</th></tr></thead><tbody id="passwordResetRows"><tr><td colspan="5" class="p-8 text-center text-slate-500">Memuat permintaan...</td></tr></tbody></table></div></div>`
}

function renderRequests(){
  if(!$('#passwordResetRows'))return
  $('#resetWaitingCount').textContent=requests.filter(r=>r.status==='menunggu').length
  $('#resetProcessingCount').textContent=requests.filter(r=>r.status==='diproses').length
  $('#resetDoneCount').textContent=requests.filter(r=>r.status==='selesai').length
  $('#passwordResetRows').innerHTML=requests.length?requests.map(r=>{
    const identity=String(r.role||'').toLowerCase()==='mahasiswa'?(r.nim||'-'):(r.email||'-')
    const action=r.status==='menunggu'?`<button data-action="process-password-reset" data-id="${esc(r.id)}" data-name="${esc(r.full_name||identity)}" class="rounded-xl bg-[#182e79] px-3 py-2 text-xs font-extrabold text-white">Reset Password</button>`:`<span class="text-xs text-slate-400">${r.status==='selesai'?'Sudah selesai':'Sedang diproses'}</span>`
    return `<tr class="border-t"><td class="p-4"><b>${esc(r.full_name||'-')}</b><div class="mt-1 text-xs text-slate-500">${esc(identity)}</div></td><td class="p-4"><div class="font-bold">${esc(roleLabel(r.role))}</div><div class="mt-1 text-xs text-slate-500">${esc(r.prodi||'-')}</div></td><td class="p-4 text-xs text-slate-500">${fmt(r.requested_at)}</td><td class="p-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(r.status)}">${esc(statusLabel(r.status))}</span></td><td class="p-4">${action}</td></tr>`
  }).join(''):'<tr><td colspan="5" class="p-8 text-center text-slate-500">Belum ada permintaan reset password.</td></tr>'
}

export async function loadPasswordResetRequests(){
  loading(true,'Memuat permintaan reset...')
  try{
    const data=await edge('manage-password-reset',{action:'list'})
    requests=data.requests||[]
    renderRequests()
  }catch(error){
    toast(error?.message||'Gagal memuat permintaan reset password.','err')
  }finally{loading(false)}
}

function showCredential(data){
  $('#passwordResetCredentialModal')?.remove()
  const role=String(data?.role||'').toLowerCase()
  const username=String(data?.username||'')
  const password=String(data?.temporary_password||'')
  document.body.insertAdjacentHTML('beforeend',`<div id="passwordResetCredentialModal" class="fixed inset-0 z-[990] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"><div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div class="flex items-start justify-between gap-4"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Reset Selesai</p><h3 class="mt-2 text-2xl font-extrabold">Kredensial Baru</h3></div><button data-action="close-password-reset-credential" class="rounded-xl border px-3 py-2">✕</button></div><div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>Simpan sekarang.</b> Password hanya ditampilkan pada hasil proses ini. Pengguna wajib menggantinya setelah login.</div><div class="mt-5 space-y-4 rounded-2xl bg-slate-50 p-5"><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Nama</p><p class="mt-1 font-bold">${esc(data?.full_name||'-')}</p></div><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Username</p><p id="processedResetUsername" class="mt-1 break-all font-mono font-bold">${esc(username)}</p></div><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Password Reset</p><p id="processedResetPassword" class="mt-1 select-all font-mono text-xl font-extrabold text-[#2636b7]">${esc(password)}</p></div><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Role</p><p class="mt-1 font-bold">${esc(roleLabel(role))}${data?.prodi?` • ${esc(data.prodi)}`:''}</p></div></div><div class="mt-5 grid gap-3 sm:grid-cols-2"><button data-action="copy-password-reset-credential" class="rounded-xl bg-[linear-gradient(90deg,#0a84bd,#2636b7,#4d1daf)] px-4 py-3 font-extrabold text-white">Salin Kredensial</button><button data-action="close-password-reset-credential" class="rounded-xl border px-4 py-3 font-extrabold">Sudah Disimpan</button></div></div></div>`)
}

async function processRequest(id,name){
  if(!confirm(`Reset password untuk ${name||'pengguna ini'}? Pengguna akan diwajibkan mengganti password setelah login.`))return
  loading(true,'Mereset password...')
  try{
    const data=await edge('manage-password-reset',{action:'process',request_id:id})
    await loadPasswordResetRequests()
    showCredential(data)
    toast('Password berhasil direset.')
  }catch(error){
    toast(error?.message||'Reset password gagal.','err')
  }finally{loading(false)}
}

async function copyCredential(){
  const username=$('#processedResetUsername')?.textContent||''
  const password=$('#processedResetPassword')?.textContent||''
  try{
    await navigator.clipboard.writeText(`Username: ${username}\nPassword: ${password}\nWajib ganti password setelah login pertama.`)
    toast('Kredensial disalin.')
  }catch{toast('Gagal menyalin kredensial.','err')}
}

document.addEventListener('click',(event)=>{
  const el=event.target.closest?.('[data-action],#forgotPassword')
  if(!el)return
  const action=el.dataset?.action
  if(action==='open-reset-request'||el.id==='forgotPassword'){event.preventDefault();openRequestModal();return}
  if(action==='close-reset-request'){event.preventDefault();closeRequestModal();return}
  if(action==='refresh-password-reset-requests'){event.preventDefault();loadPasswordResetRequests();return}
  if(action==='process-password-reset'){event.preventDefault();processRequest(el.dataset.id,el.dataset.name);return}
  if(action==='close-password-reset-credential'){event.preventDefault();$('#passwordResetCredentialModal')?.remove();return}
  if(action==='copy-password-reset-credential'){event.preventDefault();copyCredential();return}
})

document.addEventListener('submit',(event)=>{
  if(event.target?.id!=='passwordResetRequestForm')return
  event.preventDefault();event.stopImmediatePropagation();submitPublicRequest()
},true)
