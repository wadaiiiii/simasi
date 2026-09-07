import {
  $, $$, esc, fmt, state, DOCS, PRODI, MAX_FILE, normalizeNim, normalizeProdi,
  supabaseClient, toast, loading, statusBadge, isAdmin
} from '../v4/core.js'

const nowIso=()=>new Date().toISOString()
const docByKey=(docs,key)=>docs.find(d=>d.jenis_berkas===key)
const documentLabel=(key)=>DOCS.find(([k])=>k===key)?.[1]||key

export async function loadAdminDashboard(){
  loading(true,'Memuat dashboard...')
  try{
    const [students,regs]=await Promise.all([
      supabaseClient.from('mahasiswa').select('id',{count:'exact',head:true}),
      supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false})
    ])
    if(students.error)throw students.error
    if(regs.error)throw regs.error
    state.registrations=regs.data||[]
    const pending=state.registrations.filter(r=>['diajukan','diverifikasi','perbaikan'].includes(r.status)).length
    const complete=state.registrations.filter(r=>['lengkap','disetujui'].includes(r.status)).length
    if($('#statStudents'))$('#statStudents').textContent=students.count||0
    if($('#statRegs'))$('#statRegs').textContent=state.registrations.length
    if($('#statPending'))$('#statPending').textContent=pending
    if($('#statComplete'))$('#statComplete').textContent=complete
    const recent=state.registrations.slice(0,5)
    if($('#recentRegs'))$('#recentRegs').innerHTML=recent.length?recent.map(r=>`<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="text-xs text-slate-500">${esc(r.nim)} • ${esc(r.prodi)}</div></td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4 text-slate-500">${fmt(r.created_at)}</td></tr>`).join(''):'<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada pengajuan.</td></tr>'
  }catch(e){toast(e.message||'Dashboard gagal dimuat.','err')}finally{loading(false)}
}

export async function loadRegistrations(){
  loading(true,'Memuat pendaftar...')
  try{
    const [r,d]=await Promise.all([
      supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('berkas_seminar').select('*').order('created_at')
    ])
    if(r.error)throw r.error
    if(d.error)throw d.error
    state.registrations=r.data||[]
    state.docs=d.data||[]
    renderRegistrationRows()
  }catch(e){toast(e.message||'Gagal memuat pendaftar.','err')}finally{loading(false)}
}

export function renderRegistrationRows(){
  if(!$('#registrationRows'))return
  const q=String($('#regSearch')?.value||'').toLowerCase()
  const p=$('#regProdi')?.value||'',t=$('#regType')?.value||'',s=$('#regStatus')?.value||''
  const rows=state.registrations.filter(r=>(!q||`${r.nim} ${r.nama}`.toLowerCase().includes(q))&&(!p||r.prodi===p)&&(!t||r.jenis_ujian===t)&&(!s||r.status===s))
  $('#registrationRows').innerHTML=rows.length?rows.map(r=>{
    const docs=state.docs.filter(d=>d.pendaftaran_id===r.id),valid=docs.filter(d=>d.status==='valid').length,repair=docs.filter(d=>d.status==='perbaikan').length
    const detail=repair?`${repair} perlu perbaikan`:valid===DOCS.length?'10/10 valid':`${docs.length}/10 terunggah • ${valid} valid`
    return `<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="text-xs text-slate-500">${esc(r.nim)}</div><div class="mt-1 text-[10px] text-slate-400">${fmt(r.created_at)}</div></td><td class="p-4">${esc(r.prodi)}</td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4"><span class="text-xs font-bold ${repair?'text-rose-600':valid===DOCS.length?'text-emerald-700':'text-slate-600'}">${esc(detail)}</span></td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4"><button data-action="review-registration" data-id="${r.id}" class="rounded-xl bg-[#182e79] px-3 py-2 text-xs font-extrabold text-white">Periksa Berkas</button></td></tr>`
  }).join(''):'<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada data sesuai filter.</td></tr>'
}

