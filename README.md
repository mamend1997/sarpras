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

## Pemindaian barcode dan supplier

- Formulir tambah peminjaman, pengadaan, pemusnahan, penyusutan, dan stock opname menyediakan pemindaian melalui kamera atau input kode manual. Pemindaian kamera membutuhkan browser yang mendukung `BarcodeDetector` dan akses kamera; scanner USB juga dapat digunakan melalui kolom kode.
- Di **Barang → Data Barang**, unduh **Template CSV** sebelum impor. Isi nama sumber dana, jenis, kategori, satuan, dan supplier sesuai data master yang sudah terdaftar. Nilai harga boleh ditulis seperti `1.000.000`; impor dibatalkan jika ada referensi atau nilai yang tidak valid, sedangkan nama barang duplikat dilewati.
- Pada form harga, pemisah ribuan menggunakan titik dan nilai tetap disimpan sebagai angka. Pada stock opname, pilih barang manual atau pindai kode item; stok lama terisi otomatis dari stok saat ini, stok baru wajib diisi, dan total stok tetap ditampilkan sebagai jumlah tanpa awalan Rp.
- Data supplier mencakup nama, alamat, nomor telepon, serta email opsional.
- Grup navigasi sidebar bekerja sebagai accordion: hanya satu grup submenu yang terbuka pada satu waktu.
- Buat bot melalui `@BotFather`, mulai percakapan dengan bot, lalu masukkan chat ID serta token bot di pengaturan. Token disimpan terenkripsi di server dan tidak dikirim balik ke browser.
- Jadwal awal adalah setiap hari pukul **16.00 WIB**. Pilih zona WIB/WITA/WIT, simpan pengaturan, lalu gunakan **Uji koneksi**. Scheduler hanya berjalan saat service Node aktif.
- Secara default server membuat kunci enkripsi `.sarprah-key` di direktori database. Untuk Railway, letakkan database dan kunci pada Volume persisten yang sama. Alternatifnya, set `SARPRAH_ENCRYPTION_KEY` berisi 64 karakter hexadecimal; simpan nilainya sebagai secret Railway dan jangan menggantinya setelah token Telegram disimpan.

## Pengguna dan keamanan

Kelola satu akun Administrator dan role Kepala Sekolah, Wakasek Sarpras, serta Guru dari Pengaturan Akun. Akun baru memerlukan kata sandi minimal 8 karakter. Ubah kata sandi dan avatar aktif melalui pratinjau akun di header/sidebar. Server menggunakan sesi HttpOnly dan verifikasi kata sandi PBKDF2; API backup dan Telegram dibatasi untuk Administrator.

Hak akses menu dapat ditentukan terpisah untuk setiap role dengan tingkat tidak terlihat, lihat saja, lihat/edit, atau lihat/edit/hapus. Perubahan email dan kata sandi akun menunggu konfirmasi penyimpanan sebelum ditampilkan berhasil. Login tidak mengisi kredensial demo secara otomatis.
