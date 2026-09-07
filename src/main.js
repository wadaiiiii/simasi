import { supabaseClient, hasSupabaseConfiguration } from './supabase.js'

const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
const fmt = v => v ? new Date(v).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '-'

const state = { page:'dashboard', user:null, profile:null, prodi:null, student:null, report:[] }
const pages = {dashboard:['Dashboard','SIMASI'],kuliah:['Manajemen Kuliah','Pra-Skripsi'],seminar:['Pendaftaran Seminar & Tugas Akhir','FMIPA UNSULBAR'],logbook:['Logbook Skripsi','Bimbingan'],laporan:['Laporan & Nilai','Rekap Akademik'],login:['Login','Autentikasi']}
const baseDocs = [
 ['persetujuan_ta','Halaman Persetujuan Tugas Akhir'],['krs','Kartu Rencana Studi (KRS) Semester Terakhir'],['khs','Kartu Hasil Studi (KHS) Semester Terakhir'],['transkrip','Transkrip Nilai Terakhir'],['ijazah','Fotocopy Ijazah SMA'],['ktp','Fotocopy KTP'],['kontrol_pembimbing','Kartu Kontrol Pembimbing'],['kontrol_seminar','Kartu Kontrol Mengikuti Seminar'],['sk_kegiatan','SK Kegiatan'],['pas_foto','Pas Foto 3x4']
]
const extraDocs = [['rekomendasi_ujian','Surat Rekomendasi Ujian'],['persetujuan_ujian','Halaman Persetujuan Ujian Akhir']]
const demo = {
 stats:{mahasiswa_aktif:742,judul_diajukan:118,lulus_sidang:63,memenuhi_sks:381,lulus_metpen:344,pengajuan_menunggu:14},
 announcements:[{judul:'Pendaftaran Seminar Proposal Periode September 2026',isi:'Mahasiswa yang telah memperoleh persetujuan pembimbing dapat mengunggah berkas melalui menu Seminar & Tugas Akhir.',tanggal:'2026-09-05'},{judul:'Pemutakhiran Data Logbook Bimbingan',isi:'Pastikan setiap aktivitas bimbingan telah dicatat pada SIMASI.',tanggal:'2026-09-02'}],
 students:[{nim:'H011221001',nama:'Andi Rahmat',prodi:'Matematika',jurusan:'Matematika',total_sks:116,metode_penelitian_lulus:true,memenuhi_syarat:true},{nim:'H021221015',nama:'Nur Aisyah',prodi:'Statistika',jurusan:'Matematika',total_sks:104,metode_penelitian_lulus:true,memenuhi_syarat:false}],
 logs:[{tanggal:'2026-08-28',uraian:'Pembahasan metode penelitian Bab III.',catatan_dosen:'Perjelas tahapan analisis dan variabel penelitian.',file_url:'https://drive.google.com/',status_approval:'Revisi'},{tanggal:'2026-08-20',uraian:'Revisi latar belakang dan rumusan masalah.',catatan_dosen:'Perkuat novelty penelitian.',file_url:'https://drive.google.com/',status_approval:'Disetujui'}],
 reports:[{nim:'H011221001',nama:'Andi Rahmat',prodi:'Matematika',nilai_proposal:86,nilai_bimbingan:88,nilai_hasil:87,nilai_ujian:90,nilai_akhir:88,status_sidang:'Siap Sidang'},{nim:'H021221008',nama:'Nur Aisyah',prodi:'Statistika',nilai_proposal:89,nilai_bimbingan:91,nilai_hasil:88,nilai_ujian:92,nilai_akhir:90,status_sidang:'Lulus'}]
}

const staff = () => ['dosen','admin'].includes(String(state.profile?.role||'').toLowerCase())
const auth = () => Boolean(state.user)
function toast(msg,type='ok'){ const e=$('#toast'); e.textContent=msg; e.className=`fixed bottom-5 right-5 z-[300] max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-2xl ${type==='err'?'bg-rose-600':type==='info'?'bg-slate-900':'bg-emerald-600'}`; e.classList.remove('hidden'); setTimeout(()=>e.classList.add('hidden'),3200) }
function load(on){ $('#loading').classList.toggle('hidden',!on); $('#loading').classList.toggle('flex',on) }
function modal(id,on){ $(id).classList.toggle('hidden',!on); $(id).classList.toggle('flex',on) }

