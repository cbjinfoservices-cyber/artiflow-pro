/**
 * Préférences locales du « mode test à blanc » des automatisations.
 *
 * Un test à blanc rejoue le contenu EXACT d'une automatisation (construit par son aperçu)
 * vers une adresse de test choisie, sans jamais toucher aux vrais destinataires (clients,
 * comptable). On mémorise ici, côté navigateur, l'activation du mode et l'adresse de test.
 */

const CLE = "artiflow.envoisAuto.testABlanc";
/** Événement diffusé quand les préférences du test à blanc changent. */
export const TEST_A_BLANC_EVENT = "artiflow-envoisauto-testablanc";

/** Préférences du mode test à blanc. */
export interface TestABlancPrefs {
  /** Le mode test à blanc est-il activé ? */
  actif: boolean;
  /** Adresse de test vers laquelle rejouer les envois. */
  destinataire: string;
}

/** Validation minimale d'une adresse email. */
export function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

/** Lit les préférences du test à blanc (robuste à un stockage indisponible ou corrompu). */
export function lireTestABlanc(): TestABlancPrefs {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { actif: false, destinataire: "" };
    const parsed = JSON.parse(brut) as unknown;
    if (!parsed || typeof parsed !== "object") return { actif: false, destinataire: "" };
    const o = parsed as Record<string, unknown>;
    return {
      actif: o.actif === true,
      destinataire: typeof o.destinataire === "string" ? o.destinataire : "",
    };
  } catch {
    return { actif: false, destinataire: "" };
  }
}

/** Enregistre les préférences du test à blanc et prévient l'affichage. */
export function enregistrerTestABlanc(prefs: TestABlancPrefs): void {
  const propre: TestABlancPrefs = {
    actif: prefs.actif === true,
    destinataire: String(prefs.destinataire ?? "").trim(),
  };
  try {
    localStorage.setItem(CLE, JSON.stringify(propre));
    window.dispatchEvent(new Event(TEST_A_BLANC_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}

/**
 * Période de filtrage des rejeux : tout l'historique, aujourd'hui, les 7 / 30 derniers
 * jours, les 6 derniers mois, ou une plage personnalisée (date de début / date de fin).
 */
export type PeriodeRejeux = "tout" | "jour" | "7j" | "30j" | "6m" | "perso";

/** Toutes les valeurs de période acceptées (sert à valider une valeur lue au stockage). */
const PERIODES_REJEUX: PeriodeRejeux[] = ["tout", "jour", "7j", "30j", "6m", "perso"];

/** Filtres mémorisés de la liste des derniers rejeux (automatisation + résultat + période). */
export interface FiltresRejeux {
  /** Identifiant de l'automatisation filtrée (vide = toutes). */
  filtreAuto: string;
  /** Résultat filtré : « tous », « ok » (envoyée) ou « echec ». */
  filtreResultat: "tous" | "ok" | "echec";
  /** Période filtrée : « tout », « jour », « 7j », « 30j », « 6m » ou « perso » (plage personnalisée). */
  filtrePeriode: PeriodeRejeux;
  /** Date de début (AAAA-MM-JJ) de la plage personnalisée, vide si non définie. */
  dateDebut: string;
  /** Date de fin (AAAA-MM-JJ) de la plage personnalisée, vide si non définie. */
  dateFin: string;
}

const CLE_FILTRES = "artiflow.envoisAuto.testABlancFiltres";

/** Valeur neutre (aucun filtre) : base commune à la lecture et à la remise à zéro. */
const FILTRES_VIDES: FiltresRejeux = {
  filtreAuto: "",
  filtreResultat: "tous",
  filtrePeriode: "tout",
  dateDebut: "",
  dateFin: "",
};

/** Lit les filtres de rejeux mémorisés (robuste à un stockage indisponible ou corrompu). */
export function lireFiltresRejeux(): FiltresRejeux {
  try {
    const brut = localStorage.getItem(CLE_FILTRES);
    if (!brut) return { ...FILTRES_VIDES };
    const parsed = JSON.parse(brut) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...FILTRES_VIDES };
    const o = parsed as Record<string, unknown>;
    const res =
      o.filtreResultat === "ok" || o.filtreResultat === "echec" ? o.filtreResultat : "tous";
    const periode = PERIODES_REJEUX.includes(o.filtrePeriode as PeriodeRejeux)
      ? (o.filtrePeriode as PeriodeRejeux)
      : "tout";
    return {
      filtreAuto: typeof o.filtreAuto === "string" ? o.filtreAuto : "",
      filtreResultat: res,
      filtrePeriode: periode,
      dateDebut: typeof o.dateDebut === "string" ? o.dateDebut : "",
      dateFin: typeof o.dateFin === "string" ? o.dateFin : "",
    };
  } catch {
    return { ...FILTRES_VIDES };
  }
}

/** Enregistre les filtres de rejeux pour qu'ils restent en place après un rechargement. */
export function enregistrerFiltresRejeux(filtres: FiltresRejeux): void {
  const propres: FiltresRejeux = {
    filtreAuto: String(filtres.filtreAuto ?? ""),
    filtreResultat:
      filtres.filtreResultat === "ok" || filtres.filtreResultat === "echec"
        ? filtres.filtreResultat
        : "tous",
    filtrePeriode: PERIODES_REJEUX.includes(filtres.filtrePeriode) ? filtres.filtrePeriode : "tout",
    dateDebut: String(filtres.dateDebut ?? ""),
    dateFin: String(filtres.dateFin ?? ""),
  };
  try {
    localStorage.setItem(CLE_FILTRES, JSON.stringify(propres));
  } catch {
    /* stockage indisponible : les filtres ne sont pas persistants */
  }
}