import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";
import { supabase } from "@/lib/supabase";

/**
 * Réglage partagé du délai de rappel des comptes très volatils à recontacter.
 *
 * Le bandeau de rappel du back-office Abonnements signale les comptes très volatils
 * toujours « à recontacter » dont le dernier changement d'offre remonte à plus de N jours.
 * Ce délai (par défaut 7 jours) est réglable depuis l'interface et conservé localement,
 * sur le même modèle que les autres seuils du back-office (santé, taux, encaissement…).
 *
 * Il est AUSSI mémorisé dans le profil (Backend) : le récap hebdomadaire par email,
 * envoyé automatiquement, utilise ainsi exactement le même seuil que l'interface.
 */

/** Clé de mémorisation locale du délai de rappel (en jours). */
export const DELAI_RECONTACT_STORAGE_KEY = "artiflow.abonnements.delai-rappel-recontact";

/** Événement émis quand le délai change, pour synchroniser les composants de la même page. */
export const DELAI_RECONTACT_EVENT = "artiflow:delai-rappel-recontact";

/** Délai de rappel par défaut, en jours. */
export const DELAI_RECONTACT_DEFAUT = 7;

/** Délais de rappel proposés (nombre de jours après le dernier changement d'offre). */
export const DELAIS_RECONTACT = [3, 5, 7, 14, 21, 30];

/** Clé de mémorisation locale de l'activation du récap hebdomadaire par email. */
export const RECAP_HEBDO_STORAGE_KEY = "artiflow.abonnements.recap-hebdo-actif";

/** Événement émis quand l'activation du récap hebdomadaire change. */
export const RECAP_HEBDO_EVENT = "artiflow:recap-hebdo-actif";

/** Le récap hebdomadaire est activé par défaut. */
export const RECAP_HEBDO_DEFAUT = true;

/** Cadence du récap hebdomadaire (en jours), utilisée pour estimer le prochain envoi. */
export const CADENCE_RECAP_JOURS = 7;

/** Clé de mémorisation locale du jour d'envoi du récap hebdomadaire (0 = dimanche … 6 = samedi). */
export const RECAP_JOUR_STORAGE_KEY = "artiflow.abonnements.recap-jour";

/** Clé de mémorisation locale de l'heure d'envoi du récap hebdomadaire. */
export const RECAP_HEURE_STORAGE_KEY = "artiflow.abonnements.recap-heure";

/** Clé de mémorisation locale du seuil d'alerte sur le taux de recontact après récap. */
export const RECAP_TAUX_ALERTE_STORAGE_KEY = "artiflow.abonnements.recap-taux-alerte";

/** Événement émis quand la cadence (jour/heure) du récap change. */
export const RECAP_CADENCE_EVENT = "artiflow:recap-cadence";

/** Événement émis quand le seuil d'alerte du taux de recontact change. */
export const RECAP_TAUX_ALERTE_EVENT = "artiflow:recap-taux-alerte";

/** Jours d'envoi proposés (valeur = `Date.getDay()`, du lundi au dimanche). */
export const RECAP_JOURS: { value: number; label: string }[] = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

/** Heures d'envoi proposées. */
export const RECAP_HEURES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20];

/** Jour d'envoi par défaut (lundi). */
export const RECAP_JOUR_DEFAUT = 1;

/** Heure d'envoi par défaut (8 h). */
export const RECAP_HEURE_DEFAUT = 8;

/** Seuils d'alerte proposés pour le taux de recontact après récap (en %). */
export const RECAP_TAUX_ALERTES = [10, 20, 30, 40, 50];

/** Seuil d'alerte par défaut (20 %). */
export const RECAP_TAUX_ALERTE_DEFAUT = 20;

/** Plage de dates affichée dans l'historique des récaps. */
export type RecapHistoPeriode = "tout" | "30j" | "90j";

/** Clé de mémorisation locale de la plage de dates choisie dans l'historique des récaps. */
export const RECAP_HISTO_PERIODE_STORAGE_KEY = "artiflow.abonnements.recap-histo-periode";

/** Événement émis quand la plage de dates de l'historique change. */
export const RECAP_HISTO_PERIODE_EVENT = "artiflow:recap-histo-periode";

/** Plages de dates proposées pour filtrer l'historique des récaps. */
export const RECAP_HISTO_PERIODES: { key: RecapHistoPeriode; label: string; jours: number | null }[] = [
  { key: "tout", label: "Tout", jours: null },
  { key: "30j", label: "30 jours", jours: 30 },
  { key: "90j", label: "90 jours", jours: 90 },
];

/** Plage de dates par défaut (tout l'historique). */
export const RECAP_HISTO_PERIODE_DEFAUT: RecapHistoPeriode = "tout";

/**
 * Nombre de mois affichés dans le mini-graphe des alertes email envoyées « par mois ».
 * Réglable (3 / 6 / 12) et mémorisé comme le filtre de période de la liste, pour retrouver
 * la même fenêtre à la prochaine visite.
 */
export const RECAP_ALERTES_GRAPHE_MOIS_STORAGE_KEY = "artiflow.abonnements.alertes-graphe-mois";

/** Événement émis quand la fenêtre (en mois) du mini-graphe des alertes change. */
export const RECAP_ALERTES_GRAPHE_MOIS_EVENT = "artiflow:alertes-graphe-mois";

/** Fenêtres (en mois) proposées pour le mini-graphe des alertes. */
export const RECAP_ALERTES_GRAPHE_MOIS_OPTIONS = [3, 6, 12];

/** Fenêtre par défaut du mini-graphe des alertes (6 mois). */
export const RECAP_ALERTES_GRAPHE_MOIS_DEFAUT = 6;

