// Tests du service de droits (MISSION-CARNETKM-002-B). Données, clés et secrets FICTIFS générés à chaque exécution.
// Aucun appel réseau externe : Gumroad est simulé par un serveur HTTP local; Fourthwall par des webhooks signés localement.
// Exécution : node --no-warnings --test server/test/
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { createLocalD1 } from "../src/d1-local.js";
import { b64, hmacRaw, verifyToken, addMonths, randomCode, normCode } from "../src/lib.js";

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), "..", "schema.sql");
const ORIGIN = "https://carnetkm.example.test";
const OFFER = "offer_FICTIF_BUNDLE";
const FW_SECRET = "fw-secret-FICTIF-" + crypto.randomUUID();
const PEPPER = "pepper-FICTIF-" + crypto.randomUUID() + crypto.randomUUID();

let keys, env, db, clock, gumroad, gumroadBehaviour, logs, origLog;
const T = s => new Date(s).getTime();

before(async () => {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  keys = { priv: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: await crypto.subtle.exportKey("jwk", kp.publicKey) };
  gumroad = createServer((req, res) => {
    let body = ""; req.on("data", d => body += d); req.on("end", () => {
      const p = Object.fromEntries(new URLSearchParams(body));
      const out = gumroadBehaviour(p);
      res.writeHead(out.__status || 200, { "content-type": "application/json" }); res.end(JSON.stringify(out));
    });
  });
  await new Promise(r => gumroad.listen(0, "127.0.0.1", r));
  origLog = console.log; logs = [];
  console.log = (...a) => logs.push(a.join(" "));
});
after(() => { gumroad.close(); console.log = origLog; });

beforeEach(() => {
  db = createLocalD1(SCHEMA);
  clock = T("2026-11-24T15:00:00Z");   // 10 h, Toronto
  gumroadBehaviour = () => ({ success: false });
  env = {
    ENVIRONMENT: "development", DB: db, PEPPER, FW_WEBHOOK_SECRET: FW_SECRET,
    SIGNING_KEY: JSON.stringify(keys.priv), SIGNING_KID: "k1", PUBLIC_KEYS: JSON.stringify({ k1: keys.pub }),
    ALLOWED_ORIGIN: ORIGIN, ELIGIBLE_OFFER_IDS: OFFER,
    GUMROAD_PRODUCTS: JSON.stringify([{ id: "FICTIF-LEGACY", plan: "pro", slot: "legacy" }, { id: "FICTIF-PLUS", plan: "plus", slot: "plus" }, { id: "FICTIF-PRO", plan: "pro", slot: "pro" }]),
    GUMROAD_API_BASE: `http://127.0.0.1:${gumroad.address().port}`,
    __clock: () => clock
  };
});

// ---------- helpers ----------
let evSeq = 0;
function order({ id = "ord_FICTIF_" + (++evSeq), friendlyId = "FW" + (1000 + evSeq), email = "acheteur.fictif@example.test", offers = [{ id: OFFER, variant: { quantity: 1 } }], testMode = false } = {}) {
  return { id: "evt_" + crypto.randomUUID(), type: "ORDER_PLACED", testMode, data: { id, friendlyId, email, status: "CONFIRMED", offers } };
}
async function webhook(ev, { secret = FW_SECRET, raw = null, tamper = false } = {}) {
  const body = raw ?? JSON.stringify(ev);
  let sig = b64(await hmacRaw(secret, body));
  if (tamper) sig = sig.slice(0, -2) + (sig.endsWith("AA") ? "BB" : "AA");
  return worker.fetch(new Request("https://api.example.test/v1/webhooks/fourthwall", { method: "POST", body, headers: { "x-fourthwall-hmac-sha256": sig, "content-type": "application/json" } }), env);
}
async function call(path, body, { ip = "203.0.113.7", origin = ORIGIN } = {}) {
  const h = { "content-type": "application/json", "cf-connecting-ip": ip }; if (origin) h.origin = origin;
  const r = await worker.fetch(new Request("https://api.example.test" + path, { method: "POST", body: JSON.stringify(body), headers: h }), env);
  return { status: r.status, body: await r.json(), headers: r.headers };
}
const claim = (o, e, opt) => call("/v1/bundle/claim", { order: o, email: e }, opt);
const verify = tok => verifyToken({ k1: keys.pub }, tok, clock);
const rows = sql => db.raw.prepare(sql).all();

