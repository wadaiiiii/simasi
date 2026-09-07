<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(SupabaseDataService $data): View
    {
        $stats = ['mahasiswa_aktif'=>0,'judul_diajukan'=>0,'lulus_sidang'=>0];
        $announcements = [];
        try {
            $rpc = $data->rpc('get_dashboard_stats', [], true);
            $stats = array_merge($stats, $rpc[0] ?? []);
            $announcements = $data->get('pengumuman', ['select'=>'id,judul,isi,tanggal','is_active'=>'eq.true','order'=>'tanggal.desc','limit'=>5], true);
        } catch (\Throwable $e) { report($e); }
        return view('dashboard.index', compact('stats','announcements'));
    }
}
