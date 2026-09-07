<?php

namespace App\Http\Controllers;

use App\Services\AcademicEligibilityService;
use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SkripsiController extends Controller
{
    public function index(SupabaseDataService $data, AcademicEligibilityService $eligibility): View
    {
        $studentRows = $data->get('mahasiswa', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','limit'=>1]);
        $student = $studentRows[0] ?? null;
        $assessment = $eligibility->evaluate($student);
        $submissions = $data->get('pengajuan_skripsi', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','order'=>'created_at.desc']);
        return view('skripsi.index', compact('student','assessment','submissions'));
    }

    public function store(Request $request, SupabaseDataService $data, AcademicEligibilityService $eligibility): RedirectResponse
    {
        $validated = $request->validate(['judul'=>['required','string','min:10','max:255'],'abstrak'=>['required','string','min:50','max:5000']]);
        $studentRows = $data->get('mahasiswa', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','limit'=>1]);
        $student = $studentRows[0] ?? null;
        if (! $eligibility->evaluate($student)['eligible']) return back()->with('error', 'Pengajuan ditolak: syarat akademik belum terpenuhi.');
        $data->insert('pengajuan_skripsi', [
            'user_id'=>session('simasi_user_id'),'nim'=>$student['nim'],'nama'=>$student['nama'],'jurusan'=>$student['jurusan'] ?? null,
            'prodi'=>$student['prodi'],'judul'=>$validated['judul'],'abstrak'=>$validated['abstrak'],'status'=>'menunggu',
        ]);
        return back()->with('status', 'Pengajuan skripsi berhasil dikirim.');
    }
}
