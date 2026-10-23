import { pagesPubliques, type EntreeAudit } from "@/lib/auditSeo";

/**
 * Contrôle des métadonnées SEO : longueur des titres et des descriptions, et
 * doublons d'une page à l'autre.
 *
 * L'audit affichait déjà titre et description, mais il fallait les copier
 * ailleurs pour compter les caractères et repérer une description recopiée.
 * Ces fonctions donnent la mesure exacte et les doublons, pour que l'étape 9 de
 * la checklist se vérifie directement dans l'écran.
 */

/** Limites éditoriales appliquées aux pages publiques. */
export const LIMITES_META = {
  /** Au-delà, Google tronque le titre dans les résultats. */
  titreMax: 60,
  /** En dessous, la description est trop courte pour être utile. */
  descriptionMin: 120,
  /** Au-delà, la description est coupée dans les résultats. */
  descriptionMax: 160,
} as const;

/** État d'une valeur par rapport à sa plage attendue. */
export type EtatMesure = "ok" | "court" | "long";

/** Mesure d'une chaîne : longueur réelle, plage attendue et état. */
export type Mesure = {
  longueur: number;
  min: number;
  max: number;
  etat: EtatMesure;
  /** Libellé court du type « 58/60 ». */
  libelle: string;
};

function mesurer(valeur: string, min: number, max: number): Mesure {
  const longueur = (valeur ?? "").trim().length;
  const etat: EtatMesure = longueur > max ? "long" : longueur < min ? "court" : "ok";
  return { longueur, min, max, etat, libelle: `${longueur}/${max}` };
}

/** Mesure d'un titre SEO (plafond 60 caractères, sans minimum). */
export function mesurerTitre(titre: string): Mesure {
  return mesurer(titre, 1, LIMITES_META.titreMax);
}

/** Mesure d'une description SEO (plage 120–160 caractères). */
export function mesurerDescription(description: string): Mesure {
  return mesurer(description, LIMITES_META.descriptionMin, LIMITES_META.descriptionMax);
}

/** Vrai si l'un des deux champs sort de sa plage. */
export function metadonneesHorsLimites(entree: EntreeAudit): boolean {
  return (
    mesurerTitre(entree.title).etat !== "ok" ||
    mesurerDescription(entree.description).etat !== "ok"
  );
}

/** Nombre de pages dont le titre ou la description sort de sa plage. */
export function compterMetadonneesHorsLimites(
  entrees: EntreeAudit[] = pagesPubliques
): number {
  return entrees.filter(metadonneesHorsLimites).length;
}

/** Type d'écart signalé par le garde-fou des métadonnées. */
export type TypeEcartMeta =
  | "doublon-titre"
  | "doublon-description"
  | "titre-hors-limite"
  | "description-hors-plage";

/** Un écart de métadonnées, seul ou partagé entre plusieurs pages. */
export type EcartMeta = {
  type: TypeEcartMeta;
  gravite: "erreur" | "alerte";
  /** Chemins concernés (un seul pour un problème de longueur). */
  chemins: string[];
  /** Libellés lisibles des pages concernées. */
  libelles: string[];
  /** Valeur fautive, tronquée à l'affichage. */
  valeur: string;
  message: string;
};

