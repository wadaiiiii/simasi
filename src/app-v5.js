import { $, $$, state, isAdmin, isStaff, isLecturer, isStudent, normalizeProdi, loginEmail, supabaseClient, hasSupabaseConfiguration, refreshSession, toast, loading, MAX_FILE, PRODI } from './v4/core.js'
import { landingHtml } from './v4/landing-simple.js'
import { privateShell, titleFor, adminDashboardHtml, lecturerDashboardHtml, registrationsHtml, announcementsHtml, importHtml, usersHtml, studentDashboardHtml, studentApplicationsHtml, seminarHtml } from './v5/views.js'
import { passwordResetRequestsHtml, loadPasswordResetRequests } from './v5/password-reset.js'
import { loadLandingData, parseImport, renderImportRows, doImport, downloadTemplate, loadUsers, renderUserRows, resetUser, deleteUser } from './v4/data.js'
import {
  loadAdminDashboard, loadRegistrations, renderRegistrationRows, openAdminReview, saveDocReview,
  startVerification, requestRevision, markComplete, loadStudentHistory, loadStudentApplications,
  openStudentApplication, validateSeminar, submitSeminar, previewLocal, previewAllLocal, previewRemote,
  closePreview, uploadRevision, revisionFileChanged, loadAnnouncementsAdmin, resetAnnouncementForm,
  editAnnouncement, saveAnnouncement, toggleAnnouncement, deleteAnnouncement, deleteRegistration
} from './v5/workflow.js'
import './lifecycle.css'

const app=$('#app')
let navigationVersion=0

function initialPrivatePage(){
  if(isAdmin())return 'admin-dashboard'
  if(isStaff())return 'staff-dashboard'
  if(isLecturer())return 'lecturer-dashboard'
  return 'student-dashboard'
}

async function renderLanding(){
  state.page='landing'
  app.innerHTML=landingHtml()
  if(hasSupabaseConfiguration) await loadLandingData()
}

async function renderPrivate(){
  if(!state.user)return renderLanding()
  if(!state.page||state.page==='landing')state.page=initialPrivatePage()
  app.innerHTML=privateShell()
  await renderPage()
  if(state.profile?.must_change_password)openPasswordModal(false)
}

function pageAllowed(page){
  if(page==='admin-users'||page==='admin-announcements'||page==='admin-dashboard')return isAdmin()
  if(page==='admin-registrations'||page==='staff-dashboard'||page==='admin-import'||page==='password-reset-requests')return isStaff()
  if(page==='lecturer-dashboard')return isLecturer()
  if(page==='student-dashboard'||page==='student-applications'||page==='seminar')return isStudent()
  return true
}

async function renderPage(){
  const main=$('#privateMain');if(!main)return
  if(!pageAllowed(state.page))state.page=initialPrivatePage()
  const [title,eye]=titleFor(state.page)
  if($('#pageTitle'))$('#pageTitle').textContent=title
  if($('#pageEyebrow'))$('#pageEyebrow').textContent=eye
  $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page))
  if(state.page==='admin-dashboard'){main.innerHTML=adminDashboardHtml(false);await loadAdminDashboard();return}
  if(state.page==='staff-dashboard'){main.innerHTML=adminDashboardHtml(true);await loadAdminDashboard();return}
  if(state.page==='lecturer-dashboard'){main.innerHTML=lecturerDashboardHtml();return}
  if(state.page==='admin-registrations'){
    main.innerHTML=registrationsHtml()
    if(!isAdmin()){
      const scope=normalizeProdi(state.profile?.prodi||'')
      const selector=$('#regProdi')
      if(selector){selector.value=scope;selector.disabled=true;selector.title=scope?`Akses staf dibatasi ke ${scope}`:'Program studi staf belum ditetapkan'}
    }
    await loadRegistrations();return
  }
  if(state.page==='admin-announcements'){main.innerHTML=announcementsHtml();await loadAnnouncementsAdmin();return}
  if(state.page==='admin-import'){
    main.innerHTML=importHtml();state.importRows=[];renderImportRows()
    if(isStaff()&&!isAdmin()){
      const scope=normalizeProdi(state.profile?.prodi||'')
      const host=main.querySelector('div')
      if(host)host.insertAdjacentHTML('afterbegin',`<div class="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><b>Import Staff ${scope||'Program Studi belum ditetapkan'}</b><div class="mt-1 text-xs leading-5">Staff hanya dapat mengimpor atau memperbarui mahasiswa dari Program Studi akun sendiri. Data Prodi lain akan ditolak sebelum proses import berjalan.</div></div>`)
    }
    return
  }
  if(state.page==='password-reset-requests'){main.innerHTML=passwordResetRequestsHtml();await loadPasswordResetRequests();return}
  if(state.page==='admin-users'){main.innerHTML=usersHtml();await loadUsers();return}
  if(state.page==='student-applications'){main.innerHTML=studentApplicationsHtml();await loadStudentApplications();return}
  if(state.page==='seminar'){main.innerHTML=seminarHtml();validateSeminar();return}
  main.innerHTML=studentDashboardHtml();await loadStudentHistory()
}

