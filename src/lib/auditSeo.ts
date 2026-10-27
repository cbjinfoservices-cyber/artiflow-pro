import { IMAGE_PARTAGE_SITE } from "@/hooks/usePageMeta";
import {
  IMAGE_PARTAGE_ACCESSIBILITE,
  IMAGE_PARTAGE_BIBLIOTHEQUE,
  IMAGE_PARTAGE_CGV,
  IMAGE_PARTAGE_COOKIES,
  IMAGE_PARTAGE_MENTIONS,
  IMAGE_PARTAGE_RGPD,
  IMAGE_PARTAGE_SUJETS,
} from "@/lib/imagesPartage";
import { metiers } from "@/mocks/metiers";
import { villes } from "@/mocks/villes";
import { articles } from "@/mocks/ressources";
import { equipe } from "@/mocks/equipe";
import { parcours } from "@/mocks/parcours";

/** Origine d'un visuel de partage, pour repérer d'un coup d'œil les manques. */
export type SourceVisuel = "dedie" | "site" | "generique" | "photo" | "heros";

/** Groupes de pages affichés et filtrés dans l'audit. */
export type GroupeAudit =
  | "Pages principales"
  | "Métiers du bâtiment"
  | "Villes & zones"
  | "Guides Ressources"
  | "Équipe & auteurs"
  | "Parcours guidés"
  | "Pages légales";

export type EntreeAudit = {
  /** Chemin public de la page. */
  path: string;
  /** Libellé court affiché dans la liste. */
  label: string;
  /** Groupe logique, utilisé pour les filtres. */
  group: GroupeAudit;
  /** Titre SEO réellement appliqué par la page (<title> / og:title). */
  title: string;
  /** Description SEO réellement appliquée (meta description / og:description). */
  description: string;
  /** Visuel de partage effectivement utilisé (og:image / twitter:image). */
  image: string;
  /** D'où vient ce visuel : dédié, image générique du site, photo, ou image héros. */
  source: SourceVisuel;
};

const GENERIQUE = IMAGE_PARTAGE_SITE;

