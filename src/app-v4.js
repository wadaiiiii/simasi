import { $, $$, state, isAdmin, normalizeProdi, loginEmail, supabaseClient, hasSupabaseConfiguration, refreshSession, toast, loading, MAX_FILE, edge } from './v4/core.js'
import { landingHtml, privateShell, titleFor, adminDashboardHtml, registrationsHtml, importHtml, usersHtml, studentDashboardHtml, seminarHtml } from './v4/views.js'
import { loadLandingData, loadAdminDashboard, loadRegistrations, renderRegistrationRows, showDocs, parseImport, renderImportRows, doImport, downloadTemplate, loadUsers, renderUserRows, resetUser, createStaff, loadStudentHistory, validateSeminar, submitSeminar } from './v4/data.js'

const app=$('#app')
let navigationVersion=0

async function renderLanding(){
  state.page='landing'; app.innerHTML=landingHtml()
  if(hasSupabaseConfiguration) await loadLandingData()
}
async function renderPrivate(){
  if(!state.user)return renderLanding()
  if(!state.page||state.page==='landing')state.page=isAdmin()?'admin-dashboard':'student-dashboard'
  app.innerHTML=privateShell(); await renderPage()
  if(state.profile?.must_change_password)openPasswordModal(false)
}
async function renderPage(){
  const main=$('#privateMain');if(!main)return
  if(state.page.startsWith('admin-')&&!isAdmin())state.page='student-dashboard'
  const [title,eye]=titleFor(state.page);$('#pageTitle').textContent=title;$('#pageEyebrow').textContent=eye
  $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page))
  if(state.page==='admin-dashboard'){main.innerHTML=adminDashboardHtml();await loadAdminDashboard();return}
  if(state.page==='admin-registrations'){main.innerHTML=registrationsHtml();await loadRegistrations();return}
  if(state.page==='admin-import'){main.innerHTML=importHtml();state.importRows=[];renderImportRows();return}
  if(state.page==='admin-users'){main.innerHTML=usersHtml();await loadUsers();return}
  if(state.page==='seminar'){main.innerHTML=seminarHtml();validateSeminar();return}
  main.innerHTML=studentDashboardHtml();await loadStudentHistory()
}
async function setPage(page){
  const version=++navigationVersion
  state.page=page
  await renderPrivate()
  if(version!==navigationVersion)return
  closeMenu()
  window.scrollTo({top:0,behavior:'smooth'})
}
function openMenu(){$('#sidebar')?.classList.remove('-translate-x-full');$('#mobileOverlay')?.classList.remove('hidden')}
function closeMenu(){$('#sidebar')?.classList.add('-translate-x-full');$('#mobileOverlay')?.classList.add('hidden')}
function openLogin(){$('#loginModal')?.classList.remove('hidden')}
function closeLogin(){$('#loginModal')?.classList.add('hidden')}
function openPasswordModal(recovery=false){state.recovery=recovery;const m=$('#passwordModal');if(!m)return;m.classList.remove('hidden');m.classList.add('flex');$('#passwordTitle').textContent=recovery?'Atur Password Baru':'Ganti Password Pertama';$('#passwordDesc').textContent=recovery?'Tautan pemulihan berhasil diverifikasi. Buat password baru minimal 8 karakter.':'Password awal harus diganti sebelum menggunakan layanan.'}

