<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\KuliahController;
use App\Http\Controllers\LaporanController;
use App\Http\Controllers\LogbookController;
use App\Http\Controllers\SeminarController;
use App\Http\Controllers\SkripsiController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard');

Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:8,1')->name('login.submit');

Route::middleware('simasi.auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/manajemen-kuliah', [KuliahController::class, 'index'])->name('kuliah.index');
    Route::get('/skripsi', [SkripsiController::class, 'index'])->name('skripsi.index');
    Route::post('/skripsi', [SkripsiController::class, 'store'])->name('skripsi.store');
    Route::get('/seminar', [SeminarController::class, 'index'])->name('seminar.index');
    Route::post('/seminar', [SeminarController::class, 'store'])->name('seminar.store');
    Route::get('/logbook', [LogbookController::class, 'index'])->name('logbook.index');
    Route::post('/logbook', [LogbookController::class, 'store'])->name('logbook.store');
    Route::get('/laporan', [LaporanController::class, 'index'])->name('laporan.index');
});
