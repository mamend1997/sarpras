(() => {
  const code = /^\/portal\/(\d{4})\/?$/.exec(location.pathname)?.[1]
    || new URLSearchParams(location.search).get("code") || "";
  const $ = (selector) => document.querySelector(selector);
  const search = $("#inventorySearch");
  const resultRoot = $("#inventoryResults");
  const detailRoot = $("#inventoryDetail");
  const countRoot = $("#resultCount");
  const scanMessage = $("#scanMessage");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let items = [];
  let scannerStream = null;
  let scannerTimer = 0;
  let detector = null;

  function showMessage(message, isError = false) {
    resultRoot.innerHTML = `<div class="public-message ${isError ? "is-error" : ""}">${escapeHtml(message)}</div>`;
    countRoot.textContent = "";
  }

  function renderItems(rows) {
    items = rows;
    countRoot.textContent = `${rows.length}${rows.length === 500 ? "+" : ""} barang`;
    if (!rows.length) {
      showMessage("Barang tidak ditemukan. Periksa kata kunci atau kode QR, lalu coba kembali.");
      return;
    }
    resultRoot.innerHTML = rows.map((item, index) => `<article class="public-result-card">
      <div class="public-result-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml([item.category, item.type, item.unit].filter(Boolean).join(" · ") || "Inventaris sekolah")}</small></div>
      <span class="public-result-stock">${Number(item.available) || 0} tersedia</span>
      <button type="button" data-public-item="${index}">Detail</button>
    </article>`).join("");
    resultRoot.querySelectorAll("[data-public-item]").forEach((button) => {
      button.addEventListener("click", () => renderDetail(rows[Number(button.dataset.publicItem)]));
    });
  }

  function renderDetail(item) {
    if (!item) return;
    detailRoot.innerHTML = `<h2>${escapeHtml(item.name)}</h2>
      <p class="public-detail-type">${escapeHtml([item.category, item.type, item.unit].filter(Boolean).join(" · ") || "Inventaris sekolah")}</p>
      <div class="public-stock-highlight"><span>Jumlah tersedia</span><strong>${Number(item.available) || 0}${item.unit ? ` <small>${escapeHtml(item.unit)}</small>` : ""}</strong></div>
      <div class="public-condition-list">
        <div class="public-condition-row"><span>Kondisi baik / dapat digunakan</span><b class="public-good">${Number(item.goodCondition) || 0}</b></div>
        <div class="public-condition-row"><span>Sedang dipinjam</span><b>${Number(item.borrowed) || 0}</b></div>
        <div class="public-condition-row"><span>Rusak</span><b class="public-damaged">${Number(item.damaged) || 0}</b></div>
        <div class="public-condition-row"><span>Total tercatat</span><b>${Number(item.total) || 0}</b></div>
      </div>`;
  }

  async function loadInventory(query = "") {
    if (!/^\d{4}$/.test(code)) {
      showMessage("Kode sekolah tidak valid. Buka tautan portal publik lengkap dari sekolah.", true);
      return;
    }
    resultRoot.innerHTML = `<div class="public-message">Memuat daftar inventaris…</div>`;
    try {
      const response = await fetch(`/api/public/school/${encodeURIComponent(code)}/inventory?q=${encodeURIComponent(query.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      $("#schoolName").textContent = result.school?.name || "Inventaris sekolah";
      renderItems(Array.isArray(result.items) ? result.items : []);
      if (result.items?.length === 1 && query.trim()) renderDetail(result.items[0]);
    } catch (error) {
      showMessage(error.message || "Data inventaris tidak dapat dimuat.", true);
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
        stopScanner("Kode terbaca. Mencari inventaris…");
        await loadInventory(search.value);
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
    loadInventory(search.value);
  });
  search.addEventListener("input", () => {
    window.clearTimeout(search._timer);
    search._timer = window.setTimeout(() => loadInventory(search.value), 250);
  });
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
      scanMessage.textContent = "Kamera aktif. Arahkan ke barcode atau QR item.";
      scanFrame();
    } catch (error) {
      stopScanner(`Kamera tidak dapat dibuka: ${error.message}`);
    }
  });
  $("#stopScan").addEventListener("click", () => stopScanner("Pemindaian kamera dihentikan."));
  window.addEventListener("pagehide", () => stopScanner());
  loadInventory();
})();
