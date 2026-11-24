// Service de droits CarnetKM — PROTOTYPE LOCAL (MISSION-CARNETKM-002-B). Non déployé.
// Compatible Cloudflare Workers (export default { fetch, scheduled }) avec une base D1 liée sous env.DB.
// Ne reçoit ni ne stocke aucun trajet, dépense, adresse ou renseignement fiscal.
import {
  addMonths, fingerprint, importSigningKey, normCode, normEmail, normOrderRef, randomCode, randomId,
  signToken, torontoDate, verifyFourthwallSignature, verifyToken
} from "./lib.js";

const TOKEN_TTL_S = 7 * 86400;          // jeton court : révocation effective en ≤ 7 jours (+ grâce hors ligne côté client)
const REFRESH_MAX_AGE_S = 60 * 86400;   // un jeton expiré depuis moins de 60 jours peut être renouvelé (bundle)
const MAX_GRANT_DEVICES = 3;            // réémissions d'un même droit bundle (changement d'appareil)
const MAX_LICENSE_DEVICES = 3;          // appareils par licence Gumroad (risque F2)
const MAX_UNITS_PER_OFFER = 10;
const BUNDLE_MONTHS = 3;

// ---------- configuration (échec fermé en production) ----------
function config(env) {
  const prod = env.ENVIRONMENT === "production";
  const c = {
    prod,
    fwSecret: env.FW_WEBHOOK_SECRET || "",
    pepper: env.PEPPER || "",
    signingKey: env.SIGNING_KEY || "",
    kid: env.SIGNING_KID || "",
    publicKeys: safeJson(env.PUBLIC_KEYS, {}),              // {kid: jwk} — clés acceptées au renouvellement (rotation)
    origin: env.ALLOWED_ORIGIN || "",
    eligible: new Set(String(env.ELIGIBLE_OFFER_IDS || "").split(",").map(s => s.trim()).filter(Boolean)),
    revokeStatuses: new Set(String(env.REVOKE_STATUSES || "CANCELLED,REFUNDED").split(",").map(s => s.trim().toUpperCase()).filter(Boolean)),
    products: safeJson(env.GUMROAD_PRODUCTS, []),             // [{id, plan:"plus"|"pro", slot}]
    gumroadBase: env.GUMROAD_API_BASE || "https://api.gumroad.com",
    acceptTest: env.ACCEPT_TEST_EVENTS === "true",
    now: typeof env.__clock === "function" ? env.__clock : Date.now   // horloge injectable en test seulement
  };
  const problems = [];
  if (!env.DB) problems.push("DB");
  if (c.pepper.length < 32) problems.push("PEPPER");
  if (!c.signingKey || !c.kid || !c.publicKeys[c.kid]) problems.push("SIGNING");
  if (!c.fwSecret) problems.push("FW_WEBHOOK_SECRET");
  if (!c.eligible.size) problems.push("ELIGIBLE_OFFER_IDS");
  if (prod) {
    if (!/^https:\/\//.test(c.origin)) problems.push("ALLOWED_ORIGIN");
    if (c.acceptTest) problems.push("ACCEPT_TEST_EVENTS");        // jamais d'événements de test en production
    if (typeof env.__clock === "function") problems.push("CLOCK");
    if (c.gumroadBase !== "https://api.gumroad.com") problems.push("GUMROAD_API_BASE");
  }
  c.problems = problems;
  return c;
}
function safeJson(v, dflt) { try { return v ? JSON.parse(v) : dflt; } catch { return dflt; } }

// ---------- réponses ----------
function json(c, body, status = 200, cors = true) {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
  if (cors && c.origin) { h["access-control-allow-origin"] = c.origin; h["vary"] = "Origin"; }
  return new Response(JSON.stringify(body), { status, headers: h });
}
const fail = (c, code, status) => json(c, { error: code }, status);
// Journal minimal : code d'événement et résultat seulement (aucune donnée personnelle, aucun secret).
const log = (evt, outcome) => console.log(JSON.stringify({ evt, outcome }));

async function readJson(req, max) {
  const len = +(req.headers.get("content-length") || 0);
  if (len > max) return null;
  const text = await req.text();
  if (text.length > max) return null;
  try { const o = JSON.parse(text); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; }
}

// ---------- limitation de débit (fenêtre fixe, atomique via UPSERT … RETURNING) ----------
async function hit(c, env, key, limit, windowS) {
  const win = Math.floor(c.now() / 1000 / windowS) * windowS;   // début de fenêtre, en secondes epoch
  const k = await fingerprint(c.pepper, "rate", key);
  const row = await env.DB.prepare(
    "INSERT INTO rate (k, win, n) VALUES (?1, ?2, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN rate.win = ?2 THEN rate.n + 1 ELSE 1 END, win = ?2 RETURNING n"
  ).bind(k, win).first();
  return row.n <= limit;
}
const clientIp = req => req.headers.get("cf-connecting-ip") || "local";

// ---------- jetons ----------
async function issue(c, payload) {
  const key = await importSigningKey(c.signingKey);
  const iat = Math.floor(c.now() / 1000);
  return signToken(key, c.kid, { iss: "carnetkm-entitlements", v: 1, iat, exp: iat + TOKEN_TTL_S, ...payload });
}
const grantPayload = g => ({ src: "bundle", sub: g.id, plan: g.plan, ent_start: g.start_date, ent_end: g.end_date });

// ---------- webhook Fourthwall ----------
async function fourthwallWebhook(req, env, c) {
  const raw = await req.text();
  if (raw.length > 256 * 1024) return fail(c, "too_large", 413);
  if (!(await verifyFourthwallSignature(c.fwSecret, raw, req.headers.get("x-fourthwall-hmac-sha256")))) { log("fw", "bad_signature"); return fail(c, "unauthorized", 401); }
  let ev; try { ev = JSON.parse(raw); } catch { return fail(c, "bad_request", 400); }
  if (!ev || typeof ev.id !== "string" || typeof ev.type !== "string") return fail(c, "bad_request", 400);
  if (ev.testMode === true && !c.acceptTest) { log("fw", "test_ignored"); return json(c, { ok: true, ignored: "test" }, 200, false); }
  const now = c.now(), data = ev.data || {};
  const stmts = [env.DB.prepare("INSERT OR IGNORE INTO fw_events (event_id, received_at) VALUES (?1, ?2)").bind(ev.id, now)];

  if (ev.type === "ORDER_PLACED") {
    // Champs supposés d'après la documentation Fourthwall (à confirmer par une livraison de test) : data.id, data.friendlyId, data.email, data.offers[].
    const order = data.order || data;
    if (typeof order.id !== "string" || typeof order.email !== "string" || !Array.isArray(order.offers)) return fail(c, "bad_request", 400);
    const orderIdH = await fingerprint(c.pepper, "order-id", order.id);
    const refH = await fingerprint(c.pepper, "order-ref", normOrderRef(order.friendlyId || order.id));
    const emailH = await fingerprint(c.pepper, "email", normEmail(order.email));
    let units = 0;
    for (const offer of order.offers) {
      const offerId = offer && (offer.id || offer.offerId);
      if (!c.eligible.has(offerId)) continue;
      const qty = Math.max(1, Math.min(MAX_UNITS_PER_OFFER, Math.floor(+(offer.variant?.quantity ?? offer.quantity ?? 1)) || 1));
      for (let u = 0; u < qty; u++) {
        units++;
        // Un remboursement/annulation reçu avant la commande (ordre non garanti) crée directement un droit révoqué.
        stmts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO grants (id, source, order_id_h, order_ref_h, email_h, offer_id, unit, status, created_at, revoked_reason)
           SELECT ?1, 'fourthwall', ?2, ?3, ?4, ?5, ?6,
             CASE WHEN EXISTS (SELECT 1 FROM order_flags WHERE order_id_h = ?2) THEN 'revoked' ELSE 'eligible' END, ?7,
             (SELECT status FROM order_flags WHERE order_id_h = ?2)`
        ).bind(randomId(), orderIdH, refH, emailH, offerId, u, now));
      }
    }
    await env.DB.batch(stmts);   // transaction : événement + droits, idempotent (INSERT OR IGNORE + UNIQUE)
    log("fw_order_placed", units ? "eligible_units" : "no_eligible_offer");
    return json(c, { ok: true }, 200, false);
  }

  if (ev.type === "ORDER_UPDATED") {
    const order = data.order || data;
    const status = String(order.status || "").toUpperCase();
    if (typeof order.id === "string" && c.revokeStatuses.has(status)) {
      const orderIdH = await fingerprint(c.pepper, "order-id", order.id);
      stmts.push(env.DB.prepare("INSERT INTO order_flags (order_id_h, status, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(order_id_h) DO UPDATE SET status = ?2, updated_at = ?3").bind(orderIdH, status, now));
      stmts.push(env.DB.prepare("UPDATE grants SET status = 'revoked', revoked_reason = ?2 WHERE order_id_h = ?1 AND status != 'revoked'").bind(orderIdH, status));
      await env.DB.batch(stmts);
      log("fw_order_updated", "revoked");
      return json(c, { ok: true }, 200, false);
    }
    await env.DB.batch(stmts);
    log("fw_order_updated", "no_action");   // remboursement partiel ou autre statut : examen manuel (politique documentée)
    return json(c, { ok: true }, 200, false);
  }

  await env.DB.batch(stmts);
  log("fw_other", "ignored");
  return json(c, { ok: true, ignored: "type" }, 200, false);
}

// ---------- activation et récupération du bundle ----------
async function activate(env, c, grant) {
  const start = torontoDate(c.now());
  const end = addMonths(start, BUNDLE_MONTHS);
  const recovery = randomCode("R-");
  const recoveryH = await fingerprint(c.pepper, "recovery", normCode(recovery));
  // Activation unique : seule une ligne encore « eligible » peut passer à « active » (écrivain SQLite unique → atomique).
  const res = await env.DB.prepare(
    "UPDATE grants SET status = 'active', start_date = ?2, end_date = ?3, activated_at = ?4, recovery_h = ?5, devices = 1 WHERE id = ?1 AND status = 'eligible'"
  ).bind(grant.id, start, end, c.now(), recoveryH).run();
  if (res.meta.changes !== 1) return null;   // perdu la course : une autre requête a activé ce droit
  return { recovery, grant: { ...grant, status: "active", start_date: start, end_date: end } };
}
async function reissue(env, c, grant) {
  if (grant.end_date <= torontoDate(c.now())) return "expired";
  // Changement d'appareil : même droit, MÊME dates (l'essai ne redémarre pas). Nombre de réémissions plafonné.
  const res = await env.DB.prepare("UPDATE grants SET devices = devices + 1 WHERE id = ?1 AND status = 'active' AND devices < ?2").bind(grant.id, MAX_GRANT_DEVICES).run();
  return res.meta.changes === 1;
}
async function respondGrant(env, c, grant, recovery) {
  if (grant.end_date <= torontoDate(c.now())) return fail(c, "expired", 410);
  const token = await issue(c, grantPayload(grant));
  return json(c, { token, plan: grant.plan, start: grant.start_date, end: grant.end_date, ...(recovery ? { recovery_code: recovery } : {}) });
}

async function bundleClaim(req, env, c) {
  const ip = clientIp(req);
  if (!(await hit(c, env, "claim-ip:" + ip, 20, 600))) return fail(c, "rate_limited", 429);
  const body = await readJson(req, 2048);
  if (!body || typeof body.order !== "string" || typeof body.email !== "string" || body.order.length > 40 || body.email.length > 254) return fail(c, "bad_request", 400);
  const refH = await fingerprint(c.pepper, "order-ref", normOrderRef(body.order));
  if (!(await hit(c, env, "claim-order:" + refH, 8, 3600))) return fail(c, "rate_limited", 429);
  const emailH = await fingerprint(c.pepper, "email", normEmail(body.email));
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = (await env.DB.prepare("SELECT * FROM grants WHERE order_ref_h = ?1 AND email_h = ?2 ORDER BY unit").bind(refH, emailH).all()).results;
    if (!rows.length) { log("claim", "not_found"); return fail(c, "not_found", 404); }   // même réponse si commande inconnue ou courriel différent
    const eligible = rows.find(g => g.status === "eligible");
    if (eligible) {
      const r = await activate(env, c, eligible);
      if (!r) continue;   // concurrence : on relit et on recommence
      log("claim", "activated");
      return respondGrant(env, c, r.grant, r.recovery);
    }
    const active = rows.find(g => g.status === "active");
    if (active) {
      const ok = await reissue(env, c, active);
      if (ok === "expired") return fail(c, "expired", 410);
      if (!ok) { log("claim", "device_limit"); return fail(c, "device_limit", 409); }
      log("claim", "reissued");
      return respondGrant(env, c, active, null);
    }
    log("claim", "revoked"); return fail(c, "revoked", 403);
  }
  return fail(c, "conflict", 409);
}

async function bundleRecover(req, env, c) {
  if (!(await hit(c, env, "recover-ip:" + clientIp(req), 20, 600))) return fail(c, "rate_limited", 429);
  const body = await readJson(req, 1024);
  if (!body || typeof body.code !== "string" || body.code.length > 60) return fail(c, "bad_request", 400);
  const code = normCode(body.code);
  // Code de récupération (droit déjà actif) ou code manuel de secours (droit admissible créé par le propriétaire).
  const recH = await fingerprint(c.pepper, "recovery", code);
  const claimH = await fingerprint(c.pepper, "claim", code);
  const g = await env.DB.prepare("SELECT * FROM grants WHERE recovery_h = ?1 OR claim_code_h = ?2").bind(recH, claimH).first();
  if (!g) { log("recover", "not_found"); return fail(c, "not_found", 404); }
  if (g.status === "revoked") return fail(c, "revoked", 403);
  if (g.status === "eligible") {
    const r = await activate(env, c, g);
    if (!r) return fail(c, "conflict", 409);
    log("recover", "manual_activated");
    return respondGrant(env, c, r.grant, r.recovery);
  }
  const ok = await reissue(env, c, g);
  if (ok === "expired") return fail(c, "expired", 410);
  if (!ok) return fail(c, "device_limit", 409);
  log("recover", "reissued");
  return respondGrant(env, c, g, null);
}

async function bundleRefresh(req, env, c) {
  if (!(await hit(c, env, "refresh-ip:" + clientIp(req), 60, 600))) return fail(c, "rate_limited", 429);
  const body = await readJson(req, 4096);
  if (!body || typeof body.token !== "string") return fail(c, "bad_request", 400);
  // On accepte un jeton expiré depuis moins de REFRESH_MAX_AGE_S (signature toujours vérifiée, clés en rotation acceptées).
  const p = await verifyToken(c.publicKeys, body.token, c.now() - REFRESH_MAX_AGE_S * 1000);
  if (!p || p.src !== "bundle" || p.exp + REFRESH_MAX_AGE_S < c.now() / 1000) return fail(c, "unauthorized", 401);
  const g = await env.DB.prepare("SELECT * FROM grants WHERE id = ?1").bind(p.sub).first();
  if (!g || g.status !== "active") return fail(c, "revoked", 403);
  return respondGrant(env, c, g, null);
}

// ---------- licences Gumroad (abonnements Plus, Pro, abonnement d'origine) ----------
async function gumroadVerify(c, productId, key) {
  let r;
  try {
    r = await fetch(c.gumroadBase + "/v2/licenses/verify", {
      method: "POST", body: new URLSearchParams({ product_id: productId, license_key: key, increment_uses_count: "false" }),
      signal: AbortSignal.timeout(8000)
    });
  } catch { return { transient: true }; }
  if (r.status === 408 || r.status === 429 || r.status >= 500) return { transient: true };
  const j = await r.json().catch(() => null);
  if (!j || typeof j.success !== "boolean") return { transient: true };
  if (!j.success) return { bad: true };
  const p = j.purchase || {}, past = d => d && new Date(d).getTime() <= c.now();
  if (p.refunded || p.chargebacked || p.disputed) return { ended: true };
  if (past(p.subscription_ended_at) || past(p.subscription_cancelled_at) || past(p.subscription_failed_at)) return { ended: true };
  return { ok: true };
}
async function license(req, env, c) {
  if (!(await hit(c, env, "license-ip:" + clientIp(req), 30, 600))) return fail(c, "rate_limited", 429);
  const body = await readJson(req, 1024);
  if (!body || typeof body.key !== "string" || !body.key.trim() || body.key.length > 100 || typeof body.device !== "string" || !/^[a-z0-9]{16,64}$/.test(body.device)) return fail(c, "bad_request", 400);
  const key = body.key.trim();
  let transient = false, ended = false, found = null;
  for (const p of c.products) {
    if (!p || !p.id) continue;
    const r = await gumroadVerify(c, p.id, key);
    if (r.ok) { found = p; break; }
    if (r.transient) transient = true; else if (r.ended) ended = true;
  }
  if (!found) { log("license", ended ? "ended" : transient ? "transient" : "bad"); return ended ? fail(c, "ended", 403) : transient ? fail(c, "unavailable", 503) : fail(c, "invalid", 404); }
  const licH = await fingerprint(c.pepper, "license", key);
  const devH = await fingerprint(c.pepper, "device", body.device);
  const now = c.now();
  const known = await env.DB.prepare("SELECT 1 FROM license_devices WHERE license_h = ?1 AND device_h = ?2").bind(licH, devH).first();
  if (!known) {
    // Insertion conditionnelle atomique : n'ajoute l'appareil que si la licence a moins de MAX_LICENSE_DEVICES appareils.
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO license_devices (license_h, device_h, first_seen, last_seen)
       SELECT ?1, ?2, ?3, ?3 WHERE (SELECT COUNT(*) FROM license_devices WHERE license_h = ?1) < ?4`
    ).bind(licH, devH, now, MAX_LICENSE_DEVICES).run();
    if (res.meta.changes !== 1) { log("license", "device_limit"); return fail(c, "device_limit", 409); }
  } else {
    await env.DB.prepare("UPDATE license_devices SET last_seen = ?3 WHERE license_h = ?1 AND device_h = ?2").bind(licH, devH, now).run();
  }
  log("license", "ok");
  const token = await issue(c, { src: "gumroad", sub: licH.slice(0, 32), plan: found.plan === "plus" ? "plus" : "pro", slot: found.slot || "legacy" });
  return json(c, { token, plan: found.plan, slot: found.slot || "legacy" });
}

// ---------- routeur ----------
export default {
  async fetch(req, env) {
    const c = config(env);
    if (c.problems.length) { log("config", "misconfigured"); return json(c, { error: "unavailable" }, 503); }   // échec fermé, sans détail
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      if (req.headers.get("origin") !== c.origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": c.origin, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type", "access-control-max-age": "600", "vary": "Origin" } });
    }
    try {
      if (req.method === "GET" && url.pathname === "/v1/health") return json(c, { ok: true });
      if (req.method !== "POST") return fail(c, "not_found", 404);
      if (url.pathname === "/v1/webhooks/fourthwall") return await fourthwallWebhook(req, env, c);
      // Routes appelées par l'application : origine exigée quand elle est fournie par le navigateur.
      const origin = req.headers.get("origin");
      if (origin && origin !== c.origin) return fail(c, "forbidden", 403);
      if (url.pathname === "/v1/bundle/claim") return await bundleClaim(req, env, c);
      if (url.pathname === "/v1/bundle/recover") return await bundleRecover(req, env, c);
      if (url.pathname === "/v1/bundle/refresh") return await bundleRefresh(req, env, c);
      if (url.pathname === "/v1/license") return await license(req, env, c);
      return fail(c, "not_found", 404);
    } catch (e) {
      log("error", "internal");   // aucun détail d'exception (peut contenir des données)
      return fail(c, "unavailable", 503);
    }
  },
  // Tâche planifiée quotidienne (Cron Trigger) : rétention minimale.
  async scheduled(_event, env) {
    const c = config(env); if (c.problems.length) return;
    const now = c.now(), today = torontoDate(now);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM fw_events WHERE received_at < ?1").bind(now - 30 * 86400e3),
      env.DB.prepare("DELETE FROM rate WHERE win < ?1").bind(Math.floor(now / 1000) - 48 * 3600),
      // Droits expirés depuis 12 mois, droits jamais activés après 24 mois, appareils inactifs depuis 12 mois.
      env.DB.prepare("DELETE FROM grants WHERE (end_date IS NOT NULL AND end_date < ?1) OR (status != 'active' AND created_at < ?2)").bind(addMonths(today, -12), now - 730 * 86400e3),
      env.DB.prepare("DELETE FROM license_devices WHERE last_seen < ?1").bind(now - 365 * 86400e3),
      env.DB.prepare("DELETE FROM order_flags WHERE updated_at < ?1").bind(now - 730 * 86400e3)
    ]);
  }
};