async function setPage(page){
  const version=++navigationVersion
  state.page=page
  await renderPrivate()
  if(version!==navigationVersion)return
  closeMenu();window.scrollTo({top:0,behavior:'smooth'})
}

function openMenu(){$('#sidebar')?.classList.remove('-translate-x-full');$('#mobileOverlay')?.classList.remove('hidden')}
function closeMenu(){$('#sidebar')?.classList.add('-translate-x-full');$('#mobileOverlay')?.classList.add('hidden')}
function openLogin(){$('#loginModal')?.classList.remove('hidden')}
function closeLogin(){$('#loginModal')?.classList.add('hidden')}
function openPasswordModal(recovery=false){
  state.recovery=recovery
  const m=$('#passwordModal');if(!m)return
  m.classList.remove('hidden');m.classList.add('flex')
  $('#passwordTitle').textContent=recovery?'Atur Password Baru':'Ganti Password Pertama'
  $('#passwordDesc').textContent=recovery?'Buat password baru minimal 8 karakter.':'Password awal harus diganti sebelum menggunakan layanan.'
}

async function doLogin(){
  const id=$('#loginId').value.trim(),pw=$('#loginPassword').value,box=$('#loginError')
  box.classList.add('hidden');loading(true,'Memverifikasi akun...')
  try{
    if(!hasSupabaseConfiguration)throw new Error('Koneksi backend belum dikonfigurasi.')
    const r=await supabaseClient.auth.signInWithPassword({email:loginEmail(id),password:pw})
    if(r.error)throw r.error
    await refreshSession();state.page=initialPrivatePage();await renderPrivate();toast('Login berhasil.')
  }catch(e){box.textContent=e.message||'Login gagal.';box.classList.remove('hidden')}finally{loading(false)}
}

async function logout(){
  loading(true,'Keluar...')
  try{await supabaseClient.auth.signOut();state.user=null;state.profile=null;state.selectedProdi='';state.studentApplications=[];await renderLanding()}finally{loading(false)}
}

async function savePassword(){
  const p=$('#newPassword').value,c=$('#newPassword2').value,msg=$('#passwordMsg')
  const show=(t,err=true)=>{msg.textContent=t;msg.className=`rounded-xl border p-3 text-sm ${err?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`;msg.classList.remove('hidden')}
  if(p.length<8)return show('Password minimal 8 karakter.')
  if(p!==c)return show('Konfirmasi password tidak sama.')
  loading(true,'Menyimpan password...')
  try{
    if(state.recovery){const r=await supabaseClient.auth.updateUser({password:p});if(r.error)throw r.error}
    else{const {data,error}=await supabaseClient.functions.invoke('change-initial-password',{body:{new_password:p}});if(error)throw error;if(data?.ok===false)throw new Error(data.message)}
    state.profile={...state.profile,must_change_password:false};show('Password berhasil diperbarui.',false)
    setTimeout(()=>{const m=$('#passwordModal');m?.classList.add('hidden');m?.classList.remove('flex')},500);toast('Password baru aktif.')
  }catch(e){show(e.message||'Gagal mengganti password.')}finally{loading(false)}
}

