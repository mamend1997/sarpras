(() => {
  "use strict";

  const STORE_KEY = "sarprah-state-v1";
  const today = new Date();
  const dateOffset = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const currentMonth = today.toISOString().slice(0, 7);
  const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const rupiah = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const niceDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const seed = {
    school: { name: "SMA Negeri 1 Bandung", npsn: "20219327", phone: "(022) 4204152", email: "info@sman1bdg.sch.id", website: "www.sman1bdg.sch.id", address: "Jl. Ir. H. Juanda No. 93, Bandung", footer: "SMA Negeri 1 Bandung · Berkarakter, Berprestasi", logo: "" },
    types: [{ id: "tp1", name: "Elektronik", type: "sarana" }, { id: "tp2", name: "Mebel", type: "sarana" }, { id: "tp3", name: "Bangunan", type: "prasarana" }, { id: "tp4", name: "Olahraga", type: "sarana" }],
    categories: [{ id: "ct1", name: "Peralatan TIK", typeId: "tp1", note: "Perangkat teknologi informasi" }, { id: "ct2", name: "Perabot Kelas", typeId: "tp2", note: "Perlengkapan ruang kelas" }, { id: "ct3", name: "Peralatan Olahraga", typeId: "tp4", note: "Alat olahraga dan kebugaran" }, { id: "ct4", name: "Gedung & Ruang", typeId: "tp3", note: "Bangunan dan ruang sekolah" }],
    units: [{ id: "un1", name: "unit" }, { id: "un2", name: "pcs" }, { id: "un3", name: "set" }, { id: "un4", name: "rim" }],
    locations: [{ id: "lo1", name: "Ruang Kepala Sekolah" }, { id: "lo2", name: "Ruang Kelas" }, { id: "lo3", name: "Laboratorium Komputer" }, { id: "lo4", name: "Ruang Olahraga" }, { id: "lo5", name: "Ruang Tata Usaha" }, { id: "lo6", name: "Aula" }],
    suppliers: [{ id: "sp1", name: "CV Sumber Teknologi" }, { id: "sp2", name: "PT Maju Jaya Abadi" }, { id: "sp3", name: "Koperasi Sekolah" }],
    funds: [{ id: "fd1", name: "BOS", description: "Bantuan Operasional Sekolah" }, { id: "fd2", name: "Komite Sekolah", description: "Dana partisipasi komite" }, { id: "fd3", name: "Kenang-kenangan Siswa", description: "Hibah dan kenang-kenangan" }],
    goods: [
      { id: "gd1", name: "Laptop Lenovo ThinkPad", fundId: "fd1", typeId: "tp1", categoryId: "ct1", unitId: "un1", supplierId: "sp1", quantity: 24, price: 8750000, consumable: false },
      { id: "gd2", name: "Proyektor Epson EB-X06", fundId: "fd1", typeId: "tp1", categoryId: "ct1", unitId: "un1", supplierId: "sp1", quantity: 8, price: 6200000, consumable: false },
      { id: "gd3", name: "Meja Siswa Kayu", fundId: "fd2", typeId: "tp2", categoryId: "ct2", unitId: "un1", supplierId: "sp2", quantity: 120, price: 485000, consumable: false },
      { id: "gd4", name: "Bola Basket Molten", fundId: "fd3", typeId: "tp4", categoryId: "ct3", unitId: "un2", supplierId: "sp3", quantity: 18, price: 375000, consumable: false },
      { id: "gd5", name: "Kertas A4 80gsm", fundId: "fd1", typeId: "tp1", categoryId: "ct1", unitId: "un4", supplierId: "sp3", quantity: 45, price: 58000, consumable: true },
      { id: "gd6", name: "Ruang Kelas", fundId: "fd1", typeId: "tp3", categoryId: "ct4", unitId: "un1", supplierId: "sp2", quantity: 12, price: 125000000, consumable: false }
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
      { id: "ln1", borrower: "Andi Pratama", goodId: "gd1", locationId: "lo3", itemIds: ["it2"], startDate: dateOffset(-8), dueDate: dateOffset(-2), note: "Kegiatan lomba informatika", status: "Diterima" },
      { id: "ln2", borrower: "Dewi Lestari", goodId: "gd2", locationId: "lo2", itemIds: ["it4"], startDate: dateOffset(-1), dueDate: dateOffset(5), note: "Presentasi kelas XI", status: "Pengajuan" },
      { id: "ln3", borrower: "Budi Santoso", goodId: "gd4", locationId: "lo4", itemIds: ["it7"], startDate: dateOffset(-15), dueDate: dateOffset(-7), note: "Latihan tim basket", status: "Diterima" }
    ],
    procurements: [
      { id: "pr1", proposer: "Rina Kurniawati", title: "Pengadaan Perangkat TIK", goodId: "gd1", priority: "Mendesak", quantity: 3, unitPrice: 8750000, fundId: "fd1", date: dateOffset(-2), note: "Untuk kebutuhan laboratorium komputer", status: "Pengajuan" },
      { id: "pr2", proposer: "Agus Setiawan", title: "Pengadaan Meja Siswa", goodId: "gd3", priority: "Normal", quantity: 12, unitPrice: 485000, fundId: "fd2", date: dateOffset(-9), note: "Penggantian meja kelas X", status: "Diterima" },
      { id: "pr3", proposer: "Dewi Lestari", title: "Peralatan Olahraga", goodId: "gd4", priority: "Normal", quantity: 4, unitPrice: 375000, fundId: "fd3", date: dateOffset(-15), note: "Tambahan inventaris olahraga", status: "Diterima" }
    ],
    disposals: [{ id: "dp1", goodId: "gd1", locationId: "lo3", itemIds: ["it3"], reason: "Kerusakan motherboard dan tidak dapat diperbaiki", date: dateOffset(-4), status: "Pengajuan" }],
    depreciations: [{ id: "de1", date: dateOffset(-30), itemId: "it1", initialValue: 8750000, amount: 875000, finalValue: 7875000 }, { id: "de2", date: dateOffset(-30), itemId: "it4", initialValue: 6200000, amount: 620000, finalValue: 5580000 }],
    accounts: [{ id: "ac1", name: "Admin Sekolah", email: "admin@sarprah.id", role: "Administrator", active: true, edit: true, remove: true }, { id: "ac2", name: "Operator Sarpras", email: "operator@sarprah.id", role: "User", active: true, edit: true, remove: false }, { id: "ac3", name: "Kepala Sekolah", email: "kepsek@sarprah.id", role: "User", active: true, edit: false, remove: false }],
    settings: { mobileNav: ["dashboard", "goods", "loans", "procurements", "reports"], permissions: { dashboard: "view", goods: "edit", items: "edit", loans: "edit", procurements: "edit", disposals: "edit", reports: "view" } },
    months: [34, 41, 38, 48, 46, 57, 55, 62, 59, 69, 73, 82]
  };

  const state = structuredClone(seed);
  let page = "dashboard";
  let activeUser = null;
  let apiAvailable = false;
  let searchTerm = "";
  let selectedFilter = "Semua";
  let chartPeriod = "12";

  const meta = {
    dashboard: ["Dashboard", "Ringkasan kondisi sarana dan prasarana sekolah hari ini.", "layout-dashboard"],
    school: ["Data Sekolah", "Kelola profil sekolah untuk kop laporan dan identitas aplikasi.", "school"],
    types: ["Jenis Barang", "Kelompokkan aset berdasarkan jenis sarana atau prasarana.", "shapes"],
    categories: ["Kategori Barang", "Atur kategori agar pendataan aset lebih terstruktur.", "tags"],
    units: ["Satuan", "Kelola satuan untuk pencatatan barang dan stok.", "ruler"],
    locations: ["Ruang / Lokasi", "Daftar ruang dan lokasi penempatan inventaris.", "map-pin"],
    suppliers: ["Penyedia / Supplier", "Kelola informasi penyedia barang sekolah.", "truck"],
    funds: ["Sumber Dana", "Kelola sumber pendanaan dan hibah aset.", "wallet"],
    goods: ["Data Barang", "Daftar master barang dan informasi pengadaan aset.", "package"],
    items: ["Data Item", "Pantau kondisi, lokasi, dan kode unik setiap unit inventaris.", "scan-line"],
    usages: ["Penggunaan BHP", "Tinjau dan catat permintaan penggunaan barang habis pakai.", "clipboard-list"],
    stocktakes: ["Stock Opname", "Rekam hasil pemeriksaan dan penyesuaian stok.", "clipboard-check"],
    barcode: ["Cetak Barcode", "Pilih item inventaris dan cetak label QR Code.", "qr-code"],
    loans: ["Peminjaman & Pengembalian", "Kelola pengajuan, peminjaman, dan pengembalian barang.", "repeat-2"],
    procurements: ["Pengadaan Barang", "Pantau usulan dan realisasi pengadaan aset.", "shopping-cart"],
    disposals: ["Pemusnahan Barang", "Kelola pengajuan pemusnahan aset rusak.", "archive-x"],
    depreciations: ["Penyusutan", "Catat perubahan nilai aset secara berkala.", "trending-down"],
    reports: ["Laporan", "Rekap inventaris dan transaksi sarana prasarana sekolah.", "files"],
    accounts: ["Pengaturan Akun", "Kelola akun pengguna dan hak akses menu.", "users-round"]
  };

  const navGroups = [
    { section: "RINGKASAN", links: [{ id: "dashboard", label: "Dashboard", icon: "layout-dashboard" }] },
    { section: "PENGELOLAAN", groups: [
      { label: "Data Master", icon: "database", children: [["school", "Data Sekolah"], ["types", "Jenis Barang"], ["categories", "Kategori Barang"], ["units", "Satuan"], ["locations", "Ruang / Lokasi"], ["suppliers", "Penyedia / Supplier"], ["funds", "Sumber Dana"]] },
      { label: "Barang", icon: "package", children: [["goods", "Data Barang"], ["items", "Data Item"], ["usages", "Penggunaan BHP"], ["stocktakes", "Stock Opname"], ["barcode", "Cetak Barcode"]] },
      { label: "Transaksi", icon: "arrow-left-right", children: [["loans", "Peminjaman"], ["procurements", "Pengadaan"], ["disposals", "Pemusnahan"], ["depreciations", "Penyusutan"]] }
    ] },
    { section: "LAINNYA", links: [{ id: "reports", label: "Laporan", icon: "files" }, { id: "accounts", label: "Pengaturan Akun", icon: "settings-2" }] }
  ];

  const collectionConfig = {
    types: { title: "Jenis Barang", description: "Daftar jenis dan klasifikasi barang.", singular: "Jenis Barang", cols: [["name", "Nama Jenis"], ["type", "Tipe"]], fields: [["name", "Nama Jenis", "text", true], ["type", "Tipe", "select", true, ["sarana", "prasarana"]],] },
    categories: { title: "Kategori Barang", description: "Kategori membantu mengelompokkan barang.", singular: "Kategori", cols: [["name", "Nama Kategori"], ["typeId", "Jenis Barang"], ["note", "Keterangan"]], fields: [["name", "Nama Kategori", "text", true], ["typeId", "Jenis Barang", "select", true, "types"], ["note", "Keterangan", "text"]] },
    units: { title: "Satuan", description: "Satuan untuk mencatat jumlah barang.", singular: "Satuan", cols: [["name", "Nama Satuan"]], fields: [["name", "Nama Satuan", "text", true]] },
    locations: { title: "Ruang / Lokasi", description: "Daftar ruang penyimpanan dan penggunaan barang.", singular: "Lokasi", cols: [["name", "Nama Ruang / Lokasi"]], fields: [["name", "Nama Ruang / Lokasi", "text", true]] },
    suppliers: { title: "Penyedia / Supplier", description: "Daftar penyedia dan supplier sekolah.", singular: "Supplier", cols: [["image", "Gambar"], ["name", "Nama Supplier"]], fields: [["image", "URL Gambar (opsional)", "url"], ["name", "Nama Supplier", "text", true]] },
    funds: { title: "Sumber Dana", description: "Sumber pendanaan untuk pengadaan aset.", singular: "Sumber Dana", cols: [["name", "Nama Sumber Dana"], ["description", "Keterangan"]], fields: [["name", "Nama Sumber Dana", "text", true], ["description", "Keterangan", "text"]] },
    goods: { title: "Data Barang", description: "Informasi barang, nilai, stok, dan sumber pendanaannya.", singular: "Barang", cols: [["name", "Nama Barang"], ["fundId", "Sumber Dana"], ["typeId", "Jenis"], ["categoryId", "Kategori"], ["unitId", "Satuan"], ["supplierId", "Supplier"], ["quantity", "Jumlah"], ["price", "Tarif Barang"], ["consumable", "BHP"]], fields: [["name", "Nama Barang", "text", true], ["fundId", "Sumber Dana", "select", true, "funds"], ["typeId", "Jenis Barang", "select", true, "types"], ["categoryId", "Kategori", "select", true, "categories"], ["unitId", "Satuan", "select", true, "units"], ["supplierId", "Supplier", "select", true, "suppliers"], ["quantity", "Jumlah Barang", "number", true], ["price", "Tarif Barang (Rp)", "number", true], ["consumable", "Barang habis pakai (BHP)", "checkbox"]] },
    items: { title: "Data Item", description: "Inventaris per unit dengan kode unik, kondisi, dan lokasi.", singular: "Item Inventaris", cols: [["code", "Kode Unik"], ["goodId", "Nama Barang"], ["condition", "Kondisi"], ["locationId", "Lokasi"], ["received", "Tanggal Diterima"]], fields: [["goodId", "Nama Barang", "select", true, "goods"], ["condition", "Kondisi", "select", true, ["Baik", "Rusak"]], ["locationId", "Lokasi", "select", true, "locations"], ["received", "Tanggal Diterima", "date", true]] },
    usages: { title: "Penggunaan BHP", description: "Persetujuan permintaan barang habis pakai.", singular: "Penggunaan BHP", cols: [["applicant", "Nama Pengaju"], ["goodId", "Nama Barang"], ["quantity", "Jumlah"], ["date", "Tanggal"], ["status", "Status"]], fields: [["applicant", "Nama Pengaju", "text", true], ["goodId", "Barang BHP", "select", true, "bhpGoods"], ["quantity", "Jumlah Barang", "number", true], ["date", "Tanggal", "date", true]] },
    stocktakes: { title: "Stock Opname", description: "Riwayat pemeriksaan dan koreksi jumlah stok barang.", singular: "Stock Opname", cols: [["date", "Tanggal"], ["goodId", "Nama Barang"], ["oldStock", "Stok Lama"], ["newStock", "Stok Baru"], ["total", "Total Stok"], ["note", "Keterangan"]], fields: [["date", "Tanggal Opname", "date", true], ["goodId", "Nama Barang", "select", true, "goods"], ["oldStock", "Jumlah Stok Lama", "number", true], ["newStock", "Stok Baru", "number", true], ["note", "Keterangan", "text"]] },
    loans: { title: "Peminjaman Barang", description: "Pengajuan dan status peminjaman aset sekolah.", singular: "Peminjaman", cols: [["borrower", "Peminjam"], ["goodId", "Barang"], ["locationId", "Lokasi"], ["startDate", "Tanggal Sewa"], ["dueDate", "Tanggal Kembali"], ["late", "Keterlambatan"], ["status", "Status"]], fields: [["borrower", "Nama Peminjam", "text", true], ["goodId", "Barang", "select", true, "goods"], ["locationId", "Lokasi", "select", true, "locations"], ["itemIds", "Pilih Item Inventaris", "text"], ["startDate", "Tanggal Sewa", "date", true], ["dueDate", "Tanggal Kembali", "date", true], ["note", "Keterangan", "textarea"]] },
    procurements: { title: "Pengadaan Barang", description: "Usulan pengadaan, prioritas, dan realisasi barang.", singular: "Pengadaan", cols: [["title", "Nama Pengadaan"], ["proposer", "Nama Pengusul"], ["goodId", "Barang"], ["priority", "Prioritas"], ["date", "Tanggal"], ["total", "Nominal"], ["status", "Status"]], fields: [["proposer", "Nama Pengusul", "text", true], ["title", "Nama Pengadaan", "text", true], ["goodId", "Barang", "select", true, "goods"], ["priority", "Prioritas", "select", true, ["Normal", "Mendesak"]], ["quantity", "Jumlah Barang", "number", true], ["unitPrice", "Harga Satuan (Rp)", "number", true], ["fundId", "Sumber Dana", "select", true, "funds"], ["date", "Tanggal Pengadaan", "date", true], ["note", "Keterangan", "textarea"]] },
    disposals: { title: "Pemusnahan Barang", description: "Pengajuan penghapusan aset rusak dari inventaris.", singular: "Pemusnahan", cols: [["goodId", "Barang"], ["locationId", "Lokasi"], ["itemIds", "Item"], ["reason", "Keterangan"], ["evidence", "Bukti"], ["date", "Tanggal Pengajuan"], ["status", "Status"]], fields: [["goodId", "Barang", "select", true, "goods"], ["locationId", "Lokasi", "select", true, "locations"], ["itemIds", "Item rusak", "text"], ["reason", "Alasan pemusnahan", "textarea", true], ["evidence", "Bukti foto (opsional)", "file"], ["date", "Tanggal Pengajuan", "date", true]] },
    depreciations: { title: "Penyusutan Nilai Aset", description: "Catat penyusutan nilai item inventaris secara berkala.", singular: "Penyusutan", cols: [["date", "Tanggal"], ["itemId", "Kode Barang"], ["goodName", "Barang"], ["initialValue", "Harga Awal"], ["amount", "Penyusutan"], ["finalValue", "Harga Akhir"]], fields: [["date", "Tanggal", "date", true], ["itemId", "Item Inventaris", "select", true, "items"], ["initialValue", "Harga Awal (Rp)", "number", true], ["amount", "Penyusutan (Rp)", "number", true]] },
    accounts: { title: "Pengaturan Akun", description: "Kelola pengguna aplikasi dan izin akses.", singular: "Akun", cols: [["name", "Nama Pengguna"], ["email", "Email"], ["role", "Peran"], ["active", "Status"]], fields: [["name", "Nama Pengguna", "text", true], ["email", "Alamat Email", "email", true], ["role", "Peran", "select", true, ["Administrator", "User"]], ["active", "Akun aktif", "checkbox"], ["edit", "Boleh mengubah data", "checkbox"], ["remove", "Boleh menghapus data", "checkbox"]] }
  };
  const statusPages = new Set(["usages", "loans", "procurements", "disposals"]);
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
  const isBhp = (good) => good.consumable === true || good.consumable === "true";

  function showToast(message, error = false) {
    const toast = document.createElement("div");
    toast.className = `toast${error ? " error" : ""}`;
    toast.innerHTML = `<i data-lucide="${error ? "circle-alert" : "circle-check"}"></i><span>${esc(message)}</span>`;
    $("#toastRoot").append(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });
    setTimeout(() => toast.remove(), 3300);
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (error) { showToast(`Penyimpanan lokal gagal: ${error.message}`, true); }
    if (apiAvailable) {
      fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) })
        .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); })
        .catch((error) => { apiAvailable = false; showToast(`SQLite tidak dapat diperbarui (${error.message}); data tetap tersimpan lokal.`, true); });
    }
  }

  async function loadState() {
    try {
      const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      apiAvailable = true;
      if (result.state) Object.assign(state, result.state);
      else {
        const cached = localStorage.getItem(STORE_KEY);
        if (cached) Object.assign(state, JSON.parse(cached));
        saveState();
      }
      showToast("Data tersimpan di SQLite.");
    } catch {
      apiAvailable = false;
      try {
        const cached = localStorage.getItem(STORE_KEY);
        if (cached) Object.assign(state, JSON.parse(cached));
      } catch (error) { showToast(`Data lokal tidak dapat dibaca: ${error.message}`, true); }
    }
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
      return `<div class="nav-section-label">${group.section}</div>${linkHtml}${groupHtml}`;
    }).join("");
    $("#sideNav").querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
    $("#sideNav").querySelectorAll("[data-group]").forEach((el) => el.addEventListener("click", () => {
      const child = el.nextElementSibling;
      el.classList.toggle("open");
      child.classList.toggle("open");
    }));
    renderMobileNav();
    if (window.lucide) lucide.createIcons({ nodes: [$("#sideNav"), $("#mobileNav")] });
  }

  function renderMobileNav() {
    const links = (state.settings?.mobileNav || seed.settings.mobileNav).filter(canViewPage);
    $("#mobileNav").innerHTML = links.slice(0, 5).map((key) => `<button class="mobile-nav-item ${page === key ? "active" : ""}" data-page="${key}"><i data-lucide="${meta[key]?.[2] || "circle"}"></i><span>${meta[key]?.[0] || key}</span></button>`).join("");
    $$("#mobileNav [data-page]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
  }

  function navigate(next) {
    if (!meta[next]) return;
    if (!canViewPage(next)) next = "dashboard";
    page = next;
    selectedFilter = "Semua";
    searchTerm = "";
    $("#breadcrumbCurrent").textContent = meta[next][0];
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
    const permission = state.settings?.permissions?.[key] ?? (key === "accounts" || key === "school" ? "hidden" : "view");
    return activeUser?.role === "Administrator" || permission !== "hidden";
  }
  function canEditPage(key = page) {
    return activeUser?.role === "Administrator" || ["edit", "delete"].includes(state.settings?.permissions?.[key]);
  }
  function canDeletePage(key = page) {
    return activeUser?.role === "Administrator" || state.settings?.permissions?.[key] === "delete";
  }

  function renderPage() {
    const root = $("#pageContent");
    root.classList.remove("page-enter");
    void root.offsetWidth;
    root.classList.add("page-enter");
    if (page === "dashboard") root.innerHTML = renderDashboard();
    else if (page === "school") root.innerHTML = renderSchool();
    else if (page === "barcode") root.innerHTML = renderBarcode();
    else if (page === "reports") root.innerHTML = renderReports();
    else if (page === "accounts") root.innerHTML = renderAccounts();
    else root.innerHTML = renderCollection(page);
    if (window.lucide) lucide.createIcons({ nodes: [root] });
    if (page === "dashboard") drawChart();
    if (page === "barcode") drawBarcodes();
    bindPageEvents();
  }

  function renderDashboard() {
    const thisMonth = (date) => String(date || "").startsWith(currentMonth);
    const loansMonth = state.loans.filter((row) => thisMonth(row.startDate)).length;
    const procMonth = state.procurements.filter((row) => thisMonth(row.date)).length;
    const disposalMonth = state.disposals.filter((row) => thisMonth(row.date)).length;
    const itemsTotal = state.items.length;
    const damaged = state.items.filter((row) => row.condition === "Rusak").length;
    const outstanding = state.loans.filter((row) => ["Diterima", "Pengajuan"].includes(row.status)).length;
    const goodCount = state.goods.length;
    const sarana = state.types.filter((row) => row.type === "sarana").map((row) => row.id);
    const prasarana = state.types.filter((row) => row.type === "prasarana").map((row) => row.id);
    const saranaGoods = state.items.filter((row) => sarana.includes(getById("goods", row.goodId)?.typeId)).length;
    const prasaranaGoods = state.items.filter((row) => prasarana.includes(getById("goods", row.goodId)?.typeId)).length;
    const saranaAvailable = state.items.filter((row) => row.condition === "Baik" && sarana.includes(getById("goods", row.goodId)?.typeId)).length;
    const prasaranaAvailable = state.items.filter((row) => row.condition === "Baik" && prasarana.includes(getById("goods", row.goodId)?.typeId)).length;
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const lateRows = state.loans.filter((row) => ["Diterima", "Pengajuan"].includes(row.status) && row.dueDate < dateOffset(0)).slice(0, 4);
    const procurements = state.procurements.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const stat = (label, value, icon, tone, foot) => `<div class="summary-card"><div class="summary-top">${label}<span class="summary-icon ${tone}"><i data-lucide="${icon}"></i></span></div><div class="summary-value">${value}</div><div class="summary-foot"><span class="trend-up">${foot}</span> bulan ini</div><div class="summary-spark"><svg viewBox="0 0 80 28" fill="none"><path d="M1 22 C12 20 12 16 22 18S34 6 43 12s12 0 20 3 10-8 16-11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div></div>`;
    return `${pageHeading(`<button class="btn-secondary" data-action="export-dashboard"><i data-lucide="download"></i>Ekspor ringkasan</button>`)}
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

  function indicator(label, value, icon, tone, foot) {
    return `<div class="indicator-card" data-nav="${label === "Item Rusak" ? "items" : "goods"}"><span class="indicator-icon ${tone}"><i data-lucide="${icon}"></i></span><div><small>${label}</small><b>${value}</b><small style="margin:3px 0 0">${foot}</small></div></div>`;
  }
  function procurementDashboardRows(rows) {
    return rows.length ? rows.map((row) => `<tr data-priority="${esc(row.priority)}"><td><span class="table-title">${esc(row.title)}</span><div class="table-sub">${esc(niceDate(row.date))}</div></td><td>${row.priority === "Mendesak" ? `<span class="badge danger">Mendesak</span>` : `<span class="badge neutral">Normal</span>`}</td><td>${rupiah(row.quantity * row.unitPrice)}</td></tr>`).join("") : `<tr><td colspan="3" class="empty-state">Belum ada data pengadaan.</td></tr>`;
  }

  function renderSchool() {
    const school = state.school || seed.school;
    return `${pageHeading(canEditPage("school") ? `<button class="btn-primary" type="submit" form="schoolForm"><i data-lucide="save"></i>Simpan perubahan</button>` : "")}
      <form id="schoolForm" class="settings-card"><h3>Profil Sekolah</h3><p>Informasi ini akan digunakan pada kop surat dan laporan.</p><div class="form-grid">
        ${formInput("name", "Nama Sekolah", school.name, "text", true)}
        ${formInput("npsn", "NPSN", school.npsn, "text")}
        ${formInput("phone", "Telepon", school.phone, "tel")}
        ${formInput("email", "Email", school.email, "email")}
        ${formInput("website", "Website", school.website, "url")}
        <div class="form-field full"><label>Alamat</label><textarea name="address" ${canEditPage("school") ? "" : "disabled"}>${esc(school.address)}</textarea></div>
        <div class="form-field full"><label>Unggah Logo Sekolah</label><input name="logoFile" type="file" accept="image/*">${school.logo ? `<img src="${esc(school.logo)}" alt="Logo sekolah" style="max-width:90px;max-height:70px;object-fit:contain;margin-top:8px">` : ""}<small class="form-help">Format gambar, maksimal 2 MB.</small></div>
        <div class="form-field full"><label>Footer Laporan</label><input name="footer" value="${esc(school.footer)}"></div>
        </div></form>`;
  }

  function renderCollection(key) {
    const config = collectionConfig[key];
    const rows = state[key] || [];
    const actions = `<button class="btn-secondary" data-action="export"><i data-lucide="download"></i>Ekspor</button>${canEditPage(key) ? `<button class="btn-primary" data-action="add"><i data-lucide="plus"></i>Tambah ${config.singular}</button>` : ""}`;
    let toolbar = `<div class="table-toolbar"><div class="table-toolbar-left"><label class="search-field"><i data-lucide="search"></i><input id="tableSearch" placeholder="Cari ${config.title.toLowerCase()}..." value="${esc(searchTerm)}"></label>${statusPages.has(key) ? `<select class="table-filter" id="statusFilter">${statusOptions[key].map((opt) => `<option ${selectedFilter === opt ? "selected" : ""}>${opt}</option>`).join("")}</select>` : ""}</div><div class="table-toolbar-right">${key === "units" ? `<label class="btn-quiet" for="unitImport"><i data-lucide="upload"></i>Impor</label><input type="file" id="unitImport" accept=".csv,text/csv" class="hidden">` : ""}<button class="btn-quiet" data-action="print"><i data-lucide="printer"></i>Print</button><button class="btn-quiet" data-action="export"><i data-lucide="file-spreadsheet"></i>Excel / CSV</button></div></div>`;
    const filtered = rows.filter((row) => matchesSearch(key, row, searchTerm) && (!statusPages.has(key) || selectedFilter === "Semua" || row.status === selectedFilter));
    const headers = config.cols.map(([, title]) => `<th>${esc(title.toUpperCase())}</th>`).join("");
    const body = filtered.length ? filtered.map((row) => `<tr>${config.cols.map(([field]) => `<td>${formatCell(key, field, row)}</td>`).join("")}<td><div class="action-buttons">${canEditPage(key) && (row.status === "Pengajuan" || (["loans", "disposals"].includes(key) && row.status === "Diterima")) ? `<button class="mini-action" title="Ubah status" data-action="status" data-id="${row.id}"><i data-lucide="check"></i></button>` : ""}${canEditPage(key) ? `<button class="mini-action" title="Edit" data-action="edit" data-id="${row.id}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage(key) ? `<button class="mini-action" title="Hapus" data-action="delete" data-id="${row.id}"><i data-lucide="trash-2"></i></button>` : ""}</div></td></tr>`).join("") : `<tr><td colspan="${config.cols.length + 1}"><div class="empty-state"><i data-lucide="inbox"></i>Tidak ada data yang cocok.</div></td></tr>`;
    return `${pageHeading(actions)}${toolbar}<div class="table-shell"><div class="table-wrap"><table class="data-table"><thead><tr>${headers}<th>AKSI</th></tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>Menampilkan ${filtered.length} dari ${rows.length} data</span><div class="pagination"><button class="page-number active">1</button></div></div></div>`;
  }

  function matchesSearch(key, row, query) {
    if (!query) return true;
    const config = collectionConfig[key];
    return config.cols.map(([field]) => plainCell(key, field, row)).join(" ").toLowerCase().includes(query.toLowerCase());
  }

  function plainCell(key, field, row) {
    const relations = { fundId: "funds", typeId: "types", categoryId: "categories", unitId: "units", supplierId: "suppliers", goodId: "goods", locationId: "locations", itemId: "items" };
    if (relations[field]) return field === "itemId" ? getById("items", row[field])?.code || row[field] || "" : relatedName(relations[field], row[field]);
    if (field === "goodName") return titleOfGood(row.itemId && getById("items", row.itemId)?.goodId);
    if (field === "itemIds") return Array.isArray(row.itemIds) ? row.itemIds.map((itemId) => getById("items", itemId)?.code || itemId).join(", ") : row.itemIds || "";
    if (field === "image") return row.image || "";
    if (field === "evidence") return row.evidence ? "Foto terlampir" : "—";
    return row[field] ?? "";
  }

  function formatCell(key, field, row) {
    const value = row[field];
    if (field === "fundId" || field === "typeId" || field === "categoryId" || field === "unitId" || field === "supplierId" || field === "goodId" || field === "locationId") return esc(relatedName(({ fundId: "funds", typeId: "types", categoryId: "categories", unitId: "units", supplierId: "suppliers", goodId: "goods", locationId: "locations" })[field], value));
    if (field === "itemId") return `<span class="table-title">${esc(getById("items", value)?.code || value || "—")}</span>`;
    if (field === "goodName") return esc(titleOfGood(getById("items", row.itemId)?.goodId));
    if (field === "itemIds") return esc((Array.isArray(value) ? value : String(value || "").split(",")).map((itemId) => getById("items", itemId.trim())?.code || itemId.trim()).filter(Boolean).join(", ") || "—");
    if (field === "image") return value ? `<img src="${esc(value)}" alt="Gambar supplier" style="width:34px;height:34px;object-fit:cover;border-radius:7px">` : `<span class="badge neutral">—</span>`;
    if (field === "evidence") return value ? `<a href="${esc(value)}" target="_blank" rel="noopener" class="badge info">Lihat foto</a>` : `<span class="badge neutral">—</span>`;
    if (field === "status") return statusBadge(value);
    if (field === "priority") return value === "Mendesak" ? `<span class="badge danger">Mendesak</span>` : `<span class="badge neutral">${esc(value || "Normal")}</span>`;
    if (field === "condition") return value === "Rusak" ? `<span class="badge danger">Rusak</span>` : value === "Dihapus" ? `<span class="badge neutral">Dihapus</span>` : `<span class="badge success">Baik</span>`;
    if (field === "type") return `<span class="badge ${value === "prasarana" ? "info" : "warning"}">${esc(value)}</span>`;
    if (["date", "received", "startDate", "dueDate"].includes(field)) return esc(niceDate(value));
    if (field === "late") {
      const late = row.dueDate < dateOffset(0) && ["Diterima", "Pengajuan"].includes(row.status);
      return late ? `<span class="badge danger">${Math.max(1, Math.floor((today - new Date(`${row.dueDate}T00:00:00`)) / 86400000))} hari</span>` : `<span class="badge success">Tepat waktu</span>`;
    }
    if (field === "total") return rupiah(row.quantity ? row.quantity * row.unitPrice : value);
    if (["price", "unitPrice", "initialValue", "amount", "finalValue"].includes(field)) return rupiah(value);
    if (field === "consumable" || field === "active") return `<span class="badge ${value ? "success" : "neutral"}">${value ? (field === "active" ? "Aktif" : "Ya") : (field === "active" ? "Nonaktif" : "Tidak")}</span>`;
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
    const goodsQty = state.goods.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const value = state.goods.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.price || 0), 0);
    const reportOptions = [["inventaris", "Rekapitulasi Inventaris"], ["loans", "Laporan Peminjaman"], ["usages", "Penggunaan BHP"], ["procurements", "Pengadaan Barang"], ["disposals", "Pemusnahan Barang"], ["depreciations", "Penyusutan Aset"]];
    return `${pageHeading(`<button class="btn-secondary" data-action="export-report"><i data-lucide="download"></i>Ekspor CSV</button><button class="btn-primary" data-action="print"><i data-lucide="printer"></i>Cetak laporan</button>`)}
      <section class="panel"><div class="report-heading">${state.school.logo ? `<img class="report-logo" src="${esc(state.school.logo)}" alt="Logo sekolah">` : `<div class="school-avatar">${esc((state.school.name || "S").slice(0, 1))}</div>`}<div><h2>${esc(state.school.name)}</h2><p>${esc(state.school.address)} · ${esc(state.school.phone)}</p><p>${esc(state.school.email)} · ${esc(state.school.website)}</p></div></div>
      <div class="table-toolbar" style="border:0;padding:0 0 14px"><div class="table-toolbar-left"><select class="table-filter" id="reportType">${reportOptions.map(([val, label]) => `<option value="${val}">${label}</option>`).join("")}</select><input id="reportStart" class="table-filter" type="date" value="${currentMonth}-01"><input id="reportEnd" class="table-filter" type="date" value="${dateOffset(0)}"></div><div class="table-toolbar-right"><span class="badge info">Diperbarui ${niceDate(dateOffset(0))}</span></div></div>
      <div id="reportBody">${reportTable("inventaris")}</div>
      <div class="report-signatures"><div><span>Mengetahui,</span><p>Kepala Sekolah</p><b>( _________________________ )</b></div><div><span>Bandung, ${niceDate(dateOffset(0))}</span><p>Wakasek Sarpras</p><b>( _________________________ )</b></div></div>
      <p class="muted" style="font-size:9px;text-align:center;margin:28px 0 0">${esc(state.school.footer)}</p></section>`;
  }
  function reportTable(type, startDate, endDate) {
    let cols, rows;
    if (type === "inventaris") {
      cols = ["Nama Barang", "Jenis", "Kategori", "Jumlah", "Satuan", "Nilai"];
      rows = state.goods.map((row) => [row.name, relatedName("types", row.typeId), relatedName("categories", row.categoryId), row.quantity, relatedName("units", row.unitId), rupiah(row.quantity * row.price)]);
    } else {
      const config = collectionConfig[type];
      cols = config.cols.map((col) => col[1]);
      const dateField = ({ loans: "startDate", items: "received", stocktakes: "date", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
      rows = (state[type] || []).filter((row) => !dateField || ((!startDate || row[dateField] >= startDate) && (!endDate || row[dateField] <= endDate))).map((row) => config.cols.map(([field]) => plainCell(type, field, row)));
    }
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${cols.map((col) => `<th>${esc(col.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty-state" colspan="${cols.length}">Tidak ada data.</td></tr>`}</tbody></table></div>`;
  }

  function renderAccounts() {
    const available = ["dashboard", "goods", "items", "loans", "procurements", "disposals", "reports"];
    const labels = Object.fromEntries(available.map((key) => [key, meta[key][0]]));
    const mobile = state.settings.mobileNav || [];
    return `${pageHeading(canEditPage("accounts") ? `<button class="btn-primary" data-action="add"><i data-lucide="user-plus"></i>Tambah Akun</button>` : "")}
      <section class="settings-card"><h3>Akun Pengguna</h3><p>Kelola akses dan status akun yang menggunakan aplikasi.</p>${state.accounts.map((account) => `<div class="settings-row"><div style="display:flex;align-items:center;gap:10px"><span class="avatar">${esc(account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase())}</span><div><b>${esc(account.name)} <span class="badge ${account.role === "Administrator" ? "info" : "neutral"}">${esc(account.role)}</span></b><small>${esc(account.email)}</small></div></div><div class="action-buttons">${canEditPage("accounts") ? `<button class="toggle ${account.active ? "on" : ""}" title="${account.active ? "Nonaktifkan" : "Aktifkan"}" data-action="toggle-account" data-id="${account.id}"></button><button class="mini-action" title="Ubah" data-action="edit" data-id="${account.id}"><i data-lucide="pencil"></i></button>` : ""}${canDeletePage("accounts") ? `<button class="mini-action" title="Hapus" data-action="delete" data-id="${account.id}"><i data-lucide="trash-2"></i></button>` : ""}</div></div>`).join("")}</section>
      <section class="settings-card"><h3>Hak Akses Menu</h3><p>Atur apakah menu dapat dilihat saja atau dapat dikelola pengguna.</p>${available.map((key) => `<div class="settings-row"><div><b>${labels[key]}</b><small>Hak akses untuk akun non-administrator</small></div><select class="table-filter permission-select" data-menu="${key}" ${canEditPage("accounts") ? "" : "disabled"}><option value="hidden" ${state.settings.permissions[key] === "hidden" ? "selected" : ""}>Tidak terlihat</option><option value="view" ${state.settings.permissions[key] === "view" ? "selected" : ""}>Lihat saja</option><option value="edit" ${state.settings.permissions[key] === "edit" ? "selected" : ""}>Lihat & edit</option><option value="delete" ${state.settings.permissions[key] === "delete" ? "selected" : ""}>Lihat, edit & hapus</option></select></div>`).join("")}</section>
      <section class="settings-card"><h3>Navigasi Mobile</h3><p>Pilih hingga 5 pintasan yang ditampilkan di navbar perangkat seluler.</p><div class="form-grid">${available.map((key) => `<label class="settings-row" style="justify-content:flex-start;border:0;padding:7px"><input class="mobile-nav-check" type="checkbox" value="${key}" ${mobile.includes(key) ? "checked" : ""} ${mobile.length >= 5 && !mobile.includes(key) || !canEditPage("accounts") ? "disabled" : ""} style="accent-color:#f27622"><b>${labels[key]}</b></label>`).join("")}</div>${canEditPage("accounts") ? `<button class="btn-primary" data-action="save-mobile"><i data-lucide="save"></i>Simpan navigasi</button>` : ""}</section>`;
  }

  function formInput(name, label, value, type = "text", required = false) {
    return `<div class="form-field"><label>${esc(label)}</label><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></div>`;
  }

  function optionsFor(source) {
    if (Array.isArray(source)) return source.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
    let rows = state[source] || [];
    if (source === "bhpGoods") rows = state.goods.filter(isBhp);
    if (source === "loanGoods") rows = state.goods.filter((good) => !isBhp(good));
    if (source === "items") rows = state.items;
    const text = source === "items" ? (row) => `${row.code} — ${titleOfGood(row.goodId)}` : (row) => row.name;
    return rows.map((row) => `<option value="${row.id}">${esc(text(row))}</option>`).join("");
  }

  function modalForm(key, record = null) {
    const config = collectionConfig[key];
    const fields = config.fields.map(([name, label, type, required, source]) => {
      let value = record?.[name] ?? (type === "date" ? dateOffset(0) : "");
      const idAttr = `${key}-${name}`;
      if (name === "itemIds" && ["loans", "disposals"].includes(key)) return `<div class="form-field full"><label>${esc(label)}${required ? " *" : ""}</label><div id="loanItemOptions" class="item-choice-list"></div><small class="form-help">${key === "loans" ? "Pilih unit berkondisi baik yang belum dipinjam." : "Pilih unit dengan kondisi rusak untuk diajukan."}</small></div>`;
      if (type === "checkbox") return `<div class="form-field full"><label class="form-check"><input id="${idAttr}" name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${esc(label)}</span></label></div>`;
      if (type === "select") return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><select id="${idAttr}" name="${name}" ${required ? "required" : ""}><option value="">Pilih ${esc(label.toLowerCase())}</option>${optionsFor(key === "loans" && name === "goodId" ? "loanGoods" : source).replace(new RegExp(`value="${esc(value)}"`), `value="${esc(value)}" selected`)}</select></div>`;
      if (type === "textarea") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><textarea id="${idAttr}" name="${name}" ${required ? "required" : ""}>${esc(value)}</textarea></div>`;
      if (type === "file") return `<div class="form-field full"><label for="${idAttr}">${esc(label)}</label><div class="file-drop"><i data-lucide="image-plus"></i><span>Pilih foto bukti</span><input id="${idAttr}" name="${name}" type="file" accept="image/*" class="form-file"><img class="file-preview ${record?.[name] ? "" : "hidden"}" src="${esc(record?.[name] || "")}" alt="Pratinjau bukti"></div><small class="form-help">Pratinjau 120 × 120 px · maksimal 2 MB.</small></div>`;
      return `<div class="form-field"><label for="${idAttr}">${esc(label)}${required ? " *" : ""}</label><input id="${idAttr}" name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="0"' : ""}></div>`;
    }).join("");
    return `<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-header"><div><h2>${record ? "Edit" : "Tambah"} ${config.singular}</h2><p>Lengkapi informasi berikut dengan benar.</p></div><button type="button" class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><form class="modal-form" id="recordForm" data-collection="${key}" data-record="${record?.id || ""}"><div class="form-grid">${fields}</div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close">Batal</button><button class="btn-primary" type="submit"><i data-lucide="save"></i>Simpan data</button></div></form></section></div>`;
  }

  function showModal(content, wide = false) {
    $("#modalRoot").innerHTML = content;
    $("#modalRoot").onclick = recordActions;
    if (wide) $(".modal", $("#modalRoot"))?.classList.add("modal-wide");
    if (window.lucide) lucide.createIcons({ nodes: [$("#modalRoot")] });
    const form = $("#recordForm");
    if (form && ["loans", "disposals"].includes(form.dataset.collection)) setupItemChoices(form);
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

  function setupItemChoices(form) {
    const key = form.dataset.collection;
    const record = form.dataset.record ? getById(key, form.dataset.record) : null;
    const selected = new Set(record?.itemIds || []);
    const goodSelect = form.elements.goodId;
    const container = $("#loanItemOptions", form);
    const update = () => {
      if (!goodSelect?.value) {
        container.innerHTML = `<span class="form-help">Pilih barang terlebih dahulu.</span>`;
        return;
      }
      const candidates = state.items.filter((item) => {
        if (item.goodId !== goodSelect.value) return false;
        if (key === "loans") {
          if (item.condition !== "Baik") return false;
          return !state.loans.some((loan) => loan.id !== record?.id && loan.status === "Diterima" && (loan.itemIds || []).includes(item.id));
        }
        return item.condition === "Rusak";
      });
      container.innerHTML = candidates.length ? candidates.map((item) => `<label class="item-choice"><input type="checkbox" name="itemIds" value="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""}><span><b>${esc(item.code)}</b><small>${esc(relatedName("locations", item.locationId))} · ${esc(item.condition)}</small></span></label>`).join("") : `<span class="form-help">${key === "loans" ? "Tidak ada item baik yang tersedia untuk barang ini." : "Tidak ada item rusak yang tercatat untuk barang ini."}</span>`;
    };
    goodSelect?.addEventListener("change", () => { selected.clear(); update(); });
    update();
  }
  function closeModal() { $("#modalRoot").innerHTML = ""; }

  async function saveRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = form.dataset.collection;
    const recordId = form.dataset.record;
    const config = collectionConfig[key];
    const old = recordId ? getById(key, recordId) : null;
    const data = old ? { ...old } : { id: id() };
    for (const [name, , type] of config.fields) {
      if (name === "itemIds" && ["loans", "disposals"].includes(key)) {
        data.itemIds = $$(`#loanItemOptions input[name="itemIds"]:checked`, form).map((input) => input.value);
        continue;
      }
      const input = form.elements[name];
      if (!input) continue;
      if (type === "checkbox") data[name] = input.checked;
      else if (type === "number") data[name] = Number(input.value || 0);
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
      } else data[name] = input.value.trim();
    }
    if (key === "usages") data.status = "Pengajuan";
    if (key === "usages") {
      const stock = Number(getById("goods", data.goodId)?.quantity || 0);
      if (data.quantity > stock) {
        showToast(`Maksimal stok adalah ${stock}.`, true);
        return;
      }
      data.status = old?.status || "Pengajuan";
    }
    if (key === "items" && !old) {
      const goodIndex = Math.max(0, state.goods.findIndex((good) => good.id === data.goodId)) + 1;
      const itemIndex = state.items.filter((item) => item.goodId === data.goodId).length + 1;
      data.code = `E.1-T.${goodIndex}-L1-KS.${itemIndex}`;
    }
    if (key === "loans") {
      data.status = old?.status || "Pengajuan";
      if (data.dueDate < data.startDate) { showToast("Tanggal kembali tidak boleh sebelum tanggal sewa.", true); return; }
      if (!data.itemIds?.length) {
        const available = state.items.find((item) => item.goodId === data.goodId && item.condition === "Baik" && !state.loans.some((loan) => loan.id !== old?.id && loan.status === "Diterima" && (loan.itemIds || []).includes(item.id)));
        if (available) data.itemIds = [available.id];
      }
      if (!data.itemIds?.length) { showToast("Pilih minimal satu item inventaris yang tersedia.", true); return; }
    }
    if (key === "disposals" && !data.itemIds?.length) {
      showToast("Pilih minimal satu item dengan kondisi rusak.", true);
      return;
    }
    if (key === "procurements") data.status = old?.status || "Pengajuan";
    if (key === "disposals") data.status = old?.status || "Pengajuan";
    if (key === "stocktakes") {
      data.total = data.newStock;
      const good = getById("goods", data.goodId);
      if (good) good.quantity = data.newStock;
    }
    if (key === "depreciations") {
      data.finalValue = Math.max(0, data.initialValue - data.amount);
    }
    if (old) Object.assign(old, data);
    else state[key].unshift(data);
    saveState();
    closeModal();
    showToast(`${config.singular} berhasil ${old ? "diperbarui" : "ditambahkan"}.`);
    renderPage();
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
    } else if (action === "delete") {
      if (!canDeletePage()) return showToast("Akun Anda tidak memiliki izin menghapus data.", true);
      const record = getById(page, button.dataset.id);
      if (record && window.confirm(`Hapus data "${record.name || record.title || record.code || "ini"}"? Tindakan ini tidak dapat dibatalkan.`)) {
        state[page] = state[page].filter((row) => row.id !== record.id);
        saveState(); showToast("Data berhasil dihapus."); renderPage();
      }
    } else if (action === "status") statusModal(button.dataset.id);
    else if (action === "print") window.print();
    else if (action === "export-report") exportReport();
    else if (action === "export" || action === "export-dashboard") exportRows(page);
    else if (action === "barcode-options") barcodeOptionsModal();
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
      ? `<div class="form-field" style="margin-top:14px"><label for="statusFund">Konfirmasi sumber dana</label><select id="statusFund">${optionsFor("funds").replace(`value="${esc(record.fundId)}"`, `value="${esc(record.fundId)}" selected`)}</select></div>` : "";
    showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Perbarui status</h2><p>${esc(actionLabel)} · ${esc(record.borrower || record.title || record.applicant || titleOfGood(record.goodId))}</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fafbfc;border-radius:8px"><span class="muted">Status saat ini</span>${statusBadge(record.status)}</div>${fundChoice}<div class="modal-footer">${buttons}</div></div></section></div>`);
    $$("[data-status-choice]", $("#modalRoot")).forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.statusChoice;
      if (next === "Selesai" && !window.confirm(page === "disposals" ? "Pemusnahan selesai? Item akan dihapus dari kondisi aktif." : "Peminjaman sudah dikembalikan?")) return;
      if (page === "loans" && next === "Diterima") {
        const alreadyBorrowed = (record.itemIds || []).some((itemId) => state.loans.some((loan) => loan.id !== record.id && loan.status === "Diterima" && (loan.itemIds || []).includes(itemId)));
        if (alreadyBorrowed) { showToast("Item terpilih sudah dipinjam pada transaksi lain.", true); return; }
      }
      record.status = next;
      if (page === "procurements" && next === "Diterima" && $("#statusFund")) record.fundId = $("#statusFund").value;
      if (page === "disposals" && next === "Selesai") (record.itemIds || []).forEach((itemId) => { const item = getById("items", itemId); if (item) item.condition = "Dihapus"; });
      if (page === "loans" && next === "Selesai") (record.itemIds || []).forEach((itemId) => { const item = getById("items", itemId); if (item && item.condition !== "Rusak") item.condition = "Baik"; });
      if (page === "usages" && next === "Disetujui") {
        const good = getById("goods", record.goodId);
        if (good && good.quantity < record.quantity) { showToast(`Stok tidak cukup. Maksimal stok adalah ${good.quantity}.`, true); return; }
        if (good) good.quantity -= Number(record.quantity);
      }
      saveState(); closeModal(); showToast(`Status ${actionLabel} diperbarui menjadi ${next}.`); renderPage();
    }));
  }

  function bindPageEvents() {
    $("#pageContent").onclick = recordActions;
    $("#pageContent").querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
    if ($("#schoolForm") && !canEditPage("school")) $$("input,textarea", $("#schoolForm")).forEach((input) => { input.disabled = true; });
    $("#tableSearch")?.addEventListener("input", (event) => { searchTerm = event.target.value; renderPage(); const input = $("#tableSearch"); input?.focus(); input?.setSelectionRange(searchTerm.length, searchTerm.length); });
    $("#statusFilter")?.addEventListener("change", (event) => { selectedFilter = event.target.value; renderPage(); });
    $("#chartPeriod")?.addEventListener("change", (event) => { chartPeriod = event.target.value; drawChart(); });
    $("#dashboardProcFilter")?.addEventListener("change", (event) => {
      const filter = event.target.value;
      $$("#dashboardProcRows tr[data-priority]").forEach((row) => { row.hidden = filter !== "Semua" && row.dataset.priority !== filter; });
    });
    $("#schoolForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const file = form.elements.logoFile.files?.[0];
      delete data.logoFile;
      const commit = () => {
        Object.assign(state.school, data);
        saveState(); $("#sidebarSchool").textContent = state.school.name; showToast("Profil sekolah berhasil disimpan."); renderPage();
      };
      if (!file) return commit();
      if (file.size > 2_000_000) return showToast("Ukuran logo maksimal 2 MB.", true);
      const reader = new FileReader();
      reader.onload = () => { data.logo = reader.result; commit(); };
      reader.onerror = () => showToast("File logo tidak dapat dibaca.", true);
      reader.readAsDataURL(file);
    });
    $("#unitImport")?.addEventListener("change", importUnits);
    const updateReport = () => {
      const type = $("#reportType")?.value;
      if (type) $("#reportBody").innerHTML = reportTable(type, $("#reportStart")?.value, $("#reportEnd")?.value);
    };
    $("#reportType")?.addEventListener("change", updateReport);
    $("#reportStart")?.addEventListener("change", updateReport);
    $("#reportEnd")?.addEventListener("change", updateReport);
    $$(".permission-select").forEach((input) => input.addEventListener("change", () => {
      state.settings.permissions[input.dataset.menu] = input.value;
      saveState(); showToast("Hak akses berhasil diperbarui.");
    }));
    $$(".mobile-nav-check").forEach((input) => input.addEventListener("change", () => {
      const checked = $$(".mobile-nav-check:checked").length;
      $$(".mobile-nav-check:not(:checked)").forEach((option) => { option.disabled = checked >= 5; });
    }));
    $("#barcodeSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      $$(".barcode-card").forEach((card) => { card.hidden = !card.textContent.toLowerCase().includes(query); });
    });
  }

  function importUnits(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const names = String(reader.result).split(/\r?\n/).map((line) => line.split(",")[0].replace(/^"|"$/g, "").trim()).filter(Boolean);
      const fresh = names.filter((name) => !state.units.some((row) => row.name.toLowerCase() === name.toLowerCase()));
      fresh.forEach((name) => state.units.push({ id: id(), name }));
      saveState(); showToast(`${fresh.length} satuan berhasil diimpor.`); renderPage();
    };
    reader.onerror = () => showToast("File CSV tidak dapat dibaca.", true);
    reader.readAsText(file);
  }

  function exportRows(key) {
    const config = collectionConfig[key];
    if (!config) {
      const rows = [["Kategori", "Jumlah"], ["Barang", state.goods.length], ["Item", state.items.length], ["Peminjaman", state.loans.length], ["Pengadaan", state.procurements.length]];
      downloadCsv("ringkasan-sarprah.csv", rows);
      return;
    }
    const rows = [config.cols.map(([, label]) => label), ...(state[key] || []).map((row) => config.cols.map(([field]) => plainCell(key, field, row)))];
    downloadCsv(`${key}-sarprah.csv`, rows);
  }

  function exportReport() {
    const type = $("#reportType")?.value || "inventaris";
    if (type === "inventaris") return exportRows("goods");
    const config = collectionConfig[type];
    if (!config) return;
    const dateField = ({ loans: "startDate", usages: "date", procurements: "date", disposals: "date", depreciations: "date" })[type];
    const start = $("#reportStart")?.value, end = $("#reportEnd")?.value;
    const records = (state[type] || []).filter((row) => !dateField || ((!start || row[dateField] >= start) && (!end || row[dateField] <= end)));
    downloadCsv(`laporan-${type}.csv`, [config.cols.map(([, label]) => label), ...records.map((row) => config.cols.map(([field]) => plainCell(type, field, row)))]);
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = filename; link.click(); URL.revokeObjectURL(link.href);
    showToast("File CSV berhasil diekspor.");
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
    const selected = $$(".mobile-nav-check:checked").map((input) => input.value);
    if (selected.length > 5) { showToast("Pilih maksimal 5 pintasan.", true); return; }
    if (!selected.length) { showToast("Pilih minimal satu pintasan.", true); return; }
    state.settings.mobileNav = selected;
    saveState(); renderMobileNav(); showToast("Navigasi mobile berhasil disimpan.");
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
    $("#menuToggle").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebarOverlay").classList.add("visible"); });
    $("#closeSidebar").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebarOverlay").classList.remove("visible"); });
    $("#sidebarOverlay").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebarOverlay").classList.remove("visible"); });
    $("#searchTrigger").addEventListener("click", () => {
      showModal(`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-header"><div><h2>Pencarian cepat</h2><p>Cari halaman untuk membuka fitur Sarprah.</p></div><button class="modal-close" data-action="close"><i data-lucide="x"></i></button></div><div class="modal-form"><label class="search-field" style="height:40px"><i data-lucide="search"></i><input id="globalSearch" placeholder="Ketik nama menu..." autofocus></label><div id="searchResults" style="margin-top:12px"></div></div></section></div>`);
      const input = $("#globalSearch");
      const update = () => {
        const query = input.value.toLowerCase();
        const results = Object.entries(meta).filter(([, value]) => value[0].toLowerCase().includes(query)).slice(0, 7);
        $("#searchResults").innerHTML = results.map(([key, value]) => `<button class="settings-row global-result" data-page="${key}" style="width:100%;text-align:left;border:0;background:white;cursor:pointer"><i data-lucide="${value[2]}" style="color:#ed741f"></i><b>${value[0]}</b><i data-lucide="arrow-up-right" style="margin-left:auto;color:#9aa3b0"></i></button>`).join("") || `<div class="empty-state">Menu tidak ditemukan.</div>`;
        if (window.lucide) lucide.createIcons({ nodes: [$("#searchResults")] });
        $$("#searchResults [data-page]").forEach((button) => button.addEventListener("click", () => { closeModal(); navigate(button.dataset.page); }));
      };
      input.addEventListener("input", update); update(); input.focus();
    });
    $("#profileButton").addEventListener("click", logout);
    $("#topbarUser").addEventListener("click", logout);
    $("#loginForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const email = $("#loginEmail").value.trim().toLowerCase(), password = $("#loginPassword").value;
      const account = state.accounts.find((row) => row.email.toLowerCase() === email && row.active);
      if (account && ((email === "admin@sarprah.id" && password === "sarprah123") || password.length >= 6)) {
        activeUser = account; sessionStorage.setItem("sarprah-user", JSON.stringify({ id: account.id, name: account.name, role: account.role }));
        enterApp();
      } else $("#loginError").textContent = "Email atau kata sandi tidak sesuai.";
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#searchTrigger").click(); }
      if (event.key === "Escape") closeModal();
    });
    window.addEventListener("resize", () => { if (page === "dashboard") drawChart(); });
    window.addEventListener("beforeprint", () => {
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
    window.addEventListener("afterprint", () => $$(".barcode-card").forEach((card) => { card.style.display = card.dataset.previousDisplay || ""; }));
  }

  function enterApp() {
    $("#loginScreen").classList.add("hidden"); $("#appShell").classList.remove("hidden");
    $("#profileName").textContent = activeUser?.name || "Admin Sekolah";
    const initials = (activeUser?.name || "Admin").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
    $$(".avatar").forEach((node) => { node.textContent = initials; });
    $("#sidebarSchool").textContent = state.school.name;
    renderNavigation(); navigate(page);
  }

  function logout() {
    if (!window.confirm("Keluar dari aplikasi Sarprah?")) return;
    sessionStorage.removeItem("sarprah-user"); activeUser = null;
    $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden");
    if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
  }

  async function init() {
    setup();
    await loadState();
    const savedUser = sessionStorage.getItem("sarprah-user");
    if (savedUser) {
      try { activeUser = JSON.parse(savedUser); } catch { sessionStorage.removeItem("sarprah-user"); }
    }
    if (activeUser) enterApp();
    else {
      $("#loginScreen").classList.remove("hidden");
      if (window.lucide) lucide.createIcons({ nodes: [$("#loginScreen")] });
    }
  }
  init();
})();
