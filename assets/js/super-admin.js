(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const featureNames = {
    dashboard: "Dashboard", school: "Data Sekolah", types: "Jenis Barang", categories: "Kategori Barang", units: "Satuan",
    locations: "Ruang / Lokasi", ownerships: "Kepemilikan", suppliers: "Penyedia / Supplier", funds: "Sumber Dana",
    academicYears: "Tahun Pelajaran", goods: "Data Barang", usages: "Penggunaan BHP",
    stocktakes: "Stock Opname", barcode: "Cetak Barcode", repairTickets: "Tiket Perbaikan",
    maintenanceCalendar: "Kalender Pemeliharaan", loans: "Peminjaman", procurements: "Pengadaan",
    disposals: "Pemusnahan", depreciations: "Penyusutan", reports: "Laporan"
  };
  const nav = [
    ["overview", "Ringkasan", "⌂"], ["schools", "Daftar Sekolah", "▦"], ["payments", "Pembayaran", "↙"],
    ["billing", "Penagihan", "◷"], ["plans", "Paket Langganan", "◇"], ["profile", "Pengaturan Profil", "◉"],
    ["defaultMenus", "Default Menu Sekolah", "☷"], ["branding", "Branding Sistem", "✦"],
    ["pricing", "QRIS & Harga", "▧"], ["terms", "Syarat & SLA", "§"], ["tickets", "Pusat Tiket", "✉"],
    ["announcements", "Pengumuman & Maintenance", "◉"], ["manuals", "Petunjuk Pengguna", "▤"],
    ["audit", "Audit Logs", "≋"], ["whatsapp", "WA Gateway", "◌"], ["backup", "Backup & Restore", "⤓"]
  ];
  let data = null;
  let admin = null;
  let view = "overview";
  let detail = null;
  let toastTimer;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function money(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function date(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? esc(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(parsed);
  }
  function statusBadge(value) {
    const cls = /Aktif|Disetujui|Selesai|Lifetime/i.test(value) ? "ok" : /Tolak|Tangguh|Ditangguhkan|Nonaktif/i.test(value) ? "bad" : "warn";
    return `<span class="badge ${cls}">${esc(value || "—")}</span>`;
  }
  function toast(message, error = false) {
    const node = $("#platformToast");
    node.textContent = message;
    node.classList.toggle("is-error", error);
    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("visible"), 3200);
  }
  async function api(url, method = "GET", body) {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Permintaan gagal (HTTP ${response.status}).`);
    return result;
  }
  function field(label, name, value = "", type = "text", attrs = "") {
    return `<label class="field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  }
  function textarea(label, name, value = "", attrs = "") {
    return `<label class="field">${esc(label)}<textarea name="${esc(name)}" ${attrs}>${esc(value)}</textarea></label>`;
  }
  function selectField(label, name, value, options) {
    return `<label class="field">${esc(label)}<select name="${esc(name)}">${options.map(([key, text]) => `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  }
  function featureChecks(selected = []) {
    const list = Array.isArray(selected) ? selected : [];
    return `<div class="check-grid">${Object.entries(featureNames).map(([key, label]) => `<label class="check-option"><input type="checkbox" name="features" value="${key}" ${list.includes(key) ? "checked" : ""}>${esc(label)}</label>`).join("")}</div>`;
  }
  function showGate({ setup = false, message = "", reset = false, step = "request", identifier = "" } = {}) {
    $("#platform").classList.add("hidden");
    $("#gate").classList.remove("hidden");
    $("#gateContent").innerHTML = setup
      ? `<h1>Siapkan akun Super Admin</h1><p>Buat satu akun pengelola platform. Halaman setup akan terkunci setelah akun dibuat.</p>
        <form id="gateForm">${field("Nama lengkap", "name", "", "text", "required maxlength=120")}${field("Username", "username", "", "text", "required minlength=3 maxlength=32 pattern=[a-z0-9._-]+")}${field("Email", "email", "", "email", "required")}${field("Kata sandi (minimal 10 karakter)", "password", "", "password", "required minlength=10")}<button class="primary w-full" type="submit">Buat akun Super Admin</button><p class="error" id="gateError">${esc(message)}</p></form>`
      : reset
        ? step === "complete"
          ? `<h1>Atur ulang kata sandi</h1><p>Jika akun ditemukan, kode OTP dikirim ke nomor pemulihan Super Admin. Kode berlaku 10 menit. Username/email boleh dikosongkan jika hanya ada satu akun.</p>
            <form id="gateForm" data-mode="reset-complete">${field("Username atau email (opsional jika hanya satu akun)", "username", identifier, "text", "autocomplete=username")}${field("Kode OTP 6 digit", "otpCode", "", "text", "required inputmode=numeric pattern=[0-9]{6} maxlength=6 autocomplete=one-time-code")}${field("Kata sandi baru (minimal 10 karakter)", "newPassword", "", "password", "required minlength=10 maxlength=200 autocomplete=new-password")}<button class="primary w-full" type="submit">Simpan kata sandi baru</button><p class="error" id="gateError">${esc(message)}</p></form>
            <button class="secondary w-full" id="backToLogin" type="button">Kembali ke login</button>`
          : `<h1>Lupa kata sandi?</h1><p>Masukkan username atau email. Jika hanya ada satu akun, boleh dikosongkan. Kode OTP dikirim ke nomor pemulihan Super Admin.</p>
            <form id="gateForm" data-mode="reset-request">${field("Username atau email (opsional jika hanya satu akun)", "username", "", "text", "autocomplete=username")}<button class="primary w-full" type="submit">Kirim kode OTP</button><p class="error" id="gateError">${esc(message)}</p></form>
            <button class="secondary w-full" id="backToLogin" type="button">Kembali ke login</button>`
        : `<h1>Masuk ke panel SaaS</h1><p>Gunakan kredensial Super Admin untuk mengelola seluruh sekolah.</p>
          <form id="gateForm" data-mode="login">${field("Username atau email", "username", "", "text", "required autocomplete=username")}${field("Kata sandi", "password", "", "password", "required autocomplete=current-password")}<button class="primary w-full" type="submit">Masuk ke control center</button><p class="error" id="gateError">${esc(message)}</p></form>
          <button class="secondary w-full" id="forgotPassword" type="button">Lupa kata sandi?</button>`;
    $("#gateForm").addEventListener("submit", submitGate);
    $("#forgotPassword")?.addEventListener("click", () => showGate({ reset: true }));
    $("#backToLogin")?.addEventListener("click", () => showGate());
  }
  async function submitGate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (form.dataset.mode === "reset-request") {
        const username = form.elements.username.value.trim();
        await api("/api/platform/password-reset/request", "POST", { username });
        showGate({ reset: true, step: "complete", identifier: username });
        return;
      }
      if (form.dataset.mode === "reset-complete") {
        await api("/api/platform/password-reset/complete", "POST", {
          username: form.elements.username.value.trim(),
          otpCode: form.elements.otpCode.value.trim(),
          newPassword: form.elements.newPassword.value
        });
        return showGate({ message: "Kata sandi berhasil direset. Silakan masuk." });
      }
      const setup = form.elements.name;
      if (setup) {
        await api("/api/platform/setup", "POST", {
          name: form.elements.name.value.trim(),
          username: form.elements.username.value.trim(),
          email: form.elements.email.value.trim(),
          password: form.elements.password.value
        });
        await api("/api/platform/login", "POST", {
          username: form.elements.username.value.trim(),
          password: form.elements.password.value
        });
      } else {
        await api("/api/platform/login", "POST", {
          username: form.elements.username.value.trim(),
          password: form.elements.password.value
        });
      }
      await openPlatform();
    } catch (error) {
      $("#gateError").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
  async function openPlatform() {
    const session = await api("/api/platform/session");
    if (!session.user) return showGate();
    admin = session.user;
    data = await api("/api/platform/data");
    applyPlatformBranding(data.settings?.branding);
    $("#gate").classList.add("hidden");
    $("#platform").classList.remove("hidden");
    $("#adminName").textContent = admin.name || admin.username;
    renderNav();
    renderView();
  }
  function renderNav() {
    $("#platformNav").innerHTML = nav.map(([key, label, icon]) =>
      `<button type="button" class="${key === view ? "active" : ""}" data-view="${key}"><span class="nav-icon">${icon}</span>${esc(label)}</button>`
    ).join("");
  }
  function applyPlatformBranding(branding = {}) {
    const appName = String(branding.appName || "Sarprah").trim() || "Sarprah";
    const appLogo = typeof branding.logo === "string" ? branding.logo : typeof branding.appLogo === "string" ? branding.appLogo : "";
    const initials = appName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "SP";
    document.title = `${appName} · Super Admin`;
    document.querySelectorAll("[data-platform-brand-name]").forEach((node) => { node.textContent = appName; });
    document.querySelectorAll("[data-platform-brand-mark]").forEach((node) => {
      node.classList.toggle("has-logo", Boolean(appLogo));
      node.innerHTML = appLogo ? `<img src="${esc(appLogo)}" alt="${esc(appName)}">` : esc(initials);
    });
    const favicon = $("#platformFavicon");
    if (appLogo) {
      favicon.href = appLogo;
      favicon.type = appLogo.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));/)?.[1] || "image/png";
    } else {
      favicon.href = favicon.dataset.defaultHref || favicon.href;
      favicon.type = "image/svg+xml";
    }
  }
  async function refreshData() {
    data = await api("/api/platform/data");
    applyPlatformBranding(data.settings?.branding);
    renderView();
  }
  async function savePlatform(partial) {
    data = await api("/api/platform/data", "PUT", partial);
    applyPlatformBranding(data.settings?.branding);
    toast("Perubahan berhasil disimpan.");
    renderView();
  }
  function intro(title, subtitle, action = "") {
    return `<div class="page-intro"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="intro-actions">${action}</div></div>`;
  }
  function panel(title, body, subtitle = "") {
    return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div>${body}</section>`;
  }
  function table(headers, rows, empty = "Belum ada data.") {
    return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="${headers.length}">${empty}</td></tr>`}</tbody></table></div>`;
  }
  function stat(label, value, accent = false) {
    return `<article class="stat-card"><small>${label}</small><strong class="${accent ? "stat-accent" : ""}">${value}</strong></article>`;
  }
  function schoolRows(schools) {
    return schools.map((school) => `<tr><td><span class="row-title">${esc(school.name)}</span><span class="subtext">${esc(school.code)} · ${esc(school.level || "Jenjang belum diatur")}</span></td>
      <td>${esc(school.email || "—")}<span class="subtext">${esc(school.phone || "")}</span></td><td>${esc(school.planName || data.plans.find((p) => p.id === school.planId)?.name || "—")}</td>
      <td>${statusBadge(school.status)}</td><td>${school.accountCount || 0} akun · ${school.goodsCount || 0} barang</td>
      <td><button class="action-btn" data-school-detail="${esc(school.id)}">Detail</button></td></tr>`).join("");
  }
  function dashboard() {
    const schools = data.schools || [];
    const active = schools.filter((school) => ["Aktif", "Uji Coba", "Lifetime"].includes(school.status)).length;
    const openPayments = (data.payments || []).filter((row) => row.status === "Menunggu Verifikasi").length;
    const tickets = data.tickets || [];
    const recent = schools.slice(0, 6);
    return `${intro("Ringkasan platform", "Pantau kesehatan SaaS, aktivitas sekolah, dan tindak lanjut operasional.", `<button class="secondary" data-action="refresh">↻ Perbarui data</button>`)}
      <div class="stats-grid">${stat("TOTAL SEKOLAH", schools.length)}${stat("AKUN AKTIF / UJI COBA", active, true)}${stat("PEMBAYARAN MENUNGGU", openPayments)}${stat("TIKET BELUM SELESAI", tickets.filter((t) => !["Selesai", "Ditolak", "Ditutup"].includes(t.status)).length)}</div>
      <div class="grid-2">${panel("Sekolah terbaru", table(["Sekolah", "Paket", "Status", "Aksi"], recent.map((s) => `<tr><td><b>${esc(s.name)}</b><span class="subtext">${esc(s.code)}</span></td><td>${esc(data.plans.find((p) => p.id === s.planId)?.name || "—")}</td><td>${statusBadge(s.status)}</td><td><button class="action-btn" data-school-detail="${esc(s.id)}">Detail</button></td></tr>`).join(""), "Belum ada sekolah."))}
      ${panel("Tiket kendala terbaru", table(["Tiket", "Sekolah", "Status"], tickets.slice(0, 6).map((t) => `<tr><td><b>${esc(t.title || t.ticketNo || "Tiket")}</b><span class="subtext">${date(t.createdAt)}</span></td><td>${esc(t.schoolName || "—")} <span class="subtext">${esc(t.schoolCode || "")}</span></td><td>${statusBadge(t.status)}</td></tr>`).join(""), "Belum ada tiket."))}</div>`;
  }
  function schoolsView() {
    return `${intro("Daftar sekolah", "Kelola informasi, akun Admin, fitur, tagihan, tiket, dan ringkasan tiap tenant.", `<button class="primary" data-action="add-school">＋ Tambah sekolah</button>`)}
      ${panel("Tenant sekolah", `<div class="inline" style="margin-bottom:12px"><input class="control search" id="schoolSearch" type="search" placeholder="Cari nama, kode, email..."><span class="help-text">${(data.schools || []).length} sekolah terdaftar</span></div>${table(["Sekolah", "Kontak", "Paket", "Status", "Ringkasan", "Aksi"], schoolRows(data.schools || []), "Belum ada sekolah.")}`)}`;
  }
  function addSchoolModal() {
    const plans = (data.plans || []).filter((p) => p.active);
    showModal("Tambah sekolah", "Buat tenant dan akun Administrator sekolah.", `<form id="addSchoolForm">
      <div class="form-grid">${field("Nama sekolah", "name", "", "text", "required maxlength=180")}${field("Jenjang", "level")}${field("Nama Administrator", "adminName", "", "text", "required")}${field("Email Administrator", "email", "", "email", "required")}${field("Nomor WhatsApp", "phone", "", "tel", "required")}${field("Kata sandi admin", "password", "", "password", "required minlength=8")}
      ${selectField("Paket", "planId", plans[0]?.id || "", plans.map((p) => [p.id, p.name]))}${selectField("Periode", "subscriptionPeriod", "monthly", [["monthly", "Bulanan"], ["semester", "Semester"], ["yearly", "Tahunan"], ["lifetime", "Lifetime"]])}</div>
      <div class="modal-actions"><button type="button" class="secondary" data-modal-close>Batal</button><button class="primary">Buat tenant</button></div></form>`);
    $("#addSchoolForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/platform/schools", "POST", {
          school: { name: form.elements.name.value.trim(), level: form.elements.level.value.trim(), phone: form.elements.phone.value.trim(), planId: form.elements.planId.value, subscriptionPeriod: form.elements.subscriptionPeriod.value },
          admin: { name: form.elements.adminName.value.trim(), email: form.elements.email.value.trim(), password: form.elements.password.value }
        });
        closeModal(); await refreshData(); toast(`Sekolah ditambahkan. Kode: ${result.school.code}`);
      } catch (error) { toast(error.message, true); }
    });
  }
  async function openSchoolDetail(id, tab = "info") {
    try {
      detail = await api(`/api/platform/schools/${encodeURIComponent(id)}`);
      renderSchoolDetail(tab);
    } catch (error) { toast(error.message, true); }
  }
  function renderSchoolDetail(tab) {
    const school = detail.school;
    const tabs = [["info", "Informasi sekolah"], ["admin", "Akun Admin"], ["features", "Kontrol fitur"], ["billing", "Tagihan"], ["tickets", "Tiket kendala"], ["summary", "Ringkasan"]];
    let body = "";
    if (tab === "info") {
      body = `<form id="schoolInfoForm"><div class="form-grid">
        ${field("Nama sekolah", "name", school.name, "text", "required")}${field("Kode sekolah (4 karakter)", "code", school.code, "text", "required minlength=4 maxlength=4 pattern=[A-Za-z0-9]{4}")}
        ${field("Jenjang", "level", school.level)}${field("Email sekolah", "email", school.email, "email")}
        ${field("Telepon / WhatsApp", "phone", school.phone)}${field("Domain", "domain", school.domain)}
        ${field("Nama kepala sekolah", "principalName", school.principalName)}
        ${selectField("Paket", "planId", school.planId, data.plans.map((p) => [p.id, p.name]))}
        ${selectField("Status", "status", school.status, [["Uji Coba", "Uji Coba"], ["Aktif", "Aktif"], ["Menunggu Pembayaran", "Menunggu Pembayaran"], ["Ditangguhkan", "Ditangguhkan"], ["Dihentikan", "Dihentikan"], ["Lifetime", "Lifetime"]])}
        ${selectField("Periode", "subscriptionPeriod", school.subscriptionPeriod || "monthly", [["monthly", "Bulanan"], ["semester", "Semester"], ["yearly", "Tahunan"], ["lifetime", "Lifetime"]])}
        ${field("Berlaku sampai", "expiresAt", school.expiresAt ? school.expiresAt.slice(0, 10) : "", "date")}${field("Akhir uji coba", "trialEndsAt", school.trialEndsAt ? school.trialEndsAt.slice(0, 10) : "", "date")}
        ${textarea("Alamat", "address", school.address, 'class="wide"')}</div><div class="modal-actions"><button class="primary">Simpan informasi</button></div></form>`;
    } else if (tab === "admin") {
      const account = detail.admin[0] || {};
      body = `<form id="schoolAdminForm"><div class="form-grid">${field("Nama Administrator", "name", account.name, "text", "required")}${field("Email Administrator", "email", account.email, "email", "required")}${field("Kata sandi baru (opsional)", "password", "", "password", "minlength=8")}</div><p class="help-text">Kosongkan kata sandi bila tidak ingin mengubahnya. Kode sekolah: <b>${esc(school.code)}</b></p><div class="modal-actions"><button class="primary">Simpan akun admin</button></div></form>`;
    } else if (tab === "features") {
      body = `<form id="schoolFeaturesForm"><p class="help-text">Menu yang dinonaktifkan tidak muncul bagi semua pengguna tenant sekolah.</p>${featureChecks(Object.keys(school.featureAccess || {}).filter((key) => school.featureAccess[key]))}<div class="modal-actions"><button class="primary">Simpan kontrol fitur</button></div></form>`;
    } else if (tab === "billing") {
      body = table(["Tanggal", "Jenis", "Periode", "Nominal", "Status"], (detail.payments || []).map((p) => `<tr><td>${date(p.createdAt)}</td><td>${esc(p.type || "Tagihan")}</td><td>${esc(p.period || "—")}</td><td>${money(p.amount)}</td><td>${statusBadge(p.status)}</td></tr>`).join(""), "Belum ada tagihan.");
    } else if (tab === "tickets") {
      body = table(["Tiket", "Tanggal", "Status", "Aksi"], (detail.tickets || []).map((t) => `<tr><td>${esc(t.ticketNo || t.title || "Tiket")}<span class="subtext">${esc(t.title || "")}</span></td><td>${date(t.createdAt)}</td><td>${statusBadge(t.status)}</td><td><button class="action-btn" data-ticket-reply="${esc(t.id)}">Tanggapi</button></td></tr>`).join(""), "Belum ada tiket.");
    } else {
      body = `<div class="stats-grid">${stat("BARANG", detail.summary.goods, true)}${stat("AKUN PENGGUNA", detail.summary.accounts)}${stat("TIKET TERBUKA", school.openTicketCount || 0)}</div><p class="help-text">Tenant dibuat pada ${date(school.createdAt)}. Status saat ini: ${statusBadge(school.status)}</p>`;
    }
    const modal = $("#platformModal");
    modal.innerHTML = `<section class="modal-card"><div class="modal-head"><div><h2>${esc(school.name)}</h2><p>Kode ${esc(school.code)} · ${esc(school.email || "Email belum diatur")}</p></div><button class="modal-close" data-modal-close aria-label="Tutup">×</button></div>
      <div class="tabs">${tabs.map(([key, label]) => `<button class="tab-btn ${key === tab ? "active" : ""}" data-school-tab="${key}">${label}</button>`).join("")}</div>${body}</section>`;
    modal.classList.remove("hidden");
    modal.querySelectorAll("[data-school-tab]").forEach((button) => button.addEventListener("click", () => renderSchoolDetail(button.dataset.schoolTab)));
    $("#schoolInfoForm")?.addEventListener("submit", (event) => submitSchoolInfo(event, school.id));
    $("#schoolAdminForm")?.addEventListener("submit", (event) => submitSchoolAdmin(event, school.id));
    $("#schoolFeaturesForm")?.addEventListener("submit", (event) => submitSchoolFeatures(event, school.id));
  }
  async function submitSchoolInfo(event, id) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    try { await api(`/api/platform/schools/${encodeURIComponent(id)}`, "PUT", body); detail = await api(`/api/platform/schools/${encodeURIComponent(id)}`); await refreshData(); renderSchoolDetail("info"); toast("Informasi sekolah disimpan."); }
    catch (error) { toast(error.message, true); }
  }
  async function submitSchoolAdmin(event, id) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { await api(`/api/platform/schools/${encodeURIComponent(id)}/admin`, "PUT", body); detail = await api(`/api/platform/schools/${encodeURIComponent(id)}`); renderSchoolDetail("admin"); toast("Akun Administrator diperbarui."); }
    catch (error) { toast(error.message, true); }
  }
  async function submitSchoolFeatures(event, id) {
    event.preventDefault();
    const featureAccess = Object.fromEntries(Object.keys(featureNames).map((key) => [key, false]));
    new FormData(event.currentTarget).getAll("features").forEach((key) => { featureAccess[key] = true; });
    try { await api(`/api/platform/schools/${encodeURIComponent(id)}`, "PUT", { featureAccess }); detail = await api(`/api/platform/schools/${encodeURIComponent(id)}`); await refreshData(); renderSchoolDetail("features"); toast("Kontrol fitur sekolah disimpan."); }
    catch (error) { toast(error.message, true); }
  }
  function paymentsView() {
    const rows = (data.payments || []).map((p) => `<tr><td><span class="row-title">${esc(p.schoolName)}</span><span class="subtext">${esc(p.schoolCode || "")}</span></td><td>${esc(p.type || "Tagihan")}</td><td>${date(p.createdAt || p.dueDate)}</td><td>${esc(p.period || "—")}</td><td>${money(p.amount)}</td><td>${statusBadge(p.status)}</td><td><div class="action-row"><button class="action-btn" data-payment="${esc(p.id)}" data-payment-status="Disetujui">Setujui</button><button class="action-btn" data-payment="${esc(p.id)}" data-payment-status="Ditolak">Tolak</button></div></td></tr>`).join("");
    return `${intro("Pembayaran", "Verifikasi pembayaran sekolah dan aktifkan masa langganan tenant.")}${panel("Daftar pembayaran", table(["Sekolah", "Jenis", "Tanggal", "Periode", "Nominal", "Status", "Aksi"], rows, "Belum ada pembayaran."))}`;
  }
  function billingView() {
    const waiting = (data.payments || []).filter((p) => p.status === "Menunggu Verifikasi");
    const due = (data.schools || []).filter((s) => ["Uji Coba", "Aktif", "Menunggu Pembayaran"].includes(s.status));
    return `${intro("Penagihan", "Buat pemeriksaan tagihan berdasarkan tanggal berakhir uji coba atau masa aktif.", `<button class="primary" data-action="run-billing">Jalankan pemeriksaan tagihan</button>`)}
      <div class="stats-grid">${stat("TENANT DIPANTAU", due.length)}${stat("TAGIHAN MENUNGGU", waiting.length, true)}${stat("JUMLAH TAGIHAN", (data.payments || []).length)}</div>
      ${panel("Masa aktif tenant", table(["Sekolah", "Kode", "Status", "Paket", "Berakhir", "Kontak"], due.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.code)}</td><td>${statusBadge(s.status)}</td><td>${esc(data.plans.find((p) => p.id === s.planId)?.name || "—")}</td><td>${date(s.expiresAt || s.trialEndsAt)}</td><td>${esc(s.phone || s.email || "—")}</td></tr>`).join(""), "Tidak ada sekolah yang ditagih."))}`;
  }
  function plansView() {
    const rows = (data.plans || []).map((p) => `<tr><td><b>${esc(p.name)}</b><span class="subtext">${esc(p.description)}</span></td><td>${money(p.prices?.monthly)}</td><td>${money(p.prices?.semester)}</td><td>${money(p.prices?.yearly)}</td><td>${p.trialDays || 0} hari</td><td>${p.features?.length || 0} menu</td><td>${statusBadge(p.active ? "Aktif" : "Nonaktif")}</td><td><button class="action-btn" data-plan-edit="${esc(p.id)}">Edit</button></td></tr>`).join("");
    return `${intro("Paket langganan", "Atur fitur yang termasuk dalam setiap paket, masa uji coba, dan harga.", `<button class="primary" data-action="add-plan">＋ Tambah paket</button>`)}${panel("Daftar paket", table(["Paket", "Bulanan", "Semester", "Tahunan", "Trial", "Fitur", "Status", "Aksi"], rows, "Belum ada paket."))}`;
  }
  function planModal(plan = null) {
    const p = plan || { id: "", name: "", description: "", active: true, trialDays: 14, prices: {}, features: Object.keys(featureNames) };
    showModal(plan ? "Edit paket langganan" : "Paket baru", "Paket aktif dapat dipilih saat mendaftarkan sekolah.", `<form id="planForm">
      <div class="form-grid">${field("ID paket", "id", p.id, "text", "required pattern=[a-zA-Z0-9_-]+")}${field("Nama paket", "name", p.name, "text", "required")}
      ${field("Lama uji coba (hari)", "trialDays", p.trialDays, "number", "min=0 max=365")}${selectField("Status", "active", String(p.active), [["true", "Aktif"], ["false", "Nonaktif"]])}
      ${field("Harga bulanan", "monthly", p.prices?.monthly || 0, "number", "min=0")}${field("Harga semester", "semester", p.prices?.semester || 0, "number", "min=0")}${field("Harga tahunan", "yearly", p.prices?.yearly || 0, "number", "min=0")}${textarea("Deskripsi", "description", p.description, 'class="wide"')}</div>
      <label class="field">Menu yang disertakan</label>${featureChecks(p.features)}
      <div class="modal-actions"><button class="secondary" type="button" data-modal-close>Batal</button><button class="primary">Simpan paket</button></div></form>`);
    $("#planForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const existing = (data.plans || []).filter((row) => row.id !== p.id);
      const planData = { id: form.elements.id.value.trim(), code: form.elements.id.value.trim(), name: form.elements.name.value.trim(), description: form.elements.description.value.trim(), active: form.elements.active.value === "true", trialDays: Number(form.elements.trialDays.value), prices: { monthly: Number(form.elements.monthly.value), semester: Number(form.elements.semester.value), yearly: Number(form.elements.yearly.value) }, features: new FormData(form).getAll("features") };
      try { await savePlatform({ plans: [...existing, planData] }); closeModal(); }
      catch (error) { toast(error.message, true); }
    });
  }
  function profileView() {
    return `${intro("Pengaturan profil", "Perbarui identitas dan keamanan akun Super Admin.")}${panel("Profil Super Admin", `<form id="profileForm"><div class="form-grid">${field("Nama", "name", admin.name, "text", "required maxlength=120")}${field("Username", "username", admin.username, "text", "readonly")}${field("Email", "email", admin.email, "email", "required")}${field("Kata sandi saat ini", "currentPassword", "", "password", "autocomplete=current-password")}${field("Kata sandi baru (opsional)", "newPassword", "", "password", "minlength=10 autocomplete=new-password")}</div><p class="help-text">Kata sandi saat ini diperlukan jika Anda mengganti kata sandi.</p><div class="modal-actions"><button class="primary">Simpan profil</button></div></form>`)}`;
  }
  function defaultMenusView() {
    return `${intro("Default menu sekolah", "Pilih menu yang otomatis diaktifkan untuk tenant baru.")}${panel("Menu default", `<form id="defaultMenusForm"><p class="help-text">Hak fitur masing-masing tenant tetap dapat diatur dari detail sekolah.</p>${featureChecks(data.settings.defaultMenus || [])}<div class="modal-actions"><button class="primary">Simpan menu default</button></div></form>`)}`;
  }
  function brandingView() {
    const b = data.settings.branding || {};
    return `${intro("Branding sistem", "Tentukan nama, tagline, dan logo yang muncul pada aplikasi sekolah serta panel Super Admin.")}${panel("Identitas platform", `<form id="brandingForm">${field("Nama aplikasi", "appName", b.appName || "Sarprah", "text", "required maxlength=80")}${field("Tagline", "tagline", b.tagline || "", "text", "maxlength=160")}<label class="field">Logo aplikasi (gambar)<input name="logoFile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"></label>${b.logo ? `<p class="help-text">Logo sudah tersimpan. Kosongkan file untuk mempertahankan logo.</p>` : ""}<div class="modal-actions"><button class="primary">Simpan branding</button></div></form>`)}`;
  }
  function pricingView() {
    const settings = data.settings;
    const gateways = settings.paymentGateways || {};
    const callbackUrl = (provider) => `${window.location.origin}/api/payments/webhook/${provider}`;
    const gatewayForm = (provider, title, envName, fields, note) => {
      const config = gateways[provider] || {};
      return panel(title, `<form data-gateway-form="${provider}">
        <label class="check-option"><input type="checkbox" name="enabled" ${config.enabled ? "checked" : ""}>Aktifkan ${title}</label>
        ${selectField("Mode", "environment", config.environment || "sandbox", [["sandbox", "Sandbox / test"], ["production", "Produksi"]])}
        ${fields}
        <p class="help-text">${config.configured ? "Kredensial tersimpan terenkripsi. Kosongkan kolom rahasia agar tetap memakai kredensial saat ini." : "Kredensial belum lengkap."}</p>
        <p class="help-text">${note}<br>Callback: <code>${esc(callbackUrl(provider))}</code></p>
        <div class="modal-actions"><button class="primary">Simpan konfigurasi ${title}</button></div>
      </form>`);
    };
    return `${intro("QRIS & harga", "Kelola informasi pembayaran dan tarif langganan per periode.")}${panel("Harga berlangganan", `<form id="pricingForm"><div class="form-grid">${field("Bulanan (Rp)", "monthly", settings.pricing?.monthly || 0, "number", "min=0")}${field("Semester (Rp)", "semester", settings.pricing?.semester || 0, "number", "min=0")}${field("Tahunan (Rp)", "yearly", settings.pricing?.yearly || 0, "number", "min=0")}${field("Masa trial default (hari)", "trialDays", settings.trialDays ?? 14, "number", "min=0 max=365")}</div><div class="modal-actions"><button class="primary">Simpan harga</button></div></form>`)}
      ${panel("QRIS manual", `<form id="qrisForm"><label class="field">Unggah gambar QRIS<input name="qrisFile" type="file" accept="image/png,image/jpeg,image/webp"></label>${settings.qrisImage ? `<img src="${esc(settings.qrisImage)}" alt="QRIS aktif" style="max-width:180px;max-height:180px;border:1px solid #e9edf2;border-radius:12px;padding:8px">` : `<p class="help-text">Belum ada gambar QRIS manual.</p>`}<div class="modal-actions"><button class="primary">Simpan QRIS manual</button></div></form>`) }
      <p class="help-text">Gateway otomatis dapat diaktifkan terpisah dari QRIS manual. Atur kredensial sandbox lebih dahulu, lalu daftarkan callback URL pada dashboard penyedia.</p>
      ${gatewayForm("kasera", "Kasera Pay", "environment", `${field("API key", "apiKey", "", "password", "autocomplete=new-password")}${field("Webhook signing secret", "webhookSecret", "", "password", "autocomplete=new-password")}`, "Kasera memverifikasi webhook dengan Kasera-Signature-V1.")}
      ${gatewayForm("xendit", "Xendit", "environment", `${field("Secret API key", "secretKey", "", "password", "autocomplete=new-password")}${field("Callback verification token", "callbackToken", "", "password", "autocomplete=new-password")}`, "Atur callback token yang sama pada konfigurasi webhook Invoice Xendit.")}
      ${gatewayForm("duitku", "Duitku", "environment", `${field("Merchant Code", "merchantCode", "", "text", "autocomplete=off")}${field("API key", "apiKey", "", "password", "autocomplete=new-password")}`, "Callback Duitku diverifikasi menggunakan signature HMAC/MD5 sesuai API.")}`;
  }
  function termsView() {
    return `${intro("Syarat & SLA", "Konten ini ditampilkan kepada pengguna akun sekolah.")}${panel("Ketentuan layanan", `<form id="termsForm">${textarea("Syarat penggunaan", "terms", data.settings.terms || "", "rows=9")}${textarea("SLA / tingkat layanan", "sla", data.settings.sla || "", "rows=7")}<div class="modal-actions"><button class="primary">Simpan syarat & SLA</button></div></form>`)}`;
  }
  function ticketsView() {
    const rows = (data.tickets || []).map((t) => `<tr><td><b>${esc(t.ticketNo || t.title || "Tiket")}</b><span class="subtext">${esc(t.title || "")}</span></td><td>${esc(t.schoolName || "—")}<span class="subtext">${esc(t.schoolCode || "")}</span></td><td>${date(t.createdAt)}</td><td>${statusBadge(t.status)}</td><td><button class="action-btn" data-ticket-reply="${esc(t.id)}" data-school-id="${esc(t.schoolId)}">Buka / tanggapi</button></td></tr>`).join("");
    return `${intro("Pusat tiket", "Rekap kendala dari seluruh sekolah dan kirim tindak lanjut.")}${panel("Tiket sekolah", table(["Tiket", "Sekolah", "Dibuat", "Status", "Aksi"], rows, "Belum ada tiket."))}`;
  }
  function announcementsView() {
    const settings = data.settings;
    const rows = (data.announcements || []).map((item) => `<tr><td><b>${esc(item.title)}</b><span class="subtext">${esc(item.message)}</span></td><td>${statusBadge(item.active === false ? "Nonaktif" : "Aktif")}</td><td>${date(item.createdAt)}</td><td><button class="action-btn" data-announcement-toggle="${esc(item.id)}">${item.active === false ? "Aktifkan" : "Nonaktifkan"}</button><button class="action-btn" data-announcement-delete="${esc(item.id)}">Hapus</button></td></tr>`).join("");
    return `${intro("Pengumuman & maintenance", "Tampilkan informasi pada akun sekolah atau hentikan akses sementara.", `<button class="primary" data-action="add-announcement">＋ Pengumuman</button>`)}
      ${panel("Mode maintenance", `<form id="maintenanceForm"><label class="check-option"><input type="checkbox" name="enabled" ${settings.maintenance?.enabled ? "checked" : ""}>Aktifkan maintenance dan blokir akses akun sekolah</label>${textarea("Pesan maintenance", "message", settings.maintenance?.message || "")}<div class="modal-actions"><button class="primary">Simpan maintenance</button></div></form>`)}
      ${panel("Daftar pengumuman", table(["Konten", "Status", "Tanggal", "Aksi"], rows, "Belum ada pengumuman."))}`;
  }
  function announcementModal() {
    showModal("Pengumuman baru", "Pengumuman aktif akan terlihat di akun sekolah.", `<form id="announcementForm">${field("Judul", "title", "", "text", "required maxlength=140")}${textarea("Isi pengumuman", "message", "", "required rows=5")}<div class="modal-actions"><button type="button" class="secondary" data-modal-close>Batal</button><button class="primary">Terbitkan</button></div></form>`);
    $("#announcementForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const entry = { id: crypto.randomUUID(), title: form.elements.title.value.trim(), message: form.elements.message.value.trim(), active: true, createdAt: new Date().toISOString() };
      try { await savePlatform({ announcements: [entry, ...(data.announcements || [])] }); closeModal(); }
      catch (error) { toast(error.message, true); }
    });
  }
  function manualsView() {
    const rows = (data.manuals || []).map((item) => `<tr><td><b>${esc(item.title)}</b><span class="subtext">${esc(item.url || "")}</span></td><td>${esc(item.type || "Link")}</td><td>${esc(item.target || "Akun Sekolah")}</td><td>${statusBadge(item.active === false ? "Nonaktif" : "Aktif")}</td><td><button class="action-btn" data-manual-toggle="${esc(item.id)}">${item.active === false ? "Aktifkan" : "Nonaktifkan"}</button><button class="action-btn" data-manual-delete="${esc(item.id)}">Hapus</button></td></tr>`).join("");
    return `${intro("Petunjuk pengguna", "Tambahkan tautan PDF atau video agar dapat dibuka di dalam aplikasi sekolah.", `<button class="primary" data-action="add-manual">＋ Tambah petunjuk</button>`)}${panel("Konten bantuan", table(["Judul / URL", "Tipe", "Tampilan", "Status", "Aksi"], rows, "Belum ada petunjuk."))}`;
  }
  function manualModal() {
    showModal("Tambah petunjuk pengguna", "Gunakan URL PDF, video, atau tautan embed yang aman.", `<form id="manualForm">${field("Judul", "title", "", "text", "required maxlength=160")}${field("URL PDF / video", "url", "", "url", "required")}${selectField("Jenis konten", "type", "embed", [["embed", "Embed di aplikasi"], ["link", "Tautan"]])}${selectField("Tampilkan untuk", "target", "Akun Sekolah", [["Akun Sekolah", "Akun Sekolah"], ["Super Admin", "Super Admin"]])}<div class="modal-actions"><button type="button" class="secondary" data-modal-close>Batal</button><button class="primary">Simpan petunjuk</button></div></form>`);
    $("#manualForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const entry = { id: crypto.randomUUID(), title: form.elements.title.value.trim(), url: form.elements.url.value.trim(), type: form.elements.type.value, target: form.elements.target.value, active: true };
      try { await savePlatform({ manuals: [entry, ...(data.manuals || [])] }); closeModal(); }
      catch (error) { toast(error.message, true); }
    });
  }
  function auditView() {
    const rows = (data.auditLogs || []).map((log) => `<tr><td>${date(log.createdAt)}</td><td>${esc(log.actor || "—")}</td><td>${esc(log.action || "—")}</td><td>${esc(log.detail || "—")}</td><td>${esc(log.schoolName || (log.schoolId ? data.schools.find((s) => s.id === log.schoolId)?.name : "") || "Platform")}</td></tr>`).join("");
    return `${intro("Audit logs", "Jejak perubahan platform dan aktivitas yang direkam dari tenant sekolah.")}${panel("Riwayat aktivitas", table(["Waktu", "Aktor", "Aktivitas", "Detail", "Sekolah"], rows, "Belum ada aktivitas."))}`;
  }
  function whatsappView() {
    const wa = data.settings.whatsapp || {};
    return `${intro("WhatsApp Gateway", "Gunakan Fonnte untuk mengirim pesan uji dan menghubungkan notifikasi WhatsApp sekolah.")}<div class="grid-2">
      ${panel("Konfigurasi Fonnte", `<form id="whatsappForm">${field("Token API Fonnte", "fonnteToken", "", "password", "autocomplete=new-password") }<p class="help-text">${wa.configured ? "Token Fonnte tersimpan terenkripsi. Kosongkan untuk mempertahankan token." : "Token Fonnte belum disimpan."}</p><label class="check-option"><input type="checkbox" name="registrationOtpEnabled" ${wa.registrationOtpEnabled ? "checked" : ""}>Wajibkan kode OTP WhatsApp untuk pendaftaran sekolah</label><p class="help-text">Pendaftar harus memverifikasi nomor WhatsApp sebelum tenant dibuat. Fonnte wajib dikonfigurasi terlebih dahulu.</p><div class="modal-actions"><button class="primary">Simpan konfigurasi</button></div></form>`)}
      ${panel("Kirim pesan uji", `<form id="whatsappSendForm">${field("Nomor tujuan (internasional)", "to", "", "tel", "placeholder=6281234567890 required")}${textarea("Pesan", "text", "Informasi layanan Sarprah.", "required maxlength=4000")}<div class="modal-actions"><button class="secondary">Kirim pesan</button></div></form>`)}</div>`;
  }
  function backupView() {
    return `${intro("Backup & restore", "Cadangkan atau pulihkan konfigurasi SaaS, data tenant, dan audit logs.")}<div class="grid-2">
      ${panel("Backup platform", `<p class="help-text">Backup mencakup data sekolah, konfigurasi, tiket, paket, dan audit logs. Simpan file dengan aman.</p><button class="primary" data-action="download-backup">Unduh backup lengkap</button>`)}
      ${panel("Restore platform", `<div class="danger-zone"><p class="help-text">Restore akan mengganti seluruh data platform dan mengakhiri sesi pengguna sekolah. Buat backup sebelum melanjutkan.</p><form id="restoreForm"><label class="field">File backup SaaS (.json)<input name="file" type="file" accept="application/json,.json" required></label><label class="check-option"><input name="confirmed" type="checkbox" required>Saya memahami restore akan mengganti seluruh data platform</label><div class="modal-actions"><button class="danger">Pulihkan backup</button></div></form></div>`)}</div>
      ${panel("Auto backup Telegram", `<p class="help-text">Kirim backup lengkap seluruh platform dan sekolah secara otomatis setiap hari. Server harus tetap aktif pada waktu terjadwal.</p>
        <form id="platformTelegramBackupForm"><div class="form-grid">
          ${field("Chat ID atau username tujuan", "chatId", "", "text", "required placeholder=-1001234567890")}
          ${field("Token Bot Telegram", "botToken", "", "password", "autocomplete=new-password placeholder=123456:token")}
          ${field("Jam backup harian", "backupTime", "16:00", "time", "required")}
          ${selectField("Zona waktu", "timezone", "Asia/Jakarta", [["Asia/Jakarta", "WIB — Asia/Jakarta"], ["Asia/Makassar", "WITA — Asia/Makassar"], ["Asia/Jayapura", "WIT — Asia/Jayapura"]])}
          ${textarea("Teks pesan uji koneksi", "testMessage", "Uji koneksi auto backup Telegram Sarprah SaaS berhasil.", "rows=3 maxlength=4000 required")}
        </div><label class="check-option"><input type="checkbox" name="enabled">Aktifkan auto backup Telegram Super Admin</label>
        <p id="platformTelegramTokenStatus" class="help-text">Token bot disimpan terenkripsi dan tidak ditampilkan kembali.</p>
        <p id="platformTelegramBackupStatus" class="help-text">Memuat status backup...</p>
        <p class="help-text">Pesan ini hanya dikirim saat Uji koneksi digunakan dan tidak mengubah pesan backup otomatis.</p>
        <div class="modal-actions"><button type="button" class="secondary" data-action="test-platform-telegram">Uji koneksi</button><button class="primary">Simpan pengaturan backup</button></div></form>`)}`;
  }

  async function loadPlatformTelegramBackup() {
    try {
      const config = await api("/api/platform/telegram-backup");
      const form = $("#platformTelegramBackupForm");
      if (view !== "backup" || !form) return;
      form.elements.chatId.value = config.chatId || "";
      form.elements.backupTime.value = config.backupTime || "16:00";
      form.elements.timezone.value = config.timezone || "Asia/Jakarta";
      form.elements.enabled.checked = Boolean(config.enabled);
      form.elements.botToken.placeholder = config.tokenConfigured
        ? "Token tersimpan (kosongkan untuk mempertahankan)"
        : "Token bot Telegram dari @BotFather";
      $("#platformTelegramTokenStatus").textContent = config.tokenConfigured
        ? "Token bot tersimpan terenkripsi. Isi hanya jika ingin menggantinya."
        : "Token bot belum disimpan. Token tidak pernah ditampilkan kembali.";
      $("#platformTelegramBackupStatus").textContent = config.enabled
        ? `Backup otomatis aktif setiap hari pukul ${config.backupTime} (${config.timezone}).`
        : "Backup otomatis nonaktif. Pengaturan jadwal akan tersimpan tanpa mengirim backup.";
    } catch (error) {
      if ($("#platformTelegramBackupStatus")) {
        $("#platformTelegramBackupStatus").textContent = "Status backup tidak dapat dimuat.";
        toast(error.message, true);
      }
    }
  }
  function renderView() {
    const entry = nav.find(([key]) => key === view);
    if (!entry || !data) return;
    $("#pageTitle").textContent = entry[1];
    renderNav();
    const content = {
      overview: dashboard, schools: schoolsView, payments: paymentsView, billing: billingView, plans: plansView,
      profile: profileView, defaultMenus: defaultMenusView, branding: brandingView, pricing: pricingView,
      terms: termsView, tickets: ticketsView, announcements: announcementsView, manuals: manualsView,
      audit: auditView, whatsapp: whatsappView, backup: backupView
    }[view]();
    $("#platformContent").innerHTML = content;
    bindViewForms();
    if (view === "backup") loadPlatformTelegramBackup();
    if (view === "audit") {
      api("/api/platform/audit").then((result) => {
        data.auditLogs = result.logs || [];
        if (view === "audit") $("#platformContent").innerHTML = auditView();
      }).catch((error) => toast(error.message, true));
    }
  }
  function showModal(title, subtitle, content) {
    const modal = $("#platformModal");
    modal.innerHTML = `<section class="modal-card"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="modal-close" data-modal-close aria-label="Tutup">×</button></div>${content}</section>`;
    modal.classList.remove("hidden");
  }
  function closeModal() {
    $("#platformModal").classList.add("hidden");
    $("#platformModal").innerHTML = "";
  }
  async function readImage(file) {
    if (!file) return "";
    if (file.size > 2_000_000) throw new Error("Ukuran gambar maksimal 2 MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
      reader.readAsDataURL(file);
    });
  }
  function bindViewForms() {
    $("#schoolSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      const schools = (data.schools || []).filter((s) => `${s.name} ${s.code} ${s.email}`.toLowerCase().includes(query));
      const body = $("#schoolSearch").closest(".panel").querySelector("tbody");
      body.innerHTML = schoolRows(schools) || `<tr><td class="empty" colspan="6">Sekolah tidak ditemukan.</td></tr>`;
    });
    $("#defaultMenusForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const defaultMenus = new FormData(event.currentTarget).getAll("features");
      savePlatform({ settings: { ...data.settings, defaultMenus } }).catch((error) => toast(error.message, true));
    });
    $("#brandingForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const logo = await readImage(form.elements.logoFile.files[0]);
        const branding = { ...data.settings.branding, appName: form.elements.appName.value.trim(), tagline: form.elements.tagline.value.trim(), ...(logo ? { logo } : {}) };
        await savePlatform({ settings: { ...data.settings, branding } });
      } catch (error) { toast(error.message, true); }
    });
    $("#pricingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const settings = { ...data.settings, pricing: { monthly: Number(form.elements.monthly.value), semester: Number(form.elements.semester.value), yearly: Number(form.elements.yearly.value) }, trialDays: Number(form.elements.trialDays.value) };
      savePlatform({ settings }).catch((error) => toast(error.message, true));
    });
    $("#qrisForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const qrisImage = await readImage(event.currentTarget.elements.qrisFile.files[0]);
        if (!qrisImage && !data.settings.qrisImage) throw new Error("Pilih gambar QRIS terlebih dahulu.");
        await savePlatform({ settings: { ...data.settings, qrisImage: qrisImage || data.settings.qrisImage } });
      } catch (error) { toast(error.message, true); }
    });
    document.querySelectorAll("[data-gateway-form]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const provider = form.dataset.gatewayForm;
      const payload = {
        enabled: form.elements.enabled.checked,
        environment: form.elements.environment.value
      };
      if (provider === "kasera") {
        payload.apiKey = form.elements.apiKey.value.trim();
        payload.webhookSecret = form.elements.webhookSecret.value.trim();
      } else if (provider === "xendit") {
        payload.secretKey = form.elements.secretKey.value.trim();
        payload.callbackToken = form.elements.callbackToken.value.trim();
      } else {
        payload.merchantCode = form.elements.merchantCode.value.trim();
        payload.apiKey = form.elements.apiKey.value.trim();
      }
      try {
        const result = await api(`/api/platform/payment-gateways/${provider}`, "PUT", payload);
        data.settings.paymentGateways = { ...(data.settings.paymentGateways || {}), [provider]: result.gateway };
        toast(`${provider} berhasil diperbarui.`);
        renderView();
      } catch (error) { toast(error.message, true); }
    }));
    $("#termsForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      savePlatform({ settings: { ...data.settings, terms: form.elements.terms.value, sla: form.elements.sla.value } }).catch((error) => toast(error.message, true));
    });
    $("#maintenanceForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      savePlatform({ settings: { ...data.settings, maintenance: { enabled: form.elements.enabled.checked, message: form.elements.message.value.trim() } } }).catch((error) => toast(error.message, true));
    });
    $("#profileForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim() };
      if (form.elements.currentPassword.value || form.elements.newPassword.value) Object.assign(body, { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value });
      try { const result = await api("/api/platform/profile", "PUT", body); admin = { ...admin, ...result.user }; $("#adminName").textContent = admin.name; toast("Profil diperbarui."); }
      catch (error) { toast(error.message, true); }
    });
    $("#whatsappForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/platform/whatsapp", "PUT", {
          fonnteToken: form.elements.fonnteToken.value.trim(),
          registrationOtpEnabled: form.elements.registrationOtpEnabled.checked
        });
        data.settings.whatsapp = { configured: result.configured, registrationOtpEnabled: result.registrationOtpEnabled };
        toast("Konfigurasi Fonnte dan OTP pendaftaran disimpan.");
        renderView();
      } catch (error) { toast(error.message, true); }
    });
    $("#whatsappSendForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try { await api("/api/platform/whatsapp/send", "POST", { to: form.elements.to.value, text: form.elements.text.value }); toast("Pesan WhatsApp berhasil dikirim."); }
      catch (error) { toast(error.message, true); }
    });
    $("#platformTelegramBackupForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/platform/telegram-backup", "PUT", {
          chatId: form.elements.chatId.value.trim(),
          botToken: form.elements.botToken.value.trim(),
          backupTime: form.elements.backupTime.value,
          timezone: form.elements.timezone.value,
          enabled: form.elements.enabled.checked
        });
        form.elements.botToken.value = "";
        await loadPlatformTelegramBackup();
        toast(result.enabled ? "Auto backup Telegram Super Admin aktif." : "Pengaturan auto backup Telegram disimpan.");
      } catch (error) { toast(error.message, true); }
    });
    $("#restoreForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!window.confirm("Restore akan mengganti data platform. Lanjutkan?")) return;
      try {
        const file = event.currentTarget.elements.file.files[0];
        const backup = JSON.parse(await file.text());
        await api("/api/platform/restore", "POST", backup);
        toast("Backup berhasil dipulihkan.");
        await refreshData();
      } catch (error) { toast(error.message || "File backup tidak valid.", true); }
    });
  }
  function openTicketModal(schoolId, ticketId) {
    const ticket = (data.tickets || []).find((t) => t.id === ticketId && t.schoolId === schoolId);
    if (!ticket) return toast("Tiket tidak ditemukan.", true);
    showModal("Tanggapi tiket kendala", `${ticket.schoolName || ""} · ${ticket.schoolCode || ""}`, `<div class="panel"><b>${esc(ticket.title || ticket.ticketNo || "Tiket")}</b><p class="help-text">${esc(ticket.description || ticket.message || "")}</p></div><form id="ticketForm">
      ${selectField("Status", "status", ticket.status || "Diproses", [["Diajukan", "Diajukan"], ["Diproses", "Diproses"], ["Selesai", "Selesai"], ["Ditolak", "Ditolak"]])}${textarea("Balasan untuk sekolah", "reply", ticket.adminReply || "", "rows=5")}
      <div class="modal-actions"><button type="button" class="secondary" data-modal-close>Tutup</button><button class="primary">Kirim tanggapan</button></div></form>`);
    $("#ticketForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await api(`/api/platform/tickets/${encodeURIComponent(schoolId)}/${encodeURIComponent(ticketId)}`, "PUT", { status: form.elements.status.value, reply: form.elements.reply.value });
        closeModal(); await refreshData(); toast("Tiket berhasil diperbarui.");
      } catch (error) { toast(error.message, true); }
    });
  }
  async function handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.view) {
      view = button.dataset.view;
      renderView();
      $("#platformSidebar")?.classList.remove("open");
    }
    if (button.matches("[data-school-detail]")) openSchoolDetail(button.dataset.schoolDetail);
    if (button.matches("[data-action=refresh]")) refreshData().catch((error) => toast(error.message, true));
    if (button.matches("[data-action=add-school]")) addSchoolModal();
    if (button.matches("[data-action=add-plan]")) planModal();
    if (button.dataset.planEdit) planModal(data.plans.find((p) => p.id === button.dataset.planEdit));
    if (button.matches("[data-action=run-billing]")) {
      try { const result = await api("/api/platform/billing/run", "POST", {}); await refreshData(); toast(`${result.created} tagihan dibuat; ${result.reminders} pengingat diperiksa.`); }
      catch (error) { toast(error.message, true); }
    }
    if (button.dataset.payment) {
      if (!window.confirm(`Ubah status pembayaran menjadi ${button.dataset.paymentStatus}?`)) return;
      try { await api(`/api/platform/payments/${encodeURIComponent(button.dataset.payment)}`, "PUT", { status: button.dataset.paymentStatus }); await refreshData(); toast("Status pembayaran diperbarui."); }
      catch (error) { toast(error.message, true); }
    }
    if (button.dataset.ticketReply) {
      const schoolId = button.dataset.schoolId || detail?.school?.id || (data.tickets || []).find((t) => t.id === button.dataset.ticketReply)?.schoolId;
      if (schoolId) openTicketModal(schoolId, button.dataset.ticketReply);
    }
    if (button.matches("[data-action=add-announcement]")) announcementModal();
    if (button.matches("[data-action=add-manual]")) manualModal();
    if (button.matches("[data-action=test-platform-telegram]")) {
      const text = $("#platformTelegramBackupForm").elements.testMessage.value.trim();
      if (!text) return toast("Isi teks pesan uji koneksi terlebih dahulu.", true);
      try { await api("/api/platform/telegram-backup/test", "POST", { text }); toast("Pesan uji berhasil dikirim ke Telegram Super Admin."); }
      catch (error) { toast(error.message, true); }
    }
    if (button.dataset.announcementToggle || button.dataset.announcementDelete) {
      const id = button.dataset.announcementToggle || button.dataset.announcementDelete;
      const announcements = (data.announcements || []).flatMap((a) => a.id !== id ? [a] : button.dataset.announcementDelete ? [] : [{ ...a, active: a.active === false }]);
      savePlatform({ announcements }).catch((error) => toast(error.message, true));
    }
    if (button.dataset.manualToggle || button.dataset.manualDelete) {
      const id = button.dataset.manualToggle || button.dataset.manualDelete;
      const manuals = (data.manuals || []).flatMap((a) => a.id !== id ? [a] : button.dataset.manualDelete ? [] : [{ ...a, active: a.active === false }]);
      savePlatform({ manuals }).catch((error) => toast(error.message, true));
    }
    if (button.matches("[data-action=download-backup]")) {
      try {
        const response = await fetch("/api/platform/backup", { credentials: "same-origin" });
        if (!response.ok) throw new Error("Backup platform gagal diunduh.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `sarprah-saas-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click(); URL.revokeObjectURL(url);
      } catch (error) { toast(error.message, true); }
    }
    if (button.matches("[data-modal-close]") || event.target === $("#platformModal")) closeModal();
    if (button.matches("#platformLogout")) {
      try { await api("/api/platform/logout", "POST", {}); } catch {}
      $("#platform").classList.add("hidden");
      showGate();
    }
    if (button.matches("#mobileNavToggle")) $("#platformNav").parentElement.classList.toggle("open");
  }
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  async function init() {
    try {
      applyPlatformBranding(await api("/api/branding"));
      const status = await api("/api/platform/setup-status");
      if (!status.configured) return showGate({ setup: true });
      await openPlatform();
    } catch (error) { showGate({ message: error.message }); }
  }
  init();
})();
