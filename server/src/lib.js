// Primitives du service de droits : Web Crypto uniquement (identique dans Cloudflare Workers et Node 22).

const enc = new TextEncoder();

// ---------- encodages ----------
export function b64(bytes) { let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); }
export function b64url(bytes) { return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function unb64url(s) { const t = s.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); }
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");

// Comparaison à temps constant (chaînes ASCII).
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// ---------- HMAC ----------
const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) keyCache.set(secret, crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  return keyCache.get(secret);
}
export async function hmacRaw(secret, data) { return new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), typeof data === "string" ? enc.encode(data) : data)); }
// Empreinte non réversible d'un identifiant (courriel, commande, code, clé) avec domaine séparé.
export async function fingerprint(pepper, domain, value) { return hex(await hmacRaw(pepper, domain + "\u0000" + value)); }

// Vérifie la signature Fourthwall : base64(HMAC-SHA256(secret, corps brut)) dans X-Fourthwall-Hmac-SHA256.
export async function verifyFourthwallSignature(secret, rawBody, header) {
  if (!secret || typeof header !== "string" || !header) return false;
  return safeEqual(b64(await hmacRaw(secret, rawBody)), header.trim());
}

// ---------- normalisation ----------
export const normEmail = e => String(e || "").trim().toLowerCase();
export const normOrderRef = r => String(r || "").trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "");
export const normCode = c => String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

// ---------- codes aléatoires (Crockford base32, 130 bits) ----------
const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function randomCode(prefix = "") {
  const bytes = crypto.getRandomValues(new Uint8Array(17)); // 136 bits tirés, 26 symboles × 5 bits = 130 bits utilisés
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5 && out.length < 26) { out += ALPHA[(val >> (bits - 5)) & 31]; bits -= 5; } }
  return prefix + out.match(/.{1,5}/g).join("-");
}
export function randomId() { return hex(crypto.getRandomValues(new Uint8Array(16))); }

// ---------- dates calendaires (America/Toronto, horloge serveur) ----------
export function torontoDate(ms, tz = "America/Toronto") {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const fmt = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// Même règle que le client (app.js) : fin exclusive au même quantième n mois plus tard, sinon 1er du mois suivant.
export function addMonths(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const idx = (m - 1) + n, ty = y + Math.floor(idx / 12), tm = ((idx % 12) + 12) % 12 + 1;
  const dim = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  if (d <= dim) return fmt(ty, tm, d);
  return tm === 12 ? fmt(ty + 1, 1, 1) : fmt(ty, tm + 1, 1);
}

// ---------- jetons signés ES256 (JWS compact) ----------
export async function importSigningKey(jwkJson) {
  const jwk = typeof jwkJson === "string" ? JSON.parse(jwkJson) : jwkJson;
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
export async function signToken(privateKey, kid, payload) {
  const head = b64url(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(head + "." + body));
  return head + "." + body + "." + b64url(sig);
}
// Vérification (utilisée par les tests; le client a sa propre copie dans app.js).
export async function verifyToken(publicJwks, token, nowMs) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  let head, payload;
  try { head = JSON.parse(new TextDecoder().decode(unb64url(parts[0]))); payload = JSON.parse(new TextDecoder().decode(unb64url(parts[1]))); } catch { return null; }
  if (head.alg !== "ES256" || !publicJwks[head.kid]) return null;
  const key = await crypto.subtle.importKey("jwk", publicJwks[head.kid], { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64url(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!ok || typeof payload.exp !== "number" || nowMs / 1000 >= payload.exp) return null;
  return payload;
}
