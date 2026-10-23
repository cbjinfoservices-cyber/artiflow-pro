# Migration vers un rendu serveur — cadrage et estimation

_Note de décision. 19 octobre 2026. À relire quand on veut transformer les
aperçus de partage par page en vrai canal d'acquisition._

## 1. Le problème, en une phrase

Aujourd'hui toutes les URL publiques renvoient le même `index.html`. Les balises
propres à une page (titre, description, image de partage, JSON-LD) sont posées
par le routeur, côté navigateur. Googlebot exécute le JavaScript et les voit ;
les robots sociaux (LinkedIn, WhatsApp, Facebook, X, Slack, Discord) ne
l'exécutent pas et ne voient donc que l'accueil.

Conséquence mesurable : un lien vers `/zones-intervention/paris` partagé sur
LinkedIn affiche la carte de la marque, pas le visuel Paris. Un lien vers une
fiche métier affiche la même chose.

Détail de l'exploration technique : `docs/prerendu-og-par-page.md`.

## 2. Ce que « rendu serveur » veut dire ici

Deux besoins distincts, souvent confondus :

| Besoin | Qui le lit | Ce qu'il faut |
|---|---|---|
| Aperçus de partage corrects | robots sociaux (pas de JS) | **HTML par URL** avec les bonnes balises `<head>` |
| Bon référencement | Googlebot (exécute le JS) | déjà satisfait aujourd'hui |

Autrement dit : on n'a pas besoin d'un rendu serveur à chaque requête. On a
besoin d'un **HTML statique par URL**, généré au build. C'est beaucoup moins
lourd qu'une migration SSR complète, et c'est le point clé de ce cadrage.

## 3. Périmètre réel à pré-rendre

On ne migre **pas** l'espace connecté (`/app`, devis, factures, planning,
comptabilité). C'est une application authentifiée, derrière un écran de
connexion, invisible des robots : la laisser en SPA ne coûte rien.

Pages publiques à pré-rendre (environ **45 URL**) :

- accueil, `/tarifs`, `/contact`, `/a-propos`, `/plan-du-site`
- `/metiers` + 8 fiches + `/metiers/recapitulatif`
- `/zones-intervention` + 12 villes
- `/ressources`, `/ressources/sujets`, `/ressources/bibliotheque`, 5 parcours,
  18 guides
- `/podcast`, `/nouveautes` + 1 article, 6 pages auteur
- pages légales (mentions, RGPD, CGV, cookies, accessibilité)

Les 45 pages suivent le même motif : un `<head>` par URL, un corps qui peut
rester identique, puis l'hydratation de l'application.

## 4. Trois scénarios chiffrés

Hypothèse de coût : 550 à 700 € / jour (freelance senior ou coût interne
chargé). Les fourchettes sont volontairement larges.

### Scénario A — Pré-rendu statique des pages publiques (recommandé)

On garde le socle actuel et on ajoute, **après le build**, une étape qui ouvre
chaque route publique dans un navigateur sans interface, capture le `<head>`
final, et écrit un fichier statique par URL. L'espace connecté reste une SPA
servie par la même application.