/** Pages fixes du site public (titre et description repris de chaque page). */
const pagesPrincipales: EntreeAudit[] = [
  {
    path: "/",
    label: "Accueil",
    group: "Pages principales",
    title: "ArtiFlow-pro — Assistant IA pour artisans du bâtiment",
    description:
      "ArtiFlow-pro, le SaaS IA des artisans du bâtiment : devis en 2 minutes, relances SMS et WhatsApp automatiques, planning et suivi de chantier.",
    image: GENERIQUE,
    source: "site",
  },
  {
    path: "/zones-intervention",
    label: "Zones d'intervention (hub)",
    group: "Pages principales",
    title: "Zones d'intervention · ArtiFlow-pro partout en France",
    description:
      "ArtiFlow-pro accompagne les artisans du bâtiment partout en France, avec une page dédiée à chacune de ses douze villes : Paris, Lyon, Marseille et Toulouse.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20a%20stylized%20map%20of%20France%20with%20connected%20city%20nodes%20and%20glowing%20route%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-zones&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/metiers/recapitulatif",
    label: "Métiers (récapitulatif)",
    group: "Pages principales",
    title: "Récapitulatif des métiers du bâtiment | ArtiFlow-pro",
    description:
      "Toutes les fiches métiers d'ArtiFlow-pro : plombier, électricien, maçon, peintre, menuisier, carreleur, couvreur, plaquiste, frigoriste climaticien et installateur photovoltaïque, avec leurs guides.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20a%20grid%20of%20building%20trade%20icons%20and%20tool%20silhouettes%20connected%20by%20thin%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-metiers-recap&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/tarifs",
    label: "Tarifs",
    group: "Pages principales",
    title: "Tarifs ArtiFlow-pro : devis & relances artisans",
    description:
      "Découvrez les tarifs ArtiFlow-pro : Essentiel à 29 €, Pro à 59 € et Entreprise à 99 € par mois. Sans engagement, 14 jours d'essai et devis IA illimités.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20pricing%20tiers%20and%20rising%20value%20curves%20with%20warm%20amber%20and%20deep%20teal%20accents%20on%20a%20charcoal%20background%2C%20elegant%20minimal%20editorial%20banner%2C%20soft%20light%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-tarifs&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/metiers",
    label: "Métiers (hub)",
    group: "Pages principales",
    title: "Métiers du bâtiment : devis & relances | ArtiFlow-pro",
    description:
      "Plombier, électricien, maçon, peintre, menuisier, carreleur, couvreur, plaquiste : les devis, relances et plannings d'ArtiFlow-pro pour chaque corps d'état.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20building%20trade%20tools%20and%20materials%20with%20warm%20amber%20and%20deep%20teal%20lighting%20on%20a%20charcoal%20background%2C%20editorial%20hero%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-metiers&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/ressources",
    label: "Ressources (par métier)",
    group: "Pages principales",
    title: "Ressources artisans : devis, relances | ArtiFlow-pro",
    description:
      "Guides courts et concrets pour les artisans du bâtiment : chiffrage des devis, relances clients et organisation de chantier, par corps d'état.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20stacked%20open%20notebooks%20and%20rolled%20blueprints%20with%20artisan%20tool%20silhouettes%2C%20warm%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ressources&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/ressources/sujets",
    label: "Ressources par sujet",
    group: "Pages principales",
    title: "Ressources par sujet : chiffrage & relances | ArtiFlow-pro",
    description:
      "Explorez les guides ArtiFlow-pro par thème : chiffrage, relances clients et planning, avec un article pour chaque question de métier.",
    image: IMAGE_PARTAGE_SUJETS,
    source: "dedie",
  },
  {
    path: "/ressources/bibliotheque",
    label: "Ma bibliothèque",
    group: "Pages principales",
    title: "Ma bibliothèque : favoris et notes | ArtiFlow-pro",
    description:
      "Retrouvez en un seul endroit tous vos guides mis en favori et vos notes personnelles, avec recherche unifiée et édition rapide des notes.",
    image: IMAGE_PARTAGE_BIBLIOTHEQUE,
    source: "dedie",
  },
  {
    path: "/plan-du-site",
    label: "Plan du site",
    group: "Pages principales",
    title: "Plan du site ArtiFlow-pro · Pages, métiers et guides",
    description:
      "Retrouvez toutes les pages d'ArtiFlow-pro au même endroit : les métiers du bâtiment, les 20 guides, les tarifs et les ressources par sujet.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20representing%20a%20website%20sitemap%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20connected%20node%20and%20grid%20shapes%2C%20blueprint%20lines%20on%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20premium%20clean%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-plan&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/contact",
    label: "Contact",
    group: "Pages principales",
    title: "Contact ArtiFlow-pro · Parler à un conseiller artisan",
    description:
      "Contactez ArtiFlow-pro par téléphone, WhatsApp ou email. Une équipe qui connaît le bâtiment vous répond sous 24 heures ouvrées pour vous aider à démarrer.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20friendly%20customer%20support%20moment%20for%20an%20artisan%20SaaS%2C%20telephone%20headset%20and%20craftsman%20tools%20resting%20on%20a%20wooden%20desk%20with%20warm%20orange%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-contact&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/a-propos",
    label: "À propos",
    group: "Pages principales",
    title: "À propos d'ArtiFlow-pro : l'équipe des artisans",
    description:
      "Découvrez l'équipe d'ArtiFlow-pro : des anciens du bâtiment et des passionnés de technologie qui rendent du temps aux artisans, chaque jour.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20a%20collaborative%20team%20of%20builders%20and%20software%20makers%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20and%20tool%20silhouettes%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-apropos&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/podcast",
    label: "Podcast & médias",
    group: "Pages principales",
    title: "Podcast & médias ArtiFlow-pro · L'équipe sur les ondes",
    description:
      "Écoutez les interviews de l'équipe ArtiFlow-pro dans les podcasts et médias du bâtiment : chiffrage par IA, RGPD, produit et croissance.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20scene%20suggesting%20a%20podcast%20studio%20about%20construction%20software%2C%20a%20microphone%20silhouette%20with%20sound%20waves%20and%20subtle%20blueprint%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-podcast&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/nouveautes",
    label: "Nouveautés",
    group: "Pages principales",
    title: "Nouveautés ArtiFlow-pro · Journal des mises à jour",
    description:
      "Suivez les nouveautés d'ArtiFlow-pro : devis, relances, planning, comptabilité et offres. Le journal des mises à jour, transparent et mis à jour régulièrement.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20about%20product%20updates%20and%20changelog%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20rocket%20and%20spark%20shapes%2C%20stacked%20card%20silhouettes%2C%20blueprint%20lines%20on%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-nouveautes&orientation=landscape",
    source: "dedie",
  },
  {
    path: "/nous-rejoindre",
    label: "Nous rejoindre",
    group: "Pages principales",
    title: "Nous rejoindre · Carrières ArtiFlow-pro",
    description:
      "Rejoignez l'équipe ArtiFlow-pro : postes ouverts en tech, data, support et croissance. Impact concret, équipe à taille humaine, candidature en 5 minutes.",
    image:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20about%20joining%20a%20small%20tech%20team%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20people%20and%20handshake%20silhouettes%2C%20blueprint%20line%20patterns%2C%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20premium%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-rejoindre&orientation=landscape",
    source: "dedie",
  },
];

