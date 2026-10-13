/** Dernière vue de la liste des devis, mémorisée localement pour la restaurer au retour sur la page.
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct). */
import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

export interface FiltresDevisMemoire {
  /** Statut sélectionné dans la barre de filtres (ex. « Tous », « Envoyé », « À suivre »…). */
  statut: string;
  /** Filtre « issu d'un modèle » (clé de modèle, plusieurs séparées par des virgules, « __any__ » ou vide). */
  modele: string;
  /** Filtre « mois précis » au format « YYYY-MM » (vide si aucun). */
  mois: string;
  /** Période sélectionnée (« Tout », « Ce mois », « Ce trimestre », « Cette année »…). */
  periode: string;
  /** Tri actif de la liste ("" | "signes" | "attente" | "client-asc" | "client-desc" | "montant-asc" | "montant-desc"). */
  tri: string;
}

const CLE = "artiflow_devis_filtres";

const VIDE: FiltresDevisMemoire = { statut: "Tous", modele: "", mois: "", periode: "Tout", tri: "" };

/** Relit la dernière vue mémorisée (valeurs présentes uniquement), ou un objet vide si rien de valide. */
export function lireFiltresDevis(): Partial<FiltresDevisMemoire> {
  const raw = lireBrut(CLE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<FiltresDevisMemoire>;
    const out: Partial<FiltresDevisMemoire> = {};
    if (typeof parsed.statut === "string") out.statut = parsed.statut;
    if (typeof parsed.modele === "string") out.modele = parsed.modele;
    if (typeof parsed.mois === "string") out.mois = parsed.mois;
    if (typeof parsed.periode === "string") out.periode = parsed.periode;
    if (typeof parsed.tri === "string") out.tri = parsed.tri;
    return out;
  } catch {
    return {};
  }
}

/** Mémorise la vue courante pour la proposer au prochain retour sur la page Devis. */
export function memoriserFiltresDevis(filtres: FiltresDevisMemoire): void {
  const payload: FiltresDevisMemoire = {
    statut: filtres.statut || VIDE.statut,
    modele: filtres.modele || "",
    mois: filtres.mois || "",
    // On ne mémorise pas « Personnalisé » : sans les dates associées, elle serait trompeuse au retour.
    periode: filtres.periode && filtres.periode !== "Personnalisé" ? filtres.periode : VIDE.periode,
    tri: filtres.tri || "",
  };
  const ancien = lireBrut(CLE);
  const nouveau = JSON.stringify(payload);
  if (!ecrireBrut(CLE, nouveau)) return;
  if (ancien !== nouveau) marquerPreferenceModifiee("filtres");
}

/** Oublie la vue mémorisée (revient aux filtres par défaut au prochain chargement). */
export function effacerFiltresDevis(): void {
  supprimer(CLE);
}