import { $, $$, esc, fmt, state, DOCS, MAX_FILE, normalizeNim, normalizeProdi, supabaseClient, edge, toast, loading, statusBadge } from './core.js'

export async function loadLandingData(){
  const [stats,ann]=await Promise.all([
    supabaseClient.rpc('get_dashboard_stats'),
    supabaseClient.from('pengumuman').select('id,judul,isi,tanggal').eq('is_active',true).order('tanggal',{ascending:false}).limit(6)
  ])
  const s=Array.isArray(stats.data)?stats.data[0]:stats.data
  if($('#landingStudents'))$('#landingStudents').textContent=s?.mahasiswa_aktif??0
  if($('#landingTitles'))$('#landingTitles').textContent=s?.judul_diajukan??0
  if($('#landingGraduated'))$('#landingGraduated').textContent=s?.lulus_sidang??0
  if($('#landingAnnouncements'))$('#landingAnnouncements').innerHTML=ann.data?.length?ann.data.map(a=>`<article class="simasi-card p-5"><p class="text-xs font-extrabold uppercase text-emerald-700">${esc(fmt(a.tanggal))}</p><h3 class="mt-2 font-extrabold">${esc(a.judul)}</h3><p class="mt-2 text-sm leading-6 text-slate-500">${esc(a.isi)}</p></article>`).join(''):'<div class="simasi-card p-5 text-sm text-slate-500">Belum ada pengumuman aktif.</div>'
}

export async function loadAdminDashboard(){
  loading(true,'Memuat dashboard admin...')
  try{
    const [students,regs]=await Promise.all([
      supabaseClient.from('mahasiswa').select('id',{count:'exact',head:true}),
      supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false})
    ])
    if(students.error)throw students.error
    if(regs.error)throw regs.error
    state.registrations=regs.data||[]
    const pending=state.registrations.filter(r=>r.status==='diajukan').length
    const approved=state.registrations.filter(r=>r.status==='disetujui').length
    const cards=$$('#adminStats > div')
    ;[students.count||0,state.registrations.length,pending,approved].forEach((v,i)=>{if(cards[i])cards[i].querySelector('p:last-child').textContent=v})
    const recent=state.registrations.slice(0,5)
    if($('#recentRegs'))$('#recentRegs').innerHTML=recent.length?recent.map(r=>`<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="text-xs text-slate-500">${esc(r.nim)} • ${esc(r.prodi)}</div></td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4 text-slate-500">${fmt(r.created_at)}</td></tr>`).join(''):'<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada pendaftaran.</td></tr>'
  }catch(e){toast(e.message||'Dashboard admin gagal dimuat.','err')}finally{loading(false)}
}

export async function loadRegistrations(){
  loading(true,'Memuat pendaftar...')
  try{
    const [r,d]=await Promise.all([
      supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('berkas_seminar').select('id,pendaftaran_id,nama_berkas,file_url,status').order('created_at')
    ])
    if(r.error)throw r.error
    if(d.error)throw d.error
    state.registrations=r.data||[]; state.docs=d.data||[]
    renderRegistrationRows()
  }catch(e){toast(e.message||'Gagal memuat pendaftar.','err')}finally{loading(false)}
}
export function renderRegistrationRows(){
  if(!$('#registrationRows'))return
  const q=String($('#regSearch')?.value||'').toLowerCase(),p=$('#regProdi')?.value||'',t=$('#regType')?.value||'',s=$('#regStatus')?.value||''
  const rows=state.registrations.filter(r=>(!q||`${r.nim} ${r.nama}`.toLowerCase().includes(q))&&(!p||r.prodi===p)&&(!t||r.jenis_ujian===t)&&(!s||r.status===s))
  $('#registrationRows').innerHTML=rows.length?rows.map(r=>{const docs=state.docs.filter(d=>d.pendaftaran_id===r.id);return `<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="text-xs text-slate-500">${esc(r.nim)}</div><div class="mt-1 text-[10px] text-slate-400">${fmt(r.created_at)}</div></td><td class="p-4">${esc(r.prodi)}</td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4"><button data-action="view-docs" data-id="${r.id}" class="font-extrabold text-emerald-700">${docs.length} berkas</button></td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4"><select data-action="set-status" data-id="${r.id}" class="rounded-lg border px-2 py-2 text-xs"><option value="diajukan" ${r.status==='diajukan'?'selected':''}>Diajukan</option><option value="diverifikasi" ${r.status==='diverifikasi'?'selected':''}>Diverifikasi</option><option value="perbaikan" ${r.status==='perbaikan'?'selected':''}>Perbaikan</option><option value="disetujui" ${r.status==='disetujui'?'selected':''}>Disetujui</option></select></td></tr>`}).join(''):'<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada data sesuai filter.</td></tr>'
}
export function showDocs(id){
  const reg=state.registrations.find(r=>r.id===id),docs=state.docs.filter(d=>d.pendaftaran_id===id)
  document.body.insertAdjacentHTML('beforeend',`<div id="docsModal" class="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/60 p-4"><div class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"><div class="flex justify-between"><div><h3 class="text-xl font-extrabold">Berkas ${esc(reg?.nama||'')}</h3><p class="mt-1 text-xs text-slate-500">${esc(reg?.nim||'')} • ${esc(reg?.jenis_ujian||'')}</p></div><button data-action="close-docs" class="rounded-xl border px-3">✕</button></div><div class="mt-5 space-y-3">${docs.length?docs.map(d=>`<div class="flex items-center justify-between gap-3 rounded-xl border p-4"><span class="text-sm font-bold">${esc(d.nama_berkas)}</span>${d.file_url?`<a href="${esc(d.file_url)}" target="_blank" rel="noopener" class="text-xs font-extrabold text-emerald-700">Buka Drive ↗</a>`:'<span class="text-xs text-slate-400">Tidak ada tautan</span>'}</div>`).join(''):'<p class="text-sm text-slate-500">Belum ada berkas tersimpan.</p>'}</div></div></div>`)
}

