// Tests de bout en bout (navigateur ↔ service de droits local) — MISSION-CARNETKM-002-B.
// Serveur local unique (application + /api + faux Gumroad), données et clés FICTIVES, aucune requête externe.
process.env.TZ = "America/Toronto";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startDevServer } from "../server/dev/serve.mjs";
import { b64, hmacRaw } from "../server/src/lib.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "carnetkm.v1";
let browser, dev;

before(async () => {
  dev = await startDevServer();
  browser = await chromium.launch({ args: ["--host-resolver-rules=MAP carnetkm.example.test 127.0.0.1"] });
});
after(async () => { await browser?.close(); await dev?.close(); });

const trips = (date, n) => Array.from({ length: n }, (_, i) => ({ id: "t" + date.replace(/-/g, "") + i, date, type: "b", from: "Dépôt", to: "Adresse secrète " + i, purpose: "Livraison", km: 10, o1: null, o2: null }));
const state = (o = {}) => ({ app: "carnetkm", v: 1, lang: "fr", settings: { name: "Nom Fictif", vehicle: "", prov: "QC", registered: false }, odo: {}, trips: [], expenses: [{ id: "e1", date: "2026-11-02", cat: "fuel", amount: 55.5, taxIncl: true, note: "Note fiscale fictive" }], favs: [], license: null, ...o });

async function open({ now = "2026-11-24T10:00:00", st = null, ctx = null } = {}) {
  dev.state.now = new Date(now).getTime();
  ctx = ctx || await browser.newContext({ timezoneId: "America/Toronto", locale: "fr-CA" });
  const page = await ctx.newPage();
  const sent = [], external = [];
  page.on("request", r => {
    const u = new URL(r.url());
    if (u.hostname !== "localhost") external.push(r.url());
    if (u.pathname.startsWith("/api/")) sent.push({ path: u.pathname, body: r.postData() || "" });
  });
  await page.clock.install({ time: new Date(now) });
  if (st) await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(st)]);
  await page.goto(dev.base + "/");
  await enableServer(page);
  return { ctx, page, sent, external };
}
// Configuration de test injectée après chargement (la configuration publiée reste vide).
async function enableServer(page) {
  await page.evaluate(async keys => {
    CONFIG.entitlements = { endpoint: "/api", keys };
    CONFIG.bundle.mode = "server";
    Object.assign(CONFIG.products.find(p => p.slot === "plus"), { id: "FICTIF-PLUS" });
    Object.assign(CONFIG.products.find(p => p.slot === "pro"), { id: "FICTIF-PRO" });
    // même séquence qu'au démarrage (init) : vérification des jetons, puis revérification/renouvellement en ligne
    await loadEntitlements(); renderAll(); await recheck(); await refreshBundle();
  }, dev.publicKeys);
}
async function webhook(ev) {
  const body = JSON.stringify(ev);
  const sig = b64(await hmacRaw(dev.env.FW_WEBHOOK_SECRET, body));
  const r = await fetch(dev.base + "/api/v1/webhooks/fourthwall", { method: "POST", body, headers: { "x-fourthwall-hmac-sha256": sig, "content-type": "application/json" } });
  assert.equal(r.status, 200);
}
const placed = (id, friendlyId, email = "acheteur.fictif@example.test") => ({ id: "evt_" + id, type: "ORDER_PLACED", testMode: false, data: { id, friendlyId, email, offers: [{ id: "offer_FICTIF_BUNDLE", variant: { quantity: 1 } }] } });
const S = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
async function claimUI(page, order, email) {
  await page.click("#t-pro");
  await page.fill("#bunOrder", order); await page.fill("#bunEmail", email); await page.click("#bBunClaim");
  await page.waitForFunction(() => document.querySelector("#bunMsg").textContent.trim().length > 0);
  return (await page.textContent("#bunMsg")).trim();
}
async function addTrip(page, date) {
  await page.click("#t-trips");
  await page.fill("#tDate", date); await page.dispatchEvent("#tDate", "change");
  await page.fill("#tPurpose", "Livraison"); await page.fill("#tTo", "Client"); await page.fill("#tKm", "5");
  await page.click("#tripForm button[type=submit]");
  return (await page.textContent("#tripMsg")).trim();
}

