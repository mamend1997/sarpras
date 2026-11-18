const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const publicRoot = path.resolve(root);
const port = Number(process.env.PORT || 3000);
const railwayDeployment = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_ID);
const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
const configuredDbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : "";
function isWithinDirectory(directory, target) {
  const relativePath = path.relative(directory, target);
  return relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}
let dbPath;
if (railwayVolumePath) {
  const volumeRoot = path.resolve(railwayVolumePath);
  if (configuredDbPath && isWithinDirectory(volumeRoot, configuredDbPath)) {
    dbPath = configuredDbPath;
  } else {
    if (configuredDbPath) console.warn("DB_PATH berada di luar Railway Volume; database akan disimpan di Volume.");
    dbPath = path.join(volumeRoot, "sarprah.sqlite");
  }
} else {
  dbPath = configuredDbPath || path.join(root, "sarprah.sqlite");
  if (railwayDeployment) {
    console.warn("Railway Volume belum terpasang. Tambahkan Volume dengan mount path /data agar login dan data sekolah tidak hilang saat redeploy.");
  }
}
dbPath = path.resolve(dbPath);
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
  CREATE TABLE IF NOT EXISTS saas_tenant_telegram_backup (
    school_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL DEFAULT '',
    token_cipher TEXT NOT NULL DEFAULT '',
    backup_time TEXT NOT NULL DEFAULT '16:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run_date TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS saas_platform_telegram_backup (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    chat_id TEXT NOT NULL DEFAULT '',
    token_cipher TEXT NOT NULL DEFAULT '',
    backup_time TEXT NOT NULL DEFAULT '16:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run_date TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS saas_tenant_whatsapp_notifications (
    school_id TEXT PRIMARY KEY,
    token_cipher TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    notify_loans INTEGER NOT NULL DEFAULT 1,
    notify_procurements INTEGER NOT NULL DEFAULT 1,
    reminder_days INTEGER NOT NULL DEFAULT 1,
    send_time TEXT NOT NULL DEFAULT '08:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    last_run_date TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saas_schools (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saas_tenant_states (
    school_id TEXT PRIMARY KEY REFERENCES saas_schools(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saas_platform_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saas_migrations (
    migration_key TEXT PRIMARY KEY,
    migration_value TEXT NOT NULL DEFAULT '',
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saas_super_admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saas_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES saas_super_admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saas_tenant_sessions (
    token_hash TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES saas_schools(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saas_audit_logs (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO telegram_backup (id) VALUES (1);
  INSERT OR IGNORE INTO saas_platform_telegram_backup (id) VALUES (1);
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
const getTenantTelegramConfig = db.prepare("SELECT * FROM saas_tenant_telegram_backup WHERE school_id = ?");
const getEnabledTenantTelegramConfigs = db.prepare("SELECT * FROM saas_tenant_telegram_backup WHERE enabled = 1");
const setTenantLastRun = db.prepare("UPDATE saas_tenant_telegram_backup SET last_run_date = ? WHERE school_id = ?");
const saveTenantTelegramConfig = db.prepare(`
  INSERT INTO saas_tenant_telegram_backup (school_id, chat_id, token_cipher, backup_time, timezone, enabled, last_run_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(school_id) DO UPDATE SET chat_id = excluded.chat_id, token_cipher = excluded.token_cipher,
    backup_time = excluded.backup_time, timezone = excluded.timezone, enabled = excluded.enabled,
    last_run_date = excluded.last_run_date
`);
const getAllTenantTelegramConfigs = db.prepare("SELECT * FROM saas_tenant_telegram_backup");
const getPlatformTelegramBackup = db.prepare("SELECT * FROM saas_platform_telegram_backup WHERE id = 1");
const getEnabledPlatformTelegramBackup = db.prepare("SELECT * FROM saas_platform_telegram_backup WHERE id = 1 AND enabled = 1");
const savePlatformTelegramBackup = db.prepare(`
  UPDATE saas_platform_telegram_backup
  SET chat_id = ?, token_cipher = ?, backup_time = ?, timezone = ?, enabled = ?, last_run_date = ?
  WHERE id = 1
`);
const setPlatformTelegramLastRun = db.prepare("UPDATE saas_platform_telegram_backup SET last_run_date = ? WHERE id = 1");
const getTenantWhatsAppConfig = db.prepare("SELECT * FROM saas_tenant_whatsapp_notifications WHERE school_id = ?");
const getEnabledTenantWhatsAppConfigs = db.prepare("SELECT * FROM saas_tenant_whatsapp_notifications WHERE enabled = 1");
const getAllTenantWhatsAppConfigs = db.prepare("SELECT * FROM saas_tenant_whatsapp_notifications");
const setTenantWhatsAppLastRun = db.prepare("UPDATE saas_tenant_whatsapp_notifications SET last_run_date = ? WHERE school_id = ?");
const saveTenantWhatsAppConfig = db.prepare(`
  INSERT INTO saas_tenant_whatsapp_notifications
    (school_id, token_cipher, enabled, notify_loans, notify_procurements, reminder_days, send_time, timezone, last_run_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(school_id) DO UPDATE SET token_cipher = excluded.token_cipher, enabled = excluded.enabled,
    notify_loans = excluded.notify_loans, notify_procurements = excluded.notify_procurements,
    reminder_days = excluded.reminder_days, send_time = excluded.send_time, timezone = excluded.timezone,
    last_run_date = excluded.last_run_date
`);
const createSession = db.prepare("INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)");
const getSession = db.prepare("SELECT account_id, expires_at FROM auth_sessions WHERE token_hash = ?");
const deleteSession = db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?");
const getPlatformStateRow = db.prepare("SELECT payload FROM saas_platform_state WHERE id = 1");
const savePlatformStateRow = db.prepare(`
  INSERT INTO saas_platform_state (id, payload, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);
const getTenantStateRow = db.prepare("SELECT payload FROM saas_tenant_states WHERE school_id = ?");
const saveTenantStateRow = db.prepare(`
  INSERT INTO saas_tenant_states (school_id, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(school_id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);
const getSchoolRow = db.prepare("SELECT payload FROM saas_schools WHERE id = ?");
const saveSchoolRow = db.prepare(`
  INSERT INTO saas_schools (id, code, payload) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET code = excluded.code, payload = excluded.payload
`);
const getTenantSession = db.prepare("SELECT school_id, account_id, expires_at FROM saas_tenant_sessions WHERE token_hash = ?");
const getSuperAdminSession = db.prepare("SELECT admin_id, expires_at FROM saas_sessions WHERE token_hash = ?");
const getSuperAdminByUsername = db.prepare("SELECT * FROM saas_super_admins WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE");
const saveSuperAdmin = db.prepare("INSERT INTO saas_super_admins (id, username, email, name, password_salt, password_hash) VALUES (?, ?, ?, ?, ?, ?)");
const saveAuditRow = db.prepare("INSERT INTO saas_audit_logs (id, payload) VALUES (?, ?)");
const getAuditRows = db.prepare("SELECT payload FROM saas_audit_logs ORDER BY created_at DESC LIMIT ?");
const getAllAuditRows = db.prepare("SELECT payload FROM saas_audit_logs ORDER BY created_at DESC");
const getAllSchools = db.prepare("SELECT id, payload FROM saas_schools ORDER BY created_at DESC");
const getAllTenantStates = db.prepare("SELECT school_id, payload FROM saas_tenant_states");
const getSaasMigration = db.prepare("SELECT migration_value FROM saas_migrations WHERE migration_key = ?");
const saveSaasMigration = db.prepare(`
  INSERT INTO saas_migrations (migration_key, migration_value) VALUES (?, ?)
  ON CONFLICT(migration_key) DO UPDATE SET migration_value = excluded.migration_value, completed_at = CURRENT_TIMESTAMP
`);
const registrationAttempts = new Map();
const registrationOtpChallenges = new Map();
const registrationOtpSendAttempts = new Map();
const superAdminResetChallenges = new Map();
const superAdminResetSendAttempts = new Map();
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

function tenantState(schoolId) {
  const row = getTenantStateRow.get(schoolId);
  return row ? JSON.parse(row.payload) : null;
}

function defaultPlatformState() {
  const featureKeys = ["dashboard", "school", "types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears", "goods", "checkGoods", "usages", "stocktakes", "barcode", "repairTickets", "maintenanceCalendar", "loans", "procurements", "disposals", "depreciations", "reports"];
  return {
    settings: {
      branding: { appName: "Sarprah", tagline: "Sistem Manajemen Sarana & Prasarana", logo: "" },
      defaultMenus: featureKeys,
      qrisImage: "",
      paymentGateways: {
        kasera: { enabled: false, environment: "sandbox", apiKeyCipher: "", webhookSecretCipher: "" },
        xendit: { enabled: false, environment: "sandbox", secretKeyCipher: "", callbackTokenCipher: "" },
        duitku: { enabled: false, environment: "sandbox", merchantCode: "", apiKeyCipher: "" }
      },
      pricing: { monthly: 50000, semester: 275000, yearly: 500000 },
      trialDays: 14,
      terms: "Gunakan layanan secara bertanggung jawab dan jaga kerahasiaan akun sekolah.",
      sla: "Dukungan operasional tersedia pada hari kerja. Gangguan kritis ditangani secepatnya setelah laporan diterima.",
      maintenance: { enabled: false, message: "Sistem sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi." },
      whatsapp: { fonnteTokenCipher: "", registrationOtpEnabled: false }
    },
    plans: [
      { id: "basic", code: "basic", name: "Basic", description: "Untuk sekolah kecil dengan kebutuhan inventaris inti.", trialDays: 14, active: true, prices: { monthly: 50000, semester: 275000, yearly: 500000 }, features: featureKeys },
      { id: "premium", code: "premium", name: "Premium", description: "Akses lengkap ke pengelolaan dan pelaporan sarpras.", trialDays: 14, active: true, prices: { monthly: 150000, semester: 825000, yearly: 1000000 }, features: featureKeys },
      { id: "lifetime", code: "lifetime", name: "Lifetime", description: "Sekali bayar, akses penuh tanpa masa aktif.", trialDays: 0, active: true, prices: { monthly: 0, semester: 0, yearly: 2500000 }, features: featureKeys }
    ],
    schools: [],
    payments: [],
    tickets: [],
    announcements: [],
    manuals: []
  };
}

function platformState() {
  const row = getPlatformStateRow.get();
  return row ? JSON.parse(row.payload) : defaultPlatformState();
}

function savePlatformState(value) {
  savePlatformStateRow.run(JSON.stringify(value));
}

function updatePlatformSchool(data, school) {
  const index = data.schools.findIndex((entry) => entry.id === school.id);
  if (index < 0) throw new Error("Sekolah tidak ditemukan pada data platform.");
  data.schools[index] = school;
  saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
}

function auditPlatform(action, detail, schoolId = "") {
  const record = {
    id: crypto.randomUUID(),
    actor: "Super Admin",
    category: "platform",
    action,
    detail: String(detail || "").slice(0, 1000),
    schoolId,
    createdAt: new Date().toISOString()
  };
  saveAuditRow.run(record.id, JSON.stringify(record));
  db.prepare("DELETE FROM saas_audit_logs WHERE id NOT IN (SELECT id FROM saas_audit_logs ORDER BY created_at DESC LIMIT 2000)").run();
}

function safePlatformState() {
  const data = platformState();
  const wa = data.settings?.whatsapp || {};
  data.settings.whatsapp = {
    configured: Boolean(wa.fonnteTokenCipher),
    registrationOtpEnabled: wa.registrationOtpEnabled === true
  };
  const gateways = data.settings?.paymentGateways || {};
  data.settings.paymentGateways = {
    kasera: {
      enabled: gateways.kasera?.enabled === true,
      environment: gateways.kasera?.environment === "production" ? "production" : "sandbox",
      configured: Boolean(gateways.kasera?.apiKeyCipher && gateways.kasera?.webhookSecretCipher)
    },
    xendit: {
      enabled: gateways.xendit?.enabled === true,
      environment: gateways.xendit?.environment === "production" ? "production" : "sandbox",
      configured: Boolean(gateways.xendit?.secretKeyCipher && gateways.xendit?.callbackTokenCipher)
    },
    duitku: {
      enabled: gateways.duitku?.enabled === true,
      environment: gateways.duitku?.environment === "production" ? "production" : "sandbox",
      configured: Boolean(gateways.duitku?.merchantCode && gateways.duitku?.apiKeyCipher)
    }
  };
  return data;
}

function createSchoolState(school, admin) {
  const collections = [
    "types", "categories", "units", "locations", "ownerships", "suppliers", "funds", "academicYears",
    "goods", "items", "usages", "stocktakes", "repairTickets", "maintenanceSchedules", "assetMovements", "loans",
    "procurements", "disposals", "depreciations", "activityLogs", "trash", "helpTickets", "accounts"
  ];
  return {
    school: {
      name: school.name,
      npsn: "",
      phone: school.phone || "",
      email: school.email || "",
      website: "",
      address: school.address || "",
      city: "",
      principalName: school.principalName || "",
      principalNip: "",
      principalWhatsapp: "",
      sarprasVicePrincipalName: "",
      sarprasVicePrincipalNip: "",
      logo: "",
      footer: school.name
    },
    settings: { appName: "Sarprah", appLogo: "" },
    ...Object.fromEntries(collections.map((key) => [key, []])),
    accounts: [admin]
  };
}

function importLegacySchoolBackupIfConfigured() {
  const backupPath = process.env.SARPRAH_LEGACY_BACKUP_PATH?.trim();
  if (!backupPath) return;
  if (getSaasMigration.get("legacy_json_backup_import")) return;
  if (currentState() || getAllSchools.all().length) {
    console.warn("Impor backup sekolah dilewati karena database sudah memiliki data sekolah.");
    return;
  }
  let backup;
  try { backup = JSON.parse(fs.readFileSync(path.resolve(backupPath), "utf8")); }
  catch (error) { throw new Error(`Backup sekolah tidak dapat dibaca: ${error.message}`); }
  const state = backup?.state;
  const admins = Array.isArray(state?.accounts)
    ? state.accounts.filter((account) => account?.role === "Administrator")
    : [];
  if (backup.app !== "Sarprah" || backup.formatVersion !== 1 ||
      !state || typeof state.school?.name !== "string" || !state.school.name.trim() ||
      admins.length !== 1) {
    throw new Error("Format backup sekolah tidak valid atau tidak memiliki tepat satu Administrator.");
  }
  validateAccounts(state.accounts, admins[0].id);
  db.exec("BEGIN");
  try {
    saveState.run(JSON.stringify(state));
    saveSaasMigration.run("legacy_json_backup_import", "formatVersion=1");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.info("Backup sekolah lama berhasil dimuat untuk migrasi tenant satu kali.");
}

function ensurePlatformBootstrap() {
  const existing = getPlatformStateRow.get();
  if (!existing) savePlatformState(defaultPlatformState());
  const data = platformState();
  if (!Array.isArray(data.schools)) data.schools = [];
  let changed = false;
  const listedSchoolIds = new Set(data.schools.map((school) => school.id));
  for (const { id, payload } of getAllSchools.all()) {
    if (listedSchoolIds.has(id)) continue;
    data.schools.unshift(JSON.parse(payload));
    listedSchoolIds.add(id);
    changed = true;
  }
  const legacy = currentState();
  const legacyMigration = getSaasMigration.get("legacy_app_state_school");
  const legacyMigrationIncomplete = !legacyMigration ||
    !getSchoolRow.get(legacyMigration.migration_value) ||
    !getTenantStateRow.get(legacyMigration.migration_value);
  if (legacy && typeof legacy.school === "object" && legacyMigrationIncomplete) {
    const legacyName = String(legacy.school.name || "Sekolah Utama").trim();
    const legacyEmail = String(legacy.school.email || legacy.accounts?.find((row) => row.role === "Administrator")?.email || "").trim().toLowerCase();
    let school = data.schools.find((entry) => legacyEmail
      ? String(entry.email || "").trim().toLowerCase() === legacyEmail
      : String(entry.name || "").trim().toLocaleLowerCase("id-ID") === legacyName.toLocaleLowerCase("id-ID"));
    const now = new Date().toISOString();
    if (!school) {
      school = {
        id: `school-${crypto.randomUUID()}`,
        code: nextSchoolCode(data.schools),
        name: legacyName,
        level: "",
        email: legacyEmail,
        phone: String(legacy.school.phone || ""),
        address: String(legacy.school.address || ""),
        principalName: String(legacy.school.principalName || ""),
        domain: "",
        planId: "lifetime",
        status: "Lifetime",
        subscriptionPeriod: "lifetime",
        activatedAt: now,
        expiresAt: "",
        trialEndsAt: "",
        featureAccess: Object.fromEntries((data.settings.defaultMenus || []).map((key) => [key, true])),
        createdAt: now
      };
      saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
      saveTenantStateRow.run(school.id, JSON.stringify(legacy));
    } else {
      school.planId = "lifetime";
      school.status = "Lifetime";
      school.subscriptionPeriod = "lifetime";
      school.activatedAt ||= now;
      school.expiresAt = "";
      school.trialEndsAt = "";
      saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
      if (!tenantState(school.id)) saveTenantStateRow.run(school.id, JSON.stringify(legacy));
    }
    data.schools = [school, ...data.schools.filter((entry) => entry.id !== school.id)];
    saveSaasMigration.run("legacy_app_state_school", school.id);
    changed = true;
  }
  if (changed) savePlatformState(data);
  const legacyTelegram = getTelegramConfig.get();
  if ((legacyTelegram.chat_id || legacyTelegram.token_cipher || legacyTelegram.enabled) &&
      getAllTenantTelegramConfigs.all().length === 0) {
    const firstSchool = getAllSchools.all()
      .map(({ payload }) => JSON.parse(payload))
      .sort((a, b) => Number(a.code) - Number(b.code))[0];
    if (firstSchool) {
      saveTenantTelegramConfig.run(
        firstSchool.id, legacyTelegram.chat_id, legacyTelegram.token_cipher, legacyTelegram.backup_time,
        legacyTelegram.timezone, legacyTelegram.enabled, legacyTelegram.last_run_date
      );
      saveTelegramConfig.run("", "", legacyTelegram.backup_time, legacyTelegram.timezone, 0);
    }
  }
}

importLegacySchoolBackupIfConfigured();
ensurePlatformBootstrap();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), 210000, 32, "sha256").toString("hex");
}

function requestCookie(req, name) {
  const rawCookie = req.headers.cookie || "";
  return rawCookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sessionFromRequest(req) {
  const token = requestCookie(req, "sarprah_session");
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = getTenantSession.get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare("DELETE FROM saas_tenant_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  const account = tenantState(session.school_id)?.accounts?.find((row) => row.id === session.account_id && row.active);
  const schoolRow = getSchoolRow.get(session.school_id);
  const school = schoolRow ? JSON.parse(schoolRow.payload) : null;
  return account && school ? { tokenHash, account, schoolId: session.school_id, school } : null;
}

function superAdminFromRequest(req) {
  const token = requestCookie(req, "sarprah_superadmin_session");
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = getSuperAdminSession.get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare("DELETE FROM saas_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  const admin = db.prepare("SELECT id, username, email, name FROM saas_super_admins WHERE id = ?").get(session.admin_id);
  return admin ? { tokenHash, admin } : null;
}

function setSessionCookie(res, token, req, maxAge, cookieName = "sarprah_session") {
  const secure = req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);
  res.setHeader("Set-Cookie", `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

function verifyOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function createBackup(schoolId = "") {
  const state = schoolId ? tenantState(schoolId) : currentState();
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

async function sendTelegramBackup(config, schoolId) {
  const token = decryptToken(config.token_cipher);
  if (!token || !config.chat_id) throw new Error("ID Telegram dan token bot belum diisi.");
  const schoolRow = getSchoolRow.get(schoolId);
  if (!schoolRow) throw new Error("Sekolah untuk backup Telegram tidak ditemukan.");
  const school = JSON.parse(schoolRow.payload);
  const backup = createBackup(schoolId);
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const form = new FormData();
  form.append("chat_id", config.chat_id);
  form.append("document", file, `sarprah-${school.code}-backup-${backup.createdAt.slice(0, 10)}.json`);
  form.append("caption", `Backup Sarprah ${school.name} (${school.code}) · ${backup.createdAt}`);
  await telegramRequest(token, "sendDocument", form);
}

async function sendPlatformTelegramBackup(config) {
  const token = decryptToken(config.token_cipher);
  if (!token || !config.chat_id) throw new Error("ID Telegram dan token bot Super Admin belum diisi.");
  const backup = fullPlatformBackup();
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const form = new FormData();
  form.append("chat_id", config.chat_id);
  form.append("document", file, `sarprah-saas-backup-${backup.createdAt.slice(0, 10)}.json`);
  form.append("caption", `Backup platform Sarprah SaaS · ${backup.createdAt}`);
  await telegramRequest(token, "sendDocument", form);
}

function normalizeWhatsAppNumber(value) {
  let number = String(value || "").replace(/[^\d+]/g, "");
  if (number.startsWith("+")) number = number.slice(1);
  if (number.startsWith("0")) number = `62${number.slice(1)}`;
  if (!/^62\d{8,13}$/.test(number)) return "";
  return number;
}

function validateRegistrationOtp(phoneValue, codeValue) {
  const phone = normalizeWhatsAppNumber(phoneValue);
  const challenge = registrationOtpChallenges.get(phone);
  if (!phone || !challenge) return "Kirim kode OTP ke nomor WhatsApp yang digunakan untuk pendaftaran.";
  if (challenge.expiresAt <= Date.now()) {
    registrationOtpChallenges.delete(phone);
    return "Kode OTP sudah kedaluwarsa. Minta kode baru.";
  }
  if (challenge.attempts >= 5) {
    registrationOtpChallenges.delete(phone);
    return "Batas percobaan kode OTP tercapai. Minta kode baru.";
  }
  const code = String(codeValue || "").trim();
  const actual = crypto.createHash("sha256").update(code).digest();
  challenge.attempts++;
  if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(actual, challenge.digest)) {
    if (challenge.attempts >= 5) registrationOtpChallenges.delete(phone);
    return "Kode OTP tidak sesuai.";
  }
  return "";
}

async function sendFonnteMessage(tokenCipher, target, message) {
  const token = decryptToken(tokenCipher);
  const phone = normalizeWhatsAppNumber(target);
  if (!token || !phone) throw new Error("Token Fonnte atau nomor WhatsApp penerima belum valid.");
  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token },
    body: new URLSearchParams({ target: phone, message })
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`Fonnte mengirim respons tidak valid (HTTP ${response.status}).`); }
  if (!response.ok || result.status !== true && result.status !== "true") {
    throw new Error(result.reason || result.message || `Fonnte gagal mengirim pesan (HTTP ${response.status}).`);
  }
  return result;
}

function getSuperAdminResetDigest(adminId, code) {
  return crypto.createHmac("sha256", encryptionKey).update(`${adminId}:${code}`).digest();
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

async function readRawBody(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Ukuran callback melebihi batas.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function secureStringEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function embeddedImageBytes(value) {
  if (typeof value === "string") {
    const match = /^data:image\/[A-Za-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) return 0;
    const encoded = match[1];
    return Math.max(0, Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0));
  }
  if (Array.isArray(value)) return value.reduce((total, entry) => total + embeddedImageBytes(entry), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce((total, entry) => total + embeddedImageBytes(entry), 0);
  }
  return 0;
}

function tenantStorageQuotaBytes() {
  const configuredMb = Number(process.env.SARPRAH_TENANT_STORAGE_QUOTA_MB);
  const quotaMb = Number.isFinite(configuredMb) && configuredMb > 0 ? Math.min(configuredMb, 10_000) : 1024;
  return Math.floor(quotaMb * 1024 * 1024);
}

function platformPaymentGatewayUrls(provider) {
  const config = platformState().settings.paymentGateways?.[provider];
  if (!config?.enabled) throw new Error(`Gateway ${provider} sedang nonaktif.`);
  const configured = provider === "kasera"
    ? config.apiKeyCipher && config.webhookSecretCipher
    : provider === "xendit"
      ? config.secretKeyCipher && config.callbackTokenCipher
      : config.merchantCode && config.apiKeyCipher;
  if (!configured) throw new Error(`Kredensial gateway ${provider} belum lengkap.`);
  return config;
}

function paymentPublicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const candidate = configured || req.headers.origin || `${forwardedProto || (req.socket.encrypted ? "https" : "http")}://${req.headers.host || ""}`;
  let base;
  try { base = new URL(candidate); }
  catch { throw new Error("Alamat publik aplikasi tidak valid. Atur PUBLIC_APP_URL atau domain aplikasi terlebih dahulu."); }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Alamat publik aplikasi tidak valid.");
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("Gateway pembayaran membutuhkan alamat aplikasi HTTPS.");
  }
  return base.origin;
}

function approvePlatformPayment(data, payment, provider = "") {
  if (payment.status === "Disetujui") return false;
  payment.status = "Disetujui";
  payment.verifiedAt = new Date().toISOString();
  if (provider) payment.note = `Pembayaran terverifikasi otomatis melalui ${provider}.`;
  const school = data.schools.find((entry) => entry.id === payment.schoolId);
  if (school) {
    if (payment.period === "lifetime") {
      school.expiresAt = "";
      school.subscriptionPeriod = "lifetime";
      school.status = "Lifetime";
    } else {
      const duration = payment.period === "semester" ? 183 : payment.period === "yearly" ? 365 : 30;
      const oldEnd = new Date(school.expiresAt || school.trialEndsAt || Date.now());
      const start = oldEnd > new Date() ? oldEnd : new Date();
      school.expiresAt = new Date(start.getTime() + duration * 86400000).toISOString();
      school.activatedAt ||= new Date().toISOString();
      school.status = "Aktif";
    }
    saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
  }
  return true;
}

async function createProviderCheckout(provider, payment, school, req) {
  const config = platformPaymentGatewayUrls(provider);
  const baseUrl = paymentPublicBaseUrl(req);
  const amount = Math.trunc(Number(payment.amount));
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Nominal tagihan tidak valid untuk pembayaran online.");
  const orderId = `SARP-${payment.id}-${crypto.randomBytes(4).toString("hex")}`;
  const description = `Langganan Sarprah ${payment.period || "bulanan"} · ${String(school.name || "").slice(0, 100)}`;
  const returnUrl = `${baseUrl}/?payment=return`;
  let endpoint = "";
  let headers = { "Content-Type": "application/json" };
  let body;
  if (provider === "kasera") {
    endpoint = "https://pay.kasera.id/v1/transactions";
    headers.Authorization = `Bearer ${decryptToken(config.apiKeyCipher)}`;
    headers["Idempotency-Key"] = orderId;
    body = { amount, description, external_id: orderId, checkout: { steps: ["customer", "payment_method", "payment"] } };
  } else if (provider === "xendit") {
    endpoint = "https://api.xendit.co/v2/invoices";
    headers.Authorization = `Basic ${Buffer.from(`${decryptToken(config.secretKeyCipher)}:`).toString("base64")}`;
    body = {
      external_id: orderId,
      amount,
      currency: "IDR",
      description,
      payer_email: school.email || undefined,
      success_redirect_url: returnUrl,
      failure_redirect_url: returnUrl,
      invoice_duration: 86400
    };
  } else {
    endpoint = config.environment === "production"
      ? "https://passport.duitku.com/webapi/api/merchant/v2/inquiry"
      : "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";
    const apiKey = decryptToken(config.apiKeyCipher);
    body = {
      merchantCode: config.merchantCode,
      paymentAmount: amount,
      paymentMethod: "SP",
      merchantOrderId: orderId,
      productDetails: description.slice(0, 255),
      email: school.email || "admin@sarprah.id",
      customerVaName: "Sarprah",
      phoneNumber: school.phone || "",
      callbackUrl: `${baseUrl}/api/payments/webhook/duitku`,
      returnUrl,
      expiryPeriod: 1440,
      signature: crypto.createHmac("sha256", apiKey).update(`${config.merchantCode}${orderId}${amount}`).digest("hex")
    };
  }
  let response;
  let result;
  try {
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    result = await response.json();
  } catch (error) {
    throw new Error(`Tidak dapat menghubungi ${provider}: ${error.message}`);
  }
  if (!response.ok) {
    const detail = result?.message || result?.error || result?.statusMessage || `HTTP ${response.status}`;
    throw new Error(`Gateway ${provider} menolak permintaan checkout: ${String(detail).slice(0, 300)}`);
  }
  let checkoutUrl = "";
  let reference = "";
  if (provider === "kasera") {
    checkoutUrl = String(result.checkout_url || "");
    reference = String(result.id || result.payment_request_id || "");
  } else if (provider === "xendit") {
    checkoutUrl = String(result.invoice_url || "");
    reference = String(result.id || "");
  } else {
    if (String(result.statusCode || "") !== "00") throw new Error(`Duitku gagal membuat tagihan: ${result.statusMessage || result.statusCode || "respons tidak valid"}`);
    checkoutUrl = String(result.paymentUrl || "");
    reference = String(result.reference || "");
  }
  let checkout;
  try { checkout = new URL(checkoutUrl); }
  catch { throw new Error(`Gateway ${provider} tidak memberikan URL pembayaran yang valid.`); }
  if (checkout.protocol !== "https:") throw new Error(`Gateway ${provider} memberikan tautan pembayaran yang tidak aman.`);
  return { checkoutUrl: checkout.href, reference, orderId };
}

function validateAccounts(accounts, currentAdminId) {
  const allowedRoles = new Set(["Administrator", "Kepala Sekolah", "Wakasek Sarpras", "Guru"]);
  if (!Array.isArray(accounts) || accounts.length > 200) throw new Error("Daftar akun tidak valid.");
  const ids = new Set();
  const emails = new Set();
  let adminCount = 0;
  for (const account of accounts) {
    if (!account || typeof account !== "object" || Array.isArray(account)) throw new Error("Data akun tidak valid.");
    const id = String(account.id || "").trim();
    const name = String(account.name || "").trim();
    const email = String(account.email || "").trim().toLowerCase();
    if (!id || id.length > 128 || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("ID, nama, atau email akun tidak valid.");
    }
    if (ids.has(id) || emails.has(email)) throw new Error("ID dan email akun harus unik.");
    if (!allowedRoles.has(account.role) || typeof account.active !== "boolean") throw new Error("Peran atau status akun tidak valid.");
    const hasSalt = typeof account.passwordSalt === "string" && account.passwordSalt.length > 0;
    const hasHash = typeof account.passwordHash === "string" && account.passwordHash.length > 0;
    if (hasSalt !== hasHash || (hasSalt && (!/^[\da-f]{32}$/i.test(account.passwordSalt) || !/^[\da-f]{64}$/i.test(account.passwordHash)))) {
      throw new Error("Kredensial akun tidak valid.");
    }
    if (account.role === "Administrator") {
      adminCount += 1;
      if (id !== currentAdminId || !account.active) throw new Error("Administrator aktif yang sedang masuk tidak boleh diganti atau dinonaktifkan.");
    }
    ids.add(id);
    emails.add(email);
  }
  if (adminCount !== 1) throw new Error("Daftar akun harus mempertahankan satu Administrator yang sedang masuk.");
  return accounts;
}

function platformSchoolSummaries() {
  return platformState().schools.map((school) => {
    const tenant = tenantState(school.id) || {};
    return {
      ...school,
      accountCount: (tenant.accounts || []).length,
      goodsCount: (tenant.goods || []).length,
      itemCount: (tenant.items || []).length,
      openTicketCount: (tenant.helpTickets || []).filter((ticket) => !["Selesai", "Ditutup"].includes(ticket.status)).length
    };
  });
}

function platformTickets() {
  return getAllSchools.all().flatMap(({ id, payload }) => {
    const school = JSON.parse(payload);
    return (tenantState(id)?.helpTickets || []).map((ticket) => ({
      ...ticket, schoolId: id, schoolName: school.name, schoolCode: school.code
    }));
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function nextSchoolCode(schools) {
  const maxCode = Math.max(0, ...schools.map((school) => Number(school.code) || 0));
  if (maxCode >= 9999) throw new Error("Kode sekolah empat digit sudah habis.");
  return String(maxCode + 1).padStart(4, "0");
}

function generateSchoolCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const existingCodes = new Set(getAllSchools.all().map(({ payload }) => String(JSON.parse(payload).code).toUpperCase()));
  for (let attempt = 0; attempt < 100; attempt++) {
    const characters = [
      letters[crypto.randomInt(letters.length)],
      letters[crypto.randomInt(letters.length)],
      digits[crypto.randomInt(digits.length)],
      digits[crypto.randomInt(digits.length)]
    ];
    for (let index = characters.length - 1; index > 0; index--) {
      const swapIndex = crypto.randomInt(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }
    const code = characters.join("");
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Kode sekolah unik tidak dapat dibuat. Coba daftarkan sekolah kembali.");
}

function validateSchoolRegistration(input, platform) {
  const school = input.school || {};
  const admin = input.admin || {};
  const name = String(school.name || "").trim();
  const email = String(admin.email || "").trim().toLowerCase();
  const adminName = String(admin.name || "").trim();
  const password = String(admin.password || "");
  const planId = String(school.planId || platform.plans.find((plan) => plan.active)?.id || "");
  const plan = platform.plans.find((row) => row.id === planId && row.active);
  if (!name || name.length > 180) throw new Error("Nama sekolah wajib diisi (maksimal 180 karakter).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email Administrator tidak valid.");
  if (!adminName || adminName.length > 120) throw new Error("Nama Administrator wajib diisi.");
  if (password.length < 8 || password.length > 200) throw new Error("Kata sandi minimal 8 karakter.");
  if (!plan) throw new Error("Paket langganan tidak tersedia.");
  return { school, name, email, adminName, password, plan };
}

function createSchoolTenant(input, options = {}) {
  const platform = platformState();
  const validated = validateSchoolRegistration(input, platform);
  const { school: raw, name, email, adminName, password, plan } = validated;
  const duplicateEmail = getAllSchools.all().some(({ id }) =>
    tenantState(id)?.accounts?.some((account) => String(account.email || "").toLowerCase() === email));
  if (duplicateEmail) throw new Error("Email Administrator sudah digunakan sekolah lain.");
  const id = `school-${crypto.randomUUID()}`;
  const code = generateSchoolCode();
  const now = new Date();
  const trialDays = Math.max(0, Number(plan.trialDays ?? platform.settings.trialDays) || 0);
  const period = String(raw.subscriptionPeriod || "monthly");
  if (!["monthly", "semester", "yearly", "lifetime"].includes(period) || (period === "lifetime" && !options.managedBySuperAdmin)) {
    throw new Error("Periode langganan tidak valid.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const account = {
    id: crypto.randomUUID(), name: adminName, email, role: "Administrator",
    active: true, passwordSalt: salt, passwordHash: hashPassword(password, salt)
  };
  const record = {
    id, code, name, level: String(raw.level || "").trim(), email,
    phone: String(raw.phone || "").trim(), contactName: adminName,
    principalName: String(raw.principalName || "").trim(), address: String(raw.address || "").trim(),
    domain: "",     planId: plan.id, status: period === "lifetime" ? "Lifetime" : trialDays ? "Uji Coba" : "Menunggu Pembayaran",
    subscriptionPeriod: period, activatedAt: "", expiresAt: "",
    trialEndsAt: trialDays ? new Date(now.getTime() + trialDays * 86400_000).toISOString() : "",
    featureAccess: Object.fromEntries(platform.settings.defaultMenus.map((key) => [key, plan.features?.includes(key) ?? true])),
    publicPortalEnabled: raw.publicPortalEnabled !== false,
    createdAt: now.toISOString()
  };
  const tenant = createSchoolState(record, account);
  db.exec("BEGIN");
  try {
    saveSchoolRow.run(id, code, JSON.stringify(record));
    saveTenantStateRow.run(id, JSON.stringify(tenant));
    platform.schools.unshift(record);
    savePlatformState(platform);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  auditPlatform(options.action || "Mendaftarkan sekolah", `${code} · ${name}`, id);
  return record;
}

function fullPlatformBackup() {
  return {
    app: "Sarprah SaaS",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    platform: platformState(),
    schools: getAllSchools.all().map(({ id, payload }) => ({ school: JSON.parse(payload), state: tenantState(id) })),
    auditLogs: getAllAuditRows.all().map(({ payload }) => JSON.parse(payload)),
    telegramBackup: getTelegramConfig.get(),
    telegramBackups: getAllTenantTelegramConfigs.all(),
    platformTelegramBackup: getPlatformTelegramBackup.get(),
    whatsappNotifications: getAllTenantWhatsAppConfigs.all(),
    superAdmins: db.prepare("SELECT id, username, email, name, password_salt, password_hash FROM saas_super_admins").all()
  };
}

function summarizePlatformData() {
  const data = safePlatformState();
  data.schools = platformSchoolSummaries();
  data.tickets = platformTickets();
  data.auditLogs = getAuditRows.all(500).map(({ payload }) => JSON.parse(payload));
  return data;
}

function tenantAccessError(school) {
  const settings = platformState().settings;
  if (settings.maintenance?.enabled) return { status: 503, message: settings.maintenance.message || "Sistem sedang dalam pemeliharaan." };
  if (["Ditangguhkan", "Dihentikan", "Nonaktif"].includes(school.status)) {
    return { status: 403, message: "Akses sekolah sedang ditangguhkan. Hubungi administrator platform." };
  }
  if (school.status !== "Lifetime" && school.status !== "Uji Coba" && school.expiresAt && new Date(school.expiresAt) < new Date()) {
    return { status: 402, message: "Masa aktif sekolah berakhir. Silakan selesaikan pembayaran tagihan." };
  }
  if (school.status === "Uji Coba" && school.trialEndsAt && new Date(school.trialEndsAt) < new Date()) {
    return { status: 402, message: "Masa uji coba sekolah berakhir. Silakan pilih paket dan selesaikan pembayaran." };
  }
  return null;
}

async function handlePlatformApi(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (!pathname.startsWith("/api/platform/")) return false;
  if (req.method === "GET" && pathname === "/api/platform/setup-status") {
    return send(res, 200, JSON.stringify({ configured: Boolean(db.prepare("SELECT 1 FROM saas_super_admins LIMIT 1").get()) })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/setup") {
    if (db.prepare("SELECT 1 FROM saas_super_admins LIMIT 1").get()) return send(res, 409, JSON.stringify({ error: "Super Admin sudah dikonfigurasi." })), true;
    const input = await readJsonBody(req, 32_000);
    const username = String(input.username || "").trim().toLowerCase();
    const email = String(input.email || "").trim().toLowerCase();
    const name = String(input.name || "").trim();
    const password = String(input.password || "");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return send(res, 400, JSON.stringify({ error: "Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung." })), true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 120 || password.length < 10 || password.length > 200) {
      return send(res, 400, JSON.stringify({ error: "Nama, email, atau kata sandi Super Admin tidak valid. Kata sandi minimal 10 karakter." })), true;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    try { saveSuperAdmin.run(crypto.randomUUID(), username, email, name, salt, hashPassword(password, salt)); }
    catch (error) {
      if (String(error.message).includes("UNIQUE")) return send(res, 409, JSON.stringify({ error: "Username atau email sudah digunakan." })), true;
      throw error;
    }
    auditPlatform("Membuat akun Super Admin", username);
    return send(res, 201, JSON.stringify({ ok: true })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/password-reset/request") {
    const now = Date.now();
    const input = await readJsonBody(req, 32_000);
    const identifier = String(input.username || "").trim().toLowerCase();
    const ipKey = `ip:${req.socket.remoteAddress || "unknown"}`;
    for (const [key, timestamps] of superAdminResetSendAttempts) {
      const recentTimestamps = timestamps.filter((timestamp) => now - timestamp < 900_000);
      if (recentTimestamps.length) superAdminResetSendAttempts.set(key, recentTimestamps);
      else superAdminResetSendAttempts.delete(key);
    }
    const recent = superAdminResetSendAttempts.get(ipKey) || [];
    if (recent.length >= 5) return send(res, 429, JSON.stringify({ error: "Terlalu banyak permintaan pemulihan. Coba lagi dalam 15 menit." })), true;
    recent.push(now);
    superAdminResetSendAttempts.set(ipKey, recent);

    const whatsapp = platformState().settings.whatsapp || {};
    const recoveryPhone = normalizeWhatsAppNumber(process.env.SARPRAH_SUPER_ADMIN_RECOVERY_PHONE);
    if (!whatsapp.fonnteTokenCipher || !recoveryPhone) {
      return send(res, 503, JSON.stringify({ error: "Pemulihan belum dikonfigurasi. Admin server perlu mengatur gateway Fonnte dan SARPRAH_SUPER_ADMIN_RECOVERY_PHONE." })), true;
    }
    const admin = identifier ? getSuperAdminByUsername.get(identifier, identifier) : null;
    if (admin) {
      const adminKey = `admin:${admin.id}`;
      const adminRecent = superAdminResetSendAttempts.get(adminKey) || [];
      const existing = superAdminResetChallenges.get(admin.id);
      if (adminRecent.length < 3 && (!existing || now - existing.sentAt >= 60_000 || existing.expiresAt <= now)) {
        adminRecent.push(now);
        superAdminResetSendAttempts.set(adminKey, adminRecent);
        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
        superAdminResetChallenges.set(admin.id, {
          digest: getSuperAdminResetDigest(admin.id, code),
          attempts: 0,
          sentAt: now,
          expiresAt: now + 600_000
        });
        try {
          const branding = platformState().settings.branding || {};
          const appName = String(branding.appName || "Sarprah").slice(0, 80);
          await sendFonnteMessage(whatsapp.fonnteTokenCipher, recoveryPhone,
            `Kode OTP pemulihan akun Super Admin ${appName}: ${code}. Kode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.`);
        } catch (error) {
          superAdminResetChallenges.delete(admin.id);
          console.error("Pengiriman OTP pemulihan Super Admin gagal:", error);
          return send(res, 502, JSON.stringify({ error: "OTP pemulihan tidak dapat dikirim. Periksa konfigurasi gateway Fonnte." })), true;
        }
      }
    }
    return send(res, 200, JSON.stringify({ ok: true, message: "Jika akun ditemukan, kode OTP akan dikirim ke nomor pemulihan Super Admin." })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/password-reset/complete") {
    const input = await readJsonBody(req, 32_000);
    const identifier = String(input.username || "").trim().toLowerCase();
    const code = String(input.otpCode || "").trim();
    const password = String(input.newPassword || "");
    if (password.length < 10 || password.length > 200) {
      return send(res, 400, JSON.stringify({ error: "Kata sandi baru harus 10–200 karakter." })), true;
    }
    const admin = identifier ? getSuperAdminByUsername.get(identifier, identifier) : null;
    const challenge = admin ? superAdminResetChallenges.get(admin.id) : null;
    if (!challenge || challenge.expiresAt <= Date.now() || challenge.attempts >= 5) {
      if (admin) superAdminResetChallenges.delete(admin.id);
      return send(res, 400, JSON.stringify({ error: "Kode OTP tidak valid atau sudah kedaluwarsa. Minta kode baru." })), true;
    }
    challenge.attempts++;
    const digest = getSuperAdminResetDigest(admin.id, code);
    if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(digest, challenge.digest)) {
      if (challenge.attempts >= 5) superAdminResetChallenges.delete(admin.id);
      return send(res, 400, JSON.stringify({ error: "Kode OTP tidak valid atau sudah kedaluwarsa. Minta kode baru." })), true;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    db.prepare("UPDATE saas_super_admins SET password_salt = ?, password_hash = ? WHERE id = ?")
      .run(salt, hashPassword(password, salt), admin.id);
    db.prepare("DELETE FROM saas_sessions WHERE admin_id = ?").run(admin.id);
    superAdminResetChallenges.delete(admin.id);
    auditPlatform("Mereset kata sandi Super Admin melalui OTP", admin.username);
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/login") {
    const input = await readJsonBody(req, 32_000);
    const login = String(input.username || "").trim().toLowerCase();
    const admin = getSuperAdminByUsername.get(login, login);
    if (!admin || hashPassword(String(input.password || ""), admin.password_salt) !== admin.password_hash) {
      return send(res, 401, JSON.stringify({ error: "Username/email atau kata sandi tidak sesuai." })), true;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare("INSERT INTO saas_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, admin.id, Date.now() + 8 * 3600_000);
    setSessionCookie(res, token, req, 8 * 3600, "sarprah_superadmin_session");
    auditPlatform("Login Super Admin", admin.username);
    return send(res, 200, JSON.stringify({ user: { id: admin.id, username: admin.username, email: admin.email, name: admin.name } })), true;
  }
  if (req.method === "GET" && pathname === "/api/platform/session") {
    const session = superAdminFromRequest(req);
    return send(res, 200, JSON.stringify({ user: session?.admin || null })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/logout") {
    const session = superAdminFromRequest(req);
    if (session) {
      db.prepare("DELETE FROM saas_sessions WHERE token_hash = ?").run(session.tokenHash);
      auditPlatform("Logout Super Admin", session.admin.username);
    }
    setSessionCookie(res, "", req, 0, "sarprah_superadmin_session");
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  const session = superAdminFromRequest(req);
  if (!session) return send(res, 401, JSON.stringify({ error: "Silakan masuk sebagai Super Admin." })), true;

  const paymentGatewayMatch = pathname.match(/^\/api\/platform\/payment-gateways\/(kasera|xendit|duitku)$/);
  if (paymentGatewayMatch && req.method === "PUT") {
    const provider = paymentGatewayMatch[1];
    const input = await readJsonBody(req, 32_000);
    if (typeof input.enabled !== "boolean") return send(res, 400, JSON.stringify({ error: "Status gateway tidak valid." })), true;
    if (!["sandbox", "production"].includes(input.environment)) return send(res, 400, JSON.stringify({ error: "Mode gateway tidak valid." })), true;
    const data = platformState();
    data.settings.paymentGateways ||= defaultPlatformState().settings.paymentGateways;
    const current = data.settings.paymentGateways[provider] || {};
    const next = { ...current, enabled: input.enabled, environment: input.environment };
    const saveSecret = (inputKey, storedKey) => {
      if (typeof input[inputKey] !== "string" || !input[inputKey].trim()) return;
      const secret = input[inputKey].trim();
      if (secret.length < 10 || secret.length > 500 || /\s/.test(secret)) throw new Error("Format kredensial gateway tidak valid.");
      next[storedKey] = encryptToken(secret);
    };
    try {
      if (provider === "kasera") {
        saveSecret("apiKey", "apiKeyCipher");
        saveSecret("webhookSecret", "webhookSecretCipher");
      } else if (provider === "xendit") {
        saveSecret("secretKey", "secretKeyCipher");
        saveSecret("callbackToken", "callbackTokenCipher");
      } else {
        saveSecret("apiKey", "apiKeyCipher");
        if (typeof input.merchantCode === "string" && input.merchantCode.trim()) {
          const merchantCode = input.merchantCode.trim();
          if (!/^[A-Za-z0-9_-]{1,50}$/.test(merchantCode)) throw new Error("Kode merchant Duitku tidak valid.");
          next.merchantCode = merchantCode;
        }
      }
      const configured = provider === "kasera"
        ? Boolean(next.apiKeyCipher && next.webhookSecretCipher)
        : provider === "xendit"
          ? Boolean(next.secretKeyCipher && next.callbackTokenCipher)
          : Boolean(next.merchantCode && next.apiKeyCipher);
      if (input.enabled && !configured) throw new Error("Lengkapi kredensial dan rahasia callback sebelum mengaktifkan gateway.");
      data.settings.paymentGateways[provider] = next;
      savePlatformState(data);
      auditPlatform(`Memperbarui gateway ${provider}`, `${input.enabled ? "Aktif" : "Nonaktif"} · ${input.environment}`);
      return send(res, 200, JSON.stringify({ gateway: safePlatformState().settings.paymentGateways[provider] })), true;
    } catch (error) {
      return send(res, 400, JSON.stringify({ error: error.message })), true;
    }
  }

  if (req.method === "GET" && pathname === "/api/platform/data") {
    return send(res, 200, JSON.stringify(summarizePlatformData())), true;
  }
  if (req.method === "PUT" && pathname === "/api/platform/data") {
    const input = await readJsonBody(req, 8_000_000);
    const data = platformState();
    if (input.settings && typeof input.settings === "object") {
      data.settings = {
        ...data.settings,
        ...input.settings,
        whatsapp: data.settings.whatsapp,
        paymentGateways: data.settings.paymentGateways
      };
    }
    if (Array.isArray(input.plans)) data.plans = input.plans;
    if (Array.isArray(input.announcements)) data.announcements = input.announcements;
    if (Array.isArray(input.manuals)) data.manuals = input.manuals;
    savePlatformState(data);
    auditPlatform("Memperbarui pengaturan platform", "Konfigurasi dan konten sistem diperbarui.");
    return send(res, 200, JSON.stringify(summarizePlatformData())), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/schools") {
    const school = createSchoolTenant(await readJsonBody(req, 200_000), { action: "Menambahkan sekolah", managedBySuperAdmin: true });
    return send(res, 201, JSON.stringify({ school: platformSchoolSummaries().find((row) => row.id === school.id) })), true;
  }
  const schoolAdminMatch = pathname.match(/^\/api\/platform\/schools\/([a-zA-Z0-9-]+)\/admin$/);
  if (schoolAdminMatch && req.method === "PUT") {
    const schoolId = schoolAdminMatch[1];
    const tenant = tenantState(schoolId);
    const admin = tenant?.accounts?.find((account) => account.role === "Administrator");
    if (!admin) return send(res, 404, JSON.stringify({ error: "Akun Administrator sekolah tidak ditemukan." })), true;
    const input = await readJsonBody(req, 32_000);
    const name = String(input.name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return send(res, 400, JSON.stringify({ error: "Nama atau email Administrator tidak valid." })), true;
    }
    const duplicate = getAllSchools.all().some(({ id }) => id !== schoolId
      && tenantState(id)?.accounts?.some((account) => String(account.email || "").toLowerCase() === email));
    if (duplicate) return send(res, 409, JSON.stringify({ error: "Email sudah digunakan sekolah lain." })), true;
    admin.name = name;
    admin.email = email;
    if (input.password) {
      const password = String(input.password);
      if (password.length < 8) return send(res, 400, JSON.stringify({ error: "Kata sandi admin minimal 8 karakter." })), true;
      admin.passwordSalt = crypto.randomBytes(16).toString("hex");
      admin.passwordHash = hashPassword(password, admin.passwordSalt);
    }
    const schoolRow = getSchoolRow.get(schoolId);
    const school = JSON.parse(schoolRow.payload);
    school.email = email;
    school.contactName = name;
    const data = platformState();
    updatePlatformSchool(data, school);
    savePlatformState(data);
    saveTenantStateRow.run(schoolId, JSON.stringify(tenant));
    auditPlatform("Memperbarui akun admin sekolah", `${school.code} · ${email}`, schoolId);
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  const schoolMatch = pathname.match(/^\/api\/platform\/schools\/([a-zA-Z0-9-]+)$/);
  if (schoolMatch && req.method === "GET") {
    const row = getSchoolRow.get(schoolMatch[1]);
    if (!row) return send(res, 404, JSON.stringify({ error: "Sekolah tidak ditemukan." })), true;
    const school = JSON.parse(row.payload);
    const tenant = tenantState(school.id) || {};
    return send(res, 200, JSON.stringify({
      school: platformSchoolSummaries().find((entry) => entry.id === school.id),
      admin: (tenant.accounts || []).filter((account) => account.role === "Administrator").map(({ id, name, email, active }) => ({ id, name, email, active })),
      tickets: (tenant.helpTickets || []).map((ticket) => ({ ...ticket, schoolId: school.id, schoolName: school.name })),
      payments: platformState().payments.filter((payment) => payment.schoolId === school.id),
      summary: { goods: (tenant.goods || []).length, items: (tenant.items || []).length, accounts: (tenant.accounts || []).length }
    })), true;
  }
  if (schoolMatch && req.method === "PUT") {
    const schoolId = schoolMatch[1];
    const row = getSchoolRow.get(schoolId);
    if (!row) return send(res, 404, JSON.stringify({ error: "Sekolah tidak ditemukan." })), true;
    const input = await readJsonBody(req, 200_000);
    const school = JSON.parse(row.payload);
    const allowed = ["code", "name", "level", "email", "phone", "contactName", "principalName", "address", "domain", "planId", "status", "subscriptionPeriod", "expiresAt", "trialEndsAt"];
    allowed.forEach((key) => { if (input[key] !== undefined) school[key] = String(input[key]).trim(); });
    school.code = String(school.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(school.code)) return send(res, 400, JSON.stringify({ error: "Kode sekolah harus terdiri dari 4 karakter huruf atau angka." })), true;
    const duplicateCode = getAllSchools.all().some(({ id, payload }) =>
      id !== schoolId && String(JSON.parse(payload).code || "").toUpperCase() === school.code);
    if (duplicateCode) return send(res, 409, JSON.stringify({ error: "Kode sekolah sudah digunakan tenant lain." })), true;
    if (input.featureAccess && typeof input.featureAccess === "object") {
      school.featureAccess = Object.fromEntries(Object.entries(input.featureAccess).map(([key, enabled]) => [key, Boolean(enabled)]));
    }
    if (!school.name || school.name.length > 180) return send(res, 400, JSON.stringify({ error: "Nama sekolah wajib diisi dan maksimal 180 karakter." })), true;
    const tenant = tenantState(schoolId);
    if (tenant?.school) Object.assign(tenant.school, {
      name: school.name, email: school.email, phone: school.phone, address: school.address, principalName: school.principalName
    });
    const data = platformState();
    updatePlatformSchool(data, school);
    data.payments.forEach((payment) => { if (payment.schoolId === schoolId) payment.schoolCode = school.code; });
    savePlatformState(data);
    if (tenant) saveTenantStateRow.run(schoolId, JSON.stringify(tenant));
    auditPlatform("Memperbarui sekolah", `${school.code} · ${school.name}`, school.id);
    return send(res, 200, JSON.stringify({ school: platformSchoolSummaries().find((entry) => entry.id === school.id) })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/billing/run") {
    const data = platformState();
    const now = new Date();
    let created = 0;
    let reminders = 0;
    data.schools.forEach((school) => {
      if (school.subscriptionPeriod === "lifetime" || school.status === "Ditangguhkan") return;
      const expiry = new Date(school.expiresAt || school.trialEndsAt || "");
      if (Number.isNaN(expiry.getTime())) return;
      const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
      const periodKey = `${school.id}:${expiry.toISOString().slice(0, 10)}`;
      if (!data.payments.some((payment) => payment.periodKey === periodKey) && daysRemaining <= 7 && daysRemaining >= 0) {
        const plan = data.plans.find((row) => row.id === school.planId);
        const period = school.subscriptionPeriod || "monthly";
        const amount = Number(plan?.prices?.[period] ?? data.settings.pricing?.[period]) || 0;
        data.payments.unshift({
          id: crypto.randomUUID(), schoolId: school.id, schoolName: school.name, schoolCode: school.code,
          planId: school.planId, period, periodKey, amount, status: "Menunggu Verifikasi",
          type: "Tagihan", dueDate: expiry.toISOString(), createdAt: now.toISOString()
        });
        created++;
      }
      if (daysRemaining >= 0 && daysRemaining <= 7) reminders++;
      if (daysRemaining < 0 && school.status !== "Ditangguhkan") {
        school.status = "Ditangguhkan";
        saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
      }
    });
    savePlatformState(data);
    auditPlatform("Menjalankan pemeriksaan tagihan", `${created} tagihan baru, ${reminders} pengingat.`);
    return send(res, 200, JSON.stringify({ created, reminders, checkedAt: now.toISOString() })), true;
  }
  const paymentMatch = pathname.match(/^\/api\/platform\/payments\/([a-zA-Z0-9-]+)$/);
  if (paymentMatch && req.method === "PUT") {
    const data = platformState();
    const payment = data.payments.find((entry) => entry.id === paymentMatch[1]);
    if (!payment) return send(res, 404, JSON.stringify({ error: "Tagihan tidak ditemukan." })), true;
    const input = await readJsonBody(req, 32_000);
    if (!["Disetujui", "Ditolak", "Menunggu Verifikasi"].includes(input.status)) {
      return send(res, 400, JSON.stringify({ error: "Status pembayaran tidak valid." })), true;
    }
    if (input.status === "Disetujui") {
      payment.note = String(input.note || "").slice(0, 500);
      approvePlatformPayment(data, payment);
    } else {
      payment.status = input.status;
      payment.note = String(input.note || "").slice(0, 500);
      payment.verifiedAt = new Date().toISOString();
    }
    savePlatformState(data);
    auditPlatform("Memperbarui status pembayaran", `${payment.schoolCode} · ${payment.status}`, payment.schoolId);
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  const ticketMatch = pathname.match(/^\/api\/platform\/tickets\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/);
  if (ticketMatch && req.method === "PUT") {
    const [, schoolId, ticketId] = ticketMatch;
    const tenant = tenantState(schoolId);
    const ticket = tenant?.helpTickets?.find((entry) => entry.id === ticketId);
    if (!ticket) return send(res, 404, JSON.stringify({ error: "Tiket kendala tidak ditemukan." })), true;
    const input = await readJsonBody(req, 32_000);
    if (!["Diajukan", "Diproses", "Selesai", "Ditolak"].includes(input.status)) return send(res, 400, JSON.stringify({ error: "Status tiket tidak valid." })), true;
    ticket.status = input.status;
    if (input.reply !== undefined) ticket.adminReply = String(input.reply).slice(0, 3000);
    ticket.updatedAt = new Date().toISOString();
    saveTenantStateRow.run(schoolId, JSON.stringify(tenant));
    auditPlatform("Menangani tiket sekolah", `${ticket.ticketNo || ticket.title} · ${ticket.status}`, schoolId);
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  if (req.method === "GET" && pathname === "/api/platform/audit") {
    const logs = getAllAuditRows.all().map(({ payload }) => JSON.parse(payload));
    getAllSchools.all().forEach(({ id, payload }) => {
      const school = JSON.parse(payload);
      (tenantState(id)?.activityLogs || []).forEach((entry) => logs.push({
        id: entry.id || crypto.randomUUID(), actor: entry.actor || entry.user || "Akun sekolah",
        category: "tenant", action: entry.action || entry.event || "Aktivitas sekolah",
        detail: entry.detail || entry.target || "", schoolId: id, schoolName: school.name,
        createdAt: entry.createdAt || entry.timestamp || ""
      }));
    });
    logs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return send(res, 200, JSON.stringify({ logs: logs.slice(0, 1000) })), true;
  }
  if (req.method === "PUT" && pathname === "/api/platform/profile") {
    const input = await readJsonBody(req, 32_000);
    const admin = db.prepare("SELECT * FROM saas_super_admins WHERE id = ?").get(session.admin.id);
    if (input.currentPassword || input.newPassword) {
      if (hashPassword(String(input.currentPassword || ""), admin.password_salt) !== admin.password_hash) {
        return send(res, 403, JSON.stringify({ error: "Kata sandi saat ini tidak sesuai." })), true;
      }
      const password = String(input.newPassword || "");
      if (password.length < 10) return send(res, 400, JSON.stringify({ error: "Kata sandi baru minimal 10 karakter." })), true;
      const salt = crypto.randomBytes(16).toString("hex");
      db.prepare("UPDATE saas_super_admins SET password_salt = ?, password_hash = ? WHERE id = ?")
        .run(salt, hashPassword(password, salt), admin.id);
    }
    const name = String(input.name || "").trim();
    if (!name || name.length > 120) return send(res, 400, JSON.stringify({ error: "Nama akun wajib diisi." })), true;
    const email = String(input.email || admin.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, JSON.stringify({ error: "Email akun tidak valid." })), true;
    if (db.prepare("SELECT 1 FROM saas_super_admins WHERE email = ? COLLATE NOCASE AND id != ?").get(email, admin.id)) {
      return send(res, 409, JSON.stringify({ error: "Email sudah digunakan akun Super Admin lain." })), true;
    }
    db.prepare("UPDATE saas_super_admins SET name = ?, email = ? WHERE id = ?").run(name, email, admin.id);
    auditPlatform("Memperbarui profil Super Admin", name);
    return send(res, 200, JSON.stringify({ user: { ...session.admin, name, email } })), true;
  }
  if (req.method === "PUT" && pathname === "/api/platform/whatsapp") {
    const input = await readJsonBody(req, 32_000);
    const data = platformState();
    const token = String(input.fonnteToken || "").trim();
    if (token && !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return send(res, 400, JSON.stringify({ error: "Format token Fonnte tidak valid." })), true;
    const current = data.settings.whatsapp || {};
    const tokenCipher = token ? encryptToken(token) : current.fonnteTokenCipher || "";
    const registrationOtpEnabled = typeof input.registrationOtpEnabled === "boolean"
      ? input.registrationOtpEnabled
      : current.registrationOtpEnabled === true;
    if (registrationOtpEnabled && !tokenCipher) return send(res, 409, JSON.stringify({ error: "Simpan token Fonnte sebelum mengaktifkan OTP pendaftaran." })), true;
    data.settings.whatsapp = { fonnteTokenCipher: tokenCipher, registrationOtpEnabled };
    savePlatformState(data);
    auditPlatform("Memperbarui konfigurasi WhatsApp Fonnte", `${token ? "Token diperbarui. " : ""}OTP pendaftaran ${registrationOtpEnabled ? "aktif" : "nonaktif"}.`);
    return send(res, 200, JSON.stringify({ ok: true, configured: Boolean(tokenCipher), registrationOtpEnabled })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/whatsapp/send") {
    const input = await readJsonBody(req, 32_000);
    const wa = platformState().settings.whatsapp || {};
    const tokenCipher = wa.fonnteTokenCipher || "";
    const to = String(input.to || "");
    const text = String(input.text || "").trim();
    if (!tokenCipher) return send(res, 409, JSON.stringify({ error: "Konfigurasi Fonnte belum lengkap. Simpan token API Fonnte terlebih dahulu." })), true;
    if (!normalizeWhatsAppNumber(to) || !text || text.length > 4000) return send(res, 400, JSON.stringify({ error: "Nomor tujuan atau isi pesan tidak valid." })), true;
    const result = await sendFonnteMessage(tokenCipher, to, text);
    auditPlatform("Mengirim pesan WhatsApp melalui Fonnte", `Pesan terkirim ke ${normalizeWhatsAppNumber(to)}`);
    return send(res, 200, JSON.stringify({ ok: true, messageId: result.id || "" })), true;
  }
  if (req.method === "GET" && pathname === "/api/platform/telegram-backup") {
    const config = getPlatformTelegramBackup.get();
    return send(res, 200, JSON.stringify({
      chatId: config.chat_id,
      backupTime: config.backup_time,
      timezone: config.timezone,
      enabled: Boolean(config.enabled),
      tokenConfigured: Boolean(config.token_cipher)
    })), true;
  }
  if (req.method === "PUT" && pathname === "/api/platform/telegram-backup") {
    const input = await readJsonBody(req, 32_000);
    const current = getPlatformTelegramBackup.get();
    const chatId = String(input.chatId || "").trim();
    const token = String(input.botToken || "").trim();
    const backupTime = String(input.backupTime || "16:00");
    const timezone = String(input.timezone || "Asia/Jakarta");
    const enabled = Boolean(input.enabled);
    if (chatId && !/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(chatId)) {
      return send(res, 400, JSON.stringify({ error: "ID atau username tujuan Telegram tidak valid." })), true;
    }
    if (token && !/^\d{6,20}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return send(res, 400, JSON.stringify({ error: "Format token bot Telegram tidak valid." })), true;
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(backupTime)) {
      return send(res, 400, JSON.stringify({ error: "Jam backup harus berformat HH:MM." })), true;
    }
    if (!timezones.has(timezone)) return send(res, 400, JSON.stringify({ error: "Zona waktu tidak didukung." })), true;
    const tokenCipher = token ? encryptToken(token) : current.token_cipher;
    if (enabled && (!chatId || !tokenCipher)) {
      return send(res, 400, JSON.stringify({ error: "Isi ID Telegram dan token bot sebelum mengaktifkan auto backup." })), true;
    }
    savePlatformTelegramBackup.run(
      chatId, tokenCipher, backupTime, timezone, enabled ? 1 : 0,
      current.backup_time === backupTime && current.timezone === timezone ? current.last_run_date : ""
    );
    const updated = getPlatformTelegramBackup.get();
    auditPlatform("Memperbarui auto backup Telegram Super Admin", `${enabled ? "Aktif" : "Nonaktif"} · ${backupTime} ${timezone}`);
    return send(res, 200, JSON.stringify({
      ok: true, enabled: Boolean(updated.enabled), backupTime: updated.backup_time,
      timezone: updated.timezone, tokenConfigured: Boolean(updated.token_cipher)
    })), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/telegram-backup/test") {
    const config = getPlatformTelegramBackup.get();
    if (!config.chat_id || !config.token_cipher) {
      return send(res, 400, JSON.stringify({ error: "Simpan ID Telegram dan token bot terlebih dahulu." })), true;
    }
    try {
      await telegramRequest(decryptToken(config.token_cipher), "sendMessage", JSON.stringify({
        chat_id: config.chat_id,
        text: "Uji koneksi auto backup Telegram Sarprah SaaS berhasil."
      }));
    } catch (error) {
      return send(res, 502, JSON.stringify({ error: error.message || "Uji koneksi Telegram gagal." })), true;
    }
    auditPlatform("Menguji auto backup Telegram Super Admin", config.chat_id);
    return send(res, 200, JSON.stringify({ ok: true })), true;
  }
  if (req.method === "GET" && pathname === "/api/platform/backup") {
    const backup = fullPlatformBackup();
    auditPlatform("Membuat backup platform", backup.createdAt);
    return send(res, 200, JSON.stringify(backup), "application/json; charset=utf-8", {
      "Content-Disposition": `attachment; filename="sarprah-saas-backup-${backup.createdAt.slice(0, 10)}.json"`
    }), true;
  }
  if (req.method === "POST" && pathname === "/api/platform/restore") {
    const backup = await readJsonBody(req, 50_000_000);
    if (!backup || backup.app !== "Sarprah SaaS" || backup.formatVersion !== 1 ||
        !backup.platform || typeof backup.platform.settings !== "object" || !Array.isArray(backup.platform.plans) ||
        !Array.isArray(backup.schools) || backup.schools.length > 10000 ||
        !Array.isArray(backup.auditLogs)) return send(res, 400, JSON.stringify({ error: "File backup platform tidak valid atau formatnya tidak didukung." })), true;
    if (backup.superAdmins !== undefined && (!Array.isArray(backup.superAdmins) || !backup.superAdmins.length || backup.superAdmins.length > 20 ||
        backup.superAdmins.some((entry) => !entry.id || !/^[a-z0-9._-]{3,32}$/i.test(entry.username || "") ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email || "") ||
          !/^[\da-f]{32}$/i.test(entry.password_salt || "") || !/^[\da-f]{64}$/i.test(entry.password_hash || "")))) {
      return send(res, 400, JSON.stringify({ error: "Data Super Admin pada backup tidak valid." })), true;
    }
    const ids = new Set();
    const codes = new Set();
    for (const entry of backup.schools) {
      const school = entry?.school;
      if (!school?.id || !/^[A-Z0-9]{4}$/i.test(school.code || "") || !entry.state ||
          !Array.isArray(entry.state.accounts) ||
          entry.state.accounts.filter((account) => account.role === "Administrator").length !== 1 ||
          ids.has(school.id) || codes.has(String(school.code).toUpperCase())) {
        return send(res, 400, JSON.stringify({ error: "Data sekolah pada backup tidak valid atau memiliki kode duplikat." })), true;
      }
      ids.add(school.id);
      school.code = String(school.code).toUpperCase();
      codes.add(school.code);
    }
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM saas_tenant_states").run();
      db.prepare("DELETE FROM saas_schools").run();
      backup.schools.forEach(({ school, state }) => {
        saveSchoolRow.run(school.id, school.code, JSON.stringify(school));
        saveTenantStateRow.run(school.id, JSON.stringify(state));
      });
      backup.platform.schools = backup.schools.map(({ school }) => school);
      savePlatformState(backup.platform);
      db.prepare("DELETE FROM saas_audit_logs").run();
      backup.auditLogs.slice(-2000).forEach((entry) => saveAuditRow.run(entry.id || crypto.randomUUID(), JSON.stringify(entry)));
      db.prepare("DELETE FROM saas_tenant_sessions").run();
      db.prepare("DELETE FROM saas_tenant_telegram_backup").run();
      if (backup.telegramBackups !== undefined && !Array.isArray(backup.telegramBackups)) {
        throw new Error("Daftar konfigurasi Telegram pada backup tidak valid.");
      }
      const tenantTelegramBackups = Array.isArray(backup.telegramBackups)
        ? backup.telegramBackups
        : backup.telegramBackup && backup.schools.length
          ? [{ ...backup.telegramBackup, school_id: backup.schools[0].school.id }]
          : [];
      const telegramSchoolIds = new Set();
      for (const telegram of tenantTelegramBackups) {
        if (!telegram?.school_id || !ids.has(telegram.school_id) || telegramSchoolIds.has(telegram.school_id) ||
            typeof telegram.chat_id !== "string" || typeof telegram.token_cipher !== "string" ||
            !/^\d{2}:\d{2}$/.test(telegram.backup_time || "") ||
            Number(telegram.backup_time.slice(0, 2)) > 23 || Number(telegram.backup_time.slice(3, 5)) > 59 ||
            !timezones.has(telegram.timezone)) {
          throw new Error("Konfigurasi Telegram per sekolah pada backup tidak valid.");
        }
        telegramSchoolIds.add(telegram.school_id);
        saveTenantTelegramConfig.run(
          telegram.school_id,
          telegram.chat_id,
          telegram.token_cipher,
          telegram.backup_time,
          telegram.timezone,
          telegram.enabled ? 1 : 0,
          String(telegram.last_run_date || "")
        );
      }
      db.prepare("DELETE FROM saas_tenant_whatsapp_notifications").run();
      if (backup.whatsappNotifications !== undefined && !Array.isArray(backup.whatsappNotifications)) {
        throw new Error("Daftar pengaturan notifikasi WhatsApp pada backup tidak valid.");
      }
      const whatsappSchoolIds = new Set();
      for (const config of backup.whatsappNotifications || []) {
        if (!config?.school_id || !ids.has(config.school_id) || whatsappSchoolIds.has(config.school_id) ||
            typeof config.token_cipher !== "string" ||
            !Number.isInteger(Number(config.reminder_days)) || Number(config.reminder_days) < 0 || Number(config.reminder_days) > 30 ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(config.send_time || "") ||
            !timezones.has(config.timezone)) {
          throw new Error("Pengaturan notifikasi WhatsApp pada backup tidak valid.");
        }
        whatsappSchoolIds.add(config.school_id);
        saveTenantWhatsAppConfig.run(
          config.school_id,
          config.token_cipher,
          config.enabled ? 1 : 0,
          config.notify_loans ? 1 : 0,
          config.notify_procurements ? 1 : 0,
          Number(config.reminder_days),
          config.send_time,
          config.timezone,
          String(config.last_run_date || "")
        );
      }
      if (backup.telegramBackup) {
        const telegram = backup.telegramBackup;
        if (typeof telegram.chat_id !== "string" || typeof telegram.token_cipher !== "string" ||
            typeof telegram.backup_time !== "string" || typeof telegram.timezone !== "string" ||
            !timezones.has(telegram.timezone)) throw new Error("Konfigurasi Telegram pada backup tidak valid.");
        saveTelegramConfig.run(telegram.chat_id, telegram.token_cipher, telegram.backup_time, telegram.timezone, telegram.enabled ? 1 : 0);
      }
      const platformTelegram = backup.platformTelegramBackup || {
        chat_id: "", token_cipher: "", backup_time: "16:00", timezone: "Asia/Jakarta", enabled: 0, last_run_date: ""
      };
      if (backup.platformTelegramBackup !== undefined &&
          (typeof platformTelegram.chat_id !== "string" || typeof platformTelegram.token_cipher !== "string" ||
           !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(platformTelegram.backup_time || "") ||
           !timezones.has(platformTelegram.timezone) ||
           ![0, 1, false, true].includes(platformTelegram.enabled))) {
        throw new Error("Konfigurasi backup Telegram Super Admin pada backup tidak valid.");
      }
      savePlatformTelegramBackup.run(
        platformTelegram.chat_id,
        platformTelegram.token_cipher,
        platformTelegram.backup_time,
        platformTelegram.timezone,
        platformTelegram.enabled ? 1 : 0,
        String(platformTelegram.last_run_date || "")
      );
      if (backup.superAdmins) {
        db.prepare("DELETE FROM saas_sessions").run();
        db.prepare("DELETE FROM saas_super_admins").run();
        const insertAdmin = db.prepare("INSERT INTO saas_super_admins (id, username, email, name, password_salt, password_hash) VALUES (?, ?, ?, ?, ?, ?)");
        backup.superAdmins.forEach((entry) => insertAdmin.run(entry.id, entry.username, entry.email, entry.name, entry.password_salt, entry.password_hash));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    auditPlatform("Memulihkan backup platform", backup.createdAt || "");
    return send(res, 200, JSON.stringify({ ok: true, schools: backup.schools.length })), true;
  }
  return send(res, 404, JSON.stringify({ error: "Endpoint platform tidak ditemukan." })), true;
}

async function handlePaymentWebhook(req, res, provider) {
  let rawBody;
  let payload;
  let orderId = "";
  let eventId = "";
  let amount = NaN;
  let eventStatus = "";
  try {
    rawBody = await readRawBody(req);
    if (provider === "duitku") {
      payload = Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")));
    } else {
      payload = JSON.parse(rawBody.toString("utf8"));
    }
    const config = platformState().settings.paymentGateways?.[provider];
    if (!config?.enabled) return send(res, 404, JSON.stringify({ error: "Gateway tidak aktif." }));
    if (provider === "kasera") {
      const signature = String(req.headers["kasera-signature-v1"] || "");
      const parts = signature.split(",");
      const timestampPart = parts.find((part) => part.startsWith("t="));
      const timestamp = Number(timestampPart?.slice(2));
      if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
        return send(res, 401, JSON.stringify({ error: "Timestamp signature Kasera tidak valid." }));
      }
      const secret = decryptToken(config.webhookSecretCipher);
      const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
      const validSignature = parts.filter((part) => part.startsWith("v1="))
        .some((part) => secureStringEqual(part.slice(3), expected));
      if (!validSignature) return send(res, 401, JSON.stringify({ error: "Signature webhook Kasera tidak valid." }));
      if (config.environment === "production" && payload.livemode !== true || config.environment === "sandbox" && payload.livemode === true) {
        return send(res, 401, JSON.stringify({ error: "Mode webhook Kasera tidak sesuai konfigurasi." }));
      }
      eventId = String(req.headers["kasera-event-id"] || payload.id || "");
      eventStatus = String(payload.type || "");
      orderId = String(payload.data?.external_id || "");
      amount = Number(payload.data?.amount);
    } else if (provider === "xendit") {
      const token = decryptToken(config.callbackTokenCipher);
      if (!secureStringEqual(req.headers["x-callback-token"], token)) {
        return send(res, 401, JSON.stringify({ error: "Callback verification token Xendit tidak valid." }));
      }
      eventId = String(payload.id || "");
      eventStatus = String(payload.status || "").toUpperCase();
      orderId = String(payload.external_id || "");
      amount = Number(payload.paid_amount ?? payload.amount);
    } else {
      const apiKey = decryptToken(config.apiKeyCipher);
      const merchantCode = String(payload.merchantCode || "");
      const receivedSignature = String(payload.signature || "");
      const expected = crypto.createHmac("sha256", apiKey)
        .update(`${merchantCode}${payload.amount || ""}${payload.merchantOrderId || ""}`).digest("hex");
      if (merchantCode !== config.merchantCode || !secureStringEqual(receivedSignature, expected)) {
        return send(res, 401, JSON.stringify({ error: "Signature callback Duitku tidak valid." }));
      }
      eventId = String(payload.reference || "");
      eventStatus = String(payload.resultCode || "");
      orderId = String(payload.merchantOrderId || "");
      amount = Number(payload.amount);
    }
    if (!orderId || !Number.isSafeInteger(amount) || amount < 1) return send(res, 400, JSON.stringify({ error: "Data callback pembayaran tidak lengkap." }));
    const data = platformState();
    const payment = data.payments.find((entry) => entry.gateway === provider && entry.gatewayOrderId === orderId);
    if (!payment) return send(res, 404, JSON.stringify({ error: "Referensi tagihan tidak ditemukan." }));
    if (amount !== Math.trunc(Number(payment.amount))) return send(res, 400, JSON.stringify({ error: "Nominal callback tidak sesuai tagihan." }));
    if (eventId && (payment.gatewayEventIds || []).includes(eventId)) return send(res, 200, JSON.stringify({ received: true, duplicate: true }));
    if (eventId) payment.gatewayEventIds = [...(payment.gatewayEventIds || []), eventId].slice(-30);
    let paid = provider === "kasera"
      ? eventStatus === "payment.paid" && payload.data?.status === "succeeded"
      : provider === "xendit"
        ? eventStatus === "PAID"
        : eventStatus === "00";
    if (paid) {
      approvePlatformPayment(data, payment, provider);
      payment.gatewayStatus = "paid";
    } else if (provider === "kasera" && eventStatus === "payment.expired"
      || provider === "xendit" && eventStatus === "EXPIRED") {
      payment.gatewayStatus = "expired";
    } else if (provider === "duitku" && eventStatus === "01") {
      payment.gatewayStatus = "failed";
    }
    savePlatformState(data);
    if (paid) auditPlatform(`Pembayaran terverifikasi melalui ${provider}`, `${payment.schoolCode} · ${payment.id}`, payment.schoolId);
    return send(res, 200, JSON.stringify({ received: true }));
  } catch (error) {
    console.error(`Webhook ${provider} gagal diproses:`, error);
    return send(res, 400, JSON.stringify({ error: "Callback pembayaran tidak dapat diproses." }));
  }
}

async function handleApi(req, res) {
  const paymentWebhook = req.method === "POST"
    ? /^\/api\/payments\/webhook\/(kasera|xendit|duitku)$/.exec(new URL(req.url, "http://localhost").pathname)
    : null;
  if (paymentWebhook) return handlePaymentWebhook(req, res, paymentWebhook[1]);
  if (req.method !== "GET" && !verifyOrigin(req)) return send(res, 403, JSON.stringify({ error: "Origin permintaan tidak diizinkan." }));
  const platformHandled = await handlePlatformApi(req, res);
  if (platformHandled !== false) return;
  if (req.method === "GET" && req.url === "/api/auth/session") {
    const session = sessionFromRequest(req);
    if (!session) return send(res, 200, JSON.stringify({ user: null }));
    const blocked = tenantAccessError(session.school);
    if (blocked) return send(res, blocked.status, JSON.stringify({ error: blocked.message }));
    return send(res, 200, JSON.stringify({
      user: { id: session.account.id, name: session.account.name, role: session.account.role },
      school: { id: session.school.id, code: session.school.code, name: session.school.name, publicPortalEnabled: session.school.publicPortalEnabled !== false },
      featureAccess: session.school.featureAccess || {}
    }));
  }
  const publicInventoryMatch = req.method === "GET"
    ? /^\/api\/public\/school\/([A-Z0-9]{4})\/inventory$/i.exec(new URL(req.url, "http://localhost").pathname)
    : null;
  if (publicInventoryMatch) {
    const schoolCode = publicInventoryMatch[1].toUpperCase();
    const schoolRow = getAllSchools.all().find(({ payload }) => JSON.parse(payload).code === schoolCode);
    if (!schoolRow) return send(res, 404, JSON.stringify({ error: "Portal sekolah tidak ditemukan atau tidak aktif." }));
    const school = JSON.parse(schoolRow.payload);
    if (school.publicPortalEnabled === false) return send(res, 404, JSON.stringify({ error: "Portal publik sekolah ini sedang dinonaktifkan." }));
    const accessError = tenantAccessError(school);
    if (accessError) return send(res, accessError.status, JSON.stringify({ error: accessError.message }));
    const state = tenantState(school.id);
    if (!state) return send(res, 404, JSON.stringify({ error: "Data inventaris tidak tersedia." }));
    const yearId = state.settings?.selectedAcademicYearId
      || state.academicYears?.find((year) => year.status === "Aktif")?.id
      || state.academicYears?.[0]?.id
      || "";
    const goods = (state.goods || []).filter((good) => !good.academicYearId || !yearId || good.academicYearId === yearId);
    const query = String(new URL(req.url, "http://localhost").searchParams.get("q") || "").trim().slice(0, 100).toLocaleLowerCase("id-ID");
    const scannedItem = query ? (state.items || []).find((item) => String(item.code || "").trim().toLocaleLowerCase("id-ID") === query) : null;
    const selectedGoods = goods.filter((good) => (!scannedItem || good.id === scannedItem.goodId)
      && (!query || scannedItem || String(good.name || "").toLocaleLowerCase("id-ID").includes(query)));
    const inventory = selectedGoods.slice(0, 500).map((good) => {
      const itemRows = (state.items || []).filter((item) => item.goodId === good.id);
      const total = Math.max(0, Number(good.quantity) || 0);
      const damaged = Math.min(total, itemRows.filter((item) => item.condition === "Rusak").length);
      const borrowed = Math.min(total - damaged, (state.loans || [])
        .filter((loan) => loan.goodId === good.id && ["Dipinjam", "Diterima"].includes(loan.status))
        .reduce((sum, loan) => sum + Math.max(0, Number(loan.quantity) || 0), 0));
      const available = Math.max(0, total - damaged - borrowed);
      return {
        name: String(good.name || ""),
        type: state.types?.find((type) => type.id === good.typeId)?.name || "",
        category: state.categories?.find((category) => category.id === good.categoryId)?.name || "",
        unit: state.units?.find((unit) => unit.id === good.unitId)?.name || "",
        total,
        available,
        damaged,
        borrowed,
        goodCondition: Math.max(0, total - damaged)
      };
    });
    return send(res, 200, JSON.stringify({ school: { name: school.name, code: school.code }, items: inventory }));
  }
  if (req.method === "GET" && req.url === "/api/branding") {
    const branding = platformState().settings.branding || {};
    return send(res, 200, JSON.stringify({
      appName: typeof branding.appName === "string" && branding.appName.trim() ? branding.appName : "Sarprah",
      appTagline: typeof branding.tagline === "string" ? branding.tagline : "Sistem Manajemen Sarana & Prasarana",
      appLogo: typeof branding.logo === "string" ? branding.logo : ""
    }));
  }
  if (req.method === "GET" && req.url === "/api/auth/registration-options") {
    const whatsapp = platformState().settings.whatsapp || {};
    return send(res, 200, JSON.stringify({ whatsappOtpRequired: whatsapp.registrationOtpEnabled === true }));
  }
  if (req.method === "POST" && req.url === "/api/auth/register-school/otp/send") {
    const input = await readJsonBody(req, 32_000);
    const whatsapp = platformState().settings.whatsapp || {};
    if (whatsapp.registrationOtpEnabled !== true) return send(res, 409, JSON.stringify({ error: "Verifikasi OTP pendaftaran sedang nonaktif." }));
    if (!whatsapp.fonnteTokenCipher) return send(res, 503, JSON.stringify({ error: "Layanan OTP belum dikonfigurasi. Hubungi administrator platform." }));
    const phone = normalizeWhatsAppNumber(input.phone);
    if (!phone) return send(res, 400, JSON.stringify({ error: "Nomor WhatsApp tidak valid. Gunakan format Indonesia, misalnya 081234567890." }));
    const now = Date.now();
    for (const [key, challenge] of registrationOtpChallenges) {
      if (challenge.expiresAt <= now) registrationOtpChallenges.delete(key);
    }
    const attemptsKey = `${req.socket.remoteAddress || "unknown"}:${phone}`;
    const recent = (registrationOtpSendAttempts.get(attemptsKey) || []).filter((timestamp) => now - timestamp < 900_000);
    if (recent.length >= 3) return send(res, 429, JSON.stringify({ error: "Terlalu banyak permintaan OTP untuk nomor ini. Coba lagi 15 menit." }));
    const ipKey = `ip:${req.socket.remoteAddress || "unknown"}`;
    const ipRecent = (registrationOtpSendAttempts.get(ipKey) || []).filter((timestamp) => now - timestamp < 900_000);
    if (ipRecent.length >= 10) return send(res, 429, JSON.stringify({ error: "Terlalu banyak permintaan OTP dari jaringan ini. Coba lagi 15 menit." }));
    const existing = registrationOtpChallenges.get(phone);
    if (existing && now - existing.sentAt < 60_000) {
      return send(res, 429, JSON.stringify({ error: "Tunggu sebelum meminta kode OTP baru.", retryAfter: Math.ceil((60_000 - (now - existing.sentAt)) / 1000) }));
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const digest = crypto.createHash("sha256").update(code).digest();
    registrationOtpChallenges.set(phone, { digest, attempts: 0, sentAt: now, expiresAt: now + 600_000 });
    recent.push(now);
    registrationOtpSendAttempts.set(attemptsKey, recent);
    ipRecent.push(now);
    registrationOtpSendAttempts.set(ipKey, ipRecent);
    const branding = platformState().settings.branding || {};
    const appName = String(branding.appName || "Sarprah").slice(0, 80);
    try {
      await sendFonnteMessage(whatsapp.fonnteTokenCipher, phone, `Kode OTP pendaftaran ${appName}: ${code}. Kode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.`);
    } catch (error) {
      registrationOtpChallenges.delete(phone);
      return send(res, 502, JSON.stringify({ error: `OTP tidak dapat dikirim melalui Fonnte: ${error.message}` }));
    }
    return send(res, 200, JSON.stringify({ ok: true, expiresIn: 600, retryAfter: 60 }));
  }
  if (req.method === "POST" && req.url === "/api/auth/register-school") {
    const now = Date.now();
    const ip = req.socket.remoteAddress || "unknown";
    const attempts = registrationAttempts.get(ip) || [];
    const recent = attempts.filter((at) => now - at < 900_000);
    if (recent.length >= 3) return send(res, 429, JSON.stringify({ error: "Terlalu banyak percobaan pendaftaran. Coba lagi 15 menit." }));
    recent.push(now);
    registrationAttempts.set(ip, recent);
    const input = await readJsonBody(req, 200_000);
    const otpEnabled = platformState().settings.whatsapp?.registrationOtpEnabled === true;
    if (otpEnabled) {
      const otpError = validateRegistrationOtp(input.school?.phone, input.otpCode);
      if (otpError) return send(res, 400, JSON.stringify({ error: otpError }));
    }
    const school = createSchoolTenant(input, { action: "Pendaftaran sekolah" });
    if (otpEnabled) registrationOtpChallenges.delete(normalizeWhatsAppNumber(input.school?.phone));
    return send(res, 201, JSON.stringify({
      ok: true,
      school: { code: school.code, name: school.name, status: school.status, trialEndsAt: school.trialEndsAt }
    }));
  }
  if (req.method === "POST" && req.url === "/api/auth/login") {
    const input = await readJsonBody(req, 32_000);
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const schoolCode = String(input.schoolCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(schoolCode)) return send(res, 400, JSON.stringify({ error: "Masukkan kode sekolah 4 karakter." }));
    const schoolRow = getAllSchools.all().find(({ payload }) => JSON.parse(payload).code === schoolCode);
    if (!schoolRow) return send(res, 401, JSON.stringify({ error: "Kode sekolah tidak ditemukan." }));
    const school = JSON.parse(schoolRow.payload);
    const blocked = tenantAccessError(school);
    if (blocked) return send(res, blocked.status, JSON.stringify({ error: blocked.message }));
    const state = tenantState(school.id);
    const account = state?.accounts?.find((row) => row.email.toLowerCase() === email && row.active);
    const isDemoAdmin = email === "admin@sarprah.id" && password === "sarprah123";
    let valid = Boolean(account && account.passwordSalt && account.passwordHash && hashPassword(password, account.passwordSalt) === account.passwordHash);
    if (!valid && account && !account.passwordHash && isDemoAdmin && account.role === "Administrator") {
      account.passwordSalt = crypto.randomBytes(16).toString("hex");
      account.passwordHash = hashPassword(password, account.passwordSalt);
      saveTenantStateRow.run(school.id, JSON.stringify(state));
      valid = true;
    }
    if (!valid || !account) return send(res, 401, JSON.stringify({ error: "Email atau kata sandi tidak sesuai." }));
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 7 * 86400_000;
    db.prepare("INSERT INTO saas_tenant_sessions (token_hash, school_id, account_id, expires_at) VALUES (?, ?, ?, ?)")
      .run(crypto.createHash("sha256").update(token).digest("hex"), school.id, account.id, expiresAt);
    setSessionCookie(res, token, req, 7 * 86400);
    auditPlatform("Login sekolah", `${school.code} · ${email}`, school.id);
    return send(res, 200, JSON.stringify({
      user: { id: account.id, name: account.name, role: account.role },
      school: { id: school.id, code: school.code, name: school.name, publicPortalEnabled: school.publicPortalEnabled !== false },
      featureAccess: school.featureAccess || {}
    }));
  }
  if (req.method === "POST" && req.url === "/api/auth/logout") {
    const session = sessionFromRequest(req);
    if (session) {
      db.prepare("DELETE FROM saas_tenant_sessions WHERE token_hash = ?").run(session.tokenHash);
      auditPlatform("Logout sekolah", `${session.school.code} · ${session.account.email}`, session.schoolId);
    }
    setSessionCookie(res, "", req, 0);
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  const session = sessionFromRequest(req);
  if (!session) return send(res, 401, JSON.stringify({ error: "Silakan masuk untuk melanjutkan." }));
  const blocked = tenantAccessError(session.school);
  if (blocked) return send(res, blocked.status, JSON.stringify({ error: blocked.message }));
  if (!verifyOrigin(req)) return send(res, 403, JSON.stringify({ error: "Origin permintaan tidak diizinkan." }));
  if (req.method === "GET" && req.url === "/api/tenant/billing") {
    const data = platformState();
    const gatewayNames = { kasera: "Kasera Pay", xendit: "Xendit", duitku: "Duitku" };
    const gateways = Object.entries(data.settings.paymentGateways || {})
      .filter(([, config]) => config.enabled === true)
      .map(([id]) => ({ id, name: gatewayNames[id] }));
    const payments = data.payments.filter((payment) => payment.schoolId === session.schoolId)
      .map(({ id, type, period, amount, status, note, dueDate, createdAt, gateway, gatewayOrderId, gatewayStatus, checkoutUrl }) => ({
        id, type, period, amount, status, note, dueDate, createdAt, gateway, gatewayOrderId, gatewayStatus, checkoutUrl,
        gatewayName: gatewayNames[gateway] || ""
      }));
    return send(res, 200, JSON.stringify({ payments, gateways }));
  }
  if (req.method === "GET" && req.url === "/api/tenant/storage") {
    const state = tenantState(session.schoolId);
    const usedBytes = embeddedImageBytes(state || {});
    const quotaBytes = tenantStorageQuotaBytes();
    return send(res, 200, JSON.stringify({ usedBytes, quotaBytes, remainingBytes: Math.max(0, quotaBytes - usedBytes) }));
  }
  const tenantCheckoutMatch = req.url.match(/^\/api\/tenant\/billing\/([a-zA-Z0-9-]+)\/checkout$/);
  if (req.method === "POST" && tenantCheckoutMatch) {
    const input = await readJsonBody(req, 32_000);
    const provider = String(input.provider || "");
    if (!["kasera", "xendit", "duitku"].includes(provider)) return send(res, 400, JSON.stringify({ error: "Gateway pembayaran tidak valid." }));
    const data = platformState();
    const payment = data.payments.find((entry) => entry.id === tenantCheckoutMatch[1] && entry.schoolId === session.schoolId);
    if (!payment) return send(res, 404, JSON.stringify({ error: "Tagihan tidak ditemukan." }));
    if (["Disetujui", "Lunas", "Ditolak"].includes(payment.status)) return send(res, 409, JSON.stringify({ error: "Tagihan ini tidak lagi dapat dibayar." }));
    if (payment.gatewayOrderId && payment.gateway) {
      if (payment.gateway !== provider) return send(res, 409, JSON.stringify({ error: `Tagihan sudah dibuat melalui ${payment.gateway}. Gunakan gateway tersebut agar tidak terjadi pembayaran ganda.` }));
      if (payment.checkoutUrl) return send(res, 200, JSON.stringify({ checkoutUrl: payment.checkoutUrl, reused: true }));
    }
    try {
      const school = data.schools.find((entry) => entry.id === session.schoolId);
      if (!school) return send(res, 404, JSON.stringify({ error: "Data sekolah tidak ditemukan." }));
      const checkout = await createProviderCheckout(provider, payment, school, req);
      payment.gateway = provider;
      payment.gatewayOrderId = checkout.orderId;
      payment.gatewayReference = checkout.reference;
      payment.gatewayEnvironment = data.settings.paymentGateways[provider].environment;
      payment.checkoutUrl = checkout.checkoutUrl;
      payment.checkoutCreatedAt = new Date().toISOString();
      payment.gatewayStatus = "pending";
      savePlatformState(data);
      auditPlatform(`Membuat checkout ${provider}`, `${payment.schoolCode} · ${payment.id}`, payment.schoolId);
      return send(res, 200, JSON.stringify({ checkoutUrl: checkout.checkoutUrl, reused: false }));
    } catch (error) {
      return send(res, 502, JSON.stringify({ error: error.message || "Checkout tidak dapat dibuat." }));
    }
  }
  if (req.method === "PUT" && req.url === "/api/tenant/public-portal-settings") {
    if (session.account.role !== "Administrator") return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat mengatur Portal Publik." }));
    const input = await readJsonBody(req, 32_000);
    if (typeof input.enabled !== "boolean") return send(res, 400, JSON.stringify({ error: "Status Portal Publik tidak valid." }));
    const school = { ...session.school, publicPortalEnabled: input.enabled };
    const data = platformState();
    updatePlatformSchool(data, school);
    savePlatformState(data);
    auditPlatform("Mengubah Portal Publik", input.enabled ? "Portal inventaris diaktifkan." : "Portal inventaris dinonaktifkan.", school.id);
    return send(res, 200, JSON.stringify({ enabled: input.enabled }));
  }
  if ((req.url.startsWith("/api/telegram/") || req.url.startsWith("/api/whatsapp/")) && session.account.role !== "Administrator") {
    return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat mengelola integrasi pesan." }));
  }
  if (req.method === "PUT" && req.url === "/api/accounts") {
    if (session.account.role !== "Administrator") return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat mengelola akun." }));
    const input = await readJsonBody(req, 500_000);
    const state = tenantState(session.schoolId);
    if (!state || typeof state !== "object") return send(res, 409, JSON.stringify({ error: "Data aplikasi belum tersedia." }));
    state.accounts = validateAccounts(input.accounts, session.account.id);
    saveTenantStateRow.run(session.schoolId, JSON.stringify(state));
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (["GET /api/backup", "POST /api/restore"].includes(`${req.method} ${req.url}`) && session.account.role !== "Administrator") {
    return send(res, 403, JSON.stringify({ error: "Hanya Administrator yang dapat melakukan backup dan restore." }));
  }
  if (req.method === "GET" && req.url === "/api/state") {
    return send(res, 200, JSON.stringify({ state: tenantState(session.schoolId) }));
  }
  if (req.method === "PUT" && req.url === "/api/state") {
    const parsed = await readJsonBody(req);
    if (!parsed || typeof parsed.state !== "object" || parsed.state === null || Array.isArray(parsed.state)) {
      return send(res, 400, JSON.stringify({ error: "Format data tidak valid." }));
    }
    const storedState = tenantState(session.schoolId);
    if (!storedState) return send(res, 409, JSON.stringify({ error: "Data sekolah belum tersedia." }));
    if (!Array.isArray(parsed.state.accounts) || parsed.state.accounts.filter((account) => account.role === "Administrator").length !== 1) {
      return send(res, 400, JSON.stringify({ error: "Data harus memiliki tepat satu akun Administrator." }));
    }
    if (session.account.role !== "Administrator") parsed.state.accounts = storedState.accounts;
    saveTenantStateRow.run(session.schoolId, JSON.stringify(parsed.state));
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && req.url === "/api/tenant/portal-content") {
    const data = platformState();
    return send(res, 200, JSON.stringify({
      terms: data.settings.terms || "",
      sla: data.settings.sla || "",
      announcements: data.announcements.filter((entry) => entry.active !== false),
      manuals: data.manuals.filter((entry) => entry.active !== false && (!entry.target || entry.target === "Akun Sekolah"))
    }));
  }
  if (req.method === "GET" && req.url === "/api/backup") {
    const backup = createBackup(session.schoolId);
    return send(res, 200, JSON.stringify(backup), "application/json; charset=utf-8", {
      "Content-Disposition": `attachment; filename="sarprah-backup-${backup.createdAt.slice(0, 10)}.json"`
    });
  }
  if (req.method === "POST" && req.url === "/api/restore") {
    const restoredState = validateBackup(await readJsonBody(req));
    const currentTenant = tenantState(session.schoolId);
    const currentAdmin = currentTenant?.accounts?.find((account) =>
      account.id === session.account.id && account.role === "Administrator" && account.active);
    if (!currentAdmin) return send(res, 409, JSON.stringify({ error: "Akun Administrator yang sedang masuk tidak ditemukan." }));
    restoredState.accounts = validateAccounts(
      restoredState.accounts.filter((account) =>
        account.role !== "Administrator" &&
        account.id !== currentAdmin.id &&
        String(account.email || "").toLowerCase() !== currentAdmin.email.toLowerCase()
      ).concat(currentAdmin),
      currentAdmin.id
    );
    saveTenantStateRow.run(session.schoolId, JSON.stringify(restoredState));
    return send(res, 200, JSON.stringify({ ok: true, adminCredentialsPreserved: true }));
  }
  if (req.method === "GET" && req.url === "/api/telegram/settings") {
    const config = getTenantTelegramConfig.get(session.schoolId) || {
      chat_id: "", backup_time: "16:00", timezone: "Asia/Jakarta", enabled: 0, token_cipher: ""
    };
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
    const config = getTenantTelegramConfig.get(session.schoolId) || {
      chat_id: "", backup_time: "16:00", timezone: "Asia/Jakarta", enabled: 0, last_run_date: "", token_cipher: ""
    };
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
    saveTenantTelegramConfig.run(session.schoolId, chatId, tokenCipher, backupTime, timezone, enabled ? 1 : 0, config.last_run_date || "");
    const updated = getTenantTelegramConfig.get(session.schoolId);
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
    const config = getTenantTelegramConfig.get(session.schoolId);
    if (!config) throw new Error("Simpan pengaturan Telegram sekolah terlebih dahulu.");
    const token = decryptToken(config.token_cipher);
    if (!config.chat_id || !token) throw new Error("Simpan ID Telegram dan token bot terlebih dahulu.");
    const result = await telegramRequest(token, "sendMessage", JSON.stringify({
      chat_id: config.chat_id,
      text: "Koneksi Telegram Sarprah berhasil. Backup otomatis siap dijalankan."
    }));
    return send(res, 200, JSON.stringify({ ok: true, messageId: result.result.message_id }));
  }
  if (req.method === "GET" && req.url === "/api/whatsapp/settings") {
    const config = getTenantWhatsAppConfig.get(session.schoolId) || {
      token_cipher: "", enabled: 0, notify_loans: 1, notify_procurements: 1,
      reminder_days: 1, send_time: "08:00", timezone: "Asia/Jakarta"
    };
    const tenant = tenantState(session.schoolId);
    return send(res, 200, JSON.stringify({
      enabled: Boolean(config.enabled),
      notifyLoans: Boolean(config.notify_loans),
      notifyProcurements: Boolean(config.notify_procurements),
      reminderDays: Number(config.reminder_days),
      sendTime: config.send_time,
      timezone: config.timezone,
      tokenConfigured: Boolean(config.token_cipher),
      principalWhatsapp: tenant?.school?.principalWhatsapp || ""
    }));
  }
  if (req.method === "PUT" && req.url === "/api/whatsapp/settings") {
    const input = await readJsonBody(req, 32_000);
    const config = getTenantWhatsAppConfig.get(session.schoolId) || {
      token_cipher: "", last_run_date: ""
    };
    const token = String(input.fonnteToken || "").trim();
    const enabled = Boolean(input.enabled);
    const notifyLoans = Boolean(input.notifyLoans);
    const notifyProcurements = Boolean(input.notifyProcurements);
    const reminderDays = Number(input.reminderDays);
    const sendTime = String(input.sendTime || "08:00");
    const timezone = String(input.timezone || "Asia/Jakarta");
    const tenant = tenantState(session.schoolId);
    if (token && !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return send(res, 400, JSON.stringify({ error: "Format token Fonnte tidak valid." }));
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) return send(res, 400, JSON.stringify({ error: "Pengingat peminjaman harus antara 0 sampai 30 hari." }));
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) return send(res, 400, JSON.stringify({ error: "Waktu pengiriman harus berformat HH:MM." }));
    if (!timezones.has(timezone)) return send(res, 400, JSON.stringify({ error: "Zona waktu tidak didukung." }));
    if (enabled && notifyProcurements && !normalizeWhatsAppNumber(tenant?.school?.principalWhatsapp)) return send(res, 400, JSON.stringify({ error: "Nomor WhatsApp Kepala Sekolah yang valid diperlukan untuk notifikasi pengadaan." }));
    const tokenCipher = token ? encryptToken(token) : config.token_cipher;
    if (enabled && (notifyLoans || notifyProcurements) && !tokenCipher) return send(res, 400, JSON.stringify({ error: "Masukkan token Fonnte sebelum mengaktifkan notifikasi." }));
    saveTenantWhatsAppConfig.run(
      session.schoolId, tokenCipher, enabled ? 1 : 0, notifyLoans ? 1 : 0,
      notifyProcurements ? 1 : 0, reminderDays, sendTime, timezone, config.last_run_date || ""
    );
    const updated = getTenantWhatsAppConfig.get(session.schoolId);
    return send(res, 200, JSON.stringify({
      ok: true, enabled: Boolean(updated.enabled), notifyLoans: Boolean(updated.notify_loans),
      notifyProcurements: Boolean(updated.notify_procurements), reminderDays: Number(updated.reminder_days),
      sendTime: updated.send_time, timezone: updated.timezone, tokenConfigured: Boolean(updated.token_cipher)
    }));
  }
  if (req.method === "POST" && req.url === "/api/whatsapp/test") {
    const config = getTenantWhatsAppConfig.get(session.schoolId);
    const tenant = tenantState(session.schoolId);
    const recipient = tenant?.school?.principalWhatsapp || "";
    if (!config?.token_cipher) return send(res, 400, JSON.stringify({ error: "Simpan token Fonnte terlebih dahulu." }));
    if (!normalizeWhatsAppNumber(recipient)) return send(res, 400, JSON.stringify({ error: "Isi nomor WhatsApp Kepala Sekolah pada Profil Sekolah terlebih dahulu." }));
    await sendFonnteMessage(config.token_cipher, recipient, `Uji koneksi WhatsApp Sarprah ${tenant.school.name || ""}. Notifikasi siap digunakan.`);
    return send(res, 200, JSON.stringify({ ok: true }));
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
    const requested = pathname === "/" ? "index.html"
      : ["/super-admin", "/super-admin/"].includes(pathname) ? "super-admin.html"
        : /^\/portal\/[A-Z0-9]{4}\/?$/i.test(pathname) || pathname === "/public-portal" ? "public-portal.html"
        : pathname.replace(/^\/+/, "");
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

let telegramBackupSchedulerRunning = false;
async function runTelegramBackupIfDue() {
  if (telegramBackupSchedulerRunning) return;
  telegramBackupSchedulerRunning = true;
  try {
    for (const config of getEnabledTenantTelegramConfigs.all()) {
      const local = getLocalDateParts(config.timezone);
      const date = `${local.year}-${local.month}-${local.day}`;
      if (`${local.hour}:${local.minute}` !== config.backup_time || config.last_run_date === date) continue;
      setTenantLastRun.run(date, config.school_id);
      try {
        await sendTelegramBackup(config, config.school_id);
        console.log(`Backup Telegram sekolah ${config.school_id} berhasil (${date}, ${config.timezone}).`);
      } catch (error) {
        setTenantLastRun.run("", config.school_id);
        console.error(`Backup Telegram sekolah ${config.school_id} gagal: ${error.message}`);
      }
    }
    const platformConfig = getEnabledPlatformTelegramBackup.get();
    if (platformConfig) {
      const local = getLocalDateParts(platformConfig.timezone);
      const date = `${local.year}-${local.month}-${local.day}`;
      if (`${local.hour}:${local.minute}` === platformConfig.backup_time && platformConfig.last_run_date !== date) {
        setPlatformTelegramLastRun.run(date);
        try {
          await sendPlatformTelegramBackup(platformConfig);
          console.log(`Backup Telegram platform berhasil (${date}, ${platformConfig.timezone}).`);
        } catch (error) {
          setPlatformTelegramLastRun.run("");
          console.error(`Backup Telegram platform gagal: ${error.message}`);
        }
      }
    }
  } finally {
    telegramBackupSchedulerRunning = false;
  }
}

let whatsappSchedulerRunning = false;
async function runWhatsAppNotificationsIfDue() {
  if (whatsappSchedulerRunning) return;
  whatsappSchedulerRunning = true;
  try {
    for (const config of getEnabledTenantWhatsAppConfigs.all()) {
      const state = tenantState(config.school_id);
      if (!state) continue;
      const schoolName = state.school?.name || "Sekolah";
      const todayParts = getLocalDateParts(config.timezone);
      const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
      const isReminderTime = `${todayParts.hour}:${todayParts.minute}` === config.send_time;
      let changed = false;
      const principalPhone = state.school?.principalWhatsapp || "";
      if (config.notify_procurements && principalPhone) {
        for (const procurement of state.procurements || []) {
          if (procurement.status !== "Pengajuan" || procurement.whatsappNotifiedAt || procurement.whatsappAttemptDate === today) continue;
          procurement.whatsappAttemptDate = today;
          changed = true;
          try {
            const good = (state.goods || []).find((row) => row.id === procurement.goodId);
            await sendFonnteMessage(config.token_cipher, principalPhone,
              `Pengajuan pengadaan baru di ${schoolName}: ${procurement.title || good?.name || "Barang"}. Prioritas: ${procurement.priority || "Normal"}. Pengusul: ${procurement.proposer || "—"}. Silakan tinjau di Sarprah.`);
            procurement.whatsappNotifiedAt = new Date().toISOString();
            delete procurement.whatsappLastError;
          } catch (error) {
            procurement.whatsappLastError = error.message;
            console.error(`Notifikasi pengadaan WhatsApp gagal untuk sekolah ${config.school_id}: ${error.message}`);
          }
        }
      }
      if (config.notify_loans && isReminderTime && config.last_run_date !== today) {
        for (const loan of state.loans || []) {
          if (!["Diterima", "Dipinjam"].includes(loan.status) || !loan.whatsapp || !loan.dueDate) continue;
          const dueTimestamp = Date.parse(`${loan.dueDate}T00:00:00Z`);
          const todayTimestamp = Date.parse(`${today}T00:00:00Z`);
          if (!Number.isFinite(dueTimestamp) || !Number.isFinite(todayTimestamp)) continue;
          const remainingDays = Math.round((dueTimestamp - todayTimestamp) / 86_400_000);
          if (remainingDays > Number(config.reminder_days)) continue;
          const reminderKey = remainingDays < 0 ? `overdue-${loan.dueDate}` : `due-${loan.dueDate}`;
          if (loan.whatsappReminderSentKey === reminderKey || loan.whatsappReminderAttemptDate === today) continue;
          loan.whatsappReminderAttemptDate = today;
          changed = true;
          try {
            const good = (state.goods || []).find((row) => row.id === loan.goodId);
            const message = remainingDays < 0
              ? `Pengingat Sarprah ${schoolName}: peminjaman ${good?.name || "barang"} sudah terlambat ${Math.abs(remainingDays)} hari. Mohon segera mengembalikan barang.`
              : `Pengingat Sarprah ${schoolName}: masa pinjam ${good?.name || "barang"} akan berakhir ${remainingDays === 0 ? "hari ini" : `dalam ${remainingDays} hari`} (jatuh tempo ${loan.dueDate}).`;
            await sendFonnteMessage(config.token_cipher, loan.whatsapp, message);
            loan.whatsappReminderSentKey = reminderKey;
            loan.whatsappReminderSentAt = new Date().toISOString();
            delete loan.whatsappReminderLastError;
          } catch (error) {
            loan.whatsappReminderLastError = error.message;
            console.error(`Pengingat peminjaman WhatsApp gagal untuk sekolah ${config.school_id}: ${error.message}`);
          }
        }
        setTenantWhatsAppLastRun.run(today, config.school_id);
      }
      if (changed) saveTenantStateRow.run(config.school_id, JSON.stringify(state));
    }
  } finally {
    whatsappSchedulerRunning = false;
  }
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Sarprah siap di http://localhost:${port}`);
});
setInterval(() => {
  runTelegramBackupIfDue().catch((error) => console.error(`Scheduler backup gagal: ${error.message}`));
  runWhatsAppNotificationsIfDue().catch((error) => console.error(`Scheduler WhatsApp gagal: ${error.message}`));
}, 15_000);
