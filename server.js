const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const publicRoot = path.resolve(root);
const port = Number(process.env.PORT || 3000);
const dbPath = path.resolve(process.env.DB_PATH || path.join(root, "sarprah.sqlite"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

function loadEncryptionKey() {
  const configured = process.env.SARPRAH_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[\da-f]{64}$/i.test(configured)) throw new Error("SARPRAH_ENCRYPTION_KEY harus berisi 64 karakter hexadecimal.");
    return Buffer.from(configured, "hex");
  }
  const keyPath = path.join(path.dirname(dbPath), ".sarprah-key");
  if (fs.existsSync(keyPath)) {
    const key = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
    if (key.length !== 32) throw new Error("Kunci enkripsi Sarprah tidak valid.");
    return key;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, `${key.toString("base64")}\n`, { mode: 0o600, flag: "wx" });
  return key;
}

const encryptionKey = loadEncryptionKey();
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS telegram_backup (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    chat_id TEXT NOT NULL DEFAULT '',
    token_cipher TEXT NOT NULL DEFAULT '',
    backup_time TEXT NOT NULL DEFAULT '16:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run_date TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO telegram_backup (id) VALUES (1);
`);
const getState = db.prepare("SELECT payload FROM app_state WHERE id = 1");
const saveState = db.prepare(`
  INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);
const getTelegramConfig = db.prepare("SELECT * FROM telegram_backup WHERE id = 1");
const saveTelegramConfig = db.prepare(`
  UPDATE telegram_backup SET chat_id = ?, token_cipher = ?, backup_time = ?, timezone = ?, enabled = ?
  WHERE id = 1
`);
const setLastRun = db.prepare("UPDATE telegram_backup SET last_run_date = ? WHERE id = 1");
const createSession = db.prepare("INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)");
const getSession = db.prepare("SELECT account_id, expires_at FROM auth_sessions WHERE token_hash = ?");
const deleteSession = db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?");
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".ico": "image/x-icon"
};
const timezones = new Set(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Bangkok"]);

function send(res, status, body, type = "application/json; charset=utf-8", headers = {}) {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...headers });
  res.end(body);
}

function encryptToken(token) {
  if (!token) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

function decryptToken(value) {
  if (!value) return "";
  try {
    const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Token Telegram tidak dapat dibuka. Periksa SARPRAH_ENCRYPTION_KEY atau file .sarprah-key.");
  }
}

function currentState() {
  const row = getState.get();
  return row ? JSON.parse(row.payload) : null;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), 210000, 32, "sha256").toString("hex");
}

function sessionFromRequest(req) {
  const rawCookie = req.headers.cookie || "";
  const token = rawCookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("sarprah_session="))?.slice("sarprah_session=".length);
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = getSession.get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) deleteSession.run(tokenHash);
    return null;
  }
  const account = currentState()?.accounts?.find((row) => row.id === session.account_id && row.active);
  return account ? { tokenHash, account } : null;
}

function setSessionCookie(res, token, req, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);
  res.setHeader("Set-Cookie", `sarprah_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

function verifyOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function createBackup() {
  const state = currentState();
  if (!state) throw new Error("Data aplikasi belum tersedia untuk di-backup.");
  return {
    app: "Sarprah",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    state
  };
}

function validateBackup(value) {
  const state = value && typeof value === "object" && !Array.isArray(value) ? value.state : null;
  if (!state || typeof state !== "object" || Array.isArray(state) ||
      !Array.isArray(state.goods) || !Array.isArray(state.items) ||
      !Array.isArray(state.accounts) || state.accounts.filter((account) => account.role === "Administrator").length !== 1 ||
      !state.school || typeof state.school !== "object") {
    throw new Error("File backup tidak valid atau formatnya tidak didukung.");
  }
  return state;
}

function getLocalDateParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, value]));
}

async function telegramRequest(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  let result;
  try { result = await response.json(); } catch { throw new Error(`Telegram API mengirim respons tidak valid (HTTP ${response.status}).`); }
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API gagal (HTTP ${response.status}).`);
  return result;
}

