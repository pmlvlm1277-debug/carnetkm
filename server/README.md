# Service de droits CarnetKM — prototype local

Non déployé, aucune donnée ni clé réelle. Voir `../docs/CARNETKM-002-B-service-droits.md`.

```bash
node --no-warnings --test server/test/server.test.mjs     # 25 tests du service
node --no-warnings --test tests/server-e2e.test.mjs        # 6 tests navigateur ↔ service
node --no-warnings server/dev/serve.mjs                    # app + service locaux sur http://localhost:8790
```

- `src/worker.js` : routes (Workers), `src/lib.js` : cryptographie, codes, dates; `schema.sql` : base D1.
- `src/d1-local.js` : imitation locale de D1 (node:sqlite) pour les tests.
- `scripts/issue-manual-code.mjs` : solution de secours manuelle (code `CKM-` à usage unique).
- `wrangler.toml.example` : configuration d'exemple; les secrets passent par `wrangler secret put`, jamais par le dépôt.