async function showPage(page){
 if(page==='logbook'&&hasSupabaseConfiguration&&!auth()){ toast('Silakan login untuk membuka Logbook.','info'); page='login' }
 if(page==='laporan'&&hasSupabaseConfiguration&&!staff()){ toast('Laporan & Nilai hanya untuk dosen/admin.','err'); page=auth()?'dashboard':'login' }
 $$('.page-view').forEach(x=>x.classList.remove('active')); $(`#page-${page}`)?.classList.add('active')
 $$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page)); $('#pageTitle').textContent=pages[page][0]; $('#eyebrow').textContent=pages[page][1]; state.page=page
 $('#sidebar').classList.add('-translate-x-full'); $('#overlay').classList.add('hidden'); window.scrollTo({top:0,behavior:'smooth'})
 if(page==='dashboard') await loadDashboard(); if(page==='kuliah') await loadKuliah(); if(page==='logbook') await loadLogs(); if(page==='laporan') await loadReports()
}

function authUI(){
 const logged=auth(), name=state.profile?.full_name||state.profile?.nama||state.user?.user_metadata?.full_name||state.user?.email||'Guest', role=state.profile?.role||(logged?'Mahasiswa':'Belum login'), init=name.charAt(0).toUpperCase()||'G'
 $('#sideName').textContent=name; $('#sideRole').textContent=role; $('#headName').textContent=name; $('#headRole').textContent=role; $('#sideAvatar').textContent=init; $('#headAvatar').textContent=init
 $$('[data-auth]').forEach(e=>{e.classList.toggle('hidden',!logged);e.classList.toggle('flex',logged)}); $$('[data-staff]').forEach(e=>{const v=logged&&staff();e.classList.toggle('hidden',!v);e.classList.toggle('flex',v)})
 $('#loginMenu').classList.toggle('hidden',logged); $('#logoutBtn').classList.toggle('hidden',!logged); $('#logoutBtn').classList.toggle('flex',logged)
 if(state.profile?.nim&&!$('#semNim').value) $('#semNim').value=state.profile.nim; if(name!=='Guest'&&!$('#semNama').value) $('#semNama').value=name; validateSeminar()
}

async function loadDashboard(){
 let stats=demo.stats, anns=demo.announcements
 if(hasSupabaseConfiguration){
  const [s,a]=await Promise.all([supabaseClient.rpc('get_dashboard_stats'),supabaseClient.from('pengumuman').select('*').eq('is_active',true).order('tanggal',{ascending:false}).limit(5)])
  if(!s.error) stats=Array.isArray(s.data)?s.data[0]:s.data; if(!a.error) anns=a.data||[]
 }
 $('#statMahasiswa').textContent=stats?.mahasiswa_aktif||0; $('#statJudul').textContent=stats?.judul_diajukan||0; $('#statLulus').textContent=stats?.lulus_sidang||0
 $('#announcements').innerHTML=anns.length?anns.map(a=>`<article class="rounded-2xl border p-4 hover:bg-emerald-50/40"><p class="text-xs font-bold text-emerald-700">${esc(fmt(a.tanggal))}</p><h4 class="mt-1 font-black">${esc(a.judul)}</h4><p class="mt-2 text-sm leading-6 text-slate-500">${esc(a.isi)}</p></article>`).join(''):'<p class="text-sm text-slate-500">Belum ada pengumuman.</p>'
}

async function loadKuliah(){
 let s=demo.stats
 if(hasSupabaseConfiguration){ const r=await supabaseClient.rpc('get_kuliah_summary'); if(!r.error) s={...s,...(Array.isArray(r.data)?r.data[0]:r.data)} }
 $('#sumSks').textContent=s.memenuhi_sks||0; $('#sumMetpen').textContent=s.lulus_metpen||0; $('#sumPending').textContent=s.pengajuan_menunggu||0
}

