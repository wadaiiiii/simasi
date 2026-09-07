<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $role = (string) session('simasi_profile.role', 'mahasiswa');
        abort_unless(in_array($role, $roles, true), 403, 'Anda tidak memiliki akses ke halaman ini.');
        return $next($request);
    }
}