async function doLogin(){
  const id=$('#loginId').value.trim(),pw=$('#loginPassword').value,box=$('#loginError');box.classList.add('hidden');loading(true,'Memverifikasi akun...')
  try{
    if(!hasSupabaseConfiguration)throw new Error('Koneksi backend belum dikonfigurasi.')
    const r=await supabaseClient.auth.signInWithPassword({email:loginEmail(id),password:pw});if(r.error)throw r.error
    await refreshSession();state.page=isAdmin()?'admin-dashboard':'student-dashboard';await renderPrivate();toast('Login berhasil.')
  }catch(e){box.textContent=e.message||'Login gagal.';box.classList.remove('hidden')}finally{loading(false)}
}
async function logout(){loading(true,'Keluar...');try{await supabaseClient.auth.signOut();state.user=null;state.profile=null;state.selectedProdi='';await renderLanding()}finally{loading(false)}}
async function savePassword(){
  const p=$('#newPassword').value,c=$('#newPassword2').value,msg=$('#passwordMsg')
  const show=(t,err=true)=>{msg.textContent=t;msg.className=`rounded-xl border p-3 text-sm ${err?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`;msg.classList.remove('hidden')}
  if(p.length<8)return show('Password minimal 8 karakter.')
  if(p!==c)return show('Konfirmasi password tidak sama.')
  loading(true,'Menyimpan password...')
  try{
    if(state.recovery){const r=await supabaseClient.auth.updateUser({password:p});if(r.error)throw r.error}
    else{const data=await edge('change-initial-password',{new_password:p});if(data?.ok===false)throw new Error(data.message)}
    state.profile={...state.profile,must_change_password:false};show('Password berhasil diperbarui.',false);setTimeout(()=>{const m=$('#passwordModal');m.classList.add('hidden');m.classList.remove('flex')},500);toast('Password baru aktif.')
  }catch(e){show(e.message||'Gagal mengganti password.')}finally{loading(false)}
}
function openCreateStaff(){document.body.insertAdjacentHTML('beforeend',`<div id="staffModal" class="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-lg rounded-3xl bg-white p-6"><div class="flex justify-between"><h3 class="text-xl font-extrabold">Tambah Staf</h3><button data-action="close-staff" class="rounded-xl border px-3">✕</button></div><form id="staffForm" class="mt-5 space-y-4"><input id="staffName" required class="w-full rounded-xl border px-4 py-3" placeholder="Nama lengkap"><input id="staffEmail" type="email" required class="w-full rounded-xl border px-4 py-3" placeholder="Email"><select id="staffRole" class="w-full rounded-xl border px-4 py-3"><option value="dosen">Dosen</option><option value="admin">Admin</option></select><button class="w-full rounded-xl bg-emerald-600 px-5 py-3 font-extrabold text-white">Buat Akun & Kirim Email</button></form></div></div>`) }

