# MISSION-CARNETKM-002-C : procédures de mise en service, plan de tests et retour arrière

**Chaque étape exige une autorisation distincte du propriétaire.** Aucune n'a été exécutée. Le budget visé est de 0 $ : aucune étape ne nécessite de paiement tant que la décision « Workers Free » est maintenue.

## 0. Préalables (sans compte ni dépense)

1. Développement autorisé des corrections C1 à C15 (`02-conformite-et-corrections.md`) sur une branche dédiée, avec tests à jour (au moins les 55 existants, plus ceux des sections 2 et 3).
2. Validation juridique : EFVP pour l'hébergement hors Québec, politique de confidentialité, désignation du responsable (section 7 du document 02).
3. Décisions restantes : sources `GiveawayLinks` et `TwitchGiftRedemption` ; option de réconciliation C7 (A manuelle, ou B OAuth `order_read`) ; option A+ (total payé).

## 1. Cloudflare (étapes manuelles, propriétaire)

1. **Compte** : créer un compte Cloudflare **Free**. Ne pas souscrire Workers Paid. Noter si une carte est demandée (CF23 non documenté) et refuser tout essai payant.
2. **Outil local** : `npx wrangler login` sur le poste du propriétaire, jamais dans un dépôt.
3. **Bases** : `wrangler d1 create carnetkm-entitlements` et `wrangler d1 create carnetkm-entitlements-staging`. Reporter les `database_id` dans `wrangler.toml`, copié de `wrangler.production.example.toml`, sans le commiter s'il contient des valeurs propres au compte.
4. **Schéma** : `wrangler d1 execute <base> --remote --file server/schema.sql`, pour la préproduction puis pour la production.
5. **Secrets**, générés hors ligne et sauvegardés dans un gestionnaire de mots de passe :
   - `PEPPER` : `openssl rand -base64 48`. **Ne jamais le changer** une fois en service, sinon les empreintes existantes deviennent invalides.
   - `SIGNING_KEY` : JWK ECDSA P-256 privée. La clé publique va dans `PUBLIC_KEYS` et dans `CONFIG.entitlements.keys` de l'app.
   - `FW_WEBHOOK_SECRET` : copié de Fourthwall (étape 2.2).
   - `wrangler secret put <NOM>` pour chaque environnement.
6. **Déploiement de la préproduction** : `wrangler deploy --env staging`. Vérifier `GET /v1/health` (réponse 200), puis l'échec fermé : retirer temporairement un secret doit donner 503.
7. **Observabilité** : vérifier dans le tableau de bord que les journaux d'invocation sont désactivés (C10). Configurer une alerte d'usage si le plan gratuit le permet (H).

## 2. Fourthwall (étapes manuelles, propriétaire)