/** Pages juridiques (chacune dispose de son propre visuel de partage). */
const pagesLegales: EntreeAudit[] = [
  {
    path: "/mentions-legales",
    label: "Mentions légales",
    group: "Pages légales",
    title: "Mentions légales et éditeur du site · ArtiFlow-pro",
    description:
      "Mentions légales du site ArtiFlow-pro : éditeur, directeur de la publication, hébergement, propriété intellectuelle et conditions d'utilisation.",
    image: IMAGE_PARTAGE_MENTIONS,
    source: "dedie",
  },
  {
    path: "/cgv",
    label: "CGV & CGU",
    group: "Pages légales",
    title: "CGV & CGU : conditions générales de vente · ArtiFlow-pro",
    description:
      "Conditions générales de vente et d'utilisation d'ArtiFlow-pro : abonnements, tarifs, paiement, renouvellement, résiliation, rétractation et responsabilité.",
    image: IMAGE_PARTAGE_CGV,
    source: "dedie",
  },
  {
    path: "/rgpd",
    label: "RGPD & données",
    group: "Pages légales",
    title: "RGPD et données personnelles : vos droits · ArtiFlow-pro",
    description:
      "Politique de confidentialité d'ArtiFlow-pro : données traitées, finalités, durées de conservation, cookies et exercice de vos droits RGPD.",
    image: IMAGE_PARTAGE_RGPD,
    source: "dedie",
  },
  {
    path: "/cookies",
    label: "Politique de cookies",
    group: "Pages légales",
    title: "Politique de cookies et traceurs du site · ArtiFlow-pro",
    description:
      "Politique de cookies d'ArtiFlow-pro : cookies strictement nécessaires, mesure d'audience, finalités, durées de conservation et gestion des préférences.",
    image: IMAGE_PARTAGE_COOKIES,
    source: "dedie",
  },
  {
    path: "/accessibilite",
    label: "Accessibilité",
    group: "Pages légales",
    title: "Déclaration d'accessibilité numérique WCAG · ArtiFlow-pro",
    description:
      "Déclaration d'accessibilité d'ArtiFlow-pro : engagement, niveau de conformité, mesures mises en place et contact pour signaler un problème d'accessibilité.",
    image: IMAGE_PARTAGE_ACCESSIBILITE,
    source: "dedie",
  },
];

/** Pages dynamiques dérivées des données (métiers, guides, auteurs, parcours). */
const pagesMetiers: EntreeAudit[] = metiers.map((metier) => ({
  path: `/metiers/${metier.slug}`,
  label: metier.name,
  group: "Métiers du bâtiment",
  title: metier.title,
  description: metier.metaDescription,
  image: metier.ogImage ?? metier.heroImage,
  source: metier.ogImage ? "dedie" : "heros",
}));

