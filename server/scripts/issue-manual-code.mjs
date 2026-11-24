// Solution de secours MANUELLE (faible volume) : le propriétaire vérifie lui-même une commande Fourthwall admissible
// dans son tableau de bord, puis génère localement un code CKM- à usage unique et l'instruction SQL à appliquer à la base.
// Le SQL ne contient que des empreintes HMAC : ni code, ni courriel, ni numéro de commande en clair.
// Usage (PROTOTYPE, aucune base réelle) :
//   PEPPER=… node server/scripts/issue-manual-code.mjs --order FW1234 --email client@example.test --offer offer_ID
// Puis, après autorisation distincte : wrangler d1 execute <base> --remote --command "<SQL affiché>"
// Le code s'envoie au client depuis la messagerie habituelle du propriétaire (aucun service de courriel payant).
import { fingerprint, normCode, normEmail, normOrderRef, randomCode, randomId } from "../src/lib.js";
import { fileURLToPath } from "node:url";

export async function manualGrantSql({ pepper, orderRef, email, offerId, unit = 0, now = Date.now() }) {
  if (!pepper || pepper.length < 32) throw new Error("PEPPER manquant ou trop court");
  const code = randomCode("CKM-");
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  const orderIdH = await fingerprint(pepper, "order-id", "manual:" + normOrderRef(orderRef));
  const refH = await fingerprint(pepper, "order-ref", normOrderRef(orderRef));
  const emailH = await fingerprint(pepper, "email", normEmail(email));
  const claimH = await fingerprint(pepper, "claim", normCode(code));
  const sql = `INSERT OR IGNORE INTO grants (id, source, order_id_h, order_ref_h, email_h, offer_id, unit, status, claim_code_h, created_at) VALUES (${q(randomId())}, 'manual', ${q(orderIdH)}, ${q(refH)}, ${q(emailH)}, ${q(offerId)}, ${Number(unit)}, 'eligible', ${q(claimH)}, ${Number(now)});`;
  return { code, sql };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = k => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : undefined; };
  const out = await manualGrantSql({ pepper: process.env.PEPPER, orderRef: arg("order"), email: arg("email"), offerId: arg("offer") });
  console.log("Code à remettre au client (une seule fois) :", out.code);
  console.log("SQL à appliquer :\n" + out.sql);
}
