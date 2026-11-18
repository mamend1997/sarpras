# Sarprah

Aplikasi web manajemen sarana dan prasarana sekolah. Antarmuka menggunakan HTML, Tailwind CSS, dan JavaScript tanpa proses build; data disimpan di SQLite saat dijalankan melalui server dan tetap memiliki cadangan LocalStorage untuk mode offline.

## SaaS multi-sekolah

- Halaman sekolah: `http://localhost:3000/`. Sekolah baru dapat mendaftar dari tombol **Daftarkan sekolah**; kode tenant acak 4 karakter huruf/angka ditampilkan setelah pendaftaran berhasil.
- Halaman Super Admin: `http://localhost:3000/super-admin`. Pada penggunaan pertama, buat akun Super Admin khusus. Selanjutnya halaman ini meminta login.
- **Branding Sistem** Super Admin menerapkan nama dan logo platform pada aplikasi sekolah dan control center Super Admin, termasuk nama tab browser serta favicon.
- Setiap tenant menyimpan inventaris, akun, dan tiket secara terpisah. Super Admin dapat mengatur sekolah, paket dan masa langganan, pembayaran, fitur, branding, QRIS, syarat/SLA, pengumuman, maintenance, panduan, tiket, WhatsApp, audit, serta backup/restore.
- Pada **Super Admin → Backup & Restore**, jadwalkan backup harian seluruh platform ke Telegram menggunakan token bot dan Chat ID tujuan. Jadwal awal pukul 16.00 WIB; token disimpan terenkripsi dan file mencakup data semua tenant, sehingga chat tujuan harus dijaga kerahasiaannya.
- Restore backup sekolah ke tenant baru memulihkan data sekolah sambil mempertahankan akun Administrator yang sedang login, agar kredensial pendaftaran tetap dapat digunakan.
- Database lama dimigrasikan sebagai tenant awal dengan kode `0001`. Data baru disimpan di SQLite pada `DB_PATH`; jangan gunakan database lokal bersama untuk pengujian yang mengubah data.
- Jika akun sekolah lama belum tercantum di platform SaaS, startup berikutnya akan memasukkannya ke **Daftar Sekolah** sebagai tenant pertama, memberi kode sekolah, dan mempertahankan akses Lifetime. Kode tenant lama seperti `0001` tetap berlaku; data migrasi yang belum lengkap akan dicoba dipulihkan saat startup.
- Fitur maintenance dan masa aktif diperiksa pada autentikasi dan API, bukan hanya disembunyikan dari antarmuka. Backup SaaS berisi data semua tenant dan kredensial hash Super Admin; simpan file backup seperti rahasia dan lindungi kunci enkripsi bersama file database.

## Menjalankan aplikasi

1. Pasang Node.js 22.5 atau lebih baru.
2. Jalankan `npm start`.
3. Buka `http://localhost:3000`.

Server membaca `PORT` dari environment, sehingga dapat dijalankan sebagai web service Railway. Secara lokal, berkas database `sarprah.sqlite` dibuat otomatis di folder proyek dan tidak perlu di-commit. Di Railway, buka pengaturan service → **Volumes**, tambahkan Volume dengan mount path `/data`; Railway akan menyediakan `RAILWAY_VOLUME_MOUNT_PATH` dan aplikasi menyimpan database serta kunci enkripsinya di sana. Jika `DB_PATH` menunjuk ke luar Volume, aplikasi memakai lokasi default di dalam Volume. Tanpa Volume, aplikasi tetap berjalan, tetapi login dan data dapat hilang saat redeploy; log akan meminta Volume dipasang.

Perintah `npm start` menonaktifkan hanya peringatan bawaan Node `ExperimentalWarning` dari `node:sqlite`; peringatan tersebut tidak memengaruhi operasi database.

Jika database sebelumnya tersimpan pada filesystem sementara Railway, salin database beserta `.sarprah-key` ke Volume atau pulihkan backup yang sesuai sebelum menghapus sumber lama. Database baru yang kosong tidak berisi akun Super Admin maupun sekolah lama.

