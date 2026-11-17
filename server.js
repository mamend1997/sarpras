const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const publicRoot = path.resolve(root);
const port = Number(process.env.PORT || 3000);
const dbPath = path.resolve(process.env.DB_PATH || path.join(root, "sarprah.sqlite"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const getState = db.prepare("SELECT payload FROM app_state WHERE id = 1");
const saveState = db.prepare(`
  INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".ico": "image/x-icon"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/state") {
    const row = getState.get();
    return send(res, 200, JSON.stringify({ state: row ? JSON.parse(row.payload) : null }));
  }
  if (req.method === "PUT" && req.url === "/api/state") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed.state !== "object" || parsed.state === null || Array.isArray(parsed.state)) {
          return send(res, 400, JSON.stringify({ error: "Format data tidak valid." }));
        }
        saveState.run(JSON.stringify(parsed.state));
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch {
        return send(res, 400, JSON.stringify({ error: "Data JSON tidak valid." }));
      }
    });
    return;
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
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sarprah siap di http://localhost:${port}`);
});
