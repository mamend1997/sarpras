(() => {
  const code = (/^\/portal\/([A-Z0-9]{4})\/?$/i.exec(location.pathname)?.[1]
    || new URLSearchParams(location.search).get("code") || "").toUpperCase();
  const $ = (selector) => document.querySelector(selector);
  const search = $("#inventorySearch");
  const resultRoot = $("#inventoryResults");
  const detailRoot = $("#inventoryDetail");
  const countRoot = $("#resultCount");
  const scanMessage = $("#scanMessage");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let scannerStream = null;
  let scannerTimer = 0;
  let detector = null;

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
    resultRoot.innerHTML = rows.map((good, index) => `<article class="public-result-card">
      <div class="public-result-copy"><b>${escapeHtml(good.name)}</b><small>${escapeHtml([good.category, good.type, good.unit].filter(Boolean).join(" · ") || "Data Barang")}</small></div>
      <span class="public-result-stock">${Number(good.available) || 0} tersedia</span>
      <button type="button" data-public-good="${index}">Detail</button>
    </article>`).join("");
    resultRoot.querySelectorAll("[data-public-good]").forEach((button) => {
      button.addEventListener("click", () => renderDetail(rows[Number(button.dataset.publicGood)]));
    });
  }

  function renderDetail(good) {
    if (!good) return;
    detailRoot.innerHTML = `<h2>${escapeHtml(good.name)}</h2>
      <p class="public-detail-type">${escapeHtml([good.category, good.type, good.unit].filter(Boolean).join(" · ") || "Data Barang")}</p>
      <div class="public-stock-highlight"><span>Jumlah tersedia</span><strong>${Number(good.available) || 0}${good.unit ? ` <small>${escapeHtml(good.unit)}</small>` : ""}</strong></div>
      <div class="public-condition-list">
        <div class="public-condition-row"><span>Kondisi baik / dapat digunakan</span><b class="public-good">${Number(good.goodCondition) || 0}</b></div>
        <div class="public-condition-row"><span>Sedang dipinjam</span><b>${Number(good.borrowed) || 0}</b></div>
        <div class="public-condition-row"><span>Rusak</span><b class="public-damaged">${Number(good.damaged) || 0}</b></div>
        <div class="public-condition-row"><span>Hilang</span><b>${Number(good.missing) || 0}</b></div>
        <div class="public-condition-row"><span>Total barang</span><b>${Number(good.total) || 0}</b></div>
      </div>`;
  }

  async function loadGoods(query = "") {
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      showMessage("Kode sekolah tidak valid. Buka tautan portal publik lengkap dari sekolah.", true);
      return;
    }
    resultRoot.innerHTML = `<div class="public-message">Memuat Data Barang…</div>`;
    try {
      const response = await fetch(`/api/public/school/${encodeURIComponent(code)}/inventory?q=${encodeURIComponent(query.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      $("#schoolName").textContent = result.school?.name || "Data Barang Sekolah";
      renderGoods(Array.isArray(result.goods) ? result.goods : []);
      if (result.goods?.length === 1 && query.trim()) renderDetail(result.goods[0]);
    } catch (error) {
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
        stopScanner("Kode terbaca. Mencari inventaris…");
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
    loadGoods(search.value);
  });
  search.addEventListener("input", () => {
    window.clearTimeout(search._timer);
    search._timer = window.setTimeout(() => loadGoods(search.value), 250);
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
