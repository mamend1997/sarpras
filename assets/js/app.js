(() => {
  "use strict";

  const STORE_KEY = "sarprah-state-v1";
  const PENDING_STATE_KEY = "sarprah-pending-server-state-v1";
  const pendingAccountKey = (accountId) => `${STORE_KEY}:pending-account:${accountId}`;
  const today = new Date();
  const dateOffset = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const currentMonth = today.toISOString().slice(0, 7);
  const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const rupiah = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const integerId = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const moneyFields = new Set(["price", "unitPrice", "initialValue", "amount"]);
  const goodsImportHeaders = ["Nama Barang", "Spesifikasi Barang (Opsional)", "Kepemilikan", "Sumber Dana", "Jenis Barang", "Kategori Barang", "Ruang / Lokasi", "Satuan", "Supplier", "Jumlah Barang", "Harga Barang (Rp)", "Status BHP (BHP/Barang Modal)"];
  const goodsFilterFields = [
    ["ownershipId", "Kepemilikan", "ownerships"],
    ["fundId", "Sumber Dana", "funds"],
    ["typeId", "Jenis Barang", "types"],
    ["categoryId", "Kategori", "categories"],
    ["locationId", "Ruang / Lokasi", "locations"],
    ["unitId", "Satuan", "units"],
    ["supplierId", "Supplier", "suppliers"]
  ];
  const yearMasterCollections = ["types", "categories", "units", "locations", "ownerships", "suppliers", "funds"];
  const yearScopedCollections = new Set([...yearMasterCollections, "goods"]);
  const inventoryReportTypes = new Set(["inventarisBhp", "inventarisModal"]);
  const formatThousands = (value) => String(value ?? "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const parseThousands = (value) => Number(String(value ?? "").replace(/\D/g, "")) || 0;
  const parseGroupedInteger = (value) => {
    const text = String(value ?? "").trim();
    if (!/^\d+(?:\.\d{3})*$/.test(text)) return null;
    const number = Number(text.replace(/\./g, ""));
    return Number.isSafeInteger(number) ? number : null;
  };
  const permissionRoles = ["Kepala Sekolah", "Wakasek Sarpras", "Guru"];
  const permissionPages = ["dashboard", "school", "printDesign", "types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears", "goods", "checkGoods", "usages", "stocktakes", "barcode", "loans", "procurements", "disposals", "depreciations", "reports"];
  const defaultMenuPermissions = { dashboard: "view", goods: "edit", checkGoods: "view", loans: "edit", procurements: "edit", disposals: "edit", reports: "view" };
  const createDefaultPermissions = () => Object.fromEntries(permissionRoles.map((role) => [
    role,
    Object.fromEntries(permissionPages.map((key) => [key, defaultMenuPermissions[key] || "hidden"]))
  ]));
  const niceDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const seed = {
    school: { name: "SMA Negeri 1 Bandung", npsn: "20219327", phone: "(022) 4204152", email: "info@sman1bdg.sch.id", website: "www.sman1bdg.sch.id", address: "Jl. Ir. H. Juanda No. 93, Bandung", city: "Bandung", principalName: "", principalNip: "", sarprasVicePrincipalName: "", sarprasVicePrincipalNip: "", letterheadLogo: "", footer: "SMA Negeri 1 Bandung · Berkarakter, Berprestasi", logo: "" },
    types: [{ id: "tp1", name: "Elektronik", type: "sarana" }, { id: "tp2", name: "Mebel", type: "sarana" }, { id: "tp3", name: "Bangunan", type: "prasarana" }, { id: "tp4", name: "Olahraga", type: "sarana" }],
    categories: [{ id: "ct1", name: "Peralatan TIK", typeId: "tp1", note: "Perangkat teknologi informasi" }, { id: "ct2", name: "Perabot Kelas", typeId: "tp2", note: "Perlengkapan ruang kelas" }, { id: "ct3", name: "Peralatan Olahraga", typeId: "tp4", note: "Alat olahraga dan kebugaran" }, { id: "ct4", name: "Gedung & Ruang", typeId: "tp3", note: "Bangunan dan ruang sekolah" }],
    units: [{ id: "un1", name: "unit" }, { id: "un2", name: "pcs" }, { id: "un3", name: "set" }, { id: "un4", name: "rim" }],
    locations: [{ id: "lo1", name: "Ruang Kepala Sekolah" }, { id: "lo2", name: "Ruang Kelas" }, { id: "lo3", name: "Laboratorium Komputer" }, { id: "lo4", name: "Ruang Olahraga" }, { id: "lo5", name: "Ruang Tata Usaha" }, { id: "lo6", name: "Aula" }],
    ownerships: [{ id: "ow1", name: "Milik" }, { id: "ow2", name: "Sewa" }, { id: "ow3", name: "Pinjam" }, { id: "ow4", name: "Bukan Milik" }],
    suppliers: [{ id: "sp1", name: "CV Sumber Teknologi", address: "Jl. Asia Afrika No. 18, Bandung", phone: "(022) 4201188", email: "info@sumberteknologi.id" }, { id: "sp2", name: "PT Maju Jaya Abadi", address: "Jl. Soekarno Hatta No. 210, Bandung", phone: "(022) 7302210", email: "kontak@majujaya.id" }, { id: "sp3", name: "Koperasi Sekolah", address: "Jl. Ir. H. Juanda No. 93, Bandung", phone: "(022) 4204152", email: "" }],
    funds: [{ id: "fd1", name: "BOS", description: "Bantuan Operasional Sekolah" }, { id: "fd2", name: "Komite Sekolah", description: "Dana partisipasi komite" }, { id: "fd3", name: "Kenang-kenangan Siswa", description: "Hibah dan kenang-kenangan" }],
    academicYears: [{ id: "ay1", name: "2026/2027", startDate: "2026-07-01", endDate: "2027-06-30", status: "Aktif" }],
    goods: [
      { id: "gd1", name: "Laptop Lenovo ThinkPad", ownershipId: "ow1", fundId: "fd1", typeId: "tp1", categoryId: "ct1", locationId: "lo3", unitId: "un1", supplierId: "sp1", quantity: 24, price: 8750000, consumable: false },
      { id: "gd2", name: "Proyektor Epson EB-X06", ownershipId: "ow1", fundId: "fd1", typeId: "tp1", categoryId: "ct1", locationId: "lo2", unitId: "un1", supplierId: "sp1", quantity: 8, price: 6200000, consumable: false },
      { id: "gd3", name: "Meja Siswa Kayu", ownershipId: "ow1", fundId: "fd2", typeId: "tp2", categoryId: "ct2", locationId: "lo2", unitId: "un1", supplierId: "sp2", quantity: 120, price: 485000, consumable: false },
      { id: "gd4", name: "Bola Basket Molten", ownershipId: "ow1", fundId: "fd3", typeId: "tp4", categoryId: "ct3", locationId: "lo4", unitId: "un2", supplierId: "sp3", quantity: 18, price: 375000, consumable: false },
      { id: "gd5", name: "Kertas A4 80gsm", ownershipId: "ow1", fundId: "fd1", typeId: "tp1", categoryId: "ct1", locationId: "lo5", unitId: "un4", supplierId: "sp3", quantity: 45, price: 58000, consumable: true },
      { id: "gd6", name: "Ruang Kelas", ownershipId: "ow1", fundId: "fd1", typeId: "tp3", categoryId: "ct4", locationId: "lo2", unitId: "un1", supplierId: "sp2", quantity: 12, price: 125000000, consumable: false }
    ],
    items: [
      { id: "it1", code: "E.1-T.1-L1-KS.1", goodId: "gd1", condition: "Baik", locationId: "lo3", received: dateOffset(-370) },
      { id: "it2", code: "E.1-T.1-L1-KS.2", goodId: "gd1", condition: "Baik", locationId: "lo3", received: dateOffset(-330) },
      { id: "it3", code: "E.1-T.1-L1-KS.3", goodId: "gd1", condition: "Rusak", locationId: "lo3", received: dateOffset(-330) },
      { id: "it4", code: "E.1-T.2-L1-KS.1", goodId: "gd2", condition: "Baik", locationId: "lo2", received: dateOffset(-200) },
      { id: "it5", code: "E.1-T.3-L2-KS.1", goodId: "gd3", condition: "Baik", locationId: "lo2", received: dateOffset(-620) },
      { id: "it6", code: "E.1-T.3-L2-KS.2", goodId: "gd3", condition: "Baik", locationId: "lo2", received: dateOffset(-620) },
      { id: "it7", code: "E.1-T.4-L3-KS.1", goodId: "gd4", condition: "Baik", locationId: "lo4", received: dateOffset(-150) },
      { id: "it8", code: "E.1-T.5-L2-KS.1", goodId: "gd6", condition: "Baik", locationId: "lo2", received: dateOffset(-740) }
    ],
    usages: [{ id: "us1", applicant: "Rina Kurniawati", goodId: "gd5", quantity: 3, date: dateOffset(-3), status: "Disetujui" }],
    stocktakes: [{ id: "st1", date: dateOffset(-8), goodId: "gd5", oldStock: 52, newStock: 45, total: 45, note: "Penyesuaian stok akhir bulan" }, { id: "st2", date: dateOffset(-26), goodId: "gd4", oldStock: 20, newStock: 18, total: 18, note: "Pengecekan berkala" }],
    loans: [
      { id: "ln1", borrower: "Andi Pratama", goodId: "gd1", locationId: "lo3", startDate: dateOffset(-8), dueDate: dateOffset(-2), note: "Kegiatan lomba informatika", status: "Diterima" },
      { id: "ln2", borrower: "Dewi Lestari", goodId: "gd2", locationId: "lo2", startDate: dateOffset(-1), dueDate: dateOffset(5), note: "Presentasi kelas XI", status: "Pengajuan" },
      { id: "ln3", borrower: "Budi Santoso", goodId: "gd4", locationId: "lo4", startDate: dateOffset(-15), dueDate: dateOffset(-7), note: "Latihan tim basket", status: "Diterima" }
    ],
    procurements: [
      { id: "pr1", proposer: "Rina Kurniawati", title: "Pengadaan Perangkat TIK", goodId: "gd1", priority: "Mendesak", quantity: 3, unitPrice: 8750000, fundId: "fd1", date: dateOffset(-2), note: "Untuk kebutuhan laboratorium komputer", status: "Pengajuan" },
      { id: "pr2", proposer: "Agus Setiawan", title: "Pengadaan Meja Siswa", goodId: "gd3", priority: "Normal", quantity: 12, unitPrice: 485000, fundId: "fd2", date: dateOffset(-9), note: "Penggantian meja kelas X", status: "Diterima" },
      { id: "pr3", proposer: "Dewi Lestari", title: "Peralatan Olahraga", goodId: "gd4", priority: "Normal", quantity: 4, unitPrice: 375000, fundId: "fd3", date: dateOffset(-15), note: "Tambahan inventaris olahraga", status: "Diterima" }
    ],
    disposals: [{ id: "dp1", goodId: "gd1", locationId: "lo3", reason: "Kerusakan motherboard dan tidak dapat diperbaiki", date: dateOffset(-4), status: "Pengajuan" }],
    depreciations: [{ id: "de1", date: dateOffset(-30), goodId: "gd1", initialValue: 8750000, amount: 875000, finalValue: 7875000 }, { id: "de2", date: dateOffset(-30), goodId: "gd2", initialValue: 6200000, amount: 620000, finalValue: 5580000 }],
    accounts: [{ id: "ac1", name: "Admin Sekolah", email: "admin@sarprah.id", role: "Administrator", active: true, edit: true, remove: true }, { id: "ac2", name: "Wakasek Sarpras", email: "wakasek@sarprah.id", role: "Wakasek Sarpras", active: true, edit: true, remove: false }, { id: "ac3", name: "Kepala Sekolah", email: "kepsek@sarprah.id", role: "Kepala Sekolah", active: true, edit: false, remove: false }, { id: "ac4", name: "Guru", email: "guru@sarprah.id", role: "Guru", active: true, edit: false, remove: false }],
    settings: { appName: "Sarprah", appLogo: "", printDesign: { showLogo: true, showNpsn: true, showContact: true, headerMode: "school", customHeaderText: "", headerFontSize: 16, logoSize: 56, headerBold: true, headerItalic: false }, mobileNav: ["dashboard", "goods", "checkGoods", "procurements", "reports"], mobileNavHighlight: "checkGoods", permissions: createDefaultPermissions() },
    months: [34, 41, 38, 48, 46, 57, 55, 62, 59, 69, 73, 82]
  };

  const state = structuredClone(seed);
  let page = "dashboard";
  let activeUser = null;
  let apiAvailable = false;
  let activeBarcodeScanner = null;
  let goodsCheckStream = null;
  let goodsCheckTimer = null;
  let mobileNavDraft = null;
  let mobileNavHighlightDraft = null;
  let pendingStateRecovery = null;
  let searchTerm = "";
  let selectedFilter = "Semua";
  let goodsFilters = {};
  let goodsFiltersOpen = false;
  let chartPeriod = "12";

  const meta = {
    dashboard: ["Dashboard", "Ringkasan kondisi sarana dan prasarana sekolah hari ini.", "layout-dashboard"],
    school: ["Data Sekolah", "Kelola profil sekolah untuk kop laporan dan identitas aplikasi.", "school"],
    printDesign: ["Desain Kop & Tanda Tangan", "Atur teks, logo, tipografi kop, dan informasi penandatangan.", "pen-tool"],
    types: ["Jenis Barang", "Kelompokkan aset berdasarkan jenis sarana atau prasarana.", "shapes"],
    categories: ["Kategori Barang", "Atur kategori agar pendataan aset lebih terstruktur.", "tags"],
    units: ["Satuan", "Kelola satuan untuk pencatatan barang dan stok.", "ruler"],
    locations: ["Ruang / Lokasi", "Daftar ruang dan lokasi penempatan inventaris.", "map-pin"],
    ownerships: ["Kepemilikan", "Kelola pilihan kepemilikan barang.", "key-round"],
    suppliers: ["Penyedia / Supplier", "Kelola supplier sekolah beserta alamat dan informasi kontak.", "truck"],
    funds: ["Sumber Dana", "Kelola sumber pendanaan dan hibah aset.", "wallet"],
    academicYears: ["Tahun Pelajaran", "Kelola daftar tahun pelajaran sekolah.", "calendar-days"],
    goods: ["Data Barang", "Daftar master barang dan informasi pengadaan aset.", "package"],
    checkGoods: ["Cek Barang", "Pindai barcode atau cari barang untuk melihat detail dan riwayat stok.", "scan-search"],
    usages: ["Penggunaan BHP", "Tinjau dan catat permintaan penggunaan barang habis pakai.", "clipboard-list"],
    stocktakes: ["Stock Opname", "Rekam hasil pemeriksaan dan penyesuaian stok.", "clipboard-check"],
    barcode: ["Cetak Barcode", "Pilih item inventaris dan cetak label QR Code.", "qr-code"],
    loans: ["Peminjaman & Pengembalian", "Kelola pengajuan, peminjaman, dan pengembalian barang.", "repeat-2"],
    procurements: ["Pengadaan Barang", "Pantau usulan dan realisasi pengadaan aset.", "shopping-cart"],
    disposals: ["Pemusnahan Barang", "Kelola pengajuan pemusnahan aset rusak.", "archive-x"],
    depreciations: ["Penyusutan", "Catat perubahan nilai barang secara berkala.", "trending-down"],
    reports: ["Laporan", "Rekap inventaris dan transaksi sarana prasarana sekolah.", "files"],
    accounts: ["Pengaturan", "Kelola akun pengguna, hak akses, dan identitas aplikasi.", "settings-2"],
    backup: ["Backup & Telegram", "Unduh dan pulihkan data, serta atur backup otomatis ke Telegram.", "database-backup"]
  };

  const navGroups = [
    { section: "RINGKASAN", links: [{ id: "dashboard", label: "Dashboard", icon: "layout-dashboard" }] },
    { section: "PENGELOLAAN", groups: [
      { label: "Transaksi", icon: "arrow-left-right", children: [["loans", "Peminjaman"], ["procurements", "Pengadaan"], ["disposals", "Pemusnahan"], ["depreciations", "Penyusutan"]] },
      { label: "Barang", icon: "package", children: [["goods", "Data Barang"], ["checkGoods", "Cek Barang"], ["usages", "Penggunaan BHP"], ["stocktakes", "Stock Opname"], ["barcode", "Cetak Barcode"]] },
      { label: "Data Master", icon: "database", children: [["school", "Data Sekolah"], ["printDesign", "Desain Kop & Tanda Tangan"], ["types", "Jenis Barang"], ["categories", "Kategori Barang"], ["units", "Satuan"], ["locations", "Ruang / Lokasi"], ["ownerships", "Kepemilikan"], ["suppliers", "Penyedia / Supplier"], ["funds", "Sumber Dana"], ["academicYears", "Tahun Pelajaran"]] }
    ] },
    { links: [{ id: "reports", label: "Laporan", icon: "files" }, { id: "accounts", label: "Pengaturan", icon: "settings-2" }, { id: "backup", label: "Backup & Telegram", icon: "database-backup" }] }
  ];

  const collectionConfig = {
    types: { title: "Jenis Barang", description: "Daftar jenis dan klasifikasi barang.", singular: "Jenis Barang", cols: [["name", "Nama Jenis"], ["type", "Tipe"]], fields: [["name", "Nama Jenis", "text", true], ["type", "Tipe", "select", true, ["sarana", "prasarana"]],] },
    categories: { title: "Kategori Barang", description: "Kategori membantu mengelompokkan barang.", singular: "Kategori", cols: [["name", "Nama Kategori"], ["typeId", "Jenis Barang"], ["note", "Keterangan"]], fields: [["name", "Nama Kategori", "text", true], ["typeId", "Jenis Barang", "select", true, "types"], ["note", "Keterangan", "text"]] },
    units: { title: "Satuan", description: "Satuan untuk mencatat jumlah barang.", singular: "Satuan", cols: [["name", "Nama Satuan"]], fields: [["name", "Nama Satuan", "text", true]] },
    locations: { title: "Ruang / Lokasi", description: "Daftar ruang penyimpanan dan penggunaan barang.", singular: "Lokasi", cols: [["name", "Nama Ruang / Lokasi"]], fields: [["name", "Nama Ruang / Lokasi", "text", true]] },
    ownerships: { title: "Kepemilikan", description: "Daftar jenis kepemilikan yang dapat dipilih pada Data Barang.", singular: "Kepemilikan", cols: [["name", "Nama Kepemilikan"]], fields: [["name", "Nama Kepemilikan", "text", true]] },
    suppliers: { title: "Penyedia / Supplier", description: "Daftar penyedia, alamat, dan kontak supplier sekolah.", singular: "Supplier", cols: [["name", "Nama Supplier"], ["address", "Alamat"], ["phone", "No. Telepon"], ["email", "Email"]], fields: [["name", "Nama Supplier", "text", true], ["address", "Alamat", "textarea", true], ["phone", "No. Telepon", "tel", true], ["email", "Email (opsional)", "email"]] },
    funds: { title: "Sumber Dana", description: "Sumber pendanaan untuk pengadaan aset.", singular: "Sumber Dana", cols: [["name", "Nama Sumber Dana"], ["description", "Keterangan"]], fields: [["name", "Nama Sumber Dana", "text", true], ["description", "Keterangan", "text"]] },
    academicYears: { title: "Tahun Pelajaran", description: "Kelola periode tahun ajaran dan salin data master serta barang dari tahun sebelumnya.", singular: "Tahun Pelajaran", cols: [["name", "Tahun Pelajaran"], ["startDate", "Tanggal Mulai"], ["endDate", "Tanggal Selesai"], ["status", "Status"]], fields: [["name", "Tahun Pelajaran", "text", true], ["startDate", "Tanggal Mulai", "date", true], ["endDate", "Tanggal Selesai", "date", true], ["copyPreviousData", "Salin data master dan barang beserta stok terakhir dari tahun sebelumnya", "checkbox"], ["status", "Status", "select", true, ["Aktif", "Arsip"]]] },
    goods: { title: "Data Barang", description: "Informasi barang, spesifikasi, kepemilikan, lokasi, stok, dan sumber pendanaannya.", singular: "Barang", cols: [["name", "Nama Barang"], ["specification", "Spesifikasi Barang"], ["ownershipId", "Kepemilikan"], ["fundId", "Sumber Dana"], ["typeId", "Jenis"], ["categoryId", "Kategori"], ["locationId", "Ruang / Lokasi"], ["unitId", "Satuan"], ["supplierId", "Supplier"], ["quantity", "Jumlah"], ["price", "Tarif Barang"], ["consumable", "Status BHP"]], fields: [["name", "Nama Barang", "text", true], ["specification", "Spesifikasi Barang (opsional)", "textarea"], ["ownershipId", "Kepemilikan", "select", true, "ownerships"], ["fundId", "Sumber Dana", "select", true, "funds"], ["typeId", "Jenis Barang", "select", true, "types"], ["categoryId", "Kategori", "select", true, "categories"], ["locationId", "Ruang / Lokasi Barang", "select", true, "locations"], ["unitId", "Satuan", "select", true, "units"], ["supplierId", "Supplier", "select", true, "suppliers"], ["quantity", "Jumlah Barang", "number", true], ["price", "Tarif Barang (Rp)", "number", true], ["consumable", "Status BHP", "select", true, ["BHP", "Barang Modal"]]] },
    items: { title: "Data Item", description: "Inventaris per unit dengan kode unik, kondisi, dan lokasi.", singular: "Item Inventaris", cols: [["code", "Kode Unik"], ["goodId", "Nama Barang"], ["condition", "Kondisi"], ["locationId", "Lokasi"], ["received", "Tanggal Diterima"]], fields: [["goodId", "Nama Barang", "select", true, "goods"], ["condition", "Kondisi", "select", true, ["Baik", "Rusak"]], ["locationId", "Lokasi", "select", true, "locations"], ["received", "Tanggal Diterima", "date", true]] },
    usages: { title: "Penggunaan BHP", description: "Persetujuan permintaan barang habis pakai.", singular: "Penggunaan BHP", cols: [["applicant", "Nama Pengguna"], ["goodId", "Nama Barang"], ["quantity", "Jumlah"], ["date", "Tanggal"], ["status", "Status"]], fields: [["goodId", "Barang BHP", "select", true, "bhpGoods"], ["applicant", "Nama Pengguna", "text", true], ["quantity", "Jumlah Barang", "number", true], ["unitId", "Satuan", "unit"], ["date", "Tanggal", "date", true], ["note", "Keterangan", "textarea"]] },
    stocktakes: { title: "Stock Opname", description: "Riwayat pemeriksaan dan koreksi jumlah stok barang.", singular: "Stock Opname", cols: [["date", "Tanggal"], ["goodId", "Nama Barang"], ["oldStock", "Stok Lama"], ["newStock", "Stok Baru"], ["total", "Total Stok"], ["note", "Keterangan"], ["checker", "Nama Pengecek"]], fields: [["date", "Tanggal Opname", "date", true], ["goodId", "Nama Barang", "select", true, "goods"], ["oldStock", "Jumlah Stok Lama", "number", true], ["newStock", "Stok Baru", "number", true], ["note", "Keterangan", "text"], ["checker", "Nama Pengecek", "text", true]] },
    loans: { title: "Peminjaman Barang", description: "Pengajuan dan status peminjaman barang sekolah.", singular: "Peminjaman", cols: [["borrower", "Peminjam"], ["goodId", "Barang"], ["locationId", "Lokasi"], ["startDate", "Tanggal Sewa"], ["dueDate", "Tanggal Kembali"], ["late", "Keterlambatan"], ["status", "Status"]], fields: [["borrower", "Nama Peminjam", "text", true], ["goodId", "Barang", "select", true, "goods"], ["locationId", "Lokasi", "select", true, "locations"], ["startDate", "Tanggal Sewa", "date", true], ["dueDate", "Tanggal Kembali", "date", true], ["note", "Keterangan", "textarea"]] },
    procurements: { title: "Pengadaan Barang", description: "Usulan pengadaan, prioritas, dan realisasi barang.", singular: "Pengadaan", cols: [["title", "Nama Pengadaan"], ["proposer", "Nama Pengusul"], ["goodId", "Barang"], ["priority", "Prioritas"], ["date", "Tanggal"], ["total", "Nominal"], ["status", "Status"]], fields: [["proposer", "Nama Pengusul", "text", true], ["title", "Nama Pengadaan", "text", true], ["goodId", "Barang", "select", true, "goods"], ["priority", "Prioritas", "select", true, ["Normal", "Mendesak"]], ["quantity", "Jumlah Barang", "number", true], ["unitPrice", "Harga Satuan (Rp)", "number", true], ["fundId", "Sumber Dana", "select", true, "funds"], ["date", "Tanggal Pengadaan", "date", true], ["note", "Keterangan", "textarea"]] },
    disposals: { title: "Pemusnahan Barang", description: "Kelola pengajuan pemusnahan barang sekolah.", singular: "Pemusnahan", cols: [["goodId", "Barang"], ["locationId", "Lokasi"], ["reason", "Keterangan"], ["evidence", "Bukti"], ["date", "Tanggal Pengajuan"], ["status", "Status"]], fields: [["goodId", "Barang", "select", true, "goods"], ["locationId", "Lokasi", "select", true, "locations"], ["reason", "Alasan pemusnahan", "textarea", true], ["evidence", "Bukti foto (opsional)", "file"], ["date", "Tanggal Pengajuan", "date", true]] },
    depreciations: { title: "Penyusutan Nilai Aset", description: "Catat penyusutan nilai barang secara berkala.", singular: "Penyusutan", cols: [["date", "Tanggal"], ["goodId", "Barang"], ["initialValue", "Harga Awal"], ["amount", "Penyusutan"], ["finalValue", "Harga Akhir"]], fields: [["date", "Tanggal", "date", true], ["goodId", "Barang", "select", true, "goods"], ["initialValue", "Harga Awal (Rp)", "number", true], ["amount", "Penyusutan (Rp)", "number", true]] },
    accounts: { title: "Pengaturan", description: "Kelola pengguna aplikasi dan izin akses.", singular: "Akun", cols: [["name", "Nama Pengguna"], ["email", "Email"], ["role", "Peran"], ["active", "Status"]], fields: [["name", "Nama Pengguna", "text", true], ["email", "Email", "email", true], ["role", "Peran", "select", true, ["Administrator", "Kepala Sekolah", "Wakasek Sarpras", "Guru"]], ["active", "Akun aktif", "checkbox"], ["password", "Kata sandi (min. 8 karakter)", "password"], ["passwordConfirm", "Konfirmasi kata sandi", "password"]] }
  };
  const statusPages = new Set(["usages", "loans", "procurements", "disposals"]);
  const bulkDeletePages = new Set(["goods", "usages", "stocktakes", "loans", "procurements", "disposals", "depreciations"]);
  const statusOptions = {
    usages: ["Semua", "Pengajuan", "Disetujui", "Ditolak"],
    loans: ["Semua", "Pengajuan", "Diterima", "Ditolak", "Selesai"],
    procurements: ["Semua", "Pengajuan", "Diterima", "Ditolak"],
    disposals: ["Semua", "Pengajuan", "Diterima", "Ditolak", "Selesai"]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const getById = (collection, value) => (state[collection] || []).find((row) => row.id === value);
  const relatedName = (collection, value, key = "name") => getById(collection, value)?.[key] || "—";
  const titleOfGood = (value) => relatedName("goods", value);
  const isBhp = (good) => good.consumable === true || ["true", "bhp", "barang habis pakai", "barang habis pakai (bhp)"].includes(String(good.consumable || "").trim().toLocaleLowerCase("id-ID"));
  const isInventoryReport = (type) => inventoryReportTypes.has(type);

  function showToast(message, error = false) {
    const toast = document.createElement("div");
    toast.className = `toast${error ? " error" : ""}`;
    toast.innerHTML = `<i data-lucide="${error ? "circle-alert" : "circle-check"}"></i><span>${esc(message)}</span>`;
    $("#toastRoot").append(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });
    setTimeout(() => toast.remove(), 3300);
  }

  function isPendingLocalAccount(account) {
    return Boolean(account?.id && localStorage.getItem(pendingAccountKey(account.id)) === "1");
  }

  function readPendingLocalAccounts() {
    let accounts = state.accounts;
    try {
      const cached = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (Array.isArray(cached?.accounts)) accounts = cached.accounts;
    } catch (error) {
      showToast(`Akun lokal yang belum tersinkron tidak dapat dibaca: ${error.message}`, true);
    }
    return accounts.filter(isPendingLocalAccount);
  }

  function markPendingLocalAccount(account) {
    try { localStorage.setItem(pendingAccountKey(account.id), "1"); }
    catch (error) { showToast(`Status sinkronisasi akun gagal disimpan: ${error.message}`, true); }
  }

  function clearPendingLocalAccount(account) {
    localStorage.removeItem(pendingAccountKey(account.id));
  }

  function cachePendingServerState() {
    try {
      localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast(`Perubahan belum tersinkron dan salinan pemulihan gagal disimpan: ${error.message}`, true);
      return false;
    }
  }

  function handleStateSyncFailure(status, detail = "") {
    apiAvailable = false;
    cachePendingServerState();
    const reason = status === 401
      ? "Sesi server berakhir (401)."
      : status ? `Server menolak sinkronisasi (HTTP ${status}).` : "Server tidak dapat dijangkau.";
    showToast(`${reason} Perubahan disimpan lokal; login sebagai Administrator untuk memulihkan atau menggunakan data server.${detail ? ` ${detail}` : ""}`, true);
  }

  function readPendingServerState() {
    const stored = localStorage.getItem(PENDING_STATE_KEY);
    if (!stored) return null;
    try {
      const snapshot = JSON.parse(stored);
      if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.accounts)) throw new Error("Struktur salinan pemulihan tidak valid.");
      return snapshot;
    } catch (error) {
      showToast(`Salinan pemulihan lokal tidak dapat dibaca: ${error.message}`, true);
      return null;
    }
  }

  async function passwordCredentials(password) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = [...saltBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 210000, hash: "SHA-256" }, key, 256);
    const passwordHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return { passwordSalt: salt, passwordHash };
  }

  async function verifyPassword(account, password) {
    if (!account?.passwordSalt || !account?.passwordHash) return false;
    const saltBytes = new Uint8Array((account.passwordSalt.match(/.{2}/g) || []).map((part) => parseInt(part, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 210000, hash: "SHA-256" }, key, 256);
    const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return actual === account.passwordHash;
  }

  function initials(name) {
    return String(name || "Admin").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  }

  function syncProfile() {
    if (!activeUser) return;
    $$("#topbarUser .avatar").forEach((node) => {
      node.textContent = initials(activeUser.name);
      node.classList.toggle("avatar-photo", Boolean(activeUser.avatar));
      node.style.backgroundImage = activeUser.avatar ? `url("${activeUser.avatar}")` : "";
    });
    renderTopbarProfileMenu();
    sessionStorage.setItem("sarprah-user", JSON.stringify({ id: activeUser.id }));
  }

  function renderTopbarProfileMenu() {
    const menu = $("#topbarProfileMenu");
    if (!menu || !activeUser) return;
    const avatar = activeUser.avatar
      ? `<img class="topbar-profile-avatar" src="${esc(activeUser.avatar)}" alt="">`
      : `<span class="avatar">${esc(initials(activeUser.name))}</span>`;
    menu.innerHTML = `<div class="topbar-profile-summary">${avatar}<div><b>${esc(activeUser.name)}</b><small>${esc(activeUser.role)}</small></div></div><div class="topbar-profile-email">${esc(activeUser.email)}</div><button class="topbar-profile-action" type="button" role="menuitem" data-profile-action="edit-profile"><i data-lucide="user-round-pen"></i>Edit profil</button><button class="topbar-profile-action topbar-profile-logout" type="button" role="menuitem" data-profile-action="logout"><i data-lucide="log-out"></i>Keluar</button>`;
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
  }

  function closeTopbarProfileMenu() {
    const menu = $("#topbarProfileMenu");
    menu?.classList.add("hidden");
    $("#topbarUser")?.setAttribute("aria-expanded", "false");
  }

  function closeNotificationDropdown() {
    $("#notificationDropdown")?.classList.add("hidden");
    $("#notificationToggle")?.setAttribute("aria-expanded", "false");
  }

  function restoreLocalUserSession() {
    const stored = sessionStorage.getItem("sarprah-user");
    if (!stored) return false;
    let session;
    try { session = JSON.parse(stored); }
    catch {
      sessionStorage.removeItem("sarprah-user");
      return false;
    }
    const account = getById("accounts", session?.id);
    if (!account?.active) {
      sessionStorage.removeItem("sarprah-user");
      return false;
    }
    activeUser = account;
    return true;
  }

  function openTopbarSearch() {
    $("#topbarSearch").classList.add("open");
    $("#searchTrigger").classList.add("hidden");
    $("#searchTrigger").setAttribute("aria-expanded", "true");
    $("#topbarSearchBox").classList.remove("hidden");
    $("#globalSearch").focus();
  }

  function closeTopbarSearch() {
    $("#topbarSearch").classList.remove("open");
    $("#topbarSearchBox").classList.add("hidden");
    $("#searchTrigger").classList.remove("hidden");
    $("#searchTrigger").setAttribute("aria-expanded", "false");
    $("#globalSearch").value = "";
    $("#searchResults").innerHTML = "";
    $("#searchResults").classList.add("hidden");
  }

  function updateTopbarSearchResults() {
    const query = $("#globalSearch").value.trim().toLowerCase();
    const results = $("#searchResults");
    if (!query) {
      results.innerHTML = "";
      results.classList.add("hidden");
      return;
    }
    const matches = Object.entries(meta)
      .filter(([, value]) => value[0].toLowerCase().includes(query) || value[1].toLowerCase().includes(query))
      .filter(([key]) => canViewPage(key))
      .slice(0, 7);
    results.innerHTML = matches.map(([key, value]) => `<button class="topbar-search-result" type="button" role="option" data-page="${key}"><i data-lucide="${value[2]}"></i><span>${esc(value[0])}</span><i class="search-result-arrow" data-lucide="arrow-up-right"></i></button>`).join("") || `<div class="topbar-search-empty">Menu tidak ditemukan.</div>`;
    results.classList.remove("hidden");
    if (window.lucide) lucide.createIcons({ nodes: [results] });
  }

  function ensureBrandingDefaults() {
    if (!state.settings || typeof state.settings !== "object") state.settings = {};
    let changed = false;
    if (typeof state.settings.appName !== "string" || !state.settings.appName.trim()) {
      state.settings.appName = "Sarprah";
      changed = true;
    }
    if (typeof state.settings.appLogo !== "string") {
      state.settings.appLogo = "";
      changed = true;
    }
    return changed;
  }

  function ensureAcademicYearDefaults() {
    let changed = false;
    if (!Array.isArray(state.academicYears) || !state.academicYears.length) {
      state.academicYears = structuredClone(seed.academicYears);
      changed = true;
    }
    const settings = state.settings || (state.settings = {});
    if (!state.academicYears.some((year) => year.id === settings.selectedAcademicYearId)) {
      settings.selectedAcademicYearId = (state.academicYears.find((year) => year.status === "Aktif") || state.academicYears[0])?.id || "";
      changed = true;
    }
    state.academicYears.forEach((year) => {
      const bounds = academicYearBounds(year);
      if (!year.startDate && bounds) { year.startDate = bounds.start; changed = true; }
      if (!year.endDate && bounds) { year.endDate = bounds.end; changed = true; }
    });
    yearScopedCollections.forEach((collection) => {
      (state[collection] || []).forEach((row) => {
        if (!row.academicYearId) {
          row.academicYearId = settings.selectedAcademicYearId;
          changed = true;
        }
      });
    });
    return changed;
  }

  function currentAcademicYearId() {
    return state.settings?.selectedAcademicYearId || state.academicYears?.find((year) => year.status === "Aktif")?.id || state.academicYears?.[0]?.id || "";
  }

  function recordsForAcademicYear(collection, academicYearId = currentAcademicYearId()) {
    const records = state[collection] || [];
    if (!yearScopedCollections.has(collection) || !academicYearId) return records;
    return records.filter((row) => !row.academicYearId || row.academicYearId === academicYearId);
  }

  function recordsForCurrentAcademicYear(collection) {
    return recordsForAcademicYear(collection);
  }

  function previousAcademicYear(startDate) {
    return (state.academicYears || [])
      .filter((year) => year.endDate && year.endDate < startDate)
      .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0] || null;
  }

  function copyAcademicYearData(sourceYearId, targetYearId) {
    const idMaps = Object.fromEntries(yearMasterCollections.map((collection) => [collection, new Map()]));
    yearMasterCollections.forEach((collection) => {
      if (!Array.isArray(state[collection])) state[collection] = [];
      recordsForAcademicYear(collection, sourceYearId)
        .filter((row) => row.academicYearId === sourceYearId)
        .forEach((row) => {
          const copy = structuredClone(row);
          const oldId = copy.id;
          copy.id = id();
          copy.academicYearId = targetYearId;
          idMaps[collection].set(oldId, copy.id);
          if (collection === "categories") copy.typeId = idMaps.types.get(copy.typeId) || copy.typeId;
          state[collection].unshift(copy);
        });
    });
    if (!Array.isArray(state.goods)) state.goods = [];
    const copiedGoods = recordsForAcademicYear("goods", sourceYearId)
      .filter((good) => good.academicYearId === sourceYearId)
      .map((good) => {
        const copy = structuredClone(good);
        copy.id = id();
        copy.academicYearId = targetYearId;
        ["ownershipId", "fundId", "typeId", "categoryId", "locationId", "unitId", "supplierId"].forEach((field) => {
          const collection = ({ ownershipId: "ownerships", fundId: "funds", typeId: "types", categoryId: "categories", locationId: "locations", unitId: "units", supplierId: "suppliers" })[field];
          copy[field] = idMaps[collection].get(copy[field]) || copy[field];
        });
        copy.quantity = Number(good.quantity) || 0;
        return copy;
      });
    state.goods.unshift(...copiedGoods);
    return { masters: yearMasterCollections.reduce((total, collection) => total + idMaps[collection].size, 0), goods: copiedGoods.length };
  }

  function ensureMobileNavigationDefaults() {
    const settings = state.settings || (state.settings = {});
    let changed = false;
    if (!Array.isArray(settings.mobileNav)) {
      settings.mobileNav = [...seed.settings.mobileNav];
      changed = true;
    } else {
      const mobileNav = settings.mobileNav.filter((key, index, values) => key !== "items" && values.indexOf(key) === index).slice(0, 5);
      if (JSON.stringify(mobileNav) !== JSON.stringify(settings.mobileNav)) {
        settings.mobileNav = mobileNav;
        changed = true;
      }
    }
    if (!settings.mobileNav.includes(settings.mobileNavHighlight)) {
      if (!settings.mobileNav.includes("checkGoods")) {
        const center = Math.floor(settings.mobileNav.length / 2);
        if (settings.mobileNav.length >= 5) settings.mobileNav[center] = "checkGoods";
        else settings.mobileNav.splice(center, 0, "checkGoods");
      }
      settings.mobileNavHighlight = "checkGoods";
      changed = true;
    }
    return changed;
  }

  function renderHeaderAcademicYear() {
    const select = $("#headerAcademicYear");
    if (!select) return;
    const years = state.academicYears || [];
    if (years.length && !years.some((year) => year.id === state.settings?.selectedAcademicYearId)) {
      state.settings.selectedAcademicYearId = (years.find((year) => year.status === "Aktif") || years[0]).id;
      saveState();
    }
    select.innerHTML = years.length
      ? years.map((year) => `<option value="${esc(year.id)}">${esc(year.name)}${year.status === "Arsip" ? " · Arsip" : ""}</option>`).join("")
      : `<option value="">Belum ada tahun pelajaran</option>`;
    select.value = state.settings?.selectedAcademicYearId || "";
    select.disabled = !years.length;
  }

  function ensurePrintDesignDefaults() {
    const settings = state.settings || (state.settings = {});
    const current = settings.printDesign || {};
    const defaults = seed.settings.printDesign;
    const next = {
      showLogo: typeof current.showLogo === "boolean" ? current.showLogo : defaults.showLogo,
      showNpsn: typeof current.showNpsn === "boolean" ? current.showNpsn : defaults.showNpsn,
      showContact: typeof current.showContact === "boolean" ? current.showContact : defaults.showContact,
      headerMode: current.headerMode === "custom" ? "custom" : "school",
      customHeaderText: typeof current.customHeaderText === "string" ? current.customHeaderText : defaults.customHeaderText,
      headerFontSize: Number.isFinite(Number(current.headerFontSize)) ? Math.max(10, Math.min(48, Math.round(Number(current.headerFontSize)))) : defaults.headerFontSize,
      logoSize: Number.isFinite(Number(current.logoSize)) ? Math.max(24, Math.min(160, Math.round(Number(current.logoSize)))) : defaults.logoSize,
      headerBold: typeof current.headerBold === "boolean" ? current.headerBold : defaults.headerBold,
      headerItalic: typeof current.headerItalic === "boolean" ? current.headerItalic : defaults.headerItalic
    };
    const changed = JSON.stringify(current) !== JSON.stringify(next);
    settings.printDesign = next;
    return changed;
  }

  function ensurePermissionDefaults() {
    const settings = state.settings || (state.settings = {});
    const stored = settings.permissions || {};
    const roleBased = permissionRoles.some((role) => stored[role] && typeof stored[role] === "object");
    const allowed = new Set(["hidden", "view", "edit", "delete"]);
    const permissions = Object.fromEntries(permissionRoles.map((role) => {
      const current = roleBased ? stored[role] || {} : stored;
      const menuPermissions = Object.fromEntries(permissionPages.map((key) => {
        const saved = current[key];
        const fallback = defaultMenuPermissions[key] || "hidden";
        return [key, allowed.has(saved) ? saved : fallback];
      }));
      return [role, menuPermissions];
    }));
    const changed = JSON.stringify(stored) !== JSON.stringify(permissions);
    settings.permissions = permissions;
    return changed;
  }

  function applyAppBranding() {
    ensureBrandingDefaults();
    const appName = state.settings.appName.trim() || "Sarprah";
    const appLogo = state.settings.appLogo;
    document.title = `${appName} — Manajemen Sarana & Prasarana`;
    $$("[data-app-name]").forEach((node) => { node.textContent = appName; });
    $$("[data-app-brand]").forEach((node) => {
      node.classList.toggle("has-app-logo", Boolean(appLogo));
      node.innerHTML = appLogo ? `<img class="app-brand-logo" src="${esc(appLogo)}" alt="${esc(appName)}">` : `<i data-lucide="boxes"></i>`;
    });
    const favicon = $("#appFavicon");
    if (appLogo) {
      favicon.href = appLogo;
      favicon.type = appLogo.match(/^data:(image\/(?:png|jpeg|webp));/)?.[1] || "image/png";
    } else {
      favicon.href = favicon.dataset.defaultHref || favicon.href;
      favicon.type = "image/svg+xml";
    }
    if (window.lucide) lucide.createIcons({ nodes: $$("[data-app-brand]") });
  }

  function showProfileEditor() {
    if (!activeUser) return;
    const avatar = activeUser.avatar ? `<img class="profile-avatar-preview" src="${esc(activeUser.avatar)}" alt="Avatar akun">` : `<span class="profile-avatar-preview profile-avatar-initials">${esc(initials(activeUser.name))}</span>`;
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Edit profil</h2><p>Ubah nama, avatar, atau kata sandi akun.</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form id="profileEditForm" class="modal-form"><div class="profile-edit-avatar">${avatar}<label class="btn-secondary"><i data-lucide="camera"></i>Ganti avatar<input id="profileAvatarFile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><small class="form-help">PNG, JPG, atau WEBP · maksimal 2 MB</small></div><div class="form-grid"><div class="form-field full"><label for="profileEditName">Nama akun</label><input id="profileEditName" name="name" value="${esc(activeUser.name)}" required maxlength="80"></div><div class="form-field full"><label>Email</label><input value="${esc(activeUser.email)}" disabled></div><div class="form-field"><label for="profileNewPassword">Kata sandi baru (opsional)</label><input id="profileNewPassword" name="password" type="password" minlength="8" autocomplete="new-password"></div><div class="form-field"><label for="profileConfirmPassword">Konfirmasi kata sandi baru</label><input id="profileConfirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password"></div></div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan profil</button></div></form></section></div>`);
    $("#profileAvatarFile").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_000_000) {
        showToast("Pilih gambar PNG, JPG, atau WEBP dengan ukuran maksimal 2 MB.", true);
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const preview = $(".profile-avatar-preview", $("#modalRoot"));
        if (preview.tagName === "IMG") preview.src = reader.result;
        else {
          const image = document.createElement("img");
          image.className = "profile-avatar-preview";
          image.alt = "Avatar akun";
          image.src = reader.result;
          preview.replaceWith(image);
        }
      };
      reader.onerror = () => showToast("Avatar tidak dapat dibaca.", true);
      reader.readAsDataURL(file);
    });
    $("#profileEditForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = $("#profileNewPassword").value;
      if (password && password !== $("#profileConfirmPassword").value) return showToast("Konfirmasi kata sandi tidak cocok.", true);
      if (password && password.length < 8) return showToast("Kata sandi minimal 8 karakter.", true);
      activeUser.name = $("#profileEditName").value.trim();
      const image = $(".profile-avatar-preview", $("#modalRoot"));
      if (image?.tagName === "IMG") activeUser.avatar = image.src;
      if (password) Object.assign(activeUser, await passwordCredentials(password));
      try {
        await persistState();
        syncProfile();
        renderPage();
        closeModal();
        showToast("Profil akun berhasil diperbarui.");
      } catch (error) { showToast(`Profil gagal disimpan: ${error.message}`, true); }
    });
  }

  async function persistState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (apiAvailable) {
      try {
        const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          handleStateSyncFailure(response.status, error.error || "");
          return false;
        }
      } catch (error) {
        handleStateSyncFailure(0, error.message);
        return false;
      }
    } else if (localStorage.getItem(PENDING_STATE_KEY)) {
      cachePendingServerState();
    }
    return true;
  }

  async function persistAccounts() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (!apiAvailable) {
      if (localStorage.getItem(PENDING_STATE_KEY)) cachePendingServerState();
      return true;
    }
    try {
      const response = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: state.accounts })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        handleStateSyncFailure(response.status, error.error || "");
        return false;
      }
    } catch (error) {
      handleStateSyncFailure(0, error.message);
      return false;
    }
    return true;
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (error) { showToast(`Penyimpanan lokal gagal: ${error.message}`, true); }
    if (!apiAvailable) {
      if (localStorage.getItem(PENDING_STATE_KEY)) cachePendingServerState();
      return;
    }
    fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          const error = new Error(result.error || `HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
      })
      .catch((error) => handleStateSyncFailure(error.status || 0, error.message));
  }

  async function loadState() {
    let needsBootstrap = false;
    try {
      const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      apiAvailable = true;
      if (result.state) {
        needsBootstrap = !Array.isArray(result.state.goods) || !Array.isArray(result.state.items) || !Array.isArray(result.state.accounts) || !Array.isArray(result.state.ownerships);
        Object.assign(state, result.state);
      }
      else {
        const cached = localStorage.getItem(STORE_KEY);
        if (cached) Object.assign(state, JSON.parse(cached));
        saveState();
      }
    } catch {
      apiAvailable = false;
      try {
        const cached = localStorage.getItem(STORE_KEY);
        if (cached) Object.assign(state, JSON.parse(cached));
      } catch (error) { showToast(`Data lokal tidak dapat dibaca: ${error.message}`, true); }
    }
    const ownershipsChanged = ensureOwnershipDefaults();
    const goodsOnlyTransactionsChanged = ensureGoodsOnlyTransactionDefaults();
    const rolesChanged = normalizeAccountRoles();
    const permissionsChanged = ensurePermissionDefaults();
    const brandingChanged = ensureBrandingDefaults();
    if (needsBootstrap && apiAvailable) {
      try { await persistState(); }
      catch (error) {
        apiAvailable = false;
        showToast(`Data awal gagal disimpan ke SQLite: ${error.message}`, true);
      }
    } else if (ownershipsChanged || goodsOnlyTransactionsChanged || rolesChanged || permissionsChanged || brandingChanged) saveState();
  }

  async function syncPendingLocalAccounts(pendingAccounts) {
    if (!apiAvailable || !pendingAccounts.length) return;
    let accountsAdded = false;
    let accountConflict = false;
    const accountsToClear = [];
    pendingAccounts.forEach((account) => {
      const email = String(account.email || "").toLowerCase();
      const existing = state.accounts.find((row) => row.id === account.id || String(row.email || "").toLowerCase() === email);
      if (!existing) {
        state.accounts.unshift(account);
        accountsAdded = true;
        accountsToClear.push(account);
      } else if (existing.id === account.id
        && String(existing.email || "").toLowerCase() === email
        && existing.passwordSalt === account.passwordSalt
        && existing.passwordHash === account.passwordHash) {
        accountsToClear.push(account);
      } else {
        accountConflict = true;
      }
    });
    if (accountsAdded) {
      try {
        const synced = await persistAccounts();
        if (synced && apiAvailable) accountsToClear.forEach(clearPendingLocalAccount);
        else showToast("Akun lokal belum berhasil disinkronkan ke server. Akun tetap tersimpan di perangkat ini dan akan dicoba kembali saat Administrator masuk.", true);
      } catch (error) {
        apiAvailable = false;
        showToast(`Akun lokal belum tersinkron ke server: ${error.message}`, true);
      }
    } else {
      accountsToClear.forEach(clearPendingLocalAccount);
    }
    if (accountConflict) showToast("Email akun lokal bertentangan dengan akun di server. Periksa dan sesuaikan akun melalui menu Pengaturan.", true);
  }

  function ownershipNameFromLegacy(value, legacyOther = "") {
    const name = String(value || "").trim();
    const normalized = name.toLocaleLowerCase("id-ID");
    if (["sekolah", "yayasan", "pribadi"].includes(normalized)) return "Milik";
    if (normalized === "lainnya") return String(legacyOther || "").trim() || "Bukan Milik";
    return name;
  }

  function ensureOwnershipDefaults() {
    let changed = false;
    if (!Array.isArray(state.ownerships) || !state.ownerships.length) {
      state.ownerships = structuredClone(seed.ownerships);
      changed = true;
    }
    (state.goods || []).forEach((good) => {
      if (good.ownershipId) {
        if ("owner" in good) { delete good.owner; changed = true; }
        if ("ownerOther" in good) { delete good.ownerOther; changed = true; }
        return;
      }
      const name = ownershipNameFromLegacy(good.owner, good.ownerOther) || "Milik";
      let ownership = state.ownerships.find((row) => String(row.name || "").toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"));
      if (!ownership) {
        ownership = { id: id(), name };
        state.ownerships.push(ownership);
      }
      good.ownershipId = ownership.id;
      delete good.owner;
      delete good.ownerOther;
      changed = true;
    });
    return changed;
  }

  function ensureGoodsOnlyTransactionDefaults() {
    let changed = false;
    (state.goods || []).forEach((good) => {
      if (good.locationId) return;
      const locationCounts = {};
      (state.items || []).filter((item) => item.goodId === good.id && item.locationId).forEach((item) => {
        locationCounts[item.locationId] = (locationCounts[item.locationId] || 0) + 1;
      });
      const inferredLocation = Object.keys(locationCounts).sort((a, b) => locationCounts[b] - locationCounts[a])[0];
      if (inferredLocation) {
        good.locationId = inferredLocation;
        changed = true;
      }
    });
    ["loans", "procurements", "disposals"].forEach((collection) => {
      (state[collection] || []).forEach((record) => {
        if ("itemIds" in record) {
          if (!record.goodId && Array.isArray(record.itemIds) && record.itemIds.length) {
            const item = getById("items", record.itemIds[0]);
            if (item) record.goodId = item.goodId;
          }
          delete record.itemIds;
          changed = true;
        }
      });
    });
    (state.depreciations || []).forEach((record) => {
      if (!record.goodId && record.itemId) {
        const item = getById("items", record.itemId);
        if (item) record.goodId = item.goodId;
        changed = true;
      }
      if ("itemId" in record) {
        delete record.itemId;
        changed = true;
      }
    });
    return changed;
  }

  function normalizeAccountRoles() {
    let changed = false;
    const accounts = state.accounts || [];
    const admins = accounts.filter((account) => account.role === "Administrator");
    const keepAdmin = admins[0] || accounts.find((account) => account.email === "admin@sarprah.id") || accounts[0];
    if (keepAdmin && keepAdmin.role !== "Administrator") { keepAdmin.role = "Administrator"; changed = true; }
    accounts.forEach((account) => {
      if (account !== keepAdmin && account.role === "Administrator") {
        account.role = account.name.toLowerCase().includes("kepala") ? "Kepala Sekolah" : account.name.toLowerCase().includes("wakasek") || account.name.toLowerCase().includes("operator") ? "Wakasek Sarpras" : "Guru";
        changed = true;
      } else if (account.role === "User") {
        account.role = account.name.toLowerCase().includes("kepala") ? "Kepala Sekolah" : account.name.toLowerCase().includes("wakasek") || account.name.toLowerCase().includes("operator") ? "Wakasek Sarpras" : "Guru";
        changed = true;
      }
    });
    return changed;
  }

  function renderNavigation() {
    $("#sideNav").innerHTML = navGroups.map((group) => {
      const links = (group.links || []).filter((link) => canViewPage(link.id));
      const groups = (group.groups || []).map((item) => ({ ...item, children: item.children.filter(([key]) => canViewPage(key)) })).filter((item) => item.children.length);
      if (!links.length && !groups.length) return "";
      const linkHtml = links.map((link) => `<button class="nav-link ${page === link.id ? "active" : ""}" data-page="${link.id}"><i data-lucide="${link.icon}"></i><span>${link.label}</span></button>`).join("");
      const groupHtml = groups.map((item) => {
        const open = item.children.some(([key]) => key === page);
        return `<button class="nav-group-toggle ${open ? "open" : ""}" data-group="${item.label}"><i data-lucide="${item.icon}"></i><span>${item.label}</span><i class="group-chevron" data-lucide="chevron-right"></i></button><div class="nav-children ${open ? "open" : ""}">${item.children.map(([key, label]) => `<div class="nav-child ${page === key ? "active" : ""}" data-page="${key}">${label}</div>`).join("")}</div>`;
      }).join("");
      return `${group.section ? `<div class="nav-section-label">${group.section}</div>` : ""}${linkHtml}${groupHtml}`;
    }).join("");
    $("#sideNav").querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
    $("#sideNav").querySelectorAll("[data-group]").forEach((el) => el.addEventListener("click", () => {
      const wasOpen = el.classList.contains("open");
      $$("#sideNav .nav-group-toggle").forEach((toggle) => {
        toggle.classList.remove("open");
        toggle.nextElementSibling.classList.remove("open");
      });
      if (wasOpen) return;
      const child = el.nextElementSibling;
      el.classList.add("open");
      child.classList.add("open");
    }));
    renderMobileNav();
    if (window.lucide) lucide.createIcons({ nodes: [$("#sideNav"), $("#mobileNav")] });
  }

  function renderMobileNav() {
    const links = (state.settings?.mobileNav || seed.settings.mobileNav).filter((key) => key !== "items" && canViewPage(key));
    const visibleLinks = links.slice(0, 5);
    const highlightKey = visibleLinks.includes(state.settings?.mobileNavHighlight)
      ? state.settings.mobileNavHighlight
      : visibleLinks[Math.floor(visibleLinks.length / 2)];
    const centeredLinks = [...visibleLinks];
    if (highlightKey) {
      centeredLinks.splice(centeredLinks.indexOf(highlightKey), 1);
      centeredLinks.splice(Math.floor(centeredLinks.length / 2), 0, highlightKey);
    }
    const shortLabels = {
      dashboard: "Beranda", school: "Sekolah", types: "Jenis", categories: "Kategori",
      units: "Satuan", locations: "Lokasi", suppliers: "Supplier", funds: "Dana", academicYears: "Tahun",
      goods: "Barang", checkGoods: "Cek", usages: "BHP", stocktakes: "Opname", barcode: "QR",
      loans: "Pinjam", procurements: "Beli", disposals: "Pemusnahan",
      depreciations: "Susut", reports: "Laporan", accounts: "Akun", backup: "Backup"
    };
    $("#mobileNav").innerHTML = centeredLinks.map((key) => {
      const highlighted = key === highlightKey;
      return `<button class="mobile-nav-item ${page === key ? "active" : ""} ${highlighted ? "mobile-nav-center" : ""}" aria-label="${meta[key]?.[0] || key}" title="${esc(meta[key]?.[0] || key)}" data-page="${key}"><i data-lucide="${meta[key]?.[2] || "circle"}"></i>${highlighted ? "" : `<span>${shortLabels[key] || meta[key]?.[0] || key}</span>`}</button>`;
    }).join("");
    $$("#mobileNav [data-page]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
  }

  function navigate(next) {
    if (!meta[next]) return;
    if (!canViewPage(next)) next = permissionPages.find(canViewPage) || "";
    if (page === "accounts" && next !== "accounts") {
      mobileNavDraft = null;
      mobileNavHighlightDraft = null;
    }
    if (page === "checkGoods" && next !== "checkGoods") stopGoodsCheckCamera();
    if (page === "goods" && next !== "goods") {
      goodsFilters = {};
      goodsFiltersOpen = false;
    }
    page = next;
    selectedFilter = "Semua";
    searchTerm = "";
    closeTopbarSearch();
    renderNavigation();
    renderPage();
    $("#sidebar").classList.remove("open");
    $("#sidebarOverlay").classList.remove("visible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pageHeading(action = "") {
    const info = meta[page];
    return `<div class="page-heading"><div><h1>${info[0]}</h1><p>${info[1]}</p></div><div class="heading-actions">${action}</div></div>`;
  }

  function canViewPage(key) {
    if (key === "backup" && activeUser?.role !== "Administrator") return false;
    return activeUser?.role === "Administrator" || pagePermission(activeUser?.role, key) !== "hidden";
  }
  function canEditPage(key = page) {
    return activeUser?.role === "Administrator" || ["edit", "delete"].includes(pagePermission(activeUser?.role, key));
  }
  function canDeletePage(key = page) {
    return activeUser?.role === "Administrator" || pagePermission(activeUser?.role, key) === "delete";
  }
  function pagePermission(role, key) {
    return role === "Administrator" ? "delete" : state.settings?.permissions?.[role]?.[key] || "hidden";
  }

  function renderPage() {
    const root = $("#pageContent");
    renderHeaderAcademicYear();
    root.classList.remove("page-enter");
    void root.offsetWidth;
    root.classList.add("page-enter");
    if (!page || !canViewPage(page)) {
      root.innerHTML = `<section class="settings-card"><h3>Akses tidak tersedia</h3><p>Akun Anda belum memiliki akses ke menu mana pun. Hubungi Administrator untuk mendapatkan hak akses.</p></section>`;
      return;
    }
    if (page === "dashboard") root.innerHTML = renderDashboard();
    else if (page === "school") root.innerHTML = renderSchool();
    else if (page === "printDesign") root.innerHTML = renderPrintDesign();
    else if (page === "checkGoods") root.innerHTML = renderGoodsCheck();
    else if (page === "barcode") root.innerHTML = renderBarcode();
    else if (page === "reports") root.innerHTML = renderReports();
    else if (page === "accounts") root.innerHTML = renderAccounts();
    else if (page === "backup") root.innerHTML = renderBackup();
    else root.innerHTML = renderCollection(page);
    if (window.lucide) lucide.createIcons({ nodes: [root] });
    if (page === "dashboard") drawChart();
    if (page === "barcode") drawBarcodes();
    bindPageEvents();
    if (page === "backup") loadTelegramSettings();
    if (page === "checkGoods") {
      setupGoodsCheck();
      startGoodsCheckCamera();
    }
  }

  function renderDashboard() {
    const thisMonth = (date) => String(date || "").startsWith(currentMonth);
    const loansMonth = state.loans.filter((row) => thisMonth(row.startDate)).length;
    const procMonth = state.procurements.filter((row) => thisMonth(row.date)).length;
    const disposalMonth = state.disposals.filter((row) => thisMonth(row.date)).length;
    const itemsTotal = state.items.length;
    const damaged = state.items.filter((row) => row.condition === "Rusak").length;
    const outstanding = state.loans.filter((row) => ["Diterima", "Pengajuan"].includes(row.status)).length;
    const goods = recordsForAcademicYear("goods");
    const goodsById = new Map(goods.map((good) => [good.id, good]));
    const goodCount = goods.length;
    const sarana = recordsForAcademicYear("types").filter((row) => row.type === "sarana").map((row) => row.id);
    const prasarana = recordsForAcademicYear("types").filter((row) => row.type === "prasarana").map((row) => row.id);
    const yearItems = state.items.filter((row) => goodsById.has(row.goodId));
    const saranaGoods = yearItems.filter((row) => sarana.includes(goodsById.get(row.goodId)?.typeId)).length;
    const prasaranaGoods = yearItems.filter((row) => prasarana.includes(goodsById.get(row.goodId)?.typeId)).length;
    const saranaAvailable = yearItems.filter((row) => row.condition === "Baik" && sarana.includes(goodsById.get(row.goodId)?.typeId)).length;
    const prasaranaAvailable = yearItems.filter((row) => row.condition === "Baik" && prasarana.includes(goodsById.get(row.goodId)?.typeId)).length;
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const lateRows = state.loans.filter((row) => ["Diterima", "Pengajuan"].includes(row.status) && row.dueDate < dateOffset(0)).slice(0, 4);
    const procurements = state.procurements.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const stat = (label, value, icon, tone, foot) => `<div class="summary-card"><div class="summary-top">${label}<span class="summary-icon ${tone}"><i data-lucide="${icon}"></i></span></div><div class="summary-value">${value}</div><div class="summary-foot"><span class="trend-up">${foot}</span> bulan ini</div><div class="summary-spark"><svg viewBox="0 0 80 28" fill="none"><path d="M1 22 C12 20 12 16 22 18S34 6 43 12s12 0 20 3 10-8 16-11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div></div>`;
    return `${pageHeading()}
      <div class="stats-row">${stat("Total Peminjaman Bulan Ini", loansMonth, "arrow-left-right", "orange", "+12%")}${stat("Total Pengadaan Bulan Ini", procMonth, "shopping-bag", "blue", "+8%")}${stat("Total Pemusnahan Bulan Ini", disposalMonth, "archive-x", "green", `${disposalMonth} item`)}</div>
      <div class="indicator-grid">
        ${indicator("Total Barang", goodCount, "package", "coral", "Master barang terdaftar")}
        ${indicator("Total Item", itemsTotal, "boxes", "violet", "Unit inventaris terdata")}
        ${indicator("Item Rusak", damaged, "triangle-alert", "blue", `${itemsTotal ? Math.round(damaged / itemsTotal * 100) : 0}% dari item terdata`)}
        ${indicator("Item Belum Kembali", outstanding, "clock-3", "amber", "Peminjaman aktif")}
      </div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h3>Statistik Jumlah Sarana dan Prasarana</h3><p>Tren inventaris barang per bulan</p></div><div><select class="chart-select" id="chartPeriod"><option value="12" ${chartPeriod === "12" ? "selected" : ""}>12 bulan terakhir</option><option value="6" ${chartPeriod === "6" ? "selected" : ""}>6 bulan terakhir</option></select></div></div><div class="chart-legend"><span><i class="legend-dot"></i>Sarana</span><span><i class="legend-dot blue"></i>Prasarana</span></div><div class="chart-wrap"><canvas id="inventoryChart"></canvas></div></section>
      <section class="panel"><div class="panel-heading"><div><h3>Ketersediaan Item</h3><p>Kondisi item baik dan siap digunakan</p></div><i data-lucide="chart-no-axes-combined" class="muted"></i></div>
        <div class="availability-row"><div class="availability-label"><b>Prasarana tersedia</b><span>${prasaranaAvailable} / ${prasaranaGoods} item · ${pct(prasaranaAvailable, prasaranaGoods)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct(prasaranaAvailable, prasaranaGoods)}%"></div></div></div>
        <div class="availability-row"><div class="availability-label"><b>Sarana tersedia</b><span>${saranaAvailable} / ${saranaGoods} item · ${pct(saranaAvailable, saranaGoods)}%</span></div><div class="progress-track"><div class="progress-fill blue" style="width:${pct(saranaAvailable, saranaGoods)}%"></div></div></div>
        <div style="margin-top:20px;padding:12px;border-radius:9px;background:#fff8f1;display:flex;gap:10px;align-items:flex-start"><i data-lucide="lightbulb" style="color:#e98939;width:17px;height:17px"></i><div><b style="font-size:10px">Catatan inventaris</b><p style="font-size:9px;color:#8d95a2;margin:4px 0 0;line-height:1.55">Periksa berkala item rusak agar pemeliharaan dan pengadaan dapat direncanakan tepat waktu.</p></div></div>
      </section></div>
      <div class="dashboard-tables">
        <section class="panel"><div class="panel-heading"><div><h3>Daftar Barang Belum Kembali</h3><p>Peminjaman yang melewati tanggal pengembalian</p></div><button class="btn-quiet" data-nav="loans">Lihat semua <i data-lucide="arrow-right"></i></button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>PEMINJAM</th><th>BARANG</th><th>TERLAMBAT</th><th>STATUS</th></tr></thead><tbody>${lateRows.length ? lateRows.map((row) => `<tr><td><span class="table-title">${esc(row.borrower)}</span></td><td>${esc(titleOfGood(row.goodId))}</td><td><span class="badge danger">${Math.max(1, Math.floor((today - new Date(`${row.dueDate}T00:00:00`)) / 86400000))} hari</span></td><td>${statusBadge(row.status)}</td></tr>`).join("") : `<tr><td colspan="4" class="empty-state">Tidak ada barang yang terlambat dikembalikan.</td></tr>`}</tbody></table></div></section>
        <section class="panel"><div class="panel-heading"><div><h3>Pengadaan</h3><p>Ringkasan usulan terbaru</p></div><select class="chart-select" id="dashboardProcFilter"><option value="Semua">Semua</option><option value="Mendesak">Mendesak</option><option value="Normal">Normal</option></select></div><div class="table-wrap"><table class="data-table"><thead><tr><th>NAMA PENGADAAN</th><th>PRIORITAS</th><th>NOMINAL</th></tr></thead><tbody id="dashboardProcRows">${procurementDashboardRows(procurements)}</tbody></table></div></section>
      </div>`;
  }

  function renderGoodsCheck() {
    return `${pageHeading()}
      <div class="goods-check-layout">
        <section class="goods-check-panel">
          <div class="panel-heading"><div><h3>Pindai atau cari barang</h3><p>Kamera akan dibuka otomatis. Anda juga dapat memasukkan kode atau nama barang.</p></div></div>
          <video id="goodsCheckVideo" class="goods-check-video" playsinline muted></video>
          <div id="goodsCheckStatus" class="goods-check-status" aria-live="polite">Menyiapkan kamera…</div>
          <button id="goodsCheckRestart" class="btn-secondary goods-check-restart" type="button"><i data-lucide="camera"></i>Buka kamera</button>
          <form id="goodsCheckSearchForm" class="goods-check-search">
            <input id="goodsCheckInput" type="search" autocomplete="off" placeholder="Kode barcode atau nama barang">
            <button class="btn-primary" type="submit"><i data-lucide="search"></i>Cari</button>
          </form>
          <div id="goodsCheckMatches" class="goods-check-matches" aria-live="polite"></div>
        </section>
        <section id="goodsCheckResult" class="goods-check-result" aria-live="polite">
          <div class="empty-state"><i data-lucide="scan-search"></i>Hasil detail barang akan tampil di sini.</div>
        </section>
      </div>`;
  }

  function goodsCheckTable(title, headers, rows, emptyText) {
    const body = rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")
      : `<tr><td class="empty-state" colspan="${headers.length}">${esc(emptyText)}</td></tr>`;
    return `<section class="goods-check-history"><h3>${esc(title)}</h3><div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((header) => `<th>${esc(header.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  function showGoodsCheckResult(goodId, itemId = "") {
    const good = getById("goods", goodId);
    if (!good || (good.academicYearId && good.academicYearId !== currentAcademicYearId())) {
      $("#goodsCheckStatus").textContent = "Barang tidak ditemukan.";
      $("#goodsCheckResult").innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i>Barang tidak ditemukan. Periksa kembali kode atau nama yang dimasukkan.</div>`;
      return;
    }
    const items = state.items.filter((item) => item.goodId === good.id).sort((a, b) => String(b.received || "").localeCompare(String(a.received || "")));
    const procurements = state.procurements.filter((record) => record.goodId === good.id && record.status === "Diterima").sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const stocktakes = state.stocktakes.filter((record) => record.goodId === good.id).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const availableItems = items.filter((item) => item.condition === "Baik").length;
    const focusedItem = itemId ? getById("items", itemId) : null;
    const itemRows = items.map((item) => [
      item.code,
      item.condition,
      relatedName("locations", item.locationId),
      niceDate(item.received),
      item.id === focusedItem?.id ? "Dipindai" : ""
    ]);
    const purchaseRows = procurements.map((record) => [
      niceDate(record.date),
      String(record.quantity || 0),
      relatedName("funds", record.fundId),
      rupiah(Number(record.quantity || 0) * Number(record.unitPrice || 0)),
      record.proposer || "—"
    ]);
    const stocktakeRows = stocktakes.map((record) => [
      niceDate(record.date),
      String(record.oldStock ?? "—"),
      String(record.newStock ?? "—"),
      String(record.total ?? record.newStock ?? "—"),
      record.note || "—"
    ]);
    $("#goodsCheckStatus").textContent = `Barang ditemukan: ${good.name}.`;
    $("#goodsCheckMatches").innerHTML = "";
    $("#goodsCheckResult").innerHTML = `<div class="goods-check-detail">
      <div class="goods-check-result-head"><div><h2>${esc(good.name)}</h2><p>${focusedItem ? `Kode item: ${esc(focusedItem.code)}` : "Informasi barang dan stok saat ini"}</p></div><div class="goods-check-stock"><b>${esc(good.quantity ?? 0)}</b><span>Sisa stok ${esc(relatedName("units", good.unitId))}</span></div></div>
      <div class="goods-check-facts">
        <div><small>Jenis</small><b>${esc(relatedName("types", good.typeId))}</b></div>
        <div><small>Kategori</small><b>${esc(relatedName("categories", good.categoryId))}</b></div>
        <div><small>Kepemilikan</small><b>${esc(relatedName("ownerships", good.ownershipId))}</b></div>
        <div><small>Sumber dana</small><b>${esc(relatedName("funds", good.fundId))}</b></div>
        <div><small>Supplier</small><b>${esc(relatedName("suppliers", good.supplierId))}</b></div>
        <div><small>Harga satuan</small><b>${esc(rupiah(good.price))}</b></div>
        <div><small>Status BHP</small><b>${isBhp(good) ? "Barang Habis Pakai (BHP)" : "Barang Modal"}</b></div>
        <div><small>Item inventaris</small><b>${items.length} unit · ${availableItems} baik</b></div>
      </div>
      ${goodsCheckTable("Riwayat stok masuk / pengadaan", ["Tanggal masuk", "Jumlah", "Sumber dana", "Nilai pengadaan", "Pengusul"], purchaseRows, "Belum ada pengadaan diterima yang tercatat.")}
      ${goodsCheckTable("Rincian item inventaris", ["Kode item", "Kondisi", "Lokasi", "Tanggal diterima", "Keterangan"], itemRows, "Belum ada item inventaris per unit untuk barang ini.")}
      ${goodsCheckTable("Riwayat stock opname", ["Tanggal", "Stok lama", "Stok baru", "Total stok", "Keterangan"], stocktakeRows, "Belum ada riwayat stock opname.")}</div>`;
    if (window.lucide) lucide.createIcons({ nodes: [$("#goodsCheckResult")] });
  }

  function searchGoodsCheck(query) {
    const normalized = String(query || "").trim().toLocaleLowerCase("id-ID");
    const matches = [];
    if (!normalized) {
      $("#goodsCheckStatus").textContent = "Masukkan kode barcode atau nama barang terlebih dahulu.";
      return;
    }
    const currentGoodIds = new Set(recordsForAcademicYear("goods").map((good) => good.id));
    const exactItem = state.items.find((item) => currentGoodIds.has(item.goodId) && String(item.code || "").toLocaleLowerCase("id-ID") === normalized);
    if (exactItem) return showGoodsCheckResult(exactItem.goodId, exactItem.id);
    state.items.filter((item) => currentGoodIds.has(item.goodId) && String(item.code || "").toLocaleLowerCase("id-ID").includes(normalized))
      .forEach((item) => matches.push({ good: getById("goods", item.goodId), item }));
    recordsForAcademicYear("goods").filter((good) => String(good.name || "").toLocaleLowerCase("id-ID").includes(normalized))
      .forEach((good) => { if (!matches.some((match) => match.good?.id === good.id)) matches.push({ good, item: null }); });
    const validMatches = matches.filter((match) => match.good);
    if (!validMatches.length) {
      $("#goodsCheckStatus").textContent = "Barang tidak ditemukan. Coba kode item atau nama barang lain.";
      $("#goodsCheckMatches").innerHTML = "";
      $("#goodsCheckResult").innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i>Tidak ada barang yang cocok dengan pencarian.</div>`;
      if (window.lucide) lucide.createIcons({ nodes: [$("#goodsCheckResult")] });
      return;
    }
    if (validMatches.length === 1) return showGoodsCheckResult(validMatches[0].good.id, validMatches[0].item?.id || "");
    $("#goodsCheckStatus").textContent = `Ditemukan ${validMatches.length} hasil. Pilih barang yang sesuai.`;
    $("#goodsCheckMatches").innerHTML = validMatches.map(({ good, item }) => `<button class="goods-check-match" type="button" data-check-good="${esc(good.id)}" data-check-item="${esc(item?.id || "")}"><i data-lucide="package"></i><span><b>${esc(good.name)}</b><small>${item ? `Kode item ${esc(item.code)}` : `${esc(good.quantity ?? 0)} ${esc(relatedName("units", good.unitId))} tersisa`}</small></span><i data-lucide="chevron-right"></i></button>`).join("");
    if (window.lucide) lucide.createIcons({ nodes: [$("#goodsCheckMatches")] });
  }

  function setupGoodsCheck() {
    $("#goodsCheckSearchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      searchGoodsCheck($("#goodsCheckInput").value);
    });
    $("#goodsCheckRestart").addEventListener("click", startGoodsCheckCamera);
    $("#goodsCheckMatches").addEventListener("click", (event) => {
      const match = event.target.closest("[data-check-good]");
      if (match) showGoodsCheckResult(match.dataset.checkGood, match.dataset.checkItem);
    });
  }

  function stopGoodsCheckCamera() {
    if (goodsCheckTimer) window.clearTimeout(goodsCheckTimer);
    goodsCheckTimer = null;
    const stream = goodsCheckStream;
    goodsCheckStream = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = $("#goodsCheckVideo");
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  async function startGoodsCheckCamera() {
    if (goodsCheckStream) return;
    const status = $("#goodsCheckStatus");
    const video = $("#goodsCheckVideo");
    if (!status || !video) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Kamera tidak tersedia di browser ini. Gunakan pencarian manual.";
      return;
    }
    status.textContent = "Meminta izin untuk membuka kamera…";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      if (page !== "checkGoods" || !video.isConnected) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      goodsCheckStream = stream;
      video.srcObject = stream;
      await video.play();
      const Detector = window.BarcodeDetector;
      if (typeof Detector !== "function") {
        status.textContent = "Kamera aktif, tetapi pemindaian otomatis tidak didukung browser ini. Masukkan kode secara manual.";
        return;
      }
      const available = typeof Detector.getSupportedFormats === "function" ? await Detector.getSupportedFormats() : ["qr_code"];
      const formats = available.filter((format) => ["qr_code", "code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "itf", "upc_a", "upc_e"].includes(format));
      if (!formats.length) {
        status.textContent = "Format barcode tidak didukung. Masukkan kode barang secara manual.";
        return;
      }
      const detector = new Detector({ formats });
      status.textContent = "Kamera aktif. Arahkan barcode barang ke kamera.";
      const scanFrame = async () => {
        if (goodsCheckStream !== stream) return;
        try {
          if (video.readyState >= 2) {
            const results = await detector.detect(video);
            if (goodsCheckStream !== stream) return;
            if (results.length) {
              const code = results[0].rawValue;
              $("#goodsCheckInput").value = code;
              searchGoodsCheck(code);
              status.textContent = `Barcode terbaca: ${code}`;
              stopGoodsCheckCamera();
              return;
            }
          }
        } catch (error) {
          status.textContent = `Pemindaian gagal (${error.message}). Anda dapat memasukkan kode secara manual.`;
          stopGoodsCheckCamera();
          return;
        }
        goodsCheckTimer = window.setTimeout(scanFrame, 250);
      };
      scanFrame();
    } catch (error) {
      if (goodsCheckStream) stopGoodsCheckCamera();
      status.textContent = `Kamera tidak dapat dibuka (${error.message}). Gunakan pencarian manual atau izinkan akses kamera.`;
    }
  }

  function indicator(label, value, icon, tone, foot) {
    return `<div class="indicator-card" data-nav="goods"><span class="indicator-icon ${tone}"><i data-lucide="${icon}"></i></span><div><small>${label}</small><b>${value}</b><small style="margin:3px 0 0">${foot}</small></div></div>`;
  }
  function procurementDashboardRows(rows) {
    return rows.length ? rows.map((row) => `<tr data-priority="${esc(row.priority)}"><td><span class="table-title">${esc(row.title)}</span><div class="table-sub">${esc(niceDate(row.date))}</div></td><td>${row.priority === "Mendesak" ? `<span class="badge danger">Mendesak</span>` : `<span class="badge neutral">Normal</span>`}</td><td class="goods-price-cell">${currencyCell(row.quantity * row.unitPrice)}</td></tr>`).join("") : `<tr><td colspan="3" class="empty-state">Belum ada data pengadaan.</td></tr>`;
  }

  function renderSchool() {
    const school = state.school || seed.school;
    return `${pageHeading(canEditPage("school") ? `<button class="btn-primary" type="submit" form="schoolForm"><i data-lucide="save"></i>Simpan perubahan</button>` : "")}
      <form id="schoolForm" class="settings-card"><h3>Profil Sekolah</h3><p>Informasi ini akan digunakan pada kop surat dan laporan.</p><div class="form-grid">
        ${formInput("name", "Nama Sekolah", school.name, "text", true)}
        ${formInput("npsn", "NPSN", school.npsn, "text")}
        ${formInput("phone", "Telepon", school.phone, "tel")}
        ${formInput("email", "Email", school.email, "email")}
        <div class="form-field"><label>Website</label><input name="website" type="text" inputmode="url" autocomplete="url" placeholder="contoh: sekolah.sch.id" value="${esc(school.website)}"></div>
        <div class="form-field full"><label>Alamat</label><textarea name="address" ${canEditPage("school") ? "" : "disabled"}>${esc(school.address)}</textarea></div>
        <div class="form-field full"><label>Unggah Logo Sekolah</label><input name="logoFile" type="file" accept="image/*">${school.logo ? `<img src="${esc(school.logo)}" alt="Logo sekolah" style="max-width:90px;max-height:70px;object-fit:contain;margin-top:8px">` : ""}<small class="form-help">Format gambar, maksimal 2 MB.</small></div>
        <div class="form-field full"><label>Footer Laporan</label><input name="footer" value="${esc(school.footer)}"></div>
        </div></form>`;
  }

  function printSchoolHeaderMarkup(school, design) {
    const fontSize = Number.isFinite(Number(design.headerFontSize)) ? Math.max(10, Math.min(48, Math.round(Number(design.headerFontSize)))) : 16;
    const logoSize = Number.isFinite(Number(design.logoSize)) ? Math.max(24, Math.min(160, Math.round(Number(design.logoSize)))) : 56;
    const titleStyle = `font-size:${fontSize}px;font-weight:${design.headerBold ? 800 : 500};font-style:${design.headerItalic ? "italic" : "normal"}`;
    const contact = [
      design.showNpsn && school.npsn && `NPSN ${school.npsn}`,
      design.showContact && school.phone,
      design.showContact && school.email,
      design.showContact && school.website
    ].filter(Boolean).join(" · ");
    const logo = design.showLogo && school.letterheadLogo
      ? `<img class="print-school-logo" style="width:${logoSize}px;height:${logoSize}px" src="${esc(school.letterheadLogo)}" alt="">`
      : design.headerMode === "custom" ? "" : `<span class="print-school-initial" style="width:${logoSize}px;height:${logoSize}px;font-size:${Math.round(logoSize * 0.44)}px">${esc((school.name || "S").slice(0, 1))}</span>`;
    if (design.headerMode === "custom") {
      const customText = esc(design.customHeaderText || "").replace(/\r?\n/g, "<br>");
      return `${logo}<div class="print-school-copy"><h1 class="print-custom-header-text" style="${titleStyle}">${customText}</h1></div>`;
    }
    return `${logo}<div class="print-school-copy"><h1 style="${titleStyle}">${esc(school.name)}</h1><p>${esc(school.address)}</p>${contact ? `<p>${esc(contact)}</p>` : ""}</div>`;
  }

  function reportSignatures(school) {
    return `<div class="report-signatures"><div><span>Mengetahui,</span><p>Kepala Sekolah</p><b>${esc(school.principalName || "( _________________________ )")}</b>${school.principalNip ? `<small>NIP. ${esc(school.principalNip)}</small>` : ""}</div><div><span>${esc(school.city || "................")}, ${niceDate(dateOffset(0))}</span><p>Wakasek Sarpras</p><b>${esc(school.sarprasVicePrincipalName || "( _________________________ )")}</b>${school.sarprasVicePrincipalNip ? `<small>NIP. ${esc(school.sarprasVicePrincipalNip)}</small>` : ""}</div></div>`;
  }

  function renderPrintDesign() {
    const school = state.school || seed.school;
    const design = state.settings.printDesign || seed.settings.printDesign;
    return `${pageHeading(canEditPage("printDesign") ? `<button class="btn-primary" type="submit" form="printDesignForm"><i data-lucide="save"></i>Simpan desain</button>` : "")}
      <form id="printDesignForm" class="settings-card"><h3>Desain kop dan informasi penandatangan</h3><p>Pilih identitas sekolah atau isi sendiri bagian atas kop surat.</p><div class="form-grid">
        <div class="form-field full"><label for="printHeaderMode">Sumber bagian atas kop</label><select id="printHeaderMode" name="headerMode"><option value="school" ${design.headerMode !== "custom" ? "selected" : ""}>Gunakan identitas sekolah</option><option value="custom" ${design.headerMode === "custom" ? "selected" : ""}>Ketik sendiri</option></select></div>
        <div id="printCustomHeaderOptions" class="form-field full ${design.headerMode === "custom" ? "" : "hidden"}"><label for="customHeaderText">Teks bagian atas kop</label><textarea id="customHeaderText" name="customHeaderText" rows="4" placeholder="Ketik teks kop surat">${esc(design.customHeaderText || "")}</textarea><small class="form-help">Teks ini menggantikan nama, alamat, dan kontak dari identitas sekolah. Gunakan baris baru untuk beberapa baris.</small></div>
        <div id="printSchoolHeaderOptions" class="print-school-header-options ${design.headerMode === "custom" ? "hidden" : ""}">
          <label class="form-check"><input name="showNpsn" type="checkbox" ${design.showNpsn ? "checked" : ""}><span>Tampilkan NPSN</span></label>
          <label class="form-check"><input name="showContact" type="checkbox" ${design.showContact ? "checked" : ""}><span>Tampilkan telepon, email, dan website</span></label>
        </div>
        <div class="form-field"><label for="headerFontSize">Ukuran font bagian atas (px)</label><input id="headerFontSize" name="headerFontSize" type="number" min="10" max="48" step="1" required value="${esc(design.headerFontSize)}"></div>
        <div class="form-field"><label for="logoSize">Ukuran logo kop (px)</label><input id="logoSize" name="logoSize" type="number" min="24" max="160" step="1" required value="${esc(design.logoSize)}"><small class="form-help">Ukuran lebar dan tinggi logo pada kop cetak.</small></div>
        <div class="form-field"><label class="form-check"><input name="headerBold" type="checkbox" ${design.headerBold ? "checked" : ""}><span>Tebal</span></label></div>
        <div class="form-field"><label class="form-check"><input name="headerItalic" type="checkbox" ${design.headerItalic ? "checked" : ""}><span>Miring</span></label></div>
        <div class="form-field full"><label>Tempat tanda tangan</label><input name="city" type="text" value="${esc(school.city)}"></div>
        <div class="print-signatories-grid">
          <div class="print-signatory-column">${formInput("principalName", "Nama Kepala Sekolah", school.principalName, "text")}${formInput("principalNip", "NIP Kepala Sekolah", school.principalNip, "text")}</div>
          <div class="print-signatory-column">${formInput("sarprasVicePrincipalName", "Nama Wakasek Sarpras", school.sarprasVicePrincipalName, "text")}${formInput("sarprasVicePrincipalNip", "NIP Wakasek Sarpras", school.sarprasVicePrincipalNip, "text")}</div>
        </div>
        <div class="form-field full print-letterhead-upload"><label>Logo khusus kop surat</label><div class="print-letterhead-upload-row"><div id="letterheadLogoPreview" class="print-letterhead-logo-preview">${school.letterheadLogo ? `<img src="${esc(school.letterheadLogo)}" alt="Logo khusus kop surat">` : `<i data-lucide="image-plus"></i>`}</div><div class="print-letterhead-upload-fields"><input name="letterheadLogoFile" type="file" accept="image/*"><label class="form-check"><input name="removeLetterheadLogo" type="checkbox"><span>Hapus logo khusus kop surat</span></label><small class="form-help">Logo ini terpisah dari logo sekolah utama. Format gambar, maksimal 2 MB.</small></div></div></div>
        <div class="form-field full"><label class="form-check"><input name="showLogo" type="checkbox" ${design.showLogo ? "checked" : ""}><span>Tampilkan logo khusus pada kop</span></label></div>
      </div></form>
      <section class="settings-card"><h3>Pratinjau kop dan tanda tangan</h3><div class="print-design-preview"><div class="print-school-header print-design-header-preview">${printSchoolHeaderMarkup(school, design)}</div>${reportSignatures(school)}</div></section>`;
  }

  function renderAppBranding() {
    return `<form id="appBrandingForm" class="settings-card"><h3>Identitas Aplikasi</h3><p>Atur nama dan logo yang tampil di aplikasi, judul tab browser, dan favicon.</p><div class="form-grid">
      ${formInput("appName", "Nama Aplikasi", state.settings.appName, "text", true)}
      <div class="form-field full"><label for="appLogoFile">Logo Aplikasi</label><div class="app-branding-upload"><div id="appLogoPreview" class="app-logo-preview">${state.settings.appLogo ? `<img src="${esc(state.settings.appLogo)}" alt="Logo aplikasi">` : `<i data-lucide="boxes"></i>`}</div><div><input id="appLogoFile" name="appLogoFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="form-help">PNG, JPG, atau WEBP · maksimal 2 MB. Logo juga digunakan sebagai favicon.</small><label class="app-logo-remove"><input name="removeAppLogo" type="checkbox"> Gunakan ikon bawaan</label></div></div></div>
      <div class="form-field full"><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan identitas aplikasi</button></div>
      </div></form>`;
  }

  function renderCollection(key) {
    const config = collectionConfig[key];
    const displayCols = key === "goods"
      ? [["typeId", "Jenis"], ["categoryId", "Kategori"], ["locationId", "Ruang / Lokasi"], ["quantity", "Jumlah"], ["unitId", "Satuan"], ["price", "Harga Satuan"], ["totalPrice", "Harga Total"], ["consumable", "Status BHP"]]
      : config.cols;
    const rows = recordsForCurrentAcademicYear(key);
    const hideExportControls = ["types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears"].includes(key);
    const bulkDeletable = bulkDeletePages.has(key) && canDeletePage(key);
    const actions = canEditPage(key) ? `<button class="btn-primary" data-action="add"><i data-lucide="plus"></i>Tambah ${config.singular}</button>` : "";
    const importControls = key === "goods"
      ? `<button class="btn-quiet" data-action="goods-template"><i data-lucide="download"></i>Template Excel</button>${canEditPage(key) ? `<label class="btn-quiet" for="goodsImport"><i data-lucide="upload"></i>Impor Barang</label><input type="file" id="goodsImport" accept=".xlsx,.xls,.csv" class="hidden">` : ""}`
      : "";
    const bulkControls = bulkDeletable ? `<button class="btn-quiet" data-action="select-visible"><i data-lucide="check-check"></i>Pilih semua</button><button class="btn-danger" id="deleteSelectedRecords" data-action="delete-selected" disabled><i data-lucide="trash-2"></i>Hapus terpilih <span id="selectedRecordCount"></span></button>` : "";
    const exportControls = hideExportControls ? "" : `<button class="btn-quiet" data-action="print"><i data-lucide="printer"></i>Print</button><button class="btn-quiet" data-action="export"><i data-lucide="file-spreadsheet"></i>Excel</button>`;
    const toolbarRight = importControls || bulkControls || exportControls ? `<div class="table-toolbar-right${key === "goods" ? " goods-toolbar-actions" : ""}">${importControls}${bulkControls}${exportControls}</div>` : "";
    const activeGoodsFilterCount = Object.values(goodsFilters).filter(Boolean).length;
    const goodsFilterControls = key === "goods"
      ? `<details id="goodsFilterDetails" class="goods-filter-dropdown" ${goodsFiltersOpen ? "open" : ""}><summary class="btn-quiet goods-filter-trigger" aria-label="Tampilkan filter barang"><i data-lucide="filter"></i>Filter${activeGoodsFilterCount ? `<span class="goods-filter-count">${activeGoodsFilterCount}</span>` : ""}</summary><div class="goods-filter-panel"><div class="goods-filter-options">${goodsFilterFields.map(([field, label, source]) => `<label class="goods-filter-field"><span>${esc(label)}</span><select class="table-filter goods-filter" data-goods-filter="${field}" aria-label="Filter ${esc(label)}" title="Filter ${esc(label)}"><option value="">Semua ${esc(label.toLowerCase())}</option>${(state[source] || []).map((option) => `<option value="${esc(option.id)}" ${goodsFilters[field] === option.id ? "selected" : ""}>${esc(option.name)}</option>`).join("")}</select></label>`).join("")}<label class="goods-filter-field"><span>Status BHP</span><select class="table-filter goods-filter" data-goods-filter="consumable" aria-label="Filter Status BHP" title="Filter Status BHP"><option value="">Semua status BHP</option><option value="true" ${goodsFilters.consumable === "true" ? "selected" : ""}>Barang Habis Pakai (BHP)</option><option value="false" ${goodsFilters.consumable === "false" ? "selected" : ""}>Barang Modal</option></select></label></div><div class="goods-filter-footer"><span>${activeGoodsFilterCount ? `${activeGoodsFilterCount} filter aktif` : "Pilih satu atau beberapa filter"}</span><button id="clearGoodsFilters" class="btn-quiet" type="button" ${activeGoodsFilterCount ? "" : "disabled"}>Reset filter</button></div></div></details>`
      : "";
    const toolbar = `<div class="table-toolbar${key === "goods" ? " goods-toolbar" : ""}"><div class="table-toolbar-left${key === "goods" ? " goods-filter-controls" : ""}"><label class="search-field"><i data-lucide="search"></i><input id="tableSearch" placeholder="Cari ${config.title.toLowerCase()}..." value="${esc(searchTerm)}"></label>${statusPages.has(key) ? `<select class="table-filter" id="statusFilter">${statusOptions[key].map((opt) => `<option ${selectedFilter === opt ? "selected" : ""}>${opt}</option>`).join("")}</select>` : ""}${goodsFilterControls}</div>${toolbarRight}</div>`;
    const filtered = rows.filter((row) => {
      if (!matchesSearch(key, row, searchTerm)) return false;
      if (statusPages.has(key) && selectedFilter !== "Semua" && row.status !== selectedFilter) return false;
      if (key !== "goods") return true;
      return goodsFilterFields.every(([field]) => !goodsFilters[field] || String(row[field] ?? "") === goodsFilters[field])
        && (!goodsFilters.consumable || (goodsFilters.consumable === "true" ? isBhp(row) : !isBhp(row)));
    });
    const selectHeader = bulkDeletable ? `<th class="bulk-select-column"><input id="selectAllRecords" type="checkbox" aria-label="Pilih semua data yang tampil"></th>` : "";
    const headers = displayCols.map(([, title]) => `<th>${esc(title.toUpperCase())}</th>`).join("");
    const body = filtered.length ? filtered.map((row) => {
      const selection = bulkDeletable ? `<td class="bulk-select-column"><input type="checkbox" class="record-select" value="${esc(row.id)}" aria-label="Pilih ${esc(row.name || row.title || row.borrower || row.applicant || row.date || config.singular)}"></td>` : "";
      return `<tr>${selection}${displayCols.map(([field]) => {
        const currency = ["price", "totalPrice", "unitPrice", "initialValue", "amount", "finalValue"].includes(field) || (field === "total" && key === "procurements");
        return `<td${currency ? ' class="goods-price-cell"' : ""}>${formatCell(key, field, row)}</td>`;
      }).join("")}<td><div class="action-buttons">${canEditPage(key) && (row.status === "Pengajuan" || (["loans", "disposals"].includes(key) && row.status === "Diterima")) ? `<button class="mini-action" title="Ubah status" data-action="status" data-id="${row.id}"><i data-lucide="check"></i></button>` : ""}${canEditPage(key) ? `<button class="mini-action" title="Edit" data-action="edit" data-id="${row.id}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage(key) ? `<button class="mini-action" title="Hapus" data-action="delete" data-id="${row.id}"><i data-lucide="trash-2"></i></button>` : ""}${key === "goods" && canEditPage(key) ? `<button class="mini-action" title="Atur kondisi barang" data-action="goods-condition" data-id="${row.id}"><i data-lucide="activity"></i></button>` : ""}</div></td></tr>`;
    }).join("") : `<tr><td colspan="${displayCols.length + 1 + Number(bulkDeletable)}"><div class="empty-state"><i data-lucide="inbox"></i>Tidak ada data yang cocok.</div></td></tr>`;
    return `${pageHeading(actions)}${toolbar}<div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr>${selectHeader}${headers}<th>AKSI</th></tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>Menampilkan ${filtered.length} dari ${rows.length} data</span><div class="pagination"><button class="page-number active">1</button></div></div></div>`;
  }

  function matchesSearch(key, row, query) {
    if (!query) return true;
    const config = collectionConfig[key];
    return config.cols.map(([field]) => plainCell(key, field, row)).join(" ").toLowerCase().includes(query.toLowerCase());
  }

  function plainCell(key, field, row) {
    const relations = { fundId: "funds", typeId: "types", categoryId: "categories", unitId: "units", supplierId: "suppliers", goodId: "goods", locationId: "locations", ownershipId: "ownerships" };
    if (relations[field]) return relatedName(relations[field], row[field]);
    if (field === "image") return row.image || "";
    if (field === "evidence") return row.evidence ? "Foto terlampir" : "—";
    if (field === "totalPrice") return (Number(row.quantity) || 0) * (Number(row.price) || 0);
    if (field === "total" && key === "procurements") return (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
    if (field === "consumable") return isBhp(row) ? "Barang Habis Pakai (BHP)" : "Barang Modal";
    return row[field] ?? "";
  }

  function currencyCell(value) {
    return `<span class="goods-price-value"><span class="goods-price-prefix">Rp</span><span class="goods-price-amount">${integerId.format(Number(value) || 0)}</span></span>`;
  }

  function formatCell(key, field, row) {
    const value = row[field];
    if (field === "fundId" || field === "typeId" || field === "categoryId" || field === "unitId" || field === "supplierId" || field === "goodId" || field === "locationId" || field === "ownershipId") return esc(relatedName(({ fundId: "funds", typeId: "types", categoryId: "categories", unitId: "units", supplierId: "suppliers", goodId: "goods", locationId: "locations", ownershipId: "ownerships" })[field], value));
    if (field === "image") return value ? `<img src="${esc(value)}" alt="Gambar supplier" style="width:34px;height:34px;object-fit:cover;border-radius:7px">` : `<span class="badge neutral">—</span>`;
    if (field === "evidence") return value ? `<a href="${esc(value)}" target="_blank" rel="noopener" class="badge info">Lihat foto</a>` : `<span class="badge neutral">—</span>`;
    if (field === "status") return statusBadge(value);
    if (field === "priority") return value === "Mendesak" ? `<span class="badge danger">Mendesak</span>` : `<span class="badge neutral">${esc(value || "Normal")}</span>`;
    if (field === "condition") return value === "Rusak" ? `<span class="badge danger">Rusak</span>` : value === "Dihapus" ? `<span class="badge neutral">Dihapus</span>` : `<span class="badge success">Baik</span>`;
    if (field === "type") return `<span class="badge ${value === "prasarana" ? "info" : "warning"}">${esc(value)}</span>`;
    if (["date", "received", "startDate", "endDate", "dueDate"].includes(field)) return esc(niceDate(value));
    if (field === "late") {
      const late = row.dueDate < dateOffset(0) && ["Diterima", "Pengajuan"].includes(row.status);
      return late ? `<span class="badge danger">${Math.max(1, Math.floor((today - new Date(`${row.dueDate}T00:00:00`)) / 86400000))} hari</span>` : `<span class="badge success">Tepat waktu</span>`;
    }
    if (field === "total") return key === "procurements" ? currencyCell(row.quantity * row.unitPrice) : esc(value ?? "—");
    if (key === "goods" && ["price", "totalPrice"].includes(field)) {
      const amount = field === "totalPrice" ? (Number(row.quantity) || 0) * (Number(row.price) || 0) : value;
      return currencyCell(amount);
    }
    if (field === "totalPrice") return currencyCell((Number(row.quantity) || 0) * (Number(row.price) || 0));
    if (["price", "unitPrice", "initialValue", "amount", "finalValue"].includes(field)) return currencyCell(value);
    if (field === "consumable") return `<span class="badge ${isBhp(row) ? "success" : "neutral"}">${isBhp(row) ? "BHP" : "Barang Modal"}</span>`;
    if (field === "active") return `<span class="badge ${value ? "success" : "neutral"}">${value ? "Aktif" : "Nonaktif"}</span>`;
    if (field === "name" && key === "accounts") return `<span class="table-title">${esc(value)}</span>`;
    return esc(value || "—");
  }

  function statusBadge(value) {
    const tone = ["Diterima", "Disetujui", "Selesai"].includes(value) ? "success" : ["Pengajuan", "Pending"].includes(value) ? "warning" : value === "Ditolak" ? "danger" : "neutral";
    return `<span class="badge ${tone}">${esc(value || "—")}</span>`;
  }

  function renderBarcode() {
    const items = state.items;
    return `${pageHeading(`<button class="btn-secondary" data-action="barcode-options"><i data-lucide="sliders-horizontal"></i>Opsi cetak QR Code</button><button class="btn-primary" data-action="print"><i data-lucide="printer"></i>Cetak barcode</button>`)}
      <div class="table-toolbar"><div class="table-toolbar-left"><label class="search-field"><i data-lucide="search"></i><input id="barcodeSearch" placeholder="Cari kode atau nama barang..."></label><span class="badge neutral">${items.length} item inventaris</span></div><div class="table-toolbar-right"><button class="btn-quiet" data-action="select-all"><i data-lucide="check-check"></i>Pilih semua</button></div></div>
      <div class="panel"><div class="barcode-grid" id="barcodeGrid">${items.map((item) => barcodeCard(item)).join("")}</div></div>`;
  }
  function barcodeCard(item) {
    return `<label class="barcode-card"><input type="checkbox" class="barcode-check" data-id="${item.id}" checked style="accent-color:#f27622;float:left"><div class="qr-target" data-value="${esc(item.code)}" style="width:82px;height:82px;margin:5px auto 8px"></div><b>${esc(item.code)}</b><small>${esc(titleOfGood(item.goodId))}</small></label>`;
  }

  function renderReports() {
    const currentGoods = recordsForAcademicYear("goods");
    const goodsQty = currentGoods.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const value = currentGoods.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.price || 0), 0);
    const reportOptions = [["inventarisBhp", "Rekapitulasi BHP"], ["inventarisModal", "Rekapitulasi Barang Modal"], ["loans", "Laporan Peminjaman"], ["usages", "Penggunaan BHP"], ["procurements", "Pengadaan Barang"], ["disposals", "Pemusnahan Barang"], ["depreciations", "Penyusutan Aset"]];
    return `${pageHeading(`<button class="btn-secondary" data-action="export-report"><i data-lucide="download"></i>Ekspor Excel</button><button class="btn-primary" data-action="print"><i data-lucide="printer"></i>Cetak laporan</button>`)}
      <section class="panel"><div class="report-heading">${state.school.logo ? `<img class="report-logo" src="${esc(state.school.logo)}" alt="Logo sekolah">` : `<div class="school-avatar">${esc((state.school.name || "S").slice(0, 1))}</div>`}<div><h2>${esc(state.school.name)}</h2><p>${esc(state.school.address)} · ${esc(state.school.phone)}</p><p>${esc(state.school.email)} · ${esc(state.school.website)}</p></div></div>
      <div class="table-toolbar report-toolbar" style="border:0;padding:0 0 14px"><div class="table-toolbar-left report-filters">
        <label class="report-filter-control"><span>Jenis laporan</span><select class="table-filter" id="reportType">${reportOptions.map(([val, label]) => `<option value="${val}">${label}</option>`).join("")}</select></label>
        <label class="report-filter-control" id="reportPeriodField"><span>Periode</span><select class="table-filter" id="reportPeriod"><option value="month">Bulanan</option><option value="academicYear">Tahun Pelajaran</option><option value="custom">Rentang tanggal</option></select></label>
        <label class="report-filter-control" id="reportMonthField"><span>Bulan</span><input id="reportMonth" class="table-filter" type="month" value="${currentMonth}"></label>
        <label class="report-filter-control hidden" id="reportAcademicYearField"><span>Tahun Pelajaran</span><select class="table-filter" id="reportAcademicYear">${state.academicYears.map((year) => `<option value="${esc(year.id)}" ${year.id === state.settings.selectedAcademicYearId ? "selected" : ""}>${esc(year.name)}</option>`).join("")}</select></label>
        <div class="report-filter-control hidden" id="reportInventoryDetailsField"><span>Rincian barang</span><label class="form-check report-detail-toggle"><input id="reportInventoryDetails" type="checkbox" ${state.settings.reportInventoryDetails === false ? "" : "checked"}><span>Tampilkan detail barang</span></label></div>
        <div class="report-date-range hidden" id="reportDateRange">
          <label class="report-filter-control"><span>Tanggal mulai</span><input id="reportStart" class="table-filter" type="date" value="${currentMonth}-01"></label>
          <label class="report-filter-control"><span>Tanggal akhir</span><input id="reportEnd" class="table-filter" type="date" value="${dateOffset(0)}"></label>
        </div>
      </div><div class="table-toolbar-right"><span id="reportPeriodNotice" class="form-help hidden">Rekapitulasi BHP dan barang modal menampilkan stok saat ini dan tidak memakai filter periode.</span><span class="badge info">Diperbarui ${niceDate(dateOffset(0))}</span></div></div>
      <div id="reportHeading" class="report-title-block">${reportHeading("inventarisBhp")}</div>
      <div id="reportBody">${reportTable("inventarisBhp")}</div>
      ${reportSignatures(state.school)}
      <p class="muted" style="font-size:9px;text-align:center;margin:28px 0 0">${esc(state.school.footer)}</p></section>`;
  }
  function academicYearBounds(year) {
    if (year && typeof year === "object" && year.startDate && year.endDate) {
      return { start: year.startDate, end: year.endDate };
    }
    const name = typeof year === "object" ? year?.name : year;
    const match = String(name || "").match(/(\d{4})\s*[\/–-]\s*(\d{4})/);
    if (!match) return null;
    return { start: `${match[1]}-07-01`, end: `${match[2]}-06-30` };
  }
  function reportDateRange() {
    const period = $("#reportPeriod")?.value || "month";
    if (period === "month") {
      const month = $("#reportMonth")?.value || currentMonth;
      const [year, monthNumber] = month.split("-").map(Number);
      if (!year || !monthNumber) return null;
      const endDay = new Date(year, monthNumber, 0).getDate();
      return { start: `${month}-01`, end: `${month}-${String(endDay).padStart(2, "0")}` };
    }
    if (period === "academicYear") {
      const year = state.academicYears.find((row) => row.id === $("#reportAcademicYear")?.value);
      return year ? academicYearBounds(year) : null;
    }
    return { start: $("#reportStart")?.value || "", end: $("#reportEnd")?.value || "" };
  }
  function reportHeadingContent(type, range = null) {
    const titles = {
      inventarisBhp: "Rekapitulasi BHP",
      inventarisModal: "Rekapitulasi Barang Modal",
      loans: "Laporan Peminjaman Barang",
      usages: "Laporan Penggunaan BHP",
      procurements: "Laporan Pengadaan Barang",
      disposals: "Laporan Pemusnahan Barang",
      depreciations: "Laporan Penyusutan Aset"
    };
    let period = `Posisi stok per ${niceDate(dateOffset(0))}`;
    if (!isInventoryReport(type)) {
      const filter = $("#reportPeriod")?.value || "month";
      if (filter === "month") {
        const [year, month] = ($("#reportMonth")?.value || currentMonth).split("-").map(Number);
        period = year && month ? `Bulan ${new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))}` : "Bulan tidak valid";
      } else if (filter === "academicYear") {
        const academicYear = state.academicYears.find((row) => row.id === $("#reportAcademicYear")?.value);
        period = academicYear ? `Tahun Pelajaran ${academicYear.name}` : "Tahun pelajaran belum dipilih";
      } else if (range) {
        period = range.start && range.end
          ? `Periode ${niceDate(range.start)} s.d. ${niceDate(range.end)}`
          : range.start ? `Sejak ${niceDate(range.start)}` : range.end ? `Sampai ${niceDate(range.end)}` : "Semua tanggal";
      }
    }
    return { title: titles[type] || "Laporan", period };
  }
  function reportHeading(type, range = null) {
    const { title, period } = reportHeadingContent(type, range);
    return `<div><h3>${esc(title)}</h3><p>${esc(period)}</p></div>`;
  }
  function inventoryReportData(type) {
    const showDetails = state.settings.reportInventoryDetails !== false;
    const goods = recordsForAcademicYear("goods").filter((good) => type === "inventarisBhp" ? isBhp(good) : !isBhp(good));
    const headers = showDetails
      ? ["Nama Barang", "Kepemilikan", "Sumber Dana", "Jenis", "Kategori", "Lokasi", "Jumlah", "Satuan", "Harga Satuan", "Harga Total"]
      : ["Nama Barang", "Jenis", "Kategori", "Jumlah", "Satuan", "Harga Total"];
    const fields = showDetails
      ? ["name", "ownership", "fund", "type", "category", "location", "quantity", "unit", "price", "totalPrice"]
      : ["name", "type", "category", "quantity", "unit", "totalPrice"];
    const rows = goods.map((good) => {
      const totalPrice = Number(good.quantity || 0) * Number(good.price || 0);
      return showDetails
        ? [good.name, relatedName("ownerships", good.ownershipId), relatedName("funds", good.fundId), relatedName("types", good.typeId), relatedName("categories", good.categoryId), relatedName("locations", good.locationId), good.quantity, relatedName("units", good.unitId), Number(good.price || 0), totalPrice]
        : [good.name, relatedName("types", good.typeId), relatedName("categories", good.categoryId), good.quantity, relatedName("units", good.unitId), totalPrice];
    });
    return { headers, fields, rows };
  }
  function reportTable(type, startDate, endDate) {
    let cols, fields, rows;
    if (isInventoryReport(type)) {
      ({ headers: cols, fields, rows } = inventoryReportData(type));
    } else {
      const config = collectionConfig[type];
      cols = config.cols.map((col) => col[1]);
      fields = config.cols.map(([field]) => field);
      const dateField = ({ loans: "startDate", items: "received", stocktakes: "date", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
      rows = (state[type] || []).filter((row) => !dateField || ((!startDate || row[dateField] >= startDate) && (!endDate || row[dateField] <= endDate))).map((row) => config.cols.map(([field]) => plainCell(type, field, row)));
    }
    const currencyFields = new Set(["price", "unitPrice", "initialValue", "amount", "finalValue", "total", "totalPrice", "value"]);
    const inventoryTotal = isInventoryReport(type)
      ? recordsForAcademicYear("goods").filter((good) => type === "inventarisBhp" ? isBhp(good) : !isBhp(good)).reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.price) || 0), 0)
      : 0;
    const inventoryName = type === "inventarisBhp" ? "BHP" : "Barang Modal";
    const totalRow = isInventoryReport(type) ? `<tfoot><tr><th colspan="${cols.length - 1}">Grand Total Nilai ${inventoryName}</th><th class="goods-price-cell">${currencyCell(inventoryTotal)}</th></tr></tfoot>` : "";
    const tableClass = isInventoryReport(type) ? `data-table inventory-report-table ${state.settings.reportInventoryDetails === false ? "inventory-report-compact" : "inventory-report-details"}` : "data-table";
    return `<div class="table-wrap"><table class="${tableClass}"><thead><tr>${cols.map((col) => `<th>${esc(col.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell, index) => currencyFields.has(fields[index]) ? `<td class="goods-price-cell">${currencyCell(cell)}</td>` : `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty-state" colspan="${cols.length}">Tidak ada data.</td></tr>`}</tbody>${totalRow}</table></div>`;
  }

  function renderAccounts() {
    const available = ["dashboard", "goods", "checkGoods", "loans", "procurements", "disposals", "reports", "backup"];
    if (!Array.isArray(mobileNavDraft)) mobileNavDraft = [...(state.settings.mobileNav || seed.settings.mobileNav)];
    if (mobileNavHighlightDraft === null) mobileNavHighlightDraft = state.settings.mobileNavHighlight || "checkGoods";
    if (!mobileNavDraft.includes(mobileNavHighlightDraft)) mobileNavHighlightDraft = mobileNavDraft.includes("checkGoods") ? "checkGoods" : mobileNavDraft[Math.floor(mobileNavDraft.length / 2)] || "";
    const labels = Object.fromEntries([...available, ...permissionPages, "accounts"].map((key) => [key, meta[key][0]]));
    const accessMenus = permissionPages.map((key) => `
      <details class="role-permission-menu">
        <summary>${esc(labels[key])}</summary>
        <div class="role-permission-list">
          <div class="role-permission-row role-permission-admin"><span class="role-permission-name">Administrator</span><span class="role-permission-level">Lihat, edit & hapus</span></div>
          ${permissionRoles.map((role) => `<div class="role-permission-row"><span class="role-permission-name">${esc(role)}</span><select class="table-filter permission-select role-permission-select" data-menu="${key}" data-role="${esc(role)}" ${canEditPage("accounts") ? "" : "disabled"}><option value="hidden" ${state.settings.permissions[role][key] === "hidden" ? "selected" : ""}>Tidak terlihat</option><option value="view" ${state.settings.permissions[role][key] === "view" ? "selected" : ""}>Lihat saja</option><option value="edit" ${state.settings.permissions[role][key] === "edit" ? "selected" : ""}>Lihat & edit</option><option value="delete" ${state.settings.permissions[role][key] === "delete" ? "selected" : ""}>Lihat, edit & hapus</option></select></div>`).join("")}
        </div>
      </details>`).join("");
    const adminOnlyMenus = ["accounts", "backup"].map((key) => `
      <details class="role-permission-menu">
        <summary>${esc(labels[key])}</summary>
        <div class="role-permission-list">
          <div class="role-permission-row role-permission-admin"><span class="role-permission-name">Administrator</span><span class="role-permission-level">Akses penuh</span></div>
          ${permissionRoles.map((role) => `<div class="role-permission-row"><span class="role-permission-name">${esc(role)}</span><span class="role-permission-level">Khusus Administrator</span></div>`).join("")}
        </div>
      </details>`).join("");
    const mobileNavOrder = [...mobileNavDraft, ...available.filter((key) => !mobileNavDraft.includes(key))];
    const mobileNavRows = mobileNavOrder.map((key) => {
      const position = mobileNavDraft.indexOf(key);
      const selected = position >= 0;
      const canMove = canEditPage("accounts") && selected;
      return `<div class="mobile-nav-setting-row"><label class="mobile-nav-setting-check"><input class="mobile-nav-check" type="checkbox" value="${key}" ${selected ? "checked" : ""} ${!canEditPage("accounts") || !selected && mobileNavDraft.length >= 5 ? "disabled" : ""}><b>${esc(labels[key])}</b></label><div class="mobile-nav-order-controls">${selected ? `<span class="mobile-nav-position">Posisi ${position + 1}</span><button class="mini-action" type="button" title="Geser ke atas" aria-label="Geser ${esc(labels[key])} ke atas" data-action="move-mobile-nav" data-direction="up" data-key="${key}" ${!canMove || position === 0 ? "disabled" : ""}><i data-lucide="chevron-up"></i></button><button class="mini-action" type="button" title="Geser ke bawah" aria-label="Geser ${esc(labels[key])} ke bawah" data-action="move-mobile-nav" data-direction="down" data-key="${key}" ${!canMove || position === mobileNavDraft.length - 1 ? "disabled" : ""}><i data-lucide="chevron-down"></i></button>` : `<span class="mobile-nav-position">Tidak dipilih</span>`}</div></div>`;
    }).join("");
    return `${pageHeading(canEditPage("accounts") ? `<button class="btn-primary" data-action="add"><i data-lucide="user-plus"></i>Tambah Akun</button>` : "")}
      ${renderAppBranding()}
      <section class="settings-card"><h3>Akun Pengguna</h3><p>Kelola akses dan status akun yang menggunakan aplikasi.</p>${state.accounts.map((account) => `<div class="settings-row"><div style="display:flex;align-items:center;gap:10px"><span class="avatar">${esc(account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase())}</span><div><b>${esc(account.name)} <span class="badge ${account.role === "Administrator" ? "info" : "neutral"}">${esc(account.role)}</span></b><small>${esc(account.email)}</small></div></div><div class="action-buttons">${canEditPage("accounts") ? `<button class="toggle ${account.active ? "on" : ""}" title="${account.active ? "Nonaktifkan" : "Aktifkan"}" data-action="toggle-account" data-id="${account.id}"></button><button class="mini-action" title="Ubah" data-action="edit" data-id="${account.id}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage("accounts") ? `<button class="mini-action" title="Hapus" data-action="delete" data-id="${account.id}"><i data-lucide="trash-2"></i></button>` : ""}</div></div>`).join("")}</section>
      <section class="settings-card role-permissions-card"><h3>Hak Akses Menu</h3><p>Atur hak akses setiap role untuk masing-masing menu. Administrator selalu memiliki akses penuh.</p>${accessMenus}${adminOnlyMenus}</section>
      <section class="settings-card"><h3>Navigasi Mobile</h3><p>Pilih hingga 5 pintasan, atur urutannya, lalu tentukan menu sorotan di tengah. Menu sorotan hanya menampilkan ikon.</p><div class="mobile-nav-settings-list">${mobileNavRows}</div><div class="form-field mobile-nav-highlight-field"><label for="mobileNavHighlight">Menu sorotan di tengah</label><select id="mobileNavHighlight" class="table-filter" ${canEditPage("accounts") ? "" : "disabled"}>${mobileNavDraft.map((key) => `<option value="${key}" ${mobileNavHighlightDraft === key ? "selected" : ""}>${esc(labels[key])}</option>`).join("")}</select></div>${canEditPage("accounts") ? `<button class="btn-primary" data-action="save-mobile"><i data-lucide="save"></i>Simpan navigasi</button>` : ""}</section>`;
  }

  function renderBackup() {
    const editable = activeUser?.role === "Administrator";
    return `${pageHeading(`<button class="btn-secondary" data-action="download-backup"><i data-lucide="download"></i>Backup sekarang</button><label class="btn-primary ${editable ? "" : "disabled-button"}"><i data-lucide="upload"></i>Restore backup<input id="restoreFile" type="file" accept=".json,application/json" ${editable ? "" : "disabled"} hidden></label>`)}
      <section class="settings-card"><div class="backup-card-heading"><span class="backup-icon"><i data-lucide="hard-drive-download"></i></span><div><h3>Backup & Restore</h3><p>Buat file backup JSON atau pulihkan data aplikasi dari file backup Sarprah sebelumnya.</p></div></div>
      <div class="backup-note"><i data-lucide="shield-check"></i><span>Restore akan mengganti seluruh data aplikasi saat ini. Buat backup terlebih dahulu sebelum memulihkan data.</span></div></section>
      <form id="telegramSettingsForm" class="settings-card"><div class="backup-card-heading"><span class="backup-icon telegram"><i data-lucide="send"></i></span><div><h3>Backup Otomatis Telegram</h3><p>Jadwalkan pengiriman file backup JSON ke chat Telegram setiap hari.</p></div><span id="telegramStatus" class="badge neutral">Memuat pengaturan…</span></div>
      <div class="form-grid">
        <div class="form-field"><label for="telegramChatId">ID Telegram / Chat ID</label><input id="telegramChatId" name="chatId" inputmode="numeric" placeholder="Contoh: 123456789" required ${editable ? "" : "disabled"}></div>
        <div class="form-field"><label for="telegramBotToken">Token Bot Telegram</label><input id="telegramBotToken" name="botToken" type="password" autocomplete="new-password" placeholder="Token disimpan terenkripsi di server" ${editable ? "" : "disabled"}><small id="telegramTokenStatus" class="form-help">Token tidak pernah ditampilkan kembali.</small></div>
        <div class="form-field"><label for="telegramBackupTime">Waktu backup</label><input id="telegramBackupTime" name="backupTime" type="time" value="16:00" required ${editable ? "" : "disabled"}></div>
        <div class="form-field"><label for="telegramTimezone">Zona waktu</label><select id="telegramTimezone" name="timezone" ${editable ? "" : "disabled"}><option value="Asia/Jakarta">WIB — Asia/Jakarta</option><option value="Asia/Makassar">WITA — Asia/Makassar</option><option value="Asia/Jayapura">WIT — Asia/Jayapura</option></select></div>
        <div class="form-field full"><label class="form-check"><input id="telegramEnabled" name="enabled" type="checkbox" ${editable ? "" : "disabled"}><span>Aktifkan backup otomatis harian</span></label><small class="form-help">Jadwal awal pukul 16.00 WIB. Server harus tetap aktif agar backup terjadwal dapat dikirim.</small></div>
      </div>
      <div class="modal-footer" style="justify-content:space-between"><span class="form-help">Buat bot melalui @BotFather, lalu mulai chat bot dan masukkan chat ID tujuan.</span><div style="display:flex;gap:8px"><button type="button" class="btn-secondary" data-action="telegram-test" ${editable ? "" : "disabled"}><i data-lucide="send"></i>Uji koneksi</button>${editable ? `<button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan jadwal</button>` : ""}</div></div>
      </form>`;
  }

  async function loadTelegramSettings() {
    try {
      const response = await fetch("/api/telegram/settings");
      if (!response.ok) throw new Error((await response.json()).error || `HTTP ${response.status}`);
      const config = await response.json();
      if (page !== "backup" || !$("#telegramSettingsForm")) return;
      $("#telegramChatId").value = config.chatId || "";
      $("#telegramBackupTime").value = config.backupTime || "16:00";
      $("#telegramTimezone").value = config.timezone || "Asia/Jakarta";
      $("#telegramEnabled").checked = Boolean(config.enabled);
      $("#telegramStatus").className = `badge ${config.enabled ? "success" : "neutral"}`;
      $("#telegramStatus").textContent = config.enabled ? "Aktif" : "Nonaktif";
      $("#telegramTokenStatus").textContent = config.tokenConfigured ? "Token bot tersimpan terenkripsi. Isi hanya jika ingin menggantinya." : "Token belum disimpan. Token tidak pernah ditampilkan kembali.";
      $("#telegramBotToken").placeholder = config.tokenConfigured ? "Token telah tersimpan (kosongkan untuk mempertahankan)" : "Tempel token dari @BotFather";
    } catch (error) {
      if ($("#telegramStatus")) {
        $("#telegramStatus").className = "badge danger";
        $("#telegramStatus").textContent = "Server tidak tersedia";
        showToast(`Pengaturan Telegram tidak dapat dimuat: ${error.message}`, true);
      }
    }
  }

  async function saveTelegramSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      chatId: form.elements.chatId.value.trim(),
      botToken: form.elements.botToken.value.trim(),
      backupTime: form.elements.backupTime.value,
      timezone: form.elements.timezone.value,
      enabled: form.elements.enabled.checked
    };
    try {
      const response = await fetch("/api/telegram/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      form.elements.botToken.value = "";
      await loadTelegramSettings();
      showToast("Pengaturan backup Telegram berhasil disimpan.");
    } catch (error) { showToast(`Pengaturan Telegram gagal disimpan: ${error.message}`, true); }
  }

  async function testTelegram() {
    try {
      const response = await fetch("/api/telegram/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      showToast("Pesan uji berhasil dikirim ke Telegram.");
    } catch (error) { showToast(`Uji koneksi Telegram gagal: ${error.message}`, true); }
  }

  async function downloadBackup() {
    try {
      let backup;
      if (apiAvailable) {
        const response = await fetch("/api/backup");
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        backup = await response.json();
      } else backup = { app: "Sarprah", formatVersion: 1, createdAt: new Date().toISOString(), state };
      const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `sarprah-backup-${backup.createdAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast("File backup berhasil dibuat.");
    } catch (error) { showToast(`Backup gagal dibuat: ${error.message}`, true); }
  }

  async function restoreBackup(file) {
    try {
      if (file.size > 5_000_000) throw new Error("Ukuran file backup maksimal 5 MB.");
      const backup = JSON.parse(await file.text());
      const backupState = backup?.state;
      if (!backupState || !Array.isArray(backupState.goods) || !Array.isArray(backupState.items) ||
          !Array.isArray(backupState.accounts) || !backupState.school || typeof backupState.school !== "object") {
        throw new Error("Format file backup tidak valid.");
      }
      if (backupState.accounts.filter((account) => account.role === "Administrator").length !== 1) {
        throw new Error("Backup harus memiliki tepat satu akun Administrator.");
      }
      if (!window.confirm("Restore akan mengganti seluruh data aplikasi. Lanjutkan?")) return;
      if (apiAvailable) {
        const response = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      }
      Object.keys(state).forEach((key) => { if (!(key in backupState)) delete state[key]; });
      Object.assign(state, backupState);
      ensureAcademicYearDefaults();
      ensureBrandingDefaults();
      ensurePermissionDefaults();
      await persistState();
      activeUser = getById("accounts", activeUser.id) || activeUser;
      applyAppBranding();
      showToast("Data berhasil dipulihkan dari backup.");
      renderNavigation(); navigate("dashboard");
    } catch (error) { showToast(`Restore gagal: ${error.message}`, true); }
  }

  function formInput(name, label, value, type = "text", required = false) {
    return `<div class="form-field"><label>${esc(label)}</label><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></div>`;
  }

  function optionsFor(source, academicYearId = currentAcademicYearId()) {
    if (Array.isArray(source)) return source.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
    let rows = yearScopedCollections.has(source) ? recordsForAcademicYear(source, academicYearId) : state[source] || [];
    if (source === "bhpGoods") rows = recordsForAcademicYear("goods", academicYearId).filter(isBhp);
    if (source === "loanGoods") rows = recordsForAcademicYear("goods", academicYearId).filter((good) => !isBhp(good));
    if (source === "items") rows = state.items;
    const text = source === "items" ? (row) => `${row.code} — ${titleOfGood(row.goodId)}` : (row) => row.name;
    return rows.map((row) => `<option value="${row.id}">${esc(text(row))}</option>`).join("");
  }

  function modalForm(key, record = null) {
    const config = collectionConfig[key];
    const recordYearId = record?.academicYearId
      || getById("goods", record?.goodId)?.academicYearId
      || getById("locations", record?.locationId)?.academicYearId
      || currentAcademicYearId();
    const scanPanel = !record && ["usages", "stocktakes"].includes(key)
      ? `<div class="form-field full"><div class="barcode-scan-panel"><div class="barcode-scan-heading"><i data-lucide="scan-line"></i><div><b>Pindai barcode ${key === "usages" ? "barang BHP" : "item"}</b><small>${key === "usages" ? "Pindai barcode BHP atau pilih barang secara manual dari daftar." : "Gunakan kamera atau masukkan kode QR/barcode item."}</small></div><button id="startBarcodeScan" class="btn-secondary" type="button"><i data-lucide="camera"></i>Buka kamera</button></div><div class="barcode-scan-manual"><input id="barcodeScanCode" type="text" autocomplete="off" placeholder="${key === "usages" ? "Pindai atau masukkan kode barcode BHP" : "Contoh: E.1-T.1-L1-KS.1"}"><button id="applyBarcodeScan" class="btn-quiet" type="button"><i data-lucide="scan"></i>Gunakan kode</button></div><video id="barcodeScannerVideo" class="barcode-scanner-video hidden" playsinline muted></video><div id="barcodeScanStatus" class="barcode-scan-status" aria-live="polite">Pilih atau pindai kode barang untuk mengisi formulir.</div><button id="stopBarcodeScan" class="btn-quiet barcode-scan-stop hidden" type="button">Tutup kamera</button></div></div>`
      : "";
    const fields = config.fields.map(([name, label, type, required, source]) => {
      if (key === "academicYears" && name === "copyPreviousData" && record) return "";
      let value = record?.[name] ?? (key === "goods" && name === "ownershipId"
        ? (recordsForAcademicYear("ownerships").find((ownership) => ownership.name.toLocaleLowerCase("id-ID") === "milik")?.id || recordsForAcademicYear("ownerships")[0]?.id || "")
        : key === "academicYears" && name === "status" ? "Aktif"
          : key === "accounts" && name === "active" ? true : type === "date" ? (key === "academicYears" ? "" : dateOffset(0)) : "");
      const idAttr = `${key}-${name}`;
      if (key === "usages" && name === "unitId") {
        const unitId = record?.unitId || getById("goods", record?.goodId)?.unitId || "";
        const unitName = relatedName("units", unitId);
        return `<div class="form-field"><label for="usages-unitName">Satuan</label><input id="usages-unitName" type="text" value="${esc(unitName === "—" ? "" : unitName)}" readonly><input type="hidden" name="unitId" value="${esc(unitId)}"></div>`;
      }
      if (type === "checkbox") return `<div class="form-field full"><label class="form-check"><input id="${idAttr}" name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${esc(label)}</span></label></div>`;
      if (key === "goods" && name === "consumable") return `<div class="form-field"><label for="${idAttr}">Status BHP *</label><select id="${idAttr}" name="${name}" required><option value="true" ${isBhp({ consumable: value }) ? "selected" : ""}>Barang Habis Pakai (BHP)</option><option value="false" ${isBhp({ consumable: value }) ? "" : "selected"}>Barang Modal</option></select></div>`;
      if (type === "select") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><select id="${idAttr}" name="${name}" ${required ? "required" : ""}><option value="">Pilih ${esc(label.toLowerCase())}</option>${optionsFor(key === "loans" && name === "goodId" ? "loanGoods" : source, recordYearId).replace(new RegExp(`value="${esc(value)}"`), `value="${esc(value)}" selected`)}</select></div>`;
      if (type === "textarea") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><textarea id="${idAttr}" name="${name}" ${required ? "required" : ""}>${esc(value)}</textarea></div>`;
      if (type === "password") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${key === "accounts" && !record && name === "password" ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="password" autocomplete="new-password" ${key === "accounts" && !record && name === "password" ? "required minlength=\"8\"" : ""}></div>`;
      if (type === "file") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}</label><div class="file-drop"><i data-lucide="image-plus"></i><span>Pilih foto bukti</span><input id="${idAttr}" name="${name}" type="file" accept="image/*" class="form-file"><img class="file-preview ${record?.[name] ? "" : "hidden"}" src="${esc(record?.[name] || "")}" alt="Pratinjau bukti"></div><small class="form-help">Pratinjau 120 × 120 px · maksimal 2 MB.</small></div>`;
      const money = moneyFields.has(name);
      const inputType = money ? "text" : type;
      const inputValue = money ? formatThousands(value) : value;
      const numberAttributes = type === "number"
        ? key === "usages" && name === "quantity" ? 'min="0.01" step="any"' : 'min="0"'
        : "";
      return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="${inputType}" value="${esc(inputValue)}" ${required ? "required" : ""} ${money ? 'class="money-input" inputmode="numeric" autocomplete="off" placeholder="Contoh: 1.000.000"' : numberAttributes}></div>`;
    }).join("");
    return `<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>${record ? "Edit" : "Tambah"} ${config.singular}</h2><p>Lengkapi informasi berikut dengan benar.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form class="modal-form" id="recordForm" data-collection="${key}" data-record="${record?.id || ""}"><div class="form-grid">${scanPanel}${fields}</div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan data</button></div></form></section></div>`;
  }

  function showModal(content, wide = false) {
    stopBarcodeScanner();
    $("#modalRoot").innerHTML = content;
    $("#modalRoot").onclick = recordActions;
    if (wide) $(".modal", $("#modalRoot"))?.classList.add("modal-wide");
    if (window.lucide) lucide.createIcons({ nodes: [$("#modalRoot")] });
    const form = $("#recordForm");
    if (form) setupMoneyInputs(form);
    if (form && form.dataset.collection === "stocktakes") setupStocktakeForm(form);
    if (form && form.dataset.collection === "usages") setupUsageForm(form);
    if (form && $("#barcodeScanCode", form)) setupRecordBarcodeScanner(form);
    const fileInput = $(".form-file", $("#modalRoot"));
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0], preview = $(".file-preview", $("#modalRoot"));
      if (file && preview) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove("hidden");
      }
    });
    $("#modalBackdrop")?.addEventListener("click", (event) => { if (event.target.id === "modalBackdrop") closeModal(); });
    $("#recordForm")?.addEventListener("submit", saveRecord);
  }

  function showDeleteConfirmation(title, description, onConfirm) {
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal logout-confirm-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteConfirmTitle" aria-describedby="deleteConfirmDescription"><div class="delete-confirm-icon"><i data-lucide="trash-2"></i></div><h2 id="deleteConfirmTitle">${esc(title)}</h2><p id="deleteConfirmDescription">${esc(description)}</p><div class="logout-confirm-actions"><button class="btn-quiet" type="button" data-action="close">Batal</button><button class="btn-danger" type="button" id="confirmDeleteAction"><i data-lucide="trash-2"></i>Ya, hapus</button></div></section></div>`);
    $("#confirmDeleteAction")?.addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
  }

  function setupMoneyInputs(form) {
    $$(".money-input", form).forEach((input) => {
      input.addEventListener("input", () => {
        const cursor = input.selectionStart ?? input.value.length;
        const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length;
        const formatted = formatThousands(input.value);
        input.value = formatted;
        let nextCursor = 0;
        let digitsSeen = 0;
        while (nextCursor < formatted.length && digitsSeen < digitsBeforeCursor) {
          if (/\d/.test(formatted[nextCursor])) digitsSeen += 1;
          nextCursor += 1;
        }
        input.setSelectionRange(nextCursor, nextCursor);
      });
    });
  }

  function syncGoodConditionCounts(good) {
    if (!("goodConditionCount" in good) && !("damagedConditionCount" in good)) return;
    const total = Math.max(0, Number(good.quantity) || 0);
    const damaged = Math.min(total, Math.max(0, Number(good.damagedConditionCount) || 0));
    good.damagedConditionCount = damaged;
    good.goodConditionCount = total - damaged;
  }

  function showGoodsConditionModal(goodId) {
    const good = getById("goods", goodId);
    if (!good) return;
    const total = Math.max(0, Number(good.quantity) || 0);
    const damagedCount = Math.min(total, Math.max(0, Number(good.damagedConditionCount) || 0));
    const goodCount = total - damagedCount;
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Kondisi Barang</h2><p>${esc(good.name)}</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form class="modal-form" id="goodsConditionForm"><div class="form-grid">
      <div class="form-field"><label for="conditionTotal">Total jumlah barang</label><input id="conditionTotal" type="number" value="${esc(total)}" readonly></div>
      <div class="form-field"><label for="goodConditionCount">Jumlah kondisi barang baik</label><input id="goodConditionCount" name="goodConditionCount" type="number" min="0" max="${esc(total)}" step="any" value="${esc(goodCount)}" required></div>
      <div class="form-field"><label for="damagedConditionCount">Jumlah kondisi barang rusak</label><input id="damagedConditionCount" name="damagedConditionCount" type="number" min="0" max="${esc(total)}" step="any" value="${esc(damagedCount)}" required></div>
    </div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan kondisi</button></div></form></section></div>`);
    $("#goodsConditionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const goodCount = Number(event.currentTarget.elements.goodConditionCount.value);
      const damaged = Number(event.currentTarget.elements.damagedConditionCount.value);
      if (!Number.isFinite(goodCount) || !Number.isFinite(damaged) || goodCount < 0 || damaged < 0 || Math.abs(goodCount + damaged - total) > 1e-8) {
        showToast(`Jumlah kondisi baik dan rusak harus sama dengan total barang (${total}).`, true);
        return;
      }
      good.goodConditionCount = goodCount;
      good.damagedConditionCount = damaged;
      saveState();
      closeModal();
      showToast("Kondisi barang berhasil diperbarui.");
      renderPage();
    });
  }

  function setupStocktakeForm(form) {
    const goodSelect = form.elements.goodId;
    const oldStockInput = form.elements.oldStock;
    if (!goodSelect || !oldStockInput) return;
    oldStockInput.readOnly = true;
    if (form.dataset.record) return;
    const updateOldStock = () => {
      const good = getById("goods", goodSelect.value);
      oldStockInput.value = good ? String(good.quantity ?? 0) : "";
    };
    goodSelect.addEventListener("change", updateOldStock);
    updateOldStock();
  }

  function setupUsageForm(form) {
    const goodSelect = form.elements.goodId;
    const unitIdInput = form.elements.unitId;
    const unitNameInput = $("#usages-unitName", form);
    const updateUnit = () => {
      const good = getById("goods", goodSelect.value);
      const unitId = good?.unitId || "";
      unitIdInput.value = unitId;
      unitNameInput.value = unitId ? relatedName("units", unitId) : "";
    };
    goodSelect.addEventListener("change", updateUnit);
    updateUnit();
  }

  function setupRecordBarcodeScanner(form) {
    const key = form.dataset.collection;
    const input = $("#barcodeScanCode", form);
    const status = $("#barcodeScanStatus", form);
    const video = $("#barcodeScannerVideo", form);
    const startButton = $("#startBarcodeScan", form);
    const stopButton = $("#stopBarcodeScan", form);
    const setStatus = (message, error = false) => {
      status.textContent = message;
      status.classList.toggle("error", error);
    };

    const applyCode = (value) => {
      const code = String(value || "").trim();
      const normalizedCode = code.toLowerCase();
      const currentGoods = recordsForAcademicYear("goods");
      const currentGoodIds = new Set(currentGoods.map((good) => good.id));
      const item = state.items.find((row) => currentGoodIds.has(row.goodId) && row.code.toLowerCase() === normalizedCode);
      const scannedBhpGood = key === "usages"
        ? currentGoods.find((row) => isBhp(row) && [row.barcode, row.id, row.name].some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedCode))
        : null;
      const good = key === "usages" ? (item ? getById("goods", item.goodId) : scannedBhpGood) : (item ? getById("goods", item.goodId) : null);
      if (!good) {
        const message = key === "usages" ? "Barcode BHP tidak dikenali. Pilih barang secara manual." : `Kode "${code}" tidak ditemukan di data item.`;
        setStatus(message, true);
        showToast(key === "usages" ? message : `Barcode "${code}" tidak dikenali.`, true);
        return false;
      }
      if (key === "usages") {
        if (!isBhp(good)) {
          setStatus("Barang pada barcode bukan barang habis pakai (BHP).", true);
          showToast("Pindai barcode barang BHP atau pilih barang BHP secara manual.", true);
          return false;
        }
        const goodSelect = form.elements.goodId;
        const changed = goodSelect.value !== good.id;
        goodSelect.value = good.id;
        if (changed) goodSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const stock = `${good.quantity} ${relatedName("units", good.unitId)}`;
        setStatus(`${code} · ${good.name} · Stok saat ini: ${stock}.`);
        return true;
      }
      const goodSelect = form.elements.goodId;
      if (goodSelect) {
        const changed = goodSelect.value !== good.id;
        goodSelect.value = good.id;
        if (changed) goodSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const stock = `${good.quantity} ${relatedName("units", good.unitId)}`;
      setStatus(`${item.code} · ${good.name} · Stok saat ini: ${stock}.`);
      return true;
    };

    const applyManualCode = () => {
      if (!input.value.trim()) {
        setStatus("Masukkan kode barcode terlebih dahulu.", true);
        return;
      }
      applyCode(input.value);
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyManualCode();
      }
    });
    $("#applyBarcodeScan", form).addEventListener("click", applyManualCode);
    stopButton.addEventListener("click", stopBarcodeScanner);
    startButton.addEventListener("click", async () => {
      const Detector = window.BarcodeDetector;
      if (typeof Detector !== "function" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("Pindai kamera tidak tersedia di browser ini. Gunakan kolom kode manual atau scanner USB.", true);
        showToast("Browser tidak mendukung pemindaian kamera. Gunakan kode manual atau scanner USB.", true);
        return;
      }
      startButton.disabled = true;
      try {
        const available = typeof Detector.getSupportedFormats === "function" ? await Detector.getSupportedFormats() : ["qr_code"];
        const formats = available.filter((format) => ["qr_code", "code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "itf", "upc_a", "upc_e"].includes(format));
        if (!formats.length) throw new Error("Browser tidak memiliki format QR/barcode yang didukung.");
        const detector = new Detector({ formats });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (!form.isConnected) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        video.classList.remove("hidden");
        startButton.classList.add("hidden");
        stopButton.classList.remove("hidden");
        activeBarcodeScanner = { stream, video, timer: null };
        await video.play();
        setStatus("Kamera aktif. Arahkan ke QR Code atau barcode item.");
        const scanFrame = async () => {
          if (activeBarcodeScanner?.stream !== stream) return;
          try {
            const results = await detector.detect(video);
            if (activeBarcodeScanner?.stream !== stream) return;
            if (results.length) {
              const scannedCode = results[0].rawValue;
              stopBarcodeScanner();
              input.value = scannedCode;
              applyCode(scannedCode);
              return;
            }
          } catch (error) {
            stopBarcodeScanner();
            setStatus(`Pemindaian gagal: ${error.message}`, true);
            showToast(`Pemindaian barcode gagal: ${error.message}`, true);
            return;
          }
          if (activeBarcodeScanner?.stream === stream) activeBarcodeScanner.timer = setTimeout(scanFrame, 220);
        };
        scanFrame();
      } catch (error) {
        stopBarcodeScanner();
        startButton.disabled = false;
        setStatus(`Kamera tidak dapat dibuka: ${error.message}. Gunakan kode manual atau scanner USB.`, true);
        showToast(`Kamera barcode tidak dapat dibuka: ${error.message}`, true);
      }
    });
  }

  function stopBarcodeScanner() {
    if (!activeBarcodeScanner) return;
    const { stream, video, timer } = activeBarcodeScanner;
    activeBarcodeScanner = null;
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
    video.classList.add("hidden");
    const startButton = $("#startBarcodeScan");
    const stopButton = $("#stopBarcodeScan");
    startButton?.classList.remove("hidden");
    if (startButton) startButton.disabled = false;
    stopButton?.classList.add("hidden");
  }

  function closeModal() {
    stopBarcodeScanner();
    $("#modalRoot").innerHTML = "";
  }

  async function saveRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = form.dataset.collection;
    const recordId = form.dataset.record;
    const config = collectionConfig[key];
    const old = recordId ? getById(key, recordId) : null;
    const data = old ? { ...old } : { id: id() };
    let copySourceYear = null;
    let accountSyncPending = false;
    for (const [name, , type] of config.fields) {
      const input = form.elements[name];
      if (!input) continue;
      if (type === "checkbox") data[name] = input.checked;
      else if (moneyFields.has(name)) data[name] = parseThousands(input.value);
      else if (type === "number") data[name] = Number(input.value || 0);
      else if (type === "password") continue;
      else if (type === "file") {
        if (input.files?.[0]) {
          if (input.files[0].size > 2_000_000) { showToast("Ukuran gambar maksimal 2 MB.", true); return; }
          try { data[name] = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("File tidak dapat dibaca."));
            reader.readAsDataURL(input.files[0]);
          }); } catch (error) { showToast(`File bukti tidak dapat dibaca: ${error.message}`, true); return; }
        }
      } else data[name] = name === "email" ? input.value.trim().toLowerCase() : input.value.trim();
    }
    if (key === "goods") data.consumable = data.consumable === true || data.consumable === "true" || isBhp(data);
    if (key === "academicYears") {
      if (!data.startDate || !data.endDate || data.startDate > data.endDate) {
        showToast("Tanggal mulai dan tanggal selesai harus valid; tanggal mulai tidak boleh setelah tanggal selesai.", true);
        return;
      }
      const normalizeYearName = (value) => String(value || "").trim().toLocaleLowerCase("id-ID");
      if (state.academicYears.some((year) => year.id !== old?.id && normalizeYearName(year.name) === normalizeYearName(data.name))) {
        showToast("Nama tahun pelajaran tersebut sudah digunakan.", true);
        return;
      }
      const overlaps = state.academicYears.some((year) => year.id !== old?.id
        && year.startDate && year.endDate
        && data.startDate <= year.endDate && data.endDate >= year.startDate);
      if (overlaps) {
        showToast("Rentang tanggal bertumpang tindih dengan tahun pelajaran lain.", true);
        return;
      }
      if (!old && data.copyPreviousData) {
        copySourceYear = previousAcademicYear(data.startDate);
        if (!copySourceYear) {
          showToast("Tidak ditemukan tahun pelajaran sebelumnya dengan tanggal selesai sebelum tanggal mulai yang dipilih.", true);
          return;
        }
      }
      delete data.copyPreviousData;
    }
    if (!old && yearScopedCollections.has(key)) data.academicYearId = currentAcademicYearId();
    if (key === "goods") {
      if (!recordsForAcademicYear("ownerships").some((ownership) => ownership.id === data.ownershipId)) { showToast("Pilih kepemilikan barang yang valid.", true); return; }
    }
    if (key === "accounts") {
      const emailTaken = state.accounts.some((account) => account.id !== old?.id && account.email.toLowerCase() === data.email.toLowerCase());
      if (emailTaken) { showToast("Email tersebut sudah digunakan akun lain.", true); return; }
      const adminExists = state.accounts.some((account) => account.id !== old?.id && account.role === "Administrator");
      if (data.role === "Administrator" && adminExists) { showToast("Aplikasi hanya dapat memiliki satu akun Administrator.", true); return; }
      if (old?.role === "Administrator" && data.role !== "Administrator" && !adminExists) { showToast("Administrator terakhir tidak dapat diturunkan rolenya.", true); return; }
      const password = form.elements.password?.value || "";
      const confirmPassword = form.elements.passwordConfirm?.value || "";
      if (!old && password.length < 8) { showToast("Kata sandi akun baru minimal 8 karakter.", true); return; }
      if (password && password.length < 8) { showToast("Kata sandi minimal 8 karakter.", true); return; }
      if (password && password !== confirmPassword) { showToast("Konfirmasi kata sandi tidak cocok.", true); return; }
      if (password) Object.assign(data, await passwordCredentials(password));
    }
    if (key === "usages") {
      const good = getById("goods", data.goodId);
      if (!good || !isBhp(good)) {
        showToast("Pilih barang habis pakai (BHP) yang valid.", true);
        return;
      }
      if (!good.unitId) {
        showToast("Atur satuan barang terlebih dahulu pada Data Barang.", true);
        return;
      }
      if (data.quantity <= 0) {
        showToast("Jumlah barang harus lebih dari 0.", true);
        return;
      }
      data.unitId = good.unitId;
      const stock = Number(good.quantity || 0);
      if (data.quantity > stock) {
        showToast(`Maksimal stok adalah ${stock}.`, true);
        return;
      }
      data.status = old?.status || "Pengajuan";
    }
    if (key === "items" && !old) {
      const goodIndex = Math.max(0, recordsForAcademicYear("goods").findIndex((good) => good.id === data.goodId)) + 1;
      const itemIndex = state.items.filter((item) => item.goodId === data.goodId).length + 1;
      data.code = `E.1-T.${goodIndex}-L1-KS.${itemIndex}`;
    }
    if (key === "loans") {
      data.status = old?.status || "Pengajuan";
      if (data.dueDate < data.startDate) { showToast("Tanggal kembali tidak boleh sebelum tanggal sewa.", true); return; }
    }
    if (key === "procurements") data.status = old?.status || "Pengajuan";
    if (key === "disposals") data.status = old?.status || "Pengajuan";
    let stocktakeGood = null;
    if (key === "stocktakes") {
      stocktakeGood = getById("goods", data.goodId);
      if (!stocktakeGood) {
        showToast("Pilih barang yang valid untuk stock opname.", true);
        return;
      }
      const newStock = Number(data.newStock);
      if (!Number.isFinite(newStock) || newStock < 0) {
        showToast("Stok baru harus berupa angka nol atau lebih.", true);
        return;
      }
      data.newStock = newStock;
      data.total = newStock;
      if (!old) data.oldStock = Number(stocktakeGood.quantity || 0);
    }
    if (key === "depreciations") {
      data.finalValue = Math.max(0, data.initialValue - data.amount);
    }
    if (key === "goods") syncGoodConditionCounts(data);
    const previous = key === "accounts" && old ? { ...old } : null;
    if (old) Object.assign(old, data);
    else state[key].unshift(data);
    if (key === "academicYears") {
      if (data.status === "Aktif") {
        state.academicYears.forEach((year) => { if (year.id !== data.id) year.status = "Arsip"; });
        state.settings.selectedAcademicYearId = data.id;
      }
      if (!old && copySourceYear) copyAcademicYearData(copySourceYear.id, data.id);
    }
    if (stocktakeGood) {
      stocktakeGood.quantity = data.newStock;
      syncGoodConditionCounts(stocktakeGood);
    }
    if (key === "accounts") {
      try {
        const synced = await persistAccounts();
        accountSyncPending = !synced || !apiAvailable;
      } catch (error) {
        if (old && previous) Object.assign(old, previous);
        else state.accounts = state.accounts.filter((account) => account.id !== data.id);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
        catch (storageError) { showToast(`Perubahan akun gagal disimpan dan data lokal tidak dapat dipulihkan: ${storageError.message}`, true); }
        if (old?.id === activeUser?.id) {
          activeUser = old;
          syncProfile();
        }
        showToast(`Perubahan akun gagal disimpan: ${error.message}`, true);
        return;
      }
      if (!old && accountSyncPending) markPendingLocalAccount(data);
      if (old?.id === activeUser?.id) {
        activeUser = old;
        syncProfile();
      }
    } else saveState();
    closeModal();
    if (key === "academicYears" && !old && copySourceYear) {
      const yearMasters = yearMasterCollections.reduce((total, collection) => total + recordsForAcademicYear(collection, data.id).length, 0);
      const yearGoods = recordsForAcademicYear("goods", data.id).length;
      showToast(`${config.singular} berhasil ditambahkan dengan menyalin ${yearMasters} data master dan ${yearGoods} barang beserta stok terakhir.`);
    } else if (key === "accounts" && accountSyncPending) {
      showToast("Server belum tersambung atau menolak sinkronisasi. Perubahan akun hanya tersimpan di perangkat ini; pastikan server aktif lalu buka kembali aplikasi sebagai Administrator.", true);
    } else showToast(`${config.singular} berhasil ${old ? "diperbarui" : "ditambahkan"}.`);
    renderPage();
  }

  function updateBulkSelection() {
    const checks = $$(".record-select", $("#pageContent"));
    const selected = checks.filter((check) => check.checked);
    const selectAll = $("#selectAllRecords");
    if (selectAll) {
      selectAll.checked = checks.length > 0 && selected.length === checks.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < checks.length;
    }
    const deleteButton = $("#deleteSelectedRecords");
    if (deleteButton) {
      deleteButton.disabled = selected.length === 0;
      $("#selectedRecordCount").textContent = selected.length ? `(${selected.length})` : "";
    }
  }

  function recordActions(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") return closeModal();
    if (action === "toggle-account") {
      if (activeUser?.role !== "Administrator") return showToast("Hanya administrator yang dapat mengubah status akun.", true);
      const account = getById("accounts", button.dataset.id);
      if (account) { account.active = !account.active; saveState(); showToast(`Akun ${account.active ? "diaktifkan" : "dinonaktifkan"}.`); renderPage(); }
    }
    if (action === "add") {
      if (!canEditPage()) return showToast("Akun Anda hanya dapat melihat data ini.", true);
      if (page === "accounts" || collectionConfig[page]) showModal(modalForm(page));
    } else if (action === "edit") {
      if (!canEditPage()) return showToast("Akun Anda tidak memiliki izin mengubah data.", true);
      const record = getById(page, button.dataset.id);
      if (record) showModal(modalForm(page, record));
    } else if (action === "goods-condition") {
      if (page !== "goods" || !canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin mengubah kondisi barang.", true);
      showGoodsConditionModal(button.dataset.id);
    } else if (action === "delete") {
      if (!canDeletePage()) return showToast("Akun Anda tidak memiliki izin menghapus data.", true);
      const record = getById(page, button.dataset.id);
      if (page === "accounts" && record?.role === "Administrator" && state.accounts.filter((account) => account.role === "Administrator").length <= 1) {
        return showToast("Administrator terakhir tidak dapat dihapus.", true);
      }
      if (page === "academicYears" && record && record.id === currentAcademicYearId()) {
        return showToast("Tahun pelajaran yang sedang dipilih tidak dapat dihapus.", true);
      }
      if (page === "academicYears" && record
        && [...yearScopedCollections].some((collection) => recordsForAcademicYear(collection, record.id).length > 0)) {
        return showToast("Tahun pelajaran yang masih memiliki data master atau barang tidak dapat dihapus.", true);
      }
      if (record) {
        const collection = page;
        const recordName = record.name || record.title || record.code || "ini";
        showDeleteConfirmation("Hapus data?", `Data "${recordName}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`, () => {
          state[collection] = state[collection].filter((row) => row.id !== record.id);
          saveState(); showToast("Data berhasil dihapus."); renderPage();
        });
      }
    } else if (action === "select-visible") {
      $$(".record-select", $("#pageContent")).forEach((check) => { check.checked = true; });
      updateBulkSelection();
    } else if (action === "delete-selected") {
      if (!bulkDeletePages.has(page) || !canDeletePage()) return showToast("Akun Anda tidak memiliki izin menghapus data.", true);
      const selectedIds = new Set($$(".record-select:checked", $("#pageContent")).map((check) => check.value));
      const selectedRows = (state[page] || []).filter((row) => selectedIds.has(row.id));
      if (!selectedRows.length) return showToast("Pilih minimal satu data untuk dihapus.", true);
      const collection = page;
      showDeleteConfirmation("Hapus data terpilih?", `${selectedRows.length} data dari ${collectionConfig[collection].title} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`, () => {
        state[collection] = state[collection].filter((row) => !selectedIds.has(row.id));
        saveState();
        showToast(`${selectedRows.length} data berhasil dihapus.`);
        renderPage();
      });
    } else if (action === "restore-pending-state") {
      restorePendingServerState();
    } else if (action === "discard-pending-state") {
      discardPendingServerState();
    } else if (action === "move-mobile-nav") {
      if (!canEditPage("accounts")) return showToast("Akun Anda tidak memiliki izin mengubah navigasi.", true);
      const currentIndex = mobileNavDraft?.indexOf(button.dataset.key) ?? -1;
      const nextIndex = currentIndex + (button.dataset.direction === "up" ? -1 : 1);
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= mobileNavDraft.length) return;
      [mobileNavDraft[currentIndex], mobileNavDraft[nextIndex]] = [mobileNavDraft[nextIndex], mobileNavDraft[currentIndex]];
      renderPage();
    } else if (action === "status") statusModal(button.dataset.id);
    else if (action === "print") window.print();
    else if (action === "export-report") exportReport();
    else if (action === "export" || action === "export-dashboard") exportRows(page);
    else if (action === "goods-template") downloadGoodsTemplate();
    else if (action === "barcode-options") barcodeOptionsModal();
    else if (action === "download-backup") downloadBackup();
    else if (action === "telegram-test") testTelegram();
    else if (action === "edit-profile") showProfileEditor();
    else if (action === "logout") logout();
    else if (action === "confirm-logout") confirmLogout();
    else if (action === "select-all") $$(".barcode-check").forEach((check) => { check.checked = true; });
    else if (action === "save-mobile") saveMobileNavigation();
  }

  function statusModal(recordId) {
    const record = getById(page, recordId);
    if (!record) return;
    const actionLabel = page === "usages" ? "permintaan penggunaan BHP" : page === "loans" ? "peminjaman" : page === "procurements" ? "pengadaan" : "pemusnahan";
    const buttons = ["Pengajuan", "Pending"].includes(record.status)
      ? `<button class="btn-danger" data-status-choice="Ditolak">Tolak</button><button class="btn-primary" data-status-choice="${page === "usages" ? "Disetujui" : "Diterima"}"><i data-lucide="check"></i>Terima</button>`
      : page === "loans" && record.status === "Diterima"
        ? `<button class="btn-primary" data-status-choice="Selesai"><i data-lucide="check"></i>Tandai selesai</button>`
        : page === "disposals" && record.status === "Diterima"
          ? `<button class="btn-primary" data-status-choice="Selesai"><i data-lucide="check"></i>Tandai selesai</button>`
          : `<span class="badge neutral">Tidak ada aksi lanjutan</span>`;
    const fundChoice = page === "procurements" && ["Pengajuan", "Pending"].includes(record.status)
      ? `<div class="form-field" style="margin-top:14px"><label for="statusFund">Konfirmasi sumber dana</label><select id="statusFund">${optionsFor("funds", getById("goods", record.goodId)?.academicYearId || currentAcademicYearId()).replace(`value="${esc(record.fundId)}"`, `value="${esc(record.fundId)}" selected`)}</select></div>` : "";
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Perbarui status</h2><p>${esc(actionLabel)} · ${esc(record.borrower || record.title || record.applicant || titleOfGood(record.goodId))}</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fafbfc;border-radius:8px"><span class="muted">Status saat ini</span>${statusBadge(record.status)}</div>${fundChoice}<div class="modal-footer">${buttons}</div></div></section></div>`);
    $$("[data-status-choice]", $("#modalRoot")).forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.statusChoice;
      if (next === "Selesai" && !window.confirm(page === "disposals" ? "Tandai pengajuan pemusnahan barang ini sebagai selesai?" : "Peminjaman barang sudah dikembalikan?")) return;
      record.status = next;
      if (page === "procurements" && next === "Diterima" && $("#statusFund")) record.fundId = $("#statusFund").value;
      if (page === "usages" && next === "Disetujui") {
        const good = getById("goods", record.goodId);
        if (good && good.quantity < record.quantity) { showToast(`Stok tidak cukup. Maksimal stok adalah ${good.quantity}.`, true); return; }
        if (good) {
          good.quantity -= Number(record.quantity);
          syncGoodConditionCounts(good);
        }
      }
      saveState(); closeModal(); showToast(`Status ${actionLabel} diperbarui menjadi ${next}.`); renderPage();
    }));
  }

  function bindPageEvents() {
    $("#pageContent").onclick = recordActions;
    $("#pageContent").querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
    if ($("#schoolForm") && !canEditPage("school")) $$("input,textarea", $("#schoolForm")).forEach((input) => { input.disabled = true; });
    if ($("#printDesignForm") && !canEditPage("printDesign")) $$("input,textarea", $("#printDesignForm")).forEach((input) => { input.disabled = true; });
    if ($("#appBrandingForm") && !canEditPage("school")) $$("input,button", $("#appBrandingForm")).forEach((input) => { input.disabled = true; });
    $("#selectAllRecords")?.addEventListener("change", (event) => {
      $$(".record-select", $("#pageContent")).forEach((check) => { check.checked = event.target.checked; });
      updateBulkSelection();
    });
    $$(".record-select", $("#pageContent")).forEach((check) => check.addEventListener("change", updateBulkSelection));
    $("#tableSearch")?.addEventListener("input", (event) => { searchTerm = event.target.value; renderPage(); const input = $("#tableSearch"); input?.focus(); input?.setSelectionRange(searchTerm.length, searchTerm.length); });
    $("#statusFilter")?.addEventListener("change", (event) => { selectedFilter = event.target.value; renderPage(); });
    $("#goodsFilterDetails")?.addEventListener("toggle", (event) => { goodsFiltersOpen = event.currentTarget.open; });
    $("#clearGoodsFilters")?.addEventListener("click", () => {
      goodsFilters = {};
      goodsFiltersOpen = true;
      renderPage();
      $("#goodsFilterDetails summary")?.focus();
    });
    $$(".goods-filter", $("#pageContent")).forEach((filter) => filter.addEventListener("change", (event) => {
      goodsFilters[event.target.dataset.goodsFilter] = event.target.value;
      renderPage();
    }));
    $("#chartPeriod")?.addEventListener("change", (event) => { chartPeriod = event.target.value; drawChart(); });
    $("#dashboardProcFilter")?.addEventListener("change", (event) => {
      const filter = event.target.value;
      $$("#dashboardProcRows tr[data-priority]").forEach((row) => { row.hidden = filter !== "Semua" && row.dataset.priority !== filter; });
    });
    $("#printHeaderMode")?.addEventListener("change", (event) => {
      const custom = event.target.value === "custom";
      $("#printCustomHeaderOptions")?.classList.toggle("hidden", !custom);
      $("#printSchoolHeaderOptions")?.classList.toggle("hidden", custom);
    });
    $("#schoolForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const file = form.elements.logoFile.files?.[0];
      delete data.logoFile;
      const commit = () => {
        Object.assign(state.school, data);
        saveState();
        $("#headerSchoolName").textContent = state.school.name;
        showToast("Profil sekolah berhasil disimpan.");
        renderPage();
      };
      if (!file) return commit();
      if (file.size > 2_000_000) return showToast("Ukuran logo maksimal 2 MB.", true);
      const reader = new FileReader();
      reader.onload = () => { data.logo = reader.result; commit(); };
      reader.onerror = () => showToast("File logo tidak dapat dibaca.", true);
      reader.readAsDataURL(file);
    });
    $("#printDesignForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canEditPage("printDesign")) return showToast("Akun Anda tidak memiliki izin mengubah desain kop.", true);
      const form = event.currentTarget;
      const headerMode = form.elements.headerMode.value === "custom" ? "custom" : "school";
      const customHeaderText = form.elements.customHeaderText.value.trim();
      const headerFontSize = Number(form.elements.headerFontSize.value);
      const logoSize = Number(form.elements.logoSize.value);
      if (headerMode === "custom" && !customHeaderText) return showToast("Teks bagian atas kop wajib diisi saat menggunakan mode ketik sendiri.", true);
      if (!Number.isInteger(headerFontSize) || headerFontSize < 10 || headerFontSize > 48) return showToast("Ukuran font kop harus antara 10 sampai 48 px.", true);
      if (!Number.isInteger(logoSize) || logoSize < 24 || logoSize > 160) return showToast("Ukuran logo kop harus antara 24 sampai 160 px.", true);
      const file = form.elements.letterheadLogoFile.files?.[0];
      if (file && file.size > 2_000_000) return showToast("Ukuran logo kop surat maksimal 2 MB.", true);
      let letterheadLogoData = "";
      const commit = () => {
        state.school.city = form.elements.city.value.trim();
        state.school.principalName = form.elements.principalName.value.trim();
        state.school.principalNip = form.elements.principalNip.value.trim();
        state.school.sarprasVicePrincipalName = form.elements.sarprasVicePrincipalName.value.trim();
        state.school.sarprasVicePrincipalNip = form.elements.sarprasVicePrincipalNip.value.trim();
        if (file) state.school.letterheadLogo = letterheadLogoData;
        else if (form.elements.removeLetterheadLogo.checked) state.school.letterheadLogo = "";
        state.settings.printDesign = {
          showLogo: form.elements.showLogo.checked,
          showNpsn: form.elements.showNpsn.checked,
          showContact: form.elements.showContact.checked,
          headerMode,
          customHeaderText,
          headerFontSize,
          logoSize,
          headerBold: form.elements.headerBold.checked,
          headerItalic: form.elements.headerItalic.checked
        };
        saveState();
        showToast("Desain kop dan tanda tangan berhasil disimpan.");
        renderPage();
      };
      if (!file) return commit();
      const reader = new FileReader();
      reader.onload = () => { letterheadLogoData = String(reader.result || ""); commit(); };
      reader.onerror = () => showToast("File logo kop surat tidak dapat dibaca.", true);
      reader.readAsDataURL(file);
    });
    $("#appBrandingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canEditPage("school")) return showToast("Akun Anda tidak memiliki izin mengubah identitas aplikasi.", true);
      const form = event.currentTarget;
      const appName = form.elements.appName.value.trim();
      const file = form.elements.appLogoFile.files?.[0];
      if (!appName) return showToast("Nama aplikasi wajib diisi.", true);
      if (file && (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_000_000)) {
        return showToast("Pilih logo PNG, JPG, atau WEBP dengan ukuran maksimal 2 MB.", true);
      }
      const commit = (appLogo) => {
        state.settings.appName = appName;
        if (appLogo !== undefined) state.settings.appLogo = appLogo;
        else if (form.elements.removeAppLogo.checked) state.settings.appLogo = "";
        saveState();
        applyAppBranding();
        showToast("Identitas aplikasi berhasil disimpan.");
        renderPage();
      };
      if (!file) return commit();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return showToast("Logo aplikasi tidak dapat dibaca.", true);
        commit(reader.result);
      };
      reader.onerror = () => showToast("File logo aplikasi tidak dapat dibaca.", true);
      reader.readAsDataURL(file);
    });
    $("#telegramSettingsForm")?.addEventListener("submit", saveTelegramSettings);
    $("#restoreFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) restoreBackup(file);
      event.target.value = "";
    });
    $("#telegramSettingsForm")?.addEventListener("submit", saveTelegramSettings);
    $("#restoreFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) restoreBackup(file);
      event.target.value = "";
    });
    $("#goodsImport")?.addEventListener("change", importGoods);
    const updateReport = () => {
      const type = $("#reportType")?.value;
      if (!type) return;
      const inventory = isInventoryReport(type);
      const period = $("#reportPeriod")?.value || "month";
      const range = inventory ? null : reportDateRange();
      $("#reportHeading").innerHTML = reportHeading(type, range);
      $("#reportPeriodField")?.classList.toggle("hidden", inventory);
      $("#reportMonthField")?.classList.toggle("hidden", inventory || period !== "month");
      $("#reportAcademicYearField")?.classList.toggle("hidden", inventory || period !== "academicYear");
      $("#reportInventoryDetailsField")?.classList.toggle("hidden", !inventory);
      $("#reportDateRange")?.classList.toggle("hidden", inventory || period !== "custom");
      $("#reportPeriodNotice")?.classList.toggle("hidden", !inventory);
      if (inventory) {
        $("#reportBody").innerHTML = reportTable(type);
        return;
      }
      if (!range) {
        $("#reportBody").innerHTML = `<p class="empty-state">Pilih tahun pelajaran dengan format, misalnya 2026/2027.</p>`;
        return;
      }
      if (range.start && range.end && range.start > range.end) {
        $("#reportBody").innerHTML = `<p class="empty-state">Tanggal mulai tidak boleh setelah tanggal akhir.</p>`;
        return;
      }
      $("#reportBody").innerHTML = reportTable(type, range.start, range.end);
    };
    $("#reportType")?.addEventListener("change", updateReport);
    $("#reportPeriod")?.addEventListener("change", updateReport);
    $("#reportMonth")?.addEventListener("change", updateReport);
    $("#reportAcademicYear")?.addEventListener("change", updateReport);
    $("#reportInventoryDetails")?.addEventListener("change", (event) => {
      state.settings.reportInventoryDetails = event.target.checked;
      saveState();
      updateReport();
    });
    $("#reportStart")?.addEventListener("change", updateReport);
    $("#reportEnd")?.addEventListener("change", updateReport);
    updateReport();
    $$(".permission-select").forEach((input) => input.addEventListener("change", () => {
      const { menu, role } = input.dataset;
      if (!permissionPages.includes(menu) || !permissionRoles.includes(role)) return;
      state.settings.permissions[role][menu] = input.value;
      saveState(); showToast("Hak akses berhasil diperbarui.");
    }));
    $$(".mobile-nav-check").forEach((input) => input.addEventListener("change", () => {
      if (input.checked) {
        if (mobileNavDraft.length >= 5) { input.checked = false; return showToast("Pilih maksimal 5 pintasan.", true); }
        if (!mobileNavDraft.includes(input.value)) mobileNavDraft.push(input.value);
      } else {
        if (mobileNavDraft.length === 1) { input.checked = true; return showToast("Pilih minimal satu pintasan.", true); }
        mobileNavDraft = mobileNavDraft.filter((key) => key !== input.value);
      }
      if (!mobileNavDraft.includes(mobileNavHighlightDraft)) mobileNavHighlightDraft = mobileNavDraft.includes("checkGoods") ? "checkGoods" : mobileNavDraft[Math.floor(mobileNavDraft.length / 2)];
      renderPage();
    }));
    $("#mobileNavHighlight")?.addEventListener("change", (event) => {
      mobileNavHighlightDraft = event.target.value;
      renderPage();
    });
    $("#barcodeSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      $$(".barcode-card").forEach((card) => { card.hidden = !card.textContent.toLowerCase().includes(query); });
    });
  }

  function parseCsvRows(text) {
    let source = String(text || "").replace(/^\uFEFF/, "");
    let delimiter = ",";
    const separatorDirective = /^sep=(,|;|\t)\r?\n/i.exec(source);
    if (separatorDirective) {
      delimiter = separatorDirective[1];
      source = source.slice(separatorDirective[0].length);
    } else {
      const firstLine = source.split(/\r?\n/, 1)[0] || "";
      const counts = [",", ";", "\t"].map((candidate) => [candidate, firstLine.split(candidate).length - 1]);
      const [detectedDelimiter, count] = counts.sort((a, b) => b[1] - a[1])[0];
      delimiter = count ? detectedDelimiter : ",";
    }
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(cell);
        if (row.length > 1 || row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = "";
      } else cell += character;
    }
    if (quoted) throw new Error("File memiliki tanda kutip yang tidak berpasangan.");
    if (cell.length || row.length) {
      row.push(cell);
      if (row.length > 1 || row.some((value) => value.trim())) rows.push(row);
    }
    return rows;
  }

  function parseExcelRows(data) {
    if (!window.XLSX) throw new Error("Komponen Excel belum siap. Muat ulang aplikasi lalu coba lagi.");
    const workbook = XLSX.read(data, { type: "array", raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("File Excel tidak memiliki lembar kerja.");
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  }

  function importGoods(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!canEditPage("goods")) {
      input.value = "";
      showToast("Akun Anda tidak memiliki izin mengimpor barang.", true);
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(extension)) {
      input.value = "";
      showToast("Pilih file Excel sesuai template impor barang.", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = extension === "csv" ? parseCsvRows(reader.result) : parseExcelRows(reader.result);
        if (!rows.length) throw new Error("File Excel kosong.");
        const normalize = (value) => String(value || "").trim().toLocaleLowerCase("id-ID");
        const headers = rows[0].map(normalize);
        const column = (...names) => headers.findIndex((header) => names.some((name) => header === normalize(name)));
        const columns = {
          name: column("Nama Barang"),
          specification: column("Spesifikasi Barang (Opsional)", "Spesifikasi Barang", "Spesifikasi"),
          ownership: column("Kepemilikan", "Milik"),
          ownerOther: column("Nama Pemilik Lainnya", "Pemilik Lainnya"),
          fund: column("Sumber Dana"),
          type: column("Jenis Barang", "Jenis"),
          category: column("Kategori Barang", "Kategori"),
          location: column("Ruang / Lokasi", "Lokasi", "Ruang"),
          unit: column("Satuan"),
          supplier: column("Supplier", "Nama Supplier"),
          quantity: column("Jumlah Barang", "Jumlah"),
          price: column("Harga Barang (Rp)", "Harga Barang", "Tarif Barang"),
          consumable: column("Status BHP (BHP/Barang Modal)", "Status BHP", "Barang Habis Pakai (Ya/Tidak)", "Habis Pakai", "BHP")
        };
        const requiredColumns = ["name", "ownership", "fund", "type", "category", "location", "unit", "supplier", "quantity", "price", "consumable"];
        const columnLabels = {
          name: "Nama Barang", ownership: "Kepemilikan", fund: "Sumber Dana", type: "Jenis Barang", category: "Kategori Barang", location: "Ruang / Lokasi",
          unit: "Satuan", supplier: "Supplier", quantity: "Jumlah Barang", price: "Harga Barang (Rp)",
          consumable: "Status BHP"
        };
        const missingColumns = requiredColumns.filter((name) => columns[name] < 0).map((name) => columnLabels[name]);
        if (missingColumns.length) throw new Error(`Kolom template tidak lengkap: ${missingColumns.join(", ")}.`);
        if (rows.length < 2) {
          showToast("Belum ada baris barang untuk diimpor.");
          return;
        }

        const valueAt = (row, name) => String(row[columns[name]] || "").trim();
        const findByName = (collection, name) => recordsForAcademicYear(collection).find((record) => normalize(record.name) === normalize(name));
        const existingNames = new Set(recordsForAcademicYear("goods").map((good) => normalize(good.name)));
        const imported = [];
        const errors = [];
        let duplicates = 0;
        rows.slice(1).forEach((row, index) => {
          const rowNumber = index + 2;
          const name = valueAt(row, "name");
          if (!name) return;
          const normalizedName = normalize(name);
          if (existingNames.has(normalizedName)) {
            duplicates += 1;
            return;
          }
          const fundName = valueAt(row, "fund");
          const typeName = valueAt(row, "type");
          const categoryName = valueAt(row, "category");
          const locationName = valueAt(row, "location");
          const unitName = valueAt(row, "unit");
          const supplierName = valueAt(row, "supplier");
          const ownershipValue = ownershipNameFromLegacy(valueAt(row, "ownership"), valueAt(row, "ownerOther")) || "Milik";
          const fund = findByName("funds", fundName);
          const ownership = findByName("ownerships", ownershipValue);
          const type = findByName("types", typeName);
          const category = findByName("categories", categoryName);
          const location = findByName("locations", locationName);
          const unit = findByName("units", unitName);
          const supplier = findByName("suppliers", supplierName);
          const quantityText = valueAt(row, "quantity");
          const priceText = valueAt(row, "price");
          const quantity = parseGroupedInteger(quantityText);
          const price = parseGroupedInteger(priceText);
          const consumableText = normalize(valueAt(row, "consumable"));
          const yesValues = ["ya", "yes", "true", "1", "bhp", "barang habis pakai", "barang habis pakai (bhp)"];
          const noValues = ["tidak", "no", "false", "0", "modal", "barang modal"];
          const rowErrors = [];
          if (!ownership) rowErrors.push(`kepemilikan "${ownershipValue || "kosong"}" tidak ditemukan`);
          if (!fund) rowErrors.push(`Sumber dana "${fundName || "kosong"}" tidak ditemukan`);
          if (!type) rowErrors.push(`jenis barang "${typeName || "kosong"}" tidak ditemukan`);
          if (!category) rowErrors.push(`kategori "${categoryName || "kosong"}" tidak ditemukan`);
          else if (type && category.typeId !== type.id) rowErrors.push("kategori tidak sesuai dengan jenis barang");
          if (!location) rowErrors.push(`ruang/lokasi "${locationName || "kosong"}" tidak ditemukan`);
          if (!unit) rowErrors.push(`satuan "${unitName || "kosong"}" tidak ditemukan`);
          if (!supplier) rowErrors.push(`supplier "${supplierName || "kosong"}" tidak ditemukan`);
          if (quantity === null) rowErrors.push("jumlah barang harus berupa bilangan bulat");
          if (price === null) rowErrors.push("harga barang harus berupa bilangan bulat");
          if (consumableText && !yesValues.includes(consumableText) && !noValues.includes(consumableText)) rowErrors.push('Status BHP harus diisi "BHP" atau "Barang Modal"');
          if (rowErrors.length) {
            errors.push(`Baris ${rowNumber}: ${rowErrors.join(", ")}.`);
            return;
          }
          imported.push({
            id: id(),
            academicYearId: currentAcademicYearId(),
            name,
            specification: valueAt(row, "specification"),
            ownershipId: ownership.id,
            fundId: fund.id,
            typeId: type.id,
            categoryId: category.id,
            locationId: location.id,
            unitId: unit.id,
            supplierId: supplier.id,
            quantity,
            price,
            consumable: yesValues.includes(consumableText)
          });
          existingNames.add(normalizedName);
        });
        if (errors.length) {
          showToast(`Impor dibatalkan. ${errors.slice(0, 3).join(" ")}`, true);
          return;
        }
        if (!imported.length) {
          showToast(duplicates ? `Tidak ada barang baru; ${duplicates} nama duplikat dilewati.` : "Tidak ada baris barang untuk diimpor.", !!duplicates);
          return;
        }
        state.goods.push(...imported);
        saveState();
        showToast(`${imported.length} barang berhasil diimpor${duplicates ? `; ${duplicates} duplikat dilewati` : ""}.`);
        renderPage();
      } catch (error) {
        showToast(`Impor barang gagal: ${error.message}`, true);
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      input.value = "";
      showToast("File Excel tidak dapat dibaca.", true);
    };
    if (extension === "csv") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  function exportRows(key) {
    const config = collectionConfig[key];
    if (!config) {
      const rows = [["Kategori", "Jumlah"], ["Barang", recordsForAcademicYear("goods").length], ["Item", state.items.length], ["Peminjaman", state.loans.length], ["Pengadaan", state.procurements.length]];
      downloadExcel("ringkasan-sarprah.xlsx", rows);
      return;
    }
    const rows = [config.cols.map(([, label]) => label), recordsForCurrentAcademicYear(key).map((row) => config.cols.map(([field]) => plainCell(key, field, row)))];
    downloadExcel(`${key}-sarprah.xlsx`, rows);
  }

  function exportReport() {
    const type = $("#reportType")?.value || "inventarisBhp";
    const inventory = isInventoryReport(type);
    const range = inventory ? null : reportDateRange();
    if (!inventory && !range) {
      showToast("Pilih tahun pelajaran dengan format, misalnya 2026/2027.", true);
      return;
    }
    if (range?.start && range?.end && range.start > range.end) {
      showToast("Tanggal mulai tidak boleh setelah tanggal akhir.", true);
      return;
    }
    const { title, period } = reportHeadingContent(type, range);
    const headingRows = [[state.school.name], [title], [period], []];
    if (inventory) {
      const records = recordsForAcademicYear("goods").filter((row) => type === "inventarisBhp" ? isBhp(row) : !isBhp(row));
      const grandTotal = records.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.price) || 0), 0);
      const { headers, rows } = inventoryReportData(type);
      const exportHeaders = headers.map((header) => header === "Harga Satuan" || header === "Harga Total" ? `${header} (Rp)` : header);
      const reportName = type === "inventarisBhp" ? "bhp" : "barang-modal";
      const totalLabel = type === "inventarisBhp" ? "Grand Total Nilai BHP" : "Grand Total Nilai Barang Modal";
      downloadExcel(`laporan-rekapitulasi-${reportName}.xlsx`, [...headingRows, exportHeaders, ...rows, [totalLabel, ...Array(headers.length - 2).fill(""), grandTotal]]);
      return;
    }
    const config = collectionConfig[type];
    if (!config) return;
    const dateField = ({ loans: "startDate", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
    const records = (state[type] || []).filter((row) => !dateField || ((!range.start || row[dateField] >= range.start) && (!range.end || row[dateField] <= range.end)));
    downloadExcel(`laporan-${type}.xlsx`, [...headingRows, config.cols.map(([, label]) => label), ...records.map((row) => config.cols.map(([field]) => plainCell(type, field, row)))]);
  }

  function downloadGoodsTemplate() {
    downloadExcel("template-impor-barang.xlsx", [goodsImportHeaders, Array(goodsImportHeaders.length).fill("")]);
  }

  function downloadExcel(filename, rows) {
    if (!window.XLSX) {
      showToast("Fitur ekspor Excel belum siap. Periksa koneksi lalu muat ulang aplikasi.", true);
      return;
    }
    try {
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = (rows[0] || []).map((heading) => ({ wch: Math.min(36, Math.max(14, String(heading).length + 3)) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      XLSX.writeFile(workbook, filename, { bookType: "xlsx", compression: true });
      showToast("File Excel berhasil diekspor.");
    } catch (error) {
      showToast(`File Excel gagal dibuat: ${error.message}`, true);
    }
  }

  function barcodeOptionsModal() {
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Opsi Cetak QR Code</h2><p>Atur tata letak label pada satu halaman cetak.</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form id="barcodeOptionsForm" class="modal-form"><div class="form-grid"><div class="form-field"><label>Jumlah QR horizontal</label><input name="columns" type="number" min="1" max="8" value="4"></div><div class="form-field"><label>Jumlah QR vertikal</label><input name="rows" type="number" min="1" max="10" value="5"></div><div class="form-field full"><label>Total gambar per halaman</label><input name="total" type="number" min="1" value="20"></div></div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="check"></i>Terapkan pengaturan</button></div></form></section></div>`);
    $("#barcodeOptionsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const columns = Math.max(1, Math.min(8, Number(data.get("columns")) || 4));
      const rows = Math.max(1, Math.min(10, Number(data.get("rows")) || 5));
      const total = Math.max(1, Number(data.get("total")) || columns * rows);
      $(".barcode-grid").style.gridTemplateColumns = `repeat(${columns},minmax(0,1fr))`;
      $(".barcode-grid").dataset.perPage = total;
      closeModal(); showToast(`Tata letak ${columns} × ${rows} diterapkan (${total} label/halaman).`);
    });
  }

  function saveMobileNavigation() {
    const selected = [...(mobileNavDraft || [])];
    if (selected.length > 5) { showToast("Pilih maksimal 5 pintasan.", true); return; }
    if (!selected.length) { showToast("Pilih minimal satu pintasan.", true); return; }
    const highlight = mobileNavHighlightDraft || $("#mobileNavHighlight")?.value || "";
    if (!selected.includes(highlight)) { showToast("Pilih menu sorotan dari pintasan yang aktif.", true); return; }
    state.settings.mobileNav = selected;
    state.settings.mobileNavHighlight = highlight;
    mobileNavDraft = [...selected];
    mobileNavHighlightDraft = highlight;
    saveState(); renderMobileNav(); renderPage(); showToast("Urutan dan navigasi mobile berhasil disimpan.");
  }

  function showPendingServerStateRecovery() {
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pendingStateTitle"><div class="modal-header"><div><h2 id="pendingStateTitle">Perubahan lokal belum tersinkron</h2><p>Ada salinan data dari sesi sebelumnya yang ditolak server. Pilih cara melanjutkan.</p></div><button class="modal-close" data-action="close" aria-label="Tutup"><i data-lucide="x"></i></button></div><div class="modal-form"><p class="form-help">Memulihkan data lokal akan mengganti seluruh data di server dengan salinan ini. Perubahan dari pengguna lain setelah sesi berakhir dapat tertimpa.</p><div class="modal-footer"><button class="btn-quiet" type="button" data-action="discard-pending-state">Gunakan data server</button><button class="btn-primary" type="button" data-action="restore-pending-state"><i data-lucide="cloud-upload"></i>Pulihkan data lokal</button></div></div></section></div>`);
  }

  async function restorePendingServerState() {
    if (!pendingStateRecovery) return showToast("Salinan pemulihan lokal tidak tersedia.", true);
    if (activeUser?.role !== "Administrator") return showToast("Hanya Administrator yang dapat memulihkan data ke server.", true);
    if (!apiAvailable) return showToast("Sesi server belum aktif. Keluar lalu login kembali sebagai Administrator untuk mencoba sinkronisasi.", true);
    const snapshot = structuredClone(pendingStateRecovery);
    const serverAdmin = state.accounts.find((account) => account.id === activeUser.id && account.role === "Administrator");
    if (!serverAdmin) return showToast("Akun Administrator server tidak ditemukan. Data lokal tetap tersimpan.", true);
    const localAdmin = snapshot.accounts.find((account) => account.email?.toLowerCase() === serverAdmin.email.toLowerCase());
    snapshot.accounts = snapshot.accounts.filter((account) => account.id !== serverAdmin.id && account.email?.toLowerCase() !== serverAdmin.email.toLowerCase());
    snapshot.accounts.unshift({ ...serverAdmin, ...(localAdmin || {}), id: serverAdmin.id, email: serverAdmin.email, role: "Administrator", active: true });
    Object.assign(state, snapshot);
    normalizeAccountRoles();
    try {
      const synced = await persistState();
      if (!synced) return;
      localStorage.removeItem(PENDING_STATE_KEY);
      snapshot.accounts.forEach(clearPendingLocalAccount);
      pendingStateRecovery = null;
      closeModal();
      activeUser = getById("accounts", serverAdmin.id);
      enterApp();
      showToast("Data lokal berhasil dipulihkan ke server.");
    } catch (error) {
      showToast(`Pemulihan data gagal: ${error.message}. Data lokal tetap tersimpan.`, true);
    }
  }

  function discardPendingServerState() {
    if (!pendingStateRecovery) return;
    pendingStateRecovery.accounts.forEach(clearPendingLocalAccount);
    localStorage.removeItem(PENDING_STATE_KEY);
    pendingStateRecovery = null;
    closeModal();
    showToast("Data server digunakan. Salinan lokal yang belum tersinkron dihapus.");
  }

  function drawChart() {
    const canvas = $("#inventoryChart");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * scale);
    canvas.height = Math.max(1, rect.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const width = rect.width, height = rect.height;
    const count = Number(chartPeriod);
    const months = state.months.slice(-count);
    const sarana = months.map((n) => Math.round(n * .72));
    const prasarana = months.map((n) => Math.round(n * .42));
    const pad = { top: 13, right: 12, bottom: 24, left: 28 };
    const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
    const max = Math.ceil(Math.max(...months) / 20) * 20;
    ctx.font = "9px DM Sans"; ctx.fillStyle = "#a0a8b5"; ctx.textAlign = "right";
    for (let tick = 0; tick <= max; tick += Math.max(10, Math.ceil(max / 4 / 10) * 10)) {
      const y = pad.top + plotHeight - tick / max * plotHeight;
      ctx.strokeStyle = "#f0f2f5"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.fillText(String(tick), pad.left - 7, y + 3);
    }
    const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].slice(-count);
    const makePoints = (values) => values.map((value, i) => ({ x: pad.left + (values.length < 2 ? .5 : i / (values.length - 1)) * plotWidth, y: pad.top + plotHeight - value / max * plotHeight }));
    [[sarana, "#f58232", "rgba(245,130,50,.09)"], [prasarana, "#7a91e8", "rgba(122,145,232,.03)"]].forEach(([values, color, fill]) => {
      const points = makePoints(values);
      ctx.beginPath(); points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.stroke();
      ctx.lineTo(points[points.length - 1].x, pad.top + plotHeight); ctx.lineTo(points[0].x, pad.top + plotHeight); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      points.forEach((point) => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); });
    });
    ctx.fillStyle = "#9ba3b0"; ctx.textAlign = "center";
    labels.forEach((label, index) => {
      if (labels.length > 6 && index % 2 !== 0) return;
      const x = pad.left + (labels.length < 2 ? .5 : index / (labels.length - 1)) * plotWidth;
      ctx.fillText(label, x, height - 5);
    });
  }

  function drawBarcodes() {
    $$(".qr-target").forEach((target) => {
      if (window.QRCode) new QRCode(target, { text: target.dataset.value, width: 82, height: 82, colorDark: "#253044", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
      else {
        const canvas = document.createElement("canvas"); canvas.width = 82; canvas.height = 82;
        const ctx = canvas.getContext("2d"), seedNum = [...target.dataset.value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 82, 82); ctx.fillStyle = "#263244";
        for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
          const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
          const fx = x < 7 ? x : x > 13 ? x - 14 : 0, fy = y < 7 ? y : y > 13 ? y - 14 : 0;
          if (finder ? (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)) : ((x * 7 + y * 13 + seedNum) % 5 < 2)) ctx.fillRect(x * 3 + 9, y * 3 + 9, 3, 3);
        }
        target.append(canvas);
      }
    });
  }

  function setup() {
    const collapsed = localStorage.getItem("sarprah-sidebar-collapsed") === "true";
    $("#sidebar").classList.toggle("is-collapsed", collapsed);
    $("#appShell").classList.toggle("sidebar-is-collapsed", collapsed);
    $("#menuToggle").addEventListener("click", () => {
      const next = !$("#sidebar").classList.contains("is-collapsed");
      $("#sidebar").classList.toggle("is-collapsed", next);
      $("#appShell").classList.toggle("sidebar-is-collapsed", next);
      localStorage.setItem("sarprah-sidebar-collapsed", String(next));
    });
    $("#mobileMenuToggle").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebarOverlay").classList.add("visible"); });
    $("#headerAcademicYear").addEventListener("change", (event) => {
      const year = state.academicYears.find((row) => row.id === event.target.value);
      if (!year) return;
      state.settings.selectedAcademicYearId = year.id;
      goodsFilters = {};
      saveState();
      showToast(`Tahun Pelajaran ${year.name} dipilih.`);
      renderPage();
    });
    $("#closeSidebar").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebarOverlay").classList.remove("visible"); });
    $("#sidebarOverlay").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebarOverlay").classList.remove("visible"); });
    $("#searchTrigger").addEventListener("click", openTopbarSearch);
    $("#searchClose").addEventListener("click", closeTopbarSearch);
    $("#globalSearch").addEventListener("input", updateTopbarSearchResults);
    $("#globalSearch").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const firstResult = $("#searchResults [data-page]");
        if (firstResult) navigate(firstResult.dataset.page);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        $("#searchResults [data-page]")?.focus();
      }
    });
    $("#searchResults").addEventListener("click", (event) => {
      const result = event.target.closest("[data-page]");
      if (result) navigate(result.dataset.page);
    });
    document.addEventListener("click", (event) => {
      if (!$("#topbarSearch").contains(event.target)) closeTopbarSearch();
    });
    $("#notificationToggle").addEventListener("click", () => {
      const dropdown = $("#notificationDropdown");
      const open = dropdown.classList.contains("hidden");
      dropdown.classList.toggle("hidden", !open);
      $("#notificationToggle").setAttribute("aria-expanded", String(open));
      if (open && window.lucide) lucide.createIcons({ nodes: [dropdown] });
    });
    document.addEventListener("click", (event) => {
      if (!$("#topbarNotifications").contains(event.target)) closeNotificationDropdown();
    });
    $("#topbarUser").addEventListener("click", () => {
      const menu = $("#topbarProfileMenu");
      const isOpen = !menu.classList.contains("hidden");
      if (isOpen) closeTopbarProfileMenu();
      else {
        menu.classList.remove("hidden");
        $("#topbarUser").setAttribute("aria-expanded", "true");
      }
    });
    $("#topbarProfileMenu").addEventListener("click", (event) => {
      const action = event.target.closest("[data-profile-action]")?.dataset.profileAction;
      if (!action) return;
      closeTopbarProfileMenu();
      if (action === "edit-profile") showProfileEditor();
      else if (action === "logout") logout();
    });
    document.addEventListener("click", (event) => {
      if (!$("#topbarProfile")?.contains(event.target)) closeTopbarProfileMenu();
    });
    $("#loginPasswordToggle").addEventListener("click", (event) => {
      const password = $("#loginPassword");
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      event.currentTarget.setAttribute("aria-label", visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
      event.currentTarget.setAttribute("aria-pressed", String(visible));
      event.currentTarget.innerHTML = `<i data-lucide="${visible ? "eye-off" : "eye"}"></i>`;
      if (window.lucide) lucide.createIcons({ nodes: [event.currentTarget] });
    });
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = $("#loginEmail").value.trim().toLowerCase(), password = $("#loginPassword").value;
      $("#loginError").textContent = "";
      const localStateRecovery = readPendingServerState();
      const pendingLocalAccounts = readPendingLocalAccounts();
      let online = false;
      let pendingLocalLogin = false;
      let authenticatedRole = "";
      try {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        if (!response.ok) {
          const result = await response.json();
          const localAccount = state.accounts.find((row) => row.email.toLowerCase() === email && row.active && isPendingLocalAccount(row));
          if (!localAccount || !await verifyPassword(localAccount, password)) {
            $("#loginError").textContent = result.error || "Email atau kata sandi tidak sesuai.";
            return;
          }
          apiAvailable = false;
          pendingLocalLogin = true;
        } else {
          const auth = await response.json();
          online = true;
          apiAvailable = true;
          authenticatedRole = auth.user?.role || "";
          await loadState();
          if (apiAvailable && authenticatedRole === "Administrator") await syncPendingLocalAccounts(pendingLocalAccounts);
        }
      } catch {
        apiAvailable = false;
      }
      const account = state.accounts.find((row) => row.email.toLowerCase() === email && row.active);
      const validOffline = !online && account && ((email === "admin@sarprah.id" && password === "sarprah123" && !account.passwordHash) || await verifyPassword(account, password));
      if (!online && !validOffline) {
        $("#loginError").textContent = apiAvailable ? "Email atau kata sandi tidak sesuai." : "Server tidak tersedia. Periksa koneksi atau gunakan akun lokal yang tersimpan.";
        return;
      }
      if (!account) { $("#loginError").textContent = "Akun tidak ditemukan pada data aplikasi."; return; }
      activeUser = account;
      if (!account.passwordHash) {
        Object.assign(account, await passwordCredentials(password));
        if (online) {
          try { await persistState(); }
          catch (error) { $("#loginError").textContent = `Kredensial tidak dapat disimpan: ${error.message}`; return; }
        } else saveState();
      }
      sessionStorage.setItem("sarprah-user", JSON.stringify({ id: account.id }));
      enterApp();
      if (pendingLocalLogin) showToast("Akun masuk dalam mode lokal dan menunggu sinkronisasi Administrator.");
      else if (online && localStateRecovery && authenticatedRole === "Administrator" && apiAvailable) {
        pendingStateRecovery = localStateRecovery;
        showPendingServerStateRecovery();
      } else if (online && localStateRecovery) {
        showToast("Ada perubahan lokal yang belum tersinkron. Minta Administrator login untuk memulihkan data.", true);
      }
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openTopbarSearch(); }
      if (event.key === "Escape") { closeModal(); closeTopbarProfileMenu(); closeNotificationDropdown(); closeTopbarSearch(); }
    });
    window.addEventListener("resize", () => { if (page === "dashboard") drawChart(); });
    window.addEventListener("beforeprint", () => {
      const school = state.school || seed.school;
      const printHeader = $("#printSchoolHeader");
      if (printHeader) printHeader.innerHTML = printSchoolHeaderMarkup(school, state.settings.printDesign || seed.settings.printDesign);
      const printSignatures = $("#printSchoolSignatures");
      document.body.classList.toggle("print-goods-mode", page === "goods");
      if (printSignatures) printSignatures.innerHTML = page === "goods" ? reportSignatures(school) : "";
      if (page === "goods") {
        let style = $("#goodsPrintPageStyle");
        if (!style) { style = document.createElement("style"); style.id = "goodsPrintPageStyle"; document.head.append(style); }
        style.textContent = "@page{size:A4 landscape;margin:10mm}";
      } else {
        $("#goodsPrintPageStyle")?.remove();
      }
      if (page !== "barcode") return;
      $$(".barcode-card").forEach((card) => { card.dataset.previousDisplay = card.style.display; card.style.display = card.querySelector(".barcode-check").checked ? "" : "none"; });
      const grid = $(".barcode-grid");
      const total = Number(grid?.dataset.perPage || 0);
      if (grid && total) {
        let style = $("#barcodePrintStyle");
        if (!style) { style = document.createElement("style"); style.id = "barcodePrintStyle"; document.head.append(style); }
        style.textContent = `@media print{.barcode-card:nth-child(${total}n){break-after:page}}`;
      }
    });
    window.addEventListener("afterprint", () => {
      $$(".barcode-card").forEach((card) => { card.style.display = card.dataset.previousDisplay || ""; });
      document.body.classList.remove("print-goods-mode");
      $("#goodsPrintPageStyle")?.remove();
      const printSignatures = $("#printSchoolSignatures");
      if (printSignatures) printSignatures.innerHTML = "";
    });
  }

  function enterApp() {
    $("#loginScreen").classList.add("hidden"); $("#appShell").classList.remove("hidden");
    activeUser = getById("accounts", activeUser?.id) || activeUser;
    applyAppBranding();
    syncProfile();
    $("#headerSchoolName").textContent = state.school.name;
    renderHeaderAcademicYear();
    renderNavigation(); navigate(page);
  }

  function logout() {
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal logout-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="logoutConfirmTitle" aria-describedby="logoutConfirmDescription"><div class="logout-confirm-icon"><i data-lucide="log-out"></i></div><h2 id="logoutConfirmTitle">Keluar dari akun?</h2><p id="logoutConfirmDescription">Anda akan keluar dari ${esc(state.settings.appName)}. Masuk kembali untuk melanjutkan menggunakan aplikasi.</p><div class="logout-confirm-actions"><button id="cancelLogout" class="btn-quiet" type="button" data-action="close">Tetap di sini</button><button class="btn-danger" type="button" data-action="confirm-logout"><i data-lucide="log-out"></i>Ya, keluar</button></div></section></div>`);
    $("#cancelLogout")?.focus();
  }

  async function confirmLogout() {
    closeModal();
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* Local mode has no server session. */ }
    sessionStorage.removeItem("sarprah-user"); activeUser = null;
    $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden");
    if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
  }

  async function init() {
    setup();
    let sessionUser = null;
    try {
      const brandingResponse = await fetch("/api/branding");
      if (brandingResponse.ok) Object.assign(state.settings, await brandingResponse.json());
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sessionUser = (await response.json()).user;
      if (sessionUser) {
        apiAvailable = true;
        const pendingLocalAccounts = readPendingLocalAccounts();
        await loadState();
        activeUser = getById("accounts", sessionUser.id);
        if (activeUser?.role === "Administrator") await syncPendingLocalAccounts(pendingLocalAccounts);
      } else {
        apiAvailable = false;
        const cached = localStorage.getItem(STORE_KEY);
        if (cached) Object.assign(state, JSON.parse(cached));
        restoreLocalUserSession();
      }
    } catch {
      apiAvailable = false;
      await loadState();
      restoreLocalUserSession();
    }
    const academicYearsChanged = ensureAcademicYearDefaults();
    const printDesignChanged = ensurePrintDesignDefaults();
    const brandingChanged = ensureBrandingDefaults();
    const mobileNavigationChanged = ensureMobileNavigationDefaults();
    if (academicYearsChanged || printDesignChanged || brandingChanged || mobileNavigationChanged) saveState();
    applyAppBranding();
    if (activeUser) enterApp();
    else {
      $("#loginScreen").classList.remove("hidden");
      if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
    }
  }
  init();
})();
