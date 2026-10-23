import { IMAGE_PARTAGE_SITE } from "@/hooks/usePageMeta";
import { IMAGE_PARTAGE_RECAP_NOUVEAUTES } from "@/lib/imagesPartage";
import { pagesPubliques } from "@/lib/auditSeo";
import { equipe } from "@/mocks/equipe";
import { interventionsPubliques } from "@/mocks/interventions";
import { metiers } from "@/mocks/metiers";
import { parcours } from "@/mocks/parcours";
import { articleDateIso, articles } from "@/mocks/ressources";
import { villes } from "@/mocks/villes";

/**
 * Sitemap construit à partir des données, et non plus saisi à la main.
 *
 * Le fichier `public/sitemap.xml` est un artefact statique : il ne se met pas à
 * jour tout seul quand une fiche métier, une ville, un guide, un parcours ou un
 * auteur est ajouté. Cette source unique reconstruit la liste complète à partir
 * des mêmes données que les pages, ce qui rend l'oubli d'une nouvelle page
 * structurellement impossible — et permet au garde-fou de comparer le fichier
 * publié à ce qui *devrait* y être.
 *
 * Chaque page peut porter une date de dernière modification (`lastmod`) et une
 * ou plusieurs images (`image:loc`). Ces valeurs ne suivent jamais la date du
 * jour : une page sans révision réelle n'a pas de `lastmod`.
 */

export type ImageSitemap = {
  /** URL absolue de l'image. */
  loc: string;
  /** Titre lisible de l'image (image:title). */
  title: string;
};

export type EntreeSitemap = {
  /** Chemin public, commençant par « / ». */
  path: string;
  /** Date de dernière modification réelle (AAAA-MM-JJ), si elle est connue. */
  lastmod?: string;
  /** Images associées à la page dans le sitemap. */
  images?: ImageSitemap[];
};

/**
 * Origine utilisée pour construire les URL absolues du sitemap.
 *
 * Les fichiers `sitemap.xml` et `robots.txt` sont des fichiers statiques : leur
 * contenu doit rester du XML et du texte brut, sans variable, gabarit ni
 * expression dynamique. Leur origine est donc écrite en dur, et volontairement
 * neutre — c'est une origine de remplissage interne, jamais celle du site.
 * Le domaine réel des balises de page (canonique, Open Graph, JSON-LD) est lui
 * lu depuis l'environnement, dans `src/lib/site.ts`.
 */
export const ORIGINE_SITEMAP = "https://example.com";

/**
 * Dates de révision éditoriale des familles de pages.
 *
 * Elles correspondent à la dernière refonte réelle du contenu concerné, pas à
 * la date de publication du site. Une fiche ajoutée plus tard doit porter sa
 * propre date plutôt que d'hériter de celle-ci.
 */
const DATE_REVISION_METIERS = "2026-10-19";
const DATE_REVISION_VILLES = "2026-10-19";
const DATE_REVISION_PLAN = "2026-10-19";
const DATE_REVISION_NOUVEAUTE = "2026-10-16";
/** Annonce « suivi des emails clients » : dernière livraison du journal (v3.4). */
const DATE_REVISION_NOUVEAUTE_SUIVI_EMAILS = "2026-10-23";
const DATE_REVISION_MEDIAS = "2026-10-03";

/**
 * Images de partage des deux annonces à la une du journal.
 *
 * Ce sont exactement les visuels déclarés dans les balises Open Graph des pages : Google les
 * attend aussi dans le sitemap (`image:loc`) pour les résultats enrichis, et une image absente
 * ici revient à priver l'annonce de sa vignette.
 */
const IMAGE_ANNONCE_PERSONNALISATION =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20unified%20brand%20identity%20for%20construction%20documents%2C%20overlapping%20quote%20and%20invoice%20cards%20with%20a%20color%20swatch%20palette%20and%20an%20envelope%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-personnalisation-documents&orientation=landscape";

const IMAGE_ANNONCE_SUIVI_EMAILS =
  "https://readdy.ai/api/search-image?query=Stylized%20editorial%20illustration%20of%20email%20delivery%20tracking%20for%20a%20construction%20business%2C%20a%20stylized%20envelope%20with%20a%20green%20check%20beside%20a%20red%20crossed%20envelope%2C%20a%20small%20countdown%20clock%20and%20a%20notification%20card%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20subtle%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-suivi-emails&orientation=landscape";

/** Pages de l'offre et des métiers (tête de sitemap). */
function entreesOffre(): EntreeSitemap[] {
  return [
    {
      path: "/",
      images: [
        {
          loc: IMAGE_PARTAGE_SITE,
          title: "ArtiFlow-pro — assistant IA pour artisans du bâtiment",
        },
      ],
    },
    { path: "/tarifs" },
    { path: "/metiers", lastmod: DATE_REVISION_METIERS },
    ...metiers.map((metier) => ({
      path: `/metiers/${metier.slug}`,
      lastmod: DATE_REVISION_METIERS,
    })),
    { path: "/metiers/recapitulatif", lastmod: DATE_REVISION_METIERS },
  ];
}