async function checkNim(ev){
 ev.preventDefault(); load(true); const nim=$('#nimCheck').value.trim(); let student=null
 try{
  if(hasSupabaseConfiguration){ const r=await supabaseClient.rpc('check_skripsi_eligibility',{p_nim:nim}); if(r.error) throw r.error; student=Array.isArray(r.data)?r.data[0]:r.data }
  else student=demo.students.find(x=>x.nim.toLowerCase()===nim.toLowerCase())||null
  state.student=student; $('#nimResult').classList.remove('hidden')
  if(!student){ $('#nimResult').innerHTML='<div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">Data mahasiswa tidak ditemukan.</div>'; return }
  const ok=Boolean(student.memenuhi_syarat ?? (student.total_sks>=110&&student.metode_penelitian_lulus))
  $('#nimResult').innerHTML=`<div class="rounded-2xl border ${ok?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'} p-5"><div class="flex items-start gap-4"><div class="flex h-11 w-11 items-center justify-center rounded-xl ${ok?'bg-emerald-600':'bg-amber-500'} font-black text-white">${ok?'✓':'!'}</div><div class="flex-1"><h3 class="font-black">${esc(student.nama||student.nim)}</h3><p class="text-xs text-slate-500">${esc(student.nim)} • ${esc(student.prodi||'-')}</p><div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-xl bg-white/70 p-3"><p class="text-xs text-slate-500">SKS</p><b>${student.total_sks} SKS</b></div><div class="rounded-xl bg-white/70 p-3"><p class="text-xs text-slate-500">Metode Penelitian</p><b>${student.metode_penelitian_lulus?'Lulus':'Belum Lulus'}</b></div></div>${ok?'<button id="openSkripsi" class="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Daftar Skripsi</button>':'<p class="mt-4 text-sm font-semibold text-amber-800">Persyaratan belum terpenuhi.</p>'}</div></div></div>`
  $('#openSkripsi')?.addEventListener('click',openSkripsi)
 }catch(e){toast(e.message||'Validasi gagal.','err')}finally{load(false)}
}

function openSkripsi(){ if(hasSupabaseConfiguration&&!auth()){toast('Silakan login sebelum mengirim pengajuan.','info');showPage('login');return} $('#skrNim').value=state.student.nim||''; $('#skrNama').value=state.student.nama||''; $('#skrProdi').value=state.student.prodi||''; modal('#skripsiModal',true) }
async function submitSkripsi(ev){
 ev.preventDefault(); const p={user_id:state.user?.id||null,nim:$('#skrNim').value.trim(),nama:$('#skrNama').value.trim(),jurusan:$('#skrJurusan').value,prodi:$('#skrProdi').value,judul:$('#skrJudul').value.trim(),abstrak:$('#skrAbstrak').value.trim(),status:'menunggu'}; load(true)
 try{if(hasSupabaseConfiguration){const r=await supabaseClient.from('pengajuan_skripsi').insert(p);if(r.error)throw r.error} modal('#skripsiModal',false);$('#skripsiForm').reset();toast('Pengajuan judul berhasil dikirim.');await loadDashboard();await loadKuliah()}catch(e){toast(e.message||'Pengajuan gagal.','err')}finally{load(false)}
}

