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

## Backup & Telegram

- Login sebagai Administrator, buka **Backup & Telegram**, lalu gunakan **Backup sekarang** untuk mengunduh file JSON.
- Restore menerima file backup JSON Sarprah dan mengganti seluruh data aplikasi. Buat backup sebelum melakukan restore.
- Di **Data Sekolah → Identitas Aplikasi**, Administrator dapat mengubah nama dan logo aplikasi. Nama memperbarui label aplikasi serta judul tab browser; logo juga otomatis digunakan sebagai favicon.
- Buat bot melalui `@BotFather`, mulai percakapan dengan bot, lalu masukkan chat ID serta token bot di pengaturan. Token disimpan terenkripsi di server dan tidak dikirim balik ke browser.
- Jadwal awal adalah setiap hari pukul **16.00 WIB**. Pilih zona WIB/WITA/WIT, simpan pengaturan, lalu gunakan **Uji koneksi**. Scheduler hanya berjalan saat service Node aktif.
- Secara default server membuat kunci enkripsi `.sarprah-key` di direktori database. Untuk Railway, letakkan database dan kunci pada Volume persisten yang sama. Alternatifnya, set `SARPRAH_ENCRYPTION_KEY` berisi 64 karakter hexadecimal; simpan nilainya sebagai secret Railway dan jangan menggantinya setelah token Telegram disimpan.

## Pengguna dan keamanan

Kelola satu akun Administrator dan role Kepala Sekolah, Wakasek Sarpras, serta Guru dari Pengaturan Akun. Akun baru memerlukan kata sandi minimal 8 karakter. Ubah kata sandi dan avatar aktif melalui pratinjau akun di header/sidebar. Server menggunakan sesi HttpOnly dan verifikasi kata sandi PBKDF2; API backup dan Telegram dibatasi untuk Administrator.