// ---------- webhooks Fourthwall ----------
test("Webhook : signature valide requise (absente, falsifiée, mauvais secret → 401, rien d'écrit)", async () => {
  const ev = order();
  assert.equal((await webhook(ev, { tamper: true })).status, 401);
  assert.equal((await webhook(ev, { secret: "autre-secret" })).status, 401);
  const r = await worker.fetch(new Request("https://api.example.test/v1/webhooks/fourthwall", { method: "POST", body: JSON.stringify(ev) }), env);
  assert.equal(r.status, 401);
  assert.equal(rows("SELECT * FROM grants").length, 0);
  assert.equal((await webhook(ev)).status, 200);
  assert.equal(rows("SELECT * FROM grants").length, 1);
});

test("Webhook : commandes admissibles et non admissibles; quantité = unités distinctes", async () => {
  await webhook(order({ offers: [{ id: "offer_TSHIRT", variant: { quantity: 2 } }] }));
  assert.equal(rows("SELECT * FROM grants").length, 0, "t-shirt seul : aucun droit");
  await webhook(order({ offers: [{ id: "offer_TSHIRT" }, { id: OFFER, variant: { quantity: 2 } }] }));
  const g = rows("SELECT offer_id, unit, status FROM grants ORDER BY unit");
  assert.deepEqual(g.map(x => [x.offer_id, x.unit, x.status]), [[OFFER, 0, "eligible"], [OFFER, 1, "eligible"]]);
});

test("Webhook : événement répété et livraisons concurrentes → idempotent", async () => {
  const ev = order();
  const res = await Promise.all(Array.from({ length: 8 }, () => webhook(ev)));
  assert.ok(res.every(r => r.status === 200));
  // même commande renvoyée sous un autre identifiant d'événement : toujours une seule unité
  await webhook({ ...ev, id: "evt_autre" });
  assert.equal(rows("SELECT * FROM grants").length, 1);
  assert.equal(rows("SELECT * FROM fw_events").length, 2);
});

test("Webhook : événements de test ignorés hors développement explicite", async () => {
  await webhook(order({ testMode: true }));
  assert.equal(rows("SELECT * FROM grants").length, 0);
  env.ACCEPT_TEST_EVENTS = "true";
  await webhook(order({ testMode: true }));
  assert.equal(rows("SELECT * FROM grants").length, 1);
});

test("Webhook : corps mal formé signé → 400, sans écriture", async () => {
  assert.equal((await webhook(null, { raw: "{pas du json" })).status, 400);
  assert.equal((await webhook({ id: "e1", type: "ORDER_PLACED", data: { id: "x" } })).status, 400);
  assert.equal(rows("SELECT * FROM grants").length + rows("SELECT * FROM fw_events").length, 0);
});

// ---------- activation ----------
test("Activation : commande + courriel → Plus 3 mois calendaires, jeton signé, code de récupération", async () => {
  await webhook(order({ friendlyId: "FW7777", email: "Acheteur.Fictif@Example.test" }));
  const r = await claim("#fw7777", "  acheteur.fictif@example.TEST ");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.deepEqual([r.body.plan, r.body.start, r.body.end], ["plus", "2026-11-24", "2027-02-24"]);
  assert.match(r.body.recovery_code, /^R-([0-9A-HJKMNP-TV-Z]{5}-){5}[0-9A-HJKMNP-TV-Z]$/);
  const p = await verify(r.body.token);
  assert.deepEqual([p.src, p.plan, p.ent_start, p.ent_end, p.exp - p.iat], ["bundle", "plus", "2026-11-24", "2027-02-24", 7 * 86400]);
  const g = rows("SELECT * FROM grants")[0];
  assert.equal(g.status, "active"); assert.notEqual(g.recovery_h, null);
  assert.doesNotMatch(JSON.stringify(g), /R-|FW7777|acheteur/i, "code, commande et courriel stockés seulement sous forme hachée");
});

