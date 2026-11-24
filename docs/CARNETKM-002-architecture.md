# CarnetKM — Forfaits v2 et offre bundle SharpLaughs (MISSION-CARNETKM-002)

État : développement sur `claude/carnetkm-plans-v2`, **non fusionné, non publié**. Aucune modification Gumroad ou Fourthwall, aucun service payant, aucun code promotionnel réel.

## 1. Forfaits

| Forfait | Prix | Trajets | Fonctions |
|---|---|---|---|
| Gratuit | 0 $ | 12 / mois | Trajets, dépenses illimitées, sommaire à l'écran, **sauvegarde et restauration** |
| Plus | 4,99 $ CA / mois | 60 / mois | Gratuit + registre PDF, exports CSV, trajets fréquents, détail TPS/TVQ |
| Pro | 9,99 $ CA / mois | illimités | Plus + trajets illimités |
| Abonnement d'origine (existant, « Pro » 4,99 $) | inchangé | illimités | droits identiques à Pro |

Ce qui est proposé et reste **à valider** : la sauvegarde/restauration et les dépenses restent gratuites ; les rapports professionnels (PDF, CSV) sont payants. Plus et Pro ne diffèrent que par le nombre de trajets.

## 2. Règles de quota

- **Mois calendaire de la date du trajet**, c'est-à-dire la date locale saisie (AAAA-MM-JJ), sans conversion de fuseau. Le mois courant et la date par défaut suivent l'heure locale de l'appareil, et la bascule se fait à minuit local le 1er du mois (testée avec America/Toronto).
- **Trajets antidatés** : ils comptent dans le mois de leur date, et chaque mois a son propre quota. Le forfait appliqué est celui en vigueur **au moment de la saisie**.
- **Suppression** : le quota compte les trajets existants, donc supprimer un trajet libère une place.
- **Import / restauration** : jamais tronqués ni bloqués par le quota. Le quota ne s'applique qu'aux nouvelles saisies.
- **Dépassement ou expiration** (retour à Gratuit, fin d'abonnement, fin de l'offre bundle) : **aucune donnée n'est supprimée ni masquée**. La liste, le sommaire et la sauvegarde restent complets, avec un message explicatif. Seuls les nouveaux ajouts au-delà du quota et les rapports payants sont bloqués.
- **Hors ligne** : quotas, forfait et échéance de l'offre sont calculés localement. Le délai de grâce de licence de 14 jours (SEC-001) est inchangé.

## 3. Compatibilité des données