/** Hub des zones d'intervention puis une entrée par ville. */
function entreesZones(): EntreeSitemap[] {
  return [
    { path: "/zones-intervention", lastmod: DATE_REVISION_VILLES },
    ...villes.map((ville) => ({
      path: `/zones-intervention/${ville.slug}`,
      lastmod: DATE_REVISION_VILLES,
    })),
  ];
}

/** Ressources : hubs, parcours guidés puis guides (avec leur catégorie canonique). */
function entreesRessources(): EntreeSitemap[] {
  return [
    { path: "/ressources" },
    { path: "/ressources/sujets" },
    { path: "/ressources/bibliotheque" },
    ...parcours.map((p) => ({ path: `/ressources/parcours/${p.slug}` })),
    ...articles.map((article) => ({
      // Un guide peut vivre sur sa propre page (href) plutôt que sur /ressources/:slug.
      path: article.href ?? `/ressources/${article.slug}`,
      // Date de publication réelle du guide : jamais la date de publication du site.
      lastmod: article.blogPosting?.dateModified ?? (articleDateIso(article) || undefined),
    })),
  ];
}

/** Pages d'entreprise, médias, auteurs. */
function entreesEntreprise(): EntreeSitemap[] {
  const imagesPodcast = interventionsPubliques.map((intervention) => ({
    loc: intervention.thumbnailUrl,
    title: `${intervention.format} — ${intervention.title} (${intervention.event})`,
  }));

  return [
    { path: "/contact" },
    { path: "/a-propos" },
    {
      path: "/podcast",
      lastmod: DATE_REVISION_MEDIAS,
      images: imagesPodcast.length > 0 ? imagesPodcast : undefined,
    },
    { path: "/nouveautes" },
    {
      path: "/nouveautes/recapitulatif",
      lastmod: DATE_REVISION_NOUVEAUTE_SUIVI_EMAILS,
      images: [
        {
          loc: IMAGE_PARTAGE_RECAP_NOUVEAUTES,
          title: "ArtiFlow-pro — toutes les annonces du journal, en images",
        },
      ],
    },
    {
      path: "/nouveautes/personnalisation-documents",
      lastmod: DATE_REVISION_NOUVEAUTE,
      images: [
        {
          loc: IMAGE_ANNONCE_PERSONNALISATION,
          title: "ArtiFlow-pro — des documents à votre image, partout (annonce)",
        },
      ],
    },
    {
      path: "/nouveautes/suivi-emails-clients",
      lastmod: DATE_REVISION_NOUVEAUTE_SUIVI_EMAILS,
      images: [
        {
          loc: IMAGE_ANNONCE_SUIVI_EMAILS,
          title: "ArtiFlow-pro — suivi des emails clients : refus, vérification et renvoi différé (annonce)",
        },
      ],
    },
    { path: "/nous-rejoindre" },
    ...equipe.map((membre) => ({ path: `/auteurs/${membre.id}` })),
    { path: "/plan-du-site", lastmod: DATE_REVISION_PLAN },
    { path: "/guide/mot-de-passe-solide" },
  ];
}

/** Pages légales. */
function entreesLegales(): EntreeSitemap[] {
  return [
    { path: "/mentions-legales" },
    { path: "/rgpd" },
    { path: "/cgv" },
    { path: "/cookies" },
    { path: "/accessibilite" },
  ];
}

/** Regroupe deux listes d'images sans doublon d'URL. */
function fusionnerImages(
  a?: ImageSitemap[],
  b?: ImageSitemap[]
): ImageSitemap[] | undefined {
  if (!a?.length) return b?.length ? [...b] : undefined;
  if (!b?.length) return [...a];
  const vues = new Set(a.map((image) => image.loc));
  return [...a, ...b.filter((image) => !vues.has(image.loc))];
}

/**
 * Déduplique par chemin en gardant l'ordre d'apparition. Deux sources peuvent
 * décrire la même URL (une page fixe et un guide redirigé vers elle) : on
 * conserve alors la date et les images les plus complètes.
 */
function dedupliquer(entrees: EntreeSitemap[]): EntreeSitemap[] {
  const parChemin = new Map<string, EntreeSitemap>();

  entrees.forEach((entree) => {
    const existant = parChemin.get(entree.path);
    if (!existant) {
      parChemin.set(entree.path, { ...entree });
      return;
    }
    parChemin.set(entree.path, {
      path: entree.path,
      lastmod: existant.lastmod ?? entree.lastmod,
      images: fusionnerImages(existant.images, entree.images),
    });
  });

  return Array.from(parChemin.values());
}