1. **Repérer l'UUID de l'offre bundle** (URL d'édition du produit, FW) et le `shopId` (`sh_…`). Les reporter dans `ELIGIBLE_OFFER_IDS` et `FW_SHOP_ID`.
2. **Webhook de préproduction** : *Settings > For developers > Webhooks > Create webhook*. URL : `https://carnetkm-entitlements-staging.<sous-domaine>.workers.dev/v1/webhooks/fourthwall`. Événements : `ORDER_PLACED` et `ORDER_UPDATED`. Copier le secret de boutique.
3. **Send test notification** (FW14) pour chaque événement. Vérifier : signature acceptée, `testMode: true` traité en préproduction, format réel de `data` (FW6 à FW10). Les données d'exemple n'ont pas l'offre bundle : aucun droit n'est créé, ce qui est attendu.
4. **Commande réelle de test**, seulement sur autorisation explicite : un achat réel du bundle, puis son annulation complète. Elle est nécessaire pour valider de bout en bout : droit créé, réclamation, statut `CANCELLED`, révocation. Coût à confirmer avec le propriétaire ; peut être remboursé.
5. **Production** : créer un second webhook vers le Worker de production, le jour de l'ouverture seulement.

## 3. Gumroad (étapes manuelles, propriétaire)

1. Créer deux produits abonnement, **Plus** (4,99 $ CA par mois) et **Pro** (9,99 $ CA par mois), avec le bloc *License key*. Noter leurs `product_id` (GR1).
2. **Ne jamais activer** *Apply price changes to existing customers* sur l'offre d'origine (GR8).
3. Avant la bascule, vérifier auprès de Gumroad, par l'aide ou le support, l'effet de la **dépublication** de l'offre d'origine sur les abonnements actifs (GR9). Ne retirer l'offre des nouvelles ventes qu'une fois la réponse obtenue.
4. Facultatif : activer la **signature du Ping** (GR6) si une notification plus rapide des remboursements est souhaitée.

## 4. Application (développement et publication autorisés)

1. `CONFIG.entitlements = {endpoint: "https://carnetkm-entitlements.<…>.workers.dev", keys: {k2027a: <JWK publique>}}`, `bundle.mode = "server"`, `products` Plus et Pro avec leurs identifiants et URL.
2. CSP : ajouter l'hôte exact du service dans `connect-src` ; augmenter la version du service worker.
3. PR vers main, puis PR vers gh-pages (procédure SEC-001-C), avec les tests Safari réels de la section 6.
4. **Bascule coordonnée**, le même jour : publication de l'app avec Plus et Pro ; création du webhook de production Fourthwall ; retrait de l'offre d'origine des **nouvelles** ventes (après GR9) ; annonce du bundle seulement après la commande de test réussie.

## 5. Plan de tests (préproduction, données fictives sauf mention)

| Domaine | Tests |
|---|---|
| Webhooks | Signature valide, invalide, absente ; `shopId` étranger refusé (C6) ; doublon d'`id` ; `ORDER_UPDATED` avant `ORDER_PLACED` ; `variant.quantity = 2` ; `SamplesOrder` exclu ; `testMode` refusé en production ; réponse en moins de 2 s (FW12) |
| Réclamation | Bon couple ; mauvais courriel et commande inconnue (même 404) ; limitation par commande ; 20 requêtes concurrentes (une seule activation) |
| Appareils (C3, C4) | Trois appareils acceptés, le quatrième refusé ; retrait d'un ancien appareil, puis nouvel appareil accepté ; retraits limités ; licence d'origine sans plafond |
| Hors ligne (C1, C2) | Jeton de 14 jours accepté hors ligne ; renouvellement à moins de 7 jours ; fin d'essai exacte hors ligne (00 h 00, heure de Toronto) ; révocation effective au renouvellement suivant |
| Remboursements (C5) | `CANCELLED` entraîne la révocation ; remboursement sans annulation révoqué par le script manuel ; remboursement partiel sans action |
| Gumroad | Licence d'origine, Plus et Pro ; abonnement terminé (horodatage futur = encore actif, GR2) ; 404 = clé invalide ; panne entraînant la conservation du jeton |
| Charge et coûts | Mesure CPU par route (< 10 ms, CF3) ; lignes écrites par opération (`meta.rows_written`) comparées aux estimations du document 02, section 4 ; simulation d'épuisement du quota en préproduction, avec un comportement d'app attendu sans perte de données |
| Confidentialité | Aucune donnée de trajet envoyée ; journaux sans IP ni courriel ; base sans valeur en clair |
| Safari iPhone réel | PWA, réclamation, code de récupération, mode avion pendant plus de 7 jours et moins de 14, nouvel appareil, retrait d'appareil, révocation, abonné d'origine |

## 6. Retour arrière

1. **App** : `CONFIG.entitlements.endpoint = ""`, `bundle.mode = "off"`, via une PR de restauration publiée normalement. Le mode Gumroad direct et l'abonnement d'origine continuent de fonctionner ; les données locales sont intactes.
2. **Fourthwall** : désactiver ou supprimer le webhook de production.
3. **Worker** : désactiver la route `workers.dev`, qui renvoie alors Error 1042, ou redéployer la version précédente (`wrangler rollback`).
4. **Base** : Time Travel (7 jours sur Free, CF13), avec un export SQL avant chaque migration.
5. **Droits déjà émis** : valables jusqu'à l'expiration de leur jeton (14 jours au plus). Prolongation ou réémission manuelle (code `CKM-`) sur décision du propriétaire.

## 7. Budget et limites

- **Budget visé** : 0 $. Workers Free et D1 Free ; aucun courriel sortant ; `workers.dev` ; sauvegardes par Time Travel et exports manuels.
- **Seuils de surveillance** : 50 % des 100 000 écritures D1 par jour, ou 50 % des 100 000 requêtes Workers par jour, déclenchent une revue (limitation de débit avant D1, C9).
- **Ce qui ferait passer au payant** (décision distincte) : courriel sortant (CF22), quotas durablement dépassés, rétention de journaux plus longue. Dans ce cas, plafond de dépenses et alerte configurés **avant** la souscription (CF7).