const pagesVilles: EntreeAudit[] = villes.map((ville) => ({
  path: `/zones-intervention/${ville.slug}`,
  label: `${ville.name} · ${ville.departement}`,
  group: "Villes & zones",
  title: ville.metaTitle,
  description: ville.metaDescription,
  image: ville.shareImage,
  source: "dedie",
}));

const pagesGuides: EntreeAudit[] = articles.map((article) => {
  const metier = metiers.find((m) => m.slug === article.category);
  return {
    // Un guide peut vivre sur sa propre page (href) plutôt que sur /ressources/:slug :
    // on audite l'URL canonique réellement servie.
    path: article.href ?? `/ressources/${article.slug}`,
    label: article.title,
    group: "Guides Ressources",
    title: article.seoTitle ?? `${article.title} | ArtiFlow-pro`,
    description: article.excerpt,
    image: article.shareImage ?? metier?.heroImage ?? GENERIQUE,
    source: article.shareImage ? "dedie" : metier?.heroImage ? "heros" : "generique",
  };
});

const pagesAuteurs: EntreeAudit[] = equipe.map((membre) => ({
  path: `/auteurs/${membre.id}`,
  label: membre.name,
  group: "Équipe & auteurs",
  title: membre.seoTitre ?? `${membre.name} · ${membre.role} chez ArtiFlow-pro`,
  description: membre.seoDescription,
  image: membre.shareImage ?? membre.photo,
  source: membre.shareImage ? "dedie" : "photo",
}));

const pagesParcours: EntreeAudit[] = parcours.map((p) => ({
  path: `/ressources/parcours/${p.slug}`,
  label: p.name,
  group: "Parcours guidés",
  title: `${p.name} · Parcours ArtiFlow-pro`,
  description: p.description,
  image: p.shareImage,
  source: "dedie",
}));

/** Ordre d'affichage des groupes dans l'audit. */
export const GROUPES_AUDIT: GroupeAudit[] = [
  "Pages principales",
  "Métiers du bâtiment",
  "Villes & zones",
  "Guides Ressources",
  "Équipe & auteurs",
  "Parcours guidés",
  "Pages légales",
];

/** Registre complet des pages publiques auditées. */
export const pagesPubliques: EntreeAudit[] = [
  ...pagesPrincipales,
  ...pagesMetiers,
  ...pagesVilles,
  ...pagesGuides,
  ...pagesAuteurs,
  ...pagesParcours,
  ...pagesLegales,
];

/** Libellé lisible d'une source de visuel. */
export const LIBELLE_SOURCE: Record<SourceVisuel, string> = {
  dedie: "Visuel dédié",
  site: "Visuel de marque du site",
  generique: "Visuel générique",
  photo: "Photo de profil",
  heros: "Image héros",
};

/** Vrai si le visuel de partage est l'image générique (manque à combler). */
export function estGenerique(entree: EntreeAudit): boolean {
  return entree.source === "generique";
}

/**
 * Vrai si la page n'a **pas** de visuel de partage réellement dédié : elle
 * retombe sur l'image générique du site, une image héros (format paysage non
 * pensé pour le partage) ou une photo de profil. Sert au filtre de l'audit pour
 * repérer toutes les pages dont le visuel de partage reste à produire.
 */
export function sansVisuelDedie(entree: EntreeAudit): boolean {
  // L'accueil assume explicitement le visuel de marque du site : ce n'est pas
  // un oubli, donc il ne doit pas apparaître dans les pages « à compléter ».
  if (entree.source === "site") return false;
  return entree.source !== "dedie";
}

/**
 * Nombre de pages publiques qui retombent encore sur l'image générique du site,
 * c'est-à-dire dont le visuel de partage reste à compléter. Sert notamment à la
 * pastille d'alerte affichée sur le raccourci « Audit SEO » du back-office.
 */
export function compterVisuelsManquants(): number {
  return pagesPubliques.filter(estGenerique).length;
}