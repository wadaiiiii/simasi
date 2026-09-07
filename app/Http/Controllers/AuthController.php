<?php

namespace App\Http\Controllers;

use App\Services\SupabaseAuthService;
use App\Services\SupabaseDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLogin(): View { return view('auth.login'); }

    public function login(Request $request, SupabaseAuthService $auth, SupabaseDataService $data): RedirectResponse
    {
        $credentials = $request->validate(['email' => ['required','email'], 'password' => ['required','string','min:6']]);
        try {
            $payload = $auth->login($credentials['email'], $credentials['password']);
            $user = $auth->persistSession($payload);
            $profiles = $data->get('profiles', ['id' => 'eq.'.($user['id'] ?? ''), 'select' => 'id,email,full_name,nim,role,prodi', 'limit' => 1]);
            $profile = $profiles[0] ?? [
                'id' => $user['id'] ?? null,
                'email' => $user['email'] ?? $credentials['email'],
                'full_name' => $user['user_metadata']['full_name'] ?? $credentials['email'],
                'nim' => null, 'role' => 'mahasiswa', 'prodi' => null,
            ];
            session(['simasi_profile' => $profile]);
            $request->session()->regenerate();
            return redirect()->intended(route('dashboard'));
        } catch (\Throwable $e) {
            return back()->withInput($request->only('email'))->with('error', $e->getMessage());
        }
    }

    public function logout(Request $request, SupabaseAuthService $auth): RedirectResponse
    {
        $auth->logout(session('simasi_access_token'));
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login')->with('status', 'Anda telah logout.');
    }
}
