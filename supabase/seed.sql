-- Data awal aman untuk demo pengumuman.
insert into public.pengumuman (judul, isi, tanggal, is_active)
values
('Pendaftaran Seminar Proposal', 'Mahasiswa yang telah memperoleh persetujuan pembimbing dapat melakukan pendaftaran melalui SIMASI.', current_date, true),
('Pemutakhiran Logbook Bimbingan', 'Pastikan setiap aktivitas bimbingan telah dicatat dan tautan revisi dapat diakses oleh dosen pembimbing.', current_date - 3, true)
on conflict do nothing;

-- Contoh data mahasiswa. Hapus bagian ini bila tidak diperlukan.
insert into public.mahasiswa (nim, nama, jurusan, prodi, total_sks, metode_penelitian_lulus, status)
values
('H011221001', 'Andi Rahmat', 'Matematika', 'Matematika', 116, true, 'aktif'),
('H021221015', 'Nur Aisyah', 'Matematika', 'Statistika', 104, true, 'aktif'),
('H031221008', 'Muhammad Fadli', 'Matematika', 'Aktuaria', 121, false, 'aktif')
on conflict (nim) do nothing;
