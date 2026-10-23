# Aperçus de partage par page (Open Graph) — exploration

_Note technique interne. Dernière mise à jour : 19 octobre 2026._

## Le besoin

LinkedIn, WhatsApp, X, Slack ou Facebook ne lisent que le HTML **renvoyé par le
serveur**. Ils n'exécutent pas JavaScript. Aujourd'hui, ArtiFlow-pro est une
application d'une seule page (SPA) : les 12 URL de villes renvoient toutes le
même `index.html`, et les balises propres à chaque ville sont posées par le
routeur, dans le navigateur. Résultat : un seul aperçu pour tout le site.

## Ce qui a été vérifié sur le site publié

- `https://artiflow-pro.com/zones-intervention/paris` renvoie bien un `200` et le
  HTML de la coquille de l'application.
- Ce HTML contient le titre générique du site
  (« ArtiFlow-pro — Assistant IA pour artisans du bâtiment ») et une image
  d'aperçu **gérée au niveau du projet** (fichier hébergé par la plateforme),
  pas le visuel 1200×630 propre à Paris.
- Les 12 URL de villes se comportent de la même façon : même HTML servi,
  contenu différent seulement après exécution du JavaScript.

## Contrainte de la plateforme

Les réglages d'aperçu social (OG) sont **au niveau du projet** : un site = un
jeu de balises. Les réglages par page ne sont pas pris en charge, et il n'existe
pas de rendu serveur (SSR) ni de pré-rendu par URL intégré au produit. Toute
balise écrite dans `index.html` est donc commune à toutes les pages.

C'est pour cela que la recherche Google fonctionne (Googlebot exécute le
JavaScript et voit le bon titre, la bonne description, les FAQ et les fils
d'Ariane), alors que les robots sociaux, eux, ne voient que l'accueil.

## Options examinées

### 1. Pré-rendu au build (headless) — la plus propre, non disponible ici

Un script après `vite build` ouvrirait chaque route dans un navigateur sans
interface, récupérerait le `<head>` final et écrirait un fichier statique par
URL (`out/zones-intervention/paris/index.html`).

- Qualité : parfaite (titre, description, image, JSON-LD par page, sans changer
  le contenu).
- Blocage : cela demande d'ajouter une étape au pipeline de build
  (`package.json` → `scripts`) et de s'assurer que l'hébergement sert bien le
  fichier statique avant la règle de repli SPA. Ces deux points ne sont pas
  modifiables depuis le code du projet sur la plateforme actuelle.
- Verdict : à rouvrir si la plateforme expose un jour une étape de build
  personnalisée ou un pré-rendu par route.

### 2. Fichiers statiques déposés dans `public/` — écarté

Déposer `public/zones-intervention/paris/index.html` ne fonctionne pas ici :
ces fichiers ne sont pas transformés par Vite (le vrai `index.html` reçoit les
noms de fichiers hachés du bundle). On obtiendrait soit une coquille vide, soit
un contournement fragile qui recharge l'application à l'exécution. Risque de
casser une page publique réelle pour un gain de confort d'aperçu : non.

### 3. Migration vers un cadre avec rendu serveur — la vraie réponse long terme

Next.js, Astro ou Remix permettent des balises par URL sans bricolage, et
ouvrent la porte à des pages plus rapides au premier affichage.

- Coût : réécriture de la couche de routage et des pages publiques, perte
  temporaire de l'écosystème déjà en place (espace connecté, automatisations,
  fonctions serveur).
- Verdict : pertinent seulement si le trafic social et l'acquisition par
  contenu deviennent un canal majeur. À décider comme un projet, pas comme un
  réglage.

### 4. Solution retenue aujourd'hui : assumer un aperçu de marque unique

Tant que le pré-rendu n'est pas possible, l'aperçu social reste celui du site.
Le bon réflexe est donc de choisir une image de partage **générique mais
soignée** dans les réglages SEO / aperçu OG du projet, et de publier les visuels
par ville directement dans le post (image jointe), où ils sont vus en grand.

## Ce que cela implique concrètement

- Les visuels 1200×630 par ville restent utiles (image héros de la page,
  cohérence de marque, réutilisation dans les publications), mais ils ne
  peuvent pas devenir l'aperçu automatique d'un lien tant que le HTML par URL
  n'existe pas.
- Rafraîchir le cache du Post Inspector LinkedIn ne changera rien : il
  retéléchargera le même HTML d'accueil.
- Les balises par page (titre, description, canonique, OG, JSON-LD) restent
  maintenues côté routeur : elles servent Google, et elles sont déjà prêtes pour
  le jour où un pré-rendu sera branché.

## Prochaine étape recommandée

1. Garder la configuration actuelle (aucune régression, aucun risque).
2. Si le besoin social devient prioritaire : cadrer la migration vers un rendu
   serveur, ou demander à la plateforme une étape de pré-rendu par route.

Le cadrage chiffré des trois scénarios (effort, coût, risques, déclencheurs) se
trouve dans `docs/estimation-migration-rendu-serveur.md`.