/** Liste complète et ordonnée des URL publiques du site. */
export const entreesSitemap: EntreeSitemap[] = dedupliquer([
  ...entreesOffre(),
  ...entreesZones(),
  ...entreesRessources(),
  ...entreesEntreprise(),
  ...entreesLegales(),
]);

/** Échappe une valeur pour un contenu XML. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Reconstruit le contenu complet de `sitemap.xml` à partir des données. */
export function genererSitemapXml(origine: string = ORIGINE_SITEMAP): string {
  const base = origine.replace(/\/+$/, "");

  const lignes = entreesSitemap.map((entree) => {
    const blocs: string[] = [`    <loc>${echapper(`${base}${entree.path}`)}</loc>`];
    if (entree.lastmod) blocs.push(`    <lastmod>${entree.lastmod}</lastmod>`);
    (entree.images ?? []).forEach((image) => {
      blocs.push("    <image:image>");
      blocs.push(`      <image:loc>${echapper(image.loc)}</image:loc>`);
      blocs.push(`      <image:title>${echapper(image.title)}</image:title>`);
      blocs.push("    </image:image>");
    });
    return `  <url>\n${blocs.join("\n")}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...lignes,
    "</urlset>",
    "",
  ].join("\n");
}

/** Naturalise une URL de sitemap en chemin comparable (« / », sans slash final). */
export function cheminDepuisUrl(url: string, origine: string = ORIGINE_SITEMAP): string {
  let chemin = url.trim();
  const base = origine.replace(/\/+$/, "");
  if (chemin.startsWith(base)) chemin = chemin.slice(base.length);
  // Une URL absolue sur un autre domaine est ramenée à son chemin.
  if (/^https?:\/\//i.test(chemin)) {
    try {
      chemin = new URL(chemin).pathname;
    } catch {
      return chemin;
    }
  }
  const sansParametres = chemin.split("#")[0].split("?")[0];
  const nettoye = sansParametres.replace(/\/+$/, "");
  return nettoye === "" ? "/" : nettoye;
}

/** Un écart entre le sitemap publié et ce que les données déclarent. */
export type EcartSitemap = {
  /** Code du contrôle. */
  motif: "page-absente" | "doublon" | "entree-inconnue" | "page-non-generée";
  gravite: "erreur" | "alerte";
  /** Chemin concerné. */
  chemin: string;
  message: string;
};

/**
 * Compare le sitemap effectivement publié (`public/sitemap.xml`) à la liste
 * dérivée des données.
 *
 * Trois angles :
 *  1. une page présente dans les données mais absente du fichier → nouvelle
 *     page oubliée à la publication (le cas qu'on veut rendre impossible) ;
 *  2. une URL présente deux fois dans le fichier ;
 *  3. une URL du fichier qui ne correspond à aucune page connue (page
 *     supprimée dont l'entrée est restée, ou faute de frappe).
 */
export function verifierSitemap(locsPubliees: string[]): EcartSitemap[] {
  const ecarts: EcartSitemap[] = [];
  const attendus = new Set(entreesSitemap.map((entree) => entree.path));

  const vus = new Map<string, number>();
  locsPubliees.forEach((loc) => {
    const chemin = cheminDepuisUrl(loc);
    vus.set(chemin, (vus.get(chemin) ?? 0) + 1);
  });

  entreesSitemap.forEach((entree) => {
    if (!vus.has(entree.path)) {
      ecarts.push({
        motif: "page-absente",
        gravite: "erreur",
        chemin: entree.path,
        message:
          "Cette page existe dans les données mais pas dans le sitemap publié : elle ne sera pas explorée.",
      });
    }
  });

  vus.forEach((occurrences, chemin) => {
    if (occurrences > 1) {
      ecarts.push({
        motif: "doublon",
        gravite: "alerte",
        chemin,
        message: `Cette URL apparaît ${occurrences} fois dans le sitemap : une seule entrée est attendue.`,
      });
    }
    if (!attendus.has(chemin)) {
      ecarts.push({
        motif: "entree-inconnue",
        gravite: "alerte",
        chemin,
        message:
          "Cette URL du sitemap ne correspond à aucune page connue des données : page supprimée ou renommée.",
      });
    }
  });

  // Le registre d'audit doit rester un sous-ensemble du sitemap : une page
  // auditée qui n'est pas générée signifie que le générateur a été oublié.
  pagesPubliques.forEach((page) => {
    if (!attendus.has(page.path)) {
      ecarts.push({
        motif: "page-non-generée",
        gravite: "erreur",
        chemin: page.path,
        message:
          "Cette page figure dans l'audit SEO mais n'est pas produite par le générateur de sitemap.",
      });
    }
  });

  return ecarts;
}