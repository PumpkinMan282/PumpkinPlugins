const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  try {
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith("\"") && val.endsWith("\"")) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!key) continue;
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = val;
      }
    }
  } catch {
    // ignore .env parse errors; env vars still work
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".jar": "application/java-archive"
};

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    "content-length": buf.length,
    ...headers
  });
  res.end(buf);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "content-type": "application/json; charset=utf-8"
  });
}

function safeJoin(base, reqPath) {
  const clean = reqPath.split("?")[0].split("#")[0];
  const decoded = decodeURIComponent(clean);
  const normalized = path.posix.normalize(decoded).replaceAll("\\", "/");
  const rel = normalized.replace(/^\/+/, "");
  const abs = path.join(base, rel);
  if (!abs.startsWith(base)) return null;
  return abs;
}

async function readJsonBody(req, { limitBytes }) {
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > limitBytes) throw new Error("Payload too large");
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const ipHits = new Map(); // ip -> number[] (timestamps ms)
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const perHour = 5;
  const perMinute = 1;

  const arr = ipHits.get(ip) || [];
  const recent = arr.filter((t) => now - t < windowMs);
  const minuteCount = recent.filter((t) => now - t < 60 * 1000).length;
  if (recent.length >= perHour) return { ok: false, retryAfterSec: 60 * 10 };
  if (minuteCount >= perMinute) return { ok: false, retryAfterSec: 60 };

  recent.push(now);
  ipHits.set(ip, recent);
  return { ok: true };
}

async function handleContact(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    res.setHeader("retry-after", String(rl.retryAfterSec || 60));
    return json(res, 429, { ok: false, error: "Rate limited" });
  }

  if (!DISCORD_WEBHOOK_URL) {
    return json(res, 500, {
      ok: false,
      error: "Server missing DISCORD_WEBHOOK_URL"
    });
  }

  let body;
  try {
    body = await readJsonBody(req, { limitBytes: 40 * 1024 });
  } catch (e) {
    return json(res, 400, { ok: false, error: "Invalid JSON" });
  }

  const name = String(body?.name || "").trim().slice(0, 120);
  const contact = String(body?.contact || body?.email || "").trim().slice(0, 200);
  const subject = String(body?.subject || "").trim().slice(0, 200);
  const message = String(body?.message || "").trim().slice(0, 4000);
  const website = String(body?.website || "").trim();

  // Honeypot: bots often fill hidden fields. Return OK to avoid signaling.
  if (website) return json(res, 200, { ok: true });

  if (!name || !contact || !message) {
    return json(res, 400, { ok: false, error: "Missing required fields" });
  }

  const lines = [
    "**New website contact**",
    `**Name:** ${name}`,
    subject ? `**Subject:** ${subject}` : null,
    `**Contact:** ${contact}`,
    "",
    message.length > 1900 ? message.slice(0, 1900) + "\n…(truncated)" : message
  ].filter(Boolean);

  try {
    const resp = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n") })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json(res, 502, {
        ok: false,
        error: `Discord webhook failed (${resp.status})`,
        detail: text.slice(0, 200)
      });
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 502, { ok: false, error: "Failed to reach Discord" });
  }
}

async function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const abs = safeJoin(PUBLIC_DIR, urlPath);
  if (!abs) return send(res, 400, "Bad request");

  try {
    const st = await fsp.stat(abs);
    if (st.isDirectory()) {
      const index = path.join(abs, "index.html");
      const s2 = await fsp.stat(index);
      if (!s2.isFile()) return send(res, 404, "Not found");
      const buf = await fsp.readFile(index);
      return send(res, 200, buf, { "content-type": MIME[".html"] });
    }
    if (!st.isFile()) return send(res, 404, "Not found");
    const ext = path.extname(abs).toLowerCase();
    const ct = MIME[ext] || "application/octet-stream";
    const stream = fs.createReadStream(abs);
    res.writeHead(200, { "content-type": ct });
    stream.pipe(res);
    stream.on("error", () => send(res, 500, "Server error"));
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && req.url === "/api/contact") {
      return await handleContact(req, res);
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(req, res);
    }
    send(res, 405, "Method not allowed");
  } catch {
    send(res, 500, "Server error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Pumpkin site running on http://localhost:${PORT}`);
  console.log(`Static root: ${PUBLIC_DIR}`);
  if (!DISCORD_WEBHOOK_URL) {
    console.log("Contact form disabled: set DISCORD_WEBHOOK_URL in your environment.");
  }
});
