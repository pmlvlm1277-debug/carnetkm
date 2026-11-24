-- Service de droits CarnetKM (MISSION-CARNETKM-002-B) — schéma SQLite compatible Cloudflare D1.
-- Données minimales : aucune donnée de trajet, de dépense, d'adresse ni de renseignement fiscal.
-- Courriels, numéros de commande et clés de licence ne sont JAMAIS stockés en clair : seulement HMAC-SHA256(PEPPER, valeur normalisée).

-- Idempotence des webhooks Fourthwall (livraison « au moins une fois »). Purge après 30 jours.
CREATE TABLE IF NOT EXISTS fw_events (
  event_id    TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);

-- Marqueurs d'annulation/remboursement reçus éventuellement AVANT ORDER_PLACED (ordre non garanti).
CREATE TABLE IF NOT EXISTS order_flags (
  order_id_h TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Un droit par unité admissible (commande × offre admissible × unité). L'unicité est garantie par la contrainte UNIQUE,
-- l'activation unique par une mise à jour conditionnelle (status = 'eligible') exécutée par l'unique écrivain SQLite.
CREATE TABLE IF NOT EXISTS grants (
  id            TEXT PRIMARY KEY,                 -- identifiant aléatoire (128 bits)
  source        TEXT NOT NULL CHECK (source IN ('fourthwall','manual')),
  order_id_h    TEXT NOT NULL,                    -- HMAC(identifiant interne de commande)
  order_ref_h   TEXT NOT NULL,                    -- HMAC(numéro de commande affiché au client)
  email_h       TEXT NOT NULL,                    -- HMAC(courriel normalisé)
  offer_id      TEXT NOT NULL,                    -- identifiant d'offre Fourthwall admissible (non personnel)
  unit          INTEGER NOT NULL CHECK (unit >= 0),
  plan          TEXT NOT NULL DEFAULT 'plus' CHECK (plan IN ('plus')),
  status        TEXT NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible','active','revoked')),
  claim_code_h  TEXT UNIQUE,                      -- code manuel (solution de secours), haché
  recovery_h    TEXT UNIQUE,                      -- code de récupération remis à l'activation, haché
  start_date    TEXT,                             -- AAAA-MM-JJ, America/Toronto, horloge serveur
  end_date      TEXT,                             -- fin exclusive (3 mois calendaires)
  activated_at  INTEGER,
  devices       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  revoked_reason TEXT,
  UNIQUE (order_id_h, offer_id, unit)
);
CREATE INDEX IF NOT EXISTS grants_by_claim ON grants (order_ref_h, email_h, status);

-- Appareils liés à une licence Gumroad (limite le partage de clés, risque F2). Identifiant d'installation haché.
CREATE TABLE IF NOT EXISTS license_devices (
  license_h  TEXT NOT NULL,
  device_h   TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (license_h, device_h)
);

-- Limitation de débit à fenêtre fixe (clés hachées). Purge quotidienne.
CREATE TABLE IF NOT EXISTS rate (
  k   TEXT PRIMARY KEY,
  win INTEGER NOT NULL,
  n   INTEGER NOT NULL
);
