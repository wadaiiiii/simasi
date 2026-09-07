<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class LogbookController extends Controller
{
    public function index(SupabaseDataService $data): View
    {
        $rows = $data->get('logbook_bimbingan', ['user_id'=>'eq.'.session('simasi_user_id'),'select'=>'*','order'=>'tanggal.desc']);
        return view('logbook.index', ['rows'=>$rows]);
    }
    public function store(Request $request, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate(['tanggal'=>['required','date'],'uraian'=>['required','string','min:10','max:5000'],'file_url'=>['nullable','url','max:1000']]);
        $data->insert('logbook_bimbingan', ['user_id'=>session('simasi_user_id'),'nim'=>session('simasi_profile.nim'),'tanggal'=>$validated['tanggal'],'uraian'=>$validated['uraian'],'file_url'=>$validated['file_url'] ?? null,'status_approval'=>'Menunggu']);
        return back()->with('status', 'Logbook berhasil ditambahkan.');
    }
}