function reviewRow(d,key,label,index){
  if(!d)return `<div class="rounded-2xl border border-rose-100 bg-rose-50/60 p-4"><div class="flex items-center gap-3"><span class="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-xs font-extrabold text-rose-700">${index+1}</span><div><b class="text-sm">${esc(label)}</b><p class="text-xs text-rose-600">Belum terunggah</p></div></div></div>`
  return `<div class="rounded-2xl border p-4" data-review-row="${d.id}"><div class="flex flex-col gap-3 lg:flex-row lg:items-start"><div class="flex min-w-0 flex-1 items-start gap-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-extrabold text-blue-700">${index+1}</span><div class="min-w-0"><b class="text-sm">${esc(label)}</b><div class="mt-1">${statusBadge(d.status)}</div></div></div><div class="flex flex-wrap gap-2"><button data-action="preview-remote-doc" data-url="${esc(d.file_url||'')}" class="rounded-xl border px-3 py-2 text-xs font-extrabold text-blue-700">Preview</button><select data-review-status="${d.id}" class="rounded-xl border px-3 py-2 text-xs"><option value="terunggah" ${d.status==='terunggah'?'selected':''}>Belum Dicek</option><option value="valid" ${d.status==='valid'?'selected':''}>Valid</option><option value="perbaikan" ${d.status==='perbaikan'?'selected':''}>Perbaikan</option></select></div></div><div class="mt-3 flex flex-col gap-2 sm:flex-row"><input data-review-note="${d.id}" value="${esc(d.catatan_verifikator||'')}" class="flex-1 rounded-xl border px-3 py-2 text-xs" placeholder="Catatan untuk mahasiswa (opsional)"><button data-action="save-doc-review" data-id="${d.id}" class="rounded-xl border px-4 py-2 text-xs font-extrabold">Simpan Item</button></div></div>`
}

export async function openAdminReview(id){
  const reg=state.registrations.find(r=>r.id===id)
  if(!reg)return toast('Pendaftaran tidak ditemukan.','err')
  const docs=state.docs.filter(d=>d.pendaftaran_id===id)
  document.querySelector('#registrationReviewModal')?.remove()
  document.body.insertAdjacentHTML('beforeend',`<div id="registrationReviewModal" class="fixed inset-0 z-[950] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"><div class="mx-auto my-4 w-full max-w-4xl rounded-[28px] bg-white shadow-2xl"><div class="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[28px] border-b bg-white/95 p-5 backdrop-blur sm:p-6"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-blue-700">Verifikasi Berkas</p><h3 class="mt-1 text-xl font-extrabold">${esc(reg.nama)}</h3><p class="mt-1 text-xs text-slate-500">${esc(reg.nim)} • ${esc(reg.prodi)} • ${esc(reg.jenis_ujian)}</p><div class="mt-2">${statusBadge(reg.status)}</div></div><button data-action="close-registration-review" class="rounded-xl border px-3 py-2">✕</button></div><div class="p-5 sm:p-6"><div class="grid gap-3">${DOCS.map(([key,label],i)=>reviewRow(docByKey(docs,key),key,label,i)).join('')}</div><div class="mt-6 rounded-2xl bg-slate-50 p-4"><label class="text-xs font-extrabold text-slate-600">Catatan Umum Verifikator</label><textarea id="overallReviewNote" rows="3" class="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm" placeholder="Contoh: perbaiki KRS dan KHS lalu unggah ulang.">${esc(reg.catatan_verifikator||'')}</textarea><div class="mt-4 grid gap-3 sm:grid-cols-3"><button data-action="start-verification" data-id="${id}" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-extrabold text-blue-700">Mulai Verifikasi</button><button data-action="request-revision" data-id="${id}" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700">Minta Perbaikan</button><button data-action="mark-complete" data-id="${id}" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white">Nyatakan Berkas Lengkap</button></div></div></div></div></div>`)
}

