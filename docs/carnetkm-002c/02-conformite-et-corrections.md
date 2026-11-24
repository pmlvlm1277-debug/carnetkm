# MISSION-CARNETKM-002-C : conformité de l'architecture et corrections à prévoir

Examen **en lecture seule** du prototype de la PR #4 (commit `21606b0`). Aucun code applicatif ni serveur n'est modifié dans cette mission. Les références (CF…, FW…, GR…) renvoient à `01-matrice-verification.md`.

## 1. Verdict global

| Élément | Verdict |
|---|---|
| Workers + D1 sur l'offre gratuite | **Conforme**, sous réserve de la correction C9 : budget d'écritures D1 et attaque par épuisement des quotas |
| Signature des webhooks Fourthwall | **Conforme** à FW1 : HMAC-SHA256 du corps brut, en base64, comparaison en temps constant |
| Idempotence et désordre des webhooks | **Conforme** à FW13 et CF11 : déduplication sur `id`, contrainte UNIQUE, `batch()` transactionnel, marqueurs `order_flags` |
| Activation unique | **Conforme** à CF12 : un seul écrivain et un `UPDATE … WHERE status='eligible'` conditionnel |
| Révocation sur remboursement | **Non conforme aux faits** : `REFUNDED` n'existe pas (FW8) et Fourthwall n'émet aucun événement de remboursement (FW9). Voir C5 |
| 14 jours hors ligne (décision approuvée) | **À corriger** : le prototype utilise 7 jours. Voir C1 |
| 3 appareils avec retrait d'un ancien appareil (décision approuvée) | **À corriger** : un simple compteur, sans retrait possible. Voir C3 |
| Aucune restriction rétroactive des abonnés historiques | **À corriger** : le plafond de 3 appareils s'applique aussi au produit d'origine. Voir C4 |
| Données locales (trajets, dépenses, fiscalité) | **Conforme** : rien n'est envoyé ni stocké (testé) |
| Journaux minimaux | **Partiel** : nos journaux applicatifs sont minimaux, mais les journaux d'invocation Cloudflare enregistrent la requête et ses métadonnées (CF16). Voir C10 |
| Coût de 0 $ | **Conforme** sans courriel sortant (CF22) et sans domaine payant. Voir la section 4 |

## 2. Mécanismes de sécurité : authentification et CORS

- **CORS n'est pas de l'authentification.** L'en-tête `Origin` et la réponse CORS ne bloquent que les navigateurs. N'importe quel script peut appeler l'API directement. Le contrôle d'origine du prototype réduit les abus depuis un autre site, rien de plus.
- **Authentification réelle**, par route :
  - webhooks : HMAC du secret de boutique (FW1) ;
  - réclamation : connaissance du couple numéro de commande et courriel ;
  - récupération : code de 130 bits ;
  - renouvellement : jeton signé ES256 ;
  - licences : clé Gumroad revérifiée côté serveur (GR1).
- **Anti-rejeu des webhooks Fourthwall** : aucun horodatage signé (FW2). Un webhook capturé peut être rejoué, mais l'idempotence (`id` et UNIQUE) le neutralise. Recommandation : vérifier en plus `shopId` et `webhookId` attendus (C6).
- **Preuve de possession du courriel** : le couple commande et courriel prouve une **connaissance**, pas une possession. Options gratuites et payantes en section 5.

## 3. Corrections proposées pour la PR #4 (à faire dans une mission de développement autorisée)