test("Bundle Fourthwall de bout en bout : activation, Plus 60, code de récupération, seules commande et courriel envoyés", async () => {
  await webhook(placed("ord_E2E_1", "FW5001"));
  const { ctx, page, sent, external } = await open({ st: state({ trips: trips("2026-11-03", 59) }) });
  assert.match(await page.textContent("#bunSoon"), /Seuls ces deux renseignements sont envoyés/);
  const msg = await claimUI(page, "FW5001", "acheteur.fictif@example.test");
  assert.match(msg, /Offre activée : forfait Plus jusqu'au 23 février 2027 inclusivement/);
  assert.match(msg, /Ton code de récupération : R-[0-9A-Z-]{31}/);
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.match(await addTrip(page, "2026-11-25"), /atteint 60 trajets/);
  // Vie privée : uniquement /v1/bundle/claim avec {order, email}; aucune donnée de trajet, dépense ou fiscale.
  assert.deepEqual(sent.map(s => s.path), ["/api/v1/bundle/claim"]);
  assert.deepEqual(Object.keys(JSON.parse(sent[0].body)).sort(), ["email", "order"]);
  assert.doesNotMatch(sent.map(s => s.body).join(), /Adresse secrète|Nom Fictif|Note fiscale|55\.5/);
  assert.deepEqual(external, []);
  // Le code de récupération n'est pas conservé sur l'appareil, et la sauvegarde n'exporte ni jeton ni identifiant d'appareil.
  const st = await S(page);
  assert.doesNotMatch(JSON.stringify(st), /R-[0-9A-Z]{5}-/);
  assert.ok(st.ent.bun);
  await page.click("#t-pro");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bBackup")]);
  const saved = readFileSync(await dl.path(), "utf8");
  for (const k of ['"ent"', '"device"', '"license"', '"trial"']) assert.ok(!saved.includes(k), k);
  await ctx.close();
});

test("Changement d'appareil : code de récupération → mêmes dates, l'essai ne redémarre pas", async () => {
  await webhook(placed("ord_E2E_2", "FW5002"));
  const a = await open();
  const msg = await claimUI(a.page, "FW5002", "acheteur.fictif@example.test");
  const code = msg.match(/R-[0-9A-Z-]{31}/)[0];
  await a.ctx.close();
  const b = await open({ now: "2027-01-20T09:00:00" });   // nouveau téléphone, 2 mois plus tard
  await b.page.click("#t-pro");
  await b.page.fill("#bunRec", code); await b.page.click("#bBunRec");
  await b.page.waitForFunction(() => /Offre activée/.test(document.querySelector("#bunMsg").textContent));
  assert.match(await b.page.textContent("#bunMsg"), /jusqu'au 23 février 2027/);
  assert.doesNotMatch(await b.page.textContent("#bunMsg"), /code de récupération/, "pas de nouveau code : même droit");
  assert.equal(await b.page.evaluate(() => plan()), "plus");
  await b.ctx.close();
});

test("Erreurs : commande inconnue et mauvais courriel → même message, aucun droit", async () => {
  await webhook(placed("ord_E2E_3", "FW5003"));
  const { ctx, page } = await open();
  assert.match(await claimUI(page, "FW9999", "acheteur.fictif@example.test"), /Aucune commande admissible/);
  await page.evaluate(() => document.querySelector("#bunMsg").textContent = "");
  assert.match(await claimUI(page, "FW5003", "autre@example.test"), /Aucune commande admissible/);
  assert.equal(await page.evaluate(() => plan()), "free");
  await ctx.close();
});

test("Remboursement : jeton non renouvelé, retour Gratuit sans perte de données; panne du service tolérée jusqu'à l'expiration du jeton", async () => {
  await webhook(placed("ord_E2E_4", "FW5004"));
  const a = await open({ st: state({ trips: trips("2026-11-03", 20) }) });
  await claimUI(a.page, "FW5004", "acheteur.fictif@example.test");
  const ctx = a.ctx; await a.page.close();
  // 5 jours plus tard, service en panne : le jeton (7 jours) reste valide hors ligne.
  dev.state.down = true;
  let o = await open({ ctx, now: "2026-11-29T10:00:00" });
  assert.equal(await o.page.evaluate(() => plan()), "plus");
  await o.page.close(); dev.state.down = false;
  // Remboursement reçu; au renouvellement suivant, le service refuse → Gratuit, données intactes.
  await webhook({ id: "evt_r4", type: "ORDER_UPDATED", data: { order: { id: "ord_E2E_4", status: "REFUNDED" } } });
  o = await open({ ctx, now: "2026-11-30T10:00:00" });
  await o.page.waitForFunction(() => plan() === "free");
  assert.equal(await o.page.locator("#tripList .item").count(), 20);
  assert.equal((await S(o.page)).ent.bun, null);
  await ctx.close();
});

test("Abonné historique via le service : Pro illimité conservé; jeton falsifié ignoré", async () => {
  dev.state.gumroad = p => p.product_id === "FICTIF-LEGACY" && p.license_key === "FICTIVE-LEGACY-KEY" ? { success: true, purchase: {} } : { success: false };
  const { ctx, page, sent } = await open({ st: state({ trips: trips("2026-11-03", 80) }) });
  await page.click("#t-pro"); await page.fill("#licKey", "FICTIVE-LEGACY-KEY"); await page.click("#bLic");
  await page.waitForFunction(() => plan() === "pro");
  assert.match(await page.textContent("#proState"), /abonnement d'origine/);
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.deepEqual(Object.keys(JSON.parse(sent.find(s => s.path === "/api/v1/license").body)).sort(), ["device", "key"]);
  // Falsification locale : payload modifié → signature invalide → droit ignoré au rechargement.
  await page.evaluate(k => { const o = JSON.parse(localStorage.getItem(k)); const [h, p, s] = o.ent.lic.split("."); const pay = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))); pay.exp = 9e9; o.ent.lic = h + "." + btoa(JSON.stringify(pay)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_") + "." + s; o.license = null; localStorage.setItem(k, JSON.stringify(o)); }, KEY);
  await page.reload(); await enableServer(page);
  assert.equal(await page.evaluate(() => plan()), "free");
  await ctx.close();
});

test("Production : mode simulation inopérant hors localhost; accès de lancement jamais implicite; configuration publiée vide", async () => {
  const app = readFileSync(join(ROOT, "app.js"), "utf8");
  assert.match(app, /bundle: \{ mode: "off"/);
  assert.match(app, /entitlements: \{ endpoint: "", keys: \{\} \}/);
  assert.match(app, /launchAccess: false/);
  // Hôte non local (résolu vers 127.0.0.1) : la simulation est forcée à « off ».
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(dev.base.replace("localhost", "carnetkm.example.test") + "/");
  const r = await page.evaluate(() => { CONFIG.bundle.mode = "simulation"; renderAll(); return [bundleMode(), getComputedStyle(document.getElementById("bunForm")).display]; });
  assert.deepEqual(r, ["off", "none"]);
  await page.evaluate(() => { $("bunCode").value = "DEMO-ABCD"; activateBundle(); });
  assert.equal((await S(page))?.trial ?? null, null);
  // Aucun produit configuré et pas de drapeau explicite : Gratuit, pas « tout ouvert ».
  assert.deepEqual(await page.evaluate(() => { CONFIG.products.forEach(p => p.id = ""); return planState(); }), { plan: "free", source: "free" });
  assert.deepEqual(await page.evaluate(() => { CONFIG.launchAccess = true; return planState(); }), { plan: "pro", source: "launch" });
  await ctx.close();
});