async function handleClick(e){
  const el=e.target.closest('button,a');if(!el)return
  if(el.dataset.scroll){e.preventDefault();document.getElementById(el.dataset.scroll)?.scrollIntoView({behavior:'smooth'});return}
  if(el.dataset.page){e.preventDefault();await setPage(el.dataset.page);return}
  const action=el.dataset.action
  if(action==='open-login')return openLogin()
  if(action==='close-login')return closeLogin()
  if(action==='logout')return logout()
  if(action==='open-menu')return openMenu()
  if(action==='close-menu')return closeMenu()
  if(action==='refresh-registrations')return loadRegistrations()
  if(action==='view-docs')return showDocs(el.dataset.id)
  if(action==='close-docs')return $('#docsModal')?.remove()
  if(action==='download-template')return downloadTemplate()
  if(action==='open-create-staff')return openCreateStaff()
  if(action==='close-staff')return $('#staffModal')?.remove()
  if(action==='reset-user')return resetUser(el.dataset.email)
  if(action==='choose-prodi'){
    const p=el.dataset.prodi,locked=normalizeProdi(state.profile?.prodi||'')
    if(locked&&locked!==p)return toast(`Program studi akun Anda adalah ${locked}. Hubungi admin jika tidak sesuai.`,'info')
    state.selectedProdi=p;$('#privateMain').innerHTML=seminarHtml();validateSeminar();return
  }
  if(action==='remove-doc'){
    const input=$(`.doc-input[data-key="${el.dataset.key}"]`);if(input)input.value=''
    const row=el.closest('.doc-row');row.querySelector('.file-name').textContent='Pilih PDF';const badge=row.querySelector('.doc-badge');badge.textContent='Belum Diisi';badge.className='doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500';el.classList.add('hidden');row.classList.remove('complete');validateSeminar();return
  }
  if(el.id==='importExecute')return doImport()
  if(el.id==='forgotPassword'){
    const id=$('#loginId')?.value.trim()||'';if(!id.includes('@'))return toast('Masukkan email staf/admin terlebih dahulu.','info')
    const {error}=await supabaseClient.auth.resetPasswordForEmail(id.toLowerCase(),{redirectTo:window.location.origin});return error?toast(error.message,'err'):toast('Email pemulihan password dikirim.')
  }
}
async function handleChange(e){
  const t=e.target
  if(['regSearch','regProdi','regType','regStatus'].includes(t.id))return renderRegistrationRows()
  if(['userSearch','userRole'].includes(t.id))return renderUserRows()
  if(t.matches('[data-action="set-status"]')){const r=await supabaseClient.from('pendaftaran_seminar').update({status:t.value}).eq('id',t.dataset.id);if(r.error)toast(r.error.message,'err');else{toast('Status pendaftaran diperbarui.');await loadRegistrations()}return}
  if(t.matches('[data-action="set-role"]')){try{await edge('admin-users',{action:'set_role',user_id:t.dataset.id,role:t.value});toast('Role user diperbarui.');await loadUsers()}catch(err){toast(err.message,'err')}return}
  if(t.id==='importFile'){
    const f=t.files?.[0];if(!f)return;$('#importFileName').textContent=f.name;loading(true,'Membaca data mahasiswa...')
    try{state.importRows=await parseImport(f);renderImportRows();toast(`${state.importRows.length} mahasiswa terdeteksi.`)}catch(err){state.importRows=[];renderImportRows();toast(err.message,'err')}finally{loading(false)}return
  }
  if(t.matches('.doc-input')){
    const file=t.files?.[0],row=t.closest('.doc-row');if(!file)return validateSeminar()
    if(!file.name.toLowerCase().endsWith('.pdf')||(file.type&&file.type!=='application/pdf')){t.value='';toast('Format berkas harus PDF.','err');return validateSeminar()}
    if(file.size>MAX_FILE){t.value='';toast(`${file.name}: ukuran maksimal 2 MB.`,'err');return validateSeminar()}
    row.querySelector('.file-name').textContent=file.name;const badge=row.querySelector('.doc-badge');badge.textContent='Siap Diunggah';badge.className='doc-badge self-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700';row.querySelector('[data-action="remove-doc"]').classList.remove('hidden');row.classList.add('complete');validateSeminar();return
  }
  if(t.name==='examType')validateSeminar()
}
function handleInput(e){if(['regSearch','regProdi','regType','regStatus'].includes(e.target.id))renderRegistrationRows();if(['userSearch','userRole'].includes(e.target.id))renderUserRows()}
async function handleSubmit(e){
  if(e.target.id==='loginForm'){e.preventDefault();return doLogin()}
  if(e.target.id==='passwordForm'){e.preventDefault();return savePassword()}
  if(e.target.id==='seminarForm'){e.preventDefault();const ok=await submitSeminar();if(ok){state.selectedProdi=normalizeProdi(state.profile?.prodi||'');$('#privateMain').innerHTML=seminarHtml();validateSeminar()}return}
  if(e.target.id==='staffForm'){e.preventDefault();return createStaff($('#staffName').value.trim(),$('#staffEmail').value.trim(),$('#staffRole').value)}
}

async function init(){
  document.addEventListener('click',handleClick)
  document.addEventListener('change',handleChange)
  document.addEventListener('input',handleInput)
  document.addEventListener('submit',handleSubmit)
  await refreshSession()
  if(hasSupabaseConfiguration){
    supabaseClient.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){state.user=session?.user||state.user;setTimeout(async()=>{await refreshSession();state.page=isAdmin()?'admin-dashboard':'student-dashboard';await renderPrivate();openPasswordModal(true)},0)}
    })
  }
  if(state.user){state.page=isAdmin()?'admin-dashboard':'student-dashboard';await renderPrivate()}else await renderLanding()
}
init()