function openCreateStaff(){
  document.body.insertAdjacentHTML('beforeend',`<div id="staffModal" class="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div class="flex items-start justify-between gap-4"><div><h3 class="text-xl font-extrabold">Tambah Dosen / Staff</h3><p class="mt-1 text-xs leading-5 text-slate-500">Staff mengelola pengajuan seminar berdasarkan Prodi. Dosen adalah role terpisah untuk modul akademik yang akan datang.</p></div><button data-action="close-staff" class="rounded-xl border px-3 py-2">✕</button></div><form id="staffForm" class="mt-5 space-y-4"><input id="staffName" required class="w-full rounded-xl border px-4 py-3" placeholder="Nama lengkap"><input id="staffEmail" type="email" required class="w-full rounded-xl border px-4 py-3" placeholder="Email"><div><label class="mb-2 block text-xs font-bold text-slate-600">Peran</label><select id="staffRole" class="w-full rounded-xl border px-4 py-3"><option value="staff">Staff Akademik</option><option value="dosen">Dosen</option><option value="admin">Admin</option></select></div><div id="staffProdiField"><label class="mb-2 block text-xs font-bold text-slate-600">Program Studi</label><select id="staffProdi" required class="w-full rounded-xl border px-4 py-3"><option value="">Pilih Program Studi</option>${PRODI.map(p=>`<option value="${p}">${p}</option>`).join('')}</select><p class="mt-2 text-[11px] leading-5 text-slate-500">Program Studi wajib untuk Staff dan Dosen. Hanya Staff yang mendapat akses monitoring/verifikasi seminar.</p></div><button class="w-full rounded-xl bg-[linear-gradient(90deg,#0a84bd,#2636b7,#4d1daf)] px-5 py-3 font-extrabold text-white">Buat Akun</button></form></div></div>`)
}

function showStaffCredential(data,name,role,prodi='',mode='create'){
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
}

async function createStaffScoped(name,email,role,prodi=''){
  loading(true,'Membuat akun staf...')
  try{
    const {data,error}=await supabaseClient.functions.invoke('admin-users',{body:{action:'create_staff',full_name:name,email,role,prodi}})
    if(error){let msg=error.message;try{const res=error.context;if(res?.clone){const j=await res.clone().json();msg=j?.message||j?.error||msg}}catch{}throw new Error(msg||'Gagal membuat staf.')}
    if(data?.ok===false)throw new Error(data.message||'Gagal membuat staf.')
    if(!data?.temporary_password)throw new Error('Password sementara tidak diterima dari backend.')
    $('#staffModal')?.remove()
    await loadUsers()
    showStaffCredential(data,name,role,prodi)
    toast('Akun berhasil dibuat. Simpan password sementara sebelum menutup jendela ini.')
  }catch(e){toast(e.message||'Gagal membuat staf.','err')}finally{loading(false)}
}

