<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class SupabaseAuthService
{
    public function login(string $email, string $password): array
    {
        $response = $this->client()->post($this->url('/auth/v1/token?grant_type=password'), [
            'email' => $email,
            'password' => $password,
        ]);
        if ($response->failed()) {
            throw new RuntimeException($this->message($response, 'Email atau password tidak valid.'));
        }
        return $response->json();
    }

    public function register(string $fullName, string $email, string $password): array
    {
        $response = $this->client()->post($this->url('/auth/v1/signup'), [
            'email' => $email,
            'password' => $password,
            'data' => [
                'full_name' => $fullName,
            ],
        ]);
        if ($response->failed()) {
            throw new RuntimeException($this->message($response, 'Akun belum dapat dibuat.'));
        }
        return $response->json();
    }

    public function refresh(string $refreshToken): array
    {
        $response = $this->client()->post($this->url('/auth/v1/token?grant_type=refresh_token'), [
            'refresh_token' => $refreshToken,
        ]);
        if ($response->failed()) {
            throw new RuntimeException($this->message($response, 'Sesi Anda telah berakhir.'));
        }
        return $response->json();
    }

    public function logout(?string $accessToken): void
    {
        if (! $accessToken) return;
        try {
            $this->client($accessToken)->post($this->url('/auth/v1/logout'));
        } catch (\Throwable $e) {
            Log::warning('Supabase logout failed', ['message' => $e->getMessage()]);
        }
    }

    public function persistSession(array $payload): array
    {
        $user = $payload['user'] ?? [];
        $expiresIn = (int) ($payload['expires_in'] ?? 3600);
        session([
            'simasi_user_id' => $user['id'] ?? null,
            'simasi_email' => $user['email'] ?? null,
            'simasi_access_token' => $payload['access_token'] ?? null,
            'simasi_refresh_token' => $payload['refresh_token'] ?? null,
            'simasi_expires_at' => now()->addSeconds(max(60, $expiresIn - 60))->timestamp,
        ]);
        return $user;
    }

    public function ensureFreshSession(): void
    {
        if (! session('simasi_access_token')) throw new RuntimeException('Sesi login tidak tersedia.');
        if ((int) session('simasi_expires_at', 0) > now()->timestamp) return;
        $refreshToken = session('simasi_refresh_token');
        if (! $refreshToken) throw new RuntimeException('Sesi login tidak dapat diperbarui.');
        $this->persistSession($this->refresh($refreshToken));
    }

    private function client(?string $accessToken = null)
    {
        $headers = ['apikey' => config('services.supabase.publishable_key'), 'Accept' => 'application/json'];
        if ($accessToken) $headers['Authorization'] = 'Bearer '.$accessToken;
        return Http::asJson()->withHeaders($headers)->timeout(15);
    }

    private function url(string $path): string
    {
        $base = config('services.supabase.url');
        if (! $base || ! config('services.supabase.publishable_key')) throw new RuntimeException('Konfigurasi Supabase belum lengkap.');
        return $base.$path;
    }

    private function message(Response $response, string $fallback): string
    {
        return (string) ($response->json('msg') ?? $response->json('message') ?? $response->json('error_description') ?? $fallback);
    }
}
