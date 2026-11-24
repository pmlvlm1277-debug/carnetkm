// Tests MISSION-CARNETKM-002 : forfaits, quotas mensuels, offre bundle, licences, sauvegardes, régression SEC-001, mobile, hors ligne.
// Exécution : node --test tests/   (Chromium/Playwright préinstallés; serveurs locaux seulement; Gumroad toujours simulé.)
// Données fictives uniquement.
process.env.TZ = "America/Toronto"; // heures des tests = heure locale de Toronto (même fuseau que le navigateur)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTTP = 8765, HTTPS = 8766;
const BASE = `http://localhost:${HTTP}/`;
const KEY = "carnetkm.v1";
const LEGACY_ID = "DHMf78a9yPLxm2vB_mFe_w==";

let browser, httpSrv, httpsSrv;
before(async () => {
  httpSrv = spawn("python3", ["-m", "http.server", String(HTTP), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
  const dir = mkdtempSync(join(tmpdir(), "ckm-tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
  const py = `import http.server,ssl,functools,sys
h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])
s=http.server.ThreadingHTTPServer(("127.0.0.1",${HTTPS}),h)
c=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);c.load_cert_chain(sys.argv[2],sys.argv[3])
s.socket=c.wrap_socket(s.socket,server_side=True);s.serve_forever()`;
  httpsSrv = spawn("python3", ["-c", py, ROOT, join(dir, "c.pem"), join(dir, "k.pem")], { stdio: "ignore" });
  browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  await new Promise(r => setTimeout(r, 800));
});
after(async () => { await browser?.close(); httpSrv?.kill(); httpsSrv?.kill(); });

// ---------- helpers ----------
const trip = (date, i, extra = {}) => ({ id: "t" + date.replace(/-/g, "") + i, date, type: "b", from: "Dépôt", to: "Client " + i, purpose: "Livraison de colis", km: 10, o1: null, o2: null, ...extra });
const trips = (date, n) => Array.from({ length: n }, (_, i) => trip(date, i));
const state = (o = {}) => ({ app: "carnetkm", v: 1, lang: "fr", settings: { name: "Test Fictif", vehicle: "Auto test", prov: "QC", registered: true }, odo: {}, trips: [], expenses: [], favs: [], license: null, ...o });

async function open({ now = "2026-11-24T10:00:00", st = null, gumroad = null, device = null, url = BASE, setup = null } = {}) {
  const ctx = await browser.newContext({ timezoneId: "America/Toronto", locale: "fr-CA", ...(device ? devices[device] : {}), ignoreHTTPSErrors: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const external = [];
  page.on("request", r => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("blob") && !u.protocol.startsWith("data")) external.push(r.url()); });
  const calls = [];
  await ctx.route("https://api.gumroad.com/**", async route => {
    const body = new URLSearchParams(route.request().postData() || "");
    calls.push(Object.fromEntries(body));
    const res = gumroad ? gumroad(Object.fromEntries(body)) : { success: false, message: "fictif" };
    await route.fulfill({ status: res.__status || 200, contentType: "application/json", body: JSON.stringify(res) });
  });
  await page.clock.install({ time: new Date(now) });
  if (st) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, [KEY, JSON.stringify(st)]);
  if (setup) await ctx.addInitScript(setup);
  await page.goto(url);
  return { ctx, page, calls, external };
}
const S = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
async function addTrip(page, date, to = "Client X") {
  await page.click("#t-trips");
  await page.fill("#tDate", date); await page.dispatchEvent("#tDate", "change");
  await page.fill("#tPurpose", "Livraison de colis"); await page.fill("#tTo", to); await page.fill("#tKm", "12.5");
  await page.click("#tripForm button[type=submit]");
  return (await page.textContent("#tripMsg")).trim();
}
const goPlans = page => page.click("#t-pro");
// Active les produits Plus et Pro (identifiants FICTIFS) et/ou le mode simulation du bundle.
async function configure(page, { plus = false, pro = false, sim = false } = {}) {
  await page.evaluate(o => {
    if (o.plus) Object.assign(CONFIG.products.find(p => p.slot === "plus"), { id: "FICTIF-PLUS", url: "https://example.invalid/plus" });
    if (o.pro) Object.assign(CONFIG.products.find(p => p.slot === "pro"), { id: "FICTIF-PRO", url: "https://example.invalid/pro" });
    if (o.sim) CONFIG.bundle.mode = "simulation";
    renderAll();
  }, { plus, pro, sim });
}

// ---------- unités : dates calendaires ----------
test("addMonths : fins de mois et années bissextiles", async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(() => [
    ["2026-11-24", 3], ["2026-11-30", 3], ["2026-08-31", 3], ["2027-01-31", 3], ["2027-11-29", 3], ["2027-11-30", 3], ["2026-12-15", 3], ["2026-10-31", 3], ["2027-03-31", 1]
  ].map(([d, n]) => [d, addMonths(d, n), prevDay(addMonths(d, n))]));
  assert.deepEqual(r, [
    ["2026-11-24", "2027-02-24", "2027-02-23"],
    ["2026-11-30", "2027-03-01", "2027-02-28"],
    ["2026-08-31", "2026-12-01", "2026-11-30"],
    ["2027-01-31", "2027-05-01", "2027-04-30"],
    ["2027-11-29", "2028-02-29", "2028-02-28"],
    ["2027-11-30", "2028-03-01", "2028-02-29"],
    ["2026-12-15", "2027-03-15", "2027-03-14"],
    ["2026-10-31", "2027-01-31", "2027-01-30"],
    ["2027-03-31", "2027-05-01", "2027-04-30"]
  ]);
  await ctx.close();
});

// ---------- forfait Gratuit ----------
test("Gratuit : 12 trajets par mois calendaire, 13e refusé, autre mois permis", async () => {
  const { ctx, page, external } = await open({ st: state({ trips: trips("2026-11-03", 11) }) });
  assert.match(await page.textContent("#quota"), /Gratuit : 11 sur 12 trajets en novembre 2026/);
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.match(await addTrip(page, "2026-11-25"), /atteint 12 trajets en novembre 2026, la limite du forfait Gratuit/);
  assert.equal((await S(page)).trips.length, 12);
  assert.equal(await addTrip(page, "2026-12-01"), "Trajet ajouté.", "décembre a son propre quota");
  assert.deepEqual(external, []);
  await ctx.close();
});

test("Gratuit : trajet antidaté compté dans son mois; suppression libère une place", async () => {
  const { ctx, page } = await open({ st: state({ trips: trips("2026-10-05", 12) }) });
  assert.match(await addTrip(page, "2026-10-20"), /atteint 12 trajets en octobre 2026/);
  assert.equal(await addTrip(page, "2026-11-02"), "Trajet ajouté.");
  // suppression d'un trajet d'octobre (double clic de confirmation)
  const btn = page.locator('[data-del-trip="t202610050"]');
  await btn.click(); await btn.click();
  assert.equal(await addTrip(page, "2026-10-20"), "Trajet ajouté.");
  await ctx.close();
});

test("Gratuit : limite au passage de fin de mois (31 → 1er) selon l'heure locale", async () => {
  const { ctx, page } = await open({ now: "2026-12-31T23:30:00", st: state({ trips: trips("2026-12-02", 12) }) });
  assert.equal(await page.inputValue("#tDate"), "2026-12-31");
  assert.match(await page.textContent("#quota"), /12 sur 12 trajets en décembre 2026/);
  await page.clock.runFor(60 * 60 * 1000); // 00 h 30 le 1er janvier
  await page.reload();
  assert.equal(await page.inputValue("#tDate"), "2027-01-01");
  assert.equal(await addTrip(page, "2027-01-01"), "Trajet ajouté.");
  await ctx.close();
});

test("Dépassement existant (restauration) : rien n'est supprimé ni masqué, seuls les ajouts sont bloqués", async () => {
  const { ctx, page } = await open({ st: state({ trips: trips("2026-11-02", 30) }) });
  assert.equal(await page.locator("#tripList .item").count(), 30);
  assert.match(await page.textContent("#quota"), /30 sur 12 trajets.*plus de trajets que ton forfait actuel n'en permet/);
  assert.match(await addTrip(page, "2026-11-24"), /limite du forfait Gratuit/);
  assert.equal((await S(page)).trips.length, 30);
  await page.click("#t-sum");
  assert.match(await page.textContent("#sumBox"), /300,0 km/);
  await ctx.close();
});

test("Gratuit : rapports PDF/CSV réservés aux forfaits payants; sauvegarde gratuite", async () => {
  const { ctx, page } = await open({ st: state({ trips: trips("2026-11-02", 2) }) });
  await page.click("#t-sum"); await page.click("#bCsvT");
  assert.match(await page.textContent("#expMsg2"), /forfaits Plus et Pro/);
  await goPlans(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bBackup")]);
  const saved = JSON.parse(readFileSync(await dl.path(), "utf8"));
  assert.equal(saved.trips.length, 2);
  await ctx.close();
});

// ---------- interface des forfaits ----------
test("Onglet Forfaits FR/EN : trois forfaits, prix, Plus et Pro « Bientôt » sans lien d'achat", async () => {
  const { ctx, page } = await open();
  await goPlans(page);
  const txt = await page.textContent("#p-pro");
  assert.match(txt, /Gratuit/); assert.match(txt, /12 trajets par mois/);
  assert.match(txt.replace(/\s+/g, " "), /4,99 \$ CA par mois/); assert.doesNotMatch(txt, /\$\s*\$/);
  assert.match(txt, /60 trajets par mois/); assert.match(txt, /9,99 \$/); assert.match(txt, /Trajets illimités/);
  assert.equal(await page.locator("#p-pro a[href]").count(), 0, "aucun lien d'achat tant que les produits n'existent pas");
  assert.match(await page.textContent("#plusBuy"), /Bientôt/); assert.match(await page.textContent("#proBuy"), /Bientôt/);
  assert.match(await page.textContent("#bunBox"), /Trois mois de CarnetKM Plus offerts/);
  assert.equal(await page.isVisible("#bunForm"), false, "activation bundle masquée hors simulation");
  await page.click("#langBtn");
  const en = await page.textContent("#p-pro");
  assert.match(en, /Plans/); assert.match(en, /\$4\.99/); assert.match(en, /\$9\.99/); assert.match(en, /60 trips per month/); assert.match(en, /Coming soon/);
  assert.match(await page.textContent("#t-pro"), /Plans/);
  await ctx.close();
});

// ---------- abonnés existants (offre d'origine 4,99 $ illimitée) ----------
test("Migration : licence d'origine (ancien format sans slot) = droits Pro illimités, sans nouvelle vérification avant 3 jours", async () => {
  const verifiedAt = new Date("2026-11-23T10:00:00").getTime();
  const { ctx, page, calls } = await open({ st: state({ trips: trips("2026-11-02", 70), license: { key: "FICTIVE-KEY-0001", ok: true, verifiedAt } }) });
  assert.equal(await page.evaluate(() => plan()), "pro");
  assert.equal(await page.evaluate(() => S.license.slot), "legacy");
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  await goPlans(page);
  assert.match(await page.textContent("#proState"), /Pro \(abonnement d'origine\).*tu gardes les trajets illimités/s);
  assert.equal(calls.length, 0);
  await ctx.close();
});

test("Migration : revérification de la licence d'origine sur le produit d'origine seulement", async () => {
  const verifiedAt = new Date("2026-11-18T10:00:00").getTime();
  const { ctx, page, calls } = await open({
    st: state({ license: { key: "FICTIVE-KEY-0001", ok: true, verifiedAt } }),
    gumroad: b => b.product_id === LEGACY_ID ? { success: true, uses: 1, purchase: {} } : { success: false }
  });
  await page.waitForFunction(() => S.license.verifiedAt > Date.now() - 1000);
  assert.equal(calls.length, 1); assert.equal(calls[0].product_id, LEGACY_ID); assert.equal(calls[0].increment_uses_count, "false");
  assert.equal(await page.evaluate(() => plan()), "pro");
  await ctx.close();
});

test("Licence d'origine annulée : retour Gratuit, données conservées", async () => {
  const verifiedAt = new Date("2026-11-10T10:00:00").getTime();
  const { ctx, page } = await open({
    st: state({ trips: trips("2026-11-02", 20), license: { key: "FICTIVE-KEY-0001", ok: true, verifiedAt, slot: "legacy" } }),
    gumroad: () => ({ success: true, purchase: { subscription_cancelled_at: "2026-11-20T00:00:00Z" } })
  });
  await page.waitForFunction(() => S.license.ok === false);
  assert.equal(await page.evaluate(() => plan()), "free");
  assert.equal(await page.locator("#tripList .item").count(), 20);
  await ctx.close();
});

// ---------- Plus et Pro (produits fictifs) ----------
test("Plus : activation d'une clé Plus, 60 trajets/mois, rapports permis", async () => {
  const { ctx, page, calls } = await open({ st: state({ trips: trips("2026-11-02", 59) }), gumroad: b => b.product_id === "FICTIF-PLUS" ? { success: true, uses: 1, purchase: {} } : { success: false } });
  await configure(page, { plus: true, pro: true });
  await goPlans(page);
  assert.match(await page.getAttribute("#plusBuy a", "href"), /example\.invalid\/plus/);
  await page.fill("#licKey", "FICTIVE-PLUS-KEY"); await page.click("#bLic");
  await page.waitForFunction(() => S.license && S.license.slot === "plus");
  assert.ok(calls.some(c => c.product_id === "FICTIF-PLUS" && c.increment_uses_count === "true"));
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.match(await page.textContent("#plusBuy"), /Ton forfait/);
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.match(await addTrip(page, "2026-11-25"), /atteint 60 trajets.*forfait Plus/);
  await page.click("#t-sum");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bCsvT")]);
  assert.match(dl.suggestedFilename(), /carnetkm-trajets-2026\.csv/);
  await ctx.close();
});

test("Pro : trajets illimités", async () => {
  const { ctx, page } = await open({ st: state({ trips: trips("2026-11-02", 100) }), gumroad: b => b.product_id === "FICTIF-PRO" ? { success: true, purchase: {} } : { success: false } });
  await configure(page, { plus: true, pro: true });
  await goPlans(page); await page.fill("#licKey", "FICTIVE-PRO-KEY"); await page.click("#bLic");
  await page.waitForFunction(() => S.license && S.license.slot === "pro");
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.match(await page.textContent("#quota"), /Pro : 101 trajets en novembre 2026, sans limite/);
  await ctx.close();
});

test("Clé inconnue refusée; erreur réseau transitoire sans perte de droits", async () => {
  let down = false;
  const { ctx, page } = await open({ gumroad: () => down ? { __status: 503 } : { success: false } });
  await configure(page, { plus: true, pro: true });
  await goPlans(page); await page.fill("#licKey", "INCONNUE"); await page.click("#bLic");
  await page.waitForFunction(() => /pas valide/.test(document.querySelector("#licMsg").textContent));
  down = true; await page.click("#bLic");
  await page.waitForFunction(() => /Impossible de joindre/.test(document.querySelector("#licMsg").textContent));
  await ctx.close();
});

// ---------- offre bundle SharpLaughs (simulation) ----------
test("Bundle (simulation) : 3 mois Plus, sans renouvellement, retour Gratuit à l'échéance, données intactes", async () => {
  const { ctx, page, external } = await open({ st: state({ trips: trips("2026-11-02", 15) }) });
  await configure(page, { sim: true });
  await goPlans(page);
  assert.match(await page.textContent("#bunSoon"), /Mode simulation/);
  await page.fill("#bunCode", "DEMO-ABCD"); await page.click("#bBun");
  assert.match(await page.textContent("#bunMsg"), /forfait Plus jusqu'au 23 février 2027 inclusivement/);
  const s1 = await S(page);
  assert.deepEqual({ plan: s1.trial.plan, start: s1.trial.start, end: s1.trial.end }, { plan: "plus", start: "2026-11-24", end: "2027-02-24" });
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.match(await page.textContent("#proState"), /Aucun renouvellement automatique/);
  assert.match(await page.textContent("#proState"), /Forfait actif : Plus/);
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.", "16e trajet permis en Plus");
  const st2 = await S(page);
  await ctx.close();

  // 23 février 2027 : encore actif; 24 février : terminé
  for (const [now, expected] of [["2027-02-23T23:59:00", "plus"], ["2027-02-24T00:00:30", "free"]]) {
    const o = await open({ now, st: st2 });
    await configure(o.page, { sim: true });
    assert.equal(await o.page.evaluate(() => plan()), expected, now);
    if (expected === "free") {
      await goPlans(o.page);
      assert.match(await o.page.textContent("#proState"), /a pris fin le 23 février 2027.*toutes tes données restent là/s);
      assert.equal(await o.page.locator("#tripList .item").count(), 16);
      assert.equal(await o.page.isVisible("#bunForm"), false);
    }
    await o.ctx.close();
  }
  assert.deepEqual(external, []);
});

test("Bundle (simulation) : code à usage unique par appareil, une seule offre, codes non fictifs refusés", async () => {
  const { ctx, page } = await open();
  await configure(page, { sim: true }); await goPlans(page);
  await page.fill("#bunCode", "SHARP-REAL-123"); await page.click("#bBun");
  assert.match(await page.textContent("#bunMsg"), /pas valide/);
  await page.fill("#bunCode", "demo-wxyz"); await page.click("#bBun");
  assert.match(await page.textContent("#bunMsg"), /Offre activée/);
  await page.evaluate(() => { S.trial = null; save(); renderAll(); });
  await page.fill("#bunCode", "DEMO-WXYZ"); await page.click("#bBun");
  assert.match(await page.textContent("#bunMsg"), /déjà été utilisé/);
  await ctx.close();
});

test("Bundle : désactivé par défaut (aucune activation possible hors simulation)", async () => {
  const { ctx, page } = await open();
  assert.equal(await page.evaluate(() => CONFIG.bundle.mode), "off");
  await page.evaluate(() => activateBundle());
  assert.equal((await S(page))?.trial ?? null, null);
  await ctx.close();
});

test("Bundle : activation le 30 novembre → fin le 28 février inclus; 31 août → 30 novembre inclus", async () => {
  for (const [now, last, end] of [["2026-11-30T09:00:00", "28 février 2027", "2027-03-01"], ["2026-08-31T09:00:00", "30 novembre 2026", "2026-12-01"]]) {
    const { ctx, page } = await open({ now });
    await configure(page, { sim: true }); await goPlans(page);
    await page.fill("#bunCode", "DEMO-EOM1"); await page.click("#bBun");
    assert.match(await page.textContent("#bunMsg"), new RegExp("jusqu'au " + last));
    assert.equal((await S(page)).trial.end, end);
    await ctx.close();
  }
});

test("Changement de forfait : bundle Plus + abonnement Pro → Pro; fin de Pro → retour Plus jusqu'à l'échéance", async () => {
  const trial = { plan: "plus", start: "2026-11-24", end: "2027-02-24", source: "bundle-sim", ref: "DEMO-AAAA" };
  const { ctx, page } = await open({ now: "2026-12-10T10:00:00", st: state({ trial, redeemed: ["DEMO-AAAA"], trips: trips("2026-12-01", 61) }), gumroad: b => b.product_id === "FICTIF-PRO" ? { success: true, purchase: {} } : { success: false } });
  await configure(page, { plus: true, pro: true, sim: true });
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.match(await addTrip(page, "2026-12-10"), /atteint 60 trajets/);
  await goPlans(page); await page.fill("#licKey", "FICTIVE-PRO-KEY"); await page.click("#bLic");
  await page.waitForFunction(() => plan() === "pro");
  assert.match(await page.textContent("#proFlash"), /Abonnement activé/);
  assert.match(await page.textContent("#proState"), /Forfait actif : Pro.*Offre bundle SharpLaughs/s);
  assert.equal(await addTrip(page, "2026-12-10"), "Trajet ajouté.");
  await goPlans(page); await page.click("#licRm");
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.equal((await S(page)).trips.length, 62);
  await ctx.close();
});

test("Bundle : offre falsifiée (durée > 3 mois ou forfait Pro) rejetée au chargement", async () => {
  for (const trial of [
    { plan: "plus", start: "2026-11-24", end: "2030-01-01", source: "bundle-sim" },
    { plan: "pro", start: "2026-11-24", end: "2027-02-24", source: "bundle-sim" },
    { plan: "plus", start: "bad", end: "2027-02-24" }
  ]) {
    const { ctx, page } = await open({ st: state({ trial }) });
    assert.equal(await page.evaluate(() => S.trial), null);
    assert.equal(await page.evaluate(() => plan()), "free");
    await ctx.close();
  }
});

// ---------- sauvegardes ----------
test("Sauvegarde : format v1 inchangé, sans licence ni offre; restauration conserve les droits de l'appareil", async () => {
  const trial = { plan: "plus", start: "2026-11-24", end: "2027-02-24", source: "bundle-sim", ref: "DEMO-AAAA" };
  const { ctx, page } = await open({ st: state({ trips: trips("2026-11-02", 3), trial, redeemed: ["DEMO-AAAA"], license: { key: "FICTIVE-KEY-0001", ok: true, verifiedAt: Date.parse("2026-11-23T10:00:00"), slot: "legacy" } }) });
  await goPlans(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bBackup")]);
  const saved = JSON.parse(readFileSync(await dl.path(), "utf8"));
  assert.equal(saved.app, "carnetkm"); assert.equal(saved.v, 1);
  for (const k of ["license", "trial", "redeemed"]) assert.equal(k in saved, false, k);
  assert.doesNotMatch(JSON.stringify(saved), /FICTIVE-KEY|DEMO-AAAA/);
  // restauration d'une ancienne sauvegarde (format de main d2bc1d0) contenant une licence et une offre injectées
  const old = state({ trips: trips("2026-10-01", 25), license: { key: "INJECTEE", ok: true, verifiedAt: Date.now() }, trial: { plan: "plus", start: "2026-11-01", end: "2027-02-01" } });
  await page.setInputFiles("#fRestore", { name: "old.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
  await page.click("#bkYes");
  const s = await S(page);
  assert.equal(s.trips.length, 25, "restauration jamais tronquée par le quota");
  assert.equal(s.license.key, "FICTIVE-KEY-0001"); assert.equal(s.trial.ref, "DEMO-AAAA");
  await ctx.close();
});

// ---------- régression SEC-001 ----------
test("SEC-001 : sauvegarde piégée neutralisée (XSS, identifiants), CSV protégé contre l'injection de formules", async () => {
  const evil = state({ trips: [trip("2026-11-02", 0, { id: '"><img src=x onerror=window.__pwn=1>', to: "<img src=x onerror=window.__pwn=1>", purpose: "=HYPERLINK(\"http://x\")" })] });
  const { ctx, page } = await open({ st: state({ license: { key: "FICTIVE-KEY-0001", ok: true, verifiedAt: Date.parse("2026-11-23T10:00:00") } }) });
  await goPlans(page);
  await page.setInputFiles("#fRestore", { name: "evil.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(evil)) });
  await page.click("#bkYes");
  await page.click("#t-trips");
  assert.equal(await page.evaluate(() => window.__pwn), undefined);
  assert.match((await S(page)).trips[0].id, /^[a-z0-9]{1,24}$/);
  await page.click("#t-sum");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bCsvT")]);
  assert.match(readFileSync(await dl.path(), "utf8"), /"'=HYPERLINK/);
  await ctx.close();
});

test("SEC-001 : CSP inchangée, polices locales, service worker v5, aucune requête externe", async () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(html, /content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https:\/\/api\.gumroad\.com; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'"/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(readFileSync(join(ROOT, "sw.js"), "utf8"), /carnetkm-v5/);
  const app = readFileSync(join(ROOT, "app.js"), "utf8");
  assert.deepEqual([...app.matchAll(/fetch\(([^,]+),/g)].map(m => m[1]).sort(), ['"https://api.gumroad.com/v2/licenses/verify"', "CONFIG.entitlements.endpoint + path"].sort(), "seuls Gumroad (mode direct) et le service de droits configuré sont appelés");
  const { ctx, page, external } = await open();
  const csp = []; page.on("console", m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  for (const tab of ["#t-exp", "#t-sum", "#t-pro", "#t-trips"]) await page.click(tab);
  assert.deepEqual(external, []); assert.deepEqual(csp, []);
  await ctx.close();
});

// ---------- mobile ----------
test("Mobile (iPhone 13) : forfaits empilés, pas de défilement horizontal, saisie fonctionnelle", async () => {
  const { ctx, page } = await open({ device: "iPhone 13", st: state({ trips: trips("2026-11-02", 3) }) });
  await page.tap("#t-pro");
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(w[0] <= w[1], "pas de débordement : " + w);
  const xs = await page.evaluate(() => ["planFree", "planPlus", "planPro"].map(id => document.getElementById(id).getBoundingClientRect().x));
  assert.equal(new Set(xs).size, 1, "cartes empilées");
  await page.screenshot({ path: join(tmpdir(), "carnetkm-plans-mobile.png"), fullPage: true });
  await page.tap("#t-trips");
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  await ctx.close();
});

// ---------- hors ligne (HTTPS local, service worker réel) ----------
test("Hors ligne : service worker v5, rechargement sans réseau, quota et offre appliqués localement", async () => {
  const trial = { plan: "plus", start: "2026-11-24", end: "2027-02-24", source: "bundle-sim", ref: "DEMO-AAAA" };
  const { ctx, page } = await open({ url: `https://localhost:${HTTPS}/`, st: state({ trial, trips: trips("2026-11-02", 59) }) });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), "page contrôlée par le service worker");
  assert.ok(await page.evaluate(async () => (await caches.keys()).includes("carnetkm-v5")));
  await ctx.setOffline(true);
  await page.reload();
  await configure(page, { sim: true });
  assert.equal(await page.evaluate(() => plan()), "plus");
  assert.equal(await addTrip(page, "2026-11-24"), "Trajet ajouté.");
  assert.match(await addTrip(page, "2026-11-25"), /atteint 60 trajets/);
  await ctx.close();
});
