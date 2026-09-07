<?php

namespace App\Http\Controllers;

use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AdminController extends Controller
{
    public function users(SupabaseDataService $data): View
    {
        $profiles = $data->get('profiles', ['select'=>'id,email,full_name,nim,role,prodi,created_at','order'=>'created_at.desc','limit'=>500]);
        $students = $data->get('mahasiswa', ['select'=>'id,user_id,nim,nama,prodi,total_sks,status','order'=>'nama.asc','limit'=>500]);

        return view('admin.users', compact('profiles','students'));
    }

    public function setRole(Request $request, string $userId, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate(['role'=>['required','in:mahasiswa,dosen,admin']]);
        $data->rpc('admin_set_role', ['p_user_id'=>$userId,'p_role'=>$validated['role']]);
        return back()->with('status', 'Role pengguna berhasil diperbarui.');
    }

    public function linkStudent(Request $request, string $userId, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate(['nim'=>['required','string','max:30']]);
        $data->rpc('admin_link_student', ['p_user_id'=>$userId,'p_nim'=>$validated['nim']]);
        return back()->with('status', 'Akun berhasil ditautkan dengan data mahasiswa.');
    }
}
