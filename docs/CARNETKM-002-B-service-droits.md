# CarnetKM : service sécurisé de droits (MISSION-CARNETKM-002-B)

**Statut** : prototype local versionné sur `claude/carnetkm-entitlements-server`, dérivé de la PR #3 (`ee6c470`). Rien n'a été déployé : aucun compte n'a été créé, aucun secret réel n'est utilisé, aucun appel n'est fait à une API de paiement réelle et aucun courriel n'est envoyé.

**Légende des statuts** :

- ✅ confirmé : testé localement, ou lu dans la documentation officielle ;
- 🔎 à vérifier : source secondaire, résumé de recherche, ou page officielle non lisible depuis la session ;
- 💡 proposé : décision restant à prendre.

## 1. Décisions approuvées par le propriétaire (24 nov. 2026) et ce qui ne l'est pas

| Sujet | Statut |
|---|---|
| Sauvegarde, restauration et dépenses gratuites ; PDF et CSV réservés à Plus et Pro | ✅ approuvé, implémenté (PR #3) |
| Offre d'origine à 4,99 $ illimitée : retirée des nouvelles ventes **seulement** quand Plus et Pro sont prêts ; droits existants préservés | ✅ approuvé. Aucun retrait n'a été fait ; la bascule coordonnée est décrite en section 9 |
| Préparer l'option serveur sécurisée | ✅ approuvé, objet de ce document |
| Réclamation par **numéro de commande et courriel**, sans envoi de courriel | 💡 non explicitement approuvé : choix technique pour éviter les coûts de courriel |
| Code de récupération et plafond de 3 appareils par droit ou par licence | 💡 non explicitement approuvé |
| Passage des licences Gumroad par le service (au lieu d'appels directs depuis le navigateur) | 💡 non explicitement approuvé |
| Jeton valide 7 jours, servant de délai de grâce hors ligne (contre 14 jours aujourd'hui) | 💡 à décider |
| Révocation automatique sur `CANCELLED` / `REFUNDED`, et examen manuel pour un remboursement partiel | 💡 à décider ; les statuts exacts sont 🔎 |

## 2. Intégration commerciale : constats en lecture seule

**Accès** :

- Le connecteur Fourthwall répond toujours « Sign in » dans cette session.
- Les pages `docs.fourthwall.com`, `help.fourthwall.com`, `developers.cloudflare.com`, `gumroad.com` et `mintlify.com` ne sont pas joignables depuis la session : DNS bloqué par la politique réseau.
- Les faits ci-dessous viennent donc des **résumés du moteur de recherche** de ces pages officielles. Ils sont à relire directement avant tout déploiement.

### Fourthwall (boutique de vêtements et bundle SharpLaughs)

- 🔎 Webhooks de boutique signés : en-tête `X-Fourthwall-Hmac-SHA256` contenant base64(HMAC-SHA256(secret, corps brut)). Le secret est dans le panneau de configuration des webhooks, et l'exemple officiel compare en temps constant. → [Signature verification](https://docs.fourthwall.com/webhooks/signature-verification)
- 🔎 Événements `ORDER_PLACED` et `ORDER_UPDATED` (mise à jour de statut, d'adresse ou de courriel). L'enveloppe contient `testMode` et `data` ; `data.offers` est un tableau de lignes. → [Order placed](https://docs.fourthwall.com/api-reference/order-events/order-placed), [Order updated](https://docs.fourthwall.com/api-reference/order-events/order-updated), [Aide webhooks](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/webhooks-for-memberships-and-orders)
- 🔎 Livraison « au moins une fois », sans ordre garanti entre sujets. → [Limitations](https://docs.fourthwall.com/platform/webhooks/limitations)
- 🔎 **Non confirmé** :
  - les valeurs exactes de statut d'annulation ou de remboursement (`CANCELLED`, `REFUNDED` sont des hypothèses configurables) ;
  - l'emplacement de la quantité (`offers[].variant.quantity` ou `offers[].quantity`, les deux sont gérés) ;
  - le contenu d'une ligne de bundle.

  → Une **livraison de test** depuis le tableau de bord est nécessaire, avec autorisation.
- 🔎 Aucun mécanisme natif pour remettre un **code unique par acheteur** (seules les cartes-cadeaux en ont). Un produit numérique livre un fichier identique pour tous. → [Produits numériques avancés](https://help.fourthwall.com/create-and-sell-products/how-to-guides/digital-products-advanced), [Cartes-cadeaux](https://help.fourthwall.com/create-and-sell-products/how-to-guides/set-up-gift-cards)
- **Conséquence** : la conception n'envoie aucun code. L'acheteur saisit dans CarnetKM son **numéro de commande** et le **courriel de la commande**, que le service compare aux empreintes reçues par webhook signé. Le bundle peut contenir un fichier d'instructions identique pour tous (un lien vers CarnetKM, sans code).

### Gumroad (abonnements Plus, Pro et abonnement d'origine)

- 🔎 `POST /v2/licenses/verify` sans authentification. Paramètres : `product_id` (obligatoire pour les produits récents), `license_key`, `increment_uses_count`. Un produit avec clés dans un bundle Gumroad remet sa propre clé. → [License keys](https://gumroad.com/help/article/76-license-keys), [Bundles](https://gumroad.com/help/article/339-product-bundles)
- 🔎 Abonnements aux ressources : `sale`, `refund`, `cancellation`, `subscription_ended`, `subscription_restarted`, `subscription_updated`, `dispute`, `dispute_won`. **Aucune signature documentée** : Gumroad recommande de revérifier par l'API. → [Resource subscriptions](https://www.mintlify.com/antiwork/gumroad/api/resource-subscriptions), [Ping](https://gumroad.com/ping)
- **Conception** : le service ne fait jamais confiance à un ping Gumroad. Il revérifie la licence auprès de Gumroad à chaque émission de jeton (au plus tous les 7 jours par appareil). Les webhooks Gumroad ne sont donc pas nécessaires ; ils restent une amélioration possible pour accélérer une révocation.
- **Abonnés historiques** : le produit d'origine (`DHMf78a9yPLxm2vB_mFe_w==`) est associé à `plan:"pro", slot:"legacy"`. Ces abonnés gardent les trajets illimités et toutes les fonctions, sans changement de contrat. Testé par le service et de bout en bout.

### Automatisation directe ou secours manuel (Fourthwall)

| | Webhook automatique (recommandé) | Secours manuel (faible volume) |
|---|---|---|
| Fonctionnement | Webhook signé `ORDER_PLACED`, puis droits admissibles ; réclamation par l'acheteur dans l'app | Le propriétaire vérifie la commande dans Fourthwall, lance `server/scripts/issue-manual-code.mjs` et envoie le code `CKM-…` depuis sa messagerie |
| Délai pour l'acheteur | Immédiat | Selon la disponibilité du propriétaire |
| Coût | 0 $ | 0 $ ; environ 2 minutes par commande |
| Volume adapté | Illimité dans les quotas gratuits | Moins d'environ 10 commandes par semaine |
| Risque | Dépend du format réel du webhook (🔎) | Erreur humaine ; le code transite par courriel |

Les deux voies utilisent la même base, et le code manuel est à usage unique (testé).

## 3. Choix d'hébergement

| Option | Unicité atomique | Coût et quotas gratuits | Au dépassement | Verdict |
|---|---|---|---|---|
| **Cloudflare Workers + D1** | ✅ Contraintes `UNIQUE` SQLite et `UPDATE … WHERE status='eligible'` (un seul écrivain) ; `batch()` transactionnel 🔎 | 🔎 Workers : 100 000 requêtes/jour. D1 : 5 M lignes lues et 100 000 écrites par jour, 5 Go | 🔎 Erreurs (1027 pour Workers, requêtes D1 refusées) jusqu'à minuit UTC ; **aucune facturation automatique** sur l'offre gratuite ; alertes par courriel | **Retenu** : SQL simple, migrations, Time Travel (🔎 rétention à vérifier) |
| Workers + Durable Objects (SQLite) | ✅ Forte cohérence par objet | 🔎 Offre gratuite limitée au stockage SQLite, 5 Go ; pas de facturation sur l'offre gratuite | Erreurs | Alternative valable ; plus complexe (un objet par commande ou par droit) |
| Workers KV seul | ❌ Cohérence à terme (environ 60 s) | Gratuit | | **Rejeté** pour l'unicité, comme l'exige le mandat |
| Supabase (Postgres) | ✅ | 🔎 Projets gratuits mis en pause après inactivité | | Possible ; la pause est risquée pour un service d'activation |
| Appels directs à Gumroad sans serveur (PR #3, option A) | ❌ Unicité seulement indicative | 0 $ | | Insuffisant pour l'offre Fourthwall |

Sources : [D1 limits](https://developers.cloudflare.com/d1/platform/limits), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 free tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing), [DO free tier](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier/).

## 4. Architecture

```
Fourthwall ──(webhook signé HMAC)──► /v1/webhooks/fourthwall ──► D1 : fw_events, order_flags, grants (empreintes HMAC)
CarnetKM (navigateur) ──{order,email}──► /v1/bundle/claim ──► activation unique → jeton ES256 + code de récupération (une fois)
                     ──{code}────────► /v1/bundle/recover ─► même droit, mêmes dates (nouvel appareil, plafond 3)
                     ──{token}───────► /v1/bundle/refresh ─► nouveau jeton si le droit est toujours actif
                     ──{key,device}──► /v1/license ───────► revérification Gumroad → jeton ES256 (plan, slot)
Cron quotidien ─────────────────────► purge selon la rétention
```

- **Données envoyées par l'app** : uniquement `{order, email}`, `{code}`, `{token}` ou `{key, device}`. **Aucun trajet, aucune dépense, aucune adresse, aucun renseignement fiscal.** Tout champ supplémentaire est ignoré et jamais stocké (testé).
- **Stockage** : seulement des empreintes `HMAC-SHA256(PEPPER, domaine‖valeur)` du courriel, de la commande, des codes, de la clé de licence et de l'identifiant d'appareil. Les identifiants d'offre et les dates sont stockés en clair. Aucun nom, aucune adresse, aucun montant.
- **Unicité et concurrence** :
  - `UNIQUE(order_id_h, offer_id, unit)` combiné à `INSERT OR IGNORE` rend les webhooks idempotents (répétés ou concurrents, testé ×8) ;
  - `UPDATE … WHERE status='eligible'` garantit une seule activation (20 requêtes simultanées donnent un seul code, testé) ;
  - le plafond d'appareils passe par une insertion conditionnelle atomique.
- **Événements hors ordre** : un remboursement reçu avant la commande laisse un marqueur dans `order_flags`, et la commande crée alors un droit déjà révoqué (testé).
- **Codes** : 130 bits aléatoires en base32 Crockford (`R-XXXXX-…` pour la récupération, `CKM-…` pour le manuel). Ils sont stockés hachés et normalisés (O/0, I/L/1, espaces, tirets).
- **Jetons** :
  - format JWS ES256 avec `kid` ;
  - charge utile : `{src, sub, plan, slot | ent_start/ent_end, iat, exp = iat + 7 j}` ;
  - le client vérifie avec les **clés publiques** de `CONFIG.entitlements.keys` ;
  - la clé privée est un secret Workers.
- **Rotation des clés** : nouveau `kid`, en gardant l'ancienne clé publique dans `PUBLIC_KEYS` et dans le client pendant au moins 60 jours. Le renouvellement d'un ancien jeton est testé.
- **Limitation de débit** :
  - 20 réclamations par 10 minutes et par IP (empreinte, purgée après 48 h) ;
  - **8 essais par heure et par numéro de commande**, contre l'énumération des courriels ;
  - réponse 404 identique pour une commande inconnue ou un mauvais courriel.

  En complément possible : le binding *Rate Limiting* de Cloudflare (🔎 disponibilité gratuite).
- **Échec fermé** : en production, il manque un secret, `ACCEPT_TEST_EVENTS=true`, une horloge de test est injectée, l'API Gumroad est détournée ou l'origine n'est pas en HTTPS → réponse 503 sans aucun détail (testé).
- **CORS** : seule l'origine de l'application est acceptée. Le webhook n'a pas de CORS.
- **Journaux** : uniquement `{"evt":…, "outcome":…}`, jamais de corps, d'IP, de courriel ni d'exception (testé).

## 5. Politiques

- **Horloge** : les dates de début et de fin sont fixées par **l'horloge du serveur, en America/Toronto**. Exemples : activation le 30 nov. 22 h 30 à Toronto, fin exclusive le 1er mars ; activation le 24 nov., fin le 23 févr. inclus.
- **Durée** : 3 mois calendaires, sans renouvellement. À l'échéance, le service refuse le renouvellement (410), et l'app revient au forfait Gratuit sans rien supprimer.
- **Révocation** :
  - Fourthwall `REFUNDED` / `CANCELLED` (🔎), y compris un droit déjà actif ;
  - Gumroad remboursé, contesté ou abonnement terminé.

  L'effet se produit au prochain renouvellement, au plus 7 jours plus tard.
- **Remboursement partiel** : aucune action automatique ; examen manuel.
- **Grâce hors ligne** : le jeton reste valide jusqu'à son expiration (7 jours). Si le service est en panne, l'app garde le droit jusqu'à cette date (testé).
- **Changement d'appareil** : code de récupération, ou à nouveau commande et courriel. Mêmes dates, plafond de 3 appareils. Pour une licence Gumroad, plafond de 3 appareils par clé (réduit F2).
- **Limite assumée (F1)** : les quotas et exports s'appliquent dans le navigateur. La signature empêche de **fabriquer** des droits (un jeton falsifié est ignoré, testé), mais une personne technique peut toujours modifier le code client ou l'horloge locale pour contourner un quota. Seul un traitement serveur des données pourrait l'empêcher, ce qui contredit l'exigence de garder les données sur l'appareil.

## 6. Confidentialité (Loi 25, à faire examiner)

- Les empreintes de courriel et de commande restent des **renseignements personnels pseudonymisés** : elles sont réidentifiables par qui détient le PEPPER.
- Hébergement Cloudflare hors Québec : **évaluation des facteurs relatifs à la vie privée** requise avant communication hors Québec. Il faut aussi désigner un responsable, mettre à jour la politique de confidentialité (finalité : vérifier l'achat et les droits ; liste des données ; rétention ; droits d'accès et de rectification) et préciser le consentement au moment de la réclamation.
- **Rétention appliquée par le cron** : événements 30 jours ; compteurs de débit 48 h ; droits supprimés 12 mois après l'échéance (ou 24 mois s'ils ne sont jamais activés) ; appareils de licence inactifs 12 mois ; marqueurs de commande 24 mois.
- Avec cette conception, la mention actuelle de la FAQ (« tes trajets et tes dépenses ne quittent jamais ton appareil ») **reste vraie**. Elle devra toutefois mentionner le service de droits avant le lancement.

## 7. Coûts estimés (offre gratuite, 🔎 quotas à revérifier)

Hypothèse : environ 6 requêtes par appareil actif et par mois (renouvellement tous les 4 à 7 jours), 2 par activation, 1 à 2 webhooks par commande Fourthwall (toutes les commandes, y compris les vêtements).

| Utilisateurs actifs avec droit | Requêtes/jour (approx.) | Écritures D1/jour (approx.) | Coût |
|---|---|---|---|
| 100 | 25 | 50 | 0 $ |
| 1 000 | 250 | 500 | 0 $ |
| 10 000 | 2 500 | 5 000 | 0 $ |
| 100 000 | 25 000 | 50 000 | 0 $, mais proche de la moitié du quota d'écritures D1 ; prévoir l'offre payante Workers (🔎 environ 5 $ US/mois) |

Courriel : 0 $, aucun envoi. Domaine : 0 $ (`*.workers.dev`). Journaux et sauvegardes D1 : inclus dans l'offre gratuite (🔎 rétentions). Sur l'offre gratuite, un dépassement provoque des erreurs, pas des frais : l'app tolère la panne jusqu'à l'expiration du jeton.

## 8. Tests réalisés (tous avec données fictives)

- `node --no-warnings --test server/test/server.test.mjs` : **25/25**
  - Couverture : signatures, commandes admissibles ou non, quantités, doublons, concurrence (webhooks ×8, activations ×20), test mode, corps invalides, mauvais courriel ou commande, fins de mois à Toronto, récupération sur changement d'appareil, plafond, codes devinés.
  - Également : expiration de 3 mois, renouvellements, jetons falsifiés ou d'une autre clé ou trop anciens, rotation, remboursement (y compris hors ordre), secours manuel, licences d'origine, Plus et Pro, invalides, terminées, panne Gumroad.
  - Enfin : plafond F2, débit, CORS, échec fermé en production, absence de fuite (secrets, courriel, commande, clé, trajets, IP), rétention, entropie des codes.
- `node --no-warnings --test tests/server-e2e.test.mjs` : **6/6** de bout en bout dans Chromium.
  - Activation par l'interface, Plus à 60 trajets, seuls `order` et `email` envoyés, code de récupération non stocké, sauvegarde sans droits.
  - Changement d'appareil sans redémarrage ; erreurs ; remboursement puis retour Gratuit avec les 20 trajets intacts ; panne tolérée.
  - Abonné historique Pro via le service ; jeton falsifié ignoré ; simulation inopérante hors localhost ; accès de lancement jamais implicite.
- `node --test tests/plans.test.mjs` : **24/24**, régression de la PR #3 et de SEC-001 (CSP inchangée, polices locales, service worker v5, hors ligne, mobile).

## 9. Mise en service : étapes exactes, **chacune sur autorisation distincte du propriétaire**

1. Lecture humaine des pages officielles marquées 🔎 (Fourthwall, Gumroad, Cloudflare).
2. Création d'un compte Cloudflare gratuit, sans carte. Puis `wrangler d1 create`, application de `schema.sql` et `wrangler secret put` pour `PEPPER`, `FW_WEBHOOK_SECRET` et `SIGNING_KEY` (générés hors dépôt et sauvegardés hors ligne).
3. Déploiement sur `*.workers.dev`, en mode production. Vérifier `/v1/health` et l'échec fermé.
4. Dans Fourthwall : créer le webhook `ORDER_PLACED` et `ORDER_UPDATED` vers le service, et envoyer **une livraison de test**. Valider les champs (`friendlyId`, `email`, `offers`, quantité, statuts), puis ajuster `REVOKE_STATUSES` et l'analyse si besoin.
5. Renseigner `ELIGIBLE_OFFER_IDS` avec l'offre bundle SharpLaughs. Ajouter au bundle un fichier d'instructions identique pour tous.
6. Dans Gumroad : créer Plus (4,99 $ CA/mois) et Pro (9,99 $ CA/mois) avec clés de licence, puis les renseigner dans `GUMROAD_PRODUCTS` (service) et `CONFIG.products` (app).
7. Dans l'app : `CONFIG.entitlements = {endpoint, keys}`, `bundle.mode = "server"`, et ajout de l'hôte dans `connect-src` de la CSP. Augmenter la version du service worker.
8. Tests Safari réels sur iPhone (section 10), puis PR vers main, puis PR vers gh-pages, comme pour SEC-001-C.
9. **Bascule coordonnée** : le même jour, liens d'achat Plus et Pro actifs dans l'app, puis retrait de l'offre d'origine des **nouvelles** ventes dans Gumroad, sans toucher aux abonnements en cours. Annonce du bundle seulement après une commande réelle de test réussie de bout en bout.

## 10. Tests Safari réels (plus tard)

Sur iPhone, après publication :

- installation de la PWA ;
- réclamation avec une commande de test ;
- affichage et copie du code de récupération ;
- mode avion pendant moins de 7 jours (droit conservé) ;
- nouvel appareil avec le code (mêmes dates) ;
- remboursement de test, puis retour Gratuit au renouvellement ;
- licence d'origine conservée ;
- vérification qu'aucune requête ne contient de trajet (inspecteur Web distant) ;
- service worker v5 actif.

## 11. Retour arrière

- **Côté app** : remettre `CONFIG.entitlements.endpoint = ""` et `bundle.mode = "off"`, via une PR de restauration publiée comme d'habitude. Le mode direct Gumroad et l'abonnement d'origine continuent de fonctionner ; les jetons stockés sont ignorés et aucune donnée locale n'est touchée.
- **Côté service** : désactiver le webhook Fourthwall, puis la route Workers. Les droits déjà émis restent valides jusqu'à l'expiration de leur jeton (7 jours). Ensuite, le secours manuel ou une prolongation décidée par le propriétaire prend le relais.
- **Base** : Time Travel D1 (🔎 rétention) ou export SQL avant chaque migration.
