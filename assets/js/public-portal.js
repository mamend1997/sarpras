(() => {
  const code = (/^\/portal\/([A-Z0-9]{4})\/?$/i.exec(location.pathname)?.[1]
    || new URLSearchParams(location.search).get("code") || "").toUpperCase();
  const $ = (selector) => document.querySelector(selector);
  const search = $("#inventorySearch");
  const resultRoot = $("#inventoryResults");
  const detailRoot = $("#inventoryDetail");
  const countRoot = $("#resultCount");
  const suggestionRoot = $("#inventorySuggestions");
  const scanMessage = $("#scanMessage");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let scannerStream = null;
  let scannerTimer = 0;
  let detector = null;
  let suggestionGoods = [];
  let latestSearchQuery = "";

  function closeSuggestions() {
    suggestionRoot.hidden = true;
    search.setAttribute("aria-expanded", "false");
  }

  function renderSuggestions(rows, query) {
    if (query.trim().length < 3) {
      suggestionGoods = [];
      closeSuggestions();
      return;
    }
    suggestionGoods = rows.slice(0, 8);
    suggestionRoot.innerHTML = suggestionGoods.length
      ? suggestionGoods.map((good, index) => `<button class="public-search-suggestion" type="button" role="option" data-public-suggestion="${index}"><b>${escapeHtml(good.name)}</b><small>${escapeHtml([good.category, good.type, good.unit].filter(Boolean).join(" · ") || "Data Barang")} · ${Number(good.available) || 0} tersedia</small></button>`).join("")
      : `<div class="public-search-suggestion-empty" role="option" aria-disabled="true">Tidak ada barang yang cocok.</div>`;
    suggestionRoot.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function showMessage(message, isError = false) {
    resultRoot.innerHTML = `<div class="public-message ${isError ? "is-error" : ""}">${escapeHtml(message)}</div>`;
    countRoot.textContent = "";
  }

  function renderGoods(rows) {
    countRoot.textContent = `${rows.length}${rows.length === 500 ? "+" : ""} barang`;
    if (!rows.length) {
      showMessage("Barang tidak ditemukan. Periksa kata kunci atau kode QR, lalu coba kembali.");
      return;
    }
    resultRoot.innerHTML = rows.map((good, index) => {
      const locationSummary = Array.isArray(good.locations) && good.locations.length
        ? good.locations.map((entry) => `${entry.name || "Belum ditentukan"}: ${Number(entry.quantity) || 0}`).join(" · ")
        : `${good.location || "Belum ditentukan"}: ${Number(good.total) || 0}`;
      return `<article class="public-result-card">
        <div class="public-result-copy"><b>${escapeHtml(good.name)}</b><small>${escapeHtml([good.category, good.type, good.unit].filter(Boolean).join(" · ") || "Data Barang")}</small><small class="public-result-location">Lokasi &amp; jumlah: ${escapeHtml(locationSummary)}</small></div>
        <span class="public-result-stock">${Number(good.available) || 0} tersedia</span>
        <button type="button" data-public-good="${index}">Detail</button>
      </article>`;
    }).join("");
    resultRoot.querySelectorAll("[data-public-good]").forEach((button) => {
      button.addEventListener("click", () => renderDetail(rows[Number(button.dataset.publicGood)]));
    });
  }

  function renderDetail(good) {
    if (!good) return;
    const locations = Array.isArray(good.locations) && good.locations.length
      ? good.locations
      : [{ name: good.location || "Belum ditentukan", quantity: Number(good.total) || 0 }];
    detailRoot.innerHTML = `<h2>${escapeHtml(good.name)}</h2>
      <p class="public-detail-type">${escapeHtml([good.category, good.type, good.unit].filter(Boolean).join(" · ") || "Data Barang")}</p>
      <div class="public-stock-highlight"><span>Jumlah tersedia</span><strong>${Number(good.available) || 0}${good.unit ? ` <small>${escapeHtml(good.unit)}</small>` : ""}</strong></div>
      <div class="public-condition-list">
        ${locations.map((entry) => `<div class="public-condition-row"><span>${escapeHtml(entry.name || "Belum ditentukan")}</span><b>${Number(entry.quantity) || 0}${good.unit ? ` ${escapeHtml(good.unit)}` : ""}</b></div>`).join("")}
        <div class="public-condition-row"><span>Kondisi baik / dapat digunakan</span><b class="public-good">${Number(good.goodCondition) || 0}</b></div>
        <div class="public-condition-row"><span>Sedang dipinjam</span><b>${Number(good.borrowed) || 0}</b></div>
        <div class="public-condition-row"><span>Rusak</span><b class="public-damaged">${Number(good.damaged) || 0}</b></div>
        <div class="public-condition-row"><span>Hilang</span><b>${Number(good.missing) || 0}</b></div>
        <div class="public-condition-row"><span>Total barang</span><b>${Number(good.total) || 0}</b></div>
      </div>`;
  }

  async function loadGoods(query = "") {
    const requestedQuery = query.trim();
    latestSearchQuery = requestedQuery;
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      showMessage("Kode sekolah tidak valid. Buka tautan portal publik lengkap dari sekolah.", true);
      return;
    }
    resultRoot.innerHTML = `<div class="public-message">Memuat Data Barang…</div>`;
    try {
      const response = await fetch(`/api/public/school/${encodeURIComponent(code)}/inventory?q=${encodeURIComponent(requestedQuery)}`);
      const result = await response.json();
      if (requestedQuery !== latestSearchQuery || requestedQuery !== search.value.trim()) return;
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      $("#schoolName").textContent = result.school?.name || "Data Barang Sekolah";
      const goods = Array.isArray(result.goods) ? result.goods : [];
      renderGoods(goods);
      renderSuggestions(goods, requestedQuery);
      if (goods.length === 1 && requestedQuery) renderDetail(goods[0]);
    } catch (error) {
      if (requestedQuery !== latestSearchQuery || requestedQuery !== search.value.trim()) return;
      closeSuggestions();
      showMessage(error.message || "Data Barang tidak dapat dimuat.", true);
    }
  }

  function stopScanner(message) {
    window.clearTimeout(scannerTimer);
    if (scannerStream) scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
    $("#scannerVideo").srcObject = null;
    $("#scannerPanel").hidden = true;
    $("#stopScan").hidden = true;
    $("#startScan").hidden = false;
    if (message) scanMessage.textContent = message;
  }

  async function scanFrame() {
    if (!scannerStream || !detector) return;
    try {
      const codes = await detector.detect($("#scannerVideo"));
      if (codes.length && codes[0].rawValue) {
        search.value = codes[0].rawValue.trim();
        stopScanner("Kode terbaca. Mencari Data Barang…");
        await loadGoods(search.value);
        return;
      }
    } catch (error) {
      stopScanner(`Pemindaian gagal: ${error.message}`);
      return;
    }
    scannerTimer = window.setTimeout(scanFrame, 350);
  }

  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    closeSuggestions();
    loadGoods(search.value);
  });
  search.addEventListener("input", () => {
    window.clearTimeout(search._timer);
    if (search.value.trim().length < 3) closeSuggestions();
    search._timer = window.setTimeout(() => loadGoods(search.value), 250);
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSuggestions();
  });
  suggestionRoot.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-public-suggestion]")) event.preventDefault();
  });
  suggestionRoot.addEventListener("click", (event) => {
    const option = event.target.closest("[data-public-suggestion]");
    if (!option) return;
    const selected = suggestionGoods[Number(option.dataset.publicSuggestion)];
    if (!selected) return;
    search.value = selected.name;
    latestSearchQuery = search.value.trim();
    closeSuggestions();
    renderDetail(selected);
  });
  $("#searchForm").addEventListener("focusout", () => window.setTimeout(() => {
    if (!$("#searchForm").contains(document.activeElement)) closeSuggestions();
  }, 0));
  $("#startScan").addEventListener("click", async () => {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      scanMessage.textContent = "Pemindaian kamera tidak didukung di browser ini. Gunakan pencarian manual atau kamera perangkat yang mendukung BarcodeDetector.";
      return;
    }
    try {
      detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8"] });
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      $("#scannerVideo").srcObject = scannerStream;
      await $("#scannerVideo").play();
      $("#scannerPanel").hidden = false;
      $("#startScan").hidden = true;
      $("#stopScan").hidden = false;
      scanMessage.textContent = "Kamera aktif. Arahkan ke barcode barang.";
      scanFrame();
    } catch (error) {
      stopScanner(`Kamera tidak dapat dibuka: ${error.message}`);
    }
  });
  $("#stopScan").addEventListener("click", () => stopScanner("Pemindaian kamera dihentikan."));
  window.addEventListener("pagehide", () => stopScanner());
  loadGoods();
})();
