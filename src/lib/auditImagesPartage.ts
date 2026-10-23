import { IMAGE_PARTAGE_SITE } from "@/hooks/usePageMeta";
import { pagesPubliques, type EntreeAudit } from "@/lib/auditSeo";

/**
 * Garde-fou des visuels de partage.
 *
 * L'aperçu d'un lien dépend de trois déclarations distinctes qui doivent
 * pointer vers le même fichier :
 *
 *  1. les balises `og:image` / `twitter:image` du HTML servi (`index.html`) ;
 *  2. l'image de repli appliquée par le routeur quand une page n'a pas de
 *     visuel propre (`IMAGE_PARTAGE_SITE` dans `usePageMeta.ts`) ;
 *  3. l'entrée `<image:loc>` de l'accueil dans `public/sitemap.xml`.
 *
 * Ces trois fichiers ne partagent aucune constante : si l'image des Réglages
 * SEO change et qu'un seul des trois est mis à jour, l'écart est silencieux.
 * Les constantes ci-dessous rejouent donc ces déclarations, et le contrôle
 * compare les trois au registre des pages publiques.
 */

/** Image déclarée dans le `<head>` devenu statique (`index.html`). */
export const IMAGE_HEAD_INDEX =
  "https://public.readdy.ai/ai/img_res/8e3ba55f81d58fbfb413ad69b5686b01.webp";

/** Image déclarée pour l'accueil dans `public/sitemap.xml`. */
export const IMAGE_SITEMAP_ACCUEIL =
  "https://public.readdy.ai/ai/img_res/8e3ba55f81d58fbfb413ad69b5686b01.webp";

/**
 * Fragments d'URL des visuels retirés du site. Une page qui les référence
 * encore déclare une image que plus personne ne sert.
 */
export const IMAGES_OBSOLETES = ["artiflow-og-2", "artiflow-og-accueil"];

/** Gravité d'un écart : bloquant pour le partage, ou simple incohérence. */
export type GraviteEcart = "erreur" | "alerte";

/** Un écart entre l'image déclarée par une page et celle réellement servie. */
export type EcartImage = {
  /** Identifiant de la déclaration fautive : un chemin public ou un fichier. */
  chemin: string;
  /** Libellé lisible (nom de la page, ou emplacement de la déclaration). */
  libelle: string;
  /** Image telle que déclarée. */
  declaree: string;
  /** Image attendue, c'est-à-dire celle qui est réellement servie. */
  attendue: string;
  gravite: GraviteEcart;
  /** Code court du contrôle, utile pour filtrer ou tester. */
  motif:
    | "entete-desalignee"
    | "sitemap-desaligne"
    | "url-invalide"
    | "visuel-obsolete"
    | "generique-desaligne"
    | "faux-dedie"
    | "visuel-partage";
  message: string;
};

/** Vrai si l'URL est absolue et servie en HTTPS (exigence des robots sociaux). */
function estUrlAbsolueHttps(url: string): boolean {
  return /^https:\/\/[^\s]+$/.test(url.trim());
}

/** Raccourcit une URL pour l'affichage dans la liste des écarts. */
export function urlCourte(url: string, longueur = 58): string {
  if (url.length <= longueur) return url;
  return `${url.slice(0, longueur - 1)}…`;
}

/**
 * Contrôle de cohérence des visuels de partage.
 *
 * Renvoie la liste des écarts détectés entre ce que le code déclare et le
 * fichier réellement servi aux robots sociaux. Liste vide = tout est aligné.
 */