- La clé `localStorage` `carnetkm.v1` et le format de sauvegarde `v:1` sont **inchangés** : une sauvegarde de main se restaure ici, et inversement.
- Une licence enregistrée sans champ `slot` (ancien format) est reconnue comme **abonnement d'origine**. La migration est automatique, sans action de l'abonné et sans perte de droits.
- `license`, `trial` et `redeemed` sont des droits propres à l'appareil. Ils ne sont **jamais exportés** et une sauvegarde importée ne peut pas les injecter : la restauration conserve les droits de l'appareil.
- Le service worker passe à `carnetkm-v4` (réseau d'abord, inchangé) pour purger le cache v3.

## 4. Abonnés existants (4,99 $ illimité)

- Leurs droits sont conservés intégralement (Pro illimité). Le prix et le contrat Gumroad ne changent pas, et la revérification se fait sur leur produit d'origine uniquement.
- L'application **n'affiche plus de lien d'achat** vers l'offre d'origine, sinon de nouveaux clients achèteraient de l'illimité à 4,99 $ à côté de Plus à 4,99 $ / 60 trajets.
- **Décision du propriétaire** : retirer ou non cette offre de la vente sur Gumroad au lancement de Plus/Pro, sans toucher aux abonnements en cours. C'est une action manuelle, non faite ici.

## 5. Offre bundle SharpLaughs : 3 mois de Plus

**Durée** : 3 mois calendaires à compter de l'activation, sans carte ni renouvellement. L'échéance est exclusive : l'offre est active jusqu'à la veille du même quantième 3 mois plus tard. Si ce quantième n'existe pas, le dernier jour du mois cible est inclus. Exemples testés :

- 24 nov. → 23 févr. inclus
- 30 nov. → 28 févr. inclus
- 31 août → 30 nov. inclus
- 30 nov. 2027 → 29 févr. 2028 inclus

À l'échéance, l'utilisateur revient à Gratuit, sauf s'il s'est abonné volontairement. Si un abonnement est actif, le **forfait le plus élevé l'emporte** (bundle Plus + Pro = Pro ; la fin de Pro ramène à Plus jusqu'à l'échéance).

**Ce qui est livré** : le modèle de droits complet et l'interface FR/EN. L'activation est **simulée uniquement** (`CONFIG.bundle.mode = "simulation"`, codes fictifs `DEMO-XXXX`, aucun appel réseau). Le mode publié par défaut est `"off"` : la carte affiche « bientôt » et aucune activation n'est possible.

**Ce que la simulation ne garantit pas** : l'unicité d'un code n'est vérifiée que sur l'appareil (stockage local modifiable). **Ce n'est pas un contrôle sécurisé**, pas plus que le contrôle de licence existant (F1).

### Activation unique par achat : options (choix à valider, rien n'est créé)

Constat documentaire, en lecture seule : selon l'aide Gumroad, un produit avec clés de licence inclus dans un bundle remet **sa propre clé** à l'acheteur. L'API `POST /v2/licenses/verify` (sans authentification) renvoie `success`, `uses` et `purchase` (dont `created_at`, `refunded`, etc.). Ce comportement doit être **confirmé par un achat test du propriétaire**.

L'emplacement réel du bundle SharpLaughs (Gumroad ou Fourthwall) n'est pas confirmé. Fourthwall n'a pas pu être consulté depuis la session : connecteur non authentifié.

- **A. Sans serveur (0 $)** : le propriétaire ajoute au bundle un produit Gumroad « CarnetKM Plus — 3 mois (bundle) » à 0 $ séparé, avec clés de licence. L'app vérifie la clé avec ce `product_id` et `increment_uses_count=true`, puis refuse si `uses > N` (par exemple 2, pour un changement de téléphone).
  - Le début de l'offre est la date de première activation locale.
  - Limites : unicité **indicative** (contournable côté client), réinstallation = date de début perdue, compteur Gumroad sans plafond serveur.
  - Variante plus robuste : ancrer la durée sur `purchase.created_at` (date d'achat, identique sur tous les appareils). Cela s'écarte toutefois de « à compter de l'activation ».
- **B. Petit service de droits (recommandé si l'unicité doit être fiable)** : une fonction serverless (par exemple Cloudflare Workers et KV, offre gratuite) reçoit la clé, la vérifie auprès de Gumroad et enregistre l'activation (hachage de la clé, date de début) **une seule fois**. Elle renvoie ensuite un jeton signé (ECDSA P-256 ; seule la clé publique est dans le client) portant le forfait et l'échéance.
  - Avantages : unicité réelle, même date de début sur tous les appareils, révocation possible.
  - Le client reste modifiable : la signature empêche de fabriquer des jetons, pas de contourner le code.
  - Coût estimé : 0 $ dans les quotas gratuits. Les quotas Cloudflare (environ 100 000 requêtes/jour, 1 000 écritures KV/jour) sont **à vérifier**.
  - Ajouts nécessaires : un compte, une clé privée hors dépôt, l'hôte du service dans `connect-src` de la CSP, ainsi qu'une politique de confidentialité mise à jour (la clé quitte l'appareil vers un service SharpLaughs).
- **Non retenu** : un code promotionnel commun ou des codes en clair dans le client (partage immédiat).

## 6. Mise en service : étapes futures, chacune soumise à autorisation distincte

1. Le propriétaire crée les produits Gumroad Plus (4,99 $ CA/mois) et Pro (9,99 $ CA/mois) avec clés de licence. Il faut ensuite renseigner `id` et `url` dans `CONFIG.products`.
2. Décider du sort de l'offre d'origine sur Gumroad (voir section 4).
3. Choisir l'option A ou B pour le bundle, faire un achat test et passer `CONFIG.bundle.mode` au mode réel une fois implémenté.
4. Valider sur Safari iPhone, puis publier via PR vers gh-pages, comme pour SEC-001-C.