test("Activation : mauvais courriel ou commande inconnue → même réponse 404", async () => {
  await webhook(order({ friendlyId: "FW8888" }));
  const a = await claim("FW8888", "autre@example.test"), b = await claim("FW0000", "acheteur.fictif@example.test");
  assert.deepEqual([a.status, a.body], [404, { error: "not_found" }]);
  assert.deepEqual([b.status, b.body], [404, { error: "not_found" }]);
});

test("Activation : fin de mois (30 nov. → 1er mars exclusif) selon l'horloge serveur à Toronto", async () => {
  clock = T("2026-12-01T03:30:00Z");   // 30 novembre, 22 h 30 à Toronto (déjà le 1er décembre en UTC)
  await webhook(order({ friendlyId: "FW3030" }));
  const r = await claim("FW3030", "acheteur.fictif@example.test");
  assert.deepEqual([r.body.start, r.body.end], ["2026-11-30", "2027-03-01"]);
});

test("Concurrence : 20 activations simultanées → une seule activation, aucun second code", async () => {
  await webhook(order({ friendlyId: "FW2020" }));
  const res = await Promise.all(Array.from({ length: 20 }, (_, i) => claim("FW2020", "acheteur.fictif@example.test", { ip: "198.51.100." + i })));
  const withCode = res.filter(r => r.body.recovery_code);
  assert.equal(withCode.length, 1, "un seul code de récupération émis");
  assert.ok(res.every(r => [200, 409, 429].includes(r.status)), "réponses : activé, plafond d'appareils ou limitation de débit");
  const g = rows("SELECT status, devices FROM grants")[0];
  assert.equal(g.status, "active"); assert.ok(g.devices <= 3);
  const starts = new Set(res.filter(r => r.status === 200).map(r => r.body.start));
  assert.equal(starts.size, 1, "même date de début pour tous");
});

test("Changement d'appareil : code de récupération → mêmes dates (pas de redémarrage), plafond d'appareils", async () => {
  await webhook(order({ friendlyId: "FW4444" }));
  const first = await claim("FW4444", "acheteur.fictif@example.test");
  clock = T("2027-01-15T15:00:00Z");   // 7 semaines plus tard, nouveau téléphone
  const rec = await call("/v1/bundle/recover", { code: first.body.recovery_code.toLowerCase().replace(/-/g, " ") });
  assert.equal(rec.status, 200);
  assert.deepEqual([rec.body.start, rec.body.end, rec.body.recovery_code], ["2026-11-24", "2027-02-24", undefined]);
  // la commande + courriel fonctionne aussi pour retrouver le même droit
  const again = await claim("FW4444", "acheteur.fictif@example.test");
  assert.deepEqual([again.status, again.body.start], [200, "2026-11-24"]);
  const over = await call("/v1/bundle/recover", { code: first.body.recovery_code });
  assert.deepEqual([over.status, over.body.error], [409, "device_limit"]);
});

test("Réutilisation : code de récupération inconnu / deviné → 404; quantité 2 = deux activations distinctes", async () => {
  assert.equal((await call("/v1/bundle/recover", { code: randomCode("R-") })).status, 404);
  await webhook(order({ friendlyId: "FW2222", offers: [{ id: OFFER, variant: { quantity: 2 } }] }));
  const a = await claim("FW2222", "acheteur.fictif@example.test");
  // deuxième unité : activée par une deuxième demande (cadeau à un proche avec le même numéro + courriel)
  const b = await claim("FW2222", "acheteur.fictif@example.test");
  assert.ok(a.body.recovery_code && b.body.recovery_code && a.body.recovery_code !== b.body.recovery_code);
  const c = await claim("FW2222", "acheteur.fictif@example.test");
  assert.equal(c.body.recovery_code, undefined, "troisième demande : réémission, pas de nouveau droit");
});