Untuk memulihkan backup sekolah JSON lama, unggah file ke Volume dan set `SARPRAH_LEGACY_BACKUP_PATH` ke path file tersebut (misalnya `/data/sarprah-backup.json`). Pada database yang belum berisi sekolah, server mengimpor backup satu kali lalu memigrasikannya sebagai tenant awal `0001`; impor dilewati jika database sudah memiliki data. Backup sekolah ini tidak memuat akun Super Admin platform. Jika belum ada akun Super Admin pada database persisten, buat akun tersebut sekali setelah pemulihan; backup platform diperlukan untuk memulihkan kredensial Super Admin lama.

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
- **Manajemen File** hanya tersedia untuk Administrator. Halaman ini menampilkan gambar yang tersimpan dalam data tenant dan menghapus gambar tanpa menghapus transaksi atau inventaris terkait. Dashboard menampilkan pemakaian dan sisa kuota foto di bagian paling bawah; kuota default 1 GB (1.024 MB) dapat diubah dengan `SARPRAH_TENANT_STORAGE_QUOTA_MB`.
- Saat server aktif, perubahan disinkronkan ke SQLite hanya untuk bagian data yang berubah; kegagalan kuota LocalStorage tidak menghalangi penyimpanan server. Pemulihan perubahan lokal yang tertunda dilakukan otomatis saat Administrator masuk kembali. Salinan pemulihan dipisahkan menurut kode sekolah agar tidak tercampur antar-tenant; login offline hanya berlaku untuk sekolah yang sama dengan data lokal.
- Pilihan warna tema, Syarat & SLA, serta Petunjuk Pengguna tersedia untuk akun sekolah. Super Admin mengelola konten Syarat & SLA dan panduan melalui halaman administrasi platform.
- Cetak BAST tersedia untuk perpindahan barang, pengadaan, dan pemusnahan. Isi nomor berita acara, pihak yang menyerahkan/menerima, lalu gunakan cetak dokumen; laporan dan dokumen menggunakan tata letak print.

## Pembayaran QRIS dan OTP pendaftaran

- Super Admin dapat mengaktifkan atau menonaktifkan gateway pembayaran otomatis Kasera Pay, Xendit, dan Duitku secara terpisah dari QRIS manual. Simpan kredensial pada **QRIS & harga**, uji pada mode sandbox, lalu daftarkan URL callback yang ditampilkan pada dashboard penyedia.
- Checkout pembayaran memerlukan domain HTTPS publik; atur `PUBLIC_APP_URL` di server produksi. Webhook memverifikasi signature/token dan nominal sebelum mengubah status tagihan. Pastikan metode QRIS diaktifkan pada akun merchant penyedia.
- Di **WhatsApp Gateway**, masukkan token API Fonnte dan aktifkan/nonaktifkan OTP pendaftaran. OTP hanya tersedia jika token Fonnte telah tersimpan; kode berlaku 10 menit dan pendaftaran sekolah tidak meminta jenjang.
- Lupa kata sandi Super Admin dapat dipulihkan dengan OTP Fonnte. Selain token Fonnte yang tersimpan di **WA Gateway**, atur `SARPRAH_SUPER_ADMIN_RECOVERY_PHONE` pada environment server ke nomor WhatsApp tepercaya (format Indonesia, misalnya `081234567890`); di Railway, tambahkan pada **Project → service Sarprah → Variables**, lalu redeploy. Kode berlaku 10 menit dan setiap pemulihan membatalkan sesi Super Admin yang sedang aktif. OTP tidak dikirim ke nomor yang dimasukkan pada formulir. Username/email boleh dikosongkan jika hanya ada satu akun Super Admin. OTP hanya mereset akun yang masih ada; jika semua akun Super Admin terhapus, setup awal akan terbuka kembali untuk membuat akun baru. Jika hanya akun tertentu yang terhapus sementara akun lain masih ada, pulihkan backup platform. Email belum digunakan sebagai jalur pemulihan karena server belum dikonfigurasi untuk mengirim email.

## Pemindaian barcode dan supplier