export async function saveDocReview(id){
  const status=$(`[data-review-status="${id}"]`)?.value||'terunggah'
  const note=$(`[data-review-note="${id}"]`)?.value.trim()||null
  loading(true,'Menyimpan hasil pemeriksaan...')
  try{
    const payload={status,catatan_verifikator:note,verified_by:status==='valid'?state.user.id:null,verified_at:status==='valid'?nowIso():null}
    const r=await supabaseClient.from('berkas_seminar').update(payload).eq('id',id)
    if(r.error)throw r.error
    const item=state.docs.find(d=>d.id===id);if(item)Object.assign(item,payload)
    toast('Hasil pemeriksaan berkas disimpan.')
  }catch(e){toast(e.message||'Gagal menyimpan pemeriksaan.','err')}finally{loading(false)}
}

export async function startVerification(id){
  const r=await supabaseClient.from('pendaftaran_seminar').update({status:'diverifikasi',verified_by:state.user.id,verified_at:nowIso(),catatan_verifikator:$('#overallReviewNote')?.value.trim()||null}).eq('id',id)
  if(r.error)return toast(r.error.message,'err')
  toast('Pendaftaran masuk tahap verifikasi.');await loadRegistrations();document.querySelector('#registrationReviewModal')?.remove()
}

export async function requestRevision(id){
  const docs=state.docs.filter(d=>d.pendaftaran_id===id)
  if(!docs.some(d=>d.status==='perbaikan'))return toast('Tandai minimal satu berkas sebagai Perbaikan terlebih dahulu.','info')
  const note=$('#overallReviewNote')?.value.trim()||'Silakan perbaiki berkas yang ditandai.'
  const r=await supabaseClient.from('pendaftaran_seminar').update({status:'perbaikan',catatan_verifikator:note,revision_requested_at:nowIso(),verified_by:state.user.id}).eq('id',id)
  if(r.error)return toast(r.error.message,'err')
  toast('Permintaan perbaikan dikirim ke mahasiswa.');await loadRegistrations();document.querySelector('#registrationReviewModal')?.remove()
}

export async function markComplete(id){
  const docs=state.docs.filter(d=>d.pendaftaran_id===id)
  if(docs.length!==DOCS.length)return toast(`Belum lengkap: baru ${docs.length}/${DOCS.length} berkas tersimpan.`,'info')
  if(!docs.every(d=>d.status==='valid'))return toast('Semua 10 berkas harus berstatus Valid sebelum dinyatakan lengkap.','info')
  const r=await supabaseClient.from('pendaftaran_seminar').update({status:'lengkap',catatan_verifikator:$('#overallReviewNote')?.value.trim()||'Berkas dinyatakan lengkap.',completed_at:nowIso(),verified_at:nowIso(),verified_by:state.user.id}).eq('id',id)
  if(r.error)return toast(r.error.message,'err')
  toast('Berkas pendaftaran dinyatakan lengkap.');await loadRegistrations();document.querySelector('#registrationReviewModal')?.remove()
}

export async function loadStudentHistory(){
  if(!$('#studentHistory'))return
  const r=await supabaseClient.from('pendaftaran_seminar').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(5)
  $('#studentHistory').innerHTML=!r.error&&r.data?.length?r.data.map(x=>`<button data-action="student-application-detail" data-id="${x.id}" class="flex w-full items-center justify-between gap-4 border-b py-3 text-left last:border-0"><div><b>${esc(x.jenis_ujian)}</b><div class="mt-1 text-xs text-slate-500">${fmt(x.created_at)} • ${esc(x.prodi)}</div></div>${statusBadge(x.status)}</button>`).join(''):'Belum ada riwayat pendaftaran.'
}

