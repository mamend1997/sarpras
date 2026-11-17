# Sarprah

Aplikasi web manajemen sarana dan prasarana sekolah. Antarmuka menggunakan HTML, Tailwind CSS, dan JavaScript tanpa proses build; data disimpan di SQLite saat dijalankan melalui server dan tetap memiliki cadangan LocalStorage untuk mode offline.

## Menjalankan aplikasi

1. Pasang Node.js 22.5 atau lebih baru.
2. Jalankan `npm start`.
3. Buka `http://localhost:3000`.

Server membaca `PORT` dari environment, sehingga dapat dijalankan sebagai web service Railway. Berkas database `sarprah.sqlite` dibuat otomatis di folder proyek dan tidak perlu di-commit. Untuk Railway, tambahkan Volume persisten dan set `DB_PATH` ke lokasi mount volume, misalnya `/data/sarprah.sqlite`.

## Akun demo

- Email: `admin@sarprah.id`
- Kata sandi: `sarprah123`

Data contoh dimuat otomatis saat database masih kosong. Jika server tidak tersedia, aplikasi tetap dapat dicoba di browser dan perubahan disimpan pada LocalStorage browser tersebut.