test("Expiration : 3 mois calendaires; après l'échéance, activation/réémission/renouvellement refusés (410/403)", async () => {
  await webhook(order({ friendlyId: "FW5555" }));
  const first = await claim("FW5555", "acheteur.fictif@example.test");
  let token = first.body.token;
  for (const d of ["2026-12-20", "2027-01-15", "2027-02-10"]) { clock = T(d + "T15:00:00Z"); const r = await call("/v1/bundle/refresh", { token }); assert.equal(r.status, 200, d); assert.equal(r.body.end, "2027-02-24"); token = r.body.token; }
  clock = T("2027-02-24T04:59:00Z");   // 23 févr. 23 h 59 Toronto : encore valide
  const last = await call("/v1/bundle/refresh", { token });
  assert.equal(last.status, 200); token = last.body.token;
  clock = T("2027-02-24T05:00:30Z");   // 24 févr. 0 h 00 Toronto : terminé
  assert.equal((await call("/v1/bundle/refresh", { token })).status, 410);
  assert.equal((await call("/v1/bundle/recover", { code: first.body.recovery_code })).status, 410);
});

test("Renouvellement : jeton falsifié, autre clé ou trop ancien refusé", async () => {
  await webhook(order({ friendlyId: "FW6666" }));
  const { body } = await claim("FW6666", "acheteur.fictif@example.test");
  const [h, p, s] = body.token.split(".");
  const forged = h + "." + Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url")), ent_end: "2030-01-01" })).toString("base64url") + "." + s;
  assert.equal((await call("/v1/bundle/refresh", { token: forged })).status, 401);
  const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const { signToken } = await import("../src/lib.js");
  const alien = await signToken(other.privateKey, "k1", { src: "bundle", sub: "x", exp: 9e9 });
  assert.equal((await call("/v1/bundle/refresh", { token: alien })).status, 401);
  clock += 70 * 86400e3;
  assert.equal((await call("/v1/bundle/refresh", { token: body.token })).status, 401);
});

test("Rotation des clés : un jeton signé par l'ancienne clé est renouvelé avec la nouvelle", async () => {
  await webhook(order({ friendlyId: "FW9191" }));
  const { body } = await claim("FW9191", "acheteur.fictif@example.test");
  const kp2 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub2 = await crypto.subtle.exportKey("jwk", kp2.publicKey);
  Object.assign(env, { SIGNING_KEY: JSON.stringify(await crypto.subtle.exportKey("jwk", kp2.privateKey)), SIGNING_KID: "k2", PUBLIC_KEYS: JSON.stringify({ k1: keys.pub, k2: pub2 }) });
  const r = await call("/v1/bundle/refresh", { token: body.token });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(Buffer.from(r.body.token.split(".")[0], "base64url")).kid, "k2");
  assert.ok(await verifyToken({ k2: pub2 }, r.body.token, clock));
});

// ---------- remboursements ----------
test("Remboursement : droit actif révoqué, renouvellement refusé; remboursement reçu AVANT la commande géré", async () => {
  const ev = order({ id: "ord_FICTIF_R1", friendlyId: "FW1111" });
  await webhook(ev);
  const { body } = await claim("FW1111", "acheteur.fictif@example.test");
  await webhook({ id: "evt_u1", type: "ORDER_UPDATED", data: { order: { id: "ord_FICTIF_R1", status: "REFUNDED" }, update: { type: "STATUS" } } });
  assert.equal(rows("SELECT status FROM grants")[0].status, "revoked");
  assert.deepEqual((await call("/v1/bundle/refresh", { token: body.token })).body, { error: "revoked" });
  assert.equal((await claim("FW1111", "acheteur.fictif@example.test")).status, 403);
  // ordre inversé : annulation puis commande
  await webhook({ id: "evt_u2", type: "ORDER_UPDATED", data: { order: { id: "ord_FICTIF_R2", status: "CANCELLED" } } });
  await webhook(order({ id: "ord_FICTIF_R2", friendlyId: "FW1112" }));
  assert.equal((await claim("FW1112", "acheteur.fictif@example.test")).status, 403);
  // statut non révocatoire (expédition) : aucune action
  await webhook(order({ id: "ord_FICTIF_R3", friendlyId: "FW1113" }));
  await webhook({ id: "evt_u3", type: "ORDER_UPDATED", data: { order: { id: "ord_FICTIF_R3", status: "SHIPPED" } } });
  assert.equal((await claim("FW1113", "acheteur.fictif@example.test")).status, 200);
});

