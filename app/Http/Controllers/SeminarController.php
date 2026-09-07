<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class SeminarController extends Controller
{
    private const BASE_DOCS = [
        'persetujuan_ta'=>'Halaman Persetujuan Tugas Akhir','krs_terakhir'=>'KRS Semester Terakhir','khs_terakhir'=>'KHS Semester Terakhir',
        'transkrip'=>'Transkrip Nilai Terakhir','ijazah_sma'=>'Fotocopy Ijazah SMA','ktp'=>'Fotocopy KTP','kontrol_pembimbing'=>'Kartu Kontrol Pembimbing',
        'kontrol_seminar'=>'Kartu Kontrol Mengikuti Seminar','sk_kegiatan'=>'SK Kegiatan','pas_foto'=>'Pas Foto 3x4',
    ];
    private const FINAL_DOCS = ['rekomendasi_ujian'=>'Surat Rekomendasi Ujian','persetujuan_ujian_akhir'=>'Halaman Persetujuan Ujian Akhir'];

    public function index(SupabaseDataService $data): View
    {
        $registrations = $data->get('pendaftaran_seminar', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','order'=>'created_at.desc']);
        return view('seminar.index', ['registrations'=>$registrations,'baseDocs'=>self::BASE_DOCS,'finalDocs'=>self::FINAL_DOCS]);
    }

    public function store(Request $request, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'nim'=>['required','string','max:30'],'nama'=>['required','string','max:150'],'prodi'=>['required','in:Matematika,Statistika,Aktuaria,Bioteknologi'],
            'jenis_ujian'=>['required','in:Seminar Proposal,Ujian Tutup Skripsi'],'pas_foto_jumlah'=>['required','integer','min:1','max:10'],
            'documents.*'=>['nullable','file','mimes:pdf,jpg,jpeg,png','max:10240'],'document_urls.*'=>['nullable','url','max:1000'],
        ]);
        $required = self::BASE_DOCS;
        if ($validated['jenis_ujian'] === 'Ujian Tutup Skripsi') $required += self::FINAL_DOCS;
        foreach ($required as $key=>$label) {
            if (! $request->hasFile('documents.'.$key) && ! filled($request->input('document_urls.'.$key))) return back()->withInput()->with('error', 'Dokumen belum lengkap: '.$label);
        }
        $registration = $data->insert('pendaftaran_seminar', ['user_id'=>session('simasi_user_id'),'nim'=>$validated['nim'],'nama'=>$validated['nama'],'prodi'=>$validated['prodi'],'jenis_ujian'=>$validated['jenis_ujian'],'pas_foto_jumlah'=>$validated['pas_foto_jumlah'],'status'=>'diajukan']);
        $registrationId = $registration[0]['id'] ?? null;
        if (! $registrationId) return back()->with('error', 'Pendaftaran tersimpan, tetapi ID registrasi tidak ditemukan.');
        foreach ($required as $key=>$label) {
            $filePath = null; $fileUrl = $request->input('document_urls.'.$key);
            if ($request->hasFile('documents.'.$key)) {
                $file = $request->file('documents.'.$key);
                $safeName = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
                $filePath = session('simasi_user_id').'/'.$registrationId.'/'.$key.'-'.time().'-'.$safeName.'.'.$file->getClientOriginalExtension();
                $data->upload($file, $filePath); $fileUrl = null;
            }
            $data->insert('berkas_seminar', ['pendaftaran_id'=>$registrationId,'jenis_berkas'=>$key,'nama_berkas'=>$label,'file_url'=>$fileUrl,'file_path'=>$filePath,'status'=>$filePath?'terunggah':'link_tersedia']);
        }
        return redirect()->route('seminar.index')->with('status', 'Pendaftaran seminar berhasil dikirim.');
    }
}