- Effort : **18 à 26 jours-homme**
- Coût : **10 à 18 k€**
- Risques : modérés. Il faut que l'hébergement serve le fichier statique avant
  la règle de repli SPA (à confirmer côté plateforme), et il faut maintenir la
  liste des URL pré-rendues en parallèle du contenu (un oubli = une page qui
  retombe sur l'aperçu générique, sans casser la page).
- Découpage : 8 j d'outillage et d'intégration au build, 6 j de migration des
  métadonnées vers un format unique exploitable au build, 4 j de génération des
  visuels OG par page, 4 j de tests (45 URL × validateurs), 4 j de marge.

### Scénario B — Migration complète vers Next.js / Astro

Réécriture de la couche de routage et des pages publiques dans un cadre qui
gère le pré-rendu nativement. L'espace connecté peut rester en composants
React existants.

- Effort : **30 à 45 jours-homme**
- Coût : **17 à 31 k€**
- Risques : élevés. On rejoue les mêmes briques (navigation, formulaires,
  consentement, analytics, schémas JSON-LD) dans un nouveau cadre, avec une
  période où deux systèmes cohabitent. À réserver au cas où l'on voudrait aussi
  du contenu éditorial lourd (blog à forte cadence, multilingue, ISR).
- Avantage réel : plus de marge ensuite pour du contenu généré en masse, de
  l'ISR et des pages localisées par ville.

### Scénario C — Passerelle de pré-rendu devant l'hébergement

Un service (worker ou fonction de bord) intercepte les requêtes des robots
sociaux et renvoie un HTML enrichi, sans toucher à l'application.

- Effort : **5 à 8 jours-homme**
- Coût : **3 à 6 k€**
- Risques : bloquant aujourd'hui. Cette approche demande la main sur le routage
  au niveau de l'hébergement ou du DNS, ce que le projet ne contrôle pas sur la
  plateforme actuelle. Techniquement la plus élégante, administrativement la
  plus incertaine : à ne rouvrir que si un jour on héberge nous-mêmes.

### Synthèse

| Scénario | Effort | Coût | Aperçus par page | Risque | Verdict |
|---|---|---|---|---|---|
| A — pré-rendu statique | 18–26 j | 10–18 k€ | Oui | Modéré | **Recommandé** |
| B — migration Next/Astro | 30–45 j | 17–31 k€ | Oui + ISR | Élevé | Plus tard, si contenu massif |
| C — passerelle robots | 5–8 j | 3–6 k€ | Oui | Bloqué | Indisponible ici |
| Statu quo | 0 | 0 | Non | Nul | Défendable aujourd'hui |

## 5. Ce que la migration rapporterait vraiment

Il faut être honnête sur le retour attendu : **ce n'est pas un levier SEO**, le
référencement fonctionne déjà. C'est un levier de **taux de clic sur les liens
partagés** et de cohérence de marque.

- Un aperçu avec le bon visuel et le bon titre se clique mieux qu'une carte
  générique. L'ordre de grandeur constaté sur ce type de site est de +10 à +30 %
  de clics sur les liens sociaux, à audience constante.
- Les 12 pages villes et les 8 fiches métiers deviennent partageables une par
  une, ce qui rend enfin possible une campagne locale par ville.
- Effet secondaire utile : les crawlers d'IA (ChatGPT, Perplexity) qui
  n'exécutent pas de JS verraient enfin le contenu réel de chaque page.

## 6. Déclencheurs : quand lancer le chantier

Ne pas lancer sur une intuition. Trois signaux, mesurables dans l'audience :

1. **Part des inscriptions venant du social / référent ≥ 10 %** sur deux mois
   consécutifs. En dessous, l'aperçu n'est pas le goulot d'étranglement.
2. **Plus de 200 partages par mois** (liens sortants mesurés avec des UTM sur
   les posts). En dessous, le gain reste marginal au regard du coût.
3. **Une campagne locale planifiée** (par exemple 12 villes en 12 semaines) où
   l'aperçu par ville devient un élément du dispositif.

Un seul de ces signaux suffit à ouvrir le sujet. Aucun ne suffit à le lancer
sans arbitrage.

## 7. Prérequis à vérifier avant d'engager le scénario A

- [ ] L'hébergement peut servir `/zones-intervention/paris/index.html` avant la
      règle de repli vers `index.html`.
- [ ] Le pipeline de build accepte une étape post-build (script de pré-rendu).
- [ ] Les 45 URL publiques sont toutes listées dans le sitemap (c'est le cas
      aujourd'hui pour la majorité) : cette liste devient la source de vérité.
- [ ] Les visuels OG par page existent déjà : villes et métiers sont couverts,
      les ressources et guides utilisent encore un visuel de repli.

## 8. Ce qu'on fait en attendant (aucune régression)

1. Un **visuel de partage unique et lisible** au niveau du projet, choisi dans
   les Réglages SEO : c'est ce que verront tous les liens partagés.
2. Les visuels par ville et par métier restent utilisés en image héros et en
   image jointe des publications : ils servent déjà, en grand format.
3. Garder les métadonnées par page maintenues côté routeur : elles servent
   Google aujourd'hui et seront réutilisées telles quelles par le pré-rendu.
4. Mesurer avec des UTM avant de décider. Sans mesure, pas de déclencheur.