async function loadScript(src,globalName){if(window[globalName])return window[globalName];await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});return window[globalName]}
function rowsToStudents(rows){
  const data=rows.map(r=>Array.isArray(r)?r.map(v=>String(v??'').trim()):[]);let h=-1,n=-1,a=-1,p=-1
  for(let i=0;i<Math.min(data.length,15);i++){const head=data[i].map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));n=head.findIndex(x=>x==='nim'||x.includes('nomorindukmahasiswa'));a=head.findIndex(x=>x==='nama'||x.includes('namamahasiswa'));p=head.findIndex(x=>x==='prodi'||x.includes('programstudi'));if(n>=0&&a>=0&&p>=0){h=i;break}}
  if(h<0)throw new Error('Kolom NIM, Nama, dan Program Studi tidak ditemukan.')
  return data.slice(h+1).map(r=>({nim:normalizeNim(r[n]),nama:String(r[a]||'').trim(),prodi:normalizeProdi(r[p])})).filter(x=>x.nim&&x.nama&&x.prodi)
}
export async function parseImport(file){
  if(file.name.toLowerCase().endsWith('.pdf')){
    const pdfjs=await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib')
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,lines=[]
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),c=await page.getTextContent(),groups=[];for(const item of c.items){const x=item.transform?.[4]??0,y=item.transform?.[5]??0;let g=groups.find(z=>Math.abs(z.y-y)<=2);if(!g){g={y,items:[]};groups.push(g)}g.items.push({x,text:item.str})}groups.sort((a,b)=>b.y-a.y);for(const g of groups)lines.push(g.items.sort((a,b)=>a.x-b.x).map(z=>z.text).join(' ').replace(/\s+/g,' ').trim())}
    const out=[]
    for(const line of lines){const prodi=normalizeProdi(line);if(!prodi)continue;const tokens=[...line.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._-]{6,19}\b/g)].filter(m=>/\d{5,}/.test(m[0]));if(!tokens.length)continue;const m=tokens[0],pi=line.toLowerCase().indexOf(prodi.toLowerCase());const nama=line.slice((m.index||0)+m[0].length,pi).replace(/^[|;,:\-\s]+|[|;,:\-\s]+$/g,'').replace(/^\d+\s+/,'').trim();if(nama)out.push({nim:normalizeNim(m[0]),nama,prodi})}
    if(!out.length)throw new Error('Tidak menemukan data mahasiswa pada PDF. Pastikan PDF berbasis teks.')
    return out
  }
  const XLSX=await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX')
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]]
  return rowsToStudents(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''}))
}
export function renderImportRows(){
  if(!$('#importRows'))return
  const map=new Map();for(const r of state.importRows)map.set(r.nim,r);state.importRows=[...map.values()]
  $('#importCount').textContent=state.importRows.length;$('#importProdiCount').textContent=new Set(state.importRows.map(r=>r.prodi)).size;$('#importExecute').disabled=!state.importRows.length
  $('#importRows').innerHTML=state.importRows.length?state.importRows.map((r,i)=>`<tr class="border-t"><td class="p-4 text-slate-500">${i+1}</td><td class="p-4 font-extrabold">${esc(r.nim)}</td><td class="p-4">${esc(r.nama)}</td><td class="p-4">${esc(r.prodi)}</td></tr>`).join(''):'<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada data.</td></tr>'
}
export async function doImport(){
  if(!state.importRows.length)return
  const actorRole=String(state.profile?.role||'').toLowerCase()
  const staffScope=actorRole==='staff'?normalizeProdi(state.profile?.prodi||''):''
  if(actorRole==='staff'){
    if(!staffScope)return toast('Program Studi akun Staff belum ditetapkan. Hubungi Admin.','err')
    const outside=state.importRows.filter(r=>normalizeProdi(r.prodi)!==staffScope)
    if(outside.length)return toast(`Import ditolak: ${outside.length} data berada di luar Prodi ${staffScope}. Pisahkan file sesuai Program Studi Staff.`,'err')
  }
  const box=$('#importResult');loading(true,`Mengimpor ${state.importRows.length} mahasiswa...`)
  try{
    const data=await edge('import-mahasiswa',{students:state.importRows})
    box.className='mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'
    box.innerHTML=`<b>Import selesai.</b><br>Dibuat: ${Number(data.created||0)} • Diperbarui: ${Number(data.updated||0)} • Gagal: ${Number(data.failed||0)}${data.errors?.length?`<div class="mt-2 text-xs">${data.errors.slice(0,10).map(esc).join('<br>')}</div>`:''}`
    box.classList.remove('hidden');toast('Import mahasiswa selesai.')
  }catch(e){box.className='mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700';box.innerHTML=`<b>Import gagal.</b><br>${esc(e.message||'Kesalahan backend.')}`;box.classList.remove('hidden');toast(e.message||'Import gagal.','err')}
  finally{loading(false)}
}
export function downloadTemplate(){const text='\ufeffNIM,Nama,Program Studi\nH011221001,Contoh Mahasiswa,Matematika\n';const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='template_import_mahasiswa_SIMASI.csv';a.click();URL.revokeObjectURL(url)}

