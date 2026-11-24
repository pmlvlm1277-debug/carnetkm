// Adaptateur local imitant l'API Cloudflare D1 sur node:sqlite (tests et développement seulement).
// batch() s'exécute dans une transaction, comme D1 (tout ou rien).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function createLocalD1(schemaPath, file = ":memory:") {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(schemaPath, "utf8"));
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args), success: true }),
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    _exec: () => { const st = db.prepare(sql); return /^\s*(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql) ? st.all(...args) : st.run(...args); }
  });
  return {
    raw: db,
    prepare: sql => wrap(sql),
    batch: async stmts => {
      db.exec("BEGIN IMMEDIATE");
      try { const out = stmts.map(s => s._exec()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  };
}
