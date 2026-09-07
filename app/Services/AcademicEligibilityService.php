<?php

namespace App\Services;

class AcademicEligibilityService
{
    public function evaluate(?array $student): array
    {
        if (! $student) {
            return ['eligible' => false, 'message' => 'Data akademik belum tertaut dengan akun ini.', 'sks_ok' => false, 'metpen_ok' => false];
        }
        $sksOk = (int) ($student['total_sks'] ?? 0) >= 110;
        $metpenOk = (bool) ($student['metode_penelitian_lulus'] ?? false);
        return [
            'eligible' => $sksOk && $metpenOk,
            'message' => $sksOk && $metpenOk ? 'Memenuhi syarat pengajuan skripsi.' : 'Belum memenuhi seluruh syarat pengajuan skripsi.',
            'sks_ok' => $sksOk,
            'metpen_ok' => $metpenOk,
        ];
    }
}
