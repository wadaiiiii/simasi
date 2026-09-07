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
    public function showRegister(): View { return view('auth.register'); }

    public function login(Request $request, SupabaseAuthService $auth, SupabaseDataService $data): RedirectResponse
    {
        $credentials = $request->validate(['email' => ['required','email'], 'password' => ['required','string','min:6']]);
        try {
            $payload = $auth->login($credentials['email'], $credentials['password']);
            $user = $auth->persistSession($payload);
            $this->loadProfile($data, $user, $credentials['email']);
            $request->session()->regenerate();
            return redirect()->intended(route('dashboard'));
        } catch (\Throwable $e) {
            return back()->withInput($request->only('email'))->with('error', $e->getMessage());
        }
    }

    public function register(Request $request, SupabaseAuthService $auth, SupabaseDataService $data): RedirectResponse
    {
        $validated = $request->validate([
            'full_name' => ['required','string','min:3','max:150'],
            'email' => ['required','email','max:190'],
            'password' => ['required','string','min:8','confirmed'],
        ]);
        try {
            $payload = $auth->register($validated['full_name'], $validated['email'], $validated['password']);
            if (! empty($payload['access_token'])) {
                $user = $auth->persistSession($payload);
                $this->loadProfile($data, $user, $validated['email']);
                $request->session()->regenerate();
                return redirect()->route('dashboard')->with('status', 'Akun mahasiswa berhasil dibuat.');
            }
            return redirect()->route('login')->with('status', 'Akun berhasil dibuat. Silakan konfirmasi email bila diminta, lalu login.');
        } catch (\Throwable $e) {
            return back()->withInput($request->except(['password','password_confirmation']))->with('error', $e->getMessage());
        }
    }

    public function logout(Request $request, SupabaseAuthService $auth): RedirectResponse
    {
        $auth->logout(session('simasi_access_token'));
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login')->with('status', 'Anda telah logout.');
    }

    private function loadProfile(SupabaseDataService $data, array $user, string $fallbackEmail): void
    {
        $profiles = $data->get('profiles', ['id'=>'eq.'.($user['id'] ?? ''),'select'=>'id,email,full_name,nim,role,prodi','limit'=>1]);
        $profile = $profiles[0] ?? [
            'id'=>$user['id'] ?? null,
            'email'=>$user['email'] ?? $fallbackEmail,
            'full_name'=>$user['user_metadata']['full_name'] ?? $fallbackEmail,
            'nim'=>null,
            'role'=>'mahasiswa',
            'prodi'=>null,
        ];
        session(['simasi_profile'=>$profile]);
    }
}