async function sendTelegramBackup(config) {
  const token = decryptToken(config.token_cipher);
  if (!token || !config.chat_id) throw new Error("ID Telegram dan token bot belum diisi.");
  const backup = createBackup();
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const form = new FormData();
  form.append("chat_id", config.chat_id);
  form.append("document", file, `sarprah-backup-${backup.createdAt.slice(0, 10)}.json`);
  form.append("caption", `Backup Sarprah · ${backup.createdAt}`);
  await telegramRequest(token, "sendDocument", form);
}

async function readJsonBody(req, maxBytes = 5_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Ukuran data melebihi batas 5 MB.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("Data JSON tidak valid."); }
}

async function handleApi(req, res) {
  if (req.method !== "GET" && !verifyOrigin(req)) return send(res, 403, JSON.stringify({ error: "Origin permintaan tidak diizinkan." }));
  if (req.method === "GET" && req.url === "/api/auth/session") {
    const session = sessionFromRequest(req);
    if (!session) return send(res, 200, JSON.stringify({ user: null }));
    return send(res, 200, JSON.stringify({ user: { id: session.account.id, name: session.account.name, role: session.account.role } }));
  }
  if (req.method === "POST" && req.url === "/api/auth/login") {
    const input = await readJsonBody(req, 32_000);
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const state = currentState();
    let account = state?.accounts?.find((row) => row.email.toLowerCase() === email && row.active);
    const isDemoAdmin = email === "admin@sarprah.id" && password === "sarprah123";
    let valid = Boolean(account && account.passwordSalt && account.passwordHash && hashPassword(password, account.passwordSalt) === account.passwordHash);
    if (!valid && account && !account.passwordHash && isDemoAdmin && account.role === "Administrator") {
      account.passwordSalt = crypto.randomBytes(16).toString("hex");
      account.passwordHash = hashPassword(password, account.passwordSalt);
      saveState.run(JSON.stringify(state));
      valid = true;
    }
    if (!account && !state && isDemoAdmin) account = { id: "ac1", name: "Admin Sekolah", role: "Administrator" }, valid = true;
    if (!valid || !account) return send(res, 401, JSON.stringify({ error: "Email atau kata sandi tidak sesuai." }));
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 7 * 86400_000;
    createSession.run(crypto.createHash("sha256").update(token).digest("hex"), account.id, expiresAt);
    setSessionCookie(res, token, req, 7 * 86400);
    return send(res, 200, JSON.stringify({ user: { id: account.id, name: account.name, role: account.role } }));
  }
  if (req.method === "POST" && req.url === "/api/auth/logout") {
    const session = sessionFromRequest(req);
    if (session) deleteSession.run(session.tokenHash);
    setSessionCookie(res, "", req, 0);
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  const session = sessionFromRequest(req);
  if (!session) return send(res, 401, JSON.stringify({ error: "Silakan masuk untuk melanjutkan." }));
  if (!verifyOrigin(req)) return send(res, 403, JSON.stringify({ error: "Origin permintaan tidak diizinkan." }));
  if (req.url.startsWith("/api/telegram/") && session.account.role !== "Administrator") {
    return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat mengelola backup Telegram." }));
  }
  if (["GET /api/backup", "POST /api/restore"].includes(`${req.method} ${req.url}`) && session.account.role !== "Administrator") {
    return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat melakukan backup dan restore." }));
  }
  if (req.method === "GET" && req.url === "/api/state") {
    return send(res, 200, JSON.stringify({ state: currentState() }));
  }
  if (req.method === "PUT" && req.url === "/api/state") {
    const parsed = await readJsonBody(req);
    if (!parsed || typeof parsed.state !== "object" || parsed.state === null || Array.isArray(parsed.state)) {
      return send(res, 400, JSON.stringify({ error: "Format data tidak valid." }));
    }
    if (!Array.isArray(parsed.state.accounts) || parsed.state.accounts.filter((account) => account.role === "Administrator").length !== 1) {
      return send(res, 400, JSON.stringify({ error: "Data harus memiliki tepat satu akun Administrator." }));
    }
    saveState.run(JSON.stringify(parsed.state));
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && req.url === "/api/backup") {
    const backup = createBackup();
    return send(res, 200, JSON.stringify(backup), "application/json; charset=utf-8", {
      "Content-Disposition": `attachment; filename="sarprah-backup-${backup.createdAt.slice(0, 10)}.json"`
    });
  }
  if (req.method === "POST" && req.url === "/api/restore") {
    const state = validateBackup(await readJsonBody(req));
    saveState.run(JSON.stringify(state));
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && req.url === "/api/telegram/settings") {
    const config = getTelegramConfig.get();
    return send(res, 200, JSON.stringify({
      chatId: config.chat_id,
      backupTime: config.backup_time,
      timezone: config.timezone,
      enabled: Boolean(config.enabled),
      tokenConfigured: Boolean(config.token_cipher)
    }));
  }
  if (req.method === "PUT" && req.url === "/api/telegram/settings") {
    const input = await readJsonBody(req, 32_000);
    const config = getTelegramConfig.get();
    const chatId = String(input.chatId || "").trim();
    const backupTime = String(input.backupTime || "16:00");
    const timezone = String(input.timezone || "Asia/Jakarta");
    const token = String(input.botToken || "").trim();
    if (chatId && !/^-?\d{5,20}$/.test(chatId)) throw new Error("ID Telegram harus berupa angka (chat ID), termasuk tanda minus untuk grup.");
    if (token && !/^\d{6,15}:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error("Format token bot Telegram tidak valid.");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(backupTime)) throw new Error("Jam backup harus berformat HH:MM.");
    if (!timezones.has(timezone)) throw new Error("Zona waktu tidak didukung.");
    const tokenCipher = token ? encryptToken(token) : config.token_cipher;
    const enabled = Boolean(input.enabled);
    if (enabled && (!chatId || !tokenCipher)) throw new Error("Isi ID Telegram dan token bot sebelum mengaktifkan auto backup.");
    saveTelegramConfig.run(chatId, tokenCipher, backupTime, timezone, enabled ? 1 : 0);
    const updated = getTelegramConfig.get();
    return send(res, 200, JSON.stringify({
      ok: true,
      chatId: updated.chat_id,
      backupTime: updated.backup_time,
      timezone: updated.timezone,
      enabled: Boolean(updated.enabled),
      tokenConfigured: Boolean(updated.token_cipher)
    }));
  }
  if (req.method === "POST" && req.url === "/api/telegram/test") {
    const config = getTelegramConfig.get();
    const token = decryptToken(config.token_cipher);
    if (!config.chat_id || !token) throw new Error("Simpan ID Telegram dan token bot terlebih dahulu.");
    const result = await telegramRequest(token, "sendMessage", JSON.stringify({
      chat_id: config.chat_id,
      text: "Koneksi Telegram Sarprah berhasil. Backup otomatis siap dijalankan."
    }));
    return send(res, 200, JSON.stringify({ ok: true, messageId: result.result.message_id }));
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      const handled = await handleApi(req, res);
      if (handled !== false) return;
      return send(res, 404, JSON.stringify({ error: "API tidak ditemukan." }));
    }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(publicRoot, requested);
    if (!file.startsWith(publicRoot + path.sep) && file !== path.join(publicRoot, "index.html")) {
      return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    }
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
      const type = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
      res.end(data);
    });
  } catch (error) {
    const isInputError = error.message && !error.stack?.includes("node:internal");
    send(res, isInputError ? 400 : 500, JSON.stringify({ error: error.message || "Terjadi kesalahan server." }));
  }
});

async function runTelegramBackupIfDue() {
  const config = getTelegramConfig.get();
  if (!config.enabled) return;
  const local = getLocalDateParts(config.timezone);
  const date = `${local.year}-${local.month}-${local.day}`;
  if (`${local.hour}:${local.minute}` !== config.backup_time || config.last_run_date === date) return;
  setLastRun.run(date);
  try {
    await sendTelegramBackup(config);
    console.log(`Backup Telegram berhasil (${date}, ${config.timezone}).`);
  } catch (error) {
    setLastRun.run("");
    console.error(`Backup Telegram gagal: ${error.message}`);
  }
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Sarprah siap di http://localhost:${port}`);
});
setInterval(() => { runTelegramBackupIfDue().catch((error) => console.error(`Scheduler backup gagal: ${error.message}`)); }, 15_000);