export async function loadStudentApplications(){
  loading(true,'Memuat pengajuan Anda...')
  try{
    const [r,d]=await Promise.all([
      supabaseClient.from('pendaftaran_seminar').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}),
      supabaseClient.from('berkas_seminar').select('*').order('created_at')
    ])
    if(r.error)throw r.error;if(d.error)throw d.error
    state.studentApplications=r.data||[]
    const ids=new Set(state.studentApplications.map(x=>x.id));state.docs=(d.data||[]).filter(x=>ids.has(x.pendaftaran_id))
    renderStudentApplications()
  }catch(e){toast(e.message||'Gagal memuat pengajuan.','err')}finally{loading(false)}
}

function timeline(status){
  const order=['diajukan','diverifikasi','lengkap'],current=status==='perbaikan'?'diverifikasi':status==='disetujui'?'lengkap':status
  const currentIndex=Math.max(0,order.indexOf(current))
  return `<div class="grid grid-cols-3 gap-2">${order.map((s,i)=>`<div><div class="h-2 rounded-full ${i<=currentIndex?'bg-[linear-gradient(90deg,#0a7bb5,#2235ae)]':'bg-slate-200'}"></div><p class="mt-2 text-[10px] font-bold ${i<=currentIndex?'text-[#2235ae]':'text-slate-400'}">${s==='diajukan'?'Diajukan':s==='diverifikasi'?'Verifikasi':'Lengkap'}</p></div>`).join('')}</div>`
}

export function renderStudentApplications(){
  const box=$('#studentApplicationList');if(!box)return
  box.innerHTML=state.studentApplications.length?state.studentApplications.map(r=>{
    const docs=state.docs.filter(d=>d.pendaftaran_id===r.id),valid=docs.filter(d=>d.status==='valid').length,repair=docs.filter(d=>d.status==='perbaikan').length
    return `<article class="simasi-card p-5 sm:p-6"><div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.12em] text-blue-700">${esc(r.jenis_ujian)}</p><h3 class="mt-1 text-xl font-extrabold">${esc(r.prodi)}</h3><p class="mt-1 text-xs text-slate-500">Diajukan ${fmt(r.created_at)}</p></div>${statusBadge(r.status)}</div><div class="mt-5">${timeline(r.status)}</div><div class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-xl bg-slate-50 p-3"><p class="text-[10px] font-bold uppercase text-slate-400">Berkas</p><p class="mt-1 font-extrabold">${docs.length}/10</p></div><div class="rounded-xl bg-slate-50 p-3"><p class="text-[10px] font-bold uppercase text-slate-400">Valid</p><p class="mt-1 font-extrabold text-emerald-700">${valid}/10</p></div><div class="rounded-xl ${repair?'bg-rose-50':'bg-slate-50'} p-3"><p class="text-[10px] font-bold uppercase text-slate-400">Perbaikan</p><p class="mt-1 font-extrabold ${repair?'text-rose-600':''}">${repair}</p></div></div>${r.catatan_verifikator?`<div class="mt-4 rounded-xl border ${r.status==='perbaikan'?'border-rose-100 bg-rose-50 text-rose-700':'border-blue-100 bg-blue-50 text-blue-800'} p-4 text-sm"><b>Catatan verifikator:</b><div class="mt-1">${esc(r.catatan_verifikator)}</div></div>`:''}<button data-action="student-application-detail" data-id="${r.id}" class="mt-5 rounded-xl border px-4 py-2.5 text-sm font-extrabold">Lihat Detail & Berkas</button></article>`
  }).join(''):'<div class="simasi-card p-8 text-center text-sm text-slate-500">Belum ada pengajuan seminar.</div>'
}