function docRow([key,label],extra=false){return `<div class="doc-row rounded-2xl border p-4" data-key="${key}"><div class="flex flex-col gap-3 lg:flex-row lg:items-center"><div class="flex-1"><div class="flex items-center gap-2"><span class="doc-icon flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400">✓</span><b class="text-sm">${esc(label)}</b><span class="doc-badge rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Belum Diisi</span></div>${key==='pas_foto'?'<div class="mt-2 ml-10"><label class="text-xs font-bold">Jumlah lembar</label><input id="photoCount" type="number" min="1" value="2" class="ml-2 w-20 rounded-lg border px-2 py-1"></div>':''}</div><div class="grid gap-2 sm:grid-cols-2 lg:w-1/2"><label class="cursor-pointer rounded-xl border border-dashed bg-slate-50 p-3 text-center text-xs font-bold"><input class="doc-file hidden" data-key="${key}" type="file" accept=".pdf,.jpg,.jpeg,.png"><span class="file-name">Pilih File</span></label><input class="doc-url rounded-xl border px-3 py-3 text-xs" data-key="${key}" type="url" placeholder="https://drive.google.com/..."></div></div></div>`}
function renderDocs(){ $('#docs').innerHTML=baseDocs.map(d=>docRow(d)).join(''); $('#extraDocs').innerHTML=extraDocs.map(d=>docRow(d,true)).join(''); $$('.doc-file').forEach(e=>e.addEventListener('change',()=>updateDoc(e.dataset.key))); $$('.doc-url').forEach(e=>e.addEventListener('input',()=>updateDoc(e.dataset.key))); $('#photoCount')?.addEventListener('input',validateSeminar) }
function activeDocs(){return $('input[name="examType"]:checked')?.value==='Ujian Tutup Skripsi'?[...baseDocs,...extraDocs]:baseDocs}
function updateDoc(key){const row=$(`.doc-row[data-key="${key}"]`),file=$(`.doc-file[data-key="${key}"]`)?.files?.[0],url=$(`.doc-url[data-key="${key}"]`)?.value.trim(),done=Boolean(file||url);row.classList.toggle('complete',done);row.querySelector('.doc-badge').textContent=done?(file?'Siap Diunggah':'Link Tersedia'):'Belum Diisi';row.querySelector('.doc-badge').className=`doc-badge rounded-full px-2 py-1 text-[10px] font-bold ${done?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`;row.querySelector('.doc-icon').className=`doc-icon flex h-8 w-8 items-center justify-center rounded-xl ${done?'bg-emerald-600 text-white':'bg-slate-100 text-slate-400'}`;if(file)row.querySelector('.file-name').textContent=file.name;validateSeminar()}
function chooseProdi(card){state.prodi=card.dataset.prodi;$$('.prodi-card').forEach(x=>x.classList.remove('selected'));card.classList.add('selected');$('#selectedProdi').textContent=state.prodi;$('#seminarForm').classList.remove('hidden');renderDocs();authUI();setTimeout(()=>$('#seminarForm').scrollIntoView({behavior:'smooth'}),100)}
function validateSeminar(){ if(!$('#submitSeminar'))return;const docs=activeDocs(),done=docs.filter(([k])=>$(`.doc-file[data-key="${k}"]`)?.files?.[0]||$(`.doc-url[data-key="${k}"]`)?.value.trim()).length,exam=$('input[name="examType"]:checked')?.value,nim=$('#semNim').value.trim(),nama=$('#semNama').value.trim(),photo=Number($('#photoCount')?.value||0),allowed=!hasSupabaseConfiguration||auth(),valid=Boolean(state.prodi&&exam&&nim&&nama&&done===docs.length&&photo>=1&&allowed);$('#docProgress').textContent=`${done} / ${docs.length}`;$('#submitSeminar').disabled=!valid;$('#semMessage').textContent=!state.prodi?'Pilih program studi.':!nim||!nama?'Lengkapi NIM dan nama.':!exam?'Pilih jenis ujian.':done!==docs.length?`${docs.length-done} berkas belum lengkap.`:photo<1?'Jumlah pas foto minimal 1.':!allowed?'Silakan login sebelum mengirim.':'Semua persyaratan lengkap.' }
const safeName=n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_')
async function submitSeminar(ev){
 ev.preventDefault();validateSeminar();if($('#submitSeminar').disabled)return;load(true)
 try{
  if(!hasSupabaseConfiguration){await new Promise(r=>setTimeout(r,500));toast('Mode demo: pendaftaran berhasil disimulasikan.');return}
  const payload={user_id:state.user.id,nim:$('#semNim').value.trim(),nama:$('#semNama').value.trim(),prodi:state.prodi,jenis_ujian:$('input[name="examType"]:checked').value,pas_foto_jumlah:Number($('#photoCount').value||2),status:'diajukan'}
  const reg=await supabaseClient.from('pendaftaran_seminar').insert(payload).select().single();if(reg.error)throw reg.error
  const rows=[];for(const [key,label] of activeDocs()){const file=$(`.doc-file[data-key="${key}"]`)?.files?.[0],url=$(`.doc-url[data-key="${key}"]`)?.value.trim()||null;let path=null;if(file){path=`${state.user.id}/${reg.data.id}/${Date.now()}_${key}_${safeName(file.name)}`;const up=await supabaseClient.storage.from('seminar-documents').upload(path,file);if(up.error)throw up.error}rows.push({pendaftaran_id:reg.data.id,jenis_berkas:key,nama_berkas:label,file_url:url,file_path:path,status:'terunggah'})}const docs=await supabaseClient.from('berkas_seminar').insert(rows);if(docs.error)throw docs.error;toast('Berkas seminar berhasil dikirim.');$('#seminarForm').reset();renderDocs()
 }catch(e){toast(e.message||'Pendaftaran seminar gagal.','err')}finally{load(false);validateSeminar()}
}

