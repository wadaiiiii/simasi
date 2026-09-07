<?php

namespace App\Http\Controllers;

use App\Services\AcademicEligibilityService;
use App\Services\SupabaseDataService;
use Illuminate\View\View;

class KuliahController extends Controller
{
    public function index(SupabaseDataService $data, AcademicEligibilityService $eligibility): View
    {
        $student = null;
        try {
            $rows = $data->get('mahasiswa', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','limit'=>1]);
            $student = $rows[0] ?? null;
        } catch (\Throwable $e) { report($e); }
        $assessment = $eligibility->evaluate($student);
        return view('kuliah.index', compact('student','assessment'));
    }
}