export function verifierImagesPartage(
  entrees: EntreeAudit[] = pagesPubliques
): EcartImage[] {
  const ecarts: EcartImage[] = [];

  if (IMAGE_HEAD_INDEX !== IMAGE_PARTAGE_SITE) {
    ecarts.push({
      chemin: "index.html",
      libelle: "Balises og:image / twitter:image du HTML servi",
      declaree: IMAGE_HEAD_INDEX,
      attendue: IMAGE_PARTAGE_SITE,
      gravite: "erreur",
      motif: "entete-desalignee",
      message:
        "Le <head> statique annonce une autre image que l'image de marque : les robots sociaux reçoivent un visuel différent de celui du code.",
    });
  }

  if (IMAGE_SITEMAP_ACCUEIL !== IMAGE_PARTAGE_SITE) {
    ecarts.push({
      chemin: "public/sitemap.xml",
      libelle: "Image déclarée pour l'accueil dans le sitemap",
      declaree: IMAGE_SITEMAP_ACCUEIL,
      attendue: IMAGE_PARTAGE_SITE,
      gravite: "alerte",
      motif: "sitemap-desaligne",
      message:
        "Le sitemap annonce une autre image que les balises de partage : Google Images indexe un visuel que les réseaux sociaux ne voient pas.",
    });
  }

  entrees.forEach((entree) => {
    const declaree = (entree.image ?? "").trim();

    if (!estUrlAbsolueHttps(declaree)) {
      ecarts.push({
        chemin: entree.path,
        libelle: entree.label,
        declaree: declaree || "(vide)",
        attendue: IMAGE_PARTAGE_SITE,
        gravite: "erreur",
        motif: "url-invalide",
        message:
          "L'image n'est pas une URL absolue en HTTPS : la plupart des plateformes refusent alors l'aperçu.",
      });
      return;
    }

    const obsolete = IMAGES_OBSOLETES.find((fragment) => declaree.includes(fragment));
    if (obsolete) {
      ecarts.push({
        chemin: entree.path,
        libelle: entree.label,
        declaree,
        attendue: IMAGE_PARTAGE_SITE,
        gravite: "erreur",
        motif: "visuel-obsolete",
        message: `La page déclare encore un visuel retiré (${obsolete}) alors que le site sert l'image de marque.`,
      });
      return;
    }

    if (
      (entree.source === "generique" || entree.source === "site") &&
      declaree !== IMAGE_PARTAGE_SITE
    ) {
      ecarts.push({
        chemin: entree.path,
        libelle: entree.label,
        declaree,
        attendue: IMAGE_PARTAGE_SITE,
        gravite: "alerte",
        motif: "generique-desaligne",
        message:
          "La page est déclarée sur le visuel du site, mais pointe vers un autre fichier : l'aperçu réel ne correspond pas à l'audit.",
      });
    }

    if (entree.source === "dedie" && declaree === IMAGE_PARTAGE_SITE) {
      ecarts.push({
        chemin: entree.path,
        libelle: entree.label,
        declaree,
        attendue: IMAGE_PARTAGE_SITE,
        gravite: "alerte",
        motif: "faux-dedie",
        message:
          "La page est marquée « visuel dédié » mais réutilise l'image de marque : soit le visuel dédié a été perdu, soit le libellé est faux.",
      });
    }
  });

  // Deux pages différentes ne devraient pas se partager le même visuel dédié :
  // c'est le signe d'une copie de URL d'une page à l'autre.
  const parVisuel = new Map<string, EntreeAudit[]>();
  entrees
    .filter((entree) => entree.source === "dedie")
    .forEach((entree) => {
      const cle = entree.image.trim();
      const liste = parVisuel.get(cle) ?? [];
      liste.push(entree);
      parVisuel.set(cle, liste);
    });

  parVisuel.forEach((liste, image) => {
    if (liste.length < 2) return;
    ecarts.push({
      chemin: liste.map((entree) => entree.path).join(", "),
      libelle: liste.map((entree) => entree.label).join(" · "),
      declaree: image,
      attendue: "un visuel distinct par page",
      gravite: "alerte",
      motif: "visuel-partage",
      message: `${liste.length} pages déclarent le même visuel dédié : au moins une a hérité de l'image d'une autre.`,
    });
  });

  return ecarts;
}

/** Synthèse d'affichage du garde-fou. */
export type ResumeEcarts = {
  erreurs: number;
  alertes: number;
  total: number;
  conforme: boolean;
};

/** Compte les écarts par gravité. */
export function resumerEcarts(ecarts: EcartImage[]): ResumeEcarts {
  const erreurs = ecarts.filter((ecart) => ecart.gravite === "erreur").length;
  const alertes = ecarts.length - erreurs;
  return { erreurs, alertes, total: ecarts.length, conforme: ecarts.length === 0 };
}

/** Nombre de pages publiques dont le visuel de partage est cohérent. */
export function compterPagesAlignees(ecarts: EcartImage[]): number {
  const fautives = new Set(
    ecarts
      .filter((ecart) => ecart.chemin.startsWith("/"))
      .map((ecart) => ecart.chemin.split(",")[0].trim())
  );
  return pagesPubliques.filter((entree) => !fautives.has(entree.path)).length;
}