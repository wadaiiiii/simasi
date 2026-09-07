<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SupabaseDataService
{
    public function get(string $table, array $query = [], bool $public = false): array
    {
        $response = $this->request($public)->get($this->restUrl($table), $query);
        $this->guard($response);
        return $response->json() ?? [];
    }

    public function insert(string $table, array $payload): array
    {
        $response = $this->request()->withHeaders(['Prefer' => 'return=representation'])->post($this->restUrl($table), $payload);
        $this->guard($response);
        return $response->json() ?? [];
    }

    public function update(string $table, array $filters, array $payload): array
    {
        $response = $this->request()->withHeaders(['Prefer' => 'return=representation'])->patch($this->restUrl($table).'?'.http_build_query($filters), $payload);
        $this->guard($response);
        return $response->json() ?? [];
    }

    public function rpc(string $function, array $payload = [], bool $public = false): array
    {
        $response = $this->request($public)->post($this->url('/rest/v1/rpc/'.$function), $payload);
        $this->guard($response);
        return $response->json() ?? [];
    }

    public function upload(UploadedFile $file, string $path): array
    {
        $bucket = config('services.supabase.storage_bucket', 'seminar-documents');
        $binary = file_get_contents($file->getRealPath());
        $response = $this->request()->withBody($binary, $file->getMimeType() ?: 'application/octet-stream')->post($this->url('/storage/v1/object/'.$bucket.'/'.ltrim($path, '/')));
        $this->guard($response);
        return $response->json() ?? [];
    }

    private function request(bool $public = false): PendingRequest
    {
        $key = config('services.supabase.publishable_key');
        $token = $public ? null : session('simasi_access_token');
        if (! $key || (! $public && ! $token)) throw new RuntimeException('Sesi atau konfigurasi Supabase tidak tersedia.');
        $headers = ['apikey' => $key, 'Accept' => 'application/json'];
        if ($token) $headers['Authorization'] = 'Bearer '.$token;
        return Http::withHeaders($headers)->timeout(20);
    }

    private function restUrl(string $table): string { return $this->url('/rest/v1/'.$table); }
    private function url(string $path): string
    {
        $base = rtrim((string) config('services.supabase.url'), '/');
        if (! $base) throw new RuntimeException('SUPABASE_URL belum dikonfigurasi.');
        return $base.$path;
    }
    private function guard($response): void
    {
        if ($response->failed()) {
            $message = $response->json('message') ?? $response->json('error_description') ?? $response->body();
            throw new RuntimeException('Supabase: '.$message);
        }
    }
}