| # | Correction | Motif |
|---|---|---|
| **C1** | Jeton valide **14 jours**, renouvelé dès qu'il lui reste moins de 7 jours. Pour l'offre bundle : `exp` = min(iat + 14 j, fin d'essai à 00 h 00 heure de Toronto, convertie en UTC), de sorte que l'essai expire exactement même hors ligne. Le client garde sa vérification `ent_end` | Décision approuvée (14 jours) ; expiration exacte de l'essai |
| **C2** | Documenter et afficher que **la révocation peut prendre jusqu'à 14 jours** hors ligne : le jeton reste valide jusqu'à son `exp` | Limite intrinsèque du hors-ligne |
| **C3** | Table `grant_devices(grant_id, device_h, first_seen, last_seen, removed_at)` et `device` obligatoire sur claim, recover et refresh. **3 appareils actifs au maximum**. Nouvelle route `POST /v1/devices/remove`, authentifiée par le code de récupération, ou par la clé de licence et l'identifiant de l'appareil à retirer. Retraits limités (par exemple 3 par 30 jours) contre le partage par rotation. Un appareil retiré n'est plus renouvelé, mais garde son jeton jusqu'à `exp` | Décision approuvée : 3 appareils avec retrait d'un ancien appareil |
| **C4** | Licences d'origine (`slot: legacy`) : **aucun plafond d'appareils**. Les appareils sont enregistrés pour information seulement, et aucune limite n'est appliquée sans nouvelle décision | « Sans restriction rétroactive des droits historiques » |
| **C5** | `REVOKE_STATUSES = "CANCELLED"` seulement (`REFUNDED` n'existe pas, FW8). Ajout d'un script `scripts/revoke-order.mjs` (empreinte du `friendlyId`, puis SQL de révocation) pour les remboursements complets **sans annulation** et pour les litiges, qui n'émettent aucun webhook (FW9). Procédure : lors d'un remboursement complet du bundle dans Fourthwall, **annuler la commande** quand c'est possible, sinon lancer le script. Remboursement partiel : examen manuel, sans action automatique (décision approuvée) | FW8, FW9 |
| **C6** | Filtrer les webhooks : `shopId` = `FW_SHOP_ID` configuré ; `type` connu ; `source.type`, avec exclusion de `SamplesOrder`. Décision à prendre pour `GiveawayLinks` et `TwitchGiftRedemption` (commandes offertes) ; ignorer une commande déjà `CANCELLED` à la réception | FW5, FW11 |
| **C7** | **Réconciliation** pour une commande dont le webhook n'est jamais arrivé (FW13). Option A (0 $, recommandée au départ) : secours manuel existant. Option B : à la réclamation, si aucun droit n'existe, lecture `GET /order/by-friendly-id/{friendlyId}` (FW15) via un jeton **OAuth limité à `order_read`** (préférable à l'utilisateur API en Basic, plus large), contrôle du courriel, des offres et du statut, puis création du droit. Le jeton OAuth est alors un secret Workers supplémentaire | FW13, FW15 |
| **C8** | Mesurer le CPU réel (10 ms sur Free, CF3) en préproduction : HMAC multiples et signature ECDSA. Mettre en cache la clé importée (`importKey`) au niveau de l'isolat | CF3 |
| **C9** | **Budget d'écritures D1** : chaque requête écrit au moins une ligne de limitation de débit, et la purge `DELETE` compte aussi comme écriture (CF10). Ajouter un filtre bon marché avant D1 : rejet immédiat des corps invalides, puis binding Rate Limiting par IP (approximatif, CF21, disponibilité sur Free à vérifier) ; garder le compteur D1 strict seulement pour les **essais de réclamation par commande** | CF8, CF10, attaque par épuisement |
| **C10** | `observability.logs.invocation_logs = false` pour ne pas conserver les métadonnées de requête (IP, en-têtes) ; journaux applicatifs `{evt, outcome}` seulement ; ingestion gratuite plafonnée (CF15) | CF16, Loi 25 |
| **C11** | `workers.dev` au départ (sans route, le dépassement donne Error 1027, ce qui revient à un échec fermé). En cas de domaine personnalisé plus tard : route en **Fail closed** (CF2) | CF2, CF20 |
| **C12** | Événements de test (`testMode: true`, données d'exemple, FW14) : acceptés seulement par un Worker de **préproduction** distinct, avec sa propre base. Toujours refusés en production (déjà le cas) | FW14 |
| **C13** | Gumroad : aucune confiance dans les notifications. Le prototype revérifie déjà par `licenses/verify`, ce qui est **conforme à GR5 et GR6**. Le Ping signé est facultatif, pour une révocation plus rapide (en vérifiant `t` à ±5 min) | GR5, GR6 |
| **C14** | Activation côté app : `connect-src` de la CSP limité à l'hôte du service, service worker augmenté d'une version, `CONFIG.entitlements` avec les clés publiques de production | — |
| **C15** | `GIFT_PURCHASE` (bundle offert) : non pris en charge au lancement ; secours manuel | FW4 |

## 4. Budgets, quotas et scénarios de charge (requêtes ≠ utilisateurs)

**Hypothèses par appareil actif** : jeton de 14 jours renouvelé quand il reste moins de 7 jours, soit environ **4,3 requêtes par mois**. Une activation coûte 1 à 2 requêtes. Une ouverture de l'app ne déclenche **aucun** appel tant que le jeton est valide (comportement du prototype). Chaque commande Fourthwall déclenche au moins un webhook, **y compris les vêtements** (FW : pas de filtrage côté Fourthwall).

**Lignes écrites estimées** :

| Opération | Lignes écrites |
|---|---|
| Renouvellement | ≈ 2 (limitation de débit + appareil), plus ≈ 1 à la purge |
| Réclamation | ≈ 7 (limitation de débit ×2, mise à jour du droit et de ses index) |
| Webhook non admissible | ≈ 1 (événement), plus 1 à la purge |
| Webhook admissible | ≈ 1, plus 4 par unité |

| Scénario (appareils actifs, commandes par jour) | Requêtes Workers/jour | Lignes D1 écrites/jour | Marge Free (100 000 / 100 000) |
|---|---|---|---|
| 1 000 appareils, 20 commandes | ≈ 165 | ≈ 500 | > 99 % |
| 10 000 appareils, 100 commandes | ≈ 1 550 | ≈ 4 600 | ≈ 95 % |
| 100 000 appareils, 500 commandes | ≈ 15 000 | ≈ 44 000 | ≈ 56 % en écritures (**limite principale**) |
| Attaque : 100 000 requêtes de robots | 100 000 | ≥ 100 000 | **Épuisé** : service indisponible jusqu'à minuit UTC, **0 $** |

**Conséquences financières (CF6, CF7, CF9)** :

- Sur Free, un dépassement **n'entraîne aucune facture** : il provoque des erreurs (1027 pour Workers, refus de D1). Aucune page lue ne décrit de passage automatique au plan payant.
- L'app reste utilisable : le jeton est valable jusqu'à 14 jours hors ligne, les données sont locales.
- Si le propriétaire choisit un jour Workers Paid (5 $ US par mois minimum), configurer **avant** un plafond de dépenses et une alerte par courriel (CF7). Ce plafond n'est pas un maximum exact.

**Autres limites applicables** : 50 sous-requêtes par requête (CF4 ; une revérification Gumroad en utilise au plus 3, plus D1) ; 500 Mo par base (le stockage estimé reste de quelques Mo à 100 000 droits) ; Time Travel de 7 jours (CF13), d'où un export SQL hebdomadaire manuel recommandé.

## 5. Preuve de possession du courriel : options

| Option | Robustesse | Coût | Verdict |
|---|---|---|---|
| A. Commande et courriel, avec limitation de débit (actuel) | Connaissance seulement : un proche, ou une personne ayant vu le reçu, peut réclamer avant l'acheteur | 0 $ | **Retenue au lancement**, avec C6, C9 et le secours manuel (réattribution par le propriétaire) |
| A+. Ajouter un troisième élément du reçu, comme le total payé (`amounts.total`, FW6) | Légère hausse d'entropie ; plus de friction | 0 $ | Facultatif ; à tester sur l'ergonomie |
| B. Code à usage unique envoyé par courriel depuis le Worker | Vraie preuve de possession | **Workers Paid requis** (CF22) : au moins 5 $ US par mois | Écartée tant que le budget est de 0 $ |
| C. Courriel **entrant** : l'utilisateur envoie un code affiché par l'app, depuis son adresse d'achat, vers une adresse du domaine routée vers un Worker (routage gratuit, CF22) | Bonne, si SPF, DKIM et DMARC sont vérifiés (comportement **H** à confirmer) | 0 $ **si un domaine existe déjà sur Cloudflare** | Option future à étudier |
| D. Service de courriel tiers gratuit | Bonne | Compte tiers, nouveau sous-traitant (Loi 25) | Hors mandat (pas de création de compte) |

## 6. Risques résiduels

- **Réclamation par un tiers** (option A) : atténuée par la limitation à 8 essais par heure et par commande, par la même réponse 404 dans tous les cas d'échec et par le secours manuel. Le propriétaire peut révoquer, puis réémettre un code `CKM-` au véritable acheteur.
- **Récupération et retrait d'appareils** : un code de récupération divulgué donne jusqu'à 3 appareils. Le retrait d'appareils (C3) permet à l'acheteur de reprendre la main. Recommandation : afficher dans l'app la liste des appareils, sans identifiant réel.
- **Révocation hors ligne** : jusqu'à 14 jours de délai (C2). Les remboursements sans annulation et les litiges ne sont pas détectés automatiquement (FW9), d'où une procédure manuelle.
- **F1** (contrôle côté client) : reste ouvert. La signature empêche de fabriquer des droits, pas de modifier le code de l'app ou l'horloge locale.
- **F2** (partage de clés) : réduit à 3 appareils pour les nouvelles licences. Les licences d'origine restent sans plafond (C4, par décision).
- **Disponibilité** : `workers.dev` n'est pas destiné à un usage critique (CF20) ; les quotas Free peuvent être épuisés par une attaque. L'impact reste borné par le hors-ligne de 14 jours.
- **Webhooks perdus** (FW13) : un acheteur ne trouve pas sa commande ; secours manuel ou C7-B.

## 7. Loi 25 (Québec) : à faire valider par un conseiller

> Analyse de travail, **pas un avis juridique**.

- **Renseignements traités** : empreintes HMAC du courriel, du numéro de commande, de la clé de licence et de l'identifiant d'appareil ; IP hachée pendant 48 h au plus dans les compteurs. Ces empreintes restent des **renseignements personnels** : elles sont réidentifiables par qui détient le PEPPER, ou en recalculant l'empreinte d'un courriel connu.
- **Le webhook transporte plus que nécessaire** (nom, adresses, téléphone, FW6). Le service ne les lit ni ne les stocke, mais ils transitent par Cloudflare. Désactiver les journaux d'invocation (C10) évite toute conservation par la plateforme.
- **Communication hors Québec** : D1 n'offre pas de juridiction canadienne (CF14), et les données seront probablement aux États-Unis. Avant toute communication de renseignements personnels hors Québec, une **évaluation des facteurs relatifs à la vie privée (EFVP)** est requise : sensibilité, finalité, protection contractuelle, régime juridique de l'État. Il faut aussi une entente écrite (conditions Cloudflare et DPA) tenant compte des résultats de l'EFVP.
- **Autres obligations** :
  - désigner le responsable de la protection des renseignements personnels (par défaut, la personne ayant la plus haute autorité) et publier ses coordonnées ;
  - mettre à jour la politique de confidentialité : finalité (vérifier l'achat et gérer les droits), données, durées, sous-traitants (Cloudflare, Gumroad, Fourthwall), droits d'accès et de rectification ;
  - tenir un registre des incidents de confidentialité.
- **Minimisation et rétention** (déjà dans le prototype, à confirmer) : événements 30 jours ; compteurs 48 h ; droits 12 mois après la fin, 24 mois s'ils ne sont jamais activés ; appareils inactifs 12 mois ; marqueurs de commande 24 mois.
- **Consentement et transparence** : texte affiché avant la réclamation. Il existe déjà (« Seuls ces deux renseignements sont envoyés… ») et doit être complété par le lien vers la politique et la mention de l'hébergement hors Québec.