async function handleClick(e){
  const el=e.target.closest('[data-action],[data-page],button,a');if(!el)return
  if(el.dataset.page){e.preventDefault();await setPage(el.dataset.page);return}
  const action=el.dataset.action
  if(action==='open-login')return openLogin()
  if(action==='close-login')return closeLogin()
  if(action==='logout')return logout()
  if(action==='open-menu')return openMenu()
  if(action==='close-menu')return closeMenu()
  if(action==='refresh-registrations')return loadRegistrations()
  if(action==='review-registration')return openAdminReview(el.dataset.id)
  if(action==='close-registration-review')return $('#registrationReviewModal')?.remove()
  if(action==='save-doc-review')return saveDocReview(el.dataset.id)
  if(action==='start-verification')return startVerification(el.dataset.id)
  if(action==='request-revision')return requestRevision(el.dataset.id)
  if(action==='mark-complete')return markComplete(el.dataset.id)
  if(action==='delete-registration')return deleteRegistration(el.dataset.id)
  if(action==='student-application-detail')return openStudentApplication(el.dataset.id)
  if(action==='close-student-application')return $('#studentApplicationModal')?.remove()
  if(action==='preview-local-doc')return previewLocal(el.dataset.key)
  if(action==='preview-all-docs')return previewAllLocal()
  if(action==='preview-remote-doc')return previewRemote(el.dataset.url)
  if(action==='close-pdf-preview')return closePreview()
  if(action==='close-all-preview')return $('#allDocsPreviewModal')?.remove()
  if(action==='upload-revision')return uploadRevision(el.dataset.registration,el.dataset.key)
  if(action==='download-template')return downloadTemplate()
  if(action==='open-create-staff')return openCreateStaff()
  if(action==='close-staff')return $('#staffModal')?.remove()
  if(action==='close-staff-credential')return $('#staffCredentialModal')?.remove()
  if(action==='copy-staff-credential'){
    const email=$('#staffCredentialEmail')?.textContent?.trim()||'',password=$('#staffTempPassword')?.textContent?.trim()||''
    const text=`Email: ${email}
Password awal: ${password}
Login: https://simasimipa.vercel.app`
    try{await navigator.clipboard.writeText(text);toast('Kredensial berhasil disalin.')}catch{toast('Gagal menyalin otomatis. Silakan salin manual.','info')}
    return
  }
  if(action==='delete-user')return deleteUser(el.dataset.id,el.dataset.name||'User')
  if(action==='reset-user'){
    const data=await resetUser(el.dataset.email)
    if(data)showStaffCredential(data,data.full_name||data.username||'User',data.role||'',data.prodi||'','reset')
    return
  }
  if(action==='new-announcement'||action==='reset-announcement')return resetAnnouncementForm()
  if(action==='edit-announcement')return editAnnouncement(el.dataset.id)
  if(action==='toggle-announcement')return toggleAnnouncement(el.dataset.id)
  if(action==='delete-announcement')return deleteAnnouncement(el.dataset.id)
  if(action==='choose-prodi'){
    const p=el.dataset.prodi,locked=normalizeProdi(state.profile?.prodi||'')
    if(locked&&locked!==p)return toast(`Program studi akun Anda adalah ${locked}. Hubungi admin jika tidak sesuai.`,'info')
    state.selectedProdi=p;$('#privateMain').innerHTML=seminarHtml();validateSeminar();return
  }
  if(action==='remove-doc'){
    const input=$(`.doc-input[data-key="${el.dataset.key}"]`);if(input)input.value=''
    const row=el.closest('.doc-row');if(row){row.querySelector('.file-name').textContent='Pilih PDF';row.querySelector('.doc-badge').textContent='Belum Diisi';row.querySelector('.doc-badge').className='doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500';row.querySelector('[data-action="remove-doc"]')?.classList.add('hidden');row.querySelector('[data-action="preview-local-doc"]')?.classList.add('hidden');row.classList.remove('complete')}
    validateSeminar();return
  }
  if(el.id==='importExecute')return doImport()
  if(el.id==='forgotPassword'){
    const id=$('#loginId')?.value.trim()||''
    if(!id.includes('@'))return toast('Masukkan email staf/admin terlebih dahulu.','info')
    const {error}=await supabaseClient.auth.resetPasswordForEmail(id.toLowerCase(),{redirectTo:window.location.origin})
    return error?toast(error.message,'err'):toast('Email pemulihan password dikirim.')
  }
}