/** Normalise une chaîne pour comparer deux pages sans bruit typographique. */
function normaliser(valeur: string): string {
  return valeur.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

/** Raccourcit une valeur pour l'affichage dans la liste. */
export function valeurCourte(valeur: string, longueur = 110): string {
  const propre = valeur.trim().replace(/\s+/g, " ");
  return propre.length <= longueur ? propre : `${propre.slice(0, longueur - 1)}…`;
}

/**
 * Regroupe les pages qui partagent exactement le même titre ou la même
 * description (après normalisation des espaces et de la casse).
 */
function regrouper(
  entrees: EntreeAudit[],
  extraire: (entree: EntreeAudit) => string
): Map<string, EntreeAudit[]> {
  const groupes = new Map<string, EntreeAudit[]>();
  entrees.forEach((entree) => {
    const cle = normaliser(extraire(entree));
    if (!cle) return;
    const liste = groupes.get(cle) ?? [];
    liste.push(entree);
    groupes.set(cle, liste);
  });
  return groupes;
}

/**
 * Contrôle complet des métadonnées : doublons d'abord (ils expliquent souvent
 * plusieurs alertes de longueur), puis les valeurs hors plage page par page.
 * Liste vide = tout est propre.
 */
export function verifierMetadonnees(
  entrees: EntreeAudit[] = pagesPubliques
): EcartMeta[] {
  const ecarts: EcartMeta[] = [];

  regrouper(entrees, (entree) => entree.title).forEach((liste, cle) => {
    if (liste.length < 2) return;
    const original = liste.find((entree) => normaliser(entree.title) === cle);
    ecarts.push({
      type: "doublon-titre",
      gravite: "erreur",
      chemins: liste.map((entree) => entree.path),
      libelles: liste.map((entree) => entree.label),
      valeur: original?.title ?? liste[0].title,
      message: `${liste.length} pages partagent le même titre : Google ne sait plus laquelle afficher, et elles se concurrencent entre elles.`,
    });
  });

  regrouper(entrees, (entree) => entree.description).forEach((liste, cle) => {
    if (liste.length < 2) return;
    const original = liste.find((entree) => normaliser(entree.description) === cle);
    ecarts.push({
      type: "doublon-description",
      gravite: "alerte",
      chemins: liste.map((entree) => entree.path),
      libelles: liste.map((entree) => entree.label),
      valeur: original?.description ?? liste[0].description,
      message: `${liste.length} pages partagent la même description : l'une d'elles a visiblement été recopiée de l'autre.`,
    });
  });

  entrees.forEach((entree) => {
    const titre = mesurerTitre(entree.title);
    if (titre.etat !== "ok") {
      ecarts.push({
        type: "titre-hors-limite",
        gravite: "alerte",
        chemins: [entree.path],
        libelles: [entree.label],
        valeur: entree.title,
        message: `Titre de ${titre.longueur} caractères : au-delà de ${LIMITES_META.titreMax}, il sera tronqué dans les résultats de recherche.`,
      });
    }

    const description = mesurerDescription(entree.description);
    if (description.etat !== "ok") {
      ecarts.push({
        type: "description-hors-plage",
        gravite: "alerte",
        chemins: [entree.path],
        libelles: [entree.label],
        valeur: entree.description,
        message:
          description.etat === "court"
            ? `Description de ${description.longueur} caractères : en dessous de ${LIMITES_META.descriptionMin}, elle laisse de la place perdue dans les résultats.`
            : `Description de ${description.longueur} caractères : au-delà de ${LIMITES_META.descriptionMax}, la fin est coupée dans les résultats.`,
      });
    }
  });

  return ecarts;
}

/** Synthèse d'affichage du garde-fou des métadonnées. */
export type ResumeMeta = {
  erreurs: number;
  alertes: number;
  total: number;
  doublonsTitre: number;
  doublonsDescription: number;
  horsLimites: number;
  conforme: boolean;
};

/** Compte les écarts de métadonnées par nature. */
export function resumerMetadonnees(ecarts: EcartMeta[]): ResumeMeta {
  const erreurs = ecarts.filter((ecart) => ecart.gravite === "erreur").length;
  return {
    erreurs,
    alertes: ecarts.length - erreurs,
    total: ecarts.length,
    doublonsTitre: ecarts.filter((ecart) => ecart.type === "doublon-titre").length,
    doublonsDescription: ecarts.filter((ecart) => ecart.type === "doublon-description").length,
    horsLimites: ecarts.filter(
      (ecart) => ecart.type === "titre-hors-limite" || ecart.type === "description-hors-plage"
    ).length,
    conforme: ecarts.length === 0,
  };
}