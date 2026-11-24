# Rapport MISSION-CARNETKM-002-C pour Iris / SL Command (validation)

**Date** : 24 novembre 2026.
**Agent** : Claude Code.
**Branche documentaire** : `claude/carnetkm-002c-docs`, dérivée de la PR #4 (`21606b0`).
**Coût** : **0 CAD**. Aucun compte créé, aucune dépense, aucune fusion, aucun déploiement, aucune modification de service externe, aucun secret réel, aucun achat test, aucun appel à une API de paiement. Les PR #3 et #4 restent en brouillon et le code applicatif n'a pas été modifié.

## Accès à la documentation

- Les domaines de documentation étaient bloqués (échec DNS). Le propriétaire a approuvé l'environnement personnel « SL Command – CarnetKM », limité en lecture à `developers.cloudflare.com`, `docs.fourthwall.com`, `help.fourthwall.com`, `gumroad.com` et `app.gumroad.com`. Les pages officielles ont ensuite été lues directement ; les dates de modification sont indiquées dans la matrice.
- La page API de Gumroad est générée en JavaScript. Sa source officielle publique (`antiwork/gumroad`, commit `3fe4181`) a été lue par un clone anonyme en lecture seule.
- Le connecteur Fourthwall n'est toujours pas authentifié dans la session. Ce n'est pas bloquant : la documentation publique suffit.

## Confirmé (détail : `01-matrice-verification.md`)

- **Vérifications d'Iris recoupées** : Workers Free 100 000 requêtes par jour et 10 ms de CPU ; Paid à 5 $ US minimum ; D1 à 5 M de lignes lues et 100 000 écrites par jour, 5 Go, 500 Mo par base, Time Travel de 7 jours ; dépassement sur Free = blocage sans facturation.
- **Workers** :
  - Au dépassement : **Error 1027**, avec un mode de route Fail open ou Fail closed. Fail closed est recommandé pour un Worker critique.
  - Aucune page ne décrit de passage automatique au plan payant.
  - Le plafond de dépenses ne concerne que l'usage payant et n'est pas un maximum exact.
- **Journaux** : deux pages officielles se contredisent sur la rétention Free (3 jours contre 7 jours). Les journaux d'invocation contiennent la requête et ses métadonnées, et peuvent être désactivés.
- **Localisation** : D1 n'offre aucune juridiction canadienne (seulement `eu` et `fedramp`).
- **Courriel** : l'envoi vers des destinataires arbitraires exige Workers Paid.
- **Fourthwall** :
  - Signature : HMAC-SHA256 du corps brut, en base64, dans `X-Fourthwall-Hmac-SHA256`, avec un secret propre à la boutique. Aucun horodatage anti-rejeu.
  - `ORDER_PLACED` n'est émis qu'une fois la commande **payée**. La quantité est dans `offers[n].variant.quantity`.
  - Identifiants : `id` (UUID) et `friendlyId` (numéro public) sont distincts.
  - Statuts possibles, **sans `REFUNDED`**. Il n'existe **aucun événement de remboursement, de remboursement partiel ou de litige** : seule l'annulation complète donne `CANCELLED`.
  - Délivrance : réponse attendue en moins de 2 s ; 5 tentatives ; au moins une fois ; ordre non garanti ; livraison non garantie, d'où la nécessité de réconcilier.
  - Tests : *Send test notification* envoie des données d'exemple avec `testMode`.
  - Open API : lecture d'une commande par `friendlyId`, avec la portée `order_read`.
- **Gumroad** :
  - Licences : `product_id` obligatoire, `increment_uses_count=false`, échec en 404. Les horodatages de fin sont des dates de fin effectives.
  - Bundle : une clé par produit.
  - Notifications : les abonnements aux ressources (8 types) ne sont pas signés ; le Ping a une signature facultative avec horodatage.
  - Frais : 10 % + 0,50 $, plus 2,9 % + 0,30 $ de traitement. Net estimé : environ 3,55 $ sur 4,99 $, environ 7,90 $ sur 9,99 $.
  - Prix des membres existants : inchangé sauf option explicite.

## Conformité de l'architecture (`02-conformite-et-corrections.md`)

- **Conformes** : Workers + D1 ; signature et idempotence des webhooks ; activation unique ; données locales protégées ; coût de 0 $.
- **À corriger (C1 à C15)**, dans une mission de développement autorisée :
  - Décisions approuvées non encore appliquées : jeton de **14 jours**, avec fin d'essai exacte hors ligne ; **retrait d'un ancien appareil** avec plafond de 3 ; licences d'origine **sans plafond**.
  - **Révocation** : `CANCELLED` seulement, plus un script manuel pour les remboursements et litiges sans annulation.
  - **Filtrage des webhooks** par `shopId` et par `source`.
  - **Réconciliation** des webhooks perdus.
  - **Budget d'écritures D1**, exposé à une attaque par épuisement des quotas.
  - **Journaux d'invocation** à désactiver.
  - Préproduction distincte pour les événements de test.
- **Distinction CORS et authentification** documentée. L'authentification réelle repose sur la signature HMAC, la connaissance du couple commande et courriel, le code de 130 bits, le jeton ES256 et la clé Gumroad revérifiée.

## Hypothèses et tests futurs

- Format et entropie de `friendlyId` ; rotation du secret Fourthwall ; carte exigée ou non à l'ouverture d'un compte Cloudflare Free ; limitation de débit Cloudflare gratuite.
- Effet de la dépublication de l'offre Gumroad d'origine sur les abonnés actifs.
- Devise des frais fixes Gumroad ; clé conservée ou non lors d'un changement de niveau.
- Comportement SPF et DKIM du routage de courriel entrant.
- CPU réel par route ; Safari réel.

## Livrables

1. `01-matrice-verification.md` : faits confirmés, hypothèses et tests futurs, sources datées.
2. `02-conformite-et-corrections.md` : conformité, corrections C1 à C15, scénarios de charge (requêtes ≠ utilisateurs), options de preuve de possession du courriel, risques (réclamation par un tiers, récupération et retrait d'appareils, révocation hors ligne, F1 et F2), Loi 25 et EFVP, minimisation et rétention.
3. `wrangler.production.example.toml` : configuration future sans secret ni identifiant réel, avec préproduction distincte.
4. `03-procedures-tests-rollback.md` : procédures manuelles pas à pas (Cloudflare, Fourthwall, Gumroad, app, bascule coordonnée), plan de tests, retour arrière, budgets et seuils.

## Risques principaux

- Remboursements Fourthwall sans annulation, et litiges, non détectables automatiquement.
- Réclamation par un tiers qui connaît la commande et le courriel.
- Révocation retardée jusqu'à 14 jours hors ligne.
- Épuisement des quotas gratuits par une attaque : panne temporaire, sans frais.
- Hébergement hors Québec (EFVP requise).
- F1 et F2 résiduels.

## Prochaine action proposée (soumise à autorisation)

Autoriser une mission de **développement** (sans compte ni déploiement) pour appliquer les corrections C1 à C6, C9 et C10 au prototype de la PR #4, avec tests. En parallèle, le propriétaire obtient la validation juridique de l'EFVP et répond aux décisions ouvertes : sources offertes, option de réconciliation C7, option A+.