async function handleChange(e){
  const t=e.target
  if(['regSearch','regProdi','regType','regStatus'].includes(t.id))return renderRegistrationRows()
  if(['userSearch','userRole'].includes(t.id))return renderUserRows()
  if(t.id==='staffRole'){
    const scoped=['staff','dosen'].includes(t.value),field=$('#staffProdiField'),select=$('#staffProdi')
    field?.classList.toggle('hidden',!scoped)
    if(select){select.required=scoped;if(!scoped)select.value=''}
    return
  }
  if(t.id==='importFile'){
    const f=t.files?.[0];if(!f)return
    $('#importFileName').textContent=f.name;loading(true,'Membaca data mahasiswa...')
    try{state.importRows=await parseImport(f);renderImportRows();const detected=[...new Set(state.importRows.map(r=>normalizeProdi(r.prodi)).filter(Boolean))];toast(`${state.importRows.length} mahasiswa terdeteksi${detected.length?` • Prodi: ${detected.join(', ')}`:''}.`)}catch(err){state.importRows=[];renderImportRows();toast(err.message,'err')}finally{loading(false)}
    return
  }
  if(t.matches('.doc-input')){
    const file=t.files?.[0],row=t.closest('.doc-row');if(!file)return validateSeminar()
    if(!file.name.toLowerCase().endsWith('.pdf')||(file.type&&file.type!=='application/pdf')){t.value='';toast('Format berkas harus PDF.','err');return validateSeminar()}
    if(file.size>MAX_FILE){t.value='';toast(`${file.name}: ukuran maksimal 2 MB.`,'err');return validateSeminar()}
    row.querySelector('.file-name').textContent=file.name
    const badge=row.querySelector('.doc-badge');badge.textContent='Siap Diunggah';badge.className='doc-badge self-center rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700'
    row.querySelector('[data-action="remove-doc"]')?.classList.remove('hidden');row.querySelector('[data-action="preview-local-doc"]')?.classList.remove('hidden');row.classList.add('complete');validateSeminar();return
  }
  if(t.matches('[data-revision-input]')){const key=t.dataset.revisionInput;revisionFileChanged(key,t.files?.[0]);return}
  if(t.name==='examType')validateSeminar()
}

function handleInput(e){
  if(['regSearch','regProdi','regType','regStatus'].includes(e.target.id))renderRegistrationRows()
  if(['userSearch','userRole'].includes(e.target.id))renderUserRows()
}

async function handleSubmit(e){
  if(e.target.id==='loginForm'){e.preventDefault();return doLogin()}
  if(e.target.id==='passwordForm'){e.preventDefault();return savePassword()}
  if(e.target.id==='announcementForm'){e.preventDefault();return saveAnnouncement()}
  if(e.target.id==='seminarForm'){
    e.preventDefault();const id=await submitSeminar();if(id){state.page='student-applications';await renderPrivate()}return
  }
  if(e.target.id==='staffForm'){
    e.preventDefault()
    const role=$('#staffRole').value,scoped=['staff','dosen'].includes(role),prodi=scoped?$('#staffProdi').value:''
    if(scoped&&!PRODI.includes(prodi))return toast('Pilih program studi Staff/Dosen.','info')
    return createStaffScoped($('#staffName').value.trim(),$('#staffEmail').value.trim(),role,prodi)
  }
}

function handlePointerMove(e){
  if(!document.querySelector('.landing-interactive'))return
  const x=(e.clientX/window.innerWidth-.5)*2,y=(e.clientY/window.innerHeight-.5)*2
  document.documentElement.style.setProperty('--pointer-x',x.toFixed(3));document.documentElement.style.setProperty('--pointer-y',y.toFixed(3))
}

async function init(){
  document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleInput);document.addEventListener('submit',handleSubmit);window.addEventListener('pointermove',handlePointerMove,{passive:true})

  // Restore persisted Supabase session before deciding which UI to render.
  // Previously SIMASI always rendered the public landing page after refreshSession(),
  // which made an active session look as if it had been logged out on reload.
  await refreshSession()

  if(hasSupabaseConfiguration){
    supabaseClient.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        state.user=session?.user||state.user
        setTimeout(async()=>{await refreshSession();state.page=initialPrivatePage();await renderPrivate();openPasswordModal(true)},0)
        return
      }
      if(event==='SIGNED_OUT'){
        setTimeout(async()=>{state.user=null;state.profile=null;state.page='landing';await renderLanding()},0)
        return
      }
      if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
        setTimeout(async()=>{
          await refreshSession()
          if(state.user&&state.page==='landing'){
            state.page=initialPrivatePage()
            await renderPrivate()
          }
        },0)
      }
    })
  }

  if(state.user){
    state.page=initialPrivatePage()
    await renderPrivate()
  }else{
    await renderLanding()
  }
}

init()