// ---------- solution de secours manuelle ----------
test("Secours manuel : code CKM- émis hors ligne par le propriétaire, usage unique", async () => {
  const { manualGrantSql } = await import("../scripts/issue-manual-code.mjs");
  const out = await manualGrantSql({ pepper: PEPPER, orderRef: "FW-MANUEL-1", email: "client.fictif@example.test", offerId: OFFER, now: clock });
  db.raw.exec(out.sql);
  assert.doesNotMatch(out.sql, /CKM-|client\.fictif|FW-MANUEL/i, "le SQL ne contient que des empreintes");
  const r = await call("/v1/bundle/recover", { code: out.code });
  assert.equal(r.status, 200); assert.ok(r.body.recovery_code);
  const again = await call("/v1/bundle/recover", { code: out.code });
  assert.equal(again.body.recovery_code, undefined, "le code manuel ne crée pas un second droit");
});

// ---------- licences Gumroad ----------
test("Licence d'origine : reconnue Pro, slot legacy; clé jamais stockée en clair", async () => {
  gumroadBehaviour = p => p.product_id === "FICTIF-LEGACY" && p.license_key === "FICTIVE-LEGACY-KEY" ? { success: true, uses: 4, purchase: {} } : { success: false };
  const r = await call("/v1/license", { key: "FICTIVE-LEGACY-KEY", device: "dev0000000000000001" });
  assert.equal(r.status, 200);
  const p = await verify(r.body.token);
  assert.deepEqual([p.src, p.plan, p.slot], ["gumroad", "pro", "legacy"]);
  assert.doesNotMatch(JSON.stringify(rows("SELECT * FROM license_devices")), /FICTIVE-LEGACY-KEY|dev0000/);
});

test("Licences Plus / Pro, clé invalide, abonnement terminé, panne Gumroad", async () => {
  gumroadBehaviour = p => p.product_id === "FICTIF-PLUS" && p.license_key === "K-PLUS" ? { success: true, purchase: {} }
    : p.product_id === "FICTIF-PRO" && p.license_key === "K-ENDED" ? { success: true, purchase: { subscription_ended_at: "2026-11-01T00:00:00Z" } }
    : { success: false };
  assert.equal((await verify((await call("/v1/license", { key: "K-PLUS", device: "dev0000000000000002" })).body.token)).plan, "plus");
  assert.deepEqual((await call("/v1/license", { key: "NOPE", device: "dev0000000000000002" })).body, { error: "invalid" });
  assert.deepEqual((await call("/v1/license", { key: "K-ENDED", device: "dev0000000000000002" })).body, { error: "ended" });
  gumroadBehaviour = () => ({ __status: 503 });
  assert.deepEqual((await call("/v1/license", { key: "K-PLUS", device: "dev0000000000000002" })).body, { error: "unavailable" });
  env.GUMROAD_API_BASE = "http://127.0.0.1:1";   // réseau injoignable
  assert.equal((await call("/v1/license", { key: "K-PLUS", device: "dev0000000000000002" })).status, 503);
});

test("Licence : plafond de 3 appareils (partage de clé, F2), appareil connu toujours accepté", async () => {
  gumroadBehaviour = () => ({ success: true, purchase: {} });
  for (let i = 1; i <= 3; i++) assert.equal((await call("/v1/license", { key: "K-SHARED", device: "devshared00000000" + i })).status, 200);
  assert.deepEqual((await call("/v1/license", { key: "K-SHARED", device: "devshared000000004" })).body, { error: "device_limit" });
  assert.equal((await call("/v1/license", { key: "K-SHARED", device: "devshared000000001" })).status, 200);
});

// ---------- protections générales ----------
test("Limitation de débit : essais répétés sur une commande bloqués (429)", async () => {
  await webhook(order({ friendlyId: "FW1234" }));
  const res = [];
  for (let i = 0; i < 10; i++) res.push((await claim("FW1234", "devine" + i + "@example.test", { ip: "192.0.2." + i })).status);
  assert.deepEqual(res.slice(0, 8), Array(8).fill(404));
  assert.deepEqual(res.slice(8), [429, 429]);
  assert.equal((await claim("FW1234", "acheteur.fictif@example.test", { ip: "192.0.2.99" })).status, 429, "même le bon courriel attend la fenêtre suivante");
  clock += 3600e3;
  assert.equal((await claim("FW1234", "acheteur.fictif@example.test", { ip: "192.0.2.99" })).status, 200);
});

