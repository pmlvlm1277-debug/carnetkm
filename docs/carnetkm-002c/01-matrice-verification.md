# MISSION-CARNETKM-002-C : matrice de vérification documentaire

**Consultation** : 24 novembre 2026, en lecture seule. Pages officielles lues directement après approbation par le propriétaire d'un environnement réseau limité aux domaines de documentation (`developers.cloudflare.com`, `docs.fourthwall.com`, `help.fourthwall.com`, `gumroad.com`, `app.gumroad.com`).

**Gumroad** : la page API de Gumroad est générée en JavaScript. Sa source publique officielle, le dépôt `antiwork/gumroad` au commit `3fe4181` du 24 nov. 2026, a été lue par un clone public, sans identifiants. Ce code peut être en avance sur ce qui est déployé en production.

**Légende** :

- **C** : confirmé par la documentation officielle (date de modification indiquée quand la page la publie) ;
- **I** : confirmé par Iris dans le mandat, et recoupé ici ;
- **H** : hypothèse, ou non documenté ;
- **T** : à valider par un test futur, sur autorisation.

## Cloudflare Workers et D1

| # | Fait | Statut | Source (date de modification) |
|---|---|---|---|
| CF1 | Workers Free : 100 000 requêtes par jour, remise à zéro à minuit UTC ; au-delà, **Error 1027** | C, I | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (2026-11-19) |
| CF2 | Mode de route : *Fail open* contourne le Worker ; *Fail closed* renvoie la page 1027 (« Use this for security-critical Workers ») | C | idem |
| CF3 | CPU de 10 ms par invocation HTTP **et** par Cron sur Free. L'attente réseau ou D1 n'est pas comptée. Au-delà : Error 1102 | C, I | idem |
| CF4 | Mémoire de 128 Mo par isolat ; 50 sous-requêtes par requête sur Free, chaque requête D1 comptant comme sous-requête | C | idem ; [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) (2026-11-20) |
| CF5 | Workers Paid : minimum de 5 $ US par mois ; 10 M de requêtes incluses, puis 0,30 $ par million ; 30 M de ms CPU incluses, puis 0,02 $ par million | C, I | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (2026-11-18) |
| CF6 | « By default, users have access to the Workers Free plan. » Le passage au plan payant est une action explicite (« Upgrading to the Workers Paid plan will remove these limits »). **Aucune page ne décrit de passage automatique** | C (aucun passage automatique documenté) | Pricing ; [D1 pricing FAQ](https://developers.cloudflare.com/d1/platform/pricing/) (2026-10-30) |
| CF7 | Plafond de dépenses (*Workers spending limit*) : concerne l'usage **payant** ; la limite atteinte bloque les nouvelles invocations (Error 1103) ; « not an exact maximum bill » | C | [Spend management](https://developers.cloudflare.com/workers/platform/spend-management/) |
| CF8 | D1 Free : 5 M de lignes lues et 100 000 écrites par jour (minuit UTC) ; 5 Go au total ; 500 Mo par base ; 10 bases ; 50 requêtes par invocation | C, I | D1 pricing ; D1 limits |
| CF9 | Dépassement D1 sur Free : « you will not be able to run queries against D1 », sans facturation. Stockage plein : plus d'insertion possible | C, I | D1 pricing FAQ |
| CF10 | Un index ajoute une ligne écrite par écriture touchant la colonne indexée ; `DELETE` compte comme écriture | C | D1 pricing (définitions 2 et 6) |
| CF11 | `batch()` est une transaction SQL : si une instruction échoue, toute la séquence est annulée | C | [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) (2026-06-22) |
| CF12 | Chaque base D1 est mono-écrivain (un seul Durable Object) et traite les requêtes une à une ; au-delà de la file, erreur « overloaded » | C | D1 limits (FAQ) |
| CF13 | Time Travel : toujours actif, restauration à la minute près, **7 jours sur Free**, 30 sur Paid | C, I | [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (2026-11-20) |
| CF14 | Juridictions D1 disponibles : **`eu` et `fedramp` seulement** (pas de Canada) ; sinon un indice de localisation, sans garantie | C | [Data location](https://developers.cloudflare.com/d1/configuration/data-location/) (2026-10-02) |
| CF15 | Journaux Workers : page de tarification Workers = Free 200 000 par jour, **3 jours** ; page Observabilité unifiée = Free 0,5 Go par jour, **7 jours**, ingestion suspendue au-delà ; page Workers Logs = rétention maximale de 7 jours. **Pages officielles contradictoires** | C (contradiction) | Pricing (2026-11-18) ; [Observability pricing](https://developers.cloudflare.com/observability/pricing/) (2026-11-11) ; [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) (2026-11-18) |
| CF16 | Les journaux d'invocation contiennent requête, réponse et métadonnées ; on peut les désactiver (`invocation_logs = false`) et échantillonner (`head_sampling_rate`) | C | Workers Logs |
| CF17 | Secrets : valeurs chiffrées liées au Worker ; `.dev.vars` et `.env` ne doivent jamais être commités | C | [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) (2026-11-21) |
| CF18 | Web Crypto : ECDSA P-256 et HMAC pris en charge, `getRandomValues`, `timingSafeEqual` | C | [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) (2026-11-21) |
| CF19 | Cron Triggers exécutés en UTC ; propagation des changements jusqu'à 15 min | C | [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) (2026-11-18) |
| CF20 | `workers.dev` est « treated as a Free website… intended for personal or hobby projects that aren't business-critical » ; un domaine personnalisé est recommandé en production | C | [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) (2026-11-06) |
| CF21 | Binding Rate Limiting : **approximatif**, compté par emplacement Cloudflare, période de 10 ou 60 s ; « for a strict limit … implement a rate limiter with Durable Objects ». Disponibilité et prix sur Free non indiqués | C (approximatif) ; H (Free) | [Rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) (2026-11-12) |
| CF22 | Envoi de courriels à des **destinataires arbitraires** : Workers Paid seulement (3 000 par mois inclus, puis 0,35 $ par 1 000). Free : routage entrant illimité, envoi seulement vers des adresses vérifiées du compte | C | [Email Service](https://developers.cloudflare.com/email-service/), [pricing](https://developers.cloudflare.com/email-service/platform/pricing/) |
| CF23 | Exigence de carte de crédit pour ouvrir un compte Free | H : non documenté dans les pages lues | — |

## Fourthwall

| # | Fait | Statut | Source |
|---|---|---|---|
| FW1 | En-tête `X-Fourthwall-Hmac-SHA256` = base64(HMAC-SHA256(secret, **corps entier**)). Le secret est **propre à la boutique** (format UUID), dans *Settings > For developers*. Comparaison en temps constant dans l'exemple officiel | C | [Signature verification](https://docs.fourthwall.com/webhooks/signature-verification) ; [Aide webhooks](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/webhooks-for-memberships-and-orders) (mise à jour 2026-10-30) |
| FW2 | **Aucun horodatage signé ni protection anti-rejeu** documentés. Seuls l'`id` d'événement et la déduplication protègent contre un rejeu | C (absence) | idem |
| FW3 | Rotation du secret de webhook | H : non documentée | — |
| FW4 | Événements : `ORDER_PLACED` (« Fired when a new order is successfully placed **and paid** »), `ORDER_UPDATED` (statut, adresse de livraison ou courriel), `GIFT_PURCHASE`, et d'autres | C | [Order placed](https://docs.fourthwall.com/api-reference/order-events/order-placed) ; OpenAPI `platform.json` |
| FW5 | Enveloppe obligatoire : `id`, `webhookId`, `shopId`, `type`, `apiVersion`, `createdAt`, `testMode`, `data` | C | OpenAPI `platform.json` |
| FW6 | `ORDER_PLACED.data` = `OrderV1`. Champs requis : `id`, `friendlyId`, `email`, `status`, `offers`, `amounts`, `source`, `checkoutId`, `shopId`, `createdAt`, `updatedAt`, `message`, `emailMarketingOptIn`. Contient aussi `billing.address` et `shipping.address` (nom, adresse, téléphone) | C | OpenAPI |
| FW7 | **Quantité** : `data.offers[n].variant.quantity` (entier, requis) ; `offers[n].id` est l'UUID de l'offre | C | OpenAPI (`OfferVariantWithQuantityV1`) |
| FW8 | Statuts possibles : `CONFIRMED`, `PARTIALLY_IN_PRODUCTION`, `IN_PRODUCTION`, `PARTIALLY_SHIPPED`, `SHIPPED`, `PARTIALLY_DELIVERED`, `DELIVERED`, `CANCELLED`, `COMPLETED`. **Pas de `REFUNDED`** | C | OpenAPI |
| FW9 | « Fourthwall webhooks have **no refund, partial-refund, dispute or chargeback event**. » Une annulation complète donne `CANCELLED` et un `ORDER_UPDATED` (`update.type = STATUS`). Un remboursement sans annulation ou un litige : **aucun webhook** | C | Aide webhooks, section *Orders, refunds, chargebacks and disputes* |
| FW10 | `ORDER_UPDATED` : commande dans `data.order` (`data.id` absent) et `data.update.type` | C | Aide webhooks ; OpenAPI |
| FW11 | `source` : `GiveawayLinks`, `Order`, `SamplesOrder` ou `TwitchGiftRedemption` | C | OpenAPI |
| FW12 | Réponse 200 attendue en **moins de 2 s** ; jusqu'à **5 tentatives**, de 5 s chacune | C | [Retry policies](https://docs.fourthwall.com/webhooks/retry-policies) ; Aide webhooks |
| FW13 | Livraison **au moins une fois** (dédupliquer sur `id`) ; **ordre non garanti** ; livraison « not always guaranteed » : prévoir une réconciliation périodique | C | [Limitations](https://docs.fourthwall.com/platform/webhooks/limitations) |
| FW14 | Test sans achat : bouton *Send test notification* avec des **données d'exemple** et `testMode: true`. Sinon, un vrai événement exige une vraie commande | C | [Testing](https://docs.fourthwall.com/webhooks/testing) |
| FW15 | Open API : `GET /open-api/v1.0/order/{orderId}` et `/order/by-friendly-id/{friendlyId}` (portée `order_read`, 100 requêtes par 10 s par boutique) ; `GET /order?updatedAt[gt]=…` pour réconcilier. Authentification par Basic (utilisateur API créé par un *Super Admin*) ou OAuth avec portées | C | OpenAPI ; [Platform Open API](https://help.fourthwall.com/manage-my-shop/apps-features-and-integrations/platform-open-api) |
| FW16 | Format et entropie de `friendlyId` | H : aucun exemple dans le schéma | — |
| FW17 | Mécanisme natif de preuve de possession du courriel, ou code unique par acheteur | H : aucun trouvé (seules les cartes-cadeaux ont un code unique) | Aide produits numériques et cartes-cadeaux |
| FW18 | Statut du paiement : `ORDER_PLACED` n'est émis qu'après paiement (FW4). Il n'y a pas de champ `paymentStatus` | C | OpenAPI |

## Gumroad

| # | Fait | Statut | Source |
|---|---|---|---|
| GR1 | `POST /v2/licenses/verify` : `product_id` obligatoire (produits créés depuis le 9 janv. 2023), `license_key`, `increment_uses_count` (défaut `true` ; `false` pour revérifier). Échec : **404** | C, I | [License keys](https://gumroad.com/help/article/76-license-keys) |
| GR2 | Champs : `refunded`, `disputed`, `dispute_won`, `chargebacked` (non-abonnement seulement), `subscription_ended_at`, `subscription_cancelled_at`, `subscription_failed_at`, `recurrence`, `variants`, `is_gift_receiver_purchase`, `uses`. **Les horodatages de fin correspondent à la date de fin effective, pas à la demande d'annulation** | C, I | idem |
| GR3 | « Gumroad performs no additional license key verification » : le plafond d'utilisations relève du créateur ; on peut activer ou désactiver une clé et décrémenter `uses` (avec jeton d'accès) | C | idem ; source `Licenses.tsx` |
| GR4 | Bundle : chaque produit admissible du bundle reçoit **sa propre clé** | C | [Bundles](https://gumroad.com/help/article/339-product-bundles) |
| GR5 | Abonnements aux ressources : `sale`, `refund`, `dispute`, `dispute_won`, `cancellation`, `subscription_updated`, `subscription_ended` (avec `ended_reason`), `subscription_restarted`. **Non signés**. Un événement de test existe | C | Source `ResourceSubscriptions.tsx` (`3fe4181`) |
| GR6 | Ping : **signature facultative** `X-Gumroad-Signature: t=…,v1=hex(HMAC-SHA256(secret, t + "." + corps brut))`, avec un écart de 5 min recommandé. Livraison au moins une fois, sans ordre ; nouvelles tentatives à 1, 3, 10 et 60 min seulement sur 499 ou 5xx ; 5 s pour répondre ; « treat a ping as a trigger rather than as data » | C dans la source ; T (activation et date de mise en production) | Source `Ping.tsx` (`3fe4181`) |
| GR7 | Frais : **10 % + 0,50 $** par vente directe, plus le traitement de carte (2,9 % + 0,30 $) ; 30 % via Discover ; 5 % + 0,50 $ au-delà de 20 000 $ de ventes dans le mois ; Gumroad est *merchant of record* (taxes) ; sur un remboursement, Gumroad rend sa part de frais mais pas le traitement | C | [Pricing](https://gumroad.com/pricing) ; [Fees](https://gumroad.com/help/article/66-gumroads-fees) |
| GR8 | Changement de prix d'un abonnement : s'applique aux membres existants **seulement** si l'option *Apply price changes to existing customers* est activée (préavis de 7 jours). Réassigner un niveau ne change pas le prix payé | C | [Memberships](https://gumroad.com/help/article/82-membership-products) |
| GR9 | Effet de la **dépublication** de l'offre d'origine sur les abonnements actifs (renouvellements, accès, clés) | H : page non lue (redirection) | — |
| GR10 | Devise des frais fixes (0,50 $ et 0,30 $ : USD ?) et conversion pour un prix en CAD | H | — |
| GR11 | Changement de niveau (Plus vers Pro) dans un même abonnement : clé conservée ou non ; `product_id` et `variants` renvoyés | H / T | — |

## Coûts unitaires Gumroad (calcul indicatif, GR7, en supposant les frais fixes dans la devise de vente)

| Prix | Gumroad 10 % + 0,50 | Carte 2,9 % + 0,30 | Net créateur | Part nette |
|---|---|---|---|---|
| 4,99 $ CA (Plus et offre d'origine) | 1,00 | 0,44 | **≈ 3,55** | ≈ 71 % |
| 9,99 $ CA (Pro) | 1,50 | 0,59 | **≈ 7,90** | ≈ 79 % |
