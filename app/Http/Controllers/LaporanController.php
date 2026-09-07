<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\View\View;

class LaporanController extends Controller
{
    public function index(SupabaseDataService $data): View
    {
        $role = session('simasi_profile.role', 'mahasiswa');
        $query = ['select'=>'*','order'=>'created_at.desc'];
        if ($role === 'mahasiswa') {
            $studentRows = $data->get('mahasiswa', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'id','limit'=>1]);
            $studentId = $studentRows[0]['id'] ?? null;
            $query['mahasiswa_id'] = $studentId ? 'eq.'.$studentId : 'eq.00000000-0000-0000-0000-000000000000';
        }
        $rows = $data->get('nilai_skripsi', $query);
        return view('laporan.index', compact('rows'));
    }
}