test("CORS et origine : autre site refusé; préflight limité à l'origine de l'application", async () => {
  await webhook(order({ friendlyId: "FW4321" }));
  assert.equal((await claim("FW4321", "acheteur.fictif@example.test", { origin: "https://evil.example" })).status, 403);
  const pre = await worker.fetch(new Request("https://api.example.test/v1/bundle/claim", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), env);
  assert.equal(pre.status, 403);
});

test("Configuration production : échec fermé si secret manquant, événements de test, horloge de test ou API Gumroad détournée", async () => {
  const prod = { ...env, ENVIRONMENT: "production" };
  delete prod.__clock; prod.GUMROAD_API_BASE = "https://api.gumroad.com";
  const ok = await worker.fetch(new Request("https://api.example.test/v1/health"), prod);
  assert.equal(ok.status, 200);
  for (const bad of [{ PEPPER: "court" }, { FW_WEBHOOK_SECRET: "" }, { ACCEPT_TEST_EVENTS: "true" }, { __clock: () => 0 }, { GUMROAD_API_BASE: "http://127.0.0.1:9" }, { ALLOWED_ORIGIN: "http://insecure.example" }, { SIGNING_KID: "inconnu" }]) {
    const r = await worker.fetch(new Request("https://api.example.test/v1/health"), { ...prod, ...bad });
    assert.equal(r.status, 503, JSON.stringify(Object.keys(bad)));
    assert.deepEqual(await r.json(), { error: "unavailable" }, "aucun détail de configuration divulgué");
  }
});

test("Confidentialité : aucune donnée de trajet acceptée ni stockée; aucun secret, courriel, commande ou clé dans les journaux, réponses ou la base", async () => {
  logs.length = 0;
  await webhook(order({ friendlyId: "FW-PRIV-1", email: "prive.fictif@example.test" }));
  const r = await call("/v1/bundle/claim", { order: "FW-PRIV-1", email: "prive.fictif@example.test", trips: [{ to: "123 rue Secrète", km: 42 }], expenses: [{ amount: 99 }], settings: { name: "Nom Fictif" } });
  assert.equal(r.status, 200);
  gumroadBehaviour = () => ({ success: true, purchase: {} });
  await call("/v1/license", { key: "CLE-PRIVEE-FICTIVE", device: "devprivate00000001", trips: ["x"] });
  const dump = JSON.stringify(["fw_events", "order_flags", "grants", "license_devices", "rate"].map(t => rows("SELECT * FROM " + t)));
  const everything = dump + logs.join("\n") + JSON.stringify(r.body);
  for (const secret of [PEPPER, FW_SECRET, keys.priv.d, "prive.fictif", "FW-PRIV-1", "CLE-PRIVEE-FICTIVE", "rue Secrète", "Nom Fictif", "203.0.113.7"]) assert.ok(!everything.includes(secret), "fuite : " + secret.slice(0, 12));
  assert.ok(logs.every(l => /^\{"evt":"[a-z_]+","outcome":"[a-z_]+"\}$/.test(l)), "journaux limités à {evt, outcome}");
});

test("Rétention : purge quotidienne des événements, compteurs et droits expirés depuis 12 mois", async () => {
  await webhook(order({ friendlyId: "FW-OLD" }));
  await claim("FW-OLD", "acheteur.fictif@example.test");
  clock = T("2028-03-01T12:00:00Z");
  await worker.scheduled({}, env);
  assert.equal(rows("SELECT * FROM grants").length + rows("SELECT * FROM fw_events").length + rows("SELECT * FROM rate").length, 0);
});

test("Codes : entropie 130 bits, normalisation tolérante (O/0, I/L/1, espaces, tirets)", () => {
  const codes = new Set(Array.from({ length: 2000 }, () => randomCode("R-")));
  assert.equal(codes.size, 2000);
  const c = randomCode("R-");
  assert.equal(normCode(c.toLowerCase().replace(/-/g, " ")), normCode(c));
  assert.equal(normCode("r-0o1il"), "R00111");
  assert.equal(addMonths("2026-11-30", 3), "2027-03-01");
});
