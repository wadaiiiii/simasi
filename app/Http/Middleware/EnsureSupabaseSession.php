<?php

namespace App\Http\Middleware;

use App\Services\SupabaseAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSupabaseSession
{
    public function __construct(private readonly SupabaseAuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! session('simasi_access_token')) return redirect()->route('login')->with('error', 'Silakan login terlebih dahulu.');
        try {
            $this->auth->ensureFreshSession();
        } catch (\Throwable) {
            session()->invalidate();
            session()->regenerateToken();
            return redirect()->route('login')->with('error', 'Sesi berakhir. Silakan login kembali.');
        }
        return $next($request);
    }
}
