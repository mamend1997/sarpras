(() => {
  "use strict";

  const STORE_KEY = "sarprah-state-v1";
  const PENDING_STATE_KEY = "sarprah-pending-server-state-v1";
  const ACTIVE_SCHOOL_CODE_KEY = "sarprah-active-school-code-v1";
  const CACHED_STATE_SCHOOL_CODE_KEY = "sarprah-state-school-code-v1";
  const pendingServerStateKey = (schoolCode) => `${PENDING_STATE_KEY}:${String(schoolCode || "").trim().toUpperCase()}`;
  const pendingAccountKey = (accountId) => `${STORE_KEY}:pending-account:${accountId}`;
  const today = new Date();
  const dateOffset = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const addDaysToDate = (value, days) => {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const validWhatsAppNumber = (value) => {
    let number = String(value || "").replace(/[^\d+]/g, "");
    if (number.startsWith("+")) number = number.slice(1);
    if (number.startsWith("0")) number = `62${number.slice(1)}`;
    return /^62\d{8,13}$/.test(number);
  };
  const daysBetweenDates = (start, end) => {
    const startTime = Date.parse(`${start}T00:00:00Z`);
    const endTime = Date.parse(`${end}T00:00:00Z`);
    return Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.round((endTime - startTime) / 86400000) : 1;
  };
  const defaultLoanReceiptNumberFormat = "{nomor}/PB/{bulan}/{tahun}";
  const formatLoanReceiptNumber = (sequence, date, format = defaultLoanReceiptNumberFormat) => {
    const dateValue = new Date(`${date || dateOffset(0)}T00:00:00`);
    const month = Number.isFinite(dateValue.getTime())
      ? ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][dateValue.getMonth()]
      : "I";
    const year = Number.isFinite(dateValue.getTime()) ? String(dateValue.getFullYear()) : String(today.getFullYear());
    return String(format || defaultLoanReceiptNumberFormat)
      .replace(/\{nomor\}/gi, String(sequence).padStart(3, "0"))
      .replace(/\{bulan\}/gi, month)
      .replace(/\{tahun\}/gi, year);
  };
  const currentMonth = today.toISOString().slice(0, 7);
  const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const rupiah = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const integerId = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const moneyFields = new Set(["price", "unitPrice", "estimatedCost", "initialValue", "residualValue", "amount", "accumulatedAmount", "finalValue"]);
  const depreciationMethods = {
    straightLine: "Garis Lurus (Straight-Line)",
    doubleDeclining: "Saldo Menurun Ganda (Double Declining-Balance)",
    sumOfYears: "Jumlah Angka Tahun (Sum-of-the-Years'-Digits)"
  };
  const goodsImportHeaders = ["Nama Barang", "Kode Barang KIB (Opsional)", "Spesifikasi Barang (Opsional)", "Tanggal Barang Masuk (Opsional)", "Kepemilikan", "Sumber Dana", "Jenis Barang", "Kategori Barang", "Ruang / Lokasi", "Satuan", "Supplier", "Jumlah Barang", "Harga Barang (Rp)", "Status BHP (BHP/Barang Modal)"];
  const kibClasses = [
    { code: "A", label: "KIB A: Tanah" },
    { code: "B", label: "KIB B: Peralatan dan Mesin" },
    { code: "C", label: "KIB C: Gedung dan Bangunan" },
    { code: "D", label: "KIB D: Jalan, Irigasi, dan Jaringan" },
    { code: "E", label: "KIB E: Aset Tetap Lainnya" }
  ];
  const kibClassificationOptions = ["Non KIB", ...kibClasses.map(({ label }) => label)];
  const maintenanceTypes = ["Rutin", "Perbaikan", "Pengecekan", "Pembersihan"];
  const maintenanceStatuses = ["Menunggu Jadwal", "Sedang Diservis", "Selesai"];
  const maintenanceTypeClasses = { Rutin: "routine", Perbaikan: "repair", Pengecekan: "inspection", Pembersihan: "cleaning" };
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
  const yearScopedCollections = new Set([...yearMasterCollections, "goods", "repairTickets", "maintenanceSchedules"]);
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
  const permissionPages = ["dashboard", "school", "printDesign", "types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears", "goods", "checkGoods", "usages", "stocktakes", "barcode", "repairTickets", "maintenanceCalendar", "assetMovements", "loans", "procurements", "disposals", "depreciations", "reports", "activityLog", "trash", "helpTickets", "userGuide", "termsSla", "subscriptionBilling", "theme", "fileManager", "publicPortal"];
  const defaultMenuPermissions = { dashboard: "view", goods: "edit", checkGoods: "view", loans: "edit", procurements: "edit", disposals: "edit", reports: "view", activityLog: "view", helpTickets: "edit", userGuide: "view", termsSla: "view", subscriptionBilling: "view", theme: "view" };
  const createDefaultPermissions = () => Object.fromEntries(permissionRoles.map((role) => [
    role,
    Object.fromEntries(permissionPages.map((key) => [key, defaultMenuPermissions[key] || "hidden"]))
  ]));
  const niceDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const seed = {
    school: { name: "SMA Negeri 1 Bandung", npsn: "20219327", phone: "(022) 4204152", email: "info@sman1bdg.sch.id", website: "www.sman1bdg.sch.id", address: "Jl. Ir. H. Juanda No. 93, Bandung", city: "Bandung", principalName: "", principalNip: "", principalWhatsapp: "", sarprasVicePrincipalName: "", sarprasVicePrincipalNip: "", letterheadLogo: "", footer: "SMA Negeri 1 Bandung · Berkarakter, Berprestasi", logo: "" },
    types: [{ id: "tp1", name: "Elektronik" }, { id: "tp2", name: "Mebel" }, { id: "tp3", name: "Bangunan" }, { id: "tp4", name: "Olahraga" }],
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
    usages: [{ id: "us1", applicant: "Rina Kurniawati", goodId: "gd5", quantity: 3, date: dateOffset(-3) }],
    stocktakes: [{ id: "st1", date: dateOffset(-8), goodId: "gd5", oldStock: 52, newStock: 45, total: 45, note: "Penyesuaian stok akhir bulan" }, { id: "st2", date: dateOffset(-26), goodId: "gd4", oldStock: 20, newStock: 18, total: 18, note: "Pengecekan berkala" }],
    repairTickets: [],
    maintenanceSchedules: [],
    maintenanceHistory: [],
    assetMovements: [],
    activityLogs: [],
    trash: [],
    helpTickets: [],
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
    settings: { appName: "Sarprah", appTagline: "School asset manager", appLogo: "", printDesign: { showLogo: true, showNpsn: true, showContact: true, headerMode: "school", customHeaderText: "", customHeaderLines: [], headerFontSize: 16, logoSize: 56, headerBold: true, headerItalic: false }, loanReceiptNumberFormat: defaultLoanReceiptNumberFormat, loanReceiptNextSequence: 1, mobileNav: ["dashboard", "goods", "checkGoods", "procurements", "reports"], mobileNavHighlight: "checkGoods", permissions: createDefaultPermissions() }
  };

  const themePalette = {
    orange: { label: "Oranye", primary: "#f97316", dark: "#ea580c", soft: "#fff1e7" },
    blue: { label: "Biru", primary: "#2563eb", dark: "#1d4ed8", soft: "#eff6ff" },
    green: { label: "Hijau", primary: "#16a36a", dark: "#128052", soft: "#eaf8f1" },
    purple: { label: "Ungu", primary: "#7c3aed", dark: "#6d28d9", soft: "#f3edff" },
    teal: { label: "Toska", primary: "#0f9f9a", dark: "#0f766e", soft: "#e6fffb" }
  };

  const state = structuredClone(seed);
  let persistedStateSnapshot = null;
  let stateSyncQueue = Promise.resolve();
  let stateSyncWarningShown = false;
  let localStateCacheError = "";
  let pendingStateCacheError = "";
  let page = "dashboard";
  let activeUser = null;
  let tenantFeatureAccess = {};
  let tenantSchool = null;
  let tenantPortalContent = { terms: "", sla: "", announcements: [], manuals: [] };
  let tenantBillingData = null;
  let registrationOtpRequired = false;
  let registrationOtpSentPhone = "";
  let storageUsageData = null;
  let pendingStateRecoveryKey = "";
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
  let goodsImportDraft = [];
  let repairTicketPriority = "Semua";
  let calendarViewMode = "month";
  let calendarCursor = `${dateOffset(0).slice(0, 7)}-01`;
  let calendarSelectedDate = dateOffset(0);
  let calendarPrefillDate = "";
  let procurementPrefill = null;

  const meta = {
    dashboard: ["Dashboard", "Ringkasan kondisi sarana dan prasarana sekolah hari ini.", "layout-dashboard"],
    school: ["Data Sekolah", "Kelola profil sekolah untuk kop laporan dan identitas aplikasi.", "school"],
    printDesign: ["Desain Kop & Tanda Tangan", "Atur teks, logo, tipografi kop, dan informasi penandatangan.", "pen-tool"],
    types: ["Jenis Barang", "Kelompokkan barang berdasarkan jenisnya.", "shapes"],
    categories: ["Kategori Barang", "Atur kategori agar pendataan aset lebih terstruktur.", "tags"],
    units: ["Satuan", "Kelola satuan untuk pencatatan barang dan stok.", "ruler"],
    locations: ["Ruang / Lokasi", "Daftar ruang dan lokasi penempatan inventaris.", "map-pin"],
    ownerships: ["Kepemilikan", "Kelola pilihan kepemilikan barang.", "key-round"],
    suppliers: ["Penyedia / Supplier", "Kelola supplier sekolah beserta alamat dan informasi kontak.", "truck"],
    funds: ["Sumber Dana", "Kelola sumber pendanaan dan hibah aset.", "wallet"],
    academicYears: ["Tahun Pelajaran", "Kelola daftar tahun pelajaran sekolah.", "calendar-days"],
    goods: ["Data Barang", "Daftar master barang dan informasi pengadaan aset.", "package"],
    checkGoods: ["Cek Barang", "Pindai barcode atau cari barang untuk melihat detail dan riwayat stok.", "scan-search"],
    usages: ["Penggunaan BHP", "Catat penggunaan barang habis pakai dan pantau stok.", "clipboard-list"],
    stocktakes: ["Stock Opname", "Rekam hasil pemeriksaan dan penyesuaian stok.", "clipboard-check"],
    barcode: ["Cetak Barcode", "Kelola dan cetak barcode untuk data barang.", "qr-code"],
    repairTickets: ["Tiket Perbaikan", "Kelola laporan kerusakan sarana dan prasarana.", "ticket"],
    maintenanceCalendar: ["Kalender Pemeliharaan", "Atur jadwal perawatan, perbaikan, dan pengecekan barang.", "calendar-days"],
    assetMovements: ["Pindah Ruang Barang", "Catat perubahan ruangan per item inventaris dan lihat riwayatnya.", "move-right"],
    loans: ["Peminjaman & Pengembalian", "Kelola pengajuan, peminjaman, dan pengembalian barang.", "repeat-2"],
    procurements: ["Pengadaan Barang", "Pantau usulan dan realisasi pengadaan aset.", "shopping-cart"],
    disposals: ["Pemusnahan Barang", "Kelola pengajuan pemusnahan aset rusak.", "archive-x"],
    depreciations: ["Penyusutan", "Catat perubahan nilai barang secara berkala.", "trending-down"],
    reports: ["Laporan", "Rekap inventaris dan transaksi sarana prasarana sekolah.", "files"],
    activityLog: ["Log Aktivitas", "Riwayat perubahan dan aktivitas pengguna aplikasi.", "history"],
    trash: ["Kotak Sampah", "Pulihkan data yang dihapus atau hapus permanen.", "trash-2"],
    helpTickets: ["Bantuan & Tiket Kendala", "Temukan bantuan atau kirim laporan kendala.", "life-buoy"],
    userGuide: ["Petunjuk Pengguna", "Panduan menggunakan fitur-fitur Sarprah.", "book-open"],
    termsSla: ["Syarat & SLA", "Baca ketentuan penggunaan dan tingkat layanan yang ditetapkan Super Admin.", "file-check-2"],
    subscriptionBilling: ["Tagihan & Pembayaran", "Lihat tagihan langganan dan lanjutkan pembayaran melalui gateway yang aktif.", "credit-card"],
    theme: ["Tema", "Pilih warna dasar tampilan akun sekolah.", "palette"],
    fileManager: ["Manajemen File", "Lihat foto dan gambar yang tersimpan di data sekolah.", "images"],
    accounts: ["Pengaturan", "Kelola akun pengguna, hak akses, dan identitas aplikasi.", "settings-2"],
    backup: ["Backup & Telegram", "Unduh dan pulihkan data, serta atur backup otomatis ke Telegram.", "database-backup"],
    publicPortal: ["Portal Publik", "Bagikan informasi ketersediaan barang sekolah melalui portal publik.", "globe-2"],
    waNotifications: ["Notifikasi WhatsApp", "Atur Fonnte untuk pengingat peminjaman dan notifikasi pengajuan pengadaan.", "message-circle"]
  };

  const navGroups = [
    { section: "RINGKASAN", links: [{ id: "dashboard", label: "Dashboard", icon: "layout-dashboard" }] },
    { section: "PENGELOLAAN", groups: [
      { label: "Transaksi", icon: "arrow-left-right", children: [["loans", "Peminjaman"], ["procurements", "Pengadaan"], ["disposals", "Pemusnahan"], ["depreciations", "Penyusutan"]] },
      { label: "Barang", icon: "package", children: [["goods", "Data Barang"], ["checkGoods", "Cek Barang"], ["usages", "Penggunaan BHP"], ["stocktakes", "Stock Opname"], ["barcode", "Cetak Barcode"], ["assetMovements", "Pindah Ruang Barang"], ["repairTickets", "Tiket Perbaikan"], ["maintenanceCalendar", "Kalender Pemeliharaan"]] },
      { label: "Data Master", icon: "database", children: [["school", "Data Sekolah"], ["printDesign", "Desain Kop & Tanda Tangan"], ["types", "Jenis Barang"], ["categories", "Kategori Barang"], ["units", "Satuan"], ["locations", "Ruang / Lokasi"], ["ownerships", "Kepemilikan"], ["suppliers", "Penyedia / Supplier"], ["funds", "Sumber Dana"], ["academicYears", "Tahun Pelajaran"]] }
    ] },
    { section: "BANTUAN & RIWAYAT", links: [{ id: "activityLog", label: "Log Aktivitas", icon: "history" }, { id: "trash", label: "Kotak Sampah", icon: "trash-2" }, { id: "helpTickets", label: "Bantuan & Tiket Kendala", icon: "life-buoy" }, { id: "userGuide", label: "Petunjuk Pengguna", icon: "book-open" }, { id: "termsSla", label: "Syarat & SLA", icon: "file-check-2" }] },
    { links: [{ id: "reports", label: "Laporan", icon: "files" }, { id: "subscriptionBilling", label: "Tagihan & Pembayaran", icon: "credit-card" }, { id: "theme", label: "Tema", icon: "palette" }, { id: "fileManager", label: "Manajemen File", icon: "images" }, { id: "accounts", label: "Pengaturan", icon: "settings-2" }, { id: "publicPortal", label: "Portal Publik", icon: "globe-2" }, { id: "waNotifications", label: "Notifikasi WhatsApp", icon: "message-circle" }, { id: "backup", label: "Backup & Telegram", icon: "database-backup" }] }
  ];

  const collectionConfig = {
    types: { title: "Jenis Barang", description: "Daftar nama jenis barang.", singular: "Jenis Barang", cols: [["name", "Nama Jenis"]], fields: [["name", "Nama Jenis", "text", true]] },
    categories: { title: "Kategori Barang", description: "Pilih Non KIB untuk barang habis pakai atau barang yang bukan aset tetap; kategori aset tetap dapat ditetapkan ke golongan KIB A–E.", singular: "Kategori", cols: [["name", "Nama Kategori"], ["typeId", "Jenis Barang"], ["kibClass", "Klasifikasi KIB"], ["note", "Keterangan"]], fields: [["name", "Nama Kategori", "text", true], ["typeId", "Jenis Barang", "select", true, "types"], ["kibClass", "Klasifikasi KIB", "select", false, kibClassificationOptions], ["note", "Keterangan", "text"]] },
    units: { title: "Satuan", description: "Satuan untuk mencatat jumlah barang.", singular: "Satuan", cols: [["name", "Nama Satuan"]], fields: [["name", "Nama Satuan", "text", true]] },
    locations: { title: "Ruang / Lokasi", description: "Kelola ruang sekolah sebagai prasarana beserta kepemilikan dan ukurannya.", singular: "Ruangan", cols: [["name", "Nama Ruangan"], ["code", "Kode Ruangan"], ["ownershipId", "Kepemilikan"], ["floor", "Lantai Ke"], ["length", "Panjang (m)"], ["width", "Lebar (m)"], ["area", "Luas (m²)"], ["condition", "Kondisi Ruangan"], ["status", "Status"]], fields: [["name", "Nama Ruangan", "text", true], ["code", "Kode Ruangan", "text", true], ["ownershipId", "Kepemilikan", "select", true, "ownerships"], ["floor", "Lantai Ke", "number", true], ["length", "Panjang (m)", "number", true], ["width", "Lebar (m)", "number", true], ["area", "Luas (m²)", "number"], ["status", "Status", "select", true, ["Aktif", "Nonaktif"]]] },
    ownerships: { title: "Kepemilikan", description: "Daftar jenis kepemilikan yang dapat dipilih pada Data Barang.", singular: "Kepemilikan", cols: [["name", "Nama Kepemilikan"]], fields: [["name", "Nama Kepemilikan", "text", true]] },
    suppliers: { title: "Penyedia / Supplier", description: "Daftar penyedia, alamat, dan kontak supplier sekolah.", singular: "Supplier", cols: [["name", "Nama Supplier"], ["address", "Alamat"], ["phone", "No. Telepon"], ["email", "Email"]], fields: [["name", "Nama Supplier", "text", true], ["address", "Alamat", "textarea", true], ["phone", "No. Telepon", "tel", true], ["email", "Email (opsional)", "email"]] },
    funds: { title: "Sumber Dana", description: "Sumber pendanaan untuk pengadaan aset.", singular: "Sumber Dana", cols: [["name", "Nama Sumber Dana"], ["description", "Keterangan"]], fields: [["name", "Nama Sumber Dana", "text", true], ["description", "Keterangan", "text"]] },
    academicYears: { title: "Tahun Pelajaran", description: "Kelola periode tahun ajaran dan salin data master serta barang dari tahun sebelumnya.", singular: "Tahun Pelajaran", cols: [["name", "Tahun Pelajaran"], ["startDate", "Tanggal Mulai"], ["endDate", "Tanggal Selesai"], ["status", "Status"]], fields: [["name", "Tahun Pelajaran", "text", true], ["startDate", "Tanggal Mulai", "date", true], ["endDate", "Tanggal Selesai", "date", true], ["copyPreviousData", "Salin data master dan barang beserta stok terakhir dari tahun sebelumnya", "checkbox"], ["status", "Status", "select", true, ["Aktif", "Arsip"]]] },
    goods: { title: "Data Barang", description: "Informasi barang, tanggal barang masuk, stok, dan sumber pendanaannya.", singular: "Barang", cols: [["name", "Nama Barang"], ["assetCode", "Kode Barang KIB"], ["receivedDate", "Tanggal Barang Masuk"], ["specification", "Spesifikasi Barang"], ["ownershipId", "Kepemilikan"], ["fundId", "Sumber Dana"], ["typeId", "Jenis"], ["categoryId", "Kategori"], ["locationId", "Ruang / Lokasi"], ["unitId", "Satuan"], ["supplierId", "Supplier"], ["quantity", "Jumlah"], ["price", "Tarif Barang"], ["consumable", "Status BHP"]], fields: [["name", "Nama Barang", "text", true], ["assetCode", "Kode Barang KIB (opsional)", "text"], ["receivedDate", "Tanggal Barang Masuk (opsional)", "date"], ["specification", "Spesifikasi Barang (opsional)", "textarea"], ["ownershipId", "Kepemilikan", "select", true, "ownerships"], ["fundId", "Sumber Dana", "select", true, "funds"], ["typeId", "Jenis Barang", "select", true, "types"], ["categoryId", "Kategori", "select", true, "categories"], ["locationId", "Ruang / Lokasi Barang", "select", true, "locations"], ["unitId", "Satuan", "select", true, "units"], ["supplierId", "Supplier", "select", true, "suppliers"], ["quantity", "Jumlah Barang", "number", true], ["price", "Tarif Barang (Rp)", "number", true], ["consumable", "Status BHP", "select", true, ["BHP", "Barang Modal"]]] },
    items: { title: "Data Item", description: "Inventaris per unit dengan kode unik, kondisi, dan lokasi.", singular: "Item Inventaris", cols: [["code", "Kode Unik"], ["goodId", "Nama Barang"], ["condition", "Kondisi"], ["locationId", "Lokasi"], ["received", "Tanggal Diterima"]], fields: [["goodId", "Nama Barang", "select", true, "goods"], ["condition", "Kondisi", "select", true, ["Baik", "Rusak", "Rusak Berat", "Hilang"]], ["locationId", "Lokasi", "select", true, "locations"], ["received", "Tanggal Diterima", "date", true]] },
    usages: { title: "Penggunaan BHP", description: "Catat penggunaan barang habis pakai dan kurangi stok secara langsung.", singular: "Penggunaan BHP", cols: [["applicant", "Nama Pengguna"], ["goodId", "Nama Barang"], ["quantity", "Jumlah"], ["unitId", "Satuan"], ["date", "Tanggal"], ["note", "Keterangan"]], fields: [["goodId", "Barang BHP", "select", true, "bhpGoods"], ["applicant", "Nama Pengguna", "text", true], ["quantity", "Jumlah Barang", "number", true], ["unitId", "Satuan", "unit"], ["date", "Tanggal", "date", true], ["note", "Keterangan", "textarea"]] },
    stocktakes: { title: "Stock Opname", description: "Riwayat pemeriksaan dan koreksi jumlah stok barang.", singular: "Stock Opname", cols: [["date", "Tanggal"], ["goodId", "Nama Barang"], ["oldStock", "Stok Lama"], ["newStock", "Stok Baru"], ["total", "Total Stok"], ["note", "Keterangan"], ["checker", "Nama Pengecek"], ["missingQuantity", "Jumlah Hilang"], ["lossStatus", "Status Penanganan"]], fields: [["date", "Tanggal Opname", "date", true], ["goodId", "Nama Barang", "select", true, "goods"], ["oldStock", "Jumlah Stok Lama", "number", true], ["newStock", "Stok Baru", "number", true], ["note", "Keterangan", "text"], ["checker", "Nama Pengecek", "text", true], ["lossStatus", "Status Penanganan Kehilangan", "select", false, ["Perlu penelusuran", "Dilaporkan", "Ditemukan", "Selesai"]]] },
    repairTickets: { title: "Tiket Perbaikan", description: "Kelola laporan kerusakan dan tindak lanjut perbaikan.", singular: "Tiket Perbaikan", cols: [["ticketNo", "Nomor Tiket"], ["title", "Judul Laporan"], ["goodId", "Barang"], ["quantity", "Jumlah"], ["locationId", "Lokasi"], ["priority", "Prioritas"], ["status", "Status"], ["createdAt", "Tanggal"]], fields: [["title", "Judul Laporan", "text", true], ["description", "Deskripsi Kerusakan", "textarea", true], ["photo", "Foto Kerusakan (opsional)", "file"], ["goodId", "Barang", "select", true, "goods"], ["quantity", "Jumlah Barang", "number", true], ["locationId", "Lokasi", "select", true, "locations"], ["priority", "Prioritas", "select", true, ["Rendah", "Sedang", "Tinggi", "Urgent"]]] },
    maintenanceSchedules: { title: "Jadwal Pemeliharaan", description: "Atur jadwal, biaya, status pengerjaan, dan servis berikutnya.", singular: "Jadwal", cols: [["date", "Tanggal Servis"], ["goodId", "Barang"], ["quantity", "Jumlah"], ["locationId", "Lokasi"], ["type", "Jenis Perawatan"], ["status", "Status Pengerjaan"], ["estimatedCost", "Estimasi Biaya"], ["nextServiceDate", "Servis Berikutnya"], ["technician", "Teknisi"], ["description", "Deskripsi"]], fields: [["goodId", "Nama Barang", "select", true, "goods"], ["quantity", "Jumlah Barang", "number", true], ["locationId", "Lokasi", "select", true, "locations"], ["type", "Jenis Perawatan", "select", true, maintenanceTypes], ["date", "Tanggal Servis", "date", true], ["estimatedCost", "Estimasi Biaya Perawatan (Rp)", "number"], ["status", "Status Pengerjaan", "select", true, maintenanceStatuses], ["nextServiceDate", "Tanggal Servis Berikutnya (opsional)", "date"], ["technician", "Nama Teknisi (opsional)", "text"], ["description", "Deskripsi", "textarea"]] },
    loans: { title: "Peminjaman Barang", description: "Pencatatan peminjaman barang sekolah dan pengembaliannya.", singular: "Peminjaman", cols: [["borrower", "Peminjam"], ["goodId", "Barang"], ["quantity", "Jumlah Dipinjam"], ["locationId", "Lokasi"], ["startDate", "Tanggal Sewa"], ["durationDays", "Lama Pinjam (Hari)"], ["dueDate", "Tanggal Kembali"], ["late", "Keterlambatan"], ["status", "Status"]], fields: [["borrower", "Nama Peminjam", "text", true], ["whatsapp", "Nomor WhatsApp Peminjam (opsional)", "tel"], ["goodId", "Barang", "select", true, "loanGoods"], ["quantity", "Jumlah Barang Dipinjam", "number", true], ["locationId", "Lokasi", "select", true, "locations"], ["startDate", "Tanggal Sewa", "date", true], ["durationDays", "Jumlah Hari Peminjaman", "number", true], ["dueDate", "Tanggal Kembali", "date", true], ["note", "Keterangan", "textarea"], ["signature", "Tanda Tangan Peminjam (opsional)", "signature"]] },
    procurements: { title: "Pengadaan Barang", description: "Usulan pengadaan, prioritas, dan realisasi barang.", singular: "Pengadaan", cols: [["title", "Nama Pengadaan"], ["proposer", "Nama Pengusul"], ["goodId", "Barang"], ["priority", "Prioritas"], ["date", "Tanggal"], ["total", "Nominal"], ["status", "Status"]], fields: [["proposer", "Nama Pengusul", "text", true], ["title", "Nama Pengadaan", "text", true], ["goodId", "Barang", "select", true, "goods"], ["priority", "Prioritas", "select", true, ["Normal", "Mendesak"]], ["quantity", "Jumlah Barang", "number", true], ["unitPrice", "Harga Satuan (Rp)", "number", true], ["fundId", "Sumber Dana", "select", true, "funds"], ["date", "Tanggal Pengadaan", "date", true], ["note", "Keterangan", "textarea"]] },
    disposals: { title: "Pemusnahan Barang", description: "Catat pemusnahan barang dan pengurangan stok secara langsung.", singular: "Pemusnahan", cols: [["goodId", "Nama Barang"], ["quantity", "Jumlah Barang"], ["locationId", "Lokasi"], ["reason", "Keterangan"], ["evidence", "Bukti"], ["date", "Tanggal Pemusnahan"], ["status", "Status"]], fields: [["goodId", "Nama Barang", "select", true, "goods"], ["quantity", "Jumlah Barang", "number", true], ["locationId", "Lokasi", "select", true, "locations"], ["reason", "Alasan pemusnahan", "textarea", true], ["evidence", "Bukti foto (opsional)", "file"], ["date", "Tanggal Pemusnahan", "date", true]] },
    depreciations: { title: "Penyusutan Nilai Aset", description: "Hitung beban dan akumulasi penyusutan aset tetap.", singular: "Penyusutan", cols: [["date", "Tanggal Periode"], ["goodId", "Barang"], ["method", "Metode"], ["initialValue", "Harga Awal"], ["residualValue", "Nilai Residu"], ["amount", "Penyusutan Periode Ini"], ["accumulatedAmount", "Akumulasi Penyusutan"], ["finalValue", "Harga Akhir / Nilai Buku"]], fields: [["periodType", "Periode Penyusutan", "select", true, ["Bulanan", "Tahunan"]], ["date", "Tanggal Akhir Periode", "date", true], ["goodId", "Barang", "select", true, "goods"], ["method", "Metode Penyusutan", "select", true, Object.values(depreciationMethods)], ["initialValue", "Harga Awal (Rp)", "number", true], ["residualValue", "Nilai Residu (Rp)", "number", true], ["usefulLifeYears", "Umur Ekonomis (Tahun)", "number", true], ["amount", "Penyusutan Periode Ini (Rp)", "number", true], ["accumulatedAmount", "Akumulasi Penyusutan (Rp)", "number", true], ["finalValue", "Harga Akhir / Nilai Buku (Rp)", "number", true]] },
    accounts: { title: "Pengaturan", description: "Kelola pengguna aplikasi dan izin akses.", singular: "Akun", cols: [["name", "Nama Pengguna"], ["email", "Email"], ["role", "Peran"], ["active", "Status"]], fields: [["name", "Nama Pengguna", "text", true], ["email", "Email", "email", true], ["role", "Peran", "select", true, ["Administrator", "Kepala Sekolah", "Wakasek Sarpras", "Guru"]], ["active", "Akun aktif", "checkbox"], ["password", "Kata sandi (min. 8 karakter)", "password"], ["passwordConfirm", "Konfirmasi kata sandi", "password"]] }
  };
  const statusPages = new Set(["loans", "procurements", "disposals", "repairTickets"]);
  const bulkDeletePages = new Set(["goods", "usages", "stocktakes", "loans", "procurements", "disposals", "depreciations"]);
  const statusOptions = {
    loans: ["Semua", "Pengajuan", "Dipinjam", "Ditolak", "Selesai"],
    procurements: ["Semua", "Pengajuan", "Diterima", "Ditolak"],
    disposals: ["Semua", "Pengajuan", "Diterima", "Ditolak", "Selesai"],
    repairTickets: ["Semua", "Diajukan", "Diproses", "Selesai"]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const getById = (collection, value) => (state[collection] || []).find((row) => row.id === value);
  function nextLocationCode(academicYearId = currentAcademicYearId(), reservedCodes = []) {
    const matchesYear = (location) => !academicYearId || !location.academicYearId || location.academicYearId === academicYearId;
    const locations = (state.locations || []).filter(matchesYear);
    const trashedLocations = (state.trash || [])
      .filter((entry) => entry.collection === "locations" && matchesYear(entry.record || {}))
      .map((entry) => entry.record);
    const codes = [...locations, ...trashedLocations].map((location) => String(location.code || "").trim().toUpperCase());
    const usedCodes = new Set([...codes, ...reservedCodes.map((code) => String(code || "").trim().toUpperCase())]);
    const highestSequence = [...usedCodes].reduce((highest, code) => {
      const match = /^RNG-(\d+)$/i.exec(code);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    let sequence = highestSequence + 1;
    let code = `RNG-${String(sequence).padStart(4, "0")}`;
    while (usedCodes.has(code)) {
      sequence += 1;
      code = `RNG-${String(sequence).padStart(4, "0")}`;
    }
    return code;
  }

  function calculatedRoomArea(length, width) {
    const roomLength = Number(length), roomWidth = Number(width);
    return roomLength > 0 && roomWidth > 0
      ? Math.round(roomLength * roomWidth * 100) / 100
      : "";
  }

  function logActivity(action, entity, detail) {
    if (!Array.isArray(state.activityLogs)) state.activityLogs = [];
    state.activityLogs.unshift({
      id: id(),
      action,
      entity,
      detail: String(detail || ""),
      actor: activeUser?.name || "Sistem",
      actorId: activeUser?.id || "",
      timestamp: new Date().toISOString()
    });
    state.activityLogs.length = Math.min(state.activityLogs.length, 500);
  }
  function nextGoodBarcode(reservedCodes = []) {
    const goods = state.goods || [];
    const usedCodes = new Set([...goods.map((good) => String(good.barcode || "").trim().toUpperCase()), ...reservedCodes.map((code) => String(code || "").trim().toUpperCase())]);
    const highestSequence = goods.reduce((highest, good) => {
      const match = /^BRG-(\d+)$/i.exec(String(good.barcode || "").trim());
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    let sequence = highestSequence + 1;
    let barcode = `BRG-${String(sequence).padStart(5, "0")}`;
    while (usedCodes.has(barcode)) {
      sequence += 1;
      barcode = `BRG-${String(sequence).padStart(5, "0")}`;
    }
    return barcode;
  }
  function ensureGoodBarcodes() {
    let changed = false;
    (state.goods || []).forEach((good) => {
      if (!String(good.barcode || "").trim()) {
        good.barcode = nextGoodBarcode();
        changed = true;
      }
    });
    return changed;
  }
  const relatedName = (collection, value, key = "name") => getById(collection, value)?.[key] || "—";
  const titleOfGood = (value) => relatedName("goods", value);
  const isBhp = (good) => good.consumable === true || ["true", "bhp", "barang habis pakai", "barang habis pakai (bhp)"].includes(String(good.consumable || "").trim().toLocaleLowerCase("id-ID"));
  const isStockAdditionRecord = (record) => record?.stockAddition === true
    || (record?.title?.startsWith("Pembelian barang:")
      && record?.note === "Pembelian barang yang sudah terdaftar dan penambahan stok.");
  function bhpStockAlert(good) {
    if (!good || !isBhp(good)) return null;
    const initial = Math.max(0, Number(good.initialQuantity) || 0);
    if (!initial) return null;
    const remaining = Math.max(0, Number(good.quantity) || 0);
    const consumedPercent = Math.min(100, Math.round((initial - remaining) / initial * 100));
    return consumedPercent >= 70 ? { initial, remaining, consumedPercent } : null;
  }
  function maintenanceReminderDate(schedule) {
    if (schedule.status === "Selesai") return schedule.nextServiceDate || "";
    return schedule.date || "";
  }
  function upcomingMaintenanceReminders() {
    const firstDay = dateOffset(-30);
    const lastDay = addDaysToDate(dateOffset(0), 30);
    return recordsForCurrentAcademicYear("maintenanceSchedules")
      .map((schedule) => ({ ...schedule, reminderDate: maintenanceReminderDate(schedule) }))
      .filter((schedule) => schedule.reminderDate && schedule.reminderDate >= firstDay && schedule.reminderDate <= lastDay)
      .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
  }
  function lowStockBhpGoods() {
    return recordsForAcademicYear("goods").filter((good) => bhpStockAlert(good));
  }
  const activeLoanQuantity = (goodId, excludeLoanId = "") => (state.loans || []).reduce((total, loan) => {
    if (loan.id === excludeLoanId || loan.goodId !== goodId || loan.status !== "Diterima" || loan.stockAdjusted === true) return total;
    return total + Math.max(1, Number(loan.quantity) || 1);
  }, 0);
  const availableLoanQuantity = (goodId, excludeLoanId = "") => {
    const good = getById("goods", goodId);
    if (!good || isBhp(good)) return 0;
    return Math.max(0, Number(good.quantity || 0) - activeLoanQuantity(goodId, excludeLoanId));
  };
  const loanFormAvailableQuantity = (goodId, loanId = "") => {
    const loan = loanId ? getById("loans", loanId) : null;
    const restored = loan?.stockAdjusted === true && loan.status === "Diterima" && loan.goodId === goodId
      ? Math.max(1, Number(loan.quantity) || 1)
      : 0;
    return availableLoanQuantity(goodId, loanId) + restored;
  };
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

  function readPendingLocalAccounts(schoolCode) {
    let accounts = state.accounts;
    try {
      const cached = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      const cachedCode = localStorage.getItem(CACHED_STATE_SCHOOL_CODE_KEY) || cached?.school?.code || "";
      if (String(cachedCode).toUpperCase() !== String(schoolCode || "").toUpperCase()) return [];
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
      const schoolCode = activeSchoolCode();
      const key = schoolCode ? pendingServerStateKey(schoolCode) : PENDING_STATE_KEY;
      localStorage.setItem(key, JSON.stringify({ schoolCode, state }));
      pendingStateCacheError = "";
      return true;
    } catch (error) {
      pendingStateCacheError = error.message;
      return false;
    }
  }

  function hasPendingServerStateForCurrentSchool() {
    const schoolCode = activeSchoolCode();
    return Boolean(schoolCode && localStorage.getItem(pendingServerStateKey(schoolCode)));
  }

  function activeSchoolCode() {
    return String(tenantSchool?.code || localStorage.getItem(ACTIVE_SCHOOL_CODE_KEY) || state.school?.code || "").trim().toUpperCase();
  }

  function storeLocalState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    const schoolCode = activeSchoolCode();
    if (schoolCode) localStorage.setItem(CACHED_STATE_SCHOOL_CODE_KEY, schoolCode);
  }

  function storeLocalStateSafely() {
    try {
      storeLocalState();
      localStateCacheError = "";
      return true;
    } catch (error) {
      localStateCacheError = error.message;
      return false;
    }
  }

  function createStateSyncPatch() {
    const changedState = {};
    const removed = [];
    if (!persistedStateSnapshot) return { state: structuredClone(state), removed };
    Object.keys(state).forEach((key) => {
      if (!(key in persistedStateSnapshot) || JSON.stringify(state[key]) !== JSON.stringify(persistedStateSnapshot[key])) {
        changedState[key] = structuredClone(state[key]);
      }
    });
    Object.keys(persistedStateSnapshot).forEach((key) => {
      if (!(key in state)) removed.push(key);
    });
    return { state: changedState, removed };
  }

  function syncStateToServer() {
    const sync = stateSyncQueue.then(async () => {
      const patch = createStateSyncPatch();
      if (!Object.keys(patch.state).length && !patch.removed.length) return true;
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          handleStateSyncFailure(response.status, error.error || "");
          return false;
        }
        apiAvailable = true;
        localStateCacheError = "";
        pendingStateCacheError = "";
        if (!persistedStateSnapshot) persistedStateSnapshot = {};
        patch.removed.forEach((key) => delete persistedStateSnapshot[key]);
        Object.assign(persistedStateSnapshot, patch.state);
        stateSyncWarningShown = false;
        return true;
      } catch (error) {
        handleStateSyncFailure(0, error.message);
        return false;
      }
    });
    stateSyncQueue = sync.then(() => undefined, () => undefined);
    return sync;
  }

  function loadLocalStateForCurrentSchool() {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) return false;
    const schoolCode = activeSchoolCode();
    const cachedCode = String(localStorage.getItem(CACHED_STATE_SCHOOL_CODE_KEY) || "").toUpperCase();
    if (!schoolCode || !cachedCode || cachedCode !== schoolCode) return false;
    Object.assign(state, JSON.parse(stored));
    return true;
  }

  function handleStateSyncFailure(status, detail = "") {
    apiAvailable = false;
    const recoverySaved = cachePendingServerState();
    const localDetails = [
      localStateCacheError && `Salinan lokal: ${localStateCacheError}`,
      pendingStateCacheError && `Salinan pemulihan: ${pendingStateCacheError}`
    ].filter(Boolean);
    const localDetail = localDetails.length ? ` ${localDetails.join(". ")}.` : "";
    const reason = status === 401
      ? "Sesi server berakhir (401)."
      : status ? `Server menolak sinkronisasi (HTTP ${status}).` : "Server tidak dapat dijangkau.";
    const recoveryMessage = recoverySaved
      ? "Salinan lokal tetap tersimpan; sinkronisasi akan dicoba lagi pada perubahan berikutnya atau saat Administrator masuk kembali."
      : "Salinan pemulihan lokal gagal disimpan; perubahan ini belum aman jika halaman ditutup.";
    if (!stateSyncWarningShown) {
      showToast(`${reason} ${recoveryMessage}${detail ? ` ${detail}` : ""}${localDetail}`, true);
      stateSyncWarningShown = true;
    }
  }

  function readPendingServerState(schoolCode) {
    const normalizedCode = String(schoolCode || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    const scopedKey = pendingServerStateKey(normalizedCode);
    let stored = localStorage.getItem(scopedKey);
    if (!stored) {
      const legacy = localStorage.getItem(PENDING_STATE_KEY);
      if (legacy) {
        try {
          const legacySnapshot = JSON.parse(legacy);
          const legacyCode = String(legacySnapshot?.schoolCode || legacySnapshot?.state?.school?.code || legacySnapshot?.school?.code || "").toUpperCase();
          if (legacyCode === normalizedCode) {
            stored = legacy;
            localStorage.setItem(scopedKey, legacy);
            localStorage.removeItem(PENDING_STATE_KEY);
          }
        } catch (error) {
          showToast(`Salinan pemulihan lokal tidak dapat dibaca: ${error.message}`, true);
          return null;
        }
      }
    }
    if (!stored) return null;
    try {
      const envelope = JSON.parse(stored);
      const snapshot = envelope?.state && typeof envelope.state === "object" ? envelope.state : envelope;
      const storedCode = String(envelope?.schoolCode || snapshot?.school?.code || "").toUpperCase();
      if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.accounts)) throw new Error("Struktur salinan pemulihan tidak valid.");
      if (storedCode !== normalizedCode) return null;
      pendingStateRecoveryKey = scopedKey;
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
    menu.innerHTML = `<div class="topbar-profile-summary">${avatar}<div><b>${esc(activeUser.name)}</b><small>${esc(activeUser.role)}</small></div></div><div class="topbar-profile-email">${esc(activeUser.email)}</div><button class="topbar-profile-action" type="button" role="menuitem" data-profile-action="edit-profile"><i data-lucide="user-round-pen"></i>Edit profil</button><button class="topbar-profile-action" type="button" role="menuitem" data-profile-action="terms"><i data-lucide="file-check-2"></i>Syarat &amp; SLA</button><button class="topbar-profile-action" type="button" role="menuitem" data-profile-action="manuals"><i data-lucide="circle-help"></i>Petunjuk pengguna</button><button class="topbar-profile-action topbar-profile-logout" type="button" role="menuitem" data-profile-action="logout"><i data-lucide="log-out"></i>Keluar</button>`;
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
  }

  function showTenantPortalInfo(type) {
    if (type === "terms") {
      const terms = esc(tenantPortalContent.terms || "Ketentuan layanan belum tersedia.").replace(/\n/g, "<br>");
      const sla = esc(tenantPortalContent.sla || "Informasi SLA belum tersedia.").replace(/\n/g, "<br>");
      showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="tenantTermsTitle"><div class="modal-header"><div><h2 id="tenantTermsTitle">Syarat &amp; SLA</h2><p>Ketentuan layanan platform Sarprah</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="settings-card"><h3>Syarat penggunaan</h3><p>${terms}</p></div><div class="settings-card mt-4"><h3>Tingkat layanan (SLA)</h3><p>${sla}</p></div></section></div>`, true);
      return;
    }
    const manuals = tenantPortalContent.manuals || [];
    const content = manuals.length ? `<label class="field-label">Pilih petunjuk<select id="tenantManualSelect">${manuals.map((manual, index) => `<option value="${index}">${esc(manual.title)}</option>`).join("")}</select></label><div id="tenantManualFrame" class="tenant-manual-frame"></div>` : `<div class="empty-state"><i data-lucide="book-open"></i>Belum ada petunjuk pengguna.</div>`;
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal modal-wide tenant-manual-modal" role="dialog" aria-modal="true" aria-labelledby="tenantManualTitle"><div class="modal-header"><div><h2 id="tenantManualTitle">Petunjuk pengguna</h2><p>Panduan yang disediakan oleh pengelola platform.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div>${content}</section></div>`, true);
    const select = $("#tenantManualSelect");
    const frame = $("#tenantManualFrame");
    if (!select || !frame) return;
    const renderManual = () => {
      const manual = manuals[Number(select.value)];
      frame.innerHTML = tenantManualContent(manual);
    };
    select.addEventListener("change", renderManual);
    renderManual();
  }
  function tenantManualContent(manual) {
    let url;
    try {
      url = new URL(manual.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("URL petunjuk tidak aman.");
      if (manual.type !== "link") {
        if (url.hostname === "youtu.be") url = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`);
        else if (url.hostname.endsWith("youtube.com") && url.pathname === "/watch" && url.searchParams.has("v")) url = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.searchParams.get("v"))}`);
      }
    } catch {
      return `<p class="form-help">Tautan petunjuk tidak valid.</p>`;
    }
    if (manual.type === "link") return `<a class="btn-quiet" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Buka petunjuk</a>`;
    return `<iframe title="${esc(manual.title)}" src="${esc(url.href)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
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
    const activeCode = String(localStorage.getItem(ACTIVE_SCHOOL_CODE_KEY) || "").toUpperCase();
    const cachedCode = String(localStorage.getItem(CACHED_STATE_SCHOOL_CODE_KEY) || "").toUpperCase();
    if (activeCode && activeCode !== cachedCode) {
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
    if (typeof state.settings.appTagline !== "string") {
      state.settings.appTagline = "School asset manager";
      changed = true;
    }
    if (typeof state.settings.appLogo !== "string") {
      state.settings.appLogo = "";
      changed = true;
    }
    return changed;
  }

  function ensureTypeClassificationRemoved() {
    let changed = false;
    (Array.isArray(state.types) ? state.types : []).forEach((type) => {
      if (Object.prototype.hasOwnProperty.call(type, "type")) {
        delete type.type;
        changed = true;
      }
    });
    return changed;
  }

  function ensureLoanReceiptDefaults() {
    let changed = false;
    const settings = state.settings || (state.settings = {});
    if (typeof settings.loanReceiptNumberFormat !== "string" || !settings.loanReceiptNumberFormat.trim()) {
      settings.loanReceiptNumberFormat = defaultLoanReceiptNumberFormat;
      changed = true;
    }
    const loans = Array.isArray(state.loans) ? state.loans : [];
    const highestSequence = () => loans.reduce((highest, loan) => {
      const sequence = Number(loan.transactionSequence);
      return Number.isInteger(sequence) && sequence > highest ? sequence : highest;
    }, 0);
    let nextSequence = highestSequence() + 1;
    [...loans]
      .filter((loan) => !Number.isInteger(Number(loan.transactionSequence)) || Number(loan.transactionSequence) < 1)
      .sort((left, right) => String(left.startDate || "").localeCompare(String(right.startDate || "")))
      .forEach((loan) => {
        loan.transactionSequence = nextSequence;
        nextSequence += 1;
        changed = true;
      });
    loans.forEach((loan) => {
      if (!loan.transactionNo) {
        loan.transactionNo = formatLoanReceiptNumber(loan.transactionSequence, loan.startDate, settings.loanReceiptNumberFormat);
        changed = true;
      }
    });
    const requiredNextSequence = highestSequence() + 1;
    const configuredNextSequence = Number(settings.loanReceiptNextSequence);
    if (!Number.isInteger(configuredNextSequence) || configuredNextSequence < requiredNextSequence) {
      settings.loanReceiptNextSequence = requiredNextSequence;
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
        copy.initialQuantity = copy.quantity;
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
      customHeaderLines: Array.from({ length: 5 }, (_, index) => {
        const legacyLine = (typeof current.customHeaderText === "string" ? current.customHeaderText.split(/\r?\n/) : [])[index] || "";
        const line = Array.isArray(current.customHeaderLines) ? current.customHeaderLines[index] : null;
        const size = Number(line?.fontSize ?? 16);
        return {
          text: typeof line?.text === "string" ? line.text : legacyLine,
          fontSize: Number.isFinite(size) ? Math.max(10, Math.min(48, Math.round(size))) : 16,
          bold: typeof line?.bold === "boolean" ? line.bold : index === 0
        };
      }),
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

  function ensureWorkspaceCollections() {
    let changed = false;
    ["activityLogs", "trash", "helpTickets", "maintenanceHistory", "assetMovements"].forEach((key) => {
      if (!Array.isArray(state[key])) {
        state[key] = [];
        changed = true;
      }
    });
    (state.goods || []).forEach((good) => {
      if (!Number.isFinite(Number(good.initialQuantity))) {
        good.initialQuantity = Math.max(0, Number(good.quantity) || 0);
        changed = true;
      }
    });
    return changed;
  }

  function ensureLocationDefaults() {
    if (!Array.isArray(state.locations)) {
      state.locations = [];
      return true;
    }
    let changed = false;
    const usedCodesByYear = new Map();
    state.locations = state.locations.map((location) => {
      const academicYearId = location.academicYearId || currentAcademicYearId();
      const usedCodes = usedCodesByYear.get(academicYearId) || new Set();
      const currentCode = String(location.code || "").trim();
      const normalizedCode = currentCode.toUpperCase();
      const code = !currentCode || usedCodes.has(normalizedCode)
        ? nextLocationCode(academicYearId, [...usedCodes])
        : currentCode;
      usedCodes.add(code.toUpperCase());
      usedCodesByYear.set(academicYearId, usedCodes);
      const numberOrEmpty = (value) => value === "" || value == null || !Number.isFinite(Number(value))
        ? ""
        : Math.max(0, Number(value));
      const length = numberOrEmpty(location.length);
      const width = numberOrEmpty(location.width);
      const savedStatus = String(location.status || "").toLocaleLowerCase("id-ID");
      const status = ["nonaktif", "nonaktifkan", "inactive"].includes(savedStatus) ? "Nonaktif" : "Aktif";
      const next = {
        ...location,
        code,
        floor: numberOrEmpty(location.floor),
        length,
        width,
        area: calculatedRoomArea(length, width),
        status
      };
      if (JSON.stringify(location) !== JSON.stringify(next)) changed = true;
      return next;
    });
    return changed;
  }

  function applyAppBranding() {
    ensureBrandingDefaults();
    const theme = themePalette[state.settings.themeColor] || themePalette.orange;
    document.documentElement.style.setProperty("--theme-primary", theme.primary);
    document.documentElement.style.setProperty("--theme-dark", theme.dark);
    document.documentElement.style.setProperty("--theme-soft", theme.soft);
    const appName = state.settings.appName.trim() || "Sarprah";
    const appLogo = state.settings.appLogo;
    document.title = `${appName} — Manajemen Sarana & Prasarana`;
    $$("[data-app-name]").forEach((node) => { node.textContent = appName; });
    $$("[data-app-tagline]").forEach((node) => { node.textContent = state.settings.appTagline; });
    $$("[data-app-brand]").forEach((node) => {
      node.classList.toggle("has-app-logo", Boolean(appLogo));
      node.innerHTML = appLogo ? `<img class="app-brand-logo" src="${esc(appLogo)}" alt="${esc(appName)}">` : `<i data-lucide="boxes"></i>`;
    });
    const favicon = $("#appFavicon");
    if (appLogo) {
      favicon.href = appLogo;
      favicon.type = appLogo.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));/)?.[1] || "image/png";
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
        const synced = await persistState();
        syncProfile();
        renderPage();
        closeModal();
        showToast(synced
          ? "Profil akun berhasil diperbarui."
          : "Profil tersimpan di perangkat ini dan akan disinkronkan otomatis saat koneksi pulih atau Administrator masuk kembali.", !synced);
      } catch (error) { showToast(`Profil gagal disimpan: ${error.message}`, true); }
    });
  }

  async function persistState() {
    ensureGoodBarcodes();
    storeLocalStateSafely();
    return syncStateToServer();
  }

  async function persistAccounts() {
    storeLocalStateSafely();
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
      apiAvailable = true;
      localStateCacheError = "";
      pendingStateCacheError = "";
      stateSyncWarningShown = false;
      if (persistedStateSnapshot) persistedStateSnapshot.accounts = structuredClone(state.accounts);
    } catch (error) {
      handleStateSyncFailure(0, error.message);
      return false;
    }
    return true;
  }

  function saveState() {
    ensureGoodBarcodes();
    storeLocalStateSafely();
    void syncStateToServer();
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
        persistedStateSnapshot = structuredClone(result.state);
        Object.assign(state, result.state);
      }
      else {
        persistedStateSnapshot = null;
        loadLocalStateForCurrentSchool();
        saveState();
      }
    } catch {
      apiAvailable = false;
      persistedStateSnapshot = null;
      try { loadLocalStateForCurrentSchool(); }
      catch (error) { showToast(`Data lokal tidak dapat dibaca: ${error.message}`, true); }
    }
    const ownershipsChanged = ensureOwnershipDefaults();
    const typeClassificationChanged = ensureTypeClassificationRemoved();
    const goodsOnlyTransactionsChanged = ensureGoodsOnlyTransactionDefaults();
    const rolesChanged = normalizeAccountRoles();
    const permissionsChanged = ensurePermissionDefaults();
    const brandingChanged = ensureBrandingDefaults();
    const loanReceiptDefaultsChanged = ensureLoanReceiptDefaults();
    const workspaceCollectionsChanged = ensureWorkspaceCollections();
    if (needsBootstrap && apiAvailable) {
      try { await persistState(); }
      catch (error) {
        apiAvailable = false;
        showToast(`Data awal gagal disimpan ke SQLite: ${error.message}`, true);
      }
    } else if (ownershipsChanged || typeClassificationChanged || goodsOnlyTransactionsChanged || rolesChanged || permissionsChanged || brandingChanged || loanReceiptDefaultsChanged || workspaceCollectionsChanged) saveState();
    else if (apiAvailable) {
      storeLocalStateSafely();
    }
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
      repairTickets: "Tiket", maintenanceCalendar: "Kalender", assetMovements: "Pindah",
      waNotifications: "WA",
      loans: "Pinjam", procurements: "Beli", disposals: "Pemusnahan",
      depreciations: "Susut", reports: "Laporan", activityLog: "Aktivitas", trash: "Sampah",
      helpTickets: "Bantuan", userGuide: "Panduan", accounts: "Akun", backup: "Backup"
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
    if (key === "fileManager") return activeUser?.role === "Administrator";
    if (key === "subscriptionBilling" || key === "theme") return Boolean(activeUser);
    if (tenantFeatureAccess[key] === false) return false;
    return activeUser?.role === "Administrator" || pagePermission(activeUser?.role, key) !== "hidden";
  }

  async function loadTenantPortalContent() {
    try {
      const response = await fetch("/api/tenant/portal-content");
      if (!response.ok) return;
      tenantPortalContent = await response.json();
    } catch (error) {
      console.error("Konten portal sekolah tidak dapat dimuat:", error);
    }
  }
  function registrationPhoneKey(value) {
    let number = String(value || "").replace(/\D/g, "");
    if (number.startsWith("0")) number = `62${number.slice(1)}`;
    else if (number.startsWith("8")) number = `62${number}`;
    return number;
  }
  async function loadRegistrationOptions() {
    try {
      const response = await fetch("/api/auth/registration-options");
      if (!response.ok) throw new Error("Pengaturan pendaftaran tidak dapat dimuat.");
      const options = await response.json();
      registrationOtpRequired = options.whatsappOtpRequired === true;
      $("#registrationOtpPanel").classList.toggle("hidden", !registrationOtpRequired);
      const codeInput = $("#schoolRegistrationForm").elements.otpCode;
      codeInput.required = registrationOtpRequired;
      if (!registrationOtpRequired) {
        registrationOtpSentPhone = "";
        $("#registrationOtpCodeField").classList.add("hidden");
      }
    } catch (error) {
      $("#registrationResult").textContent = error.message || "Pengaturan pendaftaran tidak dapat dimuat.";
    }
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
    else if (page === "repairTickets") root.innerHTML = renderRepairTickets();
    else if (page === "maintenanceCalendar") root.innerHTML = renderMaintenanceCalendar();
    else if (page === "assetMovements") root.innerHTML = renderAssetMovements();
    else if (page === "reports") root.innerHTML = renderReports();
    else if (page === "activityLog") root.innerHTML = renderActivityLog();
    else if (page === "trash") root.innerHTML = renderTrash();
    else if (page === "helpTickets") root.innerHTML = renderHelpTickets();
    else if (page === "userGuide") root.innerHTML = renderUserGuide();
    else if (page === "termsSla") root.innerHTML = renderTermsSla();
    else if (page === "subscriptionBilling") root.innerHTML = renderTenantBilling();
    else if (page === "theme") root.innerHTML = renderTheme();
    else if (page === "fileManager") root.innerHTML = renderFileManager();
    else if (page === "accounts") root.innerHTML = renderAccounts();
    else if (page === "publicPortal") root.innerHTML = renderPublicPortal();
    else if (page === "waNotifications") root.innerHTML = renderWhatsAppNotifications();
    else if (page === "backup") root.innerHTML = renderBackup();
    else root.innerHTML = renderCollection(page);
    if (window.lucide) lucide.createIcons({ nodes: [root] });
    if (page === "dashboard") drawChart();
    if (page === "barcode") drawBarcodes();
    if (page === "publicPortal") drawPublicPortalQr();
    bindPageEvents();
    if (page === "backup") loadTelegramSettings();
    if (page === "subscriptionBilling") loadTenantBilling();
    if (page === "dashboard" || page === "fileManager") loadStorageUsage();
    if (page === "publicPortal") bindPublicPortalSettings();
    if (page === "waNotifications") loadWhatsAppNotificationSettings();
    if (page === "checkGoods") {
      setupGoodsCheck();
      startGoodsCheckCamera();
    }
  }

  function renderTenantAnnouncements() {
    const dropdown = $("#notificationDropdown");
    if (!dropdown) return;
    const announcements = tenantPortalContent.announcements || [];
    const maintenance = upcomingMaintenanceReminders().slice(0, 5);
    const lowStock = lowStockBhpGoods().slice(0, 5);
    const hasNotifications = announcements.length || maintenance.length || lowStock.length;
    dropdown.innerHTML = `<b>Notifikasi</b>${announcements.length
      ? `<div class="tenant-announcement-list">${announcements.map((entry) => `<article class="tenant-announcement"><strong>${esc(entry.title || "Pengumuman")}</strong><p>${esc(entry.message || "")}</p></article>`).join("")}</div>` : ""}
      ${maintenance.length ? `<div class="tenant-notification-group"><strong>Pengingat servis</strong>${maintenance.map((schedule) => `<article class="tenant-maintenance-notification"><span class="notification-date">${esc(niceDate(schedule.reminderDate))}</span><div><b>${esc(titleOfGood(schedule.goodId))}</b><small>${esc(schedule.status || "Menunggu Jadwal")} · ${esc(schedule.type)}</small></div></article>`).join("")}</div>` : ""}
      ${lowStock.length ? `<div class="tenant-notification-group"><strong class="tenant-low-stock-heading">Stok BHP menipis</strong>${lowStock.map((good) => {
        const alert = bhpStockAlert(good);
        return `<article class="tenant-stock-notification"><div><b>${esc(good.name)}</b><small>${alert.consumedPercent}% stok awal terpakai · ${integerId.format(alert.remaining)} tersisa</small></div>${canEditPage("procurements") ? `<button type="button" class="btn-quiet" data-action="low-stock-procurement" data-good-id="${esc(good.id)}">Ajukan</button>` : ""}</article>`;
      }).join("")}</div>` : ""}
      ${hasNotifications ? "" : `<div class="notification-empty"><i data-lucide="bell-off"></i><span>Tidak ada notifikasi</span></div>`}`;
    if (window.lucide) lucide.createIcons({ nodes: [dropdown] });
    dropdown.onclick = (event) => {
      const button = event.target.closest('[data-action="low-stock-procurement"]');
      if (button) openLowStockProcurement(button.dataset.goodId);
    };
  }

  function renderDashboard() {
    const thisMonth = (date) => String(date || "").startsWith(currentMonth);
    const loansMonth = state.loans.filter((row) => thisMonth(row.startDate)).length;
    const procMonth = state.procurements.filter((row) => thisMonth(row.date)).length;
    const disposalMonth = state.disposals.filter((row) => thisMonth(row.date)).length;
    const itemsTotal = state.items.length;
    const damaged = state.items.filter((row) => row.condition === "Rusak" || row.condition === "Rusak Berat").length;
    const outstanding = state.loans.filter((row) => ["Diterima", "Pengajuan"].includes(row.status)).length;
    const goods = recordsForAcademicYear("goods");
    const rooms = recordsForAcademicYear("locations");
    const goodsById = new Map(goods.map((good) => [good.id, good]));
    const goodCount = goods.length;
    const saranaAssets = goods;
    const saranaGoods = saranaAssets.reduce((total, good) => total + Math.max(0, Number(good.quantity) || 0), 0);
    const saranaAvailable = saranaAssets.reduce((total, good) => {
      const quantity = Math.max(0, Number(good.quantity) || 0);
      const hasConditionCount = Object.prototype.hasOwnProperty.call(good, "goodConditionCount")
        && good.goodConditionCount !== "" && good.goodConditionCount != null
        && Number.isFinite(Number(good.goodConditionCount));
      const available = hasConditionCount
        ? Number(good.goodConditionCount)
        : quantity;
      return total + Math.min(quantity, Math.max(0, available));
    }, 0);
    const activeRooms = rooms.filter((room) => room.status === "Aktif").length;
    const roomsDamagedMedium = rooms.filter((room) => room.condition === "Rusak Sedang").length;
    const roomsDamagedHeavy = rooms.filter((room) => room.condition === "Rusak Berat").length;
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const lateRows = state.loans.filter((row) => row.status === "Diterima" && loanLateDays(row) > 0).slice(0, 4);
    const procurements = state.procurements.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const stat = (label, value, icon, tone, foot) => `<div class="summary-card"><div class="summary-top">${label}<span class="summary-icon ${tone}"><i data-lucide="${icon}"></i></span></div><div class="summary-value">${value}</div><div class="summary-foot"><span class="trend-up">${foot}</span> bulan ini</div></div>`;
    return `${pageHeading()}
      <div class="stats-row">${stat("Total Peminjaman Bulan Ini", loansMonth, "arrow-left-right", "orange", "+12%")}${stat("Total Pengadaan Bulan Ini", procMonth, "shopping-bag", "blue", "+8%")}${stat("Total Pemusnahan Bulan Ini", disposalMonth, "archive-x", "green", `${disposalMonth} item`)}</div>
      <div class="indicator-grid">
        ${indicator("Total Barang", goodCount, "package", "coral", "Master barang terdaftar")}
        ${indicator("Item Rusak", damaged, "triangle-alert", "blue", `${itemsTotal ? Math.round(damaged / itemsTotal * 100) : 0}% dari item terdata`)}
        ${indicator("Item Belum Kembali", outstanding, "clock-3", "amber", "Peminjaman aktif")}
      </div>
      <div class="indicator-grid">
        ${indicator("Total Prasarana", rooms.length, "building-2", "coral", `${activeRooms} ruang aktif`, "locations")}
        ${indicator("Rusak Sedang", roomsDamagedMedium, "triangle-alert", "amber", "Kondisi ruangan", "locations")}
        ${indicator("Rusak Berat", roomsDamagedHeavy, "triangle-alert", "blue", "Kondisi ruangan", "locations")}
      </div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h3>Statistik Jumlah Sarana dan Prasarana</h3><p>Tren item sarana; prasarana mengikuti jumlah ruang pada tahun pelajaran ini</p></div><div><select class="chart-select" id="chartPeriod"><option value="12" ${chartPeriod === "12" ? "selected" : ""}>12 bulan terakhir</option><option value="6" ${chartPeriod === "6" ? "selected" : ""}>6 bulan terakhir</option></select></div></div><div class="chart-legend"><span><i class="legend-dot"></i>Sarana</span><span><i class="legend-dot blue"></i>Prasarana</span></div><div class="chart-wrap"><canvas id="inventoryChart"></canvas></div></section>
      <section class="panel"><div class="panel-heading"><div><h3>Ketersediaan Sarana & Prasarana</h3><p>Item sarana baik dan ruang dengan status aktif</p></div><i data-lucide="chart-no-axes-combined" class="muted"></i></div>
        <div class="availability-row"><div class="availability-label"><b>Prasarana tersedia</b><span>${activeRooms} / ${rooms.length} ruang · ${pct(activeRooms, rooms.length)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct(activeRooms, rooms.length)}%"></div></div></div>
        <div class="availability-row"><div class="availability-label"><b>Sarana tersedia</b><span>${saranaAvailable} / ${saranaGoods} item · ${pct(saranaAvailable, saranaGoods)}%</span></div><div class="progress-track"><div class="progress-fill blue" style="width:${pct(saranaAvailable, saranaGoods)}%"></div></div></div>
        <div style="margin-top:20px;padding:12px;border-radius:9px;background:#fff8f1;display:flex;gap:10px;align-items:flex-start"><i data-lucide="lightbulb" style="color:#e98939;width:17px;height:17px"></i><div><b style="font-size:10px">Catatan inventaris</b><p style="font-size:9px;color:#8d95a2;margin:4px 0 0;line-height:1.55">Periksa berkala item rusak agar pemeliharaan dan pengadaan dapat direncanakan tepat waktu.</p></div></div>
      </section></div>
      <div class="dashboard-tables">
        <section class="panel"><div class="panel-heading"><div><h3>Daftar Barang Belum Kembali</h3><p>Peminjaman yang melewati tanggal pengembalian</p></div><button class="btn-quiet" data-nav="loans">Lihat semua <i data-lucide="arrow-right"></i></button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>PEMINJAM</th><th>BARANG</th><th>TERLAMBAT</th><th>STATUS</th></tr></thead><tbody>${lateRows.length ? lateRows.map((row) => `<tr><td><span class="table-title">${esc(row.borrower)}</span></td><td>${esc(titleOfGood(row.goodId))}</td><td><span class="badge danger">Terlambat ${loanLateDays(row)} hari</span></td><td>${statusBadge(displayedStatus("loans", row.status))}</td></tr>`).join("") : `<tr><td colspan="4" class="empty-state">Tidak ada barang yang terlambat dikembalikan.</td></tr>`}</tbody></table></div></section>
        <section class="panel"><div class="panel-heading"><div><h3>Pengadaan</h3><p>Ringkasan usulan terbaru</p></div><select class="chart-select" id="dashboardProcFilter"><option value="Semua">Semua</option><option value="Mendesak">Mendesak</option><option value="Normal">Normal</option></select></div><div class="table-wrap"><table class="data-table"><thead><tr><th>NAMA PENGADAAN</th><th>PRIORITAS</th><th>NOMINAL</th></tr></thead><tbody id="dashboardProcRows">${procurementDashboardRows(procurements)}</tbody></table></div></section>
      </div><div class="dashboard-grid">${renderDashboardMaintenanceReminders()}${renderDashboardBhpAlerts()}</div>
      <div class="dashboard-storage-footer">${storageUsageMarkup()}</div>`;
  }

  function renderDashboardMaintenanceReminders() {
    const reminders = upcomingMaintenanceReminders().slice(0, 5);
    const rows = reminders.map((schedule) => `<article class="dashboard-maintenance-row"><div class="dashboard-reminder-date"><b>${esc(niceDate(schedule.reminderDate))}</b><span>${esc(schedule.status || "Menunggu Jadwal")}</span></div><div class="dashboard-reminder-copy"><strong>${esc(titleOfGood(schedule.goodId))}</strong><small>${esc(schedule.type)} · ${integerId.format(Number(schedule.quantity) || 0)} unit${Number(schedule.estimatedCost) > 0 ? ` · ${esc(rupiah(schedule.estimatedCost))}` : ""}</small></div>${canEditPage("maintenanceCalendar") ? `<button class="mini-action" title="Ubah jadwal servis" data-action="edit-calendar-schedule" data-id="${esc(schedule.id)}"><i data-lucide="pencil"></i></button>` : ""}</article>`).join("");
    return `<section class="panel dashboard-maintenance-panel"><div class="panel-heading"><div><h3>Pengingat Servis Berikutnya</h3><p>Jadwal dalam 30 hari dan servis yang perlu ditindaklanjuti</p></div><span class="badge ${reminders.length ? "warning" : "success"}">${reminders.length}</span></div><div class="dashboard-reminder-list">${rows || `<div class="dashboard-reminder-empty"><i data-lucide="calendar-check"></i>Tidak ada servis yang perlu diingatkan.</div>`}</div>${canViewPage("maintenanceCalendar") ? `<button class="btn-quiet dashboard-reminder-link" data-nav="maintenanceCalendar">Buka kalender <i data-lucide="arrow-right"></i></button>` : ""}</section>`;
  }

  function renderDashboardBhpAlerts() {
    const alerts = lowStockBhpGoods().slice(0, 5);
    const rows = alerts.map((good) => {
      const alert = bhpStockAlert(good);
      return `<article class="dashboard-low-stock-row"><div class="dashboard-low-stock-icon"><i data-lucide="triangle-alert"></i></div><div class="dashboard-reminder-copy"><strong>${esc(good.name)}</strong><small>${integerId.format(alert.remaining)} dari ${integerId.format(alert.initial)} tersisa · ${alert.consumedPercent}% terpakai</small></div>${canEditPage("procurements") ? `<button class="btn-secondary" data-action="low-stock-procurement" data-good-id="${esc(good.id)}"><i data-lucide="shopping-cart"></i>Ajukan pengadaan</button>` : ""}</article>`;
    }).join("");
    return `<section class="panel dashboard-low-stock-panel"><div class="panel-heading"><div><h3>Peringatan Stok BHP</h3><p>Peringatan muncul setelah 70% stok awal terpakai</p></div><span class="badge ${alerts.length ? "danger" : "success"}">${alerts.length}</span></div><div class="dashboard-reminder-list">${rows || `<div class="dashboard-reminder-empty"><i data-lucide="package-check"></i>Stok BHP masih mencukupi.</div>`}</div></section>`;
  }

  function renderActivityLog() {
    const rows = state.activityLogs || [];
    const body = rows.length ? rows.map((entry) => {
      const timestamp = new Date(entry.timestamp);
      const date = Number.isFinite(timestamp.getTime())
        ? timestamp.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";
      const search = [entry.actor, entry.action, entry.entity, entry.detail].join(" ").toLocaleLowerCase("id-ID");
      return `<tr data-activity-search="${esc(search)}"><td>${esc(date)}</td><td>${esc(entry.actor || "Sistem")}</td><td><span class="activity-action">${esc(entry.action)}</span></td><td>${esc(entry.entity)}</td><td>${esc(entry.detail)}</td></tr>`;
    }).join("") : `<tr><td colspan="5"><div class="empty-state"><i data-lucide="history"></i>Belum ada aktivitas tercatat.</div></td></tr>`;
    return `${pageHeading()}<section class="settings-card"><div class="activity-log-toolbar"><p>Menampilkan hingga 500 aktivitas terbaru.</p><label class="search-field"><i data-lucide="search"></i><input id="activityLogSearch" type="search" placeholder="Cari aktivitas..."></label></div><div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr><th>WAKTU</th><th>PENGGUNA</th><th>AKTIVITAS</th><th>MENU</th><th>KETERANGAN</th></tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>${rows.length} aktivitas</span></div></div></section>`;
  }

  function trashRecordLabel(record) {
    return record?.name || record?.title || record?.ticketNo || record?.borrower || record?.applicant || record?.code || record?.date || "Data";
  }

  function renderTrash() {
    const records = (state.trash || []).slice().sort((a, b) => String(b.deletedAt || "").localeCompare(String(a.deletedAt || "")));
    const body = records.length ? records.map((entry) => {
      const timestamp = new Date(entry.deletedAt);
      const deletedAt = Number.isFinite(timestamp.getTime())
        ? timestamp.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";
      const collectionLabel = collectionConfig[entry.collection]?.title || meta[entry.collection]?.[0] || entry.collection;
      return `<tr><td><span class="table-title">${esc(trashRecordLabel(entry.record))}</span></td><td>${esc(collectionLabel)}</td><td>${esc(entry.deletedBy || "Sistem")}</td><td>${esc(deletedAt)}</td><td><div class="action-buttons">${canEditPage("trash") ? `<button class="btn-quiet" data-action="restore-trash" data-id="${esc(entry.id)}"><i data-lucide="rotate-ccw"></i>Pulihkan</button>` : ""}${canDeletePage("trash") ? `<button class="mini-action" title="Hapus permanen" data-action="permanent-delete-trash" data-id="${esc(entry.id)}"><i data-lucide="trash-2"></i></button>` : ""}</div></td></tr>`;
    }).join("") : `<tr><td colspan="5"><div class="empty-state"><i data-lucide="trash-2"></i>Kotak sampah kosong.</div></td></tr>`;
    return `${pageHeading()}<section class="settings-card"><div class="trash-note"><i data-lucide="info"></i><span>Data di sini tidak lagi tampil di menu asal. Pulihkan untuk mengembalikannya, atau hapus permanen jika sudah tidak diperlukan.</span></div><div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr><th>NAMA DATA</th><th>ASAL MENU</th><th>DIHAPUS OLEH</th><th>WAKTU DIHAPUS</th><th>AKSI</th></tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>${records.length} data di kotak sampah</span></div></div></section>`;
  }

  function renderHelpTickets() {
    const isAdministrator = activeUser?.role === "Administrator";
    const tickets = (state.helpTickets || [])
      .filter((ticket) => isAdministrator || ticket.createdBy === activeUser?.id)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const statusClass = (status) => status === "Selesai" ? "success" : status === "Diproses" ? "info" : "neutral";
    const cards = tickets.map((ticket) => {
      const nextStatus = ticket.status === "Baru" ? "Diproses" : ticket.status === "Diproses" ? "Selesai" : "";
      return `<article class="help-ticket-card"><div class="help-ticket-heading"><div><span class="help-ticket-number">${esc(ticket.ticketNo)}</span><h3>${esc(ticket.title)}</h3></div><span class="badge ${statusClass(ticket.status)}">${esc(ticket.status)}</span></div><p>${esc(ticket.description)}</p><div class="help-ticket-meta"><span>${esc(ticket.category)}</span><span>${esc(ticket.requester)}</span><span>${esc(niceDate(String(ticket.createdAt || "").slice(0, 10)))}</span></div>${isAdministrator && nextStatus ? `<button class="btn-quiet" data-action="help-ticket-status" data-id="${esc(ticket.id)}" data-status="${nextStatus}">${nextStatus === "Diproses" ? "Mulai diproses" : "Tandai selesai"}</button>` : ""}</article>`;
    }).join("");
    const addAction = canEditPage("helpTickets") ? `<button class="btn-primary" data-action="new-help-ticket"><i data-lucide="plus"></i>Buat tiket kendala</button>` : "";
    return `${pageHeading(addAction)}<section class="help-intro-grid"><article class="settings-card"><span class="help-card-icon"><i data-lucide="book-open"></i></span><h3>Petunjuk Pengguna</h3><p>Pelajari cara mengelola inventaris, transaksi, dan laporan.</p><button class="btn-quiet" data-nav="userGuide">Buka petunjuk <i data-lucide="arrow-right"></i></button></article><article class="settings-card"><span class="help-card-icon support"><i data-lucide="headset"></i></span><h3>Hubungi sekolah</h3><p>${esc(state.school?.phone || "Nomor telepon belum diatur")}<br>${esc(state.school?.email || "Email belum diatur")}</p></article></section><section class="settings-card"><div class="panel-heading"><div><h3>Tiket Kendala</h3><p>${isAdministrator ? "Tiket yang dikirim pengguna aplikasi." : "Pantau tiket kendala yang Anda kirim."}</p></div></div><div class="help-ticket-list">${cards || `<div class="empty-state"><i data-lucide="messages-square"></i>Belum ada tiket kendala.</div>`}</div></section>`;
  }

  function renderUserGuide() {
    const manuals = tenantPortalContent.manuals || [];
    const content = manuals.length
      ? manuals.map((manual) => `<article class="settings-card tenant-manual-card"><h2>${esc(manual.title)}</h2><div class="tenant-manual-frame">${tenantManualContent(manual)}</div></article>`).join("")
      : `<section class="settings-card"><div class="empty-state"><i data-lucide="book-open"></i>Belum ada petunjuk pengguna dari Super Admin.</div></section>`;
    return `${pageHeading()}<section class="settings-card user-guide-intro"><span class="help-card-icon"><i data-lucide="book-open-check"></i></span><div><h3>Petunjuk pengguna</h3><p>Panduan resmi yang dikelola oleh Super Admin.</p></div></section><div class="user-guide-layout">${content}</div>`;
  }
  function renderTheme() {
    const selected = state.settings.themeColor || "orange";
    const options = Object.entries(themePalette).map(([id, theme]) => `<button type="button" class="theme-option ${selected === id ? "selected" : ""}" data-action="set-theme" data-theme="${id}" aria-pressed="${selected === id}"><span class="theme-swatch" style="--swatch:${theme.primary}"></span><span>${theme.label}</span>${selected === id ? `<i data-lucide="check"></i>` : ""}</button>`).join("");
    return `${pageHeading()}<section class="settings-card"><h3>Warna dasar</h3><p>Pilih warna yang digunakan pada navigasi dan tombol utama. Perubahan tersimpan pada akun sekolah ini.</p><div class="theme-options">${options}</div></section>`;
  }
  function embeddedImageFiles() {
    const files = [];
    const visit = (value, path = []) => {
      if (typeof value === "string") {
        const match = /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
        if (match) {
          const encoded = match[2];
          const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
          files.push({ path, data: value, mime: match[1], bytes: Math.max(0, Math.floor(encoded.length * 3 / 4) - padding) });
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, index]));
      } else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, entry]) => visit(entry, [...path, key]));
      }
    };
    visit(state);
    return files;
  }
  function formatStorageBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  function storageUsageSummary() {
    const localUsed = embeddedImageFiles().reduce((total, file) => total + file.bytes, 0);
    const quotaBytes = Number(storageUsageData?.quotaBytes) || 1024 * 1024 * 1024;
    const storedUsage = Number(storageUsageData?.usedBytes);
    const usedBytes = Number.isFinite(storedUsage) ? storedUsage : localUsed;
    return { usedBytes, quotaBytes, remainingBytes: Math.max(0, quotaBytes - usedBytes) };
  }
  function storageUsageMarkup() {
    const usage = storageUsageSummary();
    const percentage = Math.min(100, Math.round(usage.usedBytes / Math.max(1, usage.quotaBytes) * 100));
    return `<section id="dashboardStorageUsage" class="storage-usage-card"><div class="storage-usage-heading"><span><i data-lucide="hard-drive"></i></span><div><b>Penyimpanan Foto</b><small>${formatStorageBytes(usage.usedBytes)} terpakai dari ${formatStorageBytes(usage.quotaBytes)}</small></div><strong>${percentage}%</strong></div><div class="storage-usage-track"><div style="width:${percentage}%"></div></div><small>Sisa ${formatStorageBytes(usage.remainingBytes)}</small></section>`;
  }
  async function loadStorageUsage() {
    if (!apiAvailable) return;
    try {
      const response = await fetch("/api/tenant/storage");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      storageUsageData = await response.json();
      if (page === "dashboard") {
        const card = $("#dashboardStorageUsage");
        if (card) {
          card.outerHTML = storageUsageMarkup();
          const updatedCard = $("#dashboardStorageUsage");
          if (window.lucide && updatedCard) lucide.createIcons({ nodes: [updatedCard] });
        }
      } else if (page === "fileManager") {
        const root = $("#pageContent");
        root.innerHTML = renderFileManager();
        if (window.lucide) lucide.createIcons({ nodes: [root] });
        bindPageEvents();
      }
    } catch (error) {
      console.warn("Informasi penggunaan penyimpanan tidak dapat dimuat dari server:", error);
    }
  }
  function filePathLabel(path) {
    const labels = {
      school: "Profil sekolah", settings: "Pengaturan aplikasi", appLogo: "Logo aplikasi", logo: "Logo sekolah",
      letterheadLogo: "Logo kop surat", avatar: "Avatar akun", photo: "Foto kerusakan", evidence: "Foto bukti",
      repairTickets: "Tiket perbaikan", procurements: "Pengadaan", disposals: "Pemusnahan", accounts: "Akun pengguna"
    };
    let node = state;
    let owner = "";
    path.forEach((part) => {
      node = node?.[part];
      if (node && typeof node === "object" && !Array.isArray(node)) {
        owner = node.name || node.title || node.goodName || node.borrower || node.proposer || owner;
      }
    });
    const key = String(path[path.length - 1] || "");
    const parentKey = String(path[path.length - 2] || "");
    return `${labels[key] || labels[parentKey] || "Gambar"}${owner ? ` · ${owner}` : ""}`;
  }
  function renderFileManager() {
    const files = embeddedImageFiles();
    const usage = storageUsageSummary();
    const body = files.map((file, index) => `<article class="stored-file-card"><img src="${esc(file.data)}" alt=""><div><b>${esc(filePathLabel(file.path))}</b><small>${esc(file.mime)} · ${formatStorageBytes(file.bytes)}</small></div><button type="button" class="mini-action" title="Hapus file" aria-label="Hapus ${esc(filePathLabel(file.path))}" data-action="delete-stored-file" data-index="${index}"><i data-lucide="trash-2"></i></button></article>`).join("");
    return `${pageHeading()}<section class="settings-card"><h3>Penggunaan penyimpanan</h3><p>${formatStorageBytes(usage.usedBytes)} terpakai · ${formatStorageBytes(usage.remainingBytes)} tersisa dari ${formatStorageBytes(usage.quotaBytes)}.</p>${storageUsageMarkup()}</section><section class="settings-card"><h3>File gambar tersimpan</h3><p>Hapus foto yang tidak lagi diperlukan. Penghapusan hanya menghapus file gambar, bukan data transaksi atau inventaris terkait.</p><div class="stored-file-list">${body || `<div class="empty-state"><i data-lucide="images"></i>Tidak ada foto atau gambar tersimpan.</div>`}</div><div class="table-footer">${files.length} file gambar · ${formatStorageBytes(files.reduce((total, file) => total + file.bytes, 0))}</div></section>`;
  }
  function renderTermsSla() {
    const terms = esc(tenantPortalContent.terms || "Ketentuan layanan belum tersedia.").replace(/\r?\n/g, "<br>");
    const sla = esc(tenantPortalContent.sla || "Informasi SLA belum tersedia.").replace(/\r?\n/g, "<br>");
    return `${pageHeading()}<section class="settings-card"><h2>Syarat penggunaan</h2><p>${terms}</p></section><section class="settings-card mt-4"><h2>Tingkat layanan (SLA)</h2><p>${sla}</p></section><p class="form-help">Konten ini dikelola oleh Super Admin dan hanya dapat dibaca dari akun sekolah.</p>`;
  }
  function renderTenantBilling() {
    const data = tenantBillingData;
    const refresh = `<button type="button" class="btn-quiet" data-action="refresh-tenant-billing"><i data-lucide="refresh-cw"></i>Perbarui</button>`;
    if (!data || data.loading) return `${pageHeading(refresh)}<section class="settings-card"><div class="empty-state">Memuat informasi tagihan...</div></section>`;
    if (data.error) return `${pageHeading(refresh)}<section class="settings-card"><div class="empty-state">${esc(data.error)}</div></section>`;
    const gateways = data.gateways || [];
    const payments = (data.payments || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const rows = payments.map((payment) => {
      const payable = !["Disetujui", "Lunas"].includes(payment.status);
      const gatewayControl = payable && gateways.length
        ? `<div class="action-buttons"><select id="billingGateway-${esc(payment.id)}" aria-label="Pilih gateway pembayaran">${gateways.map((gateway) => `<option value="${esc(gateway.id)}" ${gateway.id === payment.gateway ? "selected" : ""}>${esc(gateway.name)}</option>`).join("")}</select><button type="button" class="btn-primary" data-action="create-payment-checkout" data-id="${esc(payment.id)}"><i data-lucide="external-link"></i>${payment.checkoutUrl ? "Buka / lanjutkan" : "Bayar"}</button></div>`
        : payable ? `<span class="muted">Gateway belum tersedia</span>` : "—";
      return `<tr><td>${esc(niceDate(String(payment.createdAt || payment.dueDate || "").slice(0, 10)))}</td><td>${esc(payment.period || "—")}</td><td>${rupiah(payment.amount || 0)}</td><td>${statusBadge(payment.status)}</td><td>${esc(payment.gatewayName || "—")}</td><td>${gatewayControl}</td></tr>`;
    }).join("");
    const helpText = gateways.length
      ? "Pilih satu gateway untuk membayar tagihan. Status lunas hanya diperbarui setelah callback pembayaran terverifikasi."
      : "Belum ada gateway otomatis yang diaktifkan oleh Super Admin. Hubungi administrator platform.";
    return `${pageHeading(refresh)}<section class="settings-card"><p>${esc(helpText)}</p><div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr><th>TANGGAL</th><th>PERIODE</th><th>NOMINAL</th><th>STATUS</th><th>GATEWAY</th><th>AKSI</th></tr></thead><tbody>${rows || `<tr><td colspan="6"><div class="empty-state">Belum ada tagihan.</div></td></tr>`}</tbody></table></div><div class="table-footer"><span>${payments.length} tagihan</span></div></div></section>`;
  }
  async function loadTenantBilling() {
    tenantBillingData = { loading: true };
    try {
      tenantBillingData = await api("/api/tenant/billing");
    } catch (error) {
      tenantBillingData = { error: error.message || "Tagihan tidak dapat dimuat." };
    }
    if (page === "subscriptionBilling") {
      const root = $("#pageContent");
      root.innerHTML = renderTenantBilling();
      if (window.lucide) lucide.createIcons({ nodes: [root] });
      bindPageEvents();
    }
  }
  async function createTenantCheckout(paymentId) {
    const select = document.getElementById(`billingGateway-${paymentId}`);
    const provider = select?.value;
    if (!provider) return showToast("Pilih gateway pembayaran terlebih dahulu.", true);
    try {
      const result = await api(`/api/tenant/billing/${encodeURIComponent(paymentId)}/checkout`, "POST", { provider });
      if (!result.checkoutUrl) throw new Error("Penyedia tidak mengembalikan tautan pembayaran.");
      window.location.assign(result.checkoutUrl);
    } catch (error) { showToast(error.message, true); }
  }

  function openHelpTicketForm() {
    if (!canEditPage("helpTickets")) return showToast("Akun Anda tidak memiliki izin membuat tiket kendala.", true);
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="helpTicketTitle"><div class="modal-header"><div><h2 id="helpTicketTitle">Buat tiket kendala</h2><p>Jelaskan kendala agar dapat ditindaklanjuti.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form id="helpTicketForm" class="modal-form"><div class="form-grid"><div class="form-field"><label for="helpTicketCategory">Kategori kendala *</label><select id="helpTicketCategory" name="category" required><option value="">Pilih kategori</option>${["Akun & akses", "Data barang", "Transaksi", "Laporan", "Lainnya"].map((category) => `<option>${category}</option>`).join("")}</select></div><div class="form-field"><label for="helpTicketSubject">Judul kendala *</label><input id="helpTicketSubject" name="title" type="text" maxlength="120" required></div><div class="form-field full"><label for="helpTicketDescription">Deskripsi kendala *</label><textarea id="helpTicketDescription" name="description" rows="5" maxlength="3000" required></textarea></div></div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="submit" class="btn-primary"><i data-lucide="send"></i>Kirim tiket</button></div></form></section></div>`);
  }

  function saveHelpTicket(event) {
    event.preventDefault();
    if (!canEditPage("helpTickets")) return showToast("Akun Anda tidak memiliki izin membuat tiket kendala.", true);
    const form = event.currentTarget;
    const title = form.elements.title.value.trim();
    const description = form.elements.description.value.trim();
    const category = form.elements.category.value;
    if (!title || !description || !category) return showToast("Lengkapi kategori, judul, dan deskripsi kendala.", true);
    const ticketSequence = Math.max(0, ...(state.helpTickets || []).map((ticket) => Number(ticket.ticketSequence) || 0)) + 1;
    const ticket = {
      id: id(),
      ticketSequence,
      ticketNo: `KND-${today.getFullYear()}-${String(ticketSequence).padStart(4, "0")}`,
      category,
      title,
      description,
      status: "Baru",
      createdAt: new Date().toISOString(),
      createdBy: activeUser?.id || "",
      requester: activeUser?.name || "Pengguna",
      requesterRole: activeUser?.role || ""
    };
    state.helpTickets.unshift(ticket);
    logActivity("Mengirim tiket", "Bantuan", `${ticket.ticketNo} · ${ticket.title}`);
    saveState();
    closeModal();
    showToast(`Tiket ${ticket.ticketNo} berhasil dikirim.`);
    renderPage();
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
    const exactGood = recordsForAcademicYear("goods").find((good) => String(good.barcode || "").toLocaleLowerCase("id-ID") === normalized);
    if (exactGood) return showGoodsCheckResult(exactGood.id);
    const exactItem = state.items.find((item) => currentGoodIds.has(item.goodId) && String(item.code || "").toLocaleLowerCase("id-ID") === normalized);
    if (exactItem) return showGoodsCheckResult(exactItem.goodId, exactItem.id);
    state.items.filter((item) => currentGoodIds.has(item.goodId) && String(item.code || "").toLocaleLowerCase("id-ID").includes(normalized))
      .forEach((item) => matches.push({ good: getById("goods", item.goodId), item }));
    recordsForAcademicYear("goods").filter((good) => [good.name, good.barcode].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(normalized)))
      .forEach((good) => { if (!matches.some((match) => match.good?.id === good.id)) matches.push({ good, item: null }); });
    const validMatches = matches.filter((match) => match.good);
    if (!validMatches.length) {
      $("#goodsCheckStatus").textContent = "Barang tidak ditemukan. Coba kode barcode atau nama barang lain.";
      $("#goodsCheckMatches").innerHTML = "";
      $("#goodsCheckResult").innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i>Tidak ada barang yang cocok dengan pencarian.</div>`;
      if (window.lucide) lucide.createIcons({ nodes: [$("#goodsCheckResult")] });
      return;
    }
    if (validMatches.length === 1) return showGoodsCheckResult(validMatches[0].good.id, validMatches[0].item?.id || "");
    $("#goodsCheckStatus").textContent = `Ditemukan ${validMatches.length} hasil. Pilih barang yang sesuai.`;
    $("#goodsCheckMatches").innerHTML = validMatches.map(({ good, item }) => `<button class="goods-check-match" type="button" data-check-good="${esc(good.id)}" data-check-item="${esc(item?.id || "")}"><i data-lucide="package"></i><span><b>${esc(good.name)}</b><small>${item ? `Kode item ${esc(item.code)}` : `${esc(good.barcode || "Kode belum tersedia")} · ${esc(good.quantity ?? 0)} ${esc(relatedName("units", good.unitId))} tersisa`}</small></span><i data-lucide="chevron-right"></i></button>`).join("");
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

  function indicator(label, value, icon, tone, foot, destination = "goods") {
    return `<div class="indicator-card" data-nav="${destination}"><span class="indicator-icon ${tone}"><i data-lucide="${icon}"></i></span><div><small>${label}</small><b>${value}</b><small style="margin:3px 0 0">${foot}</small></div></div>`;
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
        <div class="form-field"><label>Nomor WhatsApp Kepala Sekolah</label><input name="principalWhatsapp" type="tel" value="${esc(school.principalWhatsapp || "")}" placeholder="0812... atau +62812..."><small class="form-help">Dipakai untuk notifikasi pengajuan pengadaan.</small></div>
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
      const lines = (design.customHeaderLines || []).filter((line) => String(line.text || "").trim());
      const customText = lines.map((line) => `<div style="font-size:${Math.max(10, Math.min(48, Number(line.fontSize) || 16))}px;font-weight:${line.bold ? 800 : 500}">${esc(line.text)}</div>`).join("");
      return `${logo}<div class="print-school-copy print-custom-header-text">${customText}</div>`;
    }
    return `${logo}<div class="print-school-copy"><h1 style="${titleStyle}">${esc(school.name)}</h1><p>${esc(school.address)}</p>${contact ? `<p>${esc(contact)}</p>` : ""}</div>`;
  }

  function reportSignatures(school) {
    return `<div class="report-signatures"><div><span>Mengetahui,</span><p>Kepala Sekolah</p><b>${esc(school.principalName || "( _________________________ )")}</b>${school.principalNip ? `<small>NIP. ${esc(school.principalNip)}</small>` : ""}</div><div><span>${esc(school.city || "................")}, ${niceDate(dateOffset(0))}</span><p>Wakasek Sarpras</p><b>${esc(school.sarprasVicePrincipalName || "( _________________________ )")}</b>${school.sarprasVicePrincipalNip ? `<small>NIP. ${esc(school.sarprasVicePrincipalNip)}</small>` : ""}</div></div>`;
  }

  function renderPrintDesign() {
    const school = state.school || seed.school;
    const design = state.settings.printDesign || seed.settings.printDesign;
    const loanNumberFormat = state.settings.loanReceiptNumberFormat || defaultLoanReceiptNumberFormat;
    const loanNumberPreview = formatLoanReceiptNumber(Number(state.settings.loanReceiptNextSequence) || 1, dateOffset(0), loanNumberFormat);
    return `${pageHeading(canEditPage("printDesign") ? `<button class="btn-primary" type="submit" form="printDesignForm"><i data-lucide="save"></i>Simpan desain</button>` : "")}
      <form id="printDesignForm" class="settings-card"><h3>Desain kop, nomor surat, dan penandatangan</h3><p>Atur kop cetak, format nomor bukti peminjaman, dan informasi penandatangan.</p><div class="form-grid">
        <div class="form-field full"><label for="printHeaderMode">Sumber bagian atas kop</label><select id="printHeaderMode" name="headerMode"><option value="school" ${design.headerMode !== "custom" ? "selected" : ""}>Gunakan identitas sekolah</option><option value="custom" ${design.headerMode === "custom" ? "selected" : ""}>Ketik sendiri</option></select></div>
        <div id="printCustomHeaderOptions" class="form-field full ${design.headerMode === "custom" ? "" : "hidden"}"><label>Baris kop surat (maksimal 5 baris)</label><div class="custom-header-lines">${Array.from({ length: 5 }, (_, index) => {
          const line = design.customHeaderLines?.[index] || { text: "", fontSize: 16, bold: index === 0 };
          return `<div class="custom-header-line"><label for="customHeaderLine${index + 1}">Baris ${index + 1}</label><input id="customHeaderLine${index + 1}" data-header-line-text="${index}" type="text" maxlength="160" value="${esc(line.text)}" placeholder="Teks baris ${index + 1}"><label class="custom-header-size">Ukuran (px)<input data-header-line-size="${index}" type="number" min="10" max="48" step="1" value="${esc(line.fontSize)}"></label><label class="form-check custom-header-bold"><input data-header-line-bold="${index}" type="checkbox" ${line.bold ? "checked" : ""}><span>Tebal</span></label></div>`;
        }).join("")}</div><small class="form-help">Atur teks, ukuran font, dan ketebalan setiap baris. Baris kosong tidak ditampilkan.</small></div>
        <div id="printSchoolHeaderOptions" class="print-school-header-options ${design.headerMode === "custom" ? "hidden" : ""}">
          <label class="form-check"><input name="showNpsn" type="checkbox" ${design.showNpsn ? "checked" : ""}><span>Tampilkan NPSN</span></label>
          <label class="form-check"><input name="showContact" type="checkbox" ${design.showContact ? "checked" : ""}><span>Tampilkan telepon, email, dan website</span></label>
        </div>
        <div class="form-field ${design.headerMode === "custom" ? "hidden" : ""}"><label for="headerFontSize">Ukuran font bagian atas (px)</label><input id="headerFontSize" name="headerFontSize" type="number" min="10" max="48" step="1" value="${esc(design.headerFontSize)}"></div>
        <div class="form-field"><label for="logoSize">Ukuran logo kop (px)</label><input id="logoSize" name="logoSize" type="number" min="24" max="160" step="1" required value="${esc(design.logoSize)}"><small class="form-help">Ukuran lebar dan tinggi logo pada kop cetak.</small></div>
        <div class="form-field ${design.headerMode === "custom" ? "hidden" : ""}"><label class="form-check"><input name="headerBold" type="checkbox" ${design.headerBold ? "checked" : ""}><span>Tebal nama sekolah</span></label></div>
        <div class="form-field ${design.headerMode === "custom" ? "hidden" : ""}"><label class="form-check"><input name="headerItalic" type="checkbox" ${design.headerItalic ? "checked" : ""}><span>Miring nama sekolah</span></label></div>
        <div class="form-field full"><label>Tempat tanda tangan</label><input name="city" type="text" value="${esc(school.city)}"></div>
        <div class="print-signatories-grid">
          <div class="print-signatory-column">${formInput("principalName", "Nama Kepala Sekolah", school.principalName, "text")}${formInput("principalNip", "NIP Kepala Sekolah", school.principalNip, "text")}</div>
          <div class="print-signatory-column">${formInput("sarprasVicePrincipalName", "Nama Wakasek Sarpras", school.sarprasVicePrincipalName, "text")}${formInput("sarprasVicePrincipalNip", "NIP Wakasek Sarpras", school.sarprasVicePrincipalNip, "text")}</div>
        </div>
        <div class="form-field full"><label for="loanReceiptNumberFormat">Format nomor bukti peminjaman</label><input id="loanReceiptNumberFormat" name="loanReceiptNumberFormat" type="text" maxlength="100" required value="${esc(loanNumberFormat)}"><small class="form-help">Nomor otomatis bertambah berurutan. Gunakan {nomor} sebagai nomor urut, {bulan} sebagai bulan Romawi (I–XII), dan {tahun} sebagai tahun. Contoh: {nomor}/PB/{bulan}/{tahun}. Pratinjau berikutnya: <b id="loanReceiptNumberPreview">${esc(loanNumberPreview)}</b></small></div>
        <div class="form-field full print-letterhead-upload"><label>Logo khusus kop surat</label><div class="print-letterhead-upload-row"><div id="letterheadLogoPreview" class="print-letterhead-logo-preview">${school.letterheadLogo ? `<img src="${esc(school.letterheadLogo)}" alt="Logo khusus kop surat">` : `<i data-lucide="image-plus"></i>`}</div><div class="print-letterhead-upload-fields"><input name="letterheadLogoFile" type="file" accept="image/*"><label class="form-check"><input name="removeLetterheadLogo" type="checkbox"><span>Hapus logo khusus kop surat</span></label><small class="form-help">Logo ini terpisah dari logo sekolah utama. Format gambar, maksimal 2 MB.</small></div></div></div>
        <div class="form-field full"><label class="form-check"><input name="showLogo" type="checkbox" ${design.showLogo ? "checked" : ""}><span>Tampilkan logo khusus pada kop</span></label></div>
      </div></form>
      <section class="settings-card"><h3>Pratinjau kop dan tanda tangan</h3><div class="print-design-preview"><div class="print-school-header print-design-header-preview">${printSchoolHeaderMarkup(school, design)}</div>${reportSignatures(school)}</div></section>`;
  }

  function renderAppBranding() {
    return `<form id="appBrandingForm" class="settings-card"><h3>Identitas Aplikasi</h3><p>Atur nama dan logo yang tampil di aplikasi, judul tab browser, dan favicon.</p><div class="form-grid">
      ${formInput("appName", "Nama Aplikasi", state.settings.appName, "text", true)}
      ${formInput("appTagline", "Subjudul Aplikasi", state.settings.appTagline)}
      <div class="form-field full"><label for="appLogoFile">Logo Aplikasi</label><div class="app-branding-upload"><div id="appLogoPreview" class="app-logo-preview">${state.settings.appLogo ? `<img src="${esc(state.settings.appLogo)}" alt="Logo aplikasi">` : `<i data-lucide="boxes"></i>`}</div><div><input id="appLogoFile" name="appLogoFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="form-help">PNG, JPG, atau WEBP · maksimal 2 MB. Logo juga digunakan sebagai favicon.</small><label class="app-logo-remove"><input name="removeAppLogo" type="checkbox"> Gunakan ikon bawaan</label></div></div></div>
      <div class="form-field full"><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan identitas aplikasi</button></div>
      </div></form>`;
  }

  function renderCollection(key) {
    const config = collectionConfig[key];
    const displayCols = key === "goods"
      ? [["name", "Nama Barang"], ["receivedDate", "Tanggal Barang Masuk"], ["typeId", "Jenis"], ["categoryId", "Kategori"], ["locationId", "Ruang / Lokasi"], ["quantity", "Jumlah"], ["unitId", "Satuan"], ["price", "Harga Satuan"], ["totalPrice", "Harga Total"], ["consumable", "Status BHP"]]
      : config.cols;
    const rows = recordsForCurrentAcademicYear(key);
    const hideExportControls = ["types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears", "goods", "loans", "procurements", "disposals", "depreciations", "usages", "stocktakes"].includes(key);
    const bulkDeletable = bulkDeletePages.has(key) && canDeletePage(key);
    const actions = canEditPage(key) ? key === "goods"
      ? `<button class="btn-secondary" data-action="add-existing-good"><i data-lucide="package-plus"></i>Tambah barang yang sudah ada</button><button class="btn-primary" data-action="add"><i data-lucide="plus"></i>Tambah barang baru</button>`
      : `<button class="btn-primary" data-action="add"><i data-lucide="plus"></i>Tambah ${config.singular}</button>` : "";
    const importControls = key === "goods"
      ? `<button class="btn-quiet" data-action="goods-template"><i data-lucide="download"></i>Template Excel</button>${canEditPage(key) ? `<button class="btn-quiet" data-action="goods-import"><i data-lucide="upload"></i>Impor Barang</button>` : ""}`
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
      if (statusPages.has(key) && selectedFilter !== "Semua" && displayedStatus(key, row.status) !== selectedFilter) return false;
      if (key !== "goods") return true;
      return goodsFilterFields.every(([field]) => !goodsFilters[field] || String(row[field] ?? "") === goodsFilters[field])
        && (!goodsFilters.consumable || (goodsFilters.consumable === "true" ? isBhp(row) : !isBhp(row)));
    });
    const selectHeader = bulkDeletable ? `<th class="bulk-select-column"><input id="selectAllRecords" type="checkbox" aria-label="Pilih semua data yang tampil"></th>` : "";
    const headers = displayCols.map(([, title]) => `<th>${esc(title.toUpperCase())}</th>`).join("");
    const body = filtered.length ? filtered.map((row) => {
      const selection = bulkDeletable ? `<td class="bulk-select-column"><input type="checkbox" class="record-select" value="${esc(row.id)}" aria-label="Pilih ${esc(row.name || row.title || row.borrower || row.applicant || row.date || config.singular)}"></td>` : "";
      const bastAction = key === "procurements" || key === "disposals"
        ? `<button class="mini-action" title="Cetak BAST" aria-label="Cetak BAST" data-action="print-bast" data-type="${key}" data-id="${esc(row.id)}"><i data-lucide="printer"></i></button>`
        : "";
      return `<tr>${selection}${displayCols.map(([field]) => {
        const currency = ["price", "totalPrice", "unitPrice", "estimatedCost", "initialValue", "residualValue", "amount", "accumulatedAmount", "finalValue"].includes(field) || (field === "total" && key === "procurements");
        return `<td${currency ? ' class="goods-price-cell"' : ""}>${formatCell(key, field, row)}</td>`;
      }).join("")}<td><div class="action-buttons">${bastAction}${canEditPage(key) && ((key === "loans" && row.status === "Diterima") || (key === "procurements" && row.status === "Pengajuan")) ? `<button class="mini-action" title="Ubah status" data-action="status" data-id="${row.id}"><i data-lucide="check"></i></button>` : ""}${key === "locations" && canEditPage(key) ? `<button class="mini-action" title="Kondisi ruangan" aria-label="Kondisi ruangan ${esc(row.name)}" data-action="room-condition" data-id="${row.id}"><i data-lucide="triangle-alert"></i></button>` : ""}${canEditPage(key) && !(key === "procurements" && isStockAdditionRecord(row)) ? `<button class="mini-action" title="Edit" data-action="edit" data-id="${row.id}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage(key) ? `<button class="mini-action" title="Hapus" data-action="delete" data-id="${row.id}"><i data-lucide="trash-2"></i></button>` : ""}${key === "goods" && canEditPage(key) ? `<button class="mini-action" title="Atur kondisi barang" data-action="goods-condition" data-id="${row.id}"><i data-lucide="activity"></i></button>` : ""}${key === "loans" ? `<button class="mini-action" title="Cetak bukti peminjaman" aria-label="Cetak bukti peminjaman" data-action="print-loan" data-id="${row.id}"><i data-lucide="printer"></i></button>` : ""}</div></td></tr>`;
    }).join("") : `<tr><td colspan="${displayCols.length + 1 + Number(bulkDeletable)}"><div class="empty-state"><i data-lucide="inbox"></i>Tidak ada data yang cocok.</div></td></tr>`;
    const purchaseHistory = key === "goods" ? renderGoodsPurchaseHistory() : "";
    return `${pageHeading(actions)}${toolbar}<div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr>${selectHeader}${headers}<th>AKSI</th></tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>Menampilkan ${filtered.length} dari ${rows.length} data</span><div class="pagination"><button class="page-number active">1</button></div></div></div>${purchaseHistory}`;
  }

  function renderGoodsPurchaseHistory() {
    const canManage = canDeletePage("goods");
    const purchases = (state.procurements || [])
      .filter((record) => isStockAdditionRecord(record) && (!record.academicYearId || record.academicYearId === currentAcademicYearId()));
    const selectionHeader = canManage ? `<th class="bulk-select-column"><input id="selectAllGoodsPurchases" type="checkbox" aria-label="Pilih semua riwayat barang masuk"></th>` : "";
    const purchaseRows = purchases.map((record, index) => {
      const good = getById("goods", record.goodId);
      return `<tr>${canManage ? `<td class="bulk-select-column"><input type="checkbox" class="goods-purchase-select" value="${esc(record.id)}" aria-label="Pilih riwayat ${esc(good?.name || record.title)}"></td>` : ""}
        <td>${index + 1}</td><td>${esc(niceDate(record.date))}</td><td>${esc(good?.name || record.title || "Barang tidak ditemukan")}</td>
        <td>${integerId.format(Number(record.quantity) || 0)} ${esc(relatedName("units", good?.unitId))}</td>
        <td class="goods-price-cell">${currencyCell(record.unitPrice)}</td>
        <td class="goods-price-cell">${currencyCell((Number(record.quantity) || 0) * (Number(record.unitPrice) || 0))}</td>
        <td>${esc(relatedName("funds", record.fundId))}</td><td>${esc(relatedName("suppliers", record.supplierId || good?.supplierId))}</td>
        ${canManage ? `<td><button type="button" class="mini-action" title="Hapus riwayat barang masuk" aria-label="Hapus riwayat ${esc(good?.name || record.title)}" data-action="delete-goods-purchase" data-id="${esc(record.id)}"><i data-lucide="trash-2"></i></button></td>` : ""}</tr>`;
    }).join("");
    const selectionControls = canManage
      ? `<button type="button" class="btn-quiet" data-action="select-visible-goods-purchases"><i data-lucide="check-check"></i>Pilih semua</button><button type="button" class="btn-danger" id="deleteSelectedGoodsPurchases" data-action="delete-selected-goods-purchases" disabled><i data-lucide="trash-2"></i>Hapus terpilih <span id="selectedGoodsPurchaseCount"></span></button>`
      : "";
    return `<section class="settings-card goods-purchase-history"><div class="goods-purchase-history-heading"><div><h3>Riwayat Barang Masuk / Penambahan Stok</h3><p>Setiap penambahan stok barang terdaftar dicatat berdasarkan tanggal, jumlah, harga, sumber dana, dan supplier.</p></div>${selectionControls ? `<div class="goods-toolbar-actions">${selectionControls}</div>` : ""}</div>
      <div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr>${selectionHeader}<th>NO.</th><th>TANGGAL MASUK</th><th>NAMA BARANG</th><th>JUMLAH</th><th>HARGA SATUAN</th><th>TOTAL</th><th>SUMBER DANA</th><th>SUPPLIER</th>${canManage ? "<th>AKSI</th>" : ""}</tr></thead><tbody>${purchaseRows || `<tr><td class="empty-state" colspan="${8 + Number(canManage) * 2}">Belum ada riwayat penambahan stok.</td></tr>`}</tbody></table></div><div class="table-footer"><span>${purchases.length} riwayat barang masuk</span></div></div></section>`;
  }

  function renderAssetMovements() {
    const records = [...(state.assetMovements || [])]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const query = searchTerm.toLocaleLowerCase("id-ID");
    const filtered = records.filter((movement) => [
      movement.itemCode, movement.goodName, movement.fromLocationName,
      movement.toLocationName, movement.responsible, movement.note
    ].join(" ").toLocaleLowerCase("id-ID").includes(query));
    const rows = filtered.length ? filtered.map((movement) => `<tr>
      <td>${esc(niceDate(movement.date))}</td><td>${esc(movement.itemCode || "—")}</td>
      <td><span class="table-title">${esc(movement.goodName || titleOfGood(movement.goodId))}</span></td>
      <td>${esc(movement.fromLocationName || "Belum ditentukan")}</td><td>${esc(movement.toLocationName || "—")}</td>
      <td>${esc(movement.responsible || "—")}</td><td>${esc(movement.note || "—")}</td>
      <td><button type="button" class="mini-action" title="Cetak BAST" aria-label="Cetak BAST perpindahan barang" data-action="print-bast" data-type="assetMovements" data-id="${esc(movement.id)}"><i data-lucide="printer"></i></button></td>
    </tr>`).join("") : `<tr><td class="empty-state" colspan="8">Belum ada riwayat pemindahan yang cocok.</td></tr>`;
    const actions = canEditPage("assetMovements")
      ? `<button class="btn-primary" data-action="add-asset-movement"><i data-lucide="move-right"></i>Pindahkan Barang</button>` : "";
    return `${pageHeading(actions)}<div class="table-toolbar"><div class="table-toolbar-left"><label class="search-field"><i data-lucide="search"></i><input id="tableSearch" placeholder="Cari nama barang, kode item, ruang..." value="${esc(searchTerm)}"></label><span class="badge neutral">${filtered.length} pemindahan</span></div></div>
      <div class="settings-card movement-intro"><i data-lucide="route"></i><p>Pilih barang dari Data Barang untuk memindahkannya ke ruang lain. Lokasi barang dan item inventaris terkait diperbarui; catatan asal, tujuan, tanggal, serta penanggung jawab disimpan untuk laporan siklus aset.</p></div>
      <div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal Pemindahan</th><th>Kode Item</th><th>Nama Barang</th><th>Dari Ruang</th><th>Ke Ruang</th><th>Penanggung Jawab</th><th>Keterangan</th><th>Dokumen</th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer"><span>Menampilkan ${filtered.length} dari ${records.length} pemindahan</span></div></div>`;
  }

  function openAssetMovementForm() {
    if (!canEditPage("assetMovements")) return showToast("Akun Anda tidak memiliki izin memindahkan barang.", true);
    const goods = [...recordsForCurrentAcademicYear("goods")]
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id-ID"));
    const goodOptions = goods.map((good) => `<option value="${esc(good.id)}">${esc(good.name)}</option>`).join("");
    const locations = recordsForAcademicYear("locations").filter((room) => room.status !== "Nonaktif")
      .map((room) => `<option value="${esc(room.id)}">${esc(room.name)}</option>`).join("");
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="assetMovementTitle">
      <div class="modal-header"><div><h2 id="assetMovementTitle">Pindah Ruang Barang</h2><p>Catat perpindahan barang dari Data Barang beserta penanggung jawabnya.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div>
      <form id="assetMovementForm" class="modal-form"><div class="form-grid">
        <div class="form-field"><label for="movementDate">Tanggal Pemindahan *</label><input id="movementDate" name="date" type="date" value="${dateOffset(0)}" required></div>
        <div class="form-field"><label for="movementGood">Nama Barang *</label><select id="movementGood" name="goodId" required><option value="">Pilih barang dari Data Barang</option>${goodOptions}</select><small class="form-help">Perpindahan memperbarui ruang barang dan lokasi seluruh item inventaris terkait.</small></div>
        <div class="form-field"><label>Ruang Asal</label><input id="movementFromRoom" type="text" value="" readonly placeholder="Otomatis dari Data Barang"><input id="movementFromRoomId" name="fromLocationId" type="hidden"></div>
        <div class="form-field"><label for="movementToRoom">Ruang Tujuan *</label><select id="movementToRoom" name="toLocationId" required><option value="">Pilih ruang tujuan</option>${locations}</select></div>
        <div class="form-field full"><label for="movementResponsible">Nama Penanggung Jawab *</label><input id="movementResponsible" name="responsible" type="text" maxlength="120" required></div>
        <div class="form-field full"><label for="movementNote">Keterangan (opsional)</label><textarea id="movementNote" name="note" rows="3" maxlength="500"></textarea></div>
      </div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="submit" class="btn-primary"><i data-lucide="save"></i>Simpan pemindahan</button></div></form>
    </section></div>`);
    const form = $("#assetMovementForm");
    $("#movementGood")?.addEventListener("change", (event) => {
      const good = getById("goods", event.target.value);
      const locationId = good?.locationId || "";
      $("#movementFromRoomId").value = locationId;
      $("#movementFromRoom").value = locationId ? relatedName("locations", locationId) : "Belum ditentukan";
      if ($("#movementToRoom").value === locationId) $("#movementToRoom").value = "";
    });
    form?.addEventListener("submit", saveAssetMovement);
  }

  function saveAssetMovement(event) {
    event.preventDefault();
    if (!canEditPage("assetMovements")) return showToast("Akun Anda tidak memiliki izin memindahkan barang.", true);
    const form = event.currentTarget;
    const good = getById("goods", form.elements.goodId.value);
    const toLocationId = form.elements.toLocationId.value;
    const toRoom = getById("locations", toLocationId);
    const fromLocationId = form.elements.fromLocationId.value;
    const fromRoom = getById("locations", fromLocationId);
    const date = form.elements.date.value;
    const parsedDate = new Date(`${date}T00:00:00Z`);
    const responsible = form.elements.responsible.value.trim();
    if (!good) return showToast("Pilih barang dari Data Barang yang valid.", true);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return showToast("Tanggal pemindahan wajib diisi dengan tanggal yang valid.", true);
    }
    if (!toRoom || toRoom.status === "Nonaktif") return showToast("Pilih ruang tujuan yang aktif.", true);
    if (fromLocationId && fromLocationId === toLocationId) return showToast("Ruang asal dan tujuan harus berbeda.", true);
    if (!responsible) return showToast("Nama penanggung jawab wajib diisi.", true);
    if (!Array.isArray(state.assetMovements)) state.assetMovements = [];
    const movement = {
      id: id(),
      goodId: good.id,
      goodName: good.name,
      date,
      fromLocationId,
      fromLocationName: fromRoom?.name || "Belum ditentukan",
      toLocationId,
      toLocationName: toRoom.name,
      responsible,
      note: form.elements.note.value.trim(),
      createdBy: activeUser?.name || "Administrator"
    };
    good.locationId = toLocationId;
    (state.items || []).filter((item) => item.goodId === good.id)
      .forEach((item) => { item.locationId = toLocationId; });
    state.assetMovements.unshift(movement);
    logActivity("Memindahkan barang", "Pindah Ruang Barang", `${good.name} · ${movement.fromLocationName} → ${toRoom.name}`);
    saveState();
    closeModal();
    showToast(`${good.name} berhasil dipindahkan ke ${toRoom.name}.`);
    renderPage();
  }

  function renderRepairTickets() {
    const records = recordsForCurrentAcademicYear("repairTickets");
    const countForStatus = (status) => records.filter((ticket) => ticket.status === status).length;
    const filtered = records.filter((ticket) => {
      if (selectedFilter !== "Semua" && ticket.status !== selectedFilter) return false;
      if (repairTicketPriority !== "Semua" && ticket.priority !== repairTicketPriority) return false;
      const query = searchTerm.toLocaleLowerCase("id-ID");
      return !query || [
        ticket.ticketNo, ticket.title, ticket.description, titleOfGood(ticket.goodId),
        relatedName("locations", ticket.locationId), ticket.priority, ticket.status
      ].join(" ").toLocaleLowerCase("id-ID").includes(query);
    });
    const summary = [
      ["Total Tiket", records.length, "ticket", "neutral"],
      ["Diajukan", countForStatus("Diajukan"), "clock-3", "warning"],
      ["Diproses", countForStatus("Diproses"), "wrench", "info"],
      ["Selesai", countForStatus("Selesai"), "circle-check", "success"]
    ].map(([label, count, icon, tone]) => `<article class="ticket-stat-card"><span class="ticket-stat-icon ${tone}"><i data-lucide="${icon}"></i></span><div><b>${count}</b><small>${label}</small></div></article>`).join("");
    const cards = filtered.map((ticket) => {
      const statusClass = ({ Diajukan: "submitted", Diproses: "processing", Selesai: "done" })[ticket.status] || "submitted";
      const priorityClass = ({ Rendah: "low", Sedang: "medium", Tinggi: "high", Urgent: "urgent" })[ticket.priority] || "medium";
      const nextStatus = ticket.status === "Diajukan" ? "Diproses" : ticket.status === "Diproses" ? "Selesai" : "";
      return `<article class="repair-ticket-card priority-${priorityClass}">
        <div class="repair-ticket-card-top"><span class="repair-ticket-number">${esc(ticket.ticketNo || `TKT-${ticket.id}`)}</span><span class="ticket-status ${statusClass}">${esc(ticket.status || "Diajukan")}</span></div>
        <div class="repair-ticket-content">${ticket.photo ? `<img class="repair-ticket-thumb" src="${esc(ticket.photo)}" alt="Foto kerusakan ${esc(ticket.title)}">` : ""}
          <div class="repair-ticket-copy"><div class="repair-ticket-card-title"><h3>${esc(ticket.title)}</h3><span class="ticket-priority ${priorityClass}">${esc(ticket.priority || "Sedang")}</span></div>
          <p>${esc(ticket.description)}</p><div class="repair-ticket-meta"><span><i data-lucide="package"></i>${esc(titleOfGood(ticket.goodId))} · ${esc(ticket.quantity)} unit</span><span><i data-lucide="map-pin"></i>${esc(relatedName("locations", ticket.locationId))}</span><span><i data-lucide="calendar-days"></i>${esc(niceDate(ticket.createdAt || ticket.date))}</span></div></div>
        </div><div class="repair-ticket-actions"><button class="btn-quiet" data-action="repair-ticket-detail" data-id="${esc(ticket.id)}"><i data-lucide="eye"></i>Detail</button>
        ${canEditPage("repairTickets") && nextStatus ? `<button class="btn-secondary" data-action="repair-ticket-status" data-id="${esc(ticket.id)}" data-status="${nextStatus}">${nextStatus === "Diproses" ? "Mulai diproses" : "Tandai selesai"}</button>` : ""}
        ${canEditPage("repairTickets") ? `<button class="mini-action" title="Edit tiket" data-action="edit" data-id="${esc(ticket.id)}"><i data-lucide="pencil"></i></button>` : ""}
        ${canDeletePage("repairTickets") ? `<button class="mini-action" title="Hapus tiket" data-action="delete" data-id="${esc(ticket.id)}"><i data-lucide="trash-2"></i></button>` : ""}</div>
      </article>`;
    }).join("");
    const priorities = ["Semua", "Rendah", "Sedang", "Tinggi", "Urgent"];
    return `${pageHeading(canEditPage("repairTickets") ? `<button class="btn-primary" data-action="add"><i data-lucide="plus"></i>Buat Tiket</button>` : "")}
      <div class="ticket-summary-grid">${summary}</div>
      <div class="ticket-toolbar"><label class="search-field"><i data-lucide="search"></i><input id="ticketSearch" placeholder="Cari tiket..." value="${esc(searchTerm)}"></label>
      <select class="table-filter" id="statusFilter" aria-label="Filter status tiket">${statusOptions.repairTickets.map((status) => `<option ${selectedFilter === status ? "selected" : ""}>${esc(status)}</option>`).join("")}</select>
      <select class="table-filter" id="repairTicketPriority" aria-label="Filter prioritas tiket">${priorities.map((priority) => `<option value="${esc(priority)}" ${repairTicketPriority === priority ? "selected" : ""}>${esc(priority === "Semua" ? "Semua Prioritas" : priority)}</option>`).join("")}</select></div>
      <div class="repair-ticket-grid">${cards || `<div class="panel empty-state"><i data-lucide="inbox"></i>${records.length ? "Tidak ada tiket yang cocok dengan filter." : "Belum ada tiket perbaikan. Buat tiket untuk melaporkan kerusakan."}</div>`}</div>`;
  }

  function repairTicketDetail(ticketId) {
    const ticket = getById("repairTickets", ticketId);
    if (!ticket) return;
    const priorityClass = ({ Rendah: "low", Sedang: "medium", Tinggi: "high", Urgent: "urgent" })[ticket.priority] || "medium";
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Detail Tiket Perbaikan</h2><p>${esc(ticket.ticketNo || `TKT-${ticket.id}`)}</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><div class="repair-ticket-detail-status"><span class="ticket-status ${(ticket.status === "Selesai" ? "done" : ticket.status === "Diproses" ? "processing" : "submitted")}">${esc(ticket.status || "Diajukan")}</span><span class="ticket-priority ${priorityClass}">${esc(ticket.priority || "Sedang")}</span></div>${ticket.photo ? `<img class="repair-ticket-detail-photo" src="${esc(ticket.photo)}" alt="Foto kerusakan ${esc(ticket.title)}">` : ""}<h3>${esc(ticket.title)}</h3><p class="repair-ticket-detail-description">${esc(ticket.description)}</p><dl class="repair-ticket-detail-list"><div><dt>Barang</dt><dd>${esc(titleOfGood(ticket.goodId))}</dd></div><div><dt>Jumlah</dt><dd>${esc(ticket.quantity)} unit</dd></div><div><dt>Lokasi</dt><dd>${esc(relatedName("locations", ticket.locationId))}</dd></div><div><dt>Tanggal</dt><dd>${esc(niceDate(ticket.createdAt || ticket.date))}</dd></div></dl><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Tutup</button></div></div></section></div>`);
  }

  function monthTitle(year, month, options = {}) {
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: options.year === false ? undefined : "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month, 1)));
  }

  function calendarMonthMarkup(year, month, schedules, compact = false, academicYear = null) {
    const weekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const startBoundary = academicYear?.startDate || "";
    const endBoundary = academicYear?.endDate || "";
    const cells = Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > daysInMonth) return `<span class="calendar-day empty"></span>`;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dailySchedules = schedules.filter((schedule) => schedule.date === date);
      const outsideYear = Boolean((startBoundary && date < startBoundary) || (endBoundary && date > endBoundary));
      const selected = date === calendarSelectedDate;
      const todayClass = date === dateOffset(0) ? " today" : "";
      const eventClasses = [...new Set(dailySchedules.map((schedule) => maintenanceTypeClasses[schedule.type] || "routine"))]
        .map((typeClass) => ` event-${typeClass}`).join("");
      const markers = dailySchedules.slice(0, compact ? 3 : 2).map((schedule) => `<i class="calendar-event-dot ${maintenanceTypeClasses[schedule.type] || "routine"}" title="${esc(schedule.type)}"></i>`).join("");
      const eventLabel = compact
        ? `<span class="calendar-day-markers">${markers}</span>`
        : `<span class="calendar-day-markers">${markers}</span>${dailySchedules.length ? `<small>${dailySchedules.length} jadwal</small>` : ""}`;
      return `<button type="button" class="calendar-day${selected ? " selected" : ""}${todayClass}${dailySchedules.length ? ` has-events${eventClasses}` : ""}${outsideYear ? " outside-year" : ""}" data-action="calendar-select-date" data-date="${date}" ${outsideYear ? "disabled" : ""} aria-label="${day} ${monthTitle(year, month)}${dailySchedules.length ? `, ${dailySchedules.length} jadwal` : ""}"><span class="calendar-day-number">${day}</span>${eventLabel}</button>`;
    }).join("");
    return `<section class="calendar-month-card${compact ? " compact" : ""}"><h3>${esc(monthTitle(year, month))}</h3><div class="calendar-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div><div class="calendar-days-grid">${cells}</div></section>`;
  }

  function academicYearMonths(year) {
    if (!year?.startDate || !year?.endDate || year.startDate > year.endDate) return [];
    const start = new Date(`${year.startDate}T00:00:00Z`);
    const end = new Date(`${year.endDate}T00:00:00Z`);
    const months = [];
    for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      cursor <= end && months.length < 24;
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
      months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() });
    }
    return months;
  }

  function renderCalendarSelectedDayPanel() {
    const schedules = recordsForCurrentAcademicYear("maintenanceSchedules")
      .filter((schedule) => schedule.date === calendarSelectedDate)
      .sort((a, b) => String(a.type).localeCompare(String(b.type)));
    const scheduleCards = schedules.map((schedule) => {
      const typeClass = maintenanceTypeClasses[schedule.type] || "routine";
      return `<article class="calendar-schedule-card ${typeClass}"><div class="calendar-schedule-card-top"><span class="maintenance-type-label ${typeClass}">${esc(schedule.type)}</span><span class="calendar-schedule-actions">${statusBadge(schedule.status || "Menunggu Jadwal")}${canEditPage("maintenanceCalendar") ? `<button class="mini-action" aria-label="Edit jadwal" title="Edit jadwal" data-action="edit-calendar-schedule" data-id="${esc(schedule.id)}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage("maintenanceCalendar") ? `<button class="mini-action" aria-label="Hapus jadwal" title="Hapus jadwal" data-action="delete-calendar-schedule" data-id="${esc(schedule.id)}"><i data-lucide="trash-2"></i></button>` : ""}</span></div><h4>${esc(titleOfGood(schedule.goodId))}</h4><p>${esc(schedule.quantity)} unit · ${esc(relatedName("locations", schedule.locationId))}</p>${Number(schedule.estimatedCost) > 0 ? `<p><i data-lucide="wallet"></i>Estimasi biaya: ${esc(rupiah(schedule.estimatedCost))}</p>` : ""}${schedule.nextServiceDate ? `<p><i data-lucide="calendar-clock"></i>Servis berikutnya: ${esc(niceDate(schedule.nextServiceDate))}</p>` : ""}${schedule.technician ? `<p><i data-lucide="user-round"></i>Teknisi: ${esc(schedule.technician)}</p>` : ""}${schedule.description ? `<p class="calendar-schedule-description">${esc(schedule.description)}</p>` : ""}${maintenanceStatusActionMarkup(schedule)}</article>`;
    }).join("");
    const addScheduleButton = canEditPage("maintenanceCalendar")
      ? `<button class="btn-secondary calendar-add-day" data-action="add-calendar-schedule" data-date="${esc(calendarSelectedDate)}"><i data-lucide="plus"></i>Tambah jadwal tanggal ini</button>` : "";
    const selectedDateTitle = calendarSelectedDate ? niceDate(calendarSelectedDate) : "Pilih tanggal";
    return `<div class="calendar-day-panel-header"><span class="eyebrow">JADWAL TERPILIH</span><h3>${esc(selectedDateTitle)}</h3></div>${addScheduleButton}
      <div class="calendar-schedule-list">${scheduleCards || `<div class="calendar-empty-day"><i data-lucide="calendar-days"></i><p>Belum ada jadwal pada tanggal ini.</p><small>Klik tanggal pada kalender untuk melihat jadwal.</small></div>`}</div>`;
  }

  function maintenanceStatusActionMarkup(schedule) {
    if (!canEditPage("maintenanceCalendar") || schedule.status === "Selesai") return "";
    const nextStatus = schedule.status === "Sedang Diservis" ? "Selesai" : "Sedang Diservis";
    const label = nextStatus === "Selesai" ? "Tandai selesai" : "Mulai servis";
    return `<button type="button" class="btn-quiet maintenance-status-action" data-action="maintenance-status" data-id="${esc(schedule.id)}" data-status="${nextStatus}"><i data-lucide="${nextStatus === "Selesai" ? "circle-check" : "wrench"}"></i>${label}</button>`;
  }

  function renderAllMaintenanceSchedules(schedules) {
    const sortedSchedules = schedules.slice()
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.type || "").localeCompare(String(b.type || "")));
    const cards = sortedSchedules.map((schedule) => {
      const typeClass = maintenanceTypeClasses[schedule.type] || "routine";
      const actions = `${canEditPage("maintenanceCalendar") ? `<button class="mini-action" aria-label="Edit jadwal" title="Edit jadwal" data-action="edit-calendar-schedule" data-id="${esc(schedule.id)}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage("maintenanceCalendar") ? `<button class="mini-action" aria-label="Hapus jadwal" title="Hapus jadwal" data-action="delete-calendar-schedule" data-id="${esc(schedule.id)}"><i data-lucide="trash-2"></i></button>` : ""}`;
      return `<article class="calendar-schedule-card ${typeClass} calendar-all-schedule-card"><div class="calendar-schedule-card-top"><time class="calendar-all-schedule-date" datetime="${esc(schedule.date)}">${esc(niceDate(schedule.date))}</time><span class="maintenance-type-label ${typeClass}">${esc(schedule.type)}</span><span class="calendar-schedule-actions">${statusBadge(schedule.status || "Menunggu Jadwal")}${actions}</span></div><h4>${esc(titleOfGood(schedule.goodId))}</h4><p>${esc(schedule.quantity)} unit · ${esc(relatedName("locations", schedule.locationId))}</p>${Number(schedule.estimatedCost) > 0 ? `<p><i data-lucide="wallet"></i>Estimasi biaya: ${esc(rupiah(schedule.estimatedCost))}</p>` : ""}${schedule.nextServiceDate ? `<p><i data-lucide="calendar-clock"></i>Servis berikutnya: ${esc(niceDate(schedule.nextServiceDate))}</p>` : ""}${schedule.technician ? `<p><i data-lucide="user-round"></i>Teknisi: ${esc(schedule.technician)}</p>` : ""}${schedule.description ? `<p class="calendar-schedule-description">${esc(schedule.description)}</p>` : ""}${maintenanceStatusActionMarkup(schedule)}</article>`;
    }).join("");
    return `<section class="panel calendar-all-schedules"><div class="panel-heading"><div><h3>Daftar Jadwal Pemeliharaan</h3><p>${sortedSchedules.length} jadwal pada tahun pelajaran ini</p></div></div><div class="calendar-all-schedule-list">${cards || `<div class="empty-state">Belum ada jadwal pemeliharaan.</div>`}</div></section>`;
  }

  function renderMaintenanceHistory() {
    const history = (state.maintenanceHistory || [])
      .filter((entry) => !entry.academicYearId || entry.academicYearId === currentAcademicYearId())
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const rows = history.slice(0, 100).map((entry) => `<tr><td>${esc(niceDate(entry.updatedAt || entry.date))}</td><td>${esc(titleOfGood(entry.goodId))}</td><td>${esc(entry.action || "Perawatan diperbarui")}</td><td>${statusBadge(entry.status || "Menunggu Jadwal")}</td><td>${Number(entry.estimatedCost) > 0 ? esc(rupiah(entry.estimatedCost)) : "—"}</td><td>${esc(entry.technician || "—")}</td></tr>`).join("");
    return `<section class="panel calendar-maintenance-history"><div class="panel-heading"><div><h3>Riwayat Servis / Perawatan</h3><p>Riwayat perubahan jadwal dan status pengerjaan</p></div><span class="badge neutral">${history.length}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>WAKTU</th><th>BARANG</th><th>CATATAN</th><th>STATUS</th><th>ESTIMASI BIAYA</th><th>TEKNISI</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty-state">Belum ada riwayat servis.</td></tr>`}</tbody></table></div></section>`;
  }

  function renderMaintenanceCalendar() {
    const schedules = recordsForCurrentAcademicYear("maintenanceSchedules");
    const academicYear = state.academicYears.find((year) => year.id === currentAcademicYearId());
    const [cursorYear, cursorMonth] = calendarCursor.slice(0, 7).split("-").map(Number);
    if (calendarViewMode === "academicYear" && academicYear && (calendarSelectedDate < academicYear.startDate || calendarSelectedDate > academicYear.endDate)) {
      calendarSelectedDate = academicYear.startDate;
    }
    const monthGrid = calendarViewMode === "month"
      ? calendarMonthMarkup(cursorYear, cursorMonth - 1, schedules)
      : academicYearMonths(academicYear).map(({ year, month }) => calendarMonthMarkup(year, month, schedules, true, academicYear)).join("");
    const currentLabel = calendarViewMode === "month"
      ? monthTitle(cursorYear, cursorMonth - 1)
      : academicYear?.name || "Tahun pelajaran belum tersedia";
    const navigation = calendarViewMode === "month"
      ? `<button class="mini-action" aria-label="Bulan sebelumnya" data-action="calendar-month-prev"><i data-lucide="chevron-left"></i></button><h2>${esc(currentLabel)}</h2><button class="mini-action" aria-label="Bulan berikutnya" data-action="calendar-month-next"><i data-lucide="chevron-right"></i></button>`
      : `<h2><i data-lucide="calendar-days"></i>${esc(currentLabel)}</h2>`;
    const legend = maintenanceTypes.map((type) => `<span class="calendar-legend-item"><i class="calendar-event-dot ${maintenanceTypeClasses[type]}"></i>${esc(type)}</span>`).join("");
    return `${pageHeading(canEditPage("maintenanceCalendar") ? `<button class="btn-primary" data-action="add-calendar-schedule"><i data-lucide="plus"></i>Tambah Jadwal</button>` : "")}
      <div class="maintenance-calendar-layout"><section class="panel maintenance-calendar-panel"><div class="maintenance-calendar-toolbar"><label for="calendarViewMode">Tampilan kalender</label><select class="table-filter" id="calendarViewMode"><option value="month" ${calendarViewMode === "month" ? "selected" : ""}>Per Bulan</option><option value="academicYear" ${calendarViewMode === "academicYear" ? "selected" : ""}>Satu Tahun Pelajaran</option></select><div class="calendar-period-navigation">${navigation}</div></div>
      ${calendarViewMode === "academicYear" && !academicYear ? `<div class="empty-state">Tambahkan tahun pelajaran terlebih dahulu.</div>` : `<div class="${calendarViewMode === "academicYear" ? "academic-year-calendar-grid" : "calendar-single-month"}">${monthGrid}</div>`}
      <div class="calendar-legend">${legend}</div></section>
      <aside class="panel calendar-day-panel">${renderCalendarSelectedDayPanel()}</aside></div>
      ${renderAllMaintenanceSchedules(schedules)}${renderMaintenanceHistory()}`;
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
    if (key === "goods" && field === "quantity" && isBhp(row)) {
      const alert = bhpStockAlert(row);
      return alert
        ? `<span class="badge danger bhp-low-stock-badge"><i data-lucide="triangle-alert"></i>${integerId.format(alert.remaining)} tersisa</span><small class="bhp-low-stock-caption">${alert.consumedPercent}% stok awal terpakai</small>`
        : integerId.format(Number(value) || 0);
    }
    if (field === "fundId" || field === "typeId" || field === "categoryId" || field === "unitId" || field === "supplierId" || field === "goodId" || field === "locationId" || field === "ownershipId") return esc(relatedName(({ fundId: "funds", typeId: "types", categoryId: "categories", unitId: "units", supplierId: "suppliers", goodId: "goods", locationId: "locations", ownershipId: "ownerships" })[field], value));
    if (field === "image") return value ? `<img src="${esc(value)}" alt="Gambar supplier" style="width:34px;height:34px;object-fit:cover;border-radius:7px">` : `<span class="badge neutral">—</span>`;
    if (field === "evidence") return value ? `<a href="${esc(value)}" target="_blank" rel="noopener" class="badge info">Lihat foto</a>` : `<span class="badge neutral">—</span>`;
    if (field === "status") return statusBadge(key === "locations" ? value : displayedStatus(key, value));
    if (field === "priority") return value === "Mendesak" ? `<span class="badge danger">Mendesak</span>` : `<span class="badge neutral">${esc(value || "Normal")}</span>`;
    if (key === "locations" && field === "condition") {
      if (!value) return `<span class="badge neutral">—</span>`;
      const tone = value === "Rusak Ringan" ? "warning" : "danger";
      return `<span class="badge ${tone}">${esc(value)}</span>`;
    }
    if (field === "condition") {
      const tone = value === "Hilang" || value === "Rusak Berat" ? "danger" : value === "Rusak" ? "warning" : value === "Dihapus" ? "neutral" : "success";
      return `<span class="badge ${tone}">${esc(value || "Baik")}</span>`;
    }
    if (field === "type") return `<span class="badge ${value === "prasarana" ? "info" : "warning"}">${esc(value)}</span>`;
    if (["date", "received", "receivedDate", "startDate", "endDate", "dueDate", "nextServiceDate"].includes(field)) return esc(niceDate(value));
    if (field === "late") {
      const lateDays = loanLateDays(row);
      return lateDays > 0 ? `<span class="badge danger">Terlambat ${lateDays} hari</span>` : "";
    }
    if (field === "total") return key === "procurements" ? currencyCell(row.quantity * row.unitPrice) : esc(value ?? "—");
    if (key === "goods" && ["price", "totalPrice"].includes(field)) {
      const amount = field === "totalPrice" ? (Number(row.quantity) || 0) * (Number(row.price) || 0) : value;
      return currencyCell(amount);
    }
    if (field === "totalPrice") return currencyCell((Number(row.quantity) || 0) * (Number(row.price) || 0));
    if (["price", "unitPrice", "estimatedCost", "initialValue", "residualValue", "amount", "accumulatedAmount", "finalValue"].includes(field)) return currencyCell(value);
    if (field === "consumable") return `<span class="badge ${isBhp(row) ? "success" : "neutral"}">${isBhp(row) ? "BHP" : "Barang Modal"}</span>`;
    if (field === "active") return `<span class="badge ${value ? "success" : "neutral"}">${value ? "Aktif" : "Nonaktif"}</span>`;
    if (field === "name" && key === "accounts") return `<span class="table-title">${esc(value)}</span>`;
    if (key === "locations" && field === "floor") return value === "" || value == null ? "—" : `Lantai ${esc(value)}`;
    if (key === "locations" && ["length", "width"].includes(field)) return value === "" || value == null ? "—" : `${esc(value)} m`;
    if (key === "locations" && field === "area") return value === "" || value == null ? "—" : `${esc(value)} m²`;
    return esc(value || "—");
  }

  function statusBadge(value) {
    const tone = ["Aktif", "Diterima", "Dipinjam", "Disetujui", "Selesai"].includes(value)
      ? "success"
      : ["Pengajuan", "Pending", "Menunggu Jadwal"].includes(value) ? "warning"
        : value === "Sedang Diservis" ? "info" : value === "Ditolak" ? "danger" : "neutral";
    return `<span class="badge ${tone}">${esc(value || "—")}</span>`;
  }

  function displayedStatus(key, value) {
    return key === "loans" && value === "Diterima" ? "Dipinjam" : value;
  }

  function loanLateDays(loan) {
    if (!loan.dueDate) return null;
    const comparisonDate = loan.status === "Diterima"
      ? dateOffset(0)
      : loan.status === "Selesai" ? loan.returnedDate : "";
    if (!comparisonDate) return null;
    return Math.max(0, daysBetweenDates(loan.dueDate, comparisonDate));
  }

  function renderBarcode() {
    const goods = recordsForAcademicYear("goods");
    return `${pageHeading(`<button class="btn-secondary" data-action="barcode-options"><i data-lucide="sliders-horizontal"></i>Opsi cetak QR Code</button><button class="btn-primary" data-action="print"><i data-lucide="printer"></i>Cetak barcode</button>`)}
      <div class="table-toolbar"><div class="table-toolbar-left"><label class="search-field"><i data-lucide="search"></i><input id="barcodeSearch" placeholder="Cari kode atau nama barang..."></label><span class="badge neutral">${goods.length} barang</span></div><div class="table-toolbar-right"><button class="btn-quiet" data-action="select-all"><i data-lucide="check-check"></i>Pilih semua</button></div></div>
      <div class="panel"><div class="barcode-grid" id="barcodeGrid">${goods.map((good) => barcodeCard(good)).join("") || `<div class="empty-state"><i data-lucide="inbox"></i>Belum ada data barang untuk dicetak.</div>`}</div></div>`;
  }
  function barcodeCard(good) {
    const schoolLogo = state.school.logo || state.school.letterheadLogo || "";
    return `<article class="barcode-card"><input type="checkbox" class="barcode-check" data-id="${esc(good.id)}" checked aria-label="Pilih ${esc(good.name)} untuk dicetak" style="accent-color:#f27622;float:left"><div class="qr-target" style="width:82px;height:82px;margin:5px auto 8px"><div class="qr-code-canvas" data-value="${esc(good.barcode)}"></div>${schoolLogo ? `<img class="qr-center-logo" src="${esc(schoolLogo)}" alt="Logo sekolah">` : ""}</div><b>${esc(good.barcode)}</b><small>${esc(good.name)}</small>${canEditPage("barcode") ? `<button type="button" class="btn-quiet barcode-edit-button no-print" data-action="edit-good-barcode" data-id="${esc(good.id)}"><i data-lucide="pencil"></i>Edit kode</button>` : ""}</article>`;
  }
  function editGoodBarcode(goodId) {
    if (!canEditPage("barcode")) return showToast("Akun Anda tidak memiliki izin mengubah kode barcode barang.", true);
    const good = getById("goods", goodId);
    if (!good || !recordsForAcademicYear("goods").some((record) => record.id === good.id)) return;
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Edit Kode Barcode</h2><p>${esc(good.name)}</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form id="barcodeEditForm" class="modal-form" data-good-id="${esc(good.id)}"><div class="form-field"><label for="goodBarcodeValue">Kode barcode</label><input id="goodBarcodeValue" name="barcode" type="text" value="${esc(good.barcode)}" required autocomplete="off"><small class="form-help">Kode harus unik pada data barang aktif.</small></div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="submit" class="btn-primary"><i data-lucide="save"></i>Simpan kode</button></div></form></section></div>`);
    $("#barcodeEditForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(new FormData(event.currentTarget).get("barcode") || "").trim();
      if (!value) return showToast("Kode barcode tidak boleh kosong.", true);
      const normalized = value.toLocaleLowerCase("id-ID");
      const duplicate = recordsForAcademicYear("goods").some((record) => record.id !== good.id
        && String(record.barcode || "").trim().toLocaleLowerCase("id-ID") === normalized);
      if (duplicate) return showToast("Kode barcode tersebut sudah digunakan barang lain.", true);
      good.barcode = value;
      saveState();
      closeModal();
      showToast("Kode barcode berhasil diperbarui.");
      renderPage();
    });
  }

  function renderReports() {
    const currentGoods = recordsForAcademicYear("goods");
    const goodsQty = currentGoods.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const value = currentGoods.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.price || 0), 0);
    const reportOptions = [["inventarisBhp", "Rekapitulasi BHP"], ["inventarisModal", "Rekapitulasi Barang Modal"], ["kib", "Kartu Inventaris Barang (KIB)"], ["roomConditions", "Kondisi Barang per Ruangan"], ["damageLoss", "Kerusakan & Kehilangan Aset"], ["maintenanceReport", "Jadwal Pemeliharaan / Servis"], ["stocktakeMinutes", "Berita Acara Stock Opname"], ["assetLifecycle", "Riwayat Pergerakan Aset"], ["loans", "Laporan Peminjaman"], ["usages", "Penggunaan BHP"], ["procurements", "Pengadaan Barang"], ["disposals", "Pemusnahan Barang"], ["depreciations", "Penyusutan Aset"]];
    return `${pageHeading(`<button class="btn-secondary" data-action="export-report"><i data-lucide="download"></i>Ekspor Excel</button><button class="btn-primary" data-action="print"><i data-lucide="printer"></i>Cetak laporan</button>`)}
      <section class="panel"><div class="report-heading">${state.school.logo ? `<img class="report-logo" src="${esc(state.school.logo)}" alt="Logo sekolah">` : `<div class="school-avatar">${esc((state.school.name || "S").slice(0, 1))}</div>`}<div><h2>${esc(state.school.name)}</h2><p>${esc(state.school.address)} · ${esc(state.school.phone)}</p><p>${esc(state.school.email)} · ${esc(state.school.website)}</p></div></div>
      <div class="table-toolbar report-toolbar" style="border:0;padding:0 0 14px"><div class="table-toolbar-left report-filters">
        <label class="report-filter-control"><span>Jenis laporan</span><select class="table-filter" id="reportType">${reportOptions.map(([val, label]) => `<option value="${val}">${label}</option>`).join("")}</select></label>
        <label class="report-filter-control" id="reportPeriodField"><span>Periode</span><select class="table-filter" id="reportPeriod"><option value="month">Bulanan</option><option value="academicYear">Tahun Pelajaran</option><option value="custom">Rentang tanggal</option></select></label>
        <label class="report-filter-control" id="reportMonthField"><span>Bulan</span><input id="reportMonth" class="table-filter" type="month" value="${currentMonth}"></label>
        <label class="report-filter-control hidden" id="reportAcademicYearField"><span>Tahun Pelajaran</span><select class="table-filter" id="reportAcademicYear">${state.academicYears.map((year) => `<option value="${esc(year.id)}" ${year.id === state.settings.selectedAcademicYearId ? "selected" : ""}>${esc(year.name)}</option>`).join("")}</select></label>
        <label class="report-filter-control" id="reportFundField"><span>Sumber Dana</span><select class="table-filter" id="reportFund"><option value="">Semua sumber dana</option>${state.funds.map((fund) => `<option value="${esc(fund.id)}">${esc(fund.name)}</option>`).join("")}</select></label>
        <label class="report-filter-control" id="reportLocationField"><span>Ruangan / Lokasi</span><select class="table-filter" id="reportLocation"><option value="">Semua ruangan</option>${state.locations.map((location) => `<option value="${esc(location.id)}">${esc(location.name)}</option>`).join("")}</select></label>
        <label class="report-filter-control hidden" id="assetLifecycleGoodField"><span>Barang</span><select class="table-filter" id="assetLifecycleGood">${currentGoods.map((good) => `<option value="${esc(good.id)}">${esc(good.name)}</option>`).join("")}</select></label>
        <div class="report-filter-control hidden" id="reportInventoryDetailsField"><span>Rincian barang</span><label class="form-check report-detail-toggle"><input id="reportInventoryDetails" type="checkbox" ${state.settings.reportInventoryDetails === false ? "" : "checked"}><span>Tampilkan detail barang</span></label></div>
        <div class="report-date-range hidden" id="reportDateRange">
          <label class="report-filter-control"><span>Tanggal mulai</span><input id="reportStart" class="table-filter" type="date" value="${currentMonth}-01"></label>
          <label class="report-filter-control"><span>Tanggal akhir</span><input id="reportEnd" class="table-filter" type="date" value="${dateOffset(0)}"></label>
        </div>
      </div><div class="table-toolbar-right"><span id="reportPeriodNotice" class="form-help hidden">Filter periode mengikuti tanggal barang masuk; jumlah dan kondisi adalah posisi saat ini.</span><span class="badge info">Diperbarui ${niceDate(dateOffset(0))}</span></div></div>
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
      kib: "Kartu Inventaris Barang (KIB)",
      roomConditions: "Laporan Kondisi Barang per Ruangan / Lokasi",
      damageLoss: "Laporan Kerusakan & Kehilangan Aset",
      maintenanceReport: "Laporan Jadwal Pemeliharaan / Servis",
      stocktakeMinutes: "Berita Acara Stock Opname",
      assetLifecycle: "Riwayat Pergerakan Aset",
      loans: "Laporan Peminjaman Barang",
      usages: "Laporan Penggunaan BHP",
      procurements: "Laporan Pengadaan Barang",
      disposals: "Laporan Pemusnahan Barang",
      depreciations: "Laporan Penyusutan Aset"
    };
    let period = `Posisi stok per ${niceDate(dateOffset(0))}`;
    if (type === "assetLifecycle") {
      period = `Barang: ${getById("goods", $("#assetLifecycleGood")?.value)?.name || "Pilih barang"} · ${reportHeadingPeriod(range)}`;
    } else {
      period = reportHeadingPeriod(range);
    }
    const filters = reportFilters();
    const filterLabels = [
      filters.fundId ? `Sumber Dana: ${relatedName("funds", filters.fundId)}` : "",
      filters.locationId ? `Ruangan: ${relatedName("locations", filters.locationId)}` : ""
    ].filter(Boolean);
    if (filterLabels.length) period = `${period} · ${filterLabels.join(" · ")}`;
    return { title: titles[type] || "Laporan", period };
  }
  function reportHeadingPeriod(range) {
    const filter = $("#reportPeriod")?.value || "month";
    if (filter === "month") {
      const [year, month] = ($("#reportMonth")?.value || currentMonth).split("-").map(Number);
      return year && month ? `Bulan ${new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))}` : "Bulan tidak valid";
    }
    if (filter === "academicYear") {
      const academicYear = state.academicYears.find((row) => row.id === $("#reportAcademicYear")?.value);
      return academicYear ? `Tahun Pelajaran ${academicYear.name}` : "Tahun pelajaran belum dipilih";
    }
    return range?.start && range?.end
      ? `Periode ${niceDate(range.start)} s.d. ${niceDate(range.end)}`
      : range?.start ? `Sejak ${niceDate(range.start)}` : range?.end ? `Sampai ${niceDate(range.end)}` : "Semua tanggal";
  }
  function reportHeading(type, range = null) {
    const { title, period } = reportHeadingContent(type, range);
    return `<div><h3>${esc(title)}</h3><p>${esc(period)}</p></div>`;
  }
  function inventoryReportData(type, startDate = "", endDate = "") {
    const showDetails = state.settings.reportInventoryDetails !== false;
    const goods = filteredReportGoods(type, startDate, endDate);
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
  function reportFilters() {
    return { fundId: $("#reportFund")?.value || "", locationId: $("#reportLocation")?.value || "" };
  }
  function matchesReportDate(value, startDate, endDate) {
    return (!startDate || value && value >= startDate) && (!endDate || value && value <= endDate);
  }
  function matchesReportAsset(good, startDate, endDate, filters = reportFilters(), dateField = "receivedDate") {
    return Boolean(good)
      && (!filters.fundId || good.fundId === filters.fundId)
      && (!filters.locationId || good.locationId === filters.locationId)
      && matchesReportDate(good[dateField] || "", startDate, endDate);
  }
  function filteredReportGoods(type, startDate = "", endDate = "") {
    return recordsForAcademicYear("goods").filter((good) =>
      (type !== "inventarisBhp" || isBhp(good))
      && (type !== "inventarisModal" || !isBhp(good))
      && matchesReportAsset(good, startDate, endDate)
    );
  }
  function kibClassCode(category) {
    const classification = String(category?.kibClass || "").trim();
    if (!classification || classification.toLocaleLowerCase("id-ID") === "non kib") return "";
    const match = /(?:KIB\s*)?([A-E])(?:\b|$)/i.exec(classification);
    return match?.[1]?.toUpperCase() || "";
  }
  function kibReportData(startDate = "", endDate = "") {
    const filters = reportFilters();
    const headers = ["No.", "Nama Barang / Jenis Barang", "Kode Barang", "Nomor Register", "Sumber Pendanaan", "Tahun Perolehan", "Kondisi", "Harga Perolehan (Rp)", "Keterangan"];
    const reportYearId = $("#reportPeriod")?.value === "academicYear"
      ? $("#reportAcademicYear")?.value || currentAcademicYearId()
      : currentAcademicYearId();
    return kibClasses.map(({ code, label }) => {
      const goods = recordsForAcademicYear("goods", reportYearId).filter((good) => {
        const category = getById("categories", good.categoryId);
        return kibClassCode(category) === code
          && !isBhp(good)
          && (!filters.fundId || good.fundId === filters.fundId)
          && matchesReportDate(good.receivedDate || "", startDate, endDate);
      });
      let number = 0;
      const rows = [];
      goods.forEach((good) => {
        const category = getById("categories", good.categoryId);
        const items = (state.items || []).filter((item) => item.goodId === good.id);
        const trackedCounts = { Baik: 0, Rusak: 0, Hilang: 0 };
        const conditionLabel = (condition) => condition === "Hilang" ? "Hilang"
          : condition === "Baik" ? "Baik"
            : condition === "Dihapus" ? "Dihapus" : "Rusak";
        const itemRows = items.filter((item) => !filters.locationId || (item.locationId || good.locationId) === filters.locationId);
        items.forEach((item) => {
          const label = conditionLabel(item.condition || "Baik");
          if (label in trackedCounts) trackedCounts[label] += 1;
        });
        const name = `${good.name}${relatedName("types", good.typeId) !== "—" ? ` / ${relatedName("types", good.typeId)}` : ""}`;
        const baseRow = (register, condition, price, note) => [
          ++number,
          name,
          good.assetCode || "Belum diisi",
          register,
          relatedName("funds", good.fundId),
          String(good.receivedDate || "").slice(0, 4) || "—",
          condition,
          price,
          note || good.specification || category?.note || "—"
        ];
        itemRows.forEach((item) => rows.push(baseRow(
          item.code || "Belum diisi",
          conditionLabel(item.condition || "Baik"),
          Number(good.price) || 0,
          item.note || good.specification || category?.note || "—"
        )));
        const remaining = Math.max(0, (Number(good.quantity) || 0) - items.length);
        if (!remaining || filters.locationId && good.locationId !== filters.locationId) return;
        const hasConditionSummary = ["goodConditionCount", "damagedConditionCount", "missingConditionCount"]
          .some((field) => Object.prototype.hasOwnProperty.call(good, field));
        const remainingByCondition = hasConditionSummary
          ? {
            Baik: Math.max(0, (Number(good.goodConditionCount) || 0) - trackedCounts.Baik),
            Rusak: Math.max(0, (Number(good.damagedConditionCount) || 0) - trackedCounts.Rusak),
            Hilang: Math.max(0, (Number(good.missingConditionCount) || 0) - trackedCounts.Hilang)
          }
          : { Baik: remaining, Rusak: 0, Hilang: 0 };
        let unassigned = remaining - Object.values(remainingByCondition).reduce((sum, count) => sum + count, 0);
        if (unassigned > 0) remainingByCondition.Baik += unassigned;
        else if (unassigned < 0) {
          unassigned = -unassigned;
          for (const condition of ["Baik", "Rusak", "Hilang"]) {
            const reduction = Math.min(remainingByCondition[condition], unassigned);
            remainingByCondition[condition] -= reduction;
            unassigned -= reduction;
          }
        }
        Object.entries(remainingByCondition).forEach(([condition, quantity]) => {
          if (!quantity) return;
          rows.push(baseRow(
            `Belum dibuatkan nomor register (${integerId.format(quantity)} unit)`,
            condition,
            (Number(good.price) || 0) * quantity,
            `${good.specification || category?.note || "—"} · ${integerId.format(quantity)} unit belum dirinci per item`
          ));
        });
      });
      return { code, label, headers, rows };
    });
  }
  function roomConditionReportData(startDate, endDate) {
    const headers = ["Ruangan / Lokasi", "Nama Barang", "Baik", "Rusak", "Hilang", "Total"];
    const fields = ["location", "good", "goodQty", "damagedQty", "missingQty", "total"];
    const filters = reportFilters();
    const goods = recordsForAcademicYear("goods").filter((good) =>
      (!filters.fundId || good.fundId === filters.fundId)
      && matchesReportDate(good.receivedDate || "", startDate, endDate)
    );
    const goodIds = new Set(goods.map((good) => good.id));
    const grouped = new Map();
    const ensureRow = (good, locationId) => {
      const key = `${locationId || ""}:${good.id}`;
      if (!grouped.has(key)) grouped.set(key, {
        location: relatedName("locations", locationId),
        good: good.name,
        goodQty: 0,
        damagedQty: 0,
        missingQty: 0
      });
      return grouped.get(key);
    };
    const trackedByGood = new Map();
    const trackedConditionsByGood = new Map();
    (state.items || []).filter((item) => goodIds.has(item.goodId)).forEach((item) => {
      const good = goods.find((row) => row.id === item.goodId);
      if (!good) return;
      trackedByGood.set(good.id, (trackedByGood.get(good.id) || 0) + (item.condition === "Hilang" ? 0 : 1));
      const tracked = trackedConditionsByGood.get(good.id) || { goodQty: 0, damagedQty: 0, missingQty: 0, totalCount: 0 };
      tracked.totalCount += 1;
      if (item.condition === "Hilang") tracked.missingQty += 1;
      else if (item.condition === "Rusak" || item.condition === "Rusak Berat") tracked.damagedQty += 1;
      else tracked.goodQty += 1;
      trackedConditionsByGood.set(good.id, tracked);
      const locationId = item.locationId || good.locationId;
      if (filters.locationId && locationId !== filters.locationId) return;
      const row = ensureRow(good, locationId);
      if (item.condition === "Hilang") row.missingQty += 1;
      else if (item.condition === "Rusak" || item.condition === "Rusak Berat") row.damagedQty += 1;
      else row.goodQty += 1;
    });
    goods.forEach((good) => {
      const hasConditionSummary = ["goodConditionCount", "damagedConditionCount", "missingConditionCount"]
        .some((field) => Object.prototype.hasOwnProperty.call(good, field));
      if (hasConditionSummary) {
        const tracked = trackedConditionsByGood.get(good.id) || { goodQty: 0, damagedQty: 0, missingQty: 0, totalCount: 0 };
        const remaining = Math.max(0, (Number(good.quantity) || 0) - tracked.totalCount);
        if (!remaining || filters.locationId && good.locationId !== filters.locationId) return;
        const counts = {
          goodQty: Math.max(0, (Number(good.goodConditionCount) || 0) - tracked.goodQty),
          damagedQty: Math.max(0, (Number(good.damagedConditionCount) || 0) - tracked.damagedQty),
          missingQty: Math.max(0, (Number(good.missingConditionCount) || 0) - tracked.missingQty)
        };
        let difference = remaining - Object.values(counts).reduce((sum, count) => sum + count, 0);
        if (difference > 0) counts.goodQty += difference;
        else if (difference < 0) {
          difference = -difference;
          for (const field of ["goodQty", "damagedQty", "missingQty"]) {
            const reduction = Math.min(counts[field], difference);
            counts[field] -= reduction;
            difference -= reduction;
          }
        }
        const row = ensureRow(good, good.locationId);
        row.goodQty += counts.goodQty;
        row.damagedQty += counts.damagedQty;
        row.missingQty += counts.missingQty;
        return;
      }
      const remaining = Math.max(0, (Number(good.quantity) || 0) - (trackedByGood.get(good.id) || 0));
      if (!remaining || filters.locationId && good.locationId !== filters.locationId) return;
      ensureRow(good, good.locationId).goodQty += remaining;
    });
    return { headers, fields, rows: [...grouped.values()].map((row) => [
      row.location, row.good, row.goodQty, row.damagedQty, row.missingQty, row.goodQty + row.damagedQty + row.missingQty
    ]) };
  }
  function damageLossReportData(startDate, endDate) {
    const headers = ["Tanggal", "Barang / Item", "Kondisi / Kejadian", "Jumlah", "Ruangan", "Status Penanganan", "Keterangan"];
    const fields = ["date", "asset", "event", "quantity", "location", "status", "note"];
    const goods = recordsForAcademicYear("goods");
    const goodById = new Map(goods.map((good) => [good.id, good]));
    const filters = reportFilters();
    const rows = [];
    (state.items || []).filter((item) => {
      const good = goodById.get(item.goodId);
      return good && ["Rusak", "Rusak Berat", "Hilang"].includes(item.condition)
        && (!filters.fundId || good.fundId === filters.fundId)
        && (!filters.locationId || (item.locationId || good.locationId) === filters.locationId)
        && matchesReportDate(item.conditionDate || item.received || "", startDate, endDate);
    }).forEach((item) => {
      const good = goodById.get(item.goodId);
      const ticket = (state.repairTickets || []).find((row) => row.goodId === good.id && (!row.locationId || row.locationId === item.locationId));
      rows.push([
        item.conditionDate || item.received || "",
        `${good.name}${item.code ? ` (${item.code})` : ""}`,
        item.condition,
        1,
        relatedName("locations", item.locationId || good.locationId),
        item.condition === "Hilang" ? "Perlu penelusuran" : ticket ? ticket.status : "Belum ada tiket perbaikan",
        ticket ? ticket.title : "Kondisi item inventaris"
      ]);
    });
    (state.repairTickets || []).filter((ticket) => {
      const good = goodById.get(ticket.goodId);
      const hasTrackedCondition = (state.items || []).some((item) => item.goodId === ticket.goodId && ["Rusak", "Rusak Berat"].includes(item.condition));
      const ticketDate = String(ticket.createdAt || ticket.date || "").slice(0, 10);
      return good && !hasTrackedCondition
        && (!filters.fundId || good.fundId === filters.fundId)
        && (!filters.locationId || (ticket.locationId || good.locationId) === filters.locationId)
        && matchesReportDate(ticketDate, startDate, endDate);
    }).forEach((ticket) => {
      const good = goodById.get(ticket.goodId);
      rows.push([
        String(ticket.createdAt || ticket.date || "").slice(0, 10),
        good.name,
        `Kerusakan dilaporkan · ${ticket.priority || "Prioritas normal"}`,
        Number(ticket.quantity) || 1,
        relatedName("locations", ticket.locationId || good.locationId),
        ticket.status || "Diajukan",
        ticket.title || ticket.description || "Tiket perbaikan"
      ]);
    });
    (state.stocktakes || []).filter((record) => {
      const good = goodById.get(record.goodId);
      const missing = Math.max(0, Number(record.missingQuantity ?? (Number(record.oldStock || 0) - Number(record.newStock || 0))));
      return good && missing > 0
        && matchesReportDate(record.date || "", startDate, endDate)
        && (!filters.fundId || good.fundId === filters.fundId)
        && (!filters.locationId || (record.locationId || good.locationId) === filters.locationId);
    }).forEach((record) => {
      const good = goodById.get(record.goodId);
      rows.push([
        record.date || "",
        good.name,
        "Hilang saat stock opname",
        Math.max(0, Number(record.missingQuantity ?? (Number(record.oldStock || 0) - Number(record.newStock || 0)))),
        relatedName("locations", record.locationId || good.locationId),
        record.lossStatus || "Perlu penelusuran",
        record.note || "Jumlah fisik lebih sedikit dari stok sistem"
      ]);
    });
    return { headers, fields, rows: rows.map((row) => row.map((cell, index) => index === 0 && cell ? niceDate(cell) : cell)) };
  }
  function maintenanceReportData(startDate, endDate) {
    const headers = ["Tanggal", "Barang", "Jenis Perawatan", "Peristiwa / Catatan", "Jumlah", "Ruangan", "Status", "Estimasi Biaya Servis", "Servis Berikutnya", "Teknisi"];
    const fields = ["date", "good", "type", "action", "quantity", "location", "status", "estimatedCost", "nextServiceDate", "technician"];
    const filters = reportFilters();
    const goodsById = new Map(recordsForAcademicYear("goods").map((good) => [good.id, good]));
    const matches = (row) => {
      const good = goodsById.get(row.goodId);
      return good
        && matchesReportDate(String(row.updatedAt || row.date || "").slice(0, 10), startDate, endDate)
        && (!filters.fundId || good.fundId === filters.fundId)
        && (!filters.locationId || (row.locationId || good.locationId) === filters.locationId);
    };
    const schedules = (state.maintenanceSchedules || []).filter(matches).map((row) => [
      row.date ? niceDate(row.date) : "—",
      titleOfGood(row.goodId),
      row.type || "—",
      row.description || "Jadwal perawatan",
      Number(row.quantity) || 0,
      relatedName("locations", row.locationId || goodsById.get(row.goodId)?.locationId),
      row.status || "Menunggu Jadwal",
      Number(row.estimatedCost) || 0,
      row.nextServiceDate ? niceDate(row.nextServiceDate) : "—",
      row.technician || "—"
    ]);
    const history = (state.maintenanceHistory || []).filter(matches).map((row) => [
      niceDate(String(row.updatedAt || row.date || "").slice(0, 10)),
      titleOfGood(row.goodId),
      row.type || "—",
      row.action || "Perawatan diperbarui",
      Number(row.quantity) || 0,
      relatedName("locations", row.locationId || goodsById.get(row.goodId)?.locationId),
      row.status || "Menunggu Jadwal",
      Number(row.estimatedCost) || 0,
      row.nextServiceDate ? niceDate(row.nextServiceDate) : "—",
      row.technician || "—"
    ]);
    return { headers, fields, rows: [...schedules, ...history] };
  }
  function stocktakeMinutesReportData(startDate, endDate) {
    const headers = ["Tanggal", "Nama Barang", "Ruangan", "Stok Sistem", "Hasil Fisik", "Selisih / Hilang", "Sumber Dana", "Pengecek", "Status Penanganan", "Berita Acara / Catatan"];
    const fields = ["date", "good", "location", "oldStock", "newStock", "missingQuantity", "fund", "checker", "lossStatus", "note"];
    const filters = reportFilters();
    const goodsById = new Map(recordsForAcademicYear("goods").map((good) => [good.id, good]));
    const rows = (state.stocktakes || []).filter((record) => {
      const good = goodsById.get(record.goodId);
      return good && matchesReportDate(record.date || "", startDate, endDate)
        && (!filters.fundId || good.fundId === filters.fundId)
        && (!filters.locationId || (record.locationId || good.locationId) === filters.locationId);
    }).map((record) => {
      const good = goodsById.get(record.goodId);
      return [
        record.date ? niceDate(record.date) : "—",
        good.name,
        relatedName("locations", record.locationId || good.locationId),
        Number(record.oldStock) || 0,
        Number(record.newStock) || 0,
        Math.max(0, Number(record.missingQuantity ?? (Number(record.oldStock || 0) - Number(record.newStock || 0)))),
        relatedName("funds", good.fundId),
        record.checker || "—",
        record.lossStatus || (Number(record.oldStock) > Number(record.newStock) ? "Perlu penelusuran" : "Tidak ada kehilangan"),
        record.note || "—"
      ];
    });
    return { headers, fields, rows };
  }
  function reportTable(type, startDate, endDate) {
    if (type === "kib") {
      return kibReportData(startDate, endDate).map((section) => `
        <section class="kib-report-section">
          <h4>${esc(section.label)}</h4>
          <div class="table-wrap"><table class="data-table kib-report-table">
            <thead><tr>${section.headers.map((header) => `<th>${esc(header.toUpperCase())}</th>`).join("")}</tr></thead>
            <tbody>${section.rows.length ? section.rows.map((row) => `<tr>${row.map((cell, index) => index === 7
              ? `<td class="goods-price-cell">${currencyCell(cell)}</td>`
              : `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty-state" colspan="${section.headers.length}">Tidak ada data KIB ${section.code}.</td></tr>`}</tbody>
          </table></div>
        </section>`).join("");
    }
    let cols, fields, rows;
    if (type === "assetLifecycle") {
      ({ headers: cols, fields, rows } = assetLifecycleReportData($("#assetLifecycleGood")?.value || "", startDate, endDate));
    } else if (isInventoryReport(type)) {
      ({ headers: cols, fields, rows } = inventoryReportData(type, startDate, endDate));
    } else if (type === "roomConditions") {
      ({ headers: cols, fields, rows } = roomConditionReportData(startDate, endDate));
    } else if (type === "damageLoss") {
      ({ headers: cols, fields, rows } = damageLossReportData(startDate, endDate));
    } else if (type === "maintenanceReport") {
      ({ headers: cols, fields, rows } = maintenanceReportData(startDate, endDate));
    } else if (type === "stocktakeMinutes") {
      ({ headers: cols, fields, rows } = stocktakeMinutesReportData(startDate, endDate));
    } else {
      const config = collectionConfig[type];
      cols = config.cols.map((col) => col[1]);
      fields = config.cols.map(([field]) => field);
      const dateField = ({ loans: "startDate", items: "received", stocktakes: "date", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
      const filters = reportFilters();
      rows = (state[type] || []).filter((row) => {
        if (dateField && !matchesReportDate(row[dateField] || "", startDate, endDate)) return false;
        const good = row.goodId ? getById("goods", row.goodId) : null;
        return (!filters.fundId || (row.fundId || good?.fundId) === filters.fundId)
          && (!filters.locationId || (row.locationId || good?.locationId) === filters.locationId);
      }).map((row) => config.cols.map(([field]) => plainCell(type, field, row)));
    }
    const currencyFields = new Set(["price", "unitPrice", "estimatedCost", "initialValue", "residualValue", "amount", "accumulatedAmount", "finalValue", "total", "totalPrice", "value"]);
    const inventoryTotal = isInventoryReport(type)
      ? filteredReportGoods(type, startDate, endDate).reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.price) || 0), 0)
      : 0;
    const inventoryName = type === "inventarisBhp" ? "BHP" : "Barang Modal";
    const totalRow = isInventoryReport(type) ? `<tfoot><tr><th colspan="${cols.length - 1}">Grand Total Nilai ${inventoryName}</th><th class="goods-price-cell">${currencyCell(inventoryTotal)}</th></tr></tfoot>` : "";
    const tableClass = isInventoryReport(type) ? `data-table inventory-report-table ${state.settings.reportInventoryDetails === false ? "inventory-report-compact" : "inventory-report-details"}` : "data-table";
    return `<div class="table-wrap"><table class="${tableClass}"><thead><tr>${cols.map((col) => `<th>${esc(col.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell, index) => currencyFields.has(fields[index]) ? `<td class="goods-price-cell">${currencyCell(cell)}</td>` : `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty-state" colspan="${cols.length}">Tidak ada data.</td></tr>`}</tbody>${totalRow}</table></div>`;
  }

  function assetLifecycleReportData(goodId, startDate = "", endDate = "") {
    const headers = ["Tanggal", "Peristiwa", "Detail", "Orang / Lokasi", "Penanggung Jawab / Status"];
    const fields = ["date", "event", "detail", "related", "actor"];
    const good = getById("goods", goodId);
    if (!good) return { headers, fields, rows: [] };
    const filters = reportFilters();
    if (filters.fundId && good.fundId !== filters.fundId || filters.locationId && good.locationId !== filters.locationId) {
      return { headers, fields, rows: [] };
    }
    const events = [];
    const purchases = (state.procurements || []).filter((row) => row.goodId === good.id && row.status === "Diterima");
    purchases.forEach((row) => events.push({
      date: row.date || "",
      event: "Pembelian / barang masuk",
      detail: `${Number(row.quantity) || 0} ${relatedName("units", good.unitId)} · ${rupiah((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0))}${row.note ? ` · ${row.note}` : ""}`,
      related: `${relatedName("funds", row.fundId)} · ${relatedName("suppliers", row.supplierId || good.supplierId)}`,
      actor: row.proposer || "—"
    }));
    if (!purchases.some((row) => row.date === good.receivedDate) && good.receivedDate) {
      events.push({
        date: good.receivedDate,
        event: "Barang masuk (data barang)",
        detail: `${Number(good.quantity) || 0} ${relatedName("units", good.unitId)} · harga satuan ${rupiah(good.price)}`,
        related: `${relatedName("funds", good.fundId)} · ${relatedName("suppliers", good.supplierId)}`,
        actor: "Data inventaris"
      });
    } else if (!good.receivedDate) {
      events.push({
        date: "",
        event: "Data awal barang",
        detail: "Tanggal masuk belum dicatat pada data barang.",
        related: `${relatedName("funds", good.fundId)} · ${relatedName("suppliers", good.supplierId)}`,
        actor: "Data inventaris"
      });
    }
    (state.loans || []).filter((row) => row.goodId === good.id && ["Diterima", "Dipinjam", "Selesai"].includes(row.status))
      .forEach((row) => {
        const quantity = `${row.quantity || 1} ${relatedName("units", good.unitId)}`;
        events.push({
          date: row.startDate || "",
          event: "Peminjaman",
          detail: `${quantity} · ${row.note || "—"}`,
          related: row.borrower || "—",
          actor: "Dipinjam"
        });
        if (row.status === "Selesai") {
          events.push({
            date: row.returnedDate || "",
            event: "Pengembalian barang",
            detail: row.returnedDate ? quantity : `${quantity} · Tanggal pengembalian belum tercatat`,
            related: row.borrower || "—",
            actor: "Dikembalikan / Selesai"
          });
        }
      });
    (state.assetMovements || []).filter((row) => row.goodId === good.id)
      .forEach((row) => events.push({
        date: row.date || "",
        event: "Pemindahan ruang",
        detail: `${row.itemCode ? `${row.itemCode} · ` : ""}${row.fromLocationName || "Belum ditentukan"} → ${row.toLocationName || "—"}${row.note ? ` · ${row.note}` : ""}`,
        related: row.toLocationName || "—",
        actor: row.responsible || "—"
      }));
    (state.disposals || []).filter((row) => row.goodId === good.id && ["Diterima", "Selesai"].includes(row.status))
      .forEach((row) => events.push({
        date: row.completedAt || row.date || "",
        event: "Pemusnahan aset",
        detail: `${Number(row.quantity) || 0} ${relatedName("units", good.unitId)} · ${row.reason || "—"}`,
        related: relatedName("locations", row.locationId),
        actor: row.status
      }));
    events.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return String(a.date).localeCompare(String(b.date));
    });
    return { headers, fields, rows: events.filter((row) => matchesReportDate(row.date || "", startDate, endDate)).map((row) => [
      row.date ? niceDate(row.date) : "Tanggal tidak tercatat", row.event, row.detail, row.related, row.actor
    ]) };
  }

  function renderAccounts() {
    const available = ["dashboard", "goods", "checkGoods", "loans", "procurements", "disposals", "reports", "activityLog", "trash", "helpTickets", "userGuide", "backup"];
    if (!Array.isArray(mobileNavDraft)) mobileNavDraft = [...(state.settings.mobileNav || seed.settings.mobileNav)];
    if (mobileNavHighlightDraft === null) mobileNavHighlightDraft = state.settings.mobileNavHighlight || "checkGoods";
    if (!mobileNavDraft.includes(mobileNavHighlightDraft)) mobileNavHighlightDraft = mobileNavDraft.includes("checkGoods") ? "checkGoods" : mobileNavDraft[Math.floor(mobileNavDraft.length / 2)] || "";
    const labels = Object.fromEntries([...available, ...permissionPages, "accounts", "backup", "waNotifications"].map((key) => [key, meta[key][0]]));
    const accessMenus = permissionPages.map((key) => `
      <details class="role-permission-menu">
        <summary>${esc(labels[key])}</summary>
        <div class="role-permission-list">
          <div class="role-permission-row role-permission-admin"><span class="role-permission-name">Administrator</span><span class="role-permission-level">Lihat, edit & hapus</span></div>
          ${permissionRoles.map((role) => `<div class="role-permission-row"><span class="role-permission-name">${esc(role)}</span><select class="table-filter permission-select role-permission-select" data-menu="${key}" data-role="${esc(role)}" ${canEditPage("accounts") ? "" : "disabled"}><option value="hidden" ${state.settings.permissions[role][key] === "hidden" ? "selected" : ""}>Tidak terlihat</option><option value="view" ${state.settings.permissions[role][key] === "view" ? "selected" : ""}>Lihat saja</option><option value="edit" ${state.settings.permissions[role][key] === "edit" ? "selected" : ""}>Lihat & edit</option><option value="delete" ${state.settings.permissions[role][key] === "delete" ? "selected" : ""}>Lihat, edit & hapus</option></select></div>`).join("")}
        </div>
      </details>`).join("");
    const adminOnlyMenus = ["accounts", "backup", "waNotifications"].map((key) => `
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
      <div class="backup-note"><i data-lucide="shield-check"></i><span>Restore mengganti data aplikasi, tetapi tetap mempertahankan akun Administrator yang sedang masuk. Buat backup terlebih dahulu sebelum memulihkan data.</span></div></section>
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

  function renderPublicPortal() {
    const enabled = tenantSchool?.publicPortalEnabled !== false;
    const schoolCode = tenantSchool?.code || "";
    const portalUrl = schoolCode ? new URL(`/portal/${encodeURIComponent(schoolCode)}`, location.origin).href : "";
    const editable = activeUser?.role === "Administrator" && Boolean(apiAvailable && schoolCode);
    return `${pageHeading()}<section class="settings-card public-portal-settings">
      <div class="backup-card-heading"><span class="backup-icon"><i data-lucide="globe-2"></i></span><div><h3>Portal Publik Inventaris</h3><p>Bagikan ketersediaan barang sekolah kepada warga sekolah tanpa memberikan akses ke akun pengelola.</p></div><span class="badge ${enabled ? "success" : "neutral"}">${enabled ? "Aktif" : "Nonaktif"}</span></div>
      <div class="public-portal-share"><div><small>Alamat portal publik</small><strong id="publicPortalUrl">${portalUrl ? esc(portalUrl) : "Portal publik memerlukan akun sekolah online."}</strong></div>${portalUrl ? `<div class="public-portal-actions"><button type="button" class="btn-secondary" data-action="copy-public-portal-link"><i data-lucide="copy"></i>Salin link</button><a class="btn-secondary" href="${esc(portalUrl)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Buka portal</a></div>` : ""}</div>
      ${portalUrl ? `<div class="public-portal-qr-card"><div class="public-portal-qr-copy"><span class="eyebrow">QR CODE PORTAL</span><h3>Scan untuk membuka portal sekolah</h3><p>QR Code ini mengarah otomatis ke halaman inventaris publik dengan kode sekolah ${esc(schoolCode)}.</p><button type="button" class="btn-primary" data-action="download-public-portal-qr"><i data-lucide="download"></i>Unduh QR Code</button><small id="publicPortalQrStatus" class="form-help" aria-live="polite"></small></div><div id="publicPortalQr" class="public-portal-qr" data-url="${esc(portalUrl)}" role="img" aria-label="QR Code untuk portal publik sekolah"></div></div>` : ""}
      <form id="publicPortalSettingsForm"><label class="form-check public-portal-toggle"><input id="publicPortalEnabled" name="enabled" type="checkbox" ${enabled ? "checked" : ""} ${editable ? "" : "disabled"}><span>Aktifkan portal publik dan pencarian inventaris</span></label>
      <p class="form-help">Pengunjung dapat mencari barang atau memindai kode QR item. Portal hanya menampilkan nama barang, kategori, dan ringkasan stok/kondisi; data akun, transaksi pribadi, dan informasi pemasok tidak ditampilkan.</p>
      <div class="modal-footer">${editable ? `<button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan pengaturan</button>` : `<small class="form-help">Pengaturan ini hanya dapat diubah Administrator pada akun sekolah yang terhubung ke server.</small>`}</div></form>
    </section>`;
  }

  function drawPublicPortalQr() {
    const target = $("#publicPortalQr");
    if (!target) return;
    target.replaceChildren();
    if (!window.QRCode) {
      $("#publicPortalQrStatus").textContent = "Generator QR Code tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.";
      return;
    }
    new QRCode(target, {
      text: target.dataset.url,
      width: 192,
      height: 192,
      colorDark: "#253044",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    $("#publicPortalQrStatus").textContent = "QR Code siap dipindai atau diunduh.";
  }

  async function copyPublicPortalLink() {
    const url = $("#publicPortalUrl")?.textContent.trim();
    if (!url || !/^https?:\/\//.test(url)) return showToast("Link portal publik belum tersedia.", true);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link portal publik berhasil disalin.");
    } catch (error) {
      showToast(`Link tidak dapat disalin: ${error.message}`, true);
    }
  }

  function downloadPublicPortalQr() {
    const target = $("#publicPortalQr");
    const canvas = target?.querySelector("canvas");
    const image = target?.querySelector("img");
    const dataUrl = canvas?.toDataURL("image/png") || image?.src;
    if (!dataUrl) return showToast("QR Code belum siap diunduh.", true);
    const code = tenantSchool?.code || "sekolah";
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `portal-publik-${code}.png`;
    link.click();
  }

  function bindPublicPortalSettings() {
    $("#publicPortalSettingsForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (activeUser?.role !== "Administrator" || !apiAvailable) return showToast("Hanya Administrator online yang dapat mengubah Portal Publik.", true);
      const enabled = $("#publicPortalEnabled")?.checked === true;
      try {
        const response = await fetch("/api/tenant/public-portal-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        tenantSchool = { ...tenantSchool, publicPortalEnabled: result.enabled };
        showToast(`Portal Publik berhasil ${enabled ? "diaktifkan" : "dinonaktifkan"}.`);
        renderPage();
      } catch (error) {
        showToast(`Pengaturan Portal Publik gagal disimpan: ${error.message}`, true);
      }
    });
  }

  function renderWhatsAppNotifications() {
    const editable = activeUser?.role === "Administrator";
    return `${pageHeading()}<form id="whatsappSettingsForm" class="settings-card">
      <div class="backup-card-heading"><span class="backup-icon telegram"><i data-lucide="message-circle"></i></span><div><h3>Notifikasi WhatsApp Gateway</h3><p>Kirim pengingat peminjaman dan pemberitahuan pengajuan pengadaan melalui Fonnte.</p></div><span id="whatsappGatewayStatus" class="badge neutral">Memuat pengaturan…</span></div>
      <div class="backup-note"><i data-lucide="shield-check"></i><span>Token API disimpan terenkripsi di server dan tidak dikirim kembali ke browser. Siapkan perangkat Fonnte aktif; biaya dan kebijakan pengiriman mengikuti penyedia.</span></div>
      <div class="form-grid">
        <div class="form-field full"><label for="fonnteToken">Token API Fonnte</label><input id="fonnteToken" name="fonnteToken" type="password" autocomplete="new-password" placeholder="Token disimpan terenkripsi" ${editable ? "" : "disabled"}><small id="fonnteTokenStatus" class="form-help">Token tidak pernah ditampilkan kembali.</small></div>
        <div class="form-field"><label for="whatsappReminderDays">Pengingat sebelum jatuh tempo</label><select id="whatsappReminderDays" name="reminderDays" ${editable ? "" : "disabled"}>${[0, 1, 2, 3, 5, 7, 14].map((days) => `<option value="${days}">${days === 0 ? "Pada hari jatuh tempo" : `${days} hari sebelumnya`}</option>`).join("")}</select></div>
        <div class="form-field"><label for="whatsappSendTime">Waktu pengingat harian</label><input id="whatsappSendTime" name="sendTime" type="time" value="08:00" required ${editable ? "" : "disabled"}></div>
        <div class="form-field"><label for="whatsappTimezone">Zona waktu</label><select id="whatsappTimezone" name="timezone" ${editable ? "" : "disabled"}><option value="Asia/Jakarta">WIB — Asia/Jakarta</option><option value="Asia/Makassar">WITA — Asia/Makassar</option><option value="Asia/Jayapura">WIT — Asia/Jayapura</option></select></div>
        <div class="form-field"><label>WhatsApp Kepala Sekolah</label><div class="whatsapp-principal-display"><span id="whatsappPrincipalNumber">${esc(state.school.principalWhatsapp || "Belum diisi")}</span><button class="btn-quiet" type="button" data-nav="school">Atur nomor</button></div><small class="form-help">Tujuan notifikasi otomatis pengajuan pengadaan.</small></div>
        <div class="form-field full"><label class="form-check"><input id="whatsappNotifyLoans" name="notifyLoans" type="checkbox" ${editable ? "" : "disabled"}><span>Kirim pengingat ke peminjam menjelang jatuh tempo dan saat terlambat</span></label><small class="form-help">Setiap peminjaman harus memiliki nomor WhatsApp peminjam untuk menerima pengingat.</small></div>
        <div class="form-field full"><label class="form-check"><input id="whatsappNotifyProcurements" name="notifyProcurements" type="checkbox" ${editable ? "" : "disabled"}><span>Kirim notifikasi ke Kepala Sekolah saat ada pengajuan pengadaan baru</span></label></div>
        <div class="form-field full"><label class="form-check"><input id="whatsappNotificationsEnabled" name="enabled" type="checkbox" ${editable ? "" : "disabled"}><span>Aktifkan gateway dan pengiriman otomatis</span></label><small class="form-help">Pengadaan yang belum diberitahukan dikirim otomatis; pengingat pinjaman berjalan pada waktu yang dipilih. Server harus tetap aktif.</small></div>
      </div>
      <div class="modal-footer" style="justify-content:space-between"><span class="form-help"><a href="https://fonnte.com" target="_blank" rel="noopener">Buka Fonnte</a> untuk memperoleh token gateway.</span><div style="display:flex;gap:8px"><button type="button" class="btn-secondary" data-action="whatsapp-test" ${editable ? "" : "disabled"}><i data-lucide="send"></i>Uji koneksi</button>${editable ? `<button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan pengaturan</button>` : ""}</div></div>
    </form>`;
  }

  async function loadWhatsAppNotificationSettings() {
    try {
      const response = await fetch("/api/whatsapp/settings");
      const config = await response.json();
      if (!response.ok) throw new Error(config.error || `HTTP ${response.status}`);
      if (page !== "waNotifications" || !$("#whatsappSettingsForm")) return;
      $("#whatsappReminderDays").value = String(config.reminderDays);
      $("#whatsappSendTime").value = config.sendTime || "08:00";
      $("#whatsappTimezone").value = config.timezone || "Asia/Jakarta";
      $("#whatsappNotifyLoans").checked = Boolean(config.notifyLoans);
      $("#whatsappNotifyProcurements").checked = Boolean(config.notifyProcurements);
      $("#whatsappNotificationsEnabled").checked = Boolean(config.enabled);
      $("#whatsappPrincipalNumber").textContent = config.principalWhatsapp || "Belum diisi";
      $("#whatsappGatewayStatus").className = `badge ${config.enabled ? "success" : "neutral"}`;
      $("#whatsappGatewayStatus").textContent = config.enabled ? "Aktif" : "Nonaktif";
      $("#fonnteTokenStatus").textContent = config.tokenConfigured
        ? "Token Fonnte tersimpan terenkripsi. Isi hanya jika ingin menggantinya."
        : "Token belum disimpan. Token tidak pernah ditampilkan kembali.";
      $("#fonnteToken").placeholder = config.tokenConfigured ? "Token tersimpan (kosongkan untuk mempertahankan)" : "Tempel token API Fonnte";
    } catch (error) {
      if ($("#whatsappGatewayStatus")) {
        $("#whatsappGatewayStatus").className = "badge danger";
        $("#whatsappGatewayStatus").textContent = "Server tidak tersedia";
        showToast(`Pengaturan WhatsApp tidak dapat dimuat: ${error.message}`, true);
      }
    }
  }

  async function saveWhatsAppNotificationSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      fonnteToken: form.elements.fonnteToken.value.trim(),
      enabled: form.elements.enabled.checked,
      notifyLoans: form.elements.notifyLoans.checked,
      notifyProcurements: form.elements.notifyProcurements.checked,
      reminderDays: Number(form.elements.reminderDays.value),
      sendTime: form.elements.sendTime.value,
      timezone: form.elements.timezone.value
    };
    try {
      const response = await fetch("/api/whatsapp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      form.elements.fonnteToken.value = "";
      await loadWhatsAppNotificationSettings();
      showToast("Pengaturan notifikasi WhatsApp berhasil disimpan.");
    } catch (error) {
      showToast(`Pengaturan WhatsApp gagal disimpan: ${error.message}`, true);
    }
  }

  async function testWhatsAppGateway() {
    try {
      const response = await fetch("/api/whatsapp/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      showToast("Pesan uji berhasil dikirim ke WhatsApp Kepala Sekolah.");
    } catch (error) {
      showToast(`Uji koneksi WhatsApp gagal: ${error.message}`, true);
    }
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
      const currentAdmin = state.accounts.find((account) =>
        account.id === activeUser?.id && account.role === "Administrator" && account.active);
      if (currentAdmin) {
        backupState.accounts = backupState.accounts.filter((account) =>
          account.role !== "Administrator" &&
          account.id !== currentAdmin.id &&
          String(account.email || "").toLowerCase() !== currentAdmin.email.toLowerCase()
        );
        backupState.accounts.push(currentAdmin);
      }
      if (!window.confirm("Restore akan mengganti data aplikasi, tetapi mempertahankan akun Administrator yang sedang masuk. Lanjutkan?")) return;
      if (apiAvailable) {
        const response = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      }
      Object.keys(state).forEach((key) => { if (!(key in backupState)) delete state[key]; });
      Object.assign(state, backupState);
      ensureAcademicYearDefaults();
      ensureLocationDefaults();
      ensureBrandingDefaults();
      ensurePermissionDefaults();
      ensureWorkspaceCollections();
      const synced = await persistState();
      activeUser = getById("accounts", activeUser.id) || activeUser;
      applyAppBranding();
      showToast(synced
        ? "Data berhasil dipulihkan dari backup."
        : "Data dipulihkan secara lokal dan akan disinkronkan otomatis saat koneksi pulih atau Administrator masuk kembali.", !synced);
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
    if (source === "repairGoods") rows = recordsForAcademicYear("goods", academicYearId).filter((good) => !isBhp(good));
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
    const scanPanel = !record && ["usages", "stocktakes", "loans", "procurements", "disposals", "depreciations"].includes(key)
      ? `<div class="form-field full"><div class="barcode-scan-panel"><div class="barcode-scan-heading"><i data-lucide="scan-line"></i><div><b>Pindai barcode ${key === "usages" ? "barang BHP" : "barang atau item"}</b><small>${key === "usages" ? "Pindai barcode barang BHP atau pilih barang secara manual dari daftar." : "Pindai kode barcode barang atau kode unik item untuk mengisi pilihan secara otomatis."}</small></div><button id="startBarcodeScan" class="btn-secondary" type="button"><i data-lucide="camera"></i>Buka kamera</button></div><div class="barcode-scan-manual"><input id="barcodeScanCode" type="text" autocomplete="off" placeholder="${key === "usages" ? "Pindai atau masukkan kode barcode BHP" : "Contoh barcode BRG-00001 atau kode item"}"><button id="applyBarcodeScan" class="btn-quiet" type="button"><i data-lucide="scan"></i>Gunakan kode</button></div><video id="barcodeScannerVideo" class="barcode-scanner-video hidden" playsinline muted></video><div id="barcodeScanStatus" class="barcode-scan-status" aria-live="polite">Pilih atau pindai kode barang untuk mengisi formulir.</div><button id="stopBarcodeScan" class="btn-quiet barcode-scan-stop hidden" type="button">Tutup kamera</button></div></div>`
      : "";
    const loanDuration = record?.durationDays ?? (record?.startDate && record?.dueDate ? Math.max(1, daysBetweenDates(record.startDate, record.dueDate)) : 1);
    const depreciationPeriodType = record?.periodType || (record ? "Tahunan" : "Bulanan");
    const depreciationCost = Number(record?.initialValue ?? getById("goods", record?.goodId)?.price) || 0;
    const legacyDepreciationLife = record?.usefulLifeYears ?? (Number(record?.amount) > 0
      ? Math.max(1, Math.round((depreciationCost - (Number(record?.residualValue) || 0)) / Number(record.amount)))
      : 5);
    const fields = config.fields.map(([name, label, type, required, source]) => {
      if (key === "academicYears" && name === "copyPreviousData" && record) return "";
      let value = record?.[name] ?? (key === "goods" && name === "ownershipId"
        ? (recordsForAcademicYear("ownerships").find((ownership) => ownership.name.toLocaleLowerCase("id-ID") === "milik")?.id || recordsForAcademicYear("ownerships")[0]?.id || "")
        : key === "categories" && name === "kibClass" ? "Non KIB"
        : key === "academicYears" && name === "status" ? "Aktif"
          : key === "accounts" && name === "active" ? true
            : key === "loans" && name === "quantity" ? 1
              : key === "disposals" && name === "quantity" ? 1
            : ["repairTickets", "maintenanceSchedules"].includes(key) && name === "quantity" ? 1
              : key === "repairTickets" && name === "priority" ? "Sedang"
                : key === "maintenanceSchedules" && name === "type" ? "Rutin"
              : key === "maintenanceSchedules" && name === "status" ? "Menunggu Jadwal"
                  : key === "maintenanceSchedules" && name === "date" ? calendarPrefillDate || dateOffset(0)
                : key === "maintenanceSchedules" && name === "nextServiceDate" ? ""
                  : key === "procurements" && procurementPrefill && name === "proposer" ? activeUser?.name || ""
                    : key === "procurements" && procurementPrefill && name === "title" ? `Pengadaan ulang ${procurementPrefill.good.name}`
                      : key === "procurements" && procurementPrefill && name === "goodId" ? procurementPrefill.good.id
                        : key === "procurements" && procurementPrefill && name === "quantity" ? procurementPrefill.quantity
                          : key === "procurements" && procurementPrefill && name === "unitPrice" ? procurementPrefill.good.price
                            : key === "procurements" && procurementPrefill && name === "fundId" ? procurementPrefill.good.fundId
                              : key === "procurements" && procurementPrefill && name === "priority" ? "Mendesak"
              : key === "loans" && name === "durationDays" ? loanDuration
                : key === "loans" && name === "dueDate" ? addDaysToDate(dateOffset(0), 1)
                  : key === "locations" && name === "code" ? nextLocationCode(recordYearId)
                    : key === "locations" && name === "status" ? "Aktif"
                  : key === "depreciations" && name === "periodType" ? depreciationPeriodType
                    : key === "depreciations" && name === "method" ? depreciationMethods.straightLine
                      : key === "depreciations" && name === "residualValue" ? 0
                        : key === "depreciations" && name === "usefulLifeYears" ? legacyDepreciationLife
                          : key === "depreciations" && name === "date" ? depreciationPeriodEnd(depreciationPeriodType)
                  : type === "date" ? (key === "academicYears" ? "" : dateOffset(0)) : "");
      if (key === "depreciations" && name === "method" && value === "Garis Lurus") value = depreciationMethods.straightLine;
      const idAttr = `${key}-${name}`;
      if (key === "locations" && name === "code") return `<div class="form-field"><label for="${idAttr}">${esc(label)} *</label><input id="${idAttr}" name="${name}" type="text" value="${esc(value)}" required readonly><small class="form-help">Kode unik terisi otomatis.</small></div>`;
      if (key === "goods" && name === "assetCode") return `<div class="form-field"><label for="${idAttr}">${esc(label)}</label><input id="${idAttr}" name="${name}" type="text" value="${esc(value)}" maxlength="80"><small class="form-help">Masukkan kode barang sesuai daftar kode aset yang berlaku di sekolah atau instansi.</small></div>`;
      if (key === "locations" && name === "area") return `<div class="form-field"><label for="${idAttr}">${esc(label)}</label><input id="${idAttr}" name="${name}" type="number" value="${esc(value)}" readonly><small class="form-help" id="locationAreaHelp" aria-live="polite">Luas dihitung otomatis dari panjang × lebar.</small></div>`;
      if (key === "usages" && name === "unitId") {
        const unitId = record?.unitId || getById("goods", record?.goodId)?.unitId || "";
        const unitName = relatedName("units", unitId);
        return `<div class="form-field"><label for="usages-unitName">Satuan</label><input id="usages-unitName" type="text" value="${esc(unitName === "—" ? "" : unitName)}" readonly><input type="hidden" name="unitId" value="${esc(unitId)}"></div>`;
      }
      if (key === "loans" && name === "signature") return `<div class="form-field full"><label for="loanSignatureCanvas">${esc(label)}</label><div class="loan-signature-field"><canvas id="loanSignatureCanvas" class="loan-signature-pad" aria-label="Area tanda tangan peminjam"></canvas><input type="hidden" name="signature" value="${esc(value)}"><button id="clearLoanSignature" class="btn-quiet" type="button"><i data-lucide="eraser"></i>Hapus tanda tangan</button></div><small class="form-help">Tanda tangan dapat diisi dengan mouse atau layar sentuh; biarkan kosong jika tidak diperlukan.</small></div>`;
      if (key === "loans" && name === "whatsapp") return `<div class="form-field"><label for="${idAttr}">${esc(label)}</label><input id="${idAttr}" name="${name}" type="tel" inputmode="tel" autocomplete="tel" value="${esc(value)}" placeholder="08... atau +628..."><small class="form-help">Opsional, tetapi diperlukan agar peminjam menerima pengingat WhatsApp.</small></div>`;
      if (key === "loans" && name === "dueDate") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="date" value="${esc(value)}" ${required ? "required" : ""} readonly><small class="form-help">Dihitung otomatis dari tanggal sewa dan jumlah hari.</small></div>`;
      if (key === "depreciations" && name === "initialValue") return `<div class="form-field"><label for="${idAttr}">${esc(label)} *</label><input id="${idAttr}" name="${name}" type="text" class="money-input" inputmode="numeric" value="${esc(formatThousands(value))}" required readonly><small class="form-help">Terisi otomatis dari harga satuan barang.</small></div>`;
      if (key === "depreciations" && name === "method") return `<div class="form-field"><label for="${idAttr}">${esc(label)} *</label><select id="${idAttr}" name="${name}" required>${optionsFor(source).replace(new RegExp(`value="${esc(value)}"`), `value="${esc(value)}" selected`)}</select><small class="form-help">Saldo Menurun Ganda memakai tarif 2 ÷ umur ekonomis dan beralih ke garis lurus saat lebih sesuai. Jumlah Angka Tahun membebankan porsi lebih besar pada awal umur aset.</small></div>`;
      if (key === "depreciations" && name === "date") return `<div class="form-field"><label for="${idAttr}">${esc(label)} *</label><input id="${idAttr}" name="${name}" type="date" value="${esc(value)}" required readonly><small class="form-help">Otomatis mengikuti akhir bulan atau akhir tahun buku.</small></div>`;
      if (key === "depreciations" && ["amount", "accumulatedAmount", "finalValue"].includes(name)) return `<div class="form-field"><label for="${idAttr}">${esc(label)} *</label><input id="${idAttr}" name="${name}" type="text" class="money-input depreciation-computed" inputmode="numeric" value="${esc(formatThousands(value))}" required readonly></div>`;
      if (type === "checkbox") return `<div class="form-field full"><label class="form-check"><input id="${idAttr}" name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${esc(label)}</span></label></div>`;
      if (key === "goods" && name === "consumable") return `<div class="form-field"><label for="${idAttr}">Status BHP *</label><select id="${idAttr}" name="${name}" required><option value="true" ${isBhp({ consumable: value }) ? "selected" : ""}>Barang Habis Pakai (BHP)</option><option value="false" ${isBhp({ consumable: value }) ? "" : "selected"}>Barang Modal</option></select></div>`;
      if (type === "select") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><select id="${idAttr}" name="${name}" ${required ? "required" : ""}><option value="">Pilih ${esc(label.toLowerCase())}</option>${optionsFor(key === "loans" && name === "goodId" ? "loanGoods" : source, recordYearId).replace(new RegExp(`value="${esc(value)}"`), `value="${esc(value)}" selected`)}</select></div>`;
      if (type === "textarea") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><textarea id="${idAttr}" name="${name}" ${required ? "required" : ""}>${esc(value)}</textarea></div>`;
      if (type === "password") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${key === "accounts" && !record && name === "password" ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="password" autocomplete="new-password" ${key === "accounts" && !record && name === "password" ? "required minlength=\"8\"" : ""}></div>`;
      if (type === "file") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><div class="file-drop"><i data-lucide="image-plus"></i><span>${key === "repairTickets" ? "Pilih foto kerusakan" : "Pilih foto bukti"}</span><input id="${idAttr}" name="${name}" type="file" accept="image/*" class="form-file"><img class="file-preview ${record?.[name] ? "" : "hidden"}" src="${esc(record?.[name] || "")}" alt="Pratinjau foto"></div><small class="form-help">Foto maksimal 2 MB.</small></div>`;
      const money = moneyFields.has(name);
      const inputType = money ? "text" : type;
      const inputValue = money ? formatThousands(value) : value;
      const numberAttributes = type !== "number" ? ""
        : key === "locations" && name === "floor" ? 'min="0" step="1"'
          : key === "locations" && ["length", "width"].includes(name) ? 'min="0.01" step="any"'
        : key === "usages" && name === "quantity" ? 'min="0.01" step="any"'
          : ["repairTickets", "maintenanceSchedules"].includes(key) && name === "quantity" ? 'min="1" step="1"'
            : key === "stocktakes" && name === "newStock" ? 'min="0" step="1"'
          : key === "loans" && ["quantity", "durationDays"].includes(name) ? 'min="1" step="1"'
            : key === "disposals" && name === "quantity" ? 'min="1" step="1"'
              : key === "depreciations" && name === "usefulLifeYears" ? 'min="1" step="1"' : 'min="0"';
      const help = key === "loans" && name === "quantity"
        ? `<small class="form-help" id="loanAvailableQuantity" aria-live="polite"></small>`
        : key === "usages" && name === "quantity" ? `<small class="form-help" id="usageAvailableQuantity" aria-live="polite"></small>`
        : key === "repairTickets" && name === "quantity" ? `<small class="form-help" id="repairTicketAvailableQuantity" aria-live="polite"></small>`
        : key === "maintenanceSchedules" && name === "quantity" ? `<small class="form-help" id="maintenanceScheduleAvailableQuantity" aria-live="polite"></small>`
        : key === "stocktakes" && name === "newStock" ? `<small class="form-help">Maksimal stok baru mengikuti jumlah stok awal.</small>`
        : key === "disposals" && name === "quantity" ? `<small class="form-help" id="disposalAvailableQuantity" aria-live="polite"></small>` : "";
      return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="${inputType}" value="${esc(inputValue)}" ${required ? "required" : ""} ${money ? 'class="money-input" inputmode="numeric" autocomplete="off" placeholder="Contoh: 1.000.000"' : numberAttributes}>${help}</div>`;
    }).join("");
    const footer = key === "loans"
      ? `<div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-secondary" type="submit" value="save"><i data-lucide="save"></i>Simpan</button><button class="btn-primary" type="submit" value="saveAndPrint"><i data-lucide="printer"></i>Simpan dan Cetak Bukti</button></div>`
      : `<div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan data</button></div>`;
    return `<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>${record ? "Edit" : "Tambah"} ${config.singular}</h2><p>Lengkapi informasi berikut dengan benar.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form class="modal-form" id="recordForm" data-collection="${key}" data-record="${record?.id || ""}"><div class="form-grid">${scanPanel}${fields}</div>${footer}</form></section></div>`;
  }

  function showModal(content, wide = false) {
    stopBarcodeScanner();
    $("#modalRoot").innerHTML = content;
    $("#modalRoot").onclick = recordActions;
    if (wide) $(".modal", $("#modalRoot"))?.classList.add("modal-wide");
    if (window.lucide) lucide.createIcons({ nodes: [$("#modalRoot")] });
    const form = $("#recordForm");
    if (form) setupMoneyInputs(form);
    if (form && form.dataset.collection === "loans") setupLoanForm(form);
    if (form && form.dataset.collection === "disposals") setupDisposalForm(form);
    if (form && form.dataset.collection === "depreciations") setupDepreciationForm(form);
    if (form && form.dataset.collection === "stocktakes") setupStocktakeForm(form);
    if (form && form.dataset.collection === "usages") setupUsageForm(form);
    if (form && form.dataset.collection === "locations") setupLocationForm(form);
    if (form && ["repairTickets", "maintenanceSchedules"].includes(form.dataset.collection)) {
      const helpId = form.dataset.collection === "repairTickets" ? "repairTicketAvailableQuantity" : "maintenanceScheduleAvailableQuantity";
      setupGoodQuantityLimitForm(form, helpId);
    }
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
    $("#helpTicketForm")?.addEventListener("submit", saveHelpTicket);
  }

  function showExistingGoodPurchaseModal() {
    if (!canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin menambah stok barang.", true);
    const funds = recordsForAcademicYear("funds").map((fund) => `<option value="${esc(fund.id)}">${esc(fund.name)}</option>`).join("");
    const suppliers = recordsForAcademicYear("suppliers").map((supplier) => `<option value="${esc(supplier.id)}">${esc(supplier.name)}</option>`).join("");
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="existingGoodPurchaseTitle">
      <div class="modal-header"><div><h2 id="existingGoodPurchaseTitle">Tambah barang yang sudah ada</h2><p>Catat pembelian dan tambahkan jumlahnya ke stok barang terdaftar.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div>
      <form id="existingGoodPurchaseForm" class="modal-form"><div class="form-grid">
        <div class="form-field"><label for="existingGoodPurchaseDate">Tanggal Pembelian Barang *</label><input id="existingGoodPurchaseDate" name="date" type="date" value="${dateOffset(0)}" required></div>
        <div class="form-field existing-good-picker-field"><label for="existingGoodSearch">Nama Barang *</label><input id="existingGoodSearch" type="search" autocomplete="off" placeholder="Cari nama barang..." aria-controls="existingGoodSuggestions" aria-expanded="false" required><input id="existingGoodId" name="goodId" type="hidden"><div id="existingGoodSuggestions" class="existing-good-suggestions hidden" role="listbox"></div><small id="existingGoodSelection" class="form-help">Pilih barang yang sudah terdaftar.</small></div>
        <div class="form-field"><label for="existingGoodFund">Sumber Dana *</label><select id="existingGoodFund" name="fundId" required><option value="">Pilih sumber dana</option>${funds}</select></div>
        <div class="form-field"><label for="existingGoodSupplier">Supplier *</label><select id="existingGoodSupplier" name="supplierId" required><option value="">Pilih supplier</option>${suppliers}</select></div>
        <div class="form-field"><label for="existingGoodQuantity">Jumlah Barang *</label><input id="existingGoodQuantity" name="quantity" type="number" min="1" step="1" required></div>
        <div class="form-field"><label for="existingGoodPrice">Tarif Barang (Rp) *</label><input id="existingGoodPrice" name="unitPrice" type="text" class="money-input" inputmode="numeric" autocomplete="off" placeholder="Contoh: 1.000.000" required></div>
      </div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="submit" class="btn-primary"><i data-lucide="package-plus"></i>Simpan pembelian &amp; stok</button></div></form>
    </section></div>`);
    bindExistingGoodPurchaseForm();
  }

  function bindExistingGoodPurchaseForm() {
    const form = $("#existingGoodPurchaseForm");
    const search = $("#existingGoodSearch");
    const suggestions = $("#existingGoodSuggestions");
    if (!form || !search || !suggestions) return;
    setupMoneyInputs(form);
    const updateSuggestions = () => {
      const query = search.value.trim().toLocaleLowerCase("id-ID");
      const matches = recordsForAcademicYear("goods")
        .filter((good) => !query || String(good.name || "").toLocaleLowerCase("id-ID").includes(query))
        .slice(0, 10);
      suggestions.innerHTML = matches.length
        ? matches.map((good) => `<button type="button" class="existing-good-suggestion" role="option" data-existing-good-id="${esc(good.id)}"><span><b>${esc(good.name)}</b><small>${integerId.format(Number(good.quantity) || 0)} ${esc(relatedName("units", good.unitId))} · ${esc(relatedName("categories", good.categoryId))}</small></span><i data-lucide="chevron-right"></i></button>`).join("")
        : `<p class="existing-good-no-match">${query ? "Barang tidak ditemukan. Tambahkan sebagai barang baru terlebih dahulu." : "Belum ada data barang. Tambahkan barang baru terlebih dahulu."}</p>`;
      suggestions.classList.remove("hidden");
      search.setAttribute("aria-expanded", "true");
      if (window.lucide) lucide.createIcons({ nodes: [suggestions] });
    };
    search.addEventListener("focus", updateSuggestions);
    search.addEventListener("input", () => {
      $("#existingGoodId").value = "";
      $("#existingGoodSelection").textContent = "Pilih barang dari daftar yang muncul.";
      updateSuggestions();
    });
    suggestions.addEventListener("click", (event) => {
      const option = event.target.closest("[data-existing-good-id]");
      if (!option) return;
      const good = getById("goods", option.dataset.existingGoodId);
      if (!good || !recordsForAcademicYear("goods").some((record) => record.id === good.id)) return;
      $("#existingGoodId").value = good.id;
      search.value = good.name;
      $("#existingGoodSelection").textContent = `Stok saat ini: ${integerId.format(Number(good.quantity) || 0)} ${relatedName("units", good.unitId)} · harga terakhir ${rupiah(good.price)}`;
      suggestions.classList.add("hidden");
      search.setAttribute("aria-expanded", "false");
    });
    form.addEventListener("submit", saveExistingGoodPurchase);
  }

  function saveExistingGoodPurchase(event) {
    event.preventDefault();
    if (!canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin menambah stok barang.", true);
    const form = event.currentTarget;
    const good = getById("goods", $("#existingGoodId")?.value);
    const purchaseDate = form.elements.date.value;
    const quantity = Number(form.elements.quantity.value);
    const unitPrice = parseGroupedInteger(form.elements.unitPrice.value);
    const fundId = form.elements.fundId.value;
    const supplierId = form.elements.supplierId.value;
    if (!good || !recordsForAcademicYear("goods").some((record) => record.id === good.id)) {
      return showToast("Pilih barang yang sudah terdaftar pada tahun pelajaran aktif.", true);
    }
    const parsedPurchaseDate = new Date(`${purchaseDate}T00:00:00Z`);
    if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
      || !Number.isFinite(parsedPurchaseDate.getTime()) || parsedPurchaseDate.toISOString().slice(0, 10) !== purchaseDate) {
      return showToast("Tanggal pembelian wajib diisi dengan tanggal yang valid.", true);
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return showToast("Jumlah barang harus bilangan bulat lebih dari nol.", true);
    if (unitPrice === null || unitPrice < 0) return showToast("Tarif barang harus berupa angka nol atau lebih.", true);
    if (!recordsForAcademicYear("funds").some((fund) => fund.id === fundId)) return showToast("Pilih sumber dana yang valid.", true);
    if (!recordsForAcademicYear("suppliers").some((supplier) => supplier.id === supplierId)) return showToast("Pilih supplier yang valid.", true);
    const previousQuantity = Math.max(0, Number(good.quantity) || 0);
    const previousInitial = Math.max(previousQuantity, Number(good.initialQuantity ?? good.quantity) || 0);
    const purchaseId = id();
    const previousGoodData = {
      receivedDate: good.receivedDate || "",
      price: Number(good.price) || 0,
      fundId: good.fundId || "",
      supplierId: good.supplierId || "",
      stockAdditionRecordId: good.stockAdditionRecordId || ""
    };
    good.quantity = previousQuantity + quantity;
    good.initialQuantity = previousInitial + quantity;
    good.price = unitPrice;
    good.fundId = fundId;
    good.supplierId = supplierId;
    good.receivedDate = purchaseDate;
    good.stockAdditionRecordId = purchaseId;
    state.procurements.unshift({
      id: purchaseId,
      academicYearId: currentAcademicYearId(),
      proposer: activeUser?.name || "Administrator",
      title: `Pembelian barang: ${good.name}`,
      stockAddition: true,
      goodId: good.id,
      priority: "Normal",
      quantity,
      unitPrice,
      fundId,
      supplierId,
      date: purchaseDate,
      previousGoodData,
      note: "Pembelian barang yang sudah terdaftar dan penambahan stok.",
      status: "Diterima"
    });
    logActivity("Menambahkan stok", "Barang", `${good.name} · +${integerId.format(quantity)} unit`);
    saveState();
    closeModal();
    showToast(`Pembelian ${good.name} tersimpan. Stok bertambah ${integerId.format(quantity)} unit.`);
    renderPage();
  }

  function setupLoanForm(form) {
    const good = form.elements.goodId;
    const quantity = form.elements.quantity;
    const availableLabel = $("#loanAvailableQuantity", form);
    const startDate = form.elements.startDate;
    const duration = form.elements.durationDays;
    const dueDate = form.elements.dueDate;
    const refreshAvailability = () => {
      if (!good || !quantity) return;
      const available = loanFormAvailableQuantity(good.value, form.dataset.record);
      quantity.max = String(available);
      if (availableLabel) availableLabel.textContent = good.value ? `Stok yang tersedia untuk dipinjam: ${available}` : "Pilih barang untuk melihat stok yang tersedia.";
    };
    const refreshDueDate = () => {
      const days = Number(duration?.value);
      dueDate.value = startDate?.value && Number.isInteger(days) && days > 0 ? addDaysToDate(startDate.value, days) : "";
    };
    good?.addEventListener("change", refreshAvailability);
    startDate?.addEventListener("change", refreshDueDate);
    duration?.addEventListener("input", refreshDueDate);
    refreshAvailability();
    refreshDueDate();
    setupLoanSignature(form);
  }

  function setupDisposalForm(form) {
    const goodSelect = form.elements.goodId;
    const quantity = form.elements.quantity;
    const availableLabel = $("#disposalAvailableQuantity", form);
    const refreshAvailability = () => {
      if (!goodSelect || !quantity) return;
      const good = getById("goods", goodSelect.value);
      const old = form.dataset.record ? getById("disposals", form.dataset.record) : null;
      const restored = old?.stockAdjusted && old.goodId === good?.id ? Math.max(1, Number(old.quantity) || 1) : 0;
      const available = good
        ? Math.max(0, Number(good.quantity || 0) - activeLoanQuantity(good.id) + restored)
        : 0;
      quantity.max = String(available);
      if (availableLabel) availableLabel.textContent = goodSelect.value ? `Stok yang dapat dimusnahkan: ${available}` : "Pilih barang untuk melihat stok yang tersedia.";
    };
    goodSelect?.addEventListener("change", refreshAvailability);
    refreshAvailability();
  }

  function setupDepreciationForm(form) {
    const goodSelect = form.elements.goodId;
    const initialValue = form.elements.initialValue;
    const residualValue = form.elements.residualValue;
    const usefulLifeYears = form.elements.usefulLifeYears;
    const periodType = form.elements.periodType;
    const method = form.elements.method;
    const periodDate = form.elements.date;
    const amount = form.elements.amount;
    const accumulatedAmount = form.elements.accumulatedAmount;
    const finalValue = form.elements.finalValue;
    if (!goodSelect || !initialValue || !residualValue || !usefulLifeYears || !periodType || !method || !periodDate) return;
    const updateInitialValue = () => {
      const good = getById("goods", goodSelect.value);
      initialValue.value = good ? formatThousands(good.price) : "";
    };
    const updatePeriodDate = () => {
      periodDate.value = depreciationPeriodEnd(
        periodType.value,
        savedRecord?.date || dateOffset(0),
        savedRecord?.academicYearId || ""
      );
    };
    const updateCalculation = () => {
      updateInitialValue();
      const calculation = calculateDepreciation(
        goodSelect.value,
        periodDate.value,
        periodType.value,
        Number(usefulLifeYears.value),
        parseThousands(residualValue.value),
        method.value,
        form.dataset.record
      );
      const hasGood = Boolean(getById("goods", goodSelect.value));
      if (amount) amount.value = hasGood ? formatThousands(calculation.amount) : "";
      if (accumulatedAmount) accumulatedAmount.value = hasGood ? formatThousands(calculation.accumulatedAmount) : "";
      if (finalValue) finalValue.value = hasGood ? formatThousands(calculation.finalValue) : "";
    };
    goodSelect.addEventListener("change", updateCalculation);
    residualValue.addEventListener("input", updateCalculation);
    usefulLifeYears.addEventListener("input", updateCalculation);
    method.addEventListener("change", updateCalculation);
    periodType.addEventListener("change", () => { updatePeriodDate(); updateCalculation(); });
    const savedRecord = form.dataset.record ? getById("depreciations", form.dataset.record) : null;
    if (!savedRecord || !savedRecord.periodType) updatePeriodDate();
    updateCalculation();
  }

  function depreciationPeriodEnd(periodType, referenceDate = dateOffset(0), academicYearId = "") {
    const match = String(referenceDate || "").match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!match) return "";
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (periodType === "Tahunan") {
      const academicYear = state.academicYears?.find((row) => row.id === academicYearId)
        || state.academicYears?.find((row) => row.startDate <= referenceDate && row.endDate >= referenceDate)
        || state.academicYears?.find((row) => row.id === currentAcademicYearId());
      if (academicYear?.endDate) return academicYear.endDate;
      return `${year}-12-31`;
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  function calculateDepreciation(goodId, periodDate, periodType, usefulLifeYears, residualValue, method, excludeRecordId = "") {
    const good = getById("goods", goodId);
    const initialValue = Number(good?.price) || 0;
    const residual = Number(residualValue) || 0;
    const depreciableBasis = Math.max(0, initialValue - residual);
    const priorRecords = (state.depreciations || []).filter((record) =>
      record.id !== excludeRecordId && record.goodId === goodId && record.date && record.date < periodDate
    );
    const priorAccumulated = Math.min(priorRecords.reduce((total, record) =>
      total + Math.max(0, Number(record.amount) || 0), 0), depreciableBasis);
    const periodsPerYear = periodType === "Bulanan" ? 12 : 1;
    const elapsedYears = priorRecords.reduce((total, record) =>
      total + ((record.periodType || "Tahunan") === "Bulanan" ? 1 / 12 : 1), 0);
    const remaining = Math.max(0, depreciableBasis - priorAccumulated);
    const remainingYears = Math.max(0, usefulLifeYears - elapsedYears);
    let plannedAnnual = 0;
    if (method === depreciationMethods.straightLine) {
      plannedAnnual = usefulLifeYears > 0 ? depreciableBasis / usefulLifeYears : 0;
    } else if (method === depreciationMethods.doubleDeclining) {
      const beginningBookValue = Math.max(residual, initialValue - priorAccumulated);
      const doubleDecliningAmount = usefulLifeYears > 0 ? beginningBookValue * 2 / usefulLifeYears : 0;
      const straightLineRemaining = remainingYears > 0 ? remaining / remainingYears : remaining;
      plannedAnnual = Math.max(doubleDecliningAmount, straightLineRemaining);
    } else if (method === depreciationMethods.sumOfYears) {
      const yearNumber = Math.min(usefulLifeYears, Math.floor(elapsedYears + 1e-9) + 1);
      const sumOfYears = usefulLifeYears * (usefulLifeYears + 1) / 2;
      plannedAnnual = sumOfYears > 0 ? depreciableBasis * (usefulLifeYears - yearNumber + 1) / sumOfYears : 0;
    }
    const plannedAmount = Math.round(remainingYears > 0 ? plannedAnnual / periodsPerYear : remaining);
    const amount = Math.min(Math.max(0, plannedAmount), remaining);
    const accumulatedAmount = priorAccumulated + amount;
    return {
      initialValue,
      priorAccumulated,
      amount,
      accumulatedAmount,
      finalValue: Math.max(residual, initialValue - accumulatedAmount)
    };
  }

  function setupLoanSignature(form) {
    const canvas = $("#loanSignatureCanvas", form);
    const storedSignature = form.elements.signature;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !storedSignature) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    context.scale(ratio, ratio);
    context.strokeStyle = "#172033";
    context.fillStyle = "#172033";
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    const position = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    let drawing = false;
    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const point = position(event);
      context.beginPath();
      context.arc(point.x, point.y, 1.1, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(point.x, point.y);
      storedSignature.value = canvas.toDataURL("image/png");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      event.preventDefault();
      const point = position(event);
      context.lineTo(point.x, point.y);
      context.stroke();
      storedSignature.value = canvas.toDataURL("image/png");
    });
    const stopDrawing = () => {
      if (drawing) storedSignature.value = canvas.toDataURL("image/png");
      drawing = false;
    };
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
    $("#clearLoanSignature", form)?.addEventListener("click", () => {
      context.clearRect(0, 0, bounds.width, bounds.height);
      storedSignature.value = "";
    });
    if (storedSignature.value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
      image.src = storedSignature.value;
    }
  }

  function showDeleteConfirmation(title, description, onConfirm, confirmLabel = "Ya, hapus") {
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal logout-confirm-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteConfirmTitle" aria-describedby="deleteConfirmDescription"><div class="delete-confirm-icon"><i data-lucide="trash-2"></i></div><h2 id="deleteConfirmTitle">${esc(title)}</h2><p id="deleteConfirmDescription">${esc(description)}</p><div class="logout-confirm-actions"><button class="btn-quiet" type="button" data-action="close">Batal</button><button class="btn-danger" type="button" id="confirmDeleteAction"><i data-lucide="trash-2"></i>${esc(confirmLabel)}</button></div></section></div>`);
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
    if (!("goodConditionCount" in good) && !("damagedConditionCount" in good) && !("missingConditionCount" in good)) return;
    const total = Math.max(0, Number(good.quantity) || 0);
    const damaged = Math.min(total, Math.max(0, Number(good.damagedConditionCount) || 0));
    const missing = Math.min(total - damaged, Math.max(0, Number(good.missingConditionCount) || 0));
    if ("damagedConditionCount" in good) good.damagedConditionCount = damaged;
    if ("missingConditionCount" in good) good.missingConditionCount = missing;
    if ("goodConditionCount" in good) good.goodConditionCount = total - damaged - missing;
  }

  function restoreDisposalStock(disposal) {
    if (disposal?.stockAdjusted !== true) return;
    const good = getById("goods", disposal.goodId);
    if (!good) return;
    good.quantity = Number(good.quantity || 0) + Math.max(1, Number(disposal.quantity) || 1);
    syncGoodConditionCounts(good);
  }

  function restoreLoanStock(loan) {
    if (loan?.stockAdjusted !== true) return;
    const good = getById("goods", loan.goodId);
    if (!good) return;
    good.quantity = Number(good.quantity || 0) + Math.max(1, Number(loan.quantity) || 1);
    syncGoodConditionCounts(good);
  }

  function restoreUsageStock(usage) {
    if (usage?.stockAdjusted !== true && usage?.status !== "Disetujui") return;
    const good = getById("goods", usage.goodId);
    if (!good) return;
    good.quantity = Number(good.quantity || 0) + (Number(usage.quantity) || 0);
    syncGoodConditionCounts(good);
  }

  function removeStockAdditionStock(record) {
    const good = getById("goods", record.goodId);
    const quantity = Math.max(0, Number(record.quantity) || 0);
    if (!good || !quantity || Number(good.quantity || 0) < quantity) return false;
    good.quantity = Math.max(0, Number(good.quantity || 0) - quantity);
    good.initialQuantity = Math.max(0, Number(good.initialQuantity ?? good.quantity + quantity) - quantity);
    if (good.stockAdditionRecordId === record.id) {
      const previous = record.previousGoodData || {};
      good.receivedDate = previous.receivedDate || "";
      good.price = Number(previous.price) || 0;
      good.fundId = previous.fundId || good.fundId;
      good.supplierId = previous.supplierId || good.supplierId;
      good.stockAdditionRecordId = previous.stockAdditionRecordId || "";
    }
    syncGoodConditionCounts(good);
    return true;
  }

  function restoreStockAdditionStock(record) {
    const good = getById("goods", record.goodId);
    const quantity = Math.max(0, Number(record.quantity) || 0);
    if (!good || !quantity) return false;
    good.quantity = Math.max(0, Number(good.quantity || 0)) + quantity;
    good.initialQuantity = Math.max(0, Number(good.initialQuantity ?? good.quantity - quantity)) + quantity;
    if (!good.stockAdditionRecordId || String(record.date || "") >= String(good.receivedDate || "")) {
      good.receivedDate = record.date || good.receivedDate || "";
      good.price = Number(record.unitPrice) || 0;
      good.fundId = record.fundId || good.fundId;
      good.supplierId = record.supplierId || good.supplierId;
      good.stockAdditionRecordId = record.id;
    }
    syncGoodConditionCounts(good);
    return true;
  }

  function moveRecordToTrash(collection, record) {
    if (!Array.isArray(state[collection]) || !record) return false;
    if (collection === "disposals") restoreDisposalStock(record);
    if (collection === "loans") restoreLoanStock(record);
    if (collection === "usages") restoreUsageStock(record);
    if (collection === "procurements" && isStockAdditionRecord(record) && !removeStockAdditionStock(record)) return false;
    state[collection] = state[collection].filter((row) => row.id !== record.id);
    const entry = {
      id: id(),
      collection,
      record: structuredClone(record),
      deletedAt: new Date().toISOString(),
      deletedBy: activeUser?.name || "Sistem"
    };
    if (!Array.isArray(state.trash)) state.trash = [];
    state.trash.unshift(entry);
    logActivity("Memindahkan ke kotak sampah", collectionConfig[collection]?.title || meta[collection]?.[0] || collection, trashRecordLabel(record));
    return true;
  }

  function restoreTrashEntry(entry) {
    const collection = entry?.collection;
    const record = entry?.record;
    if (!collection || !record || !Array.isArray(state[collection])) {
      showToast("Data sampah tidak valid dan tidak dapat dipulihkan.", true);
      return false;
    }
    if (state[collection].some((row) => row.id === record.id)) {
      showToast("Data dengan ID yang sama sudah ada di menu asal.", true);
      return false;
    }
    const restoresStockAddition = collection === "procurements" && isStockAdditionRecord(record);
    const requiresStockAdjustment = (collection === "loans" && record.stockAdjusted === true)
      || (collection === "disposals" && record.stockAdjusted === true)
      || (collection === "usages" && (record.stockAdjusted === true || record.status === "Disetujui"))
      || restoresStockAddition;
    if (requiresStockAdjustment) {
      const good = getById("goods", record.goodId);
      const quantity = Math.max(0, Number(record.quantity) || 0);
      if (!good) {
        showToast("Barang terkait tidak ditemukan; data tidak dapat dipulihkan.", true);
        return false;
      }
      if (!restoresStockAddition && quantity > Number(good.quantity || 0)) {
        showToast(`Stok tidak mencukupi untuk memulihkan transaksi ini. Stok tersedia ${Number(good.quantity) || 0} unit.`, true);
        return false;
      }
      if (restoresStockAddition) {
        if (!restoreStockAdditionStock(record)) {
          showToast("Jumlah atau data barang masuk tidak valid; riwayat tidak dapat dipulihkan.", true);
          return false;
        }
      } else {
        good.quantity = Math.max(0, Number(good.quantity || 0) - quantity);
        syncGoodConditionCounts(good);
      }
    }
    state[collection].unshift(structuredClone(record));
    state.trash = state.trash.filter((row) => row.id !== entry.id);
    logActivity("Memulihkan dari kotak sampah", collectionConfig[collection]?.title || meta[collection]?.[0] || collection, trashRecordLabel(record));
    saveState();
    showToast("Data berhasil dipulihkan.");
    renderPage();
    return true;
  }

  function permanentlyDeleteTrashEntry(entry) {
    if (!entry || !Array.isArray(state.trash)) return;
    const name = trashRecordLabel(entry.record);
    const collectionLabel = collectionConfig[entry.collection]?.title || meta[entry.collection]?.[0] || entry.collection;
    state.trash = state.trash.filter((row) => row.id !== entry.id);
    logActivity("Menghapus permanen", collectionLabel, name);
    saveState();
    showToast("Data dihapus permanen.");
    renderPage();
  }

  function showGoodsConditionModal(goodId) {
    const good = getById("goods", goodId);
    if (!good) return;
    const total = Math.max(0, Number(good.quantity) || 0);
    const damagedCount = Math.min(total, Math.max(0, Number(good.damagedConditionCount) || 0));
    const missingCount = Math.min(total - damagedCount, Math.max(0, Number(good.missingConditionCount) || 0));
    const goodCount = total - damagedCount - missingCount;
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Kondisi Barang</h2><p>${esc(good.name)}</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form class="modal-form" id="goodsConditionForm"><div class="form-grid">
      <div class="form-field"><label for="conditionTotal">Total jumlah barang</label><input id="conditionTotal" type="number" value="${esc(total)}" readonly></div>
      <div class="form-field"><label for="goodConditionCount">Jumlah kondisi barang baik</label><input id="goodConditionCount" name="goodConditionCount" type="number" min="0" max="${esc(total)}" step="any" value="${esc(goodCount)}" required></div>
      <div class="form-field"><label for="damagedConditionCount">Jumlah kondisi barang rusak</label><input id="damagedConditionCount" name="damagedConditionCount" type="number" min="0" max="${esc(total)}" step="any" value="${esc(damagedCount)}" required></div>
      <div class="form-field"><label for="missingConditionCount">Jumlah barang hilang</label><input id="missingConditionCount" name="missingConditionCount" type="number" min="0" max="${esc(total)}" step="any" value="${esc(missingCount)}" required></div>
    </div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan kondisi</button></div></form></section></div>`);
    $("#goodsConditionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const goodCount = Number(event.currentTarget.elements.goodConditionCount.value);
      const damaged = Number(event.currentTarget.elements.damagedConditionCount.value);
      const missing = Number(event.currentTarget.elements.missingConditionCount.value);
      if (![goodCount, damaged, missing].every((count) => Number.isFinite(count) && count >= 0)
        || Math.abs(goodCount + damaged + missing - total) > 1e-8) {
        showToast(`Jumlah kondisi baik, rusak, dan hilang harus sama dengan total barang (${total}).`, true);
        return;
      }
      good.goodConditionCount = goodCount;
      good.damagedConditionCount = damaged;
      good.missingConditionCount = missing;
      saveState();
      closeModal();
      showToast("Kondisi barang berhasil diperbarui.");
      renderPage();
    });
  }

  function showRoomConditionModal(locationId) {
    const room = getById("locations", locationId);
    if (!room) return;
    const conditions = [
      ["", "Baik · kosongkan kondisi"],
      ["Rusak Ringan", "Rusak ringan"],
      ["Rusak Sedang", "Rusak sedang"],
      ["Rusak Berat", "Rusak berat"]
    ];
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Kondisi Ruangan</h2><p>${esc(room.name)}</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><p class="muted">Pilih tingkat kerusakan. Jika kondisi ruangan baik, pilih opsi pertama agar kondisi dikosongkan.</p><div class="room-condition-options">${conditions.map(([value, label]) => `<button type="button" class="${room.condition === value ? "btn-primary" : "btn-quiet"}" data-room-condition="${esc(value)}">${esc(label)}</button>`).join("")}</div></div></section></div>`);
    $$("[data-room-condition]", $("#modalRoot")).forEach((button) => button.addEventListener("click", () => {
      room.condition = button.dataset.roomCondition || "";
      logActivity("Memperbarui kondisi ruangan", "Ruangan", `${room.name} · ${room.condition || "Baik (kosong)"}`);
      saveState();
      closeModal();
      showToast(room.condition ? `Kondisi ${room.name} diperbarui: ${room.condition}.` : `Kondisi ${room.name} dikosongkan.`);
      renderPage();
    }));
  }

  function setupStocktakeForm(form) {
    const goodSelect = form.elements.goodId;
    const oldStockInput = form.elements.oldStock;
    if (!goodSelect || !oldStockInput) return;
    oldStockInput.readOnly = true;
    const newStockInput = form.elements.newStock;
    if (form.dataset.record) goodSelect.disabled = true;
    const updateOldStock = () => {
      const good = getById("goods", goodSelect.value);
      const saved = form.dataset.record ? getById("stocktakes", form.dataset.record) : null;
      oldStockInput.value = saved ? String(saved.oldStock ?? 0) : good ? String(good.quantity ?? 0) : "";
      if (newStockInput) {
        newStockInput.max = oldStockInput.value || "0";
        newStockInput.setCustomValidity("");
      }
    };
    if (!form.dataset.record) goodSelect.addEventListener("change", updateOldStock);
    updateOldStock();
  }

  function setupUsageForm(form) {
    const goodSelect = form.elements.goodId;
    const quantityInput = form.elements.quantity;
    const unitIdInput = form.elements.unitId;
    const unitNameInput = $("#usages-unitName", form);
    const availability = $("#usageAvailableQuantity", form);
    const updateUsageDetails = () => {
      const good = getById("goods", goodSelect.value);
      const unitId = good?.unitId || "";
      unitIdInput.value = unitId;
      unitNameInput.value = unitId ? relatedName("units", unitId) : "";
      const old = form.dataset.record ? getById("usages", form.dataset.record) : null;
      const restored = (old?.stockAdjusted === true || old?.status === "Disetujui") && old.goodId === good?.id ? Number(old.quantity) || 0 : 0;
      const available = good ? Math.max(0, Number(good.quantity || 0) + restored) : 0;
      quantityInput.max = String(available);
      if (availability) availability.textContent = goodSelect.value ? `Stok tersedia untuk digunakan: ${available}` : "Pilih barang untuk melihat stok yang tersedia.";
    };
    goodSelect.addEventListener("change", updateUsageDetails);
    updateUsageDetails();
  }

  function setupGoodQuantityLimitForm(form, helpId) {
    const goodSelect = form.elements.goodId;
    const quantityInput = form.elements.quantity;
    const availability = $(`#${helpId}`, form);
    if (!goodSelect || !quantityInput) return;
    const updateAvailability = () => {
      const good = getById("goods", goodSelect.value);
      const stock = good ? Math.max(0, Number(good.quantity) || 0) : 0;
      quantityInput.max = String(stock);
      quantityInput.setCustomValidity(good && stock < 1
        ? "Stok barang tidak tersedia."
        : good && Number(quantityInput.value) > stock
          ? `Maksimal stok barang adalah ${stock}.`
          : "");
      if (availability) {
        availability.textContent = good
          ? `Stok tersedia: ${stock}. Jumlah barang tidak boleh melebihi stok.`
          : "Pilih barang untuk melihat stok yang tersedia.";
      }
    };
    goodSelect.addEventListener("change", updateAvailability);
    quantityInput.addEventListener("input", updateAvailability);
    updateAvailability();
  }

  function setupLocationForm(form) {
    const lengthInput = form.elements.namedItem("length");
    const widthInput = form.elements.namedItem("width");
    const areaInput = form.elements.namedItem("area");
    if (!lengthInput || !widthInput || !areaInput) return;
    const updateArea = () => {
      const area = calculatedRoomArea(lengthInput.value, widthInput.value);
      areaInput.value = area === "" ? "" : area.toFixed(2);
    };
    lengthInput.addEventListener("input", updateArea);
    widthInput.addEventListener("input", updateArea);
    updateArea();
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
      const item = state.items.find((row) => currentGoodIds.has(row.goodId) && String(row.code || "").toLowerCase() === normalizedCode);
      const scannedGood = currentGoods.find((row) => String(row.barcode || "").trim().toLowerCase() === normalizedCode);
      const scannedBhpGood = key === "usages"
        ? currentGoods.find((row) => isBhp(row) && [row.barcode, row.id, row.name].some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedCode))
        : null;
      const good = key === "usages" ? (item ? getById("goods", item.goodId) : scannedBhpGood) : (item ? getById("goods", item.goodId) : scannedGood);
      if (!good) {
        const message = key === "usages" ? "Barcode BHP tidak dikenali. Pilih barang secara manual." : `Kode "${code}" tidak ditemukan di data barang atau item.`;
        setStatus(message, true);
        showToast(key === "usages" ? message : `Barcode "${code}" tidak dikenali.`, true);
        return false;
      }
      if (key === "loans" && item && item.condition !== "Baik") {
        setStatus("Item tidak berkondisi baik dan tidak dapat dipinjam.", true);
        showToast("Pilih item dengan kondisi baik untuk peminjaman.", true);
        return false;
      }
      if (key === "disposals" && item && !["Rusak", "Rusak Berat"].includes(item.condition)) {
        setStatus("Item tidak berkondisi rusak dan tidak dapat diajukan untuk pemusnahan.", true);
        showToast("Pindai item dengan kondisi rusak untuk pemusnahan.", true);
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
        if (![...goodSelect.options].some((option) => option.value === good.id)) {
          setStatus("Barang pada barcode tidak sesuai dengan jenis barang yang dapat dipilih di formulir ini.", true);
          showToast("Barang pada barcode tidak dapat dipilih di formulir ini.", true);
          return false;
        }
        const changed = goodSelect.value !== good.id;
        goodSelect.value = good.id;
        if (changed) goodSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const locationSelect = form.elements.locationId;
      if (locationSelect && item?.locationId && [...locationSelect.options].some((option) => option.value === item.locationId)) {
        locationSelect.value = item.locationId;
      }
      if (key === "loans" && form.elements.quantity) form.elements.quantity.value = "1";
      const stock = `${good.quantity} ${relatedName("units", good.unitId)}`;
      const loanAvailability = key === "loans" ? ` · Tersedia untuk dipinjam: ${loanFormAvailableQuantity(good.id, form.dataset.record)}` : "";
      setStatus(`${item?.code || good.barcode} · ${good.name} · Stok saat ini: ${stock}${loanAvailability}.`);
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
    goodsImportDraft = [];
    $("#modalRoot").innerHTML = "";
  }

  function recordMaintenanceHistory(schedule, action) {
    if (!Array.isArray(state.maintenanceHistory)) state.maintenanceHistory = [];
    state.maintenanceHistory.unshift({
      id: id(),
      scheduleId: schedule.id,
      goodId: schedule.goodId,
      date: schedule.date,
      nextServiceDate: schedule.nextServiceDate || "",
      type: schedule.type,
      status: schedule.status || "Menunggu Jadwal",
      estimatedCost: Number(schedule.estimatedCost) || 0,
      technician: schedule.technician || "",
      action,
      updatedBy: activeUser?.name || "Sistem",
      updatedAt: new Date().toISOString(),
      academicYearId: schedule.academicYearId || currentAcademicYearId()
    });
  }

  async function saveRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = form.dataset.collection;
    const permissionKey = key === "maintenanceSchedules" ? "maintenanceCalendar" : key;
    if (!canEditPage(permissionKey)) {
      showToast("Akun Anda tidak memiliki izin menyimpan data ini.", true);
      return;
    }
    if (!Array.isArray(state[key])) state[key] = [];
    const printLoanAfterSave = key === "loans" && event.submitter?.value === "saveAndPrint";
    const recordId = form.dataset.record;
    const config = collectionConfig[key];
    const old = recordId ? getById(key, recordId) : null;
    const previousMaintenanceStatus = old?.status || "Menunggu Jadwal";
    const data = old ? { ...old } : { id: id() };
    let copySourceYear = null;
    let accountSyncPending = false;
    let loanGood = null;
    let priorLoanGood = null;
    let priorLoanQuantity = 0;
    let usageGood = null;
    let priorUsageGood = null;
    let priorUsageQuantity = 0;
    for (const [name, , type] of config.fields) {
      const input = form.elements.namedItem(name);
      if (!input) continue;
      if (type === "checkbox") data[name] = input.checked;
      else if (moneyFields.has(name)) data[name] = parseThousands(input.value);
      else if (type === "number") data[name] = Number(input.value || 0);
      else if (type === "password") continue;
      else if (type === "file") {
        if (input.files?.[0]) {
          if (key === "repairTickets" && !input.files[0].type.startsWith("image/")) {
            showToast("Foto kerusakan harus berupa file gambar.", true);
            return;
          }
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
    if (key === "loans" && data.whatsapp && !validWhatsAppNumber(data.whatsapp)) {
      showToast("Nomor WhatsApp peminjam tidak valid. Gunakan format 08... atau +628...", true);
      return;
    }
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
      const previousQuantity = Math.max(0, Number(old?.quantity) || 0);
      const previousInitial = Math.max(0, Number(old?.initialQuantity ?? old?.quantity) || 0);
      data.initialQuantity = old
        ? previousInitial + Math.max(0, Number(data.quantity) - previousQuantity)
        : Math.max(0, Number(data.quantity) || 0);
    }
    if (key === "locations") {
      if (!recordsForAcademicYear("ownerships", data.academicYearId).some((ownership) => ownership.id === data.ownershipId)) {
        showToast("Pilih kepemilikan ruangan yang valid.", true);
        return;
      }
      if (!Number.isInteger(data.floor) || data.floor < 0) {
        showToast("Lantai harus berupa angka bulat nol atau lebih.", true);
        return;
      }
      if (!Number.isFinite(data.length) || data.length <= 0 || !Number.isFinite(data.width) || data.width <= 0) {
        showToast("Panjang dan lebar ruangan harus lebih dari nol.", true);
        return;
      }
      if (!["Aktif", "Nonaktif"].includes(data.status)) {
        showToast("Pilih status ruangan yang valid.", true);
        return;
      }
      data.area = calculatedRoomArea(data.length, data.width);
      data.code = old?.code || String(data.code || "").trim() || nextLocationCode(data.academicYearId);
      const codeTaken = recordsForAcademicYear("locations", data.academicYearId).some((room) =>
        room.id !== old?.id && String(room.code || "").trim().toUpperCase() === data.code.toUpperCase());
      if (codeTaken) {
        if (old) {
          showToast("Kode ruangan sudah digunakan. Muat ulang data sebelum mengedit ruangan ini.", true);
          return;
        }
        data.code = nextLocationCode(data.academicYearId, [data.code]);
      }
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
      const restoresOldUsage = (old?.stockAdjusted === true || old?.status === "Disetujui") && old.goodId === good.id;
      const restoredQuantity = restoresOldUsage ? Number(old.quantity) || 0 : 0;
      const available = Number(good.quantity || 0) + restoredQuantity;
      if (data.quantity > available) {
        showToast(`Maksimal stok adalah ${available}.`, true);
        return;
      }
      if (old?.stockAdjusted === true || old?.status === "Disetujui") {
        priorUsageGood = getById("goods", old.goodId);
        priorUsageQuantity = Number(old.quantity) || 0;
      }
      usageGood = good;
      data.stockAdjusted = true;
      delete data.status;
    }
    if (key === "repairTickets") {
      const good = getById("goods", data.goodId);
      if (!good || !recordsForAcademicYear("goods").some((row) => row.id === good.id)) {
        showToast("Pilih barang yang masih aktif pada tahun pelajaran ini.", true);
        return;
      }
      if (!Number.isInteger(data.quantity) || data.quantity < 1) {
        showToast("Jumlah barang pada tiket minimal 1 unit.", true);
        return;
      }
      const availableStock = Math.max(0, Number(good.quantity) || 0);
      if (data.quantity > availableStock) {
        showToast(`Jumlah barang pada tiket tidak boleh melebihi stok tersedia (${availableStock}).`, true);
        return;
      }
      if (!["Rendah", "Sedang", "Tinggi", "Urgent"].includes(data.priority)) {
        showToast("Pilih prioritas tiket yang valid.", true);
        return;
      }
      data.status = old?.status || "Diajukan";
      data.createdAt = old?.createdAt || dateOffset(0);
      if (!old) {
        const nextSequence = Math.max(0, ...state.repairTickets.map((ticket) => Number(ticket.ticketSequence) || 0)) + 1;
        data.ticketSequence = nextSequence;
        data.ticketNo = `TKT-${today.getFullYear()}-${String(nextSequence).padStart(4, "0")}`;
      }
    }
    if (key === "maintenanceSchedules") {
      const good = getById("goods", data.goodId);
      const location = recordsForAcademicYear("locations").find((row) => row.id === data.locationId);
      if (!good || !recordsForAcademicYear("goods").some((row) => row.id === good.id)) {
        showToast("Pilih barang yang masih aktif pada tahun pelajaran ini.", true);
        return;
      }
      if (!location) {
        showToast("Pilih lokasi yang valid.", true);
        return;
      }
      if (!Number.isInteger(data.quantity) || data.quantity < 1) {
        showToast("Jumlah barang pada jadwal minimal 1 unit.", true);
        return;
      }
      const availableStock = Math.max(0, Number(good.quantity) || 0);
      if (data.quantity > availableStock) {
        showToast(`Jumlah barang pada jadwal tidak boleh melebihi stok tersedia (${availableStock}).`, true);
        return;
      }
      if (!maintenanceTypes.includes(data.type)) {
        showToast("Pilih jenis perawatan yang valid.", true);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        showToast("Tanggal jadwal wajib diisi dengan benar.", true);
        return;
      }
      if (!maintenanceStatuses.includes(data.status)) {
        showToast("Pilih status pengerjaan yang valid.", true);
        return;
      }
      if (!Number.isFinite(data.estimatedCost) || data.estimatedCost < 0) {
        showToast("Estimasi biaya perawatan harus nol atau lebih.", true);
        return;
      }
      if (data.nextServiceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(data.nextServiceDate) || data.nextServiceDate <= data.date)) {
        showToast("Tanggal servis berikutnya harus valid dan setelah tanggal servis ini.", true);
        return;
      }
      if (data.status === "Selesai") data.completedAt = old?.completedAt || dateOffset(0);
      else delete data.completedAt;
    }
    if (key === "items" && !old) {
      const goodIndex = Math.max(0, recordsForAcademicYear("goods").findIndex((good) => good.id === data.goodId)) + 1;
      const itemIndex = state.items.filter((item) => item.goodId === data.goodId).length + 1;
      data.code = `E.1-T.${goodIndex}-L1-KS.${itemIndex}`;
    }
    if (key === "loans") {
      const good = getById("goods", data.goodId);
      if (!good || isBhp(good)) {
        showToast("Pilih barang modal yang valid untuk dipinjam.", true);
        return;
      }
      if (!Number.isInteger(data.quantity) || data.quantity < 1) {
        showToast("Jumlah barang yang dipinjam minimal 1 unit.", true);
        return;
      }
      data.status = old?.status && old.status !== "Pengajuan" ? old.status : "Diterima";
      if (data.status === "Diterima") {
        const available = loanFormAvailableQuantity(data.goodId, old?.id);
        if (data.quantity > available) {
          showToast(`Jumlah melebihi stok yang dapat dipinjam. Maksimal tersedia ${available} unit.`, true);
          return;
        }
      }
      if (!Number.isInteger(data.durationDays) || data.durationDays < 1) {
        showToast("Jumlah hari peminjaman minimal 1 hari.", true);
        return;
      }
      if (!data.startDate) {
        showToast("Tanggal sewa wajib diisi.", true);
        return;
      }
      data.dueDate = addDaysToDate(data.startDate, data.durationDays);
      if (!data.dueDate) {
        showToast("Tanggal kembali tidak dapat dihitung. Periksa tanggal sewa.", true);
        return;
      }
      loanGood = good;
      if (old?.stockAdjusted === true) {
        priorLoanGood = getById("goods", old.goodId);
        priorLoanQuantity = Math.max(1, Number(old.quantity) || 1);
      }
      data.stockAdjusted = data.status === "Diterima";
      if (!old) {
        data.transactionSequence = Math.max(1, Number(state.settings.loanReceiptNextSequence) || 1);
        data.transactionNo = formatLoanReceiptNumber(data.transactionSequence, dateOffset(0), state.settings.loanReceiptNumberFormat);
        state.settings.loanReceiptNextSequence = data.transactionSequence + 1;
      }
    }
    if (key === "procurements") data.status = old?.status || "Pengajuan";
    let disposalGood = null;
    let priorDisposalGood = null;
    let priorDisposalQuantity = 0;
    if (key === "disposals") {
      disposalGood = getById("goods", data.goodId);
      if (!disposalGood) {
        showToast("Pilih barang yang valid untuk dimusnahkan.", true);
        return;
      }
      if (!Number.isInteger(data.quantity) || data.quantity < 1) {
        showToast("Jumlah barang yang dimusnahkan minimal 1 unit.", true);
        return;
      }
      const restoresOldDisposal = old?.stockAdjusted === true && old.goodId === disposalGood.id;
      const restoredQuantity = restoresOldDisposal ? Math.max(1, Number(old.quantity) || 1) : 0;
      const available = Math.max(0, Number(disposalGood.quantity || 0) - activeLoanQuantity(disposalGood.id) + restoredQuantity);
      if (data.quantity > available) {
        showToast(`Jumlah pemusnahan melebihi stok yang dapat dimusnahkan. Maksimal tersedia ${available} unit.`, true);
        return;
      }
      if (old?.stockAdjusted === true) {
        priorDisposalGood = getById("goods", old.goodId);
        priorDisposalQuantity = Math.max(1, Number(old.quantity) || 1);
      }
      data.status = "Selesai";
      data.stockAdjusted = true;
    }
    let stocktakeGood = null;
    if (key === "stocktakes") {
      stocktakeGood = getById("goods", data.goodId);
      if (!stocktakeGood) {
        showToast("Pilih barang yang valid untuk stock opname.", true);
        return;
      }
      const newStock = Number(data.newStock);
      const initialStock = old ? Number(old.oldStock || 0) : Number(stocktakeGood.quantity || 0);
      if (!Number.isInteger(newStock) || newStock < 0) {
        showToast("Stok baru harus berupa bilangan bulat nol atau lebih.", true);
        return;
      }
      if (old && old.goodId !== data.goodId) {
        showToast("Barang pada stock opname yang sudah dibuat tidak dapat diganti.", true);
        return;
      }
      if (newStock > initialStock) {
        showToast(`Stok baru tidak boleh melebihi stok awal (${initialStock}).`, true);
        return;
      }
      data.newStock = newStock;
      data.total = newStock;
      data.oldStock = initialStock;
      data.missingQuantity = Math.max(0, initialStock - newStock);
      data.lossStatus = data.missingQuantity ? (data.lossStatus || old?.lossStatus || "Perlu penelusuran") : "Tidak ada kehilangan";
      data.locationId = old?.locationId || stocktakeGood.locationId || "";
    }
    if (key === "items" && ["Rusak", "Rusak Berat", "Hilang"].includes(data.condition)) {
      data.conditionDate = old?.condition === data.condition ? old.conditionDate || old.received || "" : dateOffset(0);
    } else if (key === "items" && data.condition === "Baik") {
      data.conditionDate = "";
    }
    if (key === "depreciations") {
      const good = getById("goods", data.goodId);
      if (!good) {
        showToast("Pilih barang yang valid untuk dicatat penyusutannya.", true);
        return;
      }
      const initialValue = Number(good.price);
      const residualValue = Number(data.residualValue);
      if (!Number.isFinite(initialValue) || initialValue <= 0) {
        showToast("Harga awal barang harus lebih dari Rp0 agar dapat disusutkan.", true);
        return;
      }
      if (!Object.values(depreciationMethods).includes(data.method)) {
        showToast("Metode penyusutan yang dipilih belum didukung.", true);
        return;
      }
      if (!["Bulanan", "Tahunan"].includes(data.periodType)) {
        showToast("Pilih periode penyusutan bulanan atau tahunan.", true);
        return;
      }
      if (!Number.isInteger(data.usefulLifeYears) || data.usefulLifeYears < 1) {
        showToast("Umur ekonomis harus berupa bilangan bulat minimal 1 tahun.", true);
        return;
      }
      if (!Number.isFinite(residualValue) || residualValue < 0 || residualValue > initialValue) {
        showToast("Nilai residu harus berada di antara Rp0 dan harga awal barang.", true);
        return;
      }
      const expectedPeriodEnd = depreciationPeriodEnd(data.periodType, data.date, data.academicYearId);
      if (!expectedPeriodEnd || data.date !== expectedPeriodEnd) {
        showToast("Tanggal penyusutan harus berada pada akhir periode yang dipilih.", true);
        return;
      }
      const duplicatePeriod = state.depreciations.some((record) =>
        record.id !== old?.id && record.goodId === data.goodId && record.date === data.date
      );
      if (duplicatePeriod) {
        showToast("Penyusutan untuk barang dan periode tersebut sudah tercatat.", true);
        return;
      }
      const calculation = calculateDepreciation(
        data.goodId,
        data.date,
        data.periodType,
        data.usefulLifeYears,
        residualValue,
        data.method,
        old?.id
      );
      if (calculation.amount <= 0) {
        showToast("Tidak ada nilai yang dapat disusutkan pada periode ini; aset telah mencapai nilai residu.", true);
        return;
      }
      data.initialValue = initialValue;
      data.amount = calculation.amount;
      data.accumulatedAmount = calculation.accumulatedAmount;
      data.finalValue = calculation.finalValue;
    }
    if (key === "goods") syncGoodConditionCounts(data);
    const previous = key === "accounts" && old ? { ...old } : null;
    if (old) {
      Object.assign(old, data);
      if (key === "usages") delete old.status;
    }
    else state[key].unshift(data);
    if (key === "maintenanceSchedules") {
      const newStatus = data.status || "Menunggu Jadwal";
      const action = !old ? "Jadwal servis dibuat"
        : previousMaintenanceStatus !== newStatus ? `Status diubah: ${previousMaintenanceStatus} → ${newStatus}`
          : "Jadwal servis diperbarui";
      recordMaintenanceHistory(data, action);
    }
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
    if (priorUsageGood) {
      priorUsageGood.quantity = Number(priorUsageGood.quantity || 0) + priorUsageQuantity;
      syncGoodConditionCounts(priorUsageGood);
    }
    if (usageGood) {
      usageGood.quantity = Math.max(0, Number(usageGood.quantity || 0) - data.quantity);
      syncGoodConditionCounts(usageGood);
    }
    if (priorLoanGood) {
      priorLoanGood.quantity = Number(priorLoanGood.quantity || 0) + priorLoanQuantity;
      syncGoodConditionCounts(priorLoanGood);
    }
    if (loanGood && data.status === "Diterima") {
      loanGood.quantity = Math.max(0, Number(loanGood.quantity || 0) - data.quantity);
      syncGoodConditionCounts(loanGood);
    }
    if (priorDisposalGood) {
      priorDisposalGood.quantity = Number(priorDisposalGood.quantity || 0) + priorDisposalQuantity;
      syncGoodConditionCounts(priorDisposalGood);
    }
    if (disposalGood) {
      disposalGood.quantity = Math.max(0, Number(disposalGood.quantity || 0) - data.quantity);
      syncGoodConditionCounts(disposalGood);
    }
    if (key === "accounts") {
      try {
        const synced = await persistAccounts();
        accountSyncPending = !synced || !apiAvailable;
      } catch (error) {
        if (old && previous) Object.assign(old, previous);
        else state.accounts = state.accounts.filter((account) => account.id !== data.id);
        try { storeLocalState(); }
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
    }
    logActivity(old ? "Memperbarui" : "Menambahkan", config.singular, trashRecordLabel(data));
    saveState();
    closeModal();
    if (key === "academicYears" && !old && copySourceYear) {
      const yearMasters = yearMasterCollections.reduce((total, collection) => total + recordsForAcademicYear(collection, data.id).length, 0);
      const yearGoods = recordsForAcademicYear("goods", data.id).length;
      showToast(`${config.singular} berhasil ditambahkan dengan menyalin ${yearMasters} data master dan ${yearGoods} barang beserta stok terakhir.`);
    } else if (key === "disposals") {
      showToast(`Pemusnahan berhasil ${old ? "diperbarui" : "dicatat"}. Stok ${disposalGood.name} berkurang ${data.quantity} unit.`);
    } else if (key === "accounts" && accountSyncPending) {
      showToast("Server belum tersambung atau menolak sinkronisasi. Perubahan akun hanya tersimpan di perangkat ini; pastikan server aktif lalu buka kembali aplikasi sebagai Administrator.", true);
    } else showToast(`${config.singular} berhasil ${old ? "diperbarui" : "ditambahkan"}.`);
    renderPage();
    if (printLoanAfterSave) printLoanReceipt(data);
  }

  async function printLoanReceipt(loan) {
    let receipt = $("#loanReceiptPrint");
    if (!receipt) {
      receipt = document.createElement("section");
      receipt.id = "loanReceiptPrint";
      document.body.append(receipt);
    }
    const good = getById("goods", loan.goodId);
    const signature = loan.signature
      ? `<img class="loan-receipt-signature-image" src="${esc(loan.signature)}" alt="Tanda tangan peminjam">`
      : `<div class="loan-receipt-signature-space"></div>`;
    const school = state.school || seed.school;
    receipt.innerHTML = `<div class="loan-receipt">
      <div class="loan-receipt-header">${printSchoolHeaderMarkup(school, state.settings.printDesign || seed.settings.printDesign)}</div>
      <h1>Bukti Peminjaman Barang</h1>
      <p class="loan-receipt-number">Nomor: ${esc(loan.transactionNo || loan.id)}</p>
      <table><tbody>
        <tr><th>Nama peminjam</th><td>${esc(loan.borrower)}</td></tr>
        <tr><th>Nama barang</th><td>${esc(good?.name || "—")}</td></tr>
        <tr><th>Jumlah dipinjam</th><td>${esc(loan.quantity)} ${esc(relatedName("units", good?.unitId))}</td></tr>
        <tr><th>Lokasi</th><td>${esc(relatedName("locations", loan.locationId))}</td></tr>
        <tr><th>Tanggal sewa</th><td>${esc(niceDate(loan.startDate))}</td></tr>
        <tr><th>Lama peminjaman</th><td>${esc(loan.durationDays)} hari</td></tr>
        <tr><th>Tanggal kembali</th><td>${esc(niceDate(loan.dueDate))}</td></tr>
        <tr><th>Keterangan</th><td>${esc(loan.note || "—")}</td></tr>
      </tbody></table>
      <div class="loan-receipt-signatures">
        <div class="loan-receipt-signatory">
          <p>Mengetahui,</p><p>Wakasek Sarpras</p>
          <div class="loan-receipt-signature-line"></div>
          <b>${esc(school.sarprasVicePrincipalName || "________________________")}</b>
          ${school.sarprasVicePrincipalNip ? `<small>NIP. ${esc(school.sarprasVicePrincipalNip)}</small>` : ""}
        </div>
        <div class="loan-receipt-signatory">
          <p>${esc(school.city || "................")}, ${esc(niceDate(dateOffset(0)))}</p><p>Peminjam</p>
          ${signature}<b>${esc(loan.borrower)}</b>
        </div>
      </div>
    </div>`;
    const signatureImage = receipt.querySelector(".loan-receipt-signature-image");
    if (signatureImage) {
      try {
        if (!signatureImage.complete) {
          await new Promise((resolve, reject) => {
            signatureImage.addEventListener("load", resolve, { once: true });
            signatureImage.addEventListener("error", () => reject(new Error("Gambar tanda tangan tidak dapat dimuat.")), { once: true });
          });
        }
        if (!signatureImage.naturalWidth) throw new Error("Gambar tanda tangan tidak dapat dimuat.");
        if (typeof signatureImage.decode === "function") await signatureImage.decode();
      } catch (error) {
        showToast(`Tanda tangan peminjam tidak dapat disiapkan untuk dicetak: ${error.message}`, true);
        return;
      }
    }
    document.body.classList.add("print-loan-receipt");
    window.print();
  }

  function openBastModal(type, recordId) {
    if (!["assetMovements", "procurements", "disposals"].includes(type)) return showToast("Jenis dokumen BAST tidak valid.", true);
    const record = (state[type] || []).find((entry) => entry.id === recordId);
    if (!record) return showToast("Data transaksi untuk BAST tidak ditemukan.", true);
    if (!record.bastNumber) {
      const year = String(record.date || dateOffset(0)).slice(0, 4);
      let sequence = Math.max(1, Number(state.settings.bastSequence) || 1);
      const usedNumbers = new Set(["assetMovements", "procurements", "disposals"]
        .flatMap((collection) => state[collection] || [])
        .map((entry) => entry.bastNumber).filter(Boolean));
      let number = `BAST/AST/${year}/${String(sequence).padStart(4, "0")}`;
      while (usedNumbers.has(number)) {
        sequence += 1;
        number = `BAST/AST/${year}/${String(sequence).padStart(4, "0")}`;
      }
      record.bastNumber = number;
      state.settings.bastSequence = sequence + 1;
      saveState();
    }
    const defaultSender = record.bastParties?.senderName || state.school.sarprasVicePrincipalName || activeUser?.name || "";
    const defaultReceiver = record.bastParties?.receiverName || record.responsible || record.proposer || state.school.principalName || "";
    const transactionDate = record.bastParties?.date || record.date || dateOffset(0);
    const heading = type === "assetMovements" ? "Serah Terima Perpindahan Barang"
      : type === "procurements" ? "Serah Terima Barang Pengadaan"
        : "Serah Terima Aset untuk Pemusnahan";
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="bastModalTitle"><div class="modal-header"><div><h2 id="bastModalTitle">Cetak Berita Acara Serah Terima</h2><p>${esc(heading)}</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form id="bastForm" class="modal-form"><div class="form-grid">
      <div class="form-field full"><label for="bastNumber">Nomor Berita Acara</label><input id="bastNumber" name="number" maxlength="100" required value="${esc(record.bastNumber)}"></div>
      <div class="form-field"><label for="bastDate">Tanggal Berita Acara</label><input id="bastDate" name="date" type="date" required value="${esc(transactionDate)}"></div>
      <div class="form-field"><label for="bastSender">Pihak yang Menyerahkan</label><input id="bastSender" name="senderName" maxlength="120" required value="${esc(defaultSender)}"></div>
      <div class="form-field full"><label for="bastReceiver">Pihak yang Menerima</label><input id="bastReceiver" name="receiverName" maxlength="120" required value="${esc(defaultReceiver)}"></div>
    </div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="submit" class="btn-primary"><i data-lucide="printer"></i>Simpan & Cetak BAST</button></div></form></section></div>`);
    $("#bastForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      record.bastNumber = form.elements.number.value.trim();
      record.bastParties = {
        date: form.elements.date.value,
        senderName: form.elements.senderName.value.trim(),
        receiverName: form.elements.receiverName.value.trim()
      };
      saveState();
      const parties = { ...record.bastParties, number: record.bastNumber };
      closeModal();
      printBastDocument(type, record, parties, heading);
    });
  }

  function printBastDocument(type, record, parties, heading) {
    const good = getById("goods", record.goodId);
    const itemCodes = (state.items || []).filter((item) => item.goodId === record.goodId).map((item) => item.code).filter(Boolean);
    if (type === "assetMovements" && record.itemCode && !itemCodes.includes(record.itemCode)) itemCodes.unshift(record.itemCode);
    const quantity = Number(record.quantity) || (type === "assetMovements" ? Number(good?.quantity) || 1 : 0);
    const unit = relatedName("units", good?.unitId);
    const location = type === "assetMovements"
      ? `${record.fromLocationName || "Belum ditentukan"} → ${record.toLocationName || "—"}`
      : relatedName("locations", record.locationId || good?.locationId);
    const detail = record.reason || record.note || record.approvalNote || "—";
    const school = state.school || seed.school;
    const design = state.settings.printDesign || seed.settings.printDesign;
    const header = printSchoolHeaderMarkup(school, design);
    const itemDescription = good?.name || record.goodName || record.title || "Barang / aset";
    const codes = itemCodes.length ? itemCodes.join(", ") : "—";
    const printWindow = window.open("", "_blank");
    if (!printWindow) return showToast("Jendela cetak diblokir. Izinkan pop-up lalu ulangi cetak BAST.", true);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(parties.number)}</title><style>
      *{box-sizing:border-box}body{margin:0;color:#172033;font:12px Arial,sans-serif}.bast-page{max-width:190mm;margin:14mm auto}.bast-header{display:flex;align-items:center;gap:14px;border-bottom:3px double #222;padding-bottom:12px}.bast-header img{width:55px;height:55px;object-fit:contain}.bast-header .print-school-initial{display:grid;place-items:center;border:1px solid #444;font-weight:bold}.bast-header h1{margin:0 0 5px;font-size:18px}.bast-header p{margin:3px 0;font-size:10px}.bast-title{text-align:center;margin:24px 0 18px}.bast-title h2{margin:0;text-decoration:underline;font-size:16px}.bast-title p{margin:8px 0 0}.bast-copy{line-height:1.75;text-align:justify}.bast-table{width:100%;border-collapse:collapse;margin:15px 0}.bast-table th,.bast-table td{border:1px solid #333;padding:8px;text-align:left;vertical-align:top}.bast-table th{background:#f1f3f5}.bast-signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;text-align:center;margin-top:35px;page-break-inside:avoid}.bast-signatures p{margin:0 0 8px}.bast-signature-space{height:74px}.bast-signatures strong{display:block;text-decoration:underline}.bast-signatures small{display:block;margin-top:4px}.bast-note{margin-top:22px;font-size:10px;color:#444}@page{size:A4 portrait;margin:16mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.bast-page{max-width:none;margin:0}.bast-table th{background:#f1f3f5!important}.bast-signatures{break-inside:avoid}}
      </style></head><body><main class="bast-page"><header class="bast-header">${header}</header><div class="bast-title"><h2>BERITA ACARA SERAH TERIMA</h2><p>${esc(parties.number)}</p><p>${esc(heading)}</p></div><p class="bast-copy">Pada hari ini, ${esc(niceDate(parties.date))}, pihak yang bertanda tangan di bawah ini menyatakan telah melaksanakan serah terima barang/aset sekolah dengan rincian sebagai berikut:</p><table class="bast-table"><thead><tr><th>No.</th><th>Nama Barang / Aset</th><th>Kode Inventaris</th><th>Jumlah</th><th>Lokasi</th></tr></thead><tbody><tr><td>1</td><td>${esc(itemDescription)}<br><small>${esc(detail)}</small></td><td>${esc(codes)}</td><td>${esc(quantity)} ${esc(unit)}</td><td>${esc(location)}</td></tr></tbody></table><p class="bast-copy">Barang/aset tersebut telah diperiksa dan diterima sesuai kondisi serta keterangan di atas. Berita acara ini dibuat dengan sebenarnya untuk digunakan sebagaimana mestinya.</p><div class="bast-signatures"><div><p>Pihak yang Menyerahkan,</p><div class="bast-signature-space"></div><strong>${esc(parties.senderName)}</strong><small>${esc(school.sarprasVicePrincipalNip ? `NIP. ${school.sarprasVicePrincipalNip}` : "")}</small></div><div><p>${esc(school.city || "................")}, ${esc(niceDate(parties.date))}</p><p>Pihak yang Menerima,</p><div class="bast-signature-space"></div><strong>${esc(parties.receiverName)}</strong></div></div><p class="bast-note">Dokumen ini merupakan berita acara serah terima aset sekolah dan dapat ditandatangani oleh para pihak.</p></main><script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print()},250));</script></body></html>`);
    printWindow.document.close();
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

  function updateGoodsPurchaseSelection() {
    const checks = $$(".goods-purchase-select", $("#pageContent"));
    const selected = checks.filter((check) => check.checked);
    const selectAll = $("#selectAllGoodsPurchases");
    if (selectAll) {
      selectAll.checked = checks.length > 0 && selected.length === checks.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < checks.length;
    }
    const deleteButton = $("#deleteSelectedGoodsPurchases");
    if (deleteButton) {
      deleteButton.disabled = selected.length === 0;
      $("#selectedGoodsPurchaseCount").textContent = selected.length ? `(${selected.length})` : "";
    }
  }

  function deleteGoodsPurchaseRecords(recordIds) {
    if (page !== "goods" || !canDeletePage("goods")) return showToast("Akun Anda tidak memiliki izin menghapus riwayat barang masuk.", true);
    const selectedIds = new Set(recordIds);
    const purchases = (state.procurements || []).filter((record) => selectedIds.has(record.id) && isStockAdditionRecord(record));
    if (!purchases.length) return showToast("Riwayat barang masuk tidak ditemukan.", true);
    const quantitiesByGood = new Map();
    purchases.forEach((record) => quantitiesByGood.set(record.goodId, (quantitiesByGood.get(record.goodId) || 0) + Math.max(0, Number(record.quantity) || 0)));
    for (const [goodId, quantity] of quantitiesByGood) {
      const good = getById("goods", goodId);
      if (!good) return showToast("Barang terkait tidak ditemukan; riwayat tidak dapat dihapus.", true);
      if (quantity > Number(good.quantity || 0)) {
        return showToast(`Stok ${good.name} sudah berkurang dan tidak cukup untuk membatalkan penambahan ini. Riwayat tidak dihapus.`, true);
      }
    }
    showDeleteConfirmation(
      "Hapus riwayat barang masuk?",
      `${purchases.length} riwayat akan dipindahkan ke Kotak Sampah dan jumlah stok terkait akan dikurangi.`,
      () => {
        for (const record of purchases) {
          if (!moveRecordToTrash("procurements", record)) {
            return showToast("Riwayat tidak dapat dihapus karena stok barang tidak mencukupi.", true);
          }
        }
        saveState();
        showToast(`${purchases.length} riwayat barang masuk dihapus dan stok diperbarui.`);
        renderPage();
      },
      "Hapus riwayat"
    );
  }

  function openCalendarScheduleForm(date = "", record = null) {
    if (!canEditPage("maintenanceCalendar")) return showToast("Akun Anda tidak memiliki izin mengatur jadwal.", true);
    calendarPrefillDate = date || calendarSelectedDate || dateOffset(0);
    showModal(modalForm("maintenanceSchedules", record));
    calendarPrefillDate = "";
  }

  function openLowStockProcurement(goodId) {
    if (!canEditPage("procurements")) return showToast("Akun Anda tidak memiliki izin membuat pengajuan pengadaan.", true);
    const good = getById("goods", goodId);
    const alert = bhpStockAlert(good);
    if (!good || !alert) return showToast("Stok barang tidak lagi memenuhi batas peringatan.", true);
    procurementPrefill = {
      good,
      quantity: Math.max(1, alert.initial - alert.remaining)
    };
    navigate("procurements");
    showModal(modalForm("procurements"));
    procurementPrefill = null;
  }

  function recordActions(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") return closeModal();
    if (action === "refresh-tenant-billing") {
      tenantBillingData = { loading: true };
      renderPage();
      return;
    }
    if (action === "set-theme") {
      if (!themePalette[button.dataset.theme]) return;
      state.settings.themeColor = button.dataset.theme;
      saveState();
      applyAppBranding();
      renderPage();
      showToast(`Tema ${themePalette[button.dataset.theme].label} diterapkan.`);
      return;
    }
    if (action === "print-bast") {
      openBastModal(button.dataset.type, button.dataset.id);
      return;
    }
    if (action === "delete-stored-file") {
      if (activeUser?.role !== "Administrator") return showToast("Hanya Administrator yang dapat menghapus file tersimpan.", true);
      const file = embeddedImageFiles()[Number(button.dataset.index)];
      if (!file) return showToast("File tidak ditemukan atau sudah dihapus.", true);
      showDeleteConfirmation("Hapus foto tersimpan?", `${filePathLabel(file.path)} · ${formatStorageBytes(file.bytes)}. Data inventaris terkait tetap dipertahankan.`, async () => {
        let parent = state;
        file.path.slice(0, -1).forEach((part) => { parent = parent?.[part]; });
        const key = file.path[file.path.length - 1];
        if (!parent || typeof parent[key] !== "string" || !parent[key].startsWith("data:image/")) {
          return showToast("File tidak ditemukan atau sudah berubah.", true);
        }
        parent[key] = "";
        storageUsageData = null;
        const synced = await persistState();
        showToast(synced && apiAvailable
          ? "File gambar dihapus dan perubahan tersimpan di server."
          : "File gambar dihapus secara lokal; perubahan akan disinkronkan otomatis saat koneksi pulih atau Administrator masuk kembali.", !(synced && apiAvailable));
        renderPage();
      }, "Hapus file");
      return;
    }
    if (action === "create-payment-checkout") {
      createTenantCheckout(button.dataset.id);
      return;
    }
    if (action === "toggle-account") {
      if (activeUser?.role !== "Administrator") return showToast("Hanya administrator yang dapat mengubah status akun.", true);
      const account = getById("accounts", button.dataset.id);
      if (account) {
        account.active = !account.active;
        logActivity("Mengubah status akun", "Pengaturan", `${account.name} · ${account.active ? "Aktif" : "Nonaktif"}`);
        saveState(); showToast(`Akun ${account.active ? "diaktifkan" : "dinonaktifkan"}.`); renderPage();
      }
    }
    if (action === "add") {
      if (!canEditPage()) return showToast("Akun Anda hanya dapat melihat data ini.", true);
      if (page === "accounts" || collectionConfig[page]) showModal(modalForm(page));
    } else if (action === "add-existing-good") {
      if (page !== "goods") return;
      showExistingGoodPurchaseModal();
    } else if (action === "add-asset-movement") {
      if (page !== "assetMovements") return;
      openAssetMovementForm();
    } else if (action === "edit") {
      if (!canEditPage()) return showToast("Akun Anda tidak memiliki izin mengubah data.", true);
      const record = getById(page, button.dataset.id);
      if (record) showModal(modalForm(page, record));
    } else if (action === "goods-condition") {
      if (page !== "goods" || !canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin mengubah kondisi barang.", true);
      showGoodsConditionModal(button.dataset.id);
    } else if (action === "room-condition") {
      if (page !== "locations" || !canEditPage("locations")) return showToast("Akun Anda tidak memiliki izin mengubah kondisi ruangan.", true);
      showRoomConditionModal(button.dataset.id);
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
        const recordName = trashRecordLabel(record);
        showDeleteConfirmation("Pindahkan data ke kotak sampah?", `Data "${recordName}" dapat dipulihkan dari menu Kotak Sampah.`, () => {
          if (!moveRecordToTrash(collection, record)) return showToast("Data tidak dapat dipindahkan ke kotak sampah.", true);
          saveState(); showToast("Data dipindahkan ke kotak sampah."); renderPage();
        }, "Pindahkan ke Sampah");
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
      showDeleteConfirmation("Pindahkan data ke kotak sampah?", `${selectedRows.length} data dari ${collectionConfig[collection].title} dapat dipulihkan dari menu Kotak Sampah.`, () => {
        selectedRows.forEach((record) => moveRecordToTrash(collection, record));
        saveState();
        showToast(`${selectedRows.length} data dipindahkan ke kotak sampah.`);
        renderPage();
      }, "Pindahkan ke Sampah");
    } else if (action === "delete-goods-purchase") {
      deleteGoodsPurchaseRecords([button.dataset.id]);
    } else if (action === "select-visible-goods-purchases") {
      $$(".goods-purchase-select", $("#pageContent")).forEach((check) => { check.checked = true; });
      updateGoodsPurchaseSelection();
    } else if (action === "delete-selected-goods-purchases") {
      deleteGoodsPurchaseRecords($$(".goods-purchase-select:checked", $("#pageContent")).map((check) => check.value));
    } else if (action === "restore-trash") {
      if (!canEditPage("trash")) return showToast("Akun Anda tidak memiliki izin memulihkan data.", true);
      const entry = (state.trash || []).find((row) => row.id === button.dataset.id);
      if (entry) restoreTrashEntry(entry);
    } else if (action === "permanent-delete-trash") {
      if (!canDeletePage("trash")) return showToast("Akun Anda tidak memiliki izin menghapus permanen.", true);
      const entry = (state.trash || []).find((row) => row.id === button.dataset.id);
      if (entry) showDeleteConfirmation("Hapus permanen?", `Data "${trashRecordLabel(entry.record)}" tidak dapat dipulihkan setelah dihapus.`, () => permanentlyDeleteTrashEntry(entry), "Hapus permanen");
    } else if (action === "new-help-ticket") {
      openHelpTicketForm();
    } else if (action === "help-ticket-status") {
      if (activeUser?.role !== "Administrator") return showToast("Hanya Administrator yang dapat memperbarui status tiket kendala.", true);
      const ticket = (state.helpTickets || []).find((row) => row.id === button.dataset.id);
      const allowedNext = ticket?.status === "Baru" ? "Diproses" : ticket?.status === "Diproses" ? "Selesai" : "";
      if (!ticket || button.dataset.status !== allowedNext) return;
      ticket.status = allowedNext;
      logActivity("Memperbarui tiket kendala", "Bantuan", `${ticket.ticketNo} · ${allowedNext}`);
      saveState();
      showToast(`Status tiket ${ticket.ticketNo} diperbarui menjadi ${allowedNext}.`);
      renderPage();
    } else if (action === "move-mobile-nav") {
      if (!canEditPage("accounts")) return showToast("Akun Anda tidak memiliki izin mengubah navigasi.", true);
      const currentIndex = mobileNavDraft?.indexOf(button.dataset.key) ?? -1;
      const nextIndex = currentIndex + (button.dataset.direction === "up" ? -1 : 1);
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= mobileNavDraft.length) return;
      [mobileNavDraft[currentIndex], mobileNavDraft[nextIndex]] = [mobileNavDraft[nextIndex], mobileNavDraft[currentIndex]];
      renderPage();
    } else if (action === "repair-ticket-detail") {
      repairTicketDetail(button.dataset.id);
    } else if (action === "repair-ticket-status") {
      if (!canEditPage("repairTickets")) return showToast("Akun Anda tidak memiliki izin memperbarui tiket.", true);
      const ticket = getById("repairTickets", button.dataset.id);
      const allowedNext = ticket?.status === "Diajukan" ? "Diproses" : ticket?.status === "Diproses" ? "Selesai" : "";
      if (!ticket || button.dataset.status !== allowedNext) return;
      ticket.status = allowedNext;
      if (allowedNext === "Diproses") ticket.startedAt = dateOffset(0);
      if (allowedNext === "Selesai") ticket.completedAt = dateOffset(0);
      logActivity("Memperbarui status", "Tiket Perbaikan", `${ticket.ticketNo || ""} · ${allowedNext}`);
      saveState();
      showToast(`Tiket ${ticket.ticketNo || ""} diperbarui menjadi ${allowedNext}.`);
      renderPage();
    } else if (action === "low-stock-procurement") {
      openLowStockProcurement(button.dataset.goodId);
    } else if (action === "maintenance-status") {
      if (!canEditPage("maintenanceCalendar")) return showToast("Akun Anda tidak memiliki izin mengubah status servis.", true);
      const schedule = getById("maintenanceSchedules", button.dataset.id);
      const nextStatus = button.dataset.status;
      if (!schedule || !maintenanceStatuses.includes(nextStatus)) return;
      const previousStatus = schedule.status || "Menunggu Jadwal";
      if (previousStatus === nextStatus) return;
      schedule.status = nextStatus;
      if (nextStatus === "Selesai") schedule.completedAt = dateOffset(0);
      else delete schedule.completedAt;
      recordMaintenanceHistory(schedule, `Status diubah: ${previousStatus} → ${nextStatus}`);
      logActivity("Memperbarui status", "Jadwal Pemeliharaan", `${titleOfGood(schedule.goodId)} · ${nextStatus}`);
      saveState();
      showToast(`Status servis diperbarui menjadi ${nextStatus}.`);
      renderPage();
    } else if (action === "add-calendar-schedule") {
      openCalendarScheduleForm(button.dataset.date || "");
    } else if (action === "calendar-select-date") {
      calendarSelectedDate = button.dataset.date;
      calendarCursor = `${calendarSelectedDate.slice(0, 7)}-01`;
      $(".calendar-day.selected", $("#pageContent"))?.classList.remove("selected");
      button.classList.add("selected");
      const dayPanel = $(".calendar-day-panel", $("#pageContent"));
      if (dayPanel) {
        dayPanel.innerHTML = renderCalendarSelectedDayPanel();
        if (window.lucide) lucide.createIcons({ nodes: [dayPanel] });
      }
    } else if (action === "calendar-month-prev" || action === "calendar-month-next") {
      const current = new Date(`${calendarCursor}T00:00:00Z`);
      const offset = action === "calendar-month-prev" ? -1 : 1;
      const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1));
      calendarCursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
      calendarSelectedDate = calendarCursor;
      renderPage();
    } else if (action === "edit-calendar-schedule") {
      if (!canEditPage("maintenanceCalendar")) return showToast("Akun Anda tidak memiliki izin mengubah jadwal.", true);
      const schedule = getById("maintenanceSchedules", button.dataset.id);
      if (schedule) openCalendarScheduleForm(schedule.date, schedule);
    } else if (action === "delete-calendar-schedule") {
      if (!canDeletePage("maintenanceCalendar")) return showToast("Akun Anda tidak memiliki izin menghapus jadwal.", true);
      const schedule = getById("maintenanceSchedules", button.dataset.id);
      if (!schedule) return;
      showDeleteConfirmation("Pindahkan jadwal ke kotak sampah?", `Jadwal ${titleOfGood(schedule.goodId)} pada ${niceDate(schedule.date)} dapat dipulihkan dari Kotak Sampah.`, () => {
        moveRecordToTrash("maintenanceSchedules", schedule);
        saveState();
        showToast("Jadwal dipindahkan ke kotak sampah.");
        renderPage();
      }, "Pindahkan ke Sampah");
    } else if (action === "status") statusModal(button.dataset.id);
    else if (action === "print-loan") {
      const loan = getById("loans", button.dataset.id);
      if (loan) printLoanReceipt(loan);
    }
    else if (action === "print") {
      const kibReport = page === "reports" && $("#reportType")?.value === "kib";
      if (kibReport) document.body.classList.add("print-kib-report");
      try { window.print(); }
      finally { if (kibReport) document.body.classList.remove("print-kib-report"); }
    }
    else if (action === "export-report") exportReport();
    else if (action === "export" || action === "export-dashboard") exportRows(page);
    else if (action === "goods-template") downloadGoodsTemplate();
    else if (action === "goods-import") showGoodsImportModal();
    else if (action === "barcode-options") barcodeOptionsModal();
    else if (action === "edit-good-barcode") editGoodBarcode(button.dataset.id);
    else if (action === "download-backup") downloadBackup();
    else if (action === "telegram-test") testTelegram();
    else if (action === "whatsapp-test") testWhatsAppGateway();
    else if (action === "copy-public-portal-link") copyPublicPortalLink();
    else if (action === "download-public-portal-qr") downloadPublicPortalQr();
    else if (action === "edit-profile") showProfileEditor();
    else if (action === "logout") logout();
    else if (action === "confirm-logout") confirmLogout();
    else if (action === "select-all") $$(".barcode-check").forEach((check) => { check.checked = true; });
    else if (action === "save-mobile") saveMobileNavigation();
  }

  function statusModal(recordId) {
    if (page === "disposals") return;
    const record = getById(page, recordId);
    if (!record) return;
    if (page === "loans" && record.status !== "Diterima") return;
    const actionLabel = page === "loans" ? "peminjaman" : page === "procurements" ? "pengadaan" : "pemusnahan";
    const buttons = ["Pengajuan", "Pending"].includes(record.status)
      ? `<button class="btn-danger" data-status-choice="Ditolak">Tolak</button><button class="btn-primary" data-status-choice="Diterima"><i data-lucide="check"></i>Terima</button>`
      : page === "loans" && record.status === "Diterima"
        ? `<button class="btn-primary" data-status-choice="Selesai"><i data-lucide="check"></i>Tandai selesai</button>`
        : page === "disposals" && record.status === "Diterima"
          ? `<button class="btn-primary" data-status-choice="Selesai"><i data-lucide="check"></i>Tandai selesai</button>`
          : `<span class="badge neutral">Tidak ada aksi lanjutan</span>`;
    const approvalNote = page === "procurements" && ["Pengajuan", "Pending"].includes(record.status)
      ? `<div class="form-field full" style="margin-top:14px"><label for="procurementApprovalNote">Catatan</label><textarea id="procurementApprovalNote" rows="3" placeholder="Tambahkan catatan keputusan (opsional)">${esc(record.approvalNote || "")}</textarea></div>` : "";
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Perbarui status</h2><p>${esc(actionLabel)} · ${esc(record.borrower || record.title || record.applicant || titleOfGood(record.goodId))}</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fafbfc;border-radius:8px"><span class="muted">Status saat ini</span>${statusBadge(displayedStatus(page, record.status))}</div>${approvalNote}<div class="modal-footer">${buttons}</div></div></section></div>`);
    $$("[data-status-choice]", $("#modalRoot")).forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.statusChoice;
      if (next === "Selesai" && !window.confirm(page === "disposals" ? "Tandai pengajuan pemusnahan barang ini sebagai selesai?" : "Peminjaman barang sudah dikembalikan?")) return;
      record.status = next;
      if (page === "procurements") record.approvalNote = $("#procurementApprovalNote")?.value.trim() || "";
      if (page === "loans" && next === "Selesai") {
        record.returnedDate = dateOffset(0);
        if (record.stockAdjusted === true) {
          restoreLoanStock(record);
          record.stockAdjusted = false;
        }
      }
      logActivity("Memperbarui status", actionLabel, `${record.title || titleOfGood(record.goodId)} · ${next}`);
      saveState(); closeModal(); showToast(`Status ${actionLabel} diperbarui menjadi ${next}.`); renderPage();
    }));
  }

  function bindPageEvents() {
    $("#pageContent").onclick = recordActions;
    $("#pageContent").querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
    $("#activityLogSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLocaleLowerCase("id-ID");
      $$("[data-activity-search]", $("#pageContent")).forEach((row) => {
        row.hidden = query && !row.dataset.activitySearch.includes(query);
      });
    });
    if ($("#schoolForm") && !canEditPage("school")) $$("input,textarea", $("#schoolForm")).forEach((input) => { input.disabled = true; });
    if ($("#printDesignForm") && !canEditPage("printDesign")) $$("input,textarea", $("#printDesignForm")).forEach((input) => { input.disabled = true; });
    if ($("#appBrandingForm") && !canEditPage("school")) $$("input,button", $("#appBrandingForm")).forEach((input) => { input.disabled = true; });
    $("#selectAllRecords")?.addEventListener("change", (event) => {
      $$(".record-select", $("#pageContent")).forEach((check) => { check.checked = event.target.checked; });
      updateBulkSelection();
    });
    $$(".record-select", $("#pageContent")).forEach((check) => check.addEventListener("change", updateBulkSelection));
    $("#selectAllGoodsPurchases")?.addEventListener("change", (event) => {
      $$(".goods-purchase-select", $("#pageContent")).forEach((check) => { check.checked = event.target.checked; });
      updateGoodsPurchaseSelection();
    });
    $$(".goods-purchase-select", $("#pageContent")).forEach((check) => check.addEventListener("change", updateGoodsPurchaseSelection));
    $("#tableSearch")?.addEventListener("input", (event) => { searchTerm = event.target.value; renderPage(); const input = $("#tableSearch"); input?.focus(); input?.setSelectionRange(searchTerm.length, searchTerm.length); });
    $("#ticketSearch")?.addEventListener("input", (event) => { searchTerm = event.target.value; renderPage(); const input = $("#ticketSearch"); input?.focus(); input?.setSelectionRange(searchTerm.length, searchTerm.length); });
    $("#statusFilter")?.addEventListener("change", (event) => { selectedFilter = event.target.value; renderPage(); });
    $("#repairTicketPriority")?.addEventListener("change", (event) => { repairTicketPriority = event.target.value; renderPage(); });
    $("#calendarViewMode")?.addEventListener("change", (event) => {
      calendarViewMode = event.target.value === "academicYear" ? "academicYear" : "month";
      if (calendarViewMode === "academicYear") {
        const academicYear = state.academicYears.find((year) => year.id === currentAcademicYearId());
        if (academicYear?.startDate) calendarSelectedDate = academicYear.startDate;
      }
      calendarCursor = `${calendarSelectedDate.slice(0, 7)}-01`;
      renderPage();
    });
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
      ["#headerFontSize", "input[name='headerBold']", "input[name='headerItalic']"].forEach((selector) => {
        $(selector)?.closest(".form-field")?.classList.toggle("hidden", custom);
      });
    });
    $("#loanReceiptNumberFormat")?.addEventListener("input", (event) => {
      const preview = $("#loanReceiptNumberPreview");
      if (preview) preview.textContent = formatLoanReceiptNumber(Number(state.settings.loanReceiptNextSequence) || 1, dateOffset(0), event.target.value);
    });
    $("#schoolForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.principalWhatsapp && !validWhatsAppNumber(data.principalWhatsapp)) {
        showToast("Nomor WhatsApp Kepala Sekolah tidak valid. Gunakan format 08... atau +628...", true);
        return;
      }
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
      const customHeaderLines = Array.from({ length: 5 }, (_, index) => {
        const sizeValue = $(`[data-header-line-size="${index}"]`, form)?.value || "16";
        return {
          text: $(`[data-header-line-text="${index}"]`, form)?.value.trim() || "",
          fontSize: Number(sizeValue),
          bold: $(`[data-header-line-bold="${index}"]`, form)?.checked || false
        };
      });
      const customHeaderText = customHeaderLines.map((line) => line.text).filter(Boolean).join("\n");
      const headerFontSize = Number(form.elements.headerFontSize.value);
      const logoSize = Number(form.elements.logoSize.value);
      const loanReceiptNumberFormat = form.elements.loanReceiptNumberFormat.value.trim();
      if (headerMode === "custom" && !customHeaderText) return showToast("Isi minimal satu baris kop saat menggunakan mode ketik sendiri.", true);
      if (headerMode === "custom" && customHeaderLines.some((line) => line.text && (!Number.isInteger(line.fontSize) || line.fontSize < 10 || line.fontSize > 48))) return showToast("Ukuran font setiap baris kop harus antara 10 sampai 48 px.", true);
      if (!Number.isInteger(headerFontSize) || headerFontSize < 10 || headerFontSize > 48) return showToast("Ukuran font kop harus antara 10 sampai 48 px.", true);
      if (!Number.isInteger(logoSize) || logoSize < 24 || logoSize > 160) return showToast("Ukuran logo kop harus antara 24 sampai 160 px.", true);
      if (!/\{nomor\}/i.test(loanReceiptNumberFormat)) return showToast("Format nomor peminjaman wajib memuat placeholder {nomor}.", true);
      if (loanReceiptNumberFormat.length > 100) return showToast("Format nomor peminjaman maksimal 100 karakter.", true);
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
          customHeaderLines,
          headerFontSize,
          logoSize,
          headerBold: form.elements.headerBold.checked,
          headerItalic: form.elements.headerItalic.checked
        };
        state.settings.loanReceiptNumberFormat = loanReceiptNumberFormat;
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
      const appTagline = form.elements.appTagline.value.trim();
      const file = form.elements.appLogoFile.files?.[0];
      if (!appName) return showToast("Nama aplikasi wajib diisi.", true);
      if (file && (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_000_000)) {
        return showToast("Pilih logo PNG, JPG, atau WEBP dengan ukuran maksimal 2 MB.", true);
      }
      const commit = (appLogo) => {
        state.settings.appName = appName;
        state.settings.appTagline = appTagline;
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
    $("#whatsappSettingsForm")?.addEventListener("submit", saveWhatsAppNotificationSettings);
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
    const updateReport = () => {
      const type = $("#reportType")?.value;
      if (!type) return;
      const lifecycle = type === "assetLifecycle";
      const period = $("#reportPeriod")?.value || "month";
      const range = reportDateRange();
      $("#reportHeading").innerHTML = reportHeading(type, range);
      $("#reportPeriodField")?.classList.toggle("hidden", false);
      $("#reportMonthField")?.classList.toggle("hidden", period !== "month");
      $("#reportAcademicYearField")?.classList.toggle("hidden", period !== "academicYear");
      $("#assetLifecycleGoodField")?.classList.toggle("hidden", !lifecycle);
      $("#reportInventoryDetailsField")?.classList.toggle("hidden", !isInventoryReport(type));
      $("#reportDateRange")?.classList.toggle("hidden", period !== "custom");
      $("#reportPeriodNotice")?.classList.toggle("hidden", !isInventoryReport(type) && type !== "kib");
      if (!range) {
        $("#reportBody").innerHTML = `<p class="empty-state">Pilih tahun pelajaran dengan format, misalnya 2026/2027.</p>`;
        return;
      }
      if (range.start && range.end && range.start > range.end) {
        $("#reportBody").innerHTML = `<p class="empty-state">Tanggal mulai tidak boleh setelah tanggal akhir.</p>`;
        return;
      }
      if (lifecycle) {
        $("#reportBody").innerHTML = $("#assetLifecycleGood")?.value
          ? reportTable(type, range.start, range.end)
          : `<p class="empty-state">Tambahkan data barang terlebih dahulu untuk melihat riwayat siklus aset.</p>`;
        return;
      }
      $("#reportBody").innerHTML = reportTable(type, range.start, range.end);
    };
    $("#reportType")?.addEventListener("change", updateReport);
    $("#reportPeriod")?.addEventListener("change", updateReport);
    $("#reportMonth")?.addEventListener("change", updateReport);
    $("#reportAcademicYear")?.addEventListener("change", updateReport);
    $("#reportFund")?.addEventListener("change", updateReport);
    $("#reportLocation")?.addEventListener("change", updateReport);
    $("#assetLifecycleGood")?.addEventListener("change", updateReport);
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

  function showGoodsImportModal() {
    if (!canEditPage("goods")) {
      showToast("Akun Anda tidak memiliki izin mengimpor barang.", true);
      return;
    }
    goodsImportDraft = [];
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Impor Barang</h2><p>Unggah file Excel atau CSV, lalu lengkapi data pada pratinjau.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><label id="goodsImportDrop" class="goods-import-drop"><i data-lucide="file-up"></i><b>Tarik file ke area ini</b><span>atau pilih file Excel / CSV</span><input type="file" id="goodsImport" accept=".xlsx,.xls,.csv"></label><small class="form-help">Kolom yang tidak ada atau kosong dapat dilengkapi pada tahap pratinjau. Nama Barang harus tersedia sebagai judul kolom.</small><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button></div></div></section></div>`);
    const input = $("#goodsImport");
    const drop = $("#goodsImportDrop");
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) importGoods(file);
      input.value = "";
    });
    drop?.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("drag-over");
    });
    drop?.addEventListener("dragleave", (event) => {
      if (!drop.contains(event.relatedTarget)) drop.classList.remove("drag-over");
    });
    drop?.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("drag-over");
      const file = event.dataTransfer?.files?.[0];
      if (file) importGoods(file);
    });
  }

  function importGoods(file) {
    if (!canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin mengimpor barang.", true);
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(extension)) {
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
          name: column("Nama Barang", "Nama"),
          assetCode: column("Kode Barang KIB (Opsional)", "Kode Barang KIB", "Kode Barang"),
          specification: column("Spesifikasi Barang (Opsional)", "Spesifikasi Barang", "Spesifikasi"),
          receivedDate: column("Tanggal Barang Masuk (Opsional)", "Tanggal Barang Masuk", "Tanggal Masuk"),
          ownership: column("Kepemilikan", "Milik"),
          ownerOther: column("Nama Pemilik Lainnya", "Pemilik Lainnya"),
          fund: column("Sumber Dana"),
          type: column("Jenis Barang", "Jenis"),
          category: column("Kategori Barang", "Kategori"),
          location: column("Ruang / Lokasi", "Lokasi", "Ruang"),
          unit: column("Satuan"),
          supplier: column("Supplier", "Nama Supplier"),
          quantity: column("Jumlah Barang", "Jumlah"),
          price: column("Harga Barang (Rp)", "Harga Barang", "Harga", "Tarif Barang"),
          consumable: column("Status BHP (BHP/Barang Modal)", "Status BHP", "Barang Habis Pakai (Ya/Tidak)", "Habis Pakai", "BHP")
        };
        if (columns.name < 0) throw new Error('Kolom "Nama Barang" tidak ditemukan.');
        const valueAt = (row, name) => columns[name] < 0 ? "" : String(row[columns[name]] ?? "").trim();
        const findByName = (collection, name) => recordsForAcademicYear(collection).find((record) => normalize(record.name) === normalize(name));
        const yesValues = ["ya", "yes", "true", "1", "bhp", "barang habis pakai", "barang habis pakai (bhp)"];
        const noValues = ["tidak", "no", "false", "0", "modal", "barang modal"];
        goodsImportDraft = rows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim())).map((row) => {
          const ownershipValue = ownershipNameFromLegacy(valueAt(row, "ownership"), valueAt(row, "ownerOther"));
          const statusValue = normalize(valueAt(row, "consumable"));
          const bhpValue = yesValues.includes(statusValue) ? "true" : noValues.includes(statusValue) ? "false" : "";
          const referenceId = (collection, value) => findByName(collection, value)?.id || "";
          return {
            name: valueAt(row, "name"),
            assetCode: valueAt(row, "assetCode"),
            specification: valueAt(row, "specification"),
            receivedDate: valueAt(row, "receivedDate"),
            ownershipId: referenceId("ownerships", ownershipValue),
            fundId: referenceId("funds", valueAt(row, "fund")),
            typeId: referenceId("types", valueAt(row, "type")),
            categoryId: referenceId("categories", valueAt(row, "category")),
            locationId: referenceId("locations", valueAt(row, "location")),
            unitId: referenceId("units", valueAt(row, "unit")),
            supplierId: referenceId("suppliers", valueAt(row, "supplier")),
            quantity: valueAt(row, "quantity"),
            price: valueAt(row, "price"),
            consumable: bhpValue
          };
        });
        if (!goodsImportDraft.length) throw new Error("Tidak ada baris barang untuk ditampilkan.");
        showGoodsImportPreview();
      } catch (error) {
        showToast(`Impor barang gagal: ${error.message}`, true);
      }
    };
    reader.onerror = () => showToast("File Excel tidak dapat dibaca.", true);
    if (extension === "csv") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  function goodsImportSelect(rowIndex, field, label, collection) {
    const selected = goodsImportDraft[rowIndex][field];
    const options = recordsForAcademicYear(collection).map((record) => `<option value="${esc(record.id)}" ${record.id === selected ? "selected" : ""}>${esc(record.name)}</option>`).join("");
    return `<select data-import-row="${rowIndex}" data-import-field="${field}" aria-label="${esc(label)}"><option value="">Pilih ${esc(label.toLowerCase())}</option>${options}</select>`;
  }

  function showGoodsImportPreview() {
    const editableField = (index, field, value, label, type = "text") => `<input type="${type}" data-import-row="${index}" data-import-field="${field}" value="${esc(value)}" aria-label="${esc(label)}" ${field === "quantity" || field === "price" ? 'inputmode="numeric"' : ""}>`;
    const rows = goodsImportDraft.map((row, index) => `<tr data-import-preview-row="${index}">
      <td>${index + 1}</td>
      <td>${editableField(index, "name", row.name, "Nama Barang")}</td>
      <td>${editableField(index, "assetCode", row.assetCode, "Kode Barang KIB")}</td>
      <td>${editableField(index, "specification", row.specification, "Spesifikasi Barang")}</td>
      <td>${editableField(index, "receivedDate", row.receivedDate, "Tanggal Barang Masuk", "date")}</td>
      <td>${goodsImportSelect(index, "ownershipId", "Kepemilikan", "ownerships")}</td>
      <td>${goodsImportSelect(index, "fundId", "Sumber Dana", "funds")}</td>
      <td>${goodsImportSelect(index, "typeId", "Jenis Barang", "types")}</td>
      <td>${goodsImportSelect(index, "categoryId", "Kategori Barang", "categories")}</td>
      <td>${goodsImportSelect(index, "locationId", "Ruang / Lokasi", "locations")}</td>
      <td>${goodsImportSelect(index, "unitId", "Satuan", "units")}</td>
      <td>${goodsImportSelect(index, "supplierId", "Supplier", "suppliers")}</td>
      <td>${editableField(index, "quantity", row.quantity, "Jumlah Barang")}</td>
      <td>${editableField(index, "price", row.price, "Harga Barang")}</td>
      <td><select data-import-row="${index}" data-import-field="consumable" aria-label="Status BHP"><option value="">Pilih status</option><option value="true" ${row.consumable === "true" ? "selected" : ""}>BHP</option><option value="false" ${row.consumable === "false" ? "selected" : ""}>Barang Modal</option></select></td>
      <td><span class="goods-import-row-error" id="goodsImportRowError${index}"></span></td>
    </tr>`).join("");
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal modal-wide" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>Pratinjau dan Lengkapi Barang</h2><p>Semua kolom kecuali kode KIB, spesifikasi, dan tanggal masuk wajib valid.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><div id="goodsImportValidation" class="goods-import-validation" aria-live="polite"></div><div class="goods-import-preview-wrap"><table class="goods-import-table"><thead><tr><th>No.</th><th>Nama Barang *</th><th>Kode Barang KIB</th><th>Spesifikasi</th><th>Tanggal Masuk</th><th>Kepemilikan *</th><th>Sumber Dana *</th><th>Jenis *</th><th>Kategori *</th><th>Ruang / Lokasi *</th><th>Satuan *</th><th>Supplier *</th><th>Jumlah *</th><th>Harga *</th><th>Status BHP *</th><th>Validasi</th></tr></thead><tbody>${rows}</tbody></table></div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button type="button" class="btn-primary" id="saveGoodsImport"><i data-lucide="save"></i>Simpan barang</button></div></div></section></div>`, true);
    if ($("#modalRoot")) {
      $("#modalRoot").oninput = updateGoodsImportFromPreview;
      $("#modalRoot").onchange = updateGoodsImportFromPreview;
    }
    $("#saveGoodsImport")?.addEventListener("click", saveGoodsImport);
    updateGoodsImportValidation();
  }

  function updateGoodsImportFromPreview(event) {
    const field = event.target.closest("[data-import-field]");
    if (!field) return;
    const rowIndex = Number(field.dataset.importRow);
    const row = goodsImportDraft[rowIndex];
    if (!row) return;
    row[field.dataset.importField] = field.value;
    updateGoodsImportValidation();
  }

  function validateGoodsImportDraft() {
    const normalize = (value) => String(value || "").trim().toLocaleLowerCase("id-ID");
    const names = new Set(recordsForAcademicYear("goods").map((good) => normalize(good.name)));
    return goodsImportDraft.map((row) => {
      const errors = [];
      if (!row.name.trim()) errors.push("Nama barang wajib diisi");
      const normalizedName = normalize(row.name);
      if (normalizedName && names.has(normalizedName)) errors.push("Nama barang duplikat");
      if (normalizedName) names.add(normalizedName);
      const references = [
        ["ownershipId", "ownerships", "Kepemilikan"],
        ["fundId", "funds", "Sumber dana"],
        ["typeId", "types", "Jenis barang"],
        ["categoryId", "categories", "Kategori"],
        ["locationId", "locations", "Ruang/lokasi"],
        ["unitId", "units", "Satuan"],
        ["supplierId", "suppliers", "Supplier"]
      ];
      for (const [field, collection, label] of references) {
        if (!row[field] || !recordsForAcademicYear(collection).some((record) => record.id === row[field])) errors.push(`${label} wajib dipilih`);
      }
      const type = getById("types", row.typeId);
      const category = getById("categories", row.categoryId);
      if (type && category && category.typeId !== type.id) errors.push("Kategori tidak sesuai dengan jenis");
      if (parseGroupedInteger(row.quantity) === null) errors.push("Jumlah harus bilangan bulat");
      if (parseGroupedInteger(row.price) === null) errors.push("Harga harus bilangan bulat");
      if (row.receivedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(row.receivedDate) || Number.isNaN(new Date(`${row.receivedDate}T00:00:00`).getTime()))) errors.push("Tanggal barang masuk tidak valid");
      if (!["true", "false"].includes(row.consumable)) errors.push("Status BHP wajib dipilih");
      return errors;
    });
  }

  function updateGoodsImportValidation() {
    const errors = validateGoodsImportDraft();
    const invalidCount = errors.filter((rowErrors) => rowErrors.length).length;
    errors.forEach((rowErrors, index) => {
      const row = $(`[data-import-preview-row="${index}"]`, $("#modalRoot"));
      const error = $(`#goodsImportRowError${index}`, $("#modalRoot"));
      if (row) row.classList.toggle("has-error", rowErrors.length > 0);
      if (error) error.textContent = rowErrors.join("; ");
    });
    const summary = $("#goodsImportValidation", $("#modalRoot"));
    if (summary) {
      summary.textContent = invalidCount
        ? `${invalidCount} dari ${goodsImportDraft.length} baris perlu diperbaiki sebelum disimpan.`
        : `${goodsImportDraft.length} baris valid dan siap disimpan.`;
      summary.classList.toggle("is-valid", invalidCount === 0);
    }
    const saveButton = $("#saveGoodsImport", $("#modalRoot"));
    if (saveButton) saveButton.disabled = invalidCount > 0 || !goodsImportDraft.length;
  }

  function saveGoodsImport() {
    if (!canEditPage("goods")) return showToast("Akun Anda tidak memiliki izin mengimpor barang.", true);
    const errors = validateGoodsImportDraft();
    if (!goodsImportDraft.length || errors.some((rowErrors) => rowErrors.length)) {
      updateGoodsImportValidation();
      return showToast("Lengkapi semua kolom wajib dan perbaiki kesalahan pada pratinjau.", true);
    }
    const imported = goodsImportDraft.map((row) => {
      const quantity = parseGroupedInteger(row.quantity);
      return {
      id: id(),
      academicYearId: currentAcademicYearId(),
      name: row.name.trim(),
      assetCode: row.assetCode.trim(),
      specification: row.specification.trim(),
      receivedDate: row.receivedDate || "",
      ownershipId: row.ownershipId,
      fundId: row.fundId,
      typeId: row.typeId,
      categoryId: row.categoryId,
      locationId: row.locationId,
      unitId: row.unitId,
      supplierId: row.supplierId,
      quantity,
      initialQuantity: quantity,
      price: parseGroupedInteger(row.price),
      consumable: row.consumable === "true"
      };
    });
    state.goods.push(...imported);
    logActivity("Mengimpor", "Barang", `${imported.length} barang`);
    saveState();
    goodsImportDraft = [];
    closeModal();
    showToast(`${imported.length} barang berhasil diimpor.`);
    renderPage();
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
    const lifecycle = type === "assetLifecycle";
    const range = reportDateRange();
    if (!range) {
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
      const records = filteredReportGoods(type, range.start, range.end);
      const grandTotal = records.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.price) || 0), 0);
      const { headers, rows } = inventoryReportData(type, range.start, range.end);
      const exportHeaders = headers.map((header) => header === "Harga Satuan" || header === "Harga Total" ? `${header} (Rp)` : header);
      const reportName = type === "inventarisBhp" ? "bhp" : "barang-modal";
      const totalLabel = type === "inventarisBhp" ? "Grand Total Nilai BHP" : "Grand Total Nilai Barang Modal";
      downloadExcel(`laporan-rekapitulasi-${reportName}.xlsx`, [...headingRows, exportHeaders, ...rows, [totalLabel, ...Array(headers.length - 2).fill(""), grandTotal]]);
      return;
    }
    if (lifecycle) {
      const { headers, rows } = assetLifecycleReportData($("#assetLifecycleGood")?.value || "", range.start, range.end);
      if (!rows.length) return showToast("Tidak ada riwayat aset untuk barang yang dipilih.", true);
      downloadExcel("laporan-riwayat-pergerakan-aset.xlsx", [...headingRows, headers, ...rows]);
      return;
    }
    if (type === "kib") {
      const sections = kibReportData(range.start, range.end);
      const exportRows = sections.flatMap((section) => [
        [section.label],
        section.headers,
        ...section.rows,
        []
      ]);
      downloadExcel("laporan-kartu-inventaris-barang-kib.xlsx", [...headingRows, ...exportRows]);
      return;
    }
    if (["roomConditions", "damageLoss", "maintenanceReport", "stocktakeMinutes"].includes(type)) {
      const report = type === "roomConditions" ? roomConditionReportData(range.start, range.end)
        : type === "damageLoss" ? damageLossReportData(range.start, range.end)
          : type === "maintenanceReport" ? maintenanceReportData(range.start, range.end)
            : stocktakeMinutesReportData(range.start, range.end);
      downloadExcel(`laporan-${type}.xlsx`, [...headingRows, report.headers, ...report.rows]);
      return;
    }
    const config = collectionConfig[type];
    if (!config) return;
    const dateField = ({ loans: "startDate", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
    const filters = reportFilters();
    const records = (state[type] || []).filter((row) => {
      const good = row.goodId ? getById("goods", row.goodId) : null;
      return (!dateField || matchesReportDate(row[dateField] || "", range.start, range.end))
        && (!filters.fundId || (row.fundId || good?.fundId) === filters.fundId)
        && (!filters.locationId || (row.locationId || good?.locationId) === filters.locationId);
    });
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

  async function restorePendingServerState() {
    if (!pendingStateRecovery) return showToast("Salinan pemulihan lokal tidak tersedia.", true);
    if (!apiAvailable) return showToast("Sesi server belum aktif. Keluar lalu login kembali sebagai Administrator untuk mencoba sinkronisasi.", true);
    const snapshot = structuredClone(pendingStateRecovery);
    const merged = structuredClone(state);
    Object.entries(snapshot).forEach(([key, localValue]) => {
      if (key === "accounts") return;
      const serverValue = merged[key];
      if (Array.isArray(localValue) && Array.isArray(serverValue)) {
        const records = new Map();
        localValue.forEach((record, index) => {
          const recordKey = record?.id ? `id:${record.id}` : `value:${JSON.stringify(record)}:${index}`;
          records.set(recordKey, record);
        });
        serverValue.forEach((record, index) => {
          const recordKey = record?.id ? `id:${record.id}` : `value:${JSON.stringify(record)}:${index}`;
          if (!records.has(recordKey)) records.set(recordKey, record);
        });
        merged[key] = [...records.values()];
      } else if (key === "settings" && localValue && typeof localValue === "object" && serverValue && typeof serverValue === "object") {
        merged.settings = { ...serverValue, ...localValue };
      } else {
        merged[key] = localValue;
      }
    });
    const serverAdmin = merged.accounts.find((account) => account.id === activeUser?.id && account.role === "Administrator");
    if (serverAdmin && activeUser?.role === "Administrator") {
      const localAdmin = snapshot.accounts.find((account) => account.id === serverAdmin.id || account.email?.toLowerCase() === serverAdmin.email.toLowerCase());
      merged.accounts = merged.accounts.filter((account) => account.id !== serverAdmin.id && account.email?.toLowerCase() !== serverAdmin.email.toLowerCase());
      merged.accounts.unshift({ ...serverAdmin, ...(localAdmin || {}), id: serverAdmin.id, email: serverAdmin.email, role: "Administrator", active: true });
    }
    Object.assign(state, merged);
    normalizeAccountRoles();
    try {
      const synced = await persistState();
      if (!synced) return;
      localStorage.removeItem(pendingStateRecoveryKey || pendingServerStateKey(state.school?.code));
      pendingStateRecoveryKey = "";
      snapshot.accounts.forEach(clearPendingLocalAccount);
      pendingStateRecovery = null;
      activeUser = getById("accounts", activeUser?.id) || activeUser;
      showToast("Perubahan dari sesi sebelumnya berhasil disinkronkan ke server.");
    } catch (error) {
      showToast(`Sinkronisasi otomatis gagal: ${error.message}. Perubahan tetap tersimpan lokal dan akan dicoba lagi saat masuk kembali.`, true);
    }
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
    const count = chartPeriod === "6" ? 6 : 12;
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - count + 1, 1);
    const months = Array.from({ length: count }, (_, index) => {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString("id-ID", { month: "short" }) };
    });
    const monthIndex = new Map(months.map((month, index) => [month.key, index]));
    const goodsById = new Map(recordsForAcademicYear("goods").map((good) => [good.id, good]));
    const saranaAdded = Array(count).fill(0);
    let saranaBeforePeriod = 0;
    const firstMonthStart = `${months[0].key}-01`;
    const asOfDate = dateOffset(0);
    state.items.forEach((item) => {
      if (!goodsById.has(item.goodId)) return;
      const received = String(item.received || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(received)) {
        saranaBeforePeriod++;
        return;
      }
      if (received > asOfDate) return;
      if (received < firstMonthStart) {
        saranaBeforePeriod++;
        return;
      }
      const index = monthIndex.get(received.slice(0, 7));
      if (index === undefined) return;
      saranaAdded[index]++;
    });
    let saranaTotal = saranaBeforePeriod;
    const sarana = saranaAdded.map((added) => { saranaTotal += added; return saranaTotal; });
    const prasarana = Array(count).fill(recordsForAcademicYear("locations").length);
    sarana[count - 1] = [...goodsById.values()].reduce((total, good) => total + Math.max(0, Number(good.quantity) || 0), 0);
    const pad = { top: 13, right: 12, bottom: 24, left: 28 };
    const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(0, ...sarana, ...prasarana);
    const max = Math.max(4, Math.ceil(maxValue / 4) * 4);
    ctx.font = "9px DM Sans"; ctx.fillStyle = "#a0a8b5"; ctx.textAlign = "right";
    for (let index = 0; index <= 4; index++) {
      const tick = Math.round(max * (4 - index) / 4);
      const y = pad.top + plotHeight * index / 4;
      ctx.strokeStyle = "#f0f2f5"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.fillText(String(tick), pad.left - 7, y + 3);
    }
    const makePoints = (values) => values.map((value, i) => ({ x: pad.left + (values.length < 2 ? .5 : i / (values.length - 1)) * plotWidth, y: pad.top + plotHeight - value / max * plotHeight }));
    [[sarana, "#f58232", "rgba(245,130,50,.09)"], [prasarana, "#7a91e8", "rgba(122,145,232,.03)"]].forEach(([values, color, fill]) => {
      const points = makePoints(values);
      ctx.beginPath(); points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.stroke();
      ctx.lineTo(points[points.length - 1].x, pad.top + plotHeight); ctx.lineTo(points[0].x, pad.top + plotHeight); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      points.forEach((point) => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); });
    });
    ctx.fillStyle = "#9ba3b0"; ctx.textAlign = "center";
    months.forEach((month, index) => {
      if (months.length > 6 && index % 2 !== 0) return;
      const x = pad.left + (months.length < 2 ? .5 : index / (months.length - 1)) * plotWidth;
      ctx.fillText(month.label, x, height - 5);
    });
  }

  function drawBarcodes() {
    $$(".qr-code-canvas").forEach((target) => {
      if (window.QRCode) new QRCode(target, { text: target.dataset.value, width: 82, height: 82, colorDark: "#253044", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
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
      if (open) renderTenantAnnouncements();
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
      else if (action === "terms" || action === "manuals") showTenantPortalInfo(action);
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
    $("#showSchoolRegistration").addEventListener("click", () => {
      $("#loginForm").classList.add("hidden");
      $("#schoolRegistrationPanel").classList.remove("hidden");
      $("#registrationResult").textContent = "";
      $("#schoolRegistrationForm").reset();
      registrationOtpSentPhone = "";
      $("#registrationOtpCodeField").classList.add("hidden");
      loadRegistrationOptions();
      $("#schoolRegistrationForm").elements.schoolName.focus();
    });
    $("#sendRegistrationOtp").addEventListener("click", async (event) => {
      const form = $("#schoolRegistrationForm");
      const phone = form.elements.phone.value.trim();
      if (!form.elements.phone.reportValidity()) return;
      const button = event.currentTarget;
      button.disabled = true;
      $("#registrationResult").textContent = "Mengirim kode OTP...";
      try {
        const response = await fetch("/api/auth/register-school/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kode OTP tidak dapat dikirim.");
        registrationOtpSentPhone = registrationPhoneKey(phone);
        $("#registrationOtpCodeField").classList.remove("hidden");
        form.elements.otpCode.focus();
        $("#registrationResult").textContent = "Kode OTP telah dikirim melalui WhatsApp dan berlaku 10 menit.";
        button.textContent = "Tunggu sebelum meminta kode baru";
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = "Kirim ulang kode OTP";
        }, Math.max(1000, Number(result.retryAfter || 60) * 1000));
      } catch (error) {
        button.disabled = false;
        $("#registrationResult").textContent = error.message || "Kode OTP tidak dapat dikirim.";
      }
    });
    $("#schoolRegistrationForm").elements.phone.addEventListener("input", (event) => {
      if (registrationOtpSentPhone && registrationPhoneKey(event.target.value) !== registrationOtpSentPhone) {
        registrationOtpSentPhone = "";
        $("#schoolRegistrationForm").elements.otpCode.value = "";
        $("#registrationResult").textContent = "Nomor WhatsApp berubah. Kirim ulang kode OTP untuk nomor ini.";
      }
    });
    $("#backToSchoolLogin").addEventListener("click", () => {
      $("#schoolRegistrationPanel").classList.add("hidden");
      $("#loginForm").classList.remove("hidden");
      $("#loginSchoolCode").focus();
    });
    $("#schoolRegistrationForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = form.elements.password.value;
      if (password !== form.elements.passwordConfirm.value) {
        $("#registrationResult").textContent = "Konfirmasi kata sandi tidak cocok.";
        return;
      }
      if (registrationOtpRequired
        && (registrationPhoneKey(form.elements.phone.value) !== registrationOtpSentPhone || !form.elements.otpCode.value.trim())) {
        $("#registrationResult").textContent = "Verifikasi nomor WhatsApp dengan kode OTP sebelum mendaftar.";
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      $("#registrationResult").textContent = "Mendaftarkan sekolah...";
      try {
        const response = await fetch("/api/auth/register-school", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school: {
              name: form.elements.schoolName.value.trim(),
              phone: form.elements.phone.value.trim()
            },
            admin: {
              name: form.elements.adminName.value.trim(),
              email: form.elements.email.value.trim().toLowerCase(),
              password
            },
            ...(registrationOtpRequired ? { otpCode: form.elements.otpCode.value.trim() } : {})
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Pendaftaran sekolah gagal.");
        $("#registrationResult").textContent = `Pendaftaran berhasil. Kode sekolah Anda: ${result.school.code}. Simpan kode ini untuk login.`;
        $("#registrationResult").classList.add("login-success");
        $("#loginSchoolCode").value = result.school.code;
        $("#loginEmail").value = form.elements.email.value.trim().toLowerCase();
        form.reset();
        registrationOtpSentPhone = "";
        $("#registrationOtpCodeField").classList.add("hidden");
      } catch (error) {
        $("#registrationResult").textContent = error.message || "Pendaftaran sekolah gagal.";
        $("#registrationResult").classList.remove("login-success");
      } finally {
        submit.disabled = false;
      }
    });
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const schoolCode = $("#loginSchoolCode").value.trim().toUpperCase();
      const email = $("#loginEmail").value.trim().toLowerCase(), password = $("#loginPassword").value;
      $("#loginError").textContent = "";
      if (!/^[A-Z0-9]{4}$/.test(schoolCode)) {
        $("#loginError").textContent = "Masukkan kode sekolah 4 karakter.";
        return;
      }
      const localStateRecovery = readPendingServerState(schoolCode);
      const pendingLocalAccounts = readPendingLocalAccounts(schoolCode);
      let online = false;
      let authenticatedRole = "";
      try {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, schoolCode }) });
        if (!response.ok) {
          const result = await response.json();
          $("#loginError").textContent = result.error || "Email atau kata sandi tidak sesuai.";
          return;
        } else {
          const auth = await response.json();
          online = true;
          apiAvailable = true;
          authenticatedRole = auth.user?.role || "";
          tenantFeatureAccess = auth.featureAccess || {};
          tenantSchool = auth.school || null;
          if (tenantSchool?.code) localStorage.setItem(ACTIVE_SCHOOL_CODE_KEY, tenantSchool.code);
          await loadState();
          await loadTenantPortalContent();
          if (apiAvailable && authenticatedRole === "Administrator") await syncPendingLocalAccounts(pendingLocalAccounts);
        }
      } catch {
        apiAvailable = false;
      }
      const account = state.accounts.find((row) => row.email.toLowerCase() === email && row.active);
      const localSchoolMatches = String(localStorage.getItem(CACHED_STATE_SCHOOL_CODE_KEY) || state.school?.code || "").trim().toUpperCase() === schoolCode;
      const validOffline = !online && localSchoolMatches && account && ((email === "admin@sarprah.id" && password === "sarprah123" && !account.passwordHash) || await verifyPassword(account, password));
      if (!online && !validOffline) {
        $("#loginError").textContent = apiAvailable ? "Email atau kata sandi tidak sesuai." : "Server tidak tersedia. Periksa koneksi atau gunakan akun lokal yang tersimpan.";
        return;
      }
      if (!account) { $("#loginError").textContent = "Akun tidak ditemukan pada data aplikasi."; return; }
      if (!online) {
        tenantSchool = { ...(tenantSchool || {}), code: schoolCode };
      }
      localStorage.setItem(ACTIVE_SCHOOL_CODE_KEY, schoolCode);
      activeUser = account;
      if (!account.passwordHash) {
        Object.assign(account, await passwordCredentials(password));
        if (online) {
          try { await persistState(); }
          catch (error) { $("#loginError").textContent = `Kredensial tidak dapat disimpan: ${error.message}`; return; }
        } else saveState();
      }
      sessionStorage.setItem("sarprah-user", JSON.stringify({ id: account.id }));
      logActivity("Masuk", "Akun", account.name);
      saveState();
      enterApp();
      if (online && localStateRecovery && apiAvailable) {
        pendingStateRecovery = localStateRecovery;
        await restorePendingServerState();
      }
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openTopbarSearch(); }
      if (event.key === "Escape") { closeModal(); closeTopbarProfileMenu(); closeNotificationDropdown(); closeTopbarSearch(); }
    });
    window.addEventListener("resize", () => { if (page === "dashboard") drawChart(); });
    window.addEventListener("online", async () => {
      if (activeUser?.role !== "Administrator") return;
      const schoolCode = activeSchoolCode();
      const pending = readPendingServerState(schoolCode);
      if (!pending) return;
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const session = await response.json();
        if (session.user?.id !== activeUser.id || String(session.school?.code || "").toUpperCase() !== schoolCode) return;
        tenantFeatureAccess = session.featureAccess || {};
        apiAvailable = true;
        await loadState();
        if (!apiAvailable) return;
        activeUser = getById("accounts", session.user.id);
        if (activeUser?.role !== "Administrator") return;
        pendingStateRecovery = pending;
        await restorePendingServerState();
        enterApp();
      } catch (error) {
        console.error("Sinkronisasi otomatis setelah koneksi pulih gagal:", error);
        showToast("Sinkronisasi otomatis belum berhasil. Salinan tetap tersimpan dan akan dicoba kembali.", true);
      }
    });
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
      document.body.classList.remove("print-loan-receipt");
      $("#loanReceiptPrint")?.remove();
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
    logActivity("Keluar", "Akun", activeUser?.name || "Pengguna");
    saveState();
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* Local mode has no server session. */ }
    sessionStorage.removeItem("sarprah-user"); activeUser = null;
    tenantFeatureAccess = {};
    tenantSchool = null;
    tenantPortalContent = { terms: "", sla: "", announcements: [], manuals: [] };
    tenantBillingData = null;
    $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden");
    if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
  }

  async function init() {
    setup();
    let sessionUser = null;
    let platformBranding = null;
    try {
      const brandingResponse = await fetch("/api/branding");
      if (brandingResponse.ok) platformBranding = await brandingResponse.json();
      const response = await fetch("/api/auth/session");
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if ([402, 403, 503].includes(response.status)) {
          apiAvailable = true;
          $("#loginScreen").classList.remove("hidden");
          $("#loginError").textContent = result.error || "Akses sekolah sedang dibatasi.";
          if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const session = await response.json();
      sessionUser = session.user;
      tenantFeatureAccess = session.featureAccess || {};
      tenantSchool = session.school || null;
      if (tenantSchool?.code) localStorage.setItem(ACTIVE_SCHOOL_CODE_KEY, tenantSchool.code);
      if (sessionUser) {
        apiAvailable = true;
        const localStateRecovery = readPendingServerState(tenantSchool?.code);
        const pendingLocalAccounts = readPendingLocalAccounts(tenantSchool?.code);
        await loadState();
        await loadTenantPortalContent();
        activeUser = getById("accounts", sessionUser.id);
        if (activeUser?.role === "Administrator") {
          await syncPendingLocalAccounts(pendingLocalAccounts);
          if (apiAvailable && localStateRecovery) {
            pendingStateRecovery = localStateRecovery;
            await restorePendingServerState();
          }
        }
      } else {
        apiAvailable = false;
        loadLocalStateForCurrentSchool();
        restoreLocalUserSession();
      }
    } catch {
      apiAvailable = false;
      await loadState();
      restoreLocalUserSession();
    }
    const academicYearsChanged = ensureAcademicYearDefaults();
    const barcodesChanged = ensureGoodBarcodes();
    const printDesignChanged = ensurePrintDesignDefaults();
    const brandingChanged = ensureBrandingDefaults();
    const mobileNavigationChanged = ensureMobileNavigationDefaults();
    const workspaceCollectionsChanged = ensureWorkspaceCollections();
    const locationDefaultsChanged = ensureLocationDefaults();
    if (academicYearsChanged || barcodesChanged || printDesignChanged || brandingChanged || mobileNavigationChanged || workspaceCollectionsChanged || locationDefaultsChanged) saveState();
    if (platformBranding) Object.assign(state.settings, platformBranding);
    applyAppBranding();
    if (activeUser) enterApp();
    else {
      $("#loginScreen").classList.remove("hidden");
      if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
    }
  }
  init();
})();
