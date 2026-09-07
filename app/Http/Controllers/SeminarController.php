<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class SeminarController extends Controller
{
    private const DOCS = [
        'persetujuan_ta' => 'Halaman Persetujuan Tugas Akhir',
        'krs_terakhir' => 'Kartu Rencana Studi Semester Terakhir',
        'khs_terakhir' => 'Kartu Hasil Studi Semester Terakhir',
        'transkrip' => 'Transkrip Nilai Terakhir',
        'ijazah_sma' => 'Fotocopy Ijazah SMA',
        'ktp' => 'Fotocopy KTP',
        'kontrol_pembimbing' => 'Kartu Kontrol Pembimbing',
        'kontrol_seminar' => 'Kartu Kontrol Mengikuti Seminar',
        'sk_kegiatan' => 'SK Kegiatan',
        'pas_foto' => 'Pas Foto 3x4 (2 lembar)',
    ];

    public function index(SupabaseDataService $data): View
    {
        $authenticated = session()->has('simasi_access_token') && session()->has('simasi_user_id');
        $registrations = [];

        if ($authenticated) {
            $registrations = $data->get('pendaftaran_seminar', [
                'user_id' => 'eq.'.session('simasi_user_id'),
                'select' => '*',
                'order' => 'created_at.desc',
            ]);
        }

        return view('seminar.index', [
            'registrations' => $registrations,
            'docs' => self::DOCS,
            'authenticated' => $authenticated,
        ]);
    }

    public function store(Request $request, SupabaseDataService $data): RedirectResponse
    {
        $rules = [
            'nim' => ['required','string','max:30'],
            'nama' => ['required','string','max:150'],
            'prodi' => ['required','in:Matematika,Statistika,Aktuaria,Bioteknologi'],
            'jenis_ujian' => ['required','in:Seminar Proposal,Seminar Hasil'],
            'documents' => ['required','array'],
        ];

        foreach (array_keys(self::DOCS) as $key) {
            $rules['documents.'.$key] = ['required','file','mimes:pdf','max:2048'];
        }

        $validated = $request->validate($rules, [
            'documents.*.required' => 'Semua dokumen persyaratan wajib diunggah.',
            'documents.*.mimes' => 'Dokumen hanya dapat diunggah dalam format PDF.',
            'documents.*.max' => 'Ukuran setiap dokumen maksimal 2 MB.',
        ]);

        $registration = $data->insert('pendaftaran_seminar', [
            'user_id' => session('simasi_user_id'),
            'nim' => $validated['nim'],
            'nama' => $validated['nama'],
            'prodi' => $validated['prodi'],
            'jenis_ujian' => $validated['jenis_ujian'],
            'pas_foto_jumlah' => 2,
            'status' => 'diajukan',
        ]);

        $registrationId = $registration[0]['id'] ?? null;
        if (! $registrationId) {
            return back()->withInput()->with('error', 'Pendaftaran tersimpan, tetapi ID registrasi tidak ditemukan.');
        }

        foreach (self::DOCS as $key => $label) {
            $file = $request->file('documents.'.$key);
            $safeName = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: $key;
            $filePath = session('simasi_user_id').'/'.$registrationId.'/'.$key.'-'.time().'-'.$safeName.'.pdf';
            $data->upload($file, $filePath);

            $data->insert('berkas_seminar', [
                'pendaftaran_id' => $registrationId,
                'jenis_berkas' => $key,
                'nama_berkas' => $label,
                'file_url' => null,
                'file_path' => $filePath,
                'status' => 'terunggah',
            ]);
        }

        return redirect()->route('seminar.index')->with('status', 'Pendaftaran Seminar Proposal/Seminar Hasil berhasil dikirim.');
    }
}
