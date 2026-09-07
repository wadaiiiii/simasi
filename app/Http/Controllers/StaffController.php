<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class StaffController extends Controller
{
    public function index(SupabaseDataService $data): View
    {
        $skripsi = $data->get('pengajuan_skripsi', ['select'=>'*','order'=>'created_at.desc','limit'=>50]);
        $seminar = $data->get('pendaftaran_seminar', ['select'=>'*','order'=>'created_at.desc','limit'=>50]);
        $logbook = $data->get('logbook_bimbingan', ['select'=>'*','order'=>'created_at.desc','limit'=>50]);
        $nilai = $data->get('nilai_skripsi', ['select'=>'*','order'=>'created_at.desc','limit'=>50]);
        $mahasiswa = $data->get('mahasiswa', ['select'=>'id,nim,nama,prodi','order'=>'nama.asc','limit'=>500]);

        return view('staff.index', compact('skripsi','seminar','logbook','nilai','mahasiswa'));
    }

    public function updateSkripsi(Request $request, string $id, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required','in:menunggu,disetujui,revisi,ditolak'],
            'catatan_dosen' => ['nullable','string','max:3000'],
        ]);
        $data->update('pengajuan_skripsi', ['id'=>'eq.'.$id], $validated);
        return back()->with('status', 'Status pengajuan skripsi diperbarui.');
    }

    public function updateSeminar(Request $request, string $id, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required','in:diajukan,diverifikasi,revisi,ditolak,selesai'],
            'catatan_verifikator' => ['nullable','string','max:3000'],
        ]);
        $data->update('pendaftaran_seminar', ['id'=>'eq.'.$id], $validated);
        return back()->with('status', 'Status pendaftaran seminar diperbarui.');
    }

    public function reviewLogbook(Request $request, string $id, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'status_approval' => ['required','in:Menunggu,Disetujui,Revisi'],
            'catatan_dosen' => ['nullable','string','max:3000'],
        ]);
        $data->rpc('review_logbook', [
            'p_logbook_id'=>$id,
            'p_catatan_dosen'=>$validated['catatan_dosen'] ?? null,
            'p_status_approval'=>$validated['status_approval'],
        ]);
        return back()->with('status', 'Review logbook disimpan.');
    }

    public function saveNilai(Request $request, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'mahasiswa_id'=>['required','uuid'],
            'nim'=>['required','string','max:30'],
            'nama'=>['required','string','max:150'],
            'prodi'=>['required','string','max:100'],
            'nilai_proposal'=>['nullable','numeric','min:0','max:100'],
            'nilai_bimbingan'=>['nullable','numeric','min:0','max:100'],
            'nilai_hasil'=>['nullable','numeric','min:0','max:100'],
            'nilai_ujian'=>['nullable','numeric','min:0','max:100'],
            'status_sidang'=>['required','string','max:100'],
        ]);

        $scores = array_filter([
            $validated['nilai_proposal'] ?? null,
            $validated['nilai_bimbingan'] ?? null,
            $validated['nilai_hasil'] ?? null,
            $validated['nilai_ujian'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
        $validated['nilai_akhir'] = count($scores) ? round(array_sum($scores) / count($scores), 2) : null;

        $existing = $data->get('nilai_skripsi', [
            'mahasiswa_id'=>'eq.'.$validated['mahasiswa_id'],
            'select'=>'id',
            'limit'=>1,
        ]);

        if (! empty($existing[0]['id'])) {
            $data->update('nilai_skripsi', ['id'=>'eq.'.$existing[0]['id']], $validated);
        } else {
            $data->insert('nilai_skripsi', $validated);
        }

        return back()->with('status', 'Nilai tugas akhir berhasil disimpan.');
    }
}