export async function loadUsers(){try{loading(true,'Memuat user...');const data=await edge('admin-users',{action:'list'});state.users=data.users||[];renderUserRows()}catch(e){toast(e.message||'Gagal memuat user.','err')}finally{loading(false)}}
export function renderUserRows(){
  if(!$('#userRows'))return
  const q=String($('#userSearch')?.value||'').toLowerCase(),r=$('#userRole')?.value||''
  const rows=state.users.filter(u=>(!q||`${u.full_name} ${u.nim} ${u.email}`.toLowerCase().includes(q))&&(!r||u.role===r))
  $('#userRows').innerHTML=rows.length?rows.map(u=>`<tr class="border-t"><td class="p-4"><b>${esc(u.full_name||'-')}</b><div class="text-xs text-slate-500">${esc(u.email||'-')}</div></td><td class="p-4"><div>${esc(u.nim||'-')}</div><div class="text-xs text-slate-500">${esc(u.prodi||'-')}</div></td><td class="p-4"><select data-action="set-role" data-id="${u.id}" class="rounded-lg border px-2 py-2 text-xs"><option value="mahasiswa" ${u.role==='mahasiswa'?'selected':''}>Mahasiswa</option><option value="staff" ${u.role==='staff'?'selected':''}>Staff</option><option value="dosen" ${u.role==='dosen'?'selected':''}>Dosen</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td><td class="p-4 text-xs text-slate-500">${u.last_sign_in_at?fmt(u.last_sign_in_at):'Belum pernah'}</td><td class="p-4"><div class="flex flex-wrap gap-3">${u.email?`<button data-action="reset-user" data-email="${esc(u.email)}" class="text-xs font-extrabold text-emerald-700">Reset Kata Sandi</button>`:''}<button data-action="delete-user" data-id="${u.id}" data-name="${esc(u.full_name||u.email||u.nim||'User')}" class="text-xs font-extrabold text-rose-600">Hapus Akun</button></div></td></tr>`).join(''):'<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada user.</td></tr>'
}
export async function resetUser(email){
  try{
    loading(true,'Mereset kata sandi...')
    const data=await edge('admin-users',{action:'reset_password',email})
    toast(data?.role==='mahasiswa'?'Password mahasiswa direset ke NIM.':'Password sementara baru berhasil dibuat.')
    await loadUsers()
    return data
  }catch(e){toast(e.message||'Reset kata sandi gagal.','err');return null}finally{loading(false)}
}
export async function deleteUser(id,name='User'){
  if(!id)return null
  const ok=window.confirm(`Hapus akun ${name}?\n\nSemua pengajuan seminar dan file berkas terkait akun ini juga akan dihapus. Data master mahasiswa tetap dipertahankan. Tindakan ini tidak dapat dibatalkan.`)
  if(!ok)return null
  try{
    loading(true,'Menghapus akun dan data terkait...')
    const data=await edge('admin-users',{action:'delete_user',user_id:id})
    toast(`Akun ${data?.full_name||name} berhasil dihapus.`)
    await loadUsers()
    return data
  }catch(e){toast(e.message||'Gagal menghapus akun.','err');return null}finally{loading(false)}
}