async function loadLogs(){let rows=demo.logs;if(hasSupabaseConfiguration){let q=supabaseClient.from('logbook_bimbingan').select('*').order('tanggal',{ascending:false});if(!staff())q=q.eq('user_id',state.user.id);const r=await q;if(!r.error)rows=r.data||[]}$('#logRows').innerHTML=rows.length?rows.map(x=>`<tr class="border-t"><td class="p-4 font-bold">${esc(fmt(x.tanggal))}</td><td class="p-4">${esc(x.uraian)}</td><td class="p-4 text-slate-500">${esc(x.catatan_dosen||'Belum ada catatan')}</td><td class="p-4">${x.file_url?`<a class="font-bold text-blue-700" target="_blank" href="${esc(x.file_url)}">Buka ↗</a>`:'-'}</td><td class="p-4"><span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">${esc(x.status_approval||'Menunggu')}</span></td></tr>`).join(''):'<tr><td colspan="5" class="p-8 text-center text-slate-500">Belum ada logbook.</td></tr>'}
async function submitLog(ev){ev.preventDefault();load(true);const p={user_id:state.user?.id||null,nim:state.profile?.nim||null,tanggal:$('#logDate').value,uraian:$('#logDesc').value.trim(),file_url:$('#logUrl').value.trim(),status_approval:'Menunggu'};try{if(hasSupabaseConfiguration){const r=await supabaseClient.from('logbook_bimbingan').insert(p);if(r.error)throw r.error}else demo.logs.unshift(p);modal('#logModal',false);$('#logForm').reset();toast('Logbook berhasil disimpan.');await loadLogs()}catch(e){toast(e.message||'Logbook gagal.','err')}finally{load(false)}}

