# Sarprah

Aplikasi web manajemen sarana dan prasarana sekolah. Antarmuka menggunakan HTML, Tailwind CSS, dan JavaScript tanpa proses build; data disimpan di SQLite saat dijalankan melalui server dan tetap memiliki cadangan LocalStorage untuk mode offline.

## SaaS multi-sekolah

- Halaman sekolah: `http://localhost:3000/`. Sekolah baru dapat mendaftar dari tombol **Daftarkan sekolah**; kode tenant acak 4 karakter huruf/angka ditampilkan setelah pendaftaran berhasil.
- Halaman Super Admin: `http://localhost:3000/super-admin`. Pada penggunaan pertama, buat akun Super Admin khusus. Selanjutnya halaman ini meminta login.
- Setiap tenant menyimpan inventaris, akun, dan tiket secara terpisah. Super Admin dapat mengatur sekolah, paket dan masa langganan, pembayaran, fitur, branding, QRIS, syarat/SLA, pengumuman, maintenance, panduan, tiket, WhatsApp, audit, serta backup/restore.
- Pada **Super Admin → Backup & Restore**, jadwalkan backup harian seluruh platform ke Telegram menggunakan token bot dan Chat ID tujuan. Jadwal awal pukul 16.00 WIB; token disimpan terenkripsi dan file mencakup data semua tenant, sehingga chat tujuan harus dijaga kerahasiaannya.
- Database lama dimigrasikan sebagai tenant awal dengan kode `0001`. Data baru disimpan di SQLite pada `DB_PATH`; jangan gunakan database lokal bersama untuk pengujian yang mengubah data.
- Jika akun sekolah lama belum tercantum di platform SaaS, startup berikutnya akan memasukkannya ke **Daftar Sekolah** sebagai tenant pertama, memberi kode sekolah, dan mempertahankan akses Lifetime. Kode tenant lama seperti `0001` tetap berlaku; data migrasi yang belum lengkap akan dicoba dipulihkan saat startup.
- Fitur maintenance dan masa aktif diperiksa pada autentikasi dan API, bukan hanya disembunyikan dari antarmuka. Backup SaaS berisi data semua tenant dan kredensial hash Super Admin; simpan file backup seperti rahasia dan lindungi kunci enkripsi bersama file database.

## Menjalankan aplikasi

1. Pasang Node.js 22.5 atau lebih baru.
2. Jalankan `npm start`.
3. Buka `http://localhost:3000`.

Server membaca `PORT` dari environment, sehingga dapat dijalankan sebagai web service Railway. Secara lokal, berkas database `sarprah.sqlite` dibuat otomatis di folder proyek dan tidak perlu di-commit. Di Railway, hubungkan Volume persisten ke service; aplikasi otomatis menyimpan database `sarprah.sqlite` dan kunci enkripsinya di dalam direktori Volume. Jika `DB_PATH` diatur manual, pastikan lokasinya berada di dalam Volume. Server menolak startup di Railway tanpa Volume atau jika `DB_PATH` berada di luar Volume, untuk mencegah data Super Admin dan sekolah hilang saat deployment.

Jika database sebelumnya tersimpan pada filesystem sementara Railway, salin database beserta `.sarprah-key` ke Volume atau pulihkan backup yang sesuai sebelum menghapus sumber lama. Database baru yang kosong tidak berisi akun Super Admin maupun sekolah lama.

## Akun sekolah lama

- Email: `admin@sarprah.id`
- Kata sandi: `sarprah123`
- Kode sekolah setelah migrasi database lama: `0001`
- Sekolah yang mendaftar setelah migrasi mendapatkan kode acak 4 karakter huruf/angka.

Data contoh lama tetap tersedia setelah database dimigrasikan. Sekolah baru dapat mendaftar sendiri atau dibuat oleh Super Admin.

## Backup & Telegram

- Login sebagai Administrator, buka **Backup & Telegram**, lalu gunakan **Backup sekarang** untuk mengunduh file JSON.
- Restore menerima file backup JSON Sarprah dan mengganti seluruh data aplikasi. Buat backup sebelum melakukan restore.
- Di **Data Sekolah → Identitas Aplikasi**, Administrator dapat mengubah nama dan logo aplikasi. Nama memperbarui label aplikasi serta judul tab browser; logo juga otomatis digunakan sebagai favicon.

## Pemindaian barcode dan supplier

- Formulir tambah peminjaman, pengadaan, pemusnahan, penyusutan, dan stock opname menyediakan pemindaian melalui kamera atau input kode manual. Pemindaian kamera membutuhkan browser yang mendukung `BarcodeDetector` dan akses kamera; scanner USB juga dapat digunakan melalui kolom kode.
- Di **Barang → Data Barang**, unduh **Template CSV** sebelum impor. Isi nama sumber dana, jenis, kategori, satuan, dan supplier sesuai data master yang sudah terdaftar. Nilai harga boleh ditulis seperti `1.000.000`; impor dibatalkan jika ada referensi atau nilai yang tidak valid, sedangkan nama barang duplikat dilewati.
- **Tambah barang yang sudah ada** mencatat tanggal pembelian, sumber dana, supplier, jumlah, dan harga lalu menambahkan stok tanpa membuat master barang baru. **Tambah barang baru** tetap tersedia untuk mendaftarkan barang berbeda.
- Menu **Pindah Ruang Barang** mencatat perpindahan per item inventaris, tanggal pemindahan, ruang asal/tujuan, dan penanggung jawab. Laporan **Riwayat Pergerakan Aset** merangkum barang masuk, peminjaman, perpindahan, dan pemusnahan untuk barang yang dipilih.
- Menu **Portal Publik** membuat link otomatis dari kode sekolah, menampilkan QR Code yang dapat diunduh, dan menyediakan aksi salin link.
- Pada form harga, pemisah ribuan menggunakan titik dan nilai tetap disimpan sebagai angka. Pada stock opname, pilih barang manual atau pindai kode item; stok lama terisi otomatis dari stok saat ini, stok baru wajib diisi, dan total stok tetap ditampilkan sebagai jumlah tanpa awalan Rp.
- Data supplier mencakup nama, alamat, nomor telepon, serta email opsional.
- Grup navigasi sidebar bekerja sebagai accordion: hanya satu grup submenu yang terbuka pada satu waktu.
- Buat bot melalui `@BotFather`, mulai percakapan dengan bot, lalu masukkan chat ID serta token bot di pengaturan. Token disimpan terenkripsi di server dan tidak dikirim balik ke browser.
- Jadwal awal adalah setiap hari pukul **16.00 WIB**. Pilih zona WIB/WITA/WIT, simpan pengaturan, lalu gunakan **Uji koneksi**. Scheduler hanya berjalan saat service Node aktif.
- Secara default server membuat kunci enkripsi `.sarprah-key` di direktori database. Untuk Railway, letakkan database dan kunci pada Volume persisten yang sama. Alternatifnya, set `SARPRAH_ENCRYPTION_KEY` berisi 64 karakter hexadecimal; simpan nilainya sebagai secret Railway dan jangan menggantinya setelah token Telegram atau Fonnte disimpan.

## Notifikasi WhatsApp

- Administrator dapat membuka **Notifikasi WhatsApp**, memasukkan token API Fonnte, memilih pengingat jatuh tempo dan zona waktu, lalu mengaktifkan notifikasi yang diperlukan. Token disimpan terenkripsi di server.
- Isi nomor WhatsApp Kepala Sekolah di **Data Sekolah** untuk notifikasi pengajuan pengadaan dan uji koneksi. Nomor WhatsApp peminjam di formulir peminjaman bersifat opsional, tetapi diperlukan untuk pengingat kepada peminjam.
- Pengingat peminjaman dikirim pada waktu harian yang dipilih. Pengajuan pengadaan yang belum diberitahukan diproses otomatis oleh scheduler. Scheduler hanya bekerja ketika server Node aktif dan pengiriman mengikuti layanan serta kebijakan Fonnte.

## Pengguna dan keamanan

Kelola satu akun Administrator dan role Kepala Sekolah, Wakasek Sarpras, serta Guru dari Pengaturan Akun. Akun baru memerlukan kata sandi minimal 8 karakter. Ubah kata sandi dan avatar aktif melalui pratinjau akun di header/sidebar. Server menggunakan sesi HttpOnly dan verifikasi kata sandi PBKDF2; API backup dan Telegram dibatasi untuk Administrator.

Hak akses menu dapat ditentukan terpisah untuk setiap role dengan tingkat tidak terlihat, lihat saja, lihat/edit, atau lihat/edit/hapus. Perubahan email dan kata sandi akun menunggu konfirmasi penyimpanan sebelum ditampilkan berhasil. Login tidak mengisi kredensial demo secara otomatis.
