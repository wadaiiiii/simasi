from pathlib import Path

# Improve PDF SIAKAD parser: read Program Studi from header, then NIM + Nama from student rows.
p = Path('src/v4/data.js')
s = p.read_text()
start = s.find('export async function parseImport(file){')
end = s.find('\nexport function renderImportRows()', start)
if start < 0 or end < 0:
    raise SystemExit('parseImport block not found')

replacement = r'''export async function parseImport(file){
  if(file.name.toLowerCase().endsWith('.pdf')){
    const pdfjs=await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib')
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,lines=[]
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i),c=await page.getTextContent(),groups=[]
      for(const item of c.items){
        const x=item.transform?.[4]??0,y=item.transform?.[5]??0
        let g=groups.find(z=>Math.abs(z.y-y)<=2)
        if(!g){g={y,items:[]};groups.push(g)}
        g.items.push({x,text:item.str})
      }
      groups.sort((a,b)=>b.y-a.y)
      for(const g of groups){
        const line=g.items.sort((a,b)=>a.x-b.x).map(z=>z.text).join(' ').replace(/\s+/g,' ').trim()
        if(line)lines.push(line)
      }
    }

    let headerProdi=''
    for(let i=0;i<lines.length;i++){
      if(!/(program\s*studi|\bprodi\b)/i.test(lines[i]))continue
      headerProdi=normalizeProdi(lines[i])||normalizeProdi(lines[i+1]||'')||normalizeProdi(lines[i+2]||'')
      if(headerProdi)break
    }
    if(!headerProdi)throw new Error('Program Studi tidak ditemukan pada header PDF SIAKAD.')

    const tableHeader=lines.findIndex(line=>/\bnim\b/i.test(line)&&/\bnama\b/i.test(line))
    const source=tableHeader>=0?lines.slice(tableHeader+1):lines
    const out=[]
    for(const line of source){
      const tokens=[...line.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._-]{6,19}\b/g)].filter(m=>((m[0].match(/\d/g)||[]).length>=5))
      if(!tokens.length)continue
      const m=tokens[0]
      let nama=line.slice((m.index||0)+m[0].length)
        .replace(/^[|;,:\-\s]+|[|;,:\-\s]+$/g,'')
        .replace(/\s+(?:\d+(?:[.,]\d+)?\s*){1,6}$/,'')
        .trim()
      if(!nama||/^(tidak ada perkuliahan|total kehadiran)$/i.test(nama))continue
      out.push({nim:normalizeNim(m[0]),nama,prodi:headerProdi})
    }

    const unique=[...new Map(out.map(x=>[x.nim,x])).values()]
    if(!unique.length)throw new Error('NIM dan Nama mahasiswa tidak ditemukan pada tabel PDF SIAKAD. Pastikan PDF berbasis teks.')
    return unique
  }
  const XLSX=await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX')
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]]
  return rowsToStudents(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''}))
}'''

s = s[:start] + replacement + s[end:]
p.write_text(s)

# Make detected program study visible in the import feedback toast.
p = Path('src/app-v5.js')
s = p.read_text()
old = "try{state.importRows=await parseImport(f);renderImportRows();toast(`${state.importRows.length} mahasiswa terdeteksi.`)}"
new = "try{state.importRows=await parseImport(f);renderImportRows();const detected=[...new Set(state.importRows.map(r=>normalizeProdi(r.prodi)).filter(Boolean))];toast(`${state.importRows.length} mahasiswa terdeteksi${detected.length?` • Prodi: ${detected.join(', ')}`:''}.`)}"
if old not in s:
    raise SystemExit('import feedback anchor not found')
s = s.replace(old,new)
p.write_text(s)

print('SIAKAD PDF attendance parser patch applied')
