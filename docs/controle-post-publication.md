# Contrôle après publication — métadonnées & aperçus

Procédure courte à dérouler **après chaque publication** (et systématiquement
après un changement d'image de partage ou de données structurées). Compter
10 minutes. Elle vérifie trois choses : ce que voient les robots sociaux, ce que
voit Google, et ce que le sitemap annonce.

---

## 1. L'image servie au partage social

1. Ouvrir <https://www.linkedin.com/post-inspector/> et coller `https://artiflow-pro.fr/`.
2. Lancer l'inspection.

**Attendu**

- une image **1200×630**, celle choisie dans les Réglages SEO du projet ;
- le titre et la description du site, pas ceux d'une page interne.

> Rafraîchir l'inspecteur ne change pas l'image servie : il retélécharge le même
> HTML. Si l'image est bonne ici et mauvaise ailleurs, le problème est dans une
> déclaration du code, pas dans le cache de la plateforme.

Contrôle complémentaire, sans compte : <https://www.opengraph.xyz/>.

---

## 2. Le HTML réellement servi (sans JavaScript)

```
curl -sL https://artiflow-pro.fr/ | grep -E 'og:image|twitter:image|canonical'
```

**Attendu**

- `og:image` et `twitter:image` pointent vers **le même fichier** ;
- l'URL canonique est celle de la page, en HTTPS et sans slash final (sauf la
  racine).

> Les données structurées ne sont **pas** dans ce HTML brut : l'application les
> injecte au chargement. C'est voulu (elles se construisent à partir de
> l'origine réelle du site), et c'est la raison pour laquelle le contrôle des
> entités se fait à l'étape suivante, dans un outil qui exécute le JavaScript.

---

## 3. Les données structurées

1. Ouvrir <https://search.google.com/test/rich-results?url=https%3A%2F%2Fartiflow-pro.fr%2F>
2. Puis, pour un second avis : <https://validator.schema.org/#url=https%3A%2F%2Fartiflow-pro.fr%2F>

**Attendu sur le test Google (avec JS) — exactement 3 entités**

| Entité              | `@id` attendu                     |
| ------------------- | --------------------------------- |
| Organization        | `https://artiflow-pro.fr/#organization` |
| SoftwareApplication | `https://artiflow-pro.fr/#application`  |
| WebSite             | `https://artiflow-pro.fr/#website`      |

- 0 erreur, aucune adresse `@id` en double ;
- `publisher` pointe bien vers `#organization` ;
- les blocs propres à la page (FAQ, fil d'Ariane, Service, Article) s'ajoutent
  aux trois entités du site : c'est normal, ils ne les remplacent pas.

**Le validateur Schema.org, lui, n'exécute pas le JavaScript** : il peut donc
n'afficher aucune entité. Son absence de résultat n'est pas un échec, seulement
une limite de l'outil. En cas de doute sur un doublon, chercher deux fois le
même `@id` dans le test Google, qui voit l'état réel de la page.

---

## 4. Le sitemap et les règles de crawl

```
curl -s https://artiflow-pro.fr/sitemap.xml | head -40
curl -s https://artiflow-pro.fr/robots.txt
```

**Attendu**

- `https://artiflow-pro.fr/` avec son `<image:loc>` égal à l'image de partage ;
- des `<lastmod>` **uniquement** sur les pages dont le contenu a réellement
  changé (jamais la date du jour de publication) ;
- aucune URL en double, aucune URL d'espace connecté (`/app`, `/signature-devis`),
  ni `changefreq` ni `priority` ;
- un fichier `robots.txt` qui exclut les mêmes chemins privés et pointe vers le
  sitemap.

**D'où vient cette liste** : `src/lib/sitemap.ts` la reconstruit à partir des
mêmes données que les pages (métiers, villes, guides, parcours, auteurs). Une
fiche ajoutée dans ces données apparaît donc dans la liste attendue sans qu'on
l'ait saisie. Comme le fichier `public/sitemap.xml` reste statique, on compare
les deux dans l'audit (étape 6) et on copie le XML généré quand il a bougé.

Ensuite : Search Console → **Sitemaps** → renvoyer `sitemap.xml` si des pages
ont été ajoutées.

---

## 5. Les 12 pages villes

Ouvrir au moins trois adresses au hasard, dont `/zones-intervention/paris` :

`/paris` · `/lyon` · `/marseille` · `/toulouse` · `/bordeaux` · `/lille` ·
`/nantes` · `/nice` · `/strasbourg` · `/montpellier` · `/rennes` · `/grenoble`

**Attendu** : la bonne ville s'affiche (H1, région, quartiers, FAQ locale), et
aucune n'affiche la page « Zones d'intervention » à la place de sa ville.

---

## 6. Les garde-fous internes

Espace connecté → **Audit SEO**. Trois blocs à contrôler, tous doivent afficher
« Aucun écart » :

- **Garde-fou des visuels de partage** : les trois déclarations (HTML servi,
  image de repli du routeur, sitemap) alignées sur l'image servie ;
- **Garde-fou des titres et descriptions** : aucun titre ni description partagé
  entre deux pages, aucun champ hors plage (titre ≤ 60, description 120–160) ;
- **Garde-fou du sitemap** : le fichier servi contient exactement les URL
  attendues, sans doublon ni entrée orpheline.

Ces contrôles comparent ce que le code **déclare** à ce que le site **sert**. Un
écart ici signifie qu'un fichier a été mis à jour sans les autres.

---

## Cas d'erreur et action

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| L'inspecteur montre une image, le site une autre | `index.html` ou l'image de repli n'a pas été réalignée | Aligner les trois déclarations, puis republier |
| Plus de 3 entités détectées | un bloc de page s'est empilé ou dupliqué | Vérifier que les `@id` sont uniques, retirer le doublon |
| `og:image` relative (`/image.webp`) | URL non absolue | Repasser en URL `https://` complète |
| Aperçu correct sur LinkedIn, vide sur WhatsApp | image trop lourde ou en WebP non supporté | Servir un JPEG/PNG < 300 ko en 1200×630 |
| Pages villes en 404 | slug absent des données ou route non déployée | Vérifier la route `/zones-intervention/:slug` puis republier |
| `lastmod` de toutes les pages = date du jour | le générateur a reçu la date courante au lieu des dates réelles des données | Reprendre la date de publication ou de révision de chaque contenu |
| Nouvelle ville ou nouveau métier absent du sitemap | fiche ajoutée sans régénérer `public/sitemap.xml` | Copier le XML généré depuis l'audit et republier |

---

## Cadence recommandée

- **À chaque publication** : étapes 1 et 6 (2 minutes).
- **Après un ajout de page** : étapes 2 à 5.
- **Une fois par mois** : étape 3 sur l'accueil + deux pages métiers.