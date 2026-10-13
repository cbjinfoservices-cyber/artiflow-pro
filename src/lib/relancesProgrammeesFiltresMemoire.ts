/** Dernière vue de la page des relances programmées, mémorisée localement pour la restaurer au retour. */
import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";

export interface FiltresRelancesProgrammeesMemoire {
  /** Période des relances à venir (« 7 », « 30 », « 90 », « all »). */
  periode: string;
  /** Mode d'affichage choisi (« liste » ou « clients »). */
  vue: string;
  /** Période de la liste « Déjà traitées » (« jour », « 7 », « mois », « all »). */
  periodeTraitees: string;
  /** Filtre de statut « Déjà traitées » (« all », « envoyee », « echec »). */
  statutTraitees: string;
}

const CLE = "artiflow_relances_programmees_filtres";

const VIDE: FiltresRelancesProgrammeesMemoire = {
  periode: "all",
  vue: "liste",
  periodeTraitees: "all",
  statutTraitees: "all",
};

/** Relit la dernière vue mémorisée (valeurs présentes uniquement), ou un objet vide si rien de valide. */
export function lireFiltresRelancesProgrammees(): Partial<FiltresRelancesProgrammeesMemoire> {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<FiltresRelancesProgrammeesMemoire>;
    const out: Partial<FiltresRelancesProgrammeesMemoire> = {};
    if (typeof parsed.periode === "string") out.periode = parsed.periode;
    if (typeof parsed.vue === "string") out.vue = parsed.vue;
    if (typeof parsed.periodeTraitees === "string") out.periodeTraitees = parsed.periodeTraitees;
    if (typeof parsed.statutTraitees === "string") out.statutTraitees = parsed.statutTraitees;
    return out;
  } catch {
    return {};
  }
}

/**
 * Mémorise la vue courante (période, mode d'affichage, filtres « déjà traitées ») pour la proposer
 * au prochain retour. Une vue « par défaut » efface la mémoire plutôt que de la fixer, pour ne pas
 * restaurer un état neutre inutilement.
 */
export function memoriserFiltresRelancesProgrammees(filtres: FiltresRelancesProgrammeesMemoire): void {
  try {
    const payload: FiltresRelancesProgrammeesMemoire = {
      periode: filtres.periode || VIDE.periode,
      vue: filtres.vue || VIDE.vue,
      periodeTraitees: filtres.periodeTraitees || VIDE.periodeTraitees,
      statutTraitees: filtres.statutTraitees || VIDE.statutTraitees,
    };
    const estDefaut =
      payload.periode === VIDE.periode &&
      payload.vue === VIDE.vue &&
      payload.periodeTraitees === VIDE.periodeTraitees &&
      payload.statutTraitees === VIDE.statutTraitees;
    const ancien = localStorage.getItem(CLE);
    const nouveau = estDefaut ? null : JSON.stringify(payload);
    if (estDefaut) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, nouveau as string);
    if ((ancien ?? null) !== nouveau) marquerPreferenceModifiee("filtres");
  } catch {
    /* préférence non persistée : la page reste utilisable */
  }
}

/** Oublie la vue mémorisée (revient aux filtres par défaut au prochain chargement). */
export function effacerFiltresRelancesProgrammees(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* ignore */
  }
}