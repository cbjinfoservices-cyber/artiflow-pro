/** Dernière vue de la liste des factures, mémorisée localement pour la restaurer au retour sur la page.
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct). */
import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

export interface FiltresFacturesMemoire {
  /** Statut sélectionné dans la barre de filtres (« Toutes », « Émise », « Payée »…). */
  statut: string;
  /** Type de document affiché (« Factures », « Avoirs », « Tous »). */
  type: string;
  /** Période sélectionnée (« Tout », « Ce mois », « Ce trimestre », « Cette année »…). */
  periode: string;
  /** Tri actif de la liste ("" | "date-desc" | "montant-asc" | "client-asc" | "echeance-asc"…). */
  tri: string;
}

const CLE = "artiflow_factures_filtres";

const VIDE: FiltresFacturesMemoire = { statut: "Toutes", type: "Factures", periode: "Tout", tri: "" };

/** Relit la dernière vue mémorisée (valeurs présentes uniquement), ou un objet vide si rien de valide. */
export function lireFiltresFactures(): Partial<FiltresFacturesMemoire> {
  const raw = lireBrut(CLE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<FiltresFacturesMemoire>;
    const out: Partial<FiltresFacturesMemoire> = {};
    if (typeof parsed.statut === "string") out.statut = parsed.statut;
    if (typeof parsed.type === "string") out.type = parsed.type;
    if (typeof parsed.periode === "string") out.periode = parsed.periode;
    if (typeof parsed.tri === "string") out.tri = parsed.tri;
    return out;
  } catch {
    return {};
  }
}

/**
 * Mémorise la vue courante pour la proposer au prochain retour sur la page Factures.
 * Une vue « par défaut » (aucun filtre ni tri) efface la mémoire plutôt que de la fixer,
 * pour ne pas restaurer un état neutre inutilement.
 */
export function memoriserFiltresFactures(filtres: FiltresFacturesMemoire): void {
  const payload: FiltresFacturesMemoire = {
    statut: filtres.statut || VIDE.statut,
    type: filtres.type || VIDE.type,
    // On ne mémorise pas « Personnalisé » : sans les dates associées, elle serait trompeuse au retour.
    periode: filtres.periode && filtres.periode !== "Personnalisé" ? filtres.periode : VIDE.periode,
    tri: filtres.tri || "",
  };
  const estDefaut =
    payload.statut === VIDE.statut && payload.type === VIDE.type && payload.periode === VIDE.periode && !payload.tri;
  const ancien = lireBrut(CLE);
  const nouveau = estDefaut ? null : JSON.stringify(payload);
  if (estDefaut) supprimer(CLE);
  else ecrireBrut(CLE, nouveau as string);
  if ((ancien ?? null) !== nouveau) marquerPreferenceModifiee("filtres");
}

/** Oublie la vue mémorisée (revient aux filtres par défaut au prochain chargement). */
export function effacerFiltresFactures(): void {
  supprimer(CLE);
}