async function loadReports(){let rows=demo.reports;if(hasSupabaseConfiguration){const r=await supabaseClient.from('nilai_skripsi').select('*').order('nama');if(!r.error)rows=r.data||[]}state.report=rows;$('#reportRows').innerHTML=rows.length?rows.map(x=>`<tr class="border-t"><td class="p-4">${esc(x.nim)}</td><td class="p-4 font-bold">${esc(x.nama)}</td><td class="p-4 text-center">${esc(x.prodi)}</td><td class="p-4 text-center">${x.nilai_proposal??'-'}</td><td class="p-4 text-center">${x.nilai_bimbingan??'-'}</td><td class="p-4 text-center">${x.nilai_hasil??'-'}</td><td class="p-4 text-center">${x.nilai_ujian??'-'}</td><td class="p-4 text-center font-black text-emerald-700">${x.nilai_akhir??'-'}</td><td class="p-4">${esc(x.status_sidang)}</td></tr>`).join(''):'<tr><td colspan="9" class="p-8 text-center text-slate-500">Belum ada data.</td></tr>'}
function csv(){if(!state.report.length)return;const h=['NIM','Nama','Prodi','Proposal','Bimbingan','Hasil','Ujian','Akhir','Status'],rows=state.report.map(x=>[x.nim,x.nama,x.prodi,x.nilai_proposal,x.nilai_bimbingan,x.nilai_hasil,x.nilai_ujian,x.nilai_akhir,x.status_sidang]),text=[h,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='SIMASI-Rekap-Nilai.csv';a.click();URL.revokeObjectURL(url)}
function pdf(){if(!state.report.length)return;const w=window.open('','_blank'),rows=state.report.map(x=>`<tr><td>${esc(x.nim)}</td><td>${esc(x.nama)}</td><td>${esc(x.prodi)}</td><td>${x.nilai_proposal}</td><td>${x.nilai_bimbingan}</td><td>${x.nilai_hasil}</td><td>${x.nilai_ujian}</td><td>${x.nilai_akhir}</td><td>${esc(x.status_sidang)}</td></tr>`).join('');w.document.write(`<h1>SIMASI - Rekap Nilai</h1><style>body{font-family:Arial;padding:30px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:7px}</style><table><tr><th>NIM</th><th>Nama</th><th>Prodi</th><th>Proposal</th><th>Bimbingan</th><th>Hasil</th><th>Ujian</th><th>Akhir</th><th>Status</th></tr>${rows}</table><script>window.onload=()=>window.print()<\/script>`);w.document.close()}

async function profile(){if(!state.user)return;const r=await supabaseClient.from('profiles').select('*').eq('id',state.user.id).maybeSingle();state.profile=r.data||{full_name:state.user.user_metadata?.full_name||state.user.email,role:'mahasiswa'}}
async function login(ev){ev.preventDefault();if(!hasSupabaseConfiguration){$('#loginMsg').className='mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700';$('#loginMsg').textContent='Supabase belum dikonfigurasi. Tambahkan environment variable di Vercel.';return}const btn=$('#loginBtn');btn.disabled=true;btn.textContent='Memverifikasi...';const r=await supabaseClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(r.error){$('#loginMsg').className='mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700';$('#loginMsg').textContent=r.error.message}else{state.user=r.data.user;await profile();authUI();toast('Login berhasil.');showPage('dashboard')}btn.disabled=false;btn.textContent='Masuk'}
async function logout(){if(hasSupabaseConfiguration)await supabaseClient.auth.signOut();state.user=null;state.profile=null;authUI();showPage('dashboard')}

function bind(){
 $$('[data-page]').forEach(e=>e.addEventListener('click',()=>showPage(e.dataset.page)));$('#openSidebar').onclick=()=>{$('#sidebar').classList.remove('-translate-x-full');$('#overlay').classList.remove('hidden')};$('#closeSidebar').onclick=$('#overlay').onclick=()=>{$('#sidebar').classList.add('-translate-x-full');$('#overlay').classList.add('hidden')}
 $('#nimForm').addEventListener('submit',checkNim);$('#skripsiForm').addEventListener('submit',submitSkripsi);$$('[data-close]').forEach(e=>e.onclick=()=>modal('#'+e.dataset.close,false));$$('[data-prodi]').forEach(e=>e.onclick=()=>chooseProdi(e));$('#changeProdi').onclick=()=>{state.prodi=null;$('#seminarForm').classList.add('hidden');$$('.prodi-card').forEach(x=>x.classList.remove('selected'))};$$('input[name="examType"]').forEach(e=>e.onchange=()=>{$('#extraDocs').classList.toggle('hidden',e.value!=='Ujian Tutup Skripsi'||!e.checked);validateSeminar()});$('#semNim').oninput=$('#semNama').oninput=validateSeminar;$('#seminarForm').addEventListener('submit',submitSeminar)
 $('#addLogbook').onclick=()=>{if(hasSupabaseConfiguration&&!auth()){showPage('login');return}$('#logDate').value=new Date().toISOString().slice(0,10);modal('#logModal',true)};$('#logForm').addEventListener('submit',submitLog);$('#csvBtn').onclick=csv;$('#pdfBtn').onclick=pdf;$('#loginForm').addEventListener('submit',login);$('#logoutBtn').onclick=logout
}

async function init(){
 const badge=$('#dbStatus');if(hasSupabaseConfiguration){badge.textContent='Supabase Terhubung';badge.className='hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 md:block'}else{badge.textContent='Mode Demo';badge.className='hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 md:block'}
 bind();renderDocs();if(hasSupabaseConfiguration){const r=await supabaseClient.auth.getSession();state.user=r.data.session?.user||null;if(state.user)await profile();supabaseClient.auth.onAuthStateChange(async(_e,s)=>{state.user=s?.user||null;if(state.user)await profile();else state.profile=null;authUI()})}authUI();await Promise.all([loadDashboard(),loadKuliah()]);validateSeminar()
}
init()
