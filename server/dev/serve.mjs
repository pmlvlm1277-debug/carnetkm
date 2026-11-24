// Serveur de DÉVELOPPEMENT LOCAL (jamais déployé) : sert l'application CarnetKM et le service de droits sur la même origine
// (/api/*), avec une base SQLite en mémoire, des clés et secrets FICTIFS générés au démarrage, et un faux Gumroad
// (/mock-gumroad/*). Utilisé par tests/server-e2e.test.mjs.
//   node --no-warnings server/dev/serve.mjs   → affiche l'adresse locale et la clé publique à injecter dans CONFIG
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { createLocalD1 } from "../src/d1-local.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain" };
const STATIC = new Set(["/index.html", "/app.js", "/sw.js", "/manifest.json", "/icon.svg", "/robots.txt"]);

export async function startDevServer({ port = 0, offerId = "offer_FICTIF_BUNDLE", gumroad = () => ({ success: false }) } = {}) {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const state = { now: Date.now(), gumroad, down: false };
  const env = {
    ENVIRONMENT: "development", DB: createLocalD1(join(HERE, "..", "schema.sql")),
    PEPPER: "pepper-dev-FICTIF-" + crypto.randomUUID() + crypto.randomUUID(),
    FW_WEBHOOK_SECRET: "fw-dev-FICTIF-" + crypto.randomUUID(),
    SIGNING_KEY: JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)), SIGNING_KID: "dev1",
    PUBLIC_KEYS: JSON.stringify({ dev1: pub }), ELIGIBLE_OFFER_IDS: offerId,
    GUMROAD_PRODUCTS: JSON.stringify([{ id: "FICTIF-LEGACY", plan: "pro", slot: "legacy" }, { id: "FICTIF-PLUS", plan: "plus", slot: "plus" }, { id: "FICTIF-PRO", plan: "pro", slot: "pro" }]),
    __clock: () => state.now
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (url.pathname.startsWith("/mock-gumroad/")) {
      const out = state.gumroad(Object.fromEntries(new URLSearchParams(body.toString())));
      res.writeHead(out.__status || 200, { "content-type": "application/json" }); return res.end(JSON.stringify(out));
    }
    if (url.pathname.startsWith("/api/")) {
      if (state.down) { res.writeHead(503); return res.end(); }
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const r = await worker.fetch(new Request("http://localhost" + url.pathname.slice(4) + url.search, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }), env);
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!STATIC.has(p) && !/^\/fonts\/[\w.-]+$/.test(p)) { res.writeHead(404); return res.end(); }
    try { const data = await readFile(normalize(join(ROOT, p))); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(data); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(port, "127.0.0.1", r));
  const base = `http://localhost:${server.address().port}`;
  env.ALLOWED_ORIGIN = base;
  env.GUMROAD_API_BASE = `http://127.0.0.1:${server.address().port}/mock-gumroad`;
  return { base, env, state, publicKeys: { dev1: pub }, close: () => new Promise(r => server.close(r)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startDevServer({ port: 8790 });
  console.log("CarnetKM + service de droits (local, fictif) :", s.base);
  console.log("Dans la console du navigateur : CONFIG.entitlements = {endpoint:'/api', keys:" + JSON.stringify(s.publicKeys) + "}; CONFIG.bundle.mode='server'; loadEntitlements().then(renderAll);");
}