export async function createStaff(name,email,role){try{loading(true,'Membuat akun staf...');await edge('admin-users',{action:'create_staff',full_name:name,email,role});$('#staffModal')?.remove();toast('Akun staf dibuat dan email pengaturan password dikirim.');await loadUsers()}catch(e){toast(e.message,'err')}finally{loading(false)}}

export async function loadStudentHistory(){
  if(!$('#studentHistory'))return
  const r=await supabaseClient.from('pendaftaran_seminar').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(5)
  $('#studentHistory').innerHTML=!r.error&&r.data?.length?r.data.map(x=>`<div class="flex items-center justify-between gap-4 border-b py-3 last:border-0"><div><b>${esc(x.jenis_ujian)}</b><div class="mt-1 text-xs text-slate-500">${fmt(x.created_at)} • ${esc(x.prodi)}</div></div>${statusBadge(x.status)}</div>`).join(''):'Belum ada riwayat pendaftaran.'
}

export function validateSeminar(){
  const submit=$('#submitSeminar');if(!submit)return
  const files=DOCS.map(([k])=>$(`.doc-input[data-key="${k}"]`)?.files?.[0]).filter(Boolean),exam=$('input[name="examType"]:checked')?.value
  const validFiles=files.length===DOCS.length&&files.every(f=>f.size<=MAX_FILE&&f.name.toLowerCase().endsWith('.pdf'))
  const ok=Boolean(PRODI.includes(state.selectedProdi)&&exam&&state.profile?.nim&&state.profile?.full_name&&validFiles&&!state.profile?.must_change_password)
  submit.disabled=!ok;$('#docProgress').textContent=`${files.length} / ${DOCS.length}`
  $('#semMessage').textContent=!state.selectedProdi?'Program studi belum tersedia.':!exam?'Pilih Seminar Proposal atau Seminar Hasil.':files.length<DOCS.length?`${DOCS.length-files.length} berkas belum lengkap.`:!ok?'Periksa kembali data pendaftaran.':'Semua berkas lengkap dan siap dikirim.'
}
async function uploadOne(file,meta){
  const form=new FormData();form.append('file',file,file.name);Object.entries(meta).forEach(([k,v])=>form.append(k,String(v??'')))
  const {data,error}=await supabaseClient.functions.invoke('upload-seminar-drive',{body:form})
  if(error){let msg=error.message;try{const res=error.context;if(res?.clone){const j=await res.clone().json();msg=j?.message||j?.error||msg}}catch{}throw new Error(msg||'Upload Drive gagal.')}
  if(data?.ok===false)throw new Error(data.message||'Upload Drive gagal.')
  return data
}
export async function submitSeminar(){
  validateSeminar();if($('#submitSeminar')?.disabled)return
  const exam=$('input[name="examType"]:checked').value,regId=crypto.randomUUID(),nim=normalizeNim(state.profile.nim),nama=state.profile.full_name,prodi=state.selectedProdi
  loading(true,'Membuat pendaftaran...')
  try{
    const reg=await supabaseClient.from('pendaftaran_seminar').insert({id:regId,user_id:state.user.id,nim,nama,prodi,jenis_ujian:exam,pas_foto_jumlah:2,status:'diajukan'})
    if(reg.error)throw reg.error
    for(let i=0;i<DOCS.length;i++){
      const [key,label]=DOCS[i],file=$(`.doc-input[data-key="${key}"]`).files[0]
      loading(true,`Upload ${i+1}/${DOCS.length}: ${label}`)
      const up=await uploadOne(file,{registration_id:regId,nim,nama,prodi,exam_type:exam,document_key:key,document_label:label})
      const saved=await supabaseClient.from('berkas_seminar').insert({pendaftaran_id:regId,jenis_berkas:key,nama_berkas:label,file_url:up.web_view_link||null,file_path:`drive:${up.file_id}`,status:'terunggah',storage_provider:'google_drive',drive_file_id:up.file_id,drive_folder_id:up.folder_id||null})
      if(saved.error)throw saved.error
    }
    toast('Pendaftaran dan 10 berkas berhasil dikirim.')
    return true
  }catch(e){const msg=e.message||'Pendaftaran seminar gagal.';toast(msg,'err');try{await supabaseClient.from('pendaftaran_seminar').update({status:'gagal_upload',catatan_verifikator:msg.slice(0,500)}).eq('id',regId)}catch{};return false}
  finally{loading(false)}
}