export function openStudentApplication(id){
  const reg=(state.studentApplications.length?state.studentApplications:state.registrations).find(r=>r.id===id)
  if(!reg)return toast('Pengajuan tidak ditemukan.','err')
  const docs=state.docs.filter(d=>d.pendaftaran_id===id)
  document.querySelector('#studentApplicationModal')?.remove()
  const rows=DOCS.map(([key,label],i)=>{
    const d=docByKey(docs,key),canFix=['perbaikan','diajukan'].includes(reg.status)&&(!d||d.status==='perbaikan')
    return `<div class="rounded-2xl border p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-start"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-extrabold text-blue-700">${i+1}</span><div class="min-w-0 flex-1"><b class="text-sm">${esc(label)}</b><div class="mt-1">${d?statusBadge(d.status):'<span class="text-xs text-rose-600">Belum terunggah</span>'}</div>${d?.catatan_verifikator?`<p class="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">${esc(d.catatan_verifikator)}</p>`:''}</div><div class="flex flex-wrap gap-2">${d?.file_url?`<button data-action="preview-remote-doc" data-url="${esc(d.file_url)}" class="rounded-xl border px-3 py-2 text-xs font-extrabold text-blue-700">Preview</button>`:''}</div></div>${canFix?`<div class="mt-3 flex flex-col gap-2 sm:flex-row"><label class="flex-1 cursor-pointer rounded-xl border border-dashed bg-slate-50 px-3 py-2 text-center text-xs font-bold"><input data-revision-input="${key}" type="file" accept="application/pdf,.pdf" class="hidden"><span data-revision-name="${key}">${d?'Pilih PDF pengganti':'Pilih PDF'}</span></label><button data-action="upload-revision" data-registration="${id}" data-key="${key}" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white">Unggah ${d?'Perbaikan':'Berkas'}</button></div>`:''}</div>`
  }).join('')
  document.body.insertAdjacentHTML('beforeend',`<div id="studentApplicationModal" class="fixed inset-0 z-[950] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"><div class="mx-auto my-4 w-full max-w-3xl rounded-[28px] bg-white shadow-2xl"><div class="sticky top-0 z-10 flex items-start justify-between rounded-t-[28px] border-b bg-white/95 p-5 backdrop-blur"><div><h3 class="text-xl font-extrabold">${esc(reg.jenis_ujian)}</h3><p class="mt-1 text-xs text-slate-500">${esc(reg.prodi)} • ${fmt(reg.created_at)}</p><div class="mt-2">${statusBadge(reg.status)}</div></div><button data-action="close-student-application" class="rounded-xl border px-3 py-2">✕</button></div><div class="p-5"><div class="mb-5">${timeline(reg.status)}</div>${reg.catatan_verifikator?`<div class="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><b>Catatan verifikator:</b><div class="mt-1">${esc(reg.catatan_verifikator)}</div></div>`:''}<div class="grid gap-3">${rows}</div></div></div></div>`)
}

export function validateSeminar(showToast=false){
  const submit=$('#submitSeminar');if(!submit)return {ok:false,message:'Form tidak tersedia.'}
  const exam=$('input[name="examType"]:checked')?.value
  const files=DOCS.map(([k])=>$(`.doc-input[data-key="${k}"]`)?.files?.[0]).filter(Boolean)
  let message='Semua berkas lengkap dan siap dikirim.',ok=true
  if(!PRODI.includes(state.selectedProdi)){ok=false;message='Program studi belum tersedia atau belum sesuai data akun.'}
  else if(!exam){ok=false;message='Pilih Seminar Proposal atau Seminar Hasil.'}
  else if(!state.profile?.nim||!state.profile?.full_name){ok=false;message='Identitas akun mahasiswa belum lengkap.'}
  else if(files.length<DOCS.length){ok=false;message=`${DOCS.length-files.length} berkas belum lengkap.`}
  else if(files.some(f=>f.size>MAX_FILE||!f.name.toLowerCase().endsWith('.pdf'))){ok=false;message='Pastikan seluruh berkas PDF dan maksimal 2 MB.'}
  else if(state.profile?.must_change_password){ok=false;message='Ganti password awal sebelum melakukan pendaftaran.'}
  submit.dataset.ready=String(ok)
  submit.classList.toggle('opacity-60',!ok)
  if($('#docProgress'))$('#docProgress').textContent=`${files.length} / ${DOCS.length}`
  if($('#semMessage')){$('#semMessage').textContent=message;$('#semMessage').className=`text-xs ${ok?'font-bold text-emerald-700':'text-slate-500'}`}
  if(showToast&&!ok)toast(message,'info')
  return {ok,message}
}

async function uploadOne(file,meta){
  const form=new FormData();form.append('file',file,file.name)
  Object.entries({...meta,persist_metadata:'true'}).forEach(([k,v])=>form.append(k,String(v??'')))
  const {data,error}=await supabaseClient.functions.invoke('upload-seminar-drive',{body:form})
  if(error){let msg=error.message;try{const res=error.context;if(res?.clone){const j=await res.clone().json();msg=j?.message||j?.error||msg}}catch{}throw new Error(msg||'Upload Drive gagal.')}
  if(data?.ok===false)throw new Error(data.message||'Upload Drive gagal.')
  return data
}

function setSubmitProgress(done,total,label){
  const box=$('#submitProgressBox');if(box)box.classList.remove('hidden')
  const pct=Math.round((done/total)*100)
  if($('#submitProgressText'))$('#submitProgressText').textContent=label
  if($('#submitProgressCount'))$('#submitProgressCount').textContent=`${pct}%`
  if($('#submitProgressBar'))$('#submitProgressBar').style.width=`${pct}%`
}

export async function submitSeminar(){
  const check=validateSeminar(true);if(!check.ok)return false
  const exam=$('input[name="examType"]:checked').value,nim=normalizeNim(state.profile.nim),nama=state.profile.full_name,prodi=state.selectedProdi
  loading(true,'Memeriksa pengajuan aktif...')
  let regId=''
  try{
    const existing=await supabaseClient.from('pendaftaran_seminar').select('id,status').eq('user_id',state.user.id).eq('jenis_ujian',exam).in('status',['diajukan','diverifikasi','perbaikan']).limit(1)
    if(existing.error)throw existing.error
    if(existing.data?.length)throw new Error(`Masih ada pengajuan ${exam} yang aktif. Pantau atau lengkapi melalui menu Monitor Pengajuan.`)
    regId=crypto.randomUUID()
    const reg=await supabaseClient.from('pendaftaran_seminar').insert({id:regId,user_id:state.user.id,nim,nama,prodi,jenis_ujian:exam,pas_foto_jumlah:2,status:'diajukan'})
    if(reg.error)throw reg.error
    for(let i=0;i<DOCS.length;i++){
      const [key,label]=DOCS[i],file=$(`.doc-input[data-key="${key}"]`).files[0]
      setSubmitProgress(i,DOCS.length,`Mengunggah ${i+1}/${DOCS.length}: ${label}`)
      loading(true,`Upload ${i+1}/${DOCS.length}: ${label}`)
      await uploadOne(file,{registration_id:regId,nim,nama,prodi,exam_type:exam,document_key:key,document_label:label})
      setSubmitProgress(i+1,DOCS.length,`${i+1}/${DOCS.length} berkas berhasil diunggah`)
    }
    toast('Pendaftaran dan 10 berkas berhasil dikirim.')
    return regId
  }catch(e){
    const suffix=regId?' Pengajuan tersimpan dan dapat dilanjutkan melalui Monitor Pengajuan.':''
    toast(`${e.message||'Pendaftaran seminar gagal.'}${suffix}`,'err')
    return false
  }finally{loading(false)}
}

function openPreview(url,title='Preview Berkas',revoke=false){
  document.querySelector('#pdfPreviewModal')?.remove()
  document.body.insertAdjacentHTML('beforeend',`<div id="pdfPreviewModal" data-revoke="${revoke?'true':'false'}" data-url="${esc(url)}" class="fixed inset-0 z-[1000] flex flex-col bg-slate-950/80 p-3 backdrop-blur-sm"><div class="mx-auto flex w-full max-w-5xl items-center justify-between rounded-t-2xl bg-white px-4 py-3"><div class="min-w-0"><p class="truncate text-sm font-extrabold">${esc(title)}</p></div><div class="flex gap-2"><a href="${esc(url)}" target="_blank" rel="noopener" class="rounded-xl border px-3 py-2 text-xs font-bold">Buka Tab Baru</a><button data-action="close-pdf-preview" class="rounded-xl border px-3 py-2">✕</button></div></div><iframe src="${esc(url)}" class="mx-auto h-full min-h-0 w-full max-w-5xl rounded-b-2xl bg-white" title="Preview PDF"></iframe></div>`)
}
export function closePreview(){const m=$('#pdfPreviewModal');if(!m)return;if(m.dataset.revoke==='true')URL.revokeObjectURL(m.dataset.url);m.remove()}
export function previewRemote(url){if(!url)return toast('Tautan preview tidak tersedia.','info');openPreview(url,'Preview Berkas')}
export function previewLocal(key){const file=$(`.doc-input[data-key="${key}"]`)?.files?.[0];if(!file)return toast('Pilih PDF terlebih dahulu.','info');openPreview(URL.createObjectURL(file),documentLabel(key),true)}
export function previewAllLocal(){
  const files=DOCS.map(([key,label])=>({key,label,file:$(`.doc-input[data-key="${key}"]`)?.files?.[0]})).filter(x=>x.file)
  if(!files.length)return toast('Belum ada berkas untuk dipreview.','info')
  document.querySelector('#allDocsPreviewModal')?.remove()
  document.body.insertAdjacentHTML('beforeend',`<div id="allDocsPreviewModal" class="fixed inset-0 z-[970] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"><div class="mx-auto my-5 max-w-2xl rounded-3xl bg-white p-5"><div class="flex items-center justify-between"><div><h3 class="text-xl font-extrabold">Preview Berkas Pilihan</h3><p class="mt-1 text-xs text-slate-500">${files.length}/${DOCS.length} PDF siap.</p></div><button data-action="close-all-preview" class="rounded-xl border px-3 py-2">✕</button></div><div class="mt-5 grid gap-3">${DOCS.map(([key,label],i)=>{const found=files.find(x=>x.key===key);return `<div class="flex items-center gap-3 rounded-xl border p-3"><span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-blue-700">${i+1}</span><div class="min-w-0 flex-1"><b class="text-sm">${esc(label)}</b><p class="truncate text-xs text-slate-500">${esc(found?.file?.name||'Belum dipilih')}</p></div>${found?`<button data-action="preview-local-doc" data-key="${key}" class="rounded-xl border px-3 py-2 text-xs font-bold text-blue-700">Preview</button>`:''}</div>`}).join('')}</div></div></div>`)
}

export async function uploadRevision(registrationId,key){
  const input=$(`[data-revision-input="${key}"]`),file=input?.files?.[0]
  if(!file)return toast('Pilih PDF yang akan diunggah.','info')
  if(!file.name.toLowerCase().endsWith('.pdf')||file.size>MAX_FILE)return toast('Berkas harus PDF maksimal 2 MB.','err')
  const reg=state.studentApplications.find(r=>r.id===registrationId)
  if(!reg)return toast('Pengajuan tidak ditemukan.','err')
  loading(true,`Mengunggah ${documentLabel(key)}...`)
  try{
    await uploadOne(file,{registration_id:registrationId,nim:reg.nim,nama:reg.nama,prodi:reg.prodi,exam_type:reg.jenis_ujian,document_key:key,document_label:documentLabel(key)})
    toast('Berkas berhasil diunggah.');document.querySelector('#studentApplicationModal')?.remove();await loadStudentApplications();openStudentApplication(registrationId)
  }catch(e){toast(e.message||'Upload perbaikan gagal.','err')}finally{loading(false)}
}

export function revisionFileChanged(key,file){const el=$(`[data-revision-name="${key}"]`);if(el)el.textContent=file?.name||'Pilih PDF'}

export async function loadAnnouncementsAdmin(){
  loading(true,'Memuat informasi akademik...')
  try{const r=await supabaseClient.from('pengumuman').select('*').order('tanggal',{ascending:false}).order('created_at',{ascending:false});if(r.error)throw r.error;state.announcements=r.data||[];renderAnnouncementsAdmin()}catch(e){toast(e.message||'Gagal memuat informasi.','err')}finally{loading(false)}
}
export function renderAnnouncementsAdmin(){
  const box=$('#announcementRows');if(!box)return
  box.innerHTML=state.announcements.length?state.announcements.map(a=>`<article class="p-5"><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="text-xs font-extrabold text-blue-700">${fmt(a.tanggal)}</span><span class="rounded-full px-2 py-1 text-[10px] font-bold ${a.is_active?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}">${a.is_active?'Tampil':'Disembunyikan'}</span></div><h4 class="mt-2 font-extrabold">${esc(a.judul)}</h4><p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">${esc(a.isi)}</p></div><div class="flex shrink-0 gap-2"><button data-action="edit-announcement" data-id="${a.id}" class="rounded-xl border px-3 py-2 text-xs font-bold">Edit</button><button data-action="toggle-announcement" data-id="${a.id}" class="rounded-xl border px-3 py-2 text-xs font-bold">${a.is_active?'Sembunyikan':'Tampilkan'}</button>${isAdmin()?`<button data-action="delete-announcement" data-id="${a.id}" class="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600">Hapus</button>`:''}</div></div></article>`).join(''):'<div class="p-6 text-sm text-slate-500">Belum ada informasi akademik.</div>'
}
export function resetAnnouncementForm(){if(!$('#announcementForm'))return;$('#announcementForm').reset();$('#announcementId').value='';$('#announcementDate').value=new Date().toISOString().slice(0,10);$('#announcementActive').checked=true;$('#announcementFormTitle').textContent='Tambah Informasi'}
export function editAnnouncement(id){const a=state.announcements.find(x=>x.id===id);if(!a)return;$('#announcementId').value=a.id;$('#announcementTitle').value=a.judul;$('#announcementDate').value=String(a.tanggal||'').slice(0,10);$('#announcementBody').value=a.isi;$('#announcementActive').checked=Boolean(a.is_active);$('#announcementFormTitle').textContent='Edit Informasi';$('#announcementForm').scrollIntoView({behavior:'smooth',block:'start'})}
export async function saveAnnouncement(){
  const id=$('#announcementId').value,title=$('#announcementTitle').value.trim(),date=$('#announcementDate').value,body=$('#announcementBody').value.trim(),active=$('#announcementActive').checked
  if(!title||!date||!body)return toast('Judul, tanggal, dan isi informasi wajib diisi.','info')
  loading(true,'Menyimpan informasi...')
  try{const q=id?supabaseClient.from('pengumuman').update({judul:title,isi:body,tanggal:date,is_active:active}).eq('id',id):supabaseClient.from('pengumuman').insert({judul:title,isi:body,tanggal:date,is_active:active,created_by:state.user.id});const r=await q;if(r.error)throw r.error;toast('Informasi Akademik tersimpan.');resetAnnouncementForm();await loadAnnouncementsAdmin()}catch(e){toast(e.message||'Gagal menyimpan informasi.','err')}finally{loading(false)}
}
export async function toggleAnnouncement(id){const a=state.announcements.find(x=>x.id===id);if(!a)return;const r=await supabaseClient.from('pengumuman').update({is_active:!a.is_active}).eq('id',id);if(r.error)return toast(r.error.message,'err');toast('Status informasi diperbarui.');await loadAnnouncementsAdmin()}
export async function deleteAnnouncement(id){if(!confirm('Hapus informasi ini?'))return;const r=await supabaseClient.from('pengumuman').delete().eq('id',id);if(r.error)return toast(r.error.message,'err');toast('Informasi dihapus.');await loadAnnouncementsAdmin()}