/** Relit la fenêtre (en mois) du mini-graphe des alertes (6 mois par défaut). */
export function lireRecapAlertesGrapheMois(): number {
  try {
    const value = Number(lireBrut(RECAP_ALERTES_GRAPHE_MOIS_STORAGE_KEY));
    if (RECAP_ALERTES_GRAPHE_MOIS_OPTIONS.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_ALERTES_GRAPHE_MOIS_DEFAUT;
}

/** Enregistre la fenêtre (en mois) du mini-graphe des alertes et prévient les composants de la même page. */
export function ecrireRecapAlertesGrapheMois(value: number): void {
  try {
    ecrireBrut(RECAP_ALERTES_GRAPHE_MOIS_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_GRAPHE_MOIS_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Dernière plage de mois sélectionnée sur le mini-graphe des alertes (« AAAA-MM »), mémorisée
 * localement pour la retrouver à la réouverture de la page. Simple préférence d'affichage du filtre.
 */
export const RECAP_ALERTES_MOIS_SEL_STORAGE_KEY = "artiflow.abonnements.alertes-mois-selectionnes";

/** Événement émis quand la plage de mois sélectionnée change. */
export const RECAP_ALERTES_MOIS_SEL_EVENT = "artiflow:alertes-mois-selectionnes";

/** Vrai si une valeur est un mois valide au format « AAAA-MM ». */
function estCleMoisValide(cle: unknown): cle is string {
  return typeof cle === "string" && /^\d{4}-\d{2}$/.test(cle);
}

/** Relit la dernière plage de mois sélectionnée sur le graphe des alertes (vide si aucune). */
export function lireRecapAlertesMoisSelectionnes(): string[] {
  try {
    const brut = lireBrut(RECAP_ALERTES_MOIS_SEL_STORAGE_KEY);
    if (!brut) return [];
    const valeur = JSON.parse(brut);
    if (Array.isArray(valeur)) return valeur.filter(estCleMoisValide).sort();
  } catch {
    /* stockage indisponible ou données illisibles : on ignore */
  }
  return [];
}

/** Enregistre la plage de mois sélectionnée et prévient les composants de la même page. */
export function ecrireRecapAlertesMoisSelectionnes(cles: string[]): void {
  try {
    const valides = cles.filter(estCleMoisValide).sort();
    if (valides.length === 0) supprimer(RECAP_ALERTES_MOIS_SEL_STORAGE_KEY);
    else ecrireBrut(RECAP_ALERTES_MOIS_SEL_STORAGE_KEY, JSON.stringify(valides));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_MOIS_SEL_EVENT, { detail: valides }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * « Oublie » la plage de mois mémorisée localement : supprime la préférence pour qu'elle ne soit
 * plus restaurée à la prochaine ouverture de la page. La sélection courante est gérée par l'appelant.
 */
export function oublierRecapAlertesMoisSelectionnes(): void {
  try {
    supprimer(RECAP_ALERTES_MOIS_SEL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_MOIS_SEL_EVENT, { detail: [] }));
  } catch {
    /* stockage indisponible : rien à oublier */
  }
}

/**
 * Réglage local du format du nom du fichier PNG exporté depuis le mini-graphe des alertes :
 * inclure ou non la plage de mois filtrée dans le nom. Préférence d'affichage purement locale.
 */
export const RECAP_ALERTES_PNG_NOM_PLAGE_STORAGE_KEY = "artiflow.abonnements.alertes-png-nom-plage";

/** Événement émis quand le format du nom du fichier PNG change. */
export const RECAP_ALERTES_PNG_NOM_PLAGE_EVENT = "artiflow:alertes-png-nom-plage";

/** Par défaut, la plage de mois filtrée est incluse dans le nom du fichier PNG. */
export const RECAP_ALERTES_PNG_NOM_PLAGE_DEFAUT = true;

/** Relit le réglage « plage de mois dans le nom du PNG » (activé par défaut). */
export function lireRecapAlertesPngNomPlage(): boolean {
  try {
    const raw = lireBrut(RECAP_ALERTES_PNG_NOM_PLAGE_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_ALERTES_PNG_NOM_PLAGE_DEFAUT;
}

/** Enregistre le format du nom du fichier PNG et prévient les composants de la même page. */
export function ecrireRecapAlertesPngNomPlage(value: boolean): void {
  try {
    ecrireBrut(RECAP_ALERTES_PNG_NOM_PLAGE_STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_PNG_NOM_PLAGE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Réglage local du contenu de l'archive ZIP combinée du graphe des alertes : inclure le fichier CSV,
 * le fichier PNG, ou les deux. Préférence d'affichage purement locale, mémorisée entre les visites.
 */
export const RECAP_ALERTES_ZIP_PARTS_STORAGE_KEY = "artiflow.abonnements.alertes-zip-parts";

/** Événement émis quand le contenu de l'archive ZIP combinée change. */
export const RECAP_ALERTES_ZIP_PARTS_EVENT = "artiflow:alertes-zip-parts";

/** Contenu choisi pour l'archive ZIP combinée : le CSV, le PNG, ou les deux. */
export interface RecapAlertesZipParts {
  csv: boolean;
  png: boolean;
}

/** Par défaut, l'archive ZIP contient le CSV et le PNG. */
export const RECAP_ALERTES_ZIP_PARTS_DEFAUT: RecapAlertesZipParts = { csv: true, png: true };

/** Relit le contenu choisi pour l'archive ZIP combinée (CSV + PNG par défaut). */
export function lireRecapAlertesZipParts(): RecapAlertesZipParts {
  try {
    const raw = lireBrut(RECAP_ALERTES_ZIP_PARTS_STORAGE_KEY);
    if (!raw) return { ...RECAP_ALERTES_ZIP_PARTS_DEFAUT };
    const valeur = JSON.parse(raw);
    const csv = typeof valeur?.csv === "boolean" ? valeur.csv : RECAP_ALERTES_ZIP_PARTS_DEFAUT.csv;
    const png = typeof valeur?.png === "boolean" ? valeur.png : RECAP_ALERTES_ZIP_PARTS_DEFAUT.png;
    // Au moins un fichier doit rester inclus.
    if (!csv && !png) return { ...RECAP_ALERTES_ZIP_PARTS_DEFAUT };
    return { csv, png };
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return { ...RECAP_ALERTES_ZIP_PARTS_DEFAUT };
}

/** Enregistre le contenu de l'archive ZIP combinée et prévient les composants de la même page. */
export function ecrireRecapAlertesZipParts(value: RecapAlertesZipParts): void {
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_PARTS_STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_PARTS_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Mémoire locale des derniers exports ZIP combinés (nom + taille + date), pour retrouver d'un
 * coup d'œil les archives récemment générées sans fouiller ses téléchargements. Seuls les
 * `RECAP_ALERTES_ZIP_HISTO_MAX` derniers exports sont conservés. Préférence purement locale.
 */
export const RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY = "artiflow.abonnements.alertes-zip-histo";

/** Événement émis quand l'historique des exports ZIP change. */
export const RECAP_ALERTES_ZIP_HISTO_EVENT = "artiflow:alertes-zip-histo";

/** Nombre maximum d'exports ZIP mémorisés. */
export const RECAP_ALERTES_ZIP_HISTO_MAX = 3;

/**
 * Un export ZIP mémorisé : nom du fichier, taille (octets), date de génération (ISO) et filtre
 * utilisé (mois sélectionnés ou plage de dates) pour pouvoir le réappliquer d'un clic.
 */
export interface RecapAlertesZipHistoItem {
  /** Nom du fichier ZIP (ex. « alertes-auto-relance-plage-2025-09_2025-11-2026-10-09.zip »). */
  nom: string;
  /** Taille de l'archive en octets. */
  taille: number;
  /** Date de génération de l'archive, au format ISO. */
  date: string;
  /** Mois (« AAAA-MM ») du filtre appliqué à cet export (vide = filtre par plage de dates). */
  cles: string[];
  /** Plage de dates utilisée quand aucun mois n'était filtré (« tout » | « 30j » | « 90j »), sinon vide. */
  periode: string;
  /** Le fichier CSV était-il inclus dans l'archive ? (`undefined` pour les entrées antérieures à ce détail). */
  csv?: boolean;
  /** Le fichier PNG était-il inclus dans l'archive ? (`undefined` pour les entrées antérieures à ce détail). */
  png?: boolean;
  /** Nombre de lignes écrites dans le CSV (aperçu du contenu), ou `undefined` si non mémorisé. */
  lignes?: number;
  /** Mois couverts par le PNG (libellé humain), pour l'aperçu du contenu. */
  mois?: string;
  /** Archive épinglée en favori : conservée en tête de l'historique. */
  epingle?: boolean;
}

/** Relit les derniers exports ZIP mémorisés (du plus récent au plus ancien, 3 au maximum). */
export function lireRecapAlertesZipHistorique(): RecapAlertesZipHistoItem[] {
  try {
    const brut = lireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY);
    if (!brut) return [];
    const valeur = JSON.parse(brut);
    if (!Array.isArray(valeur)) return [];
    return valeur
      .filter((v): v is RecapAlertesZipHistoItem => v && typeof v.nom === "string")
      .map((v) => ({
        nom: String(v.nom),
        taille: Number.isFinite(Number(v.taille)) ? Number(v.taille) : 0,
        date: typeof v.date === "string" ? v.date : "",
        cles: Array.isArray(v.cles) ? (v.cles as unknown[]).filter(estCleMoisValide).sort() : [],
        periode: typeof v.periode === "string" ? v.periode : "",
        csv: typeof v.csv === "boolean" ? v.csv : undefined,
        png: typeof v.png === "boolean" ? v.png : undefined,
        lignes: typeof v.lignes === "number" && Number.isFinite(v.lignes) ? v.lignes : undefined,
        mois: typeof v.mois === "string" && v.mois ? v.mois : undefined,
        epingle: typeof v.epingle === "boolean" ? v.epingle : undefined,
      }))
      .slice(0, RECAP_ALERTES_ZIP_HISTO_MAX);
  } catch {
    /* stockage indisponible ou données illisibles : on ignore */
  }
  return [];
}

/**
 * Ajoute un export ZIP en tête de l'historique (en conservant les `RECAP_ALERTES_ZIP_HISTO_MAX`
 * derniers) et prévient les composants de la même page. Renvoie l'historique mis à jour.
 */
export function ajouterRecapAlertesZipHistorique(item: RecapAlertesZipHistoItem): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  // On retire un éventuel doublon (même nom) pour ne pas le compter deux fois.
  const suivant = [item, ...courant.filter((h) => h.nom !== item.nom)].slice(0, RECAP_ALERTES_ZIP_HISTO_MAX);
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Remplace le nom du dernier export mémorisé (après un renommage), sans toucher à sa taille ni à
 * sa date. Renvoie l'historique mis à jour.
 */
export function renommerRecapAlertesZipHistorique(
  nouveauNom: string,
  ancienNom: string,
): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  const suivant = courant.map((h) => (h.nom === ancienNom ? { ...h, nom: nouveauNom } : h));
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Remplace le nom du dernier export mémorisé (après un renommage), sans toucher à sa taille ni à
 * sa date. Conserve la signature historique ; délègue au renommage générique par nom.
 */
export function renommerDernierRecapAlertesZipHistorique(
  nouveauNom: string,
  ancienNom: string,
): RecapAlertesZipHistoItem[] {
  return renommerRecapAlertesZipHistorique(nouveauNom, ancienNom);
}

/**
 * Épingle / dé-épingle un export ZIP en favori. Une archive épinglée est gardée en tête de
 * l'historique pour rester sous la main. Ne touche ni à la taille, ni à la date, ni au contenu.
 * Renvoie l'historique mis à jour.
 */
export function epinglerRecapAlertesZipHistorique(nom: string, epingle: boolean): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  const suivant = courant.map((h) => (h.nom === nom ? { ...h, epingle } : h));
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Épingle en favori, d'un coup, un ensemble d'archives désignées par leur nom (ex. toutes les
 * archives correspondant à un filtre actif). Les archives non épinglées passent en favori ; les
 * autres restent inchangées. Ne touche ni à la taille, ni à la date, ni au contenu.
 * Renvoie l'historique mis à jour.
 */
export function epinglerPlusieursRecapAlertesZipHistorique(noms: string[]): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  const cible = new Set(noms);
  const suivant = courant.map((h) => (cible.has(h.nom) ? { ...h, epingle: true } : h));
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Dé-épingle en favori, d'un coup, un ensemble d'archives désignées par leur nom (ex. toutes les
 * archives correspondant à un filtre actif). Les archives épinglées repassent en normal ; les
 * autres restent inchangées. Ne touche ni à la taille, ni à la date, ni au contenu.
 * Renvoie l'historique mis à jour.
 */
export function desepinglerPlusieursRecapAlertesZipHistorique(noms: string[]): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  const cible = new Set(noms);
  const suivant = courant.map((h) => (cible.has(h.nom) ? { ...h, epingle: false } : h));
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Dé-épingle d'un coup TOUTES les archives épinglées en favori, pour repartir sur un historique
 * sans favoris. Ne touche ni à la taille, ni à la date, ni au contenu des entrées : seules les
 * épingles sont retirées. Renvoie l'historique mis à jour.
 */
export function toutDesepinglerRecapAlertesZipHistorique(): RecapAlertesZipHistoItem[] {
  const courant = lireRecapAlertesZipHistorique();
  const suivant = courant.map((h) => (h.epingle ? { ...h, epingle: false } : h));
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: suivant }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
  return suivant;
}

/**
 * Vide entièrement l'historique des exports ZIP mémorisés, pour repartir de zéro. Préférence
 * purement locale : le fichier déjà téléchargé par l'utilisateur n'est bien sûr pas supprimé.
 */
export function viderRecapAlertesZipHistorique(): void {
  try {
    supprimer(RECAP_ALERTES_ZIP_HISTO_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_HISTO_EVENT, { detail: [] }));
  } catch {
    /* stockage indisponible : rien à vider */
  }
}

/**
 * Filtres du panneau des exports ZIP (recherche par nom + filtre de dates + raccourci « favoris
 * uniquement »), mémorisés localement pour retrouver la même vue à la prochaine visite.
 * Préférence d'affichage purement locale.
 */
export const RECAP_ALERTES_ZIP_FILTRE_STORAGE_KEY = "artiflow.abonnements.alertes-zip-filtre";

/** Événement émis quand les filtres du panneau des exports ZIP changent. */
export const RECAP_ALERTES_ZIP_FILTRE_EVENT = "artiflow:alertes-zip-filtre";

/** Plage de dates du panneau des exports ZIP. */
export type RecapAlertesZipDate = "tout" | "aujourdhui" | "7j";

/** Filtre par type de contenu du panneau des exports ZIP. */
export type RecapAlertesZipType = "tous" | "csv" | "png" | "lesdeux";

/** Filtres mémorisés du panneau des exports ZIP. */
export interface RecapAlertesZipFiltre {
  /** Recherche texte sur le nom des archives (chaîne vide = aucune recherche). */
  recherche: string;
  /** Filtre par plage de dates. */
  date: RecapAlertesZipDate;
  /** Filtre par type de contenu (tous / CSV seul / PNG seul / les deux). */
  type: RecapAlertesZipType;
  /** Raccourci « favoris uniquement » : n'afficher que les archives épinglées. */
  favorisUniquement: boolean;
  /** Panneau des exports ZIP laissé ouvert (déplié) : restauré tel quel à la prochaine visite. */
  panneauOuvert: boolean;
}

/** Valeurs par défaut des filtres du panneau (aucun filtre actif). */
export const RECAP_ALERTES_ZIP_FILTRE_DEFAUT: RecapAlertesZipFiltre = {
  recherche: "",
  date: "tout",
  type: "tous",
  favorisUniquement: false,
  panneauOuvert: false,
};

/** Vrai si la valeur est une plage de dates valide du panneau des exports ZIP. */
function estRecapAlertesZipDate(v: unknown): v is RecapAlertesZipDate {
  return v === "tout" || v === "aujourdhui" || v === "7j";
}

/** Vrai si la valeur est un filtre par type de contenu valide du panneau des exports ZIP. */
function estRecapAlertesZipType(v: unknown): v is RecapAlertesZipType {
  return v === "tous" || v === "csv" || v === "png" || v === "lesdeux";
}

/** Relit les filtres mémorisés du panneau des exports ZIP (aucun filtre par défaut). */
export function lireRecapAlertesZipFiltre(): RecapAlertesZipFiltre {
  try {
    const brut = lireBrut(RECAP_ALERTES_ZIP_FILTRE_STORAGE_KEY);
    if (!brut) return { ...RECAP_ALERTES_ZIP_FILTRE_DEFAUT };
    const valeur = JSON.parse(brut) as Partial<RecapAlertesZipFiltre> | null;
    return {
      recherche: typeof valeur?.recherche === "string" ? valeur.recherche : "",
      date: estRecapAlertesZipDate(valeur?.date) ? valeur.date : "tout",
      type: estRecapAlertesZipType(valeur?.type) ? valeur.type : "tous",
      favorisUniquement: Boolean(valeur?.favorisUniquement),
      panneauOuvert: Boolean(valeur?.panneauOuvert),
    };
  } catch {
    /* stockage indisponible ou données illisibles : on ignore */
  }
  return { ...RECAP_ALERTES_ZIP_FILTRE_DEFAUT };
}

/** Enregistre les filtres du panneau des exports ZIP et prévient les composants de la même page. */
export function ecrireRecapAlertesZipFiltre(value: RecapAlertesZipFiltre): void {
  try {
    ecrireBrut(RECAP_ALERTES_ZIP_FILTRE_STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(RECAP_ALERTES_ZIP_FILTRE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/** Clé de mémorisation locale du délai d'auto-relance des oubliés (en jours, 0 = désactivée). */
export const RECAP_OUBLIES_AUTO_STORAGE_KEY = "artiflow.abonnements.recap-oublies-auto";

/** Événement émis quand le délai d'auto-relance des oubliés change. */
export const RECAP_OUBLIES_AUTO_EVENT = "artiflow:recap-oublies-auto";

/** Délais proposés pour l'auto-relance des oubliés (en jours). 0 = jamais. */
export const RECAP_OUBLIES_AUTO_JOURS = [0, 7, 14, 30];

/** Libellé d'une option de délai d'auto-relance des oubliés. */
export function libelleOubliesAutoJours(jours: number): string {
  if (!jours) return "Jamais";
  return `Après ${jours} jour${jours > 1 ? "s" : ""}`;
}

/** Auto-relance des oubliés désactivée par défaut. */
export const RECAP_OUBLIES_AUTO_DEFAUT = 0;

/** Clé de mémorisation locale de l'alerte email de l'artisan quand l'auto-relance des oubliés part. */
export const RECAP_OUBLIES_ALERTE_STORAGE_KEY = "artiflow.abonnements.recap-oublies-alerte-email";

/** Événement émis quand le réglage d'alerte email de l'auto-relance change. */
export const RECAP_OUBLIES_ALERTE_EVENT = "artiflow:recap-oublies-alerte-email";

/** L'alerte email à l'artisan est activée par défaut. */
export const RECAP_OUBLIES_ALERTE_DEFAUT = true;

/** Relit le réglage d'alerte email à l'artisan (activé par défaut). */
export function lireRecapOubliesAlerteEmail(): boolean {
  try {
    const raw = lireBrut(RECAP_OUBLIES_ALERTE_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_OUBLIES_ALERTE_DEFAUT;
}

/** Enregistre le réglage d'alerte email et prévient les composants de la même page. */
export function ecrireRecapOubliesAlerteEmail(value: boolean): void {
  try {
    ecrireBrut(RECAP_OUBLIES_ALERTE_STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent(RECAP_OUBLIES_ALERTE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Enregistre le réglage d'alerte email dans le profil (Backend), pour que la tâche planifiée
 * prévienne l'artisan au même titre que l'interface. Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerRecapOubliesAlerteEmailBackend(userId: string, actif: boolean): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_oublies_alerte_email_actif: actif, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/** Relit le délai d'auto-relance des oubliés (0 = jamais par défaut). */
export function lireRecapOubliesAutoJours(): number {
  try {
    const value = Number(lireBrut(RECAP_OUBLIES_AUTO_STORAGE_KEY));
    if (RECAP_OUBLIES_AUTO_JOURS.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_OUBLIES_AUTO_DEFAUT;
}

/** Enregistre le délai d'auto-relance des oubliés et prévient les composants de la même page. */
export function ecrireRecapOubliesAutoJours(value: number): void {
  try {
    ecrireBrut(RECAP_OUBLIES_AUTO_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(RECAP_OUBLIES_AUTO_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Enregistre le délai d'auto-relance des oubliés dans le profil (Backend), pour que la tâche
 * planifiée agisse sur le même réglage que l'interface. `0` désactive l'auto-relance.
 * Best-effort : le réglage local reste appliqué même si le Backend est injoignable.
 */
export async function enregistrerRecapOubliesAutoJoursBackend(userId: string, jours: number): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_oublies_auto_jours: jours, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/** Relit la plage de dates de l'historique des récaps (tout par défaut). */
export function lireRecapHistoPeriode(): RecapHistoPeriode {
  try {
    const raw = lireBrut(RECAP_HISTO_PERIODE_STORAGE_KEY);
    if (RECAP_HISTO_PERIODES.some((p) => p.key === raw)) return raw as RecapHistoPeriode;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_HISTO_PERIODE_DEFAUT;
}

/** Enregistre la plage de dates de l'historique et prévient les composants de la même page. */
export function ecrireRecapHistoPeriode(value: RecapHistoPeriode): void {
  try {
    ecrireBrut(RECAP_HISTO_PERIODE_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(RECAP_HISTO_PERIODE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * Filtre d'origine de l'historique des récaps hebdomadaires : afficher tous les envois, seulement
 * les envois automatiques (planifiés), ou seulement les tests manuels. Mémorisé localement comme
 * les autres préférences du panneau (période, seuil d'alerte…).
 */
export type RecapHistoOrigine = "tous" | "auto" | "test";

/** Clé de mémorisation locale du filtre d'origine de l'historique des récaps. */
export const RECAP_HISTO_ORIGINE_STORAGE_KEY = "artiflow.abonnements.recap-histo-origine";

/** Événement émis quand le filtre d'origine de l'historique des récaps change. */
export const RECAP_HISTO_ORIGINE_EVENT = "artiflow:recap-histo-origine";

/** Valeur par défaut du filtre d'origine (tous les envois). */
export const RECAP_HISTO_ORIGINE_DEFAUT: RecapHistoOrigine = "tous";

/** Vrai si la valeur est un filtre d'origine valide. */
function estRecapHistoOrigine(v: unknown): v is RecapHistoOrigine {
  return v === "tous" || v === "auto" || v === "test";
}

/** Relit le filtre d'origine de l'historique des récaps (tous par défaut). */
export function lireRecapHistoOrigine(): RecapHistoOrigine {
  try {
    const raw = lireBrut(RECAP_HISTO_ORIGINE_STORAGE_KEY);
    if (estRecapHistoOrigine(raw)) return raw;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_HISTO_ORIGINE_DEFAUT;
}

/** Enregistre le filtre d'origine de l'historique et prévient les composants de la même page. */
export function ecrireRecapHistoOrigine(value: RecapHistoOrigine): void {
  try {
    ecrireBrut(RECAP_HISTO_ORIGINE_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(RECAP_HISTO_ORIGINE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/**
 * État ouvert/fermé du menu des filtres d'origine de l'historique des récaps
 * (« Récap automatiques / tests »), mémorisé localement pour le retrouver tel quel à la prochaine
 * visite — comme la plage de dates, le seuil d'alerte et le filtre d'origine. Préférence d'affichage purement locale.
 */
export const RECAP_HISTO_ORIGINE_MENU_STORAGE_KEY = "artiflow.abonnements.recap-histo-origine-menu";

/** Événement émis quand l'état ouvert/fermé du menu des filtres d'origine change. */
export const RECAP_HISTO_ORIGINE_MENU_EVENT = "artiflow:recap-histo-origine-menu";

/** Le menu des filtres d'origine est déplié par défaut. */
export const RECAP_HISTO_ORIGINE_MENU_DEFAUT = true;

/** Relit l'état ouvert/fermé du menu des filtres d'origine (déplié par défaut). */
export function lireRecapHistoOrigineMenuOuvert(): boolean {
  try {
    const raw = lireBrut(RECAP_HISTO_ORIGINE_MENU_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_HISTO_ORIGINE_MENU_DEFAUT;
}

/** Enregistre l'état ouvert/fermé du menu des filtres d'origine et prévient les composants de la même page. */
export function ecrireRecapHistoOrigineMenuOuvert(value: boolean): void {
  try {
    ecrireBrut(RECAP_HISTO_ORIGINE_MENU_STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent(RECAP_HISTO_ORIGINE_MENU_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/** Relit le délai choisi (retombe sur la valeur par défaut si absent ou invalide). */
export function lireDelaiRappelRecontact(): number {
  try {
    const value = Number(lireBrut(DELAI_RECONTACT_STORAGE_KEY));
    if (DELAIS_RECONTACT.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return DELAI_RECONTACT_DEFAUT;
}

/**
 * Enregistre le délai choisi et prévient les composants de la même page
 * (le bandeau de rappel suit ainsi immédiatement le réglage).
 */
export function ecrireDelaiRappelRecontact(value: number): void {
  try {
    ecrireBrut(DELAI_RECONTACT_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(DELAI_RECONTACT_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}

/**
 * Recharge le délai depuis le profil (Backend) et le met en cache localement.
 * Retourne la valeur (jours) si une préférence valide existe, sinon `null`.
 */
export async function chargerDelaiRappelRecontactBackend(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("recontact_rappel_jours")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const value = Number((data as Record<string, unknown>).recontact_rappel_jours);
    if (DELAIS_RECONTACT.includes(value)) {
      try {
        ecrireBrut(DELAI_RECONTACT_STORAGE_KEY, String(value));
      } catch {
        /* stockage indisponible : la valeur reste appliquée en mémoire */
      }
      return value;
    }
  } catch {
    /* silencieux : on garde le réglage local */
  }
  return null;
}

/**
 * Enregistre le délai dans le profil (Backend) afin que le récap hebdomadaire par email
 * utilise la même valeur que l'interface. Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerDelaiRappelRecontactBackend(userId: string, value: number): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_rappel_jours: value, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Relit l'activation du récap hebdomadaire (activée par défaut si aucun choix mémorisé).
 */
export function lireRecapHebdoActif(): boolean {
  try {
    const raw = lireBrut(RECAP_HEBDO_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* stockage indisponible : on retombe sur l'activation par défaut */
  }
  return RECAP_HEBDO_DEFAUT;
}

/**
 * Enregistre l'activation du récap hebdomadaire et prévient les composants de la même page.
 */
export function ecrireRecapHebdoActif(value: boolean): void {
  try {
    ecrireBrut(RECAP_HEBDO_STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent(RECAP_HEBDO_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}

/** Relit le jour d'envoi du récap hebdomadaire (lundi par défaut). */
export function lireRecapJour(): number {
  try {
    const value = Number(lireBrut(RECAP_JOUR_STORAGE_KEY));
    if (RECAP_JOURS.some((j) => j.value === value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_JOUR_DEFAUT;
}

/** Enregistre le jour d'envoi du récap et prévient les composants de la même page. */
export function ecrireRecapJour(value: number): void {
  try {
    ecrireBrut(RECAP_JOUR_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(RECAP_CADENCE_EVENT, { detail: { jour: value } }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/** Relit l'heure d'envoi du récap hebdomadaire (8 h par défaut). */
export function lireRecapHeure(): number {
  try {
    const value = Number(lireBrut(RECAP_HEURE_STORAGE_KEY));
    if (RECAP_HEURES.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_HEURE_DEFAUT;
}

/** Enregistre l'heure d'envoi du récap et prévient les composants de la même page. */
export function ecrireRecapHeure(value: number): void {
  try {
    ecrireBrut(RECAP_HEURE_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(RECAP_CADENCE_EVENT, { detail: { heure: value } }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/** Relit le seuil d'alerte du taux de recontact après récap (20 % par défaut). */
export function lireTauxAlerteRecap(): number {
  try {
    const value = Number(lireBrut(RECAP_TAUX_ALERTE_STORAGE_KEY));
    if (RECAP_TAUX_ALERTES.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return RECAP_TAUX_ALERTE_DEFAUT;
}

/** Enregistre le seuil d'alerte du taux et prévient les composants de la même page. */
export function ecrireTauxAlerteRecap(value: number): void {
  try {
    ecrireBrut(RECAP_TAUX_ALERTE_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(RECAP_TAUX_ALERTE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée */
  }
}

/** Réglages du récap hebdomadaire lus depuis le profil (Backend). */
export interface ReglagesRecapBackend {
  /** Activation mémorisée dans le profil, ou `null` si non renseignée. */
  actif: boolean | null;
  /** Date ISO du dernier envoi automatique, ou `null` si jamais envoyé. */
  dernierEnvoi: string | null;
  /** Jour d'envoi configuré (0 = dimanche … 6 = samedi), ou `null` si non renseigné. */
  jour: number | null;
  /** Heure d'envoi configurée, ou `null` si non renseignée. */
  heure: number | null;
  /** Seuil d'alerte du taux de recontact (%), ou `null` si non renseigné. */
  tauxAlerte: number | null;
  /** Plage de dates mémorisée pour l'historique des récaps, ou `null` si non renseignée. */
  histoPeriode: RecapHistoPeriode | null;
  /** Fenêtre (en mois) mémorisée pour le mini-graphe des alertes, ou `null` si non renseignée. */
  alertesGrapheMois: number | null;
  /** Délai (en jours) d'auto-relance des oubliés, ou `null` si non renseigné. */
  oubliesAutoJours: number | null;
  /** Alerte email à l'artisan quand l'auto-relance des oubliés part, ou `null` si non renseigné. */
  oubliesAlerteEmail: boolean | null;
}

/**
 * Recharge l'activation du récap hebdomadaire et la date du dernier envoi depuis le profil
 * (Backend), et met l'activation en cache localement.
 */
export async function chargerReglagesRecapBackend(userId: string): Promise<ReglagesRecapBackend | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "recontact_rappel_hebdo_actif, recontact_rappel_dernier_envoi, recontact_rappel_hebdo_jour, recontact_rappel_hebdo_heure, recontact_taux_alerte, recontact_histo_periode, recontact_alertes_graphe_mois, recontact_oublies_auto_jours, recontact_oublies_alerte_email_actif",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const actif = typeof row.recontact_rappel_hebdo_actif === "boolean" ? row.recontact_rappel_hebdo_actif : null;
    const dernierEnvoi = row.recontact_rappel_dernier_envoi ? String(row.recontact_rappel_dernier_envoi) : null;
    const jourBrut = Number(row.recontact_rappel_hebdo_jour);
    const heureBrute = Number(row.recontact_rappel_hebdo_heure);
    const seuilBrut = Number(row.recontact_taux_alerte);
    const jour = RECAP_JOURS.some((j) => j.value === jourBrut) ? jourBrut : null;
    const heure = RECAP_HEURES.includes(heureBrute) ? heureBrute : null;
    const tauxAlerte = RECAP_TAUX_ALERTES.includes(seuilBrut) ? seuilBrut : null;
    const periodeBrute = row.recontact_histo_periode ? String(row.recontact_histo_periode) : null;
    const histoPeriode =
      periodeBrute && RECAP_HISTO_PERIODES.some((p) => p.key === periodeBrute)
        ? (periodeBrute as RecapHistoPeriode)
        : null;
    const oubliesAutoBrut = Number(row.recontact_oublies_auto_jours);
    const oubliesAutoJours = RECAP_OUBLIES_AUTO_JOURS.includes(oubliesAutoBrut) ? oubliesAutoBrut : null;
    const alertesGrapheBrut = Number(row.recontact_alertes_graphe_mois);
    const alertesGrapheMois = RECAP_ALERTES_GRAPHE_MOIS_OPTIONS.includes(alertesGrapheBrut) ? alertesGrapheBrut : null;
    const oubliesAlerteEmail =
      typeof row.recontact_oublies_alerte_email_actif === "boolean" ? row.recontact_oublies_alerte_email_actif : null;
    // Mise en cache locale (best-effort) pour rester cohérent avec les autres réglages.
    try {
      if (actif !== null) ecrireBrut(RECAP_HEBDO_STORAGE_KEY, actif ? "true" : "false");
      if (jour !== null) ecrireBrut(RECAP_JOUR_STORAGE_KEY, String(jour));
      if (heure !== null) ecrireBrut(RECAP_HEURE_STORAGE_KEY, String(heure));
      if (tauxAlerte !== null) ecrireBrut(RECAP_TAUX_ALERTE_STORAGE_KEY, String(tauxAlerte));
      if (histoPeriode !== null) ecrireBrut(RECAP_HISTO_PERIODE_STORAGE_KEY, histoPeriode);
      if (alertesGrapheMois !== null) ecrireBrut(RECAP_ALERTES_GRAPHE_MOIS_STORAGE_KEY, String(alertesGrapheMois));
      if (oubliesAutoJours !== null) ecrireBrut(RECAP_OUBLIES_AUTO_STORAGE_KEY, String(oubliesAutoJours));
      if (oubliesAlerteEmail !== null) ecrireBrut(RECAP_OUBLIES_ALERTE_STORAGE_KEY, oubliesAlerteEmail ? "true" : "false");
    } catch {
      /* stockage indisponible : la valeur reste appliquée en mémoire */
    }
    return { actif, dernierEnvoi, jour, heure, tauxAlerte, histoPeriode, alertesGrapheMois, oubliesAutoJours, oubliesAlerteEmail };
  } catch {
    return null;
  }
}

/**
 * Enregistre la cadence du récap (jour + heure) dans le profil (Backend), pour rester
 * cohérent avec la tâche planifiée. Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerCadenceRecapBackend(userId: string, jour: number, heure: number): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({
        recontact_rappel_hebdo_jour: jour,
        recontact_rappel_hebdo_heure: heure,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Enregistre le seuil d'alerte du taux de recontact dans le profil (Backend).
 * Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerTauxAlerteRecapBackend(userId: string, seuil: number): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_taux_alerte: seuil, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Enregistre la plage de dates choisie pour l'historique des récaps dans le profil (Backend).
 * Best-effort : le réglage local reste appliqué, pour retrouver la préférence à la prochaine visite.
 */
export async function enregistrerRecapHistoPeriodeBackend(userId: string, periode: RecapHistoPeriode): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_histo_periode: periode, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Enregistre la fenêtre (en mois) du mini-graphe des alertes dans le profil (Backend),
 * pour retrouver la préférence à la prochaine visite. Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerRecapAlertesGrapheMoisBackend(userId: string, mois: number): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_alertes_graphe_mois: mois, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Enregistre l'activation du récap hebdomadaire dans le profil (Backend) afin que l'envoi
 * automatique respecte le choix de l'interface. Best-effort : le réglage local reste appliqué.
 */
export async function enregistrerRecapHebdoActifBackend(userId: string, value: boolean): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ recontact_rappel_hebdo_actif: value, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* silencieux : le réglage local reste appliqué même si le Backend est injoignable */
  }
}

/**
 * Calcule la prochaine occurrence du créneau d'envoi configuré (jour de la semaine + heure),
 * strictement après `now`. C'est la date affichée comme « prochain récap » selon la cadence choisie.
 */
export function prochainRecapHebdo(jour: number, heure: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(heure);
  const delta = (jour - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Les `nb` prochaines occurrences du créneau d'envoi configuré (jour de la semaine + heure),
 * strictement postérieures à `now`. Sert à afficher les prochains créneaux d'envoi prévus.
 */
export function prochainsRecapsHebdo(jour: number, heure: number, nb = 3, now: Date = new Date()): Date[] {
  const resultats: Date[] = [];
  let curseur = now;
  for (let i = 0; i < nb; i += 1) {
    const suivant = prochainRecapHebdo(jour, heure, curseur);
    resultats.push(suivant);
    curseur = suivant;
  }
  return resultats;
}

/** Une ligne de l'historique des récaps hebdomadaires envoyés. */
export interface RecapRecontactEnvoi {
  id: number;
  /** Date ISO d'envoi automatique. */
  envoyeLe: string;
  /** Nombre de comptes très volatils listés dans l'email. */
  nbComptes: number;
  /** Origine de l'envoi : « auto » (planifié) ou « test » (bouton manuel). */
  origine: "auto" | "test";
  /** Identifiants des comptes listés dans ce récap (pour mesurer l'efficacité). */
  abonnementIds: number[];
  /** Nombre de comptes listés qui ont reçu un recontact APRÈS cet envoi. */
  recontactesApres: number;
  /** Nombre de comptes listés dans ce récap qui ont reçu une relance AUTOMATIQUE (origine « auto ») après l'envoi. */
  autoRelancesApres: number;
  /**
   * Taux d'efficacité (0-100) : part des comptes listés recontactés après l'envoi.
   * `null` quand la mesure n'est pas calculable (aucun compte listé ou ancien envoi
   * sans la liste des comptes).
   */
  tauxApres: number | null;
}

/** Un recontact envoyé (compte concerné + date), utilisé pour mesurer l'efficacité d'un récap. */
interface RecontactEnvoye {
  abonnementId: number;
  createdAt: string;
  /** Origine du recontact : « manuel » (depuis l'interface) ou « auto » (auto-relance des oubliés). */
  origine: string;
}

/**
 * Charge l'historique des récaps hebdomadaires envoyés (du plus récent au plus ancien).
 * Chaque passage planifié de la fonction Backend ajoute une ligne à cet historique.
 * Enrichit chaque envoi avec le taux de comptes recontactés après le récap (efficacité).
 */
export async function chargerHistoriqueRecapRecontact(userId: string, limit = 12): Promise<RecapRecontactEnvoi[]> {
  const [recaps, recontactsRes] = await Promise.all([
    supabase
      .from("recap_recontact_envois")
      .select("id, envoye_le, nb_comptes, origine, abonnement_ids")
      .eq("user_id", userId)
      .order("envoye_le", { ascending: false })
      .limit(limit),
    supabase.from("recontacts_artisans").select("abonnement_id, created_at, origine"),
  ]);
  if (recaps.error) throw new Error(recaps.error.message);

  // Tous les recontacts envoyés (hors recontacts de test sans compte), pour mesurer, par récap,
  // combien de comptes listés ont ensuite reçu un recontact.
  const recontacts: RecontactEnvoye[] = (recontactsRes.data ?? [])
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        abonnementId: Number(row.abonnement_id),
        createdAt: String(row.created_at ?? ""),
        origine: String(row.origine ?? "manuel"),
      };
    })
    .filter((r) => Number.isFinite(r.abonnementId));

  return (recaps.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const envoyeLe = String(row.envoye_le ?? "");
    const rawIds = Array.isArray(row.abonnement_ids) ? (row.abonnement_ids as unknown[]) : [];
    const abonnementIds = rawIds.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    const envoyesLeMs = new Date(envoyeLe).getTime();

    let recontactesApres = 0;
    let autoRelancesApres = 0;
    if (abonnementIds.length > 0 && !Number.isNaN(envoyesLeMs)) {
      const listes = new Set(abonnementIds);
      const touches = new Set<number>();
      const touchesAuto = new Set<number>();
      recontacts.forEach((r) => {
        if (!listes.has(r.abonnementId)) return;
        const t = new Date(r.createdAt).getTime();
        if (Number.isNaN(t) || t <= envoyesLeMs) return;
        touches.add(r.abonnementId);
        if (r.origine === "auto") touchesAuto.add(r.abonnementId);
      });
      recontactesApres = touches.size;
      autoRelancesApres = touchesAuto.size;
    }

    return {
      id: Number(row.id),
      envoyeLe,
      nbComptes: Number(row.nb_comptes ?? 0),
      origine: row.origine === "test" ? "test" : "auto",
      abonnementIds,
      recontactesApres,
      autoRelancesApres,
      tauxApres: abonnementIds.length > 0 ? Math.round((recontactesApres / abonnementIds.length) * 100) : null,
    };
  });
}

/** Recontact minimal nécessaire pour savoir si un compte a été relancé depuis un récap. */
export interface RecontactPourOublies {
  abonnement_id: number | null;
  statut: string;
  created_at: string;
}

/**
 * Identifiants des comptes « oubliés » parmi une liste de récaps : un compte est oublié dès qu'il
 * était listé dans au moins un de ces récaps et qu'il n'a PAS reçu de recontact réussi après
 * la date d'envoi de ce récap. Renvoie l'union sur tous les récaps fournis (dédoublonnée).
 * Réutilisé par la carte d'historique (récaps affichés) et le bandeau du tableau de bord (récaps récents).
 */
export function idsOubliesRecaps(
  recaps: Pick<RecapRecontactEnvoi, "envoyeLe" | "abonnementIds">[],
  recontacts: RecontactPourOublies[],
): Set<number> {
  const oublies = new Set<number>();
  recaps.forEach((recap) => {
    if (recap.abonnementIds.length === 0) return;
    const envoyesLeMs = new Date(recap.envoyeLe).getTime();
    if (Number.isNaN(envoyesLeMs)) return;
    const listes = new Set(recap.abonnementIds);
    const touches = new Set<number>();
    recontacts.forEach((r) => {
      if (r.statut !== "envoye" || r.abonnement_id === null) return;
      if (!listes.has(r.abonnement_id)) return;
      const t = new Date(r.created_at).getTime();
      if (!Number.isNaN(t) && t > envoyesLeMs) touches.add(r.abonnement_id);
    });
    listes.forEach((id) => {
      if (!touches.has(id)) oublies.add(id);
    });
  });
  return oublies;
}

/**
 * Identifiants des comptes qui seront auto-relancés au prochain passage : un compte est dû dès
 * qu'il était listé dans un récap dont le délai d'auto-relance (`autoJours`) est écoulé et qu'il
 * n'a PAS reçu de recontact réussi depuis cet envoi. Sous-ensemble des oubliés, calculé selon le
 * réglage « Relancer les oubliés après N jours ». Renvoie un ensemble vide si l'auto-relance est
 * désactivée (0 = jamais).
 */
export function idsOubliesAutoProchains(
  recaps: Pick<RecapRecontactEnvoi, "envoyeLe" | "abonnementIds">[],
  recontacts: RecontactPourOublies[],
  autoJours: number,
  now: number = Date.now(),
): Set<number> {
  const dus = new Set<number>();
  if (!(autoJours > 0)) return dus;
  const delta = autoJours * 86400000;
  recaps.forEach((recap) => {
    if (recap.abonnementIds.length === 0) return;
    const envoyesLeMs = new Date(recap.envoyeLe).getTime();
    if (Number.isNaN(envoyesLeMs)) return;
    // Le délai n'est pas encore écoulé pour ce récap : rien à relancer tout de suite.
    if (now < envoyesLeMs + delta) return;
    const listes = new Set(recap.abonnementIds);
    const touches = new Set<number>();
    recontacts.forEach((r) => {
      if (r.statut !== "envoye" || r.abonnement_id === null) return;
      if (!listes.has(r.abonnement_id)) return;
      const t = new Date(r.created_at).getTime();
      if (!Number.isNaN(t) && t > envoyesLeMs) touches.add(r.abonnement_id);
    });
    listes.forEach((id) => {
      if (!touches.has(id)) dus.add(id);
    });
  });
  return dus;
}

/** Résultat d'un déclenchement manuel du récap hebdomadaire (envoi de test). */
export interface ResultatRecapMaintenant {
  /** L'email a-t-il réellement pu être envoyé (Resend configuré) ? */
  envoye: boolean;
  /** Nombre de comptes concernés par l'envoi. */
  nbComptes: number;
}

/**
 * Déclenche immédiatement un envoi du récap hebdomadaire pour l'utilisateur connecté
 * (bouton « Envoyer un récap maintenant »). La tentative est toujours journalisée dans
 * l'historique ; l'email n'est réellement envoyé que si Resend est configuré.
 */
export async function declencherRecapHebdoMaintenant(userId: string): Promise<ResultatRecapMaintenant> {
  const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", {
    body: { test: true, userId },
  });
  if (error) throw new Error("L'envoi du récap a échoué. Réessayez.");
  const payload = data as { ok?: boolean; error?: string; sent?: number; count?: number } | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "L'envoi du récap a échoué. Réessayez.");
  }
  return {
    envoye: (payload.sent ?? 0) > 0,
    nbComptes: payload.count ?? 0,
  };
}

/** Résultat d'un déclenchement manuel de l'auto-relance des oubliés « dus ». */
export interface ResultatAutoRelanceMaintenant {
  /** Au moins un email de recontact a-t-il réellement été expédié ? */
  envoye: boolean;
  /** Nombre de relances automatiques réellement expédiées. */
  nbRelances: number;
  /** Nombre de relances en échec. */
  nbEchecs: number;
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configure: boolean;
}

/**
 * Déclenche immédiatement l'auto-relance des oubliés « dus » pour l'utilisateur connecté
 * (bouton « Envoyer maintenant les oubliés dus » du bandeau), sans attendre le passage planifié.
 * Seuls les comptes dont le délai réglé est écoulé sont relancés ; l'opération reste idempotente.
 */
export async function declencherAutoRelanceOubliesMaintenant(
  userId: string,
): Promise<ResultatAutoRelanceMaintenant> {
  const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", {
    body: { autoNow: true, userId },
  });
  if (error) throw new Error("L'envoi des oubliés a échoué. Réessayez.");
  const payload = data as
    | { ok?: boolean; error?: string; autoRelances?: number; autoEchecs?: number; configured?: boolean }
    | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "L'envoi des oubliés a échoué. Réessayez.");
  }
  const nbRelances = Number(payload.autoRelances ?? 0);
  return {
    envoye: nbRelances > 0,
    nbRelances,
    nbEchecs: Number(payload.autoEchecs ?? 0),
    configure: Boolean(payload.configured),
  };
}

/** Aperçu de l'email d'auto-relance : objet + HTML exacts, sans aucun envoi. */
export interface ApercuAutoRelance {
  html: string;
  subject: string;
}

/**
 * Génère l'aperçu de l'email d'auto-relance des oubliés, sans rien envoyer : renvoie l'objet et
 * le HTML exacts qui seraient expédiés. Le brouillon éventuel (sujet/corps non encore enregistrés)
 * est transmis au Backend pour que l'aperçu reflète les modifications en cours de saisie.
 */
export async function apercuAutoRelanceEmail(
  userId: string,
  sujetDraft?: string,
  corpsDraft?: string,
): Promise<ApercuAutoRelance> {
  const body: Record<string, unknown> = { previewAuto: true, userId };
  if (typeof sujetDraft === "string") body.sujetDraft = sujetDraft;
  if (typeof corpsDraft === "string") body.corpsDraft = corpsDraft;
  const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", { body });
  if (error) throw new Error("L'aperçu n'a pas pu être généré. Réessayez.");
  const payload = data as { ok?: boolean; error?: string; html?: string; subject?: string } | null;
  if (!payload || payload.ok === false || !payload.html) {
    throw new Error(payload?.error || "Aperçu indisponible pour l'instant.");
  }
  return { html: String(payload.html), subject: String(payload.subject ?? "") };
}

/**
 * Génère l'aperçu de l'email d'alerte envoyé à l'artisan, sans rien envoyer : renvoie l'objet et
 * le HTML exacts (objet/message personnalisés de l'artisan). Les comptes de l'alerte passée sont
 * réutilisés quand `alertId` est fourni, sinon des comptes d'exemple illustrent le rendu.
 */
export async function apercuAlerteArtisanEmail(userId: string, alertId?: number): Promise<ApercuAutoRelance> {
  const body: Record<string, unknown> = { previewAlerte: true, userId };
  if (typeof alertId === "number" && Number.isFinite(alertId)) body.alertId = alertId;
  const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", { body });
  if (error) throw new Error("L'aperçu n'a pas pu être généré. Réessayez.");
  const payload = data as { ok?: boolean; error?: string; html?: string; subject?: string } | null;
  if (!payload || payload.ok === false || !payload.html) {
    throw new Error(payload?.error || "Aperçu indisponible pour l'instant.");
  }
  return { html: String(payload.html), subject: String(payload.subject ?? "") };
}

/** Une ligne de l'historique des alertes email envoyées à l'artisan (auto-relance des oubliés). */
export interface AlerteAutoRelance {
  id: number;
  /** Date ISO d'envoi de l'alerte. */
  envoyeLe: string;
  /** Nombre de comptes recontactés ce jour-là. */
  nbComptes: number;
  /** Identifiants des comptes concernés (rattachement au parc). */
  abonnementIds: number[];
  /** Détail des comptes concernés (entreprise + email). */
  comptes: { entreprise: string; email: string }[];
}

/**
 * Charge l'historique des alertes email réellement envoyées à l'artisan quand l'auto-relance
 * des oubliés a expédié des relances (date + comptes concernés), du plus récent au plus ancien.
 */
export async function chargerHistoriqueAlertesArtisan(
  userId: string,
  limit = 12,
): Promise<AlerteAutoRelance[]> {
  const { data, error } = await supabase
    .from("recap_alertes_artisan")
    .select("id, envoye_le, nb_comptes, abonnement_ids, comptes")
    .eq("user_id", userId)
    .order("envoye_le", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const rawIds = Array.isArray(row.abonnement_ids) ? (row.abonnement_ids as unknown[]) : [];
    const rawComptes = Array.isArray(row.comptes) ? (row.comptes as Array<Record<string, unknown>>) : [];
    return {
      id: Number(row.id),
      envoyeLe: String(row.envoye_le ?? ""),
      nbComptes: Number(row.nb_comptes ?? 0),
      abonnementIds: rawIds.map((v) => Number(v)).filter((v) => Number.isFinite(v)),
      comptes: rawComptes.map((c) => ({
        entreprise: String(c?.entreprise ?? ""),
        email: String(c?.email ?? ""),
      })),
    };
  });
}

/** Résultat du rejeu d'une alerte artisan depuis l'historique. */
export interface ResultatRejeuAlerte {
  /** L'email d'alerte a-t-il réellement pu être renvoyé (Resend configuré) ? */
  envoye: boolean;
  /** Nombre de comptes concernés par l'alerte rejouée. */
  nbComptes: number;
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configure: boolean;
}

/**
 * Rejoue l'alerte artisan d'un jour précis depuis l'historique : le Backend relit la trace
 * conservée (mêmes comptes concernés) et renvoie l'email d'alerte à l'artisan, sans relancer
 * de recontact ni créer de doublon dans l'historique. Utile pour « se renvoyer » une alerte.
 */
export async function rejouerAlerteArtisan(userId: string, alertId: number): Promise<ResultatRejeuAlerte> {
  const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", {
    body: { replayAlerte: true, userId, alertId },
  });
  if (error) throw new Error("Le renvoi de l'alerte a échoué. Réessayez.");
  const payload = data as { ok?: boolean; error?: string; sent?: boolean; count?: number; configured?: boolean } | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "Le renvoi de l'alerte a échoué. Réessayez.");
  }
  return {
    envoye: Boolean(payload.sent),
    nbComptes: Number(payload.count ?? 0),
    configure: Boolean(payload.configured),
  };
}