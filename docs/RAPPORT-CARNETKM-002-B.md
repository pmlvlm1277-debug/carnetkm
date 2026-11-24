# Rapport MISSION-CARNETKM-002-B pour Iris / SL Command (validation)

**Date** : 24 novembre 2026.
**Agent** : Claude Code.
**Branche** : `claude/carnetkm-entitlements-server`, dérivée de la PR #3 (`ee6c470`, toujours en brouillon et non fusionnée).
**Coût** : **0 CAD**. Aucun compte créé, aucun déploiement, aucune fusion, aucun appel à une API de paiement réelle, aucun courriel envoyé, aucune modification de Fourthwall ou de Gumroad.

## Confirmé

**État de départ vérifié** :

- PR #3 ouverte en brouillon, tête `ee6c470` ; main à `d2bc1d0` ; gh-pages à `adbc9fd`.
- Ruleset actif.
- Seul workflow : `pages-build-deployment`, lié à gh-pages (dernière exécution le 24 nov. à 14 h 10). Pousser une branche dédiée ne déploie donc rien.

**Prototype du service de droits** (`server/`, compatible Cloudflare Workers + D1, testé avec SQLite local) :

- Webhooks Fourthwall signés (HMAC-SHA256), idempotents et tolérant le désordre.
- Activation unique et atomique, avec code de récupération de 130 bits stocké haché.
- Changement d'appareil sans redémarrage de l'essai, plafonné à 3 appareils.
- Révocation sur remboursement ou annulation.
- Revérification des licences Gumroad : Plus, Pro, et abonnement d'origine maintenu en Pro.
- Jetons ES256 de 7 jours, avec rotation des clés.
- Limitation de débit, CORS restreint, échec fermé en production.
- Journaux et stockage minimaux, purge selon la rétention.
- Secours manuel par code `CKM-` à usage unique.

**Intégration dans l'app** :

- Mode serveur inactif par défaut : il faut une adresse **et** une clé publique.
- Envoi limité à commande et courriel, code, jeton, ou clé de licence avec identifiant d'appareil.
- Jetons vérifiés par WebCrypto ; un jeton falsifié est ignoré.

**Garde-fous de production** :

- Le mode simulation est inopérant hors localhost.
- L'accès « tout ouvert » sans configuration n'est plus implicite : il faut `launchAccess: true`.

**Tests**, tous avec données fictives : service **25/25**, de bout en bout dans le navigateur **6/6**, régression PR #3 et SEC-001 **24/24**.

**Données locales** :

- Les trajets, dépenses et renseignements fiscaux ne quittent jamais l'appareil (vérifié par interception des requêtes).
- Le format de sauvegarde v1 est inchangé ; il n'exporte ni jeton ni identifiant d'appareil.
- CSP inchangée ; service worker passé en v5.

## À vérifier

- **Documentation officielle** : Fourthwall, Gumroad et Cloudflare sont inaccessibles depuis la session (DNS bloqué, et connecteur Fourthwall non authentifié malgré l'autorisation annoncée). Les faits proviennent des résumés de recherche de leurs pages officielles, cités dans `docs/CARNETKM-002-B-service-droits.md`.
- **Format réel des webhooks Fourthwall** : statuts de remboursement ou d'annulation, emplacement de la quantité, ligne de bundle. Une livraison de test est requise.
- **Quotas et rétentions Cloudflare** : rétention des journaux et de Time Travel, prix de l'offre payante.
- **Tests manuels** : Safari réel non testé ; avis Loi 25 à obtenir (EFVP pour l'hébergement hors Québec, politique de confidentialité).

## Proposé (décisions restantes)

1. **Réclamation** par numéro de commande et courriel, sans envoi de courriel (0 $), avec le secours manuel pour les cas particuliers.
2. **Jeton de 7 jours** servant de grâce hors ligne. Le mode direct actuel accorde 14 jours.
3. **Plafond de 3 appareils** par offre et par licence (réduit le partage de clés, F2).
4. **Révocation automatique** sur annulation ou remboursement complet ; examen manuel en cas de remboursement partiel.
5. **Hébergement** sur Cloudflare Workers + D1 (offre gratuite, sans facturation automatique) plutôt que Durable Objects ou Supabase.

## Risques

- **F1 demeure** : les quotas et exports sont appliqués dans le navigateur. Les jetons signés empêchent de fabriquer des droits, pas de modifier le client ou l'horloge. Fermer F1 exigerait de traiter les données côté serveur, ce qui est exclu.
- **Réclamation par commande et courriel** : quelqu'un qui connaît les deux peut réclamer avant l'acheteur. La limitation de débit (8 essais par heure et par commande) atténue le risque, sans l'éliminer.
- **Dépendance au format Fourthwall non vérifié** : si le format diffère, l'analyse doit être ajustée avant l'ouverture.
- **Offre gratuite Cloudflare** : un dépassement provoque une panne temporaire, non des frais. L'app la tolère jusqu'à 7 jours.

**Prochaine action proposée** : autorisation du propriétaire pour l'étape 1 de la section 9, la lecture humaine des pages officielles marquées 🔎, puis l'étape 4, une livraison de test du webhook Fourthwall vers un service déployé. Ces deux étapes exigent la création d'un compte Cloudflare (étape 2), soumise à une autorisation distincte.
