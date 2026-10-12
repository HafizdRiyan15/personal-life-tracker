# Personal Life Tracker

Personal Life Tracker adalah aplikasi web untuk membantu pengguna mengelola perkembangan diri.

## Fitur

- Registrasi dan login menggunakan Supabase Auth
- Habit tracker dan riwayat penyelesaian berdasarkan tanggal
- Jurnal dan refleksi dengan pencarian, filter tanggal, edit, dan hapus
- Target pribadi dengan tenggat waktu dan status penyelesaian
- Pencatatan pemasukan dan pengeluaran
- Ringkasan dan statistik perkembangan
- Tampilan responsif untuk laptop dan ponsel
- Row Level Security (RLS) untuk membatasi akses data per pengguna

## Teknologi

- HTML5
- CSS3
- JavaScript ES Modules
- Supabase Authentication
- Supabase PostgreSQL

## Menjalankan Project

1. Buat project di Supabase.
2. Jalankan SQL database dari panduan project.
3. Masukkan Supabase URL dan publishable key di `js/supabase.js`.
4. Buka project melalui server lokal atau deploy ke GitHub Pages.
5. Daftar akun melalui halaman login.
6. Verifikasi email jika fitur verifikasi diaktifkan.
7. Login dan mulai gunakan dashboard.

## Struktur Folder

```text
personal-life-tracker/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── supabase.js
│   └── app.js
├── pages/
│   ├── login.html
│   └── dashboard.html
└── README.md
```

## Keamanan

Aplikasi menggunakan publishable key di sisi frontend. Jangan pernah menaruh
service_role key atau secret key di dalam kode frontend. RLS wajib aktif
agar pengguna hanya dapat mengakses data miliknya sendiri.