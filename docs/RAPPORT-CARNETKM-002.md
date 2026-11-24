# Rapport MISSION-CARNETKM-002 — pour validation par Iris / SL Command

24 novembre 2026. Agent : Claude Code. Branche : `claude/carnetkm-plans-v2` (à partir de main `d2bc1d0`). Coût supplémentaire : **0 CAD**.

## Confirmé
- **État de départ** :
  - main `d2bc1d0` et gh-pages `adbc9fd` correspondent à la clôture SEC-001.
  - Ruleset actif « Protection main et gh-pages » : PR obligatoire, pas de force-push ni de suppression.
  - Seul workflow : `pages-build-deployment` (dynamique, lié à la source Pages). Le push d'une branche dédiée ne déclenche pas de déploiement.
  - Limite : la source Pages et les webhooks ne sont pas lisibles via le proxy (403).
- **Forfaits implémentés** :
  - Gratuit 12, Plus 60 (4,99 $ CA/mois), Pro illimité (9,99 $ CA/mois).
  - Quotas par mois calendaire de la date du trajet ; règles pour l'antidatage, la suppression, l'import et le mode hors ligne.
  - Aucune donnée supprimée ni masquée en cas de dépassement ou d'expiration.
- **Interface FR/EN** : onglet « Forfaits » / « Plans » avec trois cartes, indicateur de quota mensuel et carte bundle SharpLaughs. Les boutons Plus et Pro affichent « Bientôt » sans lien d'achat, car les produits n'existent pas.
- **Abonnés existants** : licence d'origine = droits Pro illimités, migration automatique (ancien format reconnu), revérification sur le produit d'origine seulement.
- **Offre bundle** :
  - Modèle de droits livré : 3 mois calendaires de Plus, fins de mois et années bissextiles gérées, sans renouvellement, retour à Gratuit, priorité au forfait le plus élevé.
  - Activation **simulée seulement** (codes fictifs DEMO-…), désactivée par défaut.
- **Sauvegardes** : format v1 inchangé et rétrocompatible. Licence et offre ne sont jamais exportées ni importables.
- **SEC-001 préservé** : nettoyage des sauvegardes, CSV anti-formules, CSP inchangée, polices locales, grâce de licence inchangée. Service worker passé de v3 à v4.
- **Défaut corrigé (préexistant sur main)** : après l'activation d'une licence, le message de confirmation effaçait l'état de l'abonnement et le bouton « Retirer la clé ».
- **Tests** : `node --test tests/plans.test.mjs` donne **24/24 réussis**.
  - Couverture : quotas (incluant la bascule du 31 au 1er à Toronto), antidatage, suppression, dépassement après restauration, Plus, Pro, migration, annulation, erreur réseau, bundle (activation, échéance, fins de mois, usage unique local, falsification rejetée), changement de forfait, sauvegardes, régression SEC-001.
  - Mobile : iPhone 13 émulé sur Chromium, sans débordement horizontal.
  - Hors ligne : HTTPS local, service worker réel.
  - Gumroad est toujours simulé : **aucun appel réel**, aucune requête externe.

## À vérifier
- **Fourthwall** : connecteur non authentifié dans cette session, aucune vérification possible. L'emplacement du bundle SharpLaughs (Gumroad ou Fourthwall) reste à confirmer.
- **Gumroad** : d'après l'aide (lecture seule), chaque produit avec licence dans un bundle reçoit sa propre clé. À confirmer par un achat test du propriétaire.
- **Safari iPhone réel** et autres navigateurs : non testés. Les tests précédents de 55 cas ne sont pas dans le dépôt et n'ont pas été rejoués ; ils sont couverts en partie par la nouvelle suite.
- Les quotas gratuits Cloudflare cités pour l'option B.

## Proposé (décisions à prendre)
1. Répartition des fonctions : sauvegarde et dépenses gratuites ; PDF et CSV à partir de Plus ; Plus et Pro ne diffèrent que par le quota.
2. Retrait de la vente de l'offre Gumroad d'origine à 4,99 $ illimitée au lancement, sans toucher aux abonnements en cours. Si cette branche est fusionnée, l'app ne propose plus de lien d'achat tant que Plus et Pro ne sont pas créés.
3. Bundle : option A (sans serveur, unicité indicative, 0 $) ou option B (service de droits serverless avec jeton signé, unicité réelle, 0 $ estimé dans les quotas gratuits). Voir `docs/CARNETKM-002-architecture.md`.

## Risques
- F1 et F2 restent ouverts : tout contrôle local (forfait, quota, échéance de l'offre, reculer l'horloge) est contournable par un utilisateur technique.
- Les quotas reposent sur la date saisie : antidater dans un autre mois permet 12 trajets de plus dans ce mois. C'est conforme à la règle « par mois de la date du trajet ».
- La simulation bundle ne doit jamais être publiée en mode `simulation`. Le test « désactivé par défaut » protège ce point.

## Non fait (hors mandat ou sans autorisation)
Aucune fusion, aucune publication gh-pages, aucune création ni modification de produit Gumroad ou Fourthwall, aucun code réel, aucun service ou compte créé. SL Road est hors périmètre.

**Prochaine action proposée** : décisions 1 à 3 du propriétaire, puis création par lui des produits Gumroad Plus et Pro, sous autorisation distincte.
