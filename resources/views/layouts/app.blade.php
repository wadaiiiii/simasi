<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="csrf-token" content="{{ csrf_token() }}">
<title>@yield('title','SIMASI') · FMIPA Unsulbar</title><link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
<div class="app-shell">
<aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">SI</div><div><strong>SIMASI</strong><small>FMIPA Unsulbar</small></div></div><div class="nav-title">Menu utama</div><nav>
<a class="nav-link {{ request()->routeIs('dashboard')?'active':'' }}" href="{{ route('dashboard') }}"><span class="nav-icon">⌂</span>Dashboard</a>
<a class="nav-link {{ request()->routeIs('kuliah.*')?'active':'' }}" href="{{ route('kuliah.index') }}"><span class="nav-icon">✓</span>Manajemen Kuliah</a>
<a class="nav-link {{ request()->routeIs('skripsi.*')?'active':'' }}" href="{{ route('skripsi.index') }}"><span class="nav-icon">✎</span>Pengajuan Skripsi</a>
<a class="nav-link {{ request()->routeIs('seminar.*')?'active':'' }}" href="{{ route('seminar.index') }}"><span class="nav-icon">▣</span>Seminar & Tugas Akhir</a>
<a class="nav-link {{ request()->routeIs('logbook.*')?'active':'' }}" href="{{ route('logbook.index') }}"><span class="nav-icon">☷</span>Logbook</a>
<a class="nav-link {{ request()->routeIs('laporan.*')?'active':'' }}" href="{{ route('laporan.index') }}"><span class="nav-icon">▤</span>Laporan & Nilai</a>
</nav><div class="sidebar-user"><strong>{{ session('simasi_profile.full_name',session('simasi_email')) }}</strong><small>{{ ucfirst(session('simasi_profile.role','mahasiswa')) }} · {{ session('simasi_profile.prodi','FMIPA') ?: 'FMIPA' }}</small><form method="POST" action="{{ route('logout') }}" style="margin-top:12px">@csrf<button class="btn btn-secondary" style="width:100%" type="submit">Keluar</button></form></div></aside>
<main class="main"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="mobile-menu" type="button" id="menuBtn">☰</button><strong class="topbar-title">Sistem Informasi Manajemen Kuliah dan Skripsi</strong></div><span class="badge badge-success">{{ ucfirst(session('simasi_profile.role','mahasiswa')) }}</span></header><div class="content">
@if(session('status'))<div class="alert alert-success">{{ session('status') }}</div>@endif
@if(session('error'))<div class="alert alert-error">{{ session('error') }}</div>@endif
@if($errors->any())<div class="alert alert-error"><strong>Periksa kembali isian:</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>@endif
@yield('content')</div></main></div>
<nav class="bottom-nav"><a class="{{ request()->routeIs('dashboard')?'active':'' }}" href="{{ route('dashboard') }}"><span class="ico">⌂</span>Beranda</a><a class="{{ request()->routeIs('kuliah.*')||request()->routeIs('skripsi.*')?'active':'' }}" href="{{ route('kuliah.index') }}"><span class="ico">✓</span>Kuliah</a><a class="{{ request()->routeIs('seminar.*')?'active':'' }}" href="{{ route('seminar.index') }}"><span class="ico">▣</span>Seminar</a><a class="{{ request()->routeIs('logbook.*')?'active':'' }}" href="{{ route('logbook.index') }}"><span class="ico">☷</span>Logbook</a><a class="{{ request()->routeIs('laporan.*')?'active':'' }}" href="{{ route('laporan.index') }}"><span class="ico">▤</span>Nilai</a></nav>
<script>const sidebar=document.getElementById('sidebar'),btn=document.getElementById('menuBtn');btn?.addEventListener('click',()=>sidebar.classList.toggle('open'));document.addEventListener('click',e=>{if(innerWidth<=980&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&e.target!==btn)sidebar.classList.remove('open')});</script>@stack('scripts')</body></html>