- Formulir tambah peminjaman, pengadaan, pemusnahan, penyusutan, dan stock opname menyediakan pemindaian melalui kamera atau input kode manual. Pemindaian kamera membutuhkan browser yang mendukung `BarcodeDetector` dan akses kamera; scanner USB juga dapat digunakan melalui kolom kode.
- Di **Barang → Data Barang**, unduh **Template CSV** sebelum impor. Isi nama sumber dana, jenis, kategori, satuan, dan supplier sesuai data master yang sudah terdaftar. Nilai harga boleh ditulis seperti `1.000.000`; impor dibatalkan jika ada referensi atau nilai yang tidak valid, sedangkan nama barang duplikat dilewati.
- **Tambah barang yang sudah ada** mencatat tanggal pembelian, sumber dana, supplier, jumlah, dan harga lalu menambahkan stok tanpa membuat master barang baru. **Tambah barang baru** tetap tersedia untuk mendaftarkan barang berbeda.
- Riwayat penambahan stok ditampilkan di bagian bawah **Barang → Data Barang**. Riwayat dapat dipindahkan ke Kotak Sampah satu per satu atau dengan pilihan massal; penghapusan membatalkan jumlah stok terkait dan penambahan yang stoknya sudah terpakai tidak dapat dihapus sampai jumlahnya mencukupi.
- Menu **Pindah Ruang Barang** memilih barang dari Data Barang, lalu memperbarui ruang barang beserta lokasi item inventaris terkait. Tanggal pemindahan, ruang asal/tujuan, dan penanggung jawab dicatat untuk laporan **Riwayat Pergerakan Aset**. Laporan ini menampilkan peminjaman dan pengembalian sebagai peristiwa terpisah sesuai tanggalnya.
- Menu **Portal Publik** membuat link otomatis dari kode sekolah, menampilkan QR Code yang dapat diunduh, dan menyediakan aksi salin link.
- Pada form harga, pemisah ribuan menggunakan titik dan nilai tetap disimpan sebagai angka. Pada menu Kondisi Barang, jumlah kondisi baik, rusak, dan hilang harus sama dengan total jumlah barang. Pada stock opname, pilih barang manual atau pindai kode item; stok lama terisi otomatis dari stok saat ini, stok baru wajib diisi, dan total stok tetap ditampilkan sebagai jumlah tanpa awalan Rp. Selisih stok lama dan hasil fisik dicatat sebagai jumlah kehilangan dengan status penanganan; kondisi item dapat ditandai Baik, Rusak, Rusak Berat, atau Hilang.
- Menu **Laporan** menyediakan Kondisi Barang per Ruangan, Kerusakan & Kehilangan Aset, Jadwal Pemeliharaan / Servis, serta Berita Acara Stock Opname selain rekap inventaris dan laporan transaksi. Gunakan filter bulan, tahun pelajaran atau rentang tanggal, sumber dana, dan ruangan/lokasi; laporan dapat dicetak dengan kop serta ruang tanda tangan atau diekspor ke Excel.
- Pada **Data Master → Kategori Barang**, pilih **Non KIB** untuk barang habis pakai atau yang bukan aset tetap, atau tentukan golongan KIB A–E untuk aset tetap. Kategori baru otomatis berawal sebagai Non KIB; barang BHP juga tidak disertakan dalam laporan KIB. Isi **Kode Barang KIB** pada Data Barang dengan kode resmi yang digunakan sekolah/instansi; nomor register mengikuti kode unik item inventaris. Laporan **Kartu Inventaris Barang (KIB)** memisahkan golongan A–E, memuat sumber dana, tahun perolehan, kondisi dan harga perolehan, serta menandai unit yang belum memiliki nomor register. Cetak menggunakan kertas A4 lanskap atau ekspor ke Excel; lengkapi tanggal masuk dan data kode sebelum digunakan sebagai dokumen resmi.
- Data supplier mencakup nama, alamat, nomor telepon, serta email opsional.
- Grup navigasi sidebar bekerja sebagai accordion: hanya satu grup submenu yang terbuka pada satu waktu.
- Buat bot melalui `@BotFather`, mulai percakapan dengan bot, lalu masukkan chat ID serta token bot di pengaturan. Token disimpan terenkripsi di server dan tidak dikirim balik ke browser.
- Jadwal awal adalah setiap hari pukul **16.00 WIB**. Pilih zona WIB/WITA/WIT, isi teks pesan uji yang akan dikirim melalui **Uji koneksi**, lalu simpan pengaturan. Pengaturan pesan uji tersedia di menu sekolah dan Super Admin; pesan tersebut tidak mengubah isi backup otomatis. Scheduler hanya berjalan saat service Node aktif.
- Secara default server membuat kunci enkripsi `.sarprah-key` di direktori database. Untuk Railway, letakkan database dan kunci pada Volume persisten yang sama. Alternatifnya, set `SARPRAH_ENCRYPTION_KEY` berisi 64 karakter hexadecimal; simpan nilainya sebagai secret Railway dan jangan menggantinya setelah token Telegram atau Fonnte disimpan.

## Notifikasi WhatsApp

- Administrator dapat membuka **Notifikasi WhatsApp**, memasukkan token API Fonnte, memilih pengingat jatuh tempo dan zona waktu, lalu mengaktifkan notifikasi yang diperlukan. Token disimpan terenkripsi di server.
- Isi nomor WhatsApp Kepala Sekolah di **Data Sekolah** untuk notifikasi pengajuan pengadaan dan uji koneksi. Nomor WhatsApp peminjam di formulir peminjaman bersifat opsional, tetapi diperlukan untuk pengingat kepada peminjam.
- Pengingat peminjaman dikirim pada waktu harian yang dipilih. Pengajuan pengadaan yang belum diberitahukan diproses otomatis oleh scheduler. Scheduler hanya bekerja ketika server Node aktif dan pengiriman mengikuti layanan serta kebijakan Fonnte.

## Pengguna dan keamanan

Kelola satu akun Administrator dan role Kepala Sekolah, Wakasek Sarpras, serta Guru dari Pengaturan Akun. Akun baru memerlukan kata sandi minimal 8 karakter. Ubah kata sandi dan avatar aktif melalui pratinjau akun di header/sidebar. Server menggunakan sesi HttpOnly dan verifikasi kata sandi PBKDF2; API backup dan Telegram dibatasi untuk Administrator.

Hak akses menu dapat ditentukan terpisah untuk setiap role dengan tingkat tidak terlihat, lihat saja, lihat/edit, atau lihat/edit/hapus. Perubahan email dan kata sandi akun menunggu konfirmasi penyimpanan sebelum ditampilkan berhasil. Login tidak mengisi kredensial demo secara otomatis.
