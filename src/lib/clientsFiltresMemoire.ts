/** Dernière vue de la liste des clients, mémorisée localement pour la restaurer au retour sur la page.
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct). */
import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

export interface FiltresClientsMemoire {
  /** Type affiché (« Tous », « Particuliers », « Professionnels »). */
  type: string;
  /** Priorité isolée (« Toutes » ou la clé d'une priorité de note). */
  priorite: string;
  /** Filtre « A des notes » activé ou non. */
  notes: boolean;
}

const CLE = "artiflow_clients_filtres";

const VIDE: FiltresClientsMemoire = { type: "Tous", priorite: "Toutes", notes: false };

/** Relit la dernière vue mémorisée (valeurs présentes uniquement), ou un objet vide si rien de valide. */
export function lireFiltresClients(): Partial<FiltresClientsMemoire> {
  const raw = lireBrut(CLE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<FiltresClientsMemoire>;
    const out: Partial<FiltresClientsMemoire> = {};
    if (typeof parsed.type === "string") out.type = parsed.type;
    if (typeof parsed.priorite === "string") out.priorite = parsed.priorite;
    if (typeof parsed.notes === "boolean") out.notes = parsed.notes;
    return out;
  } catch {
    return {};
  }
}

/**
 * Mémorise la vue courante pour la proposer au prochain retour sur la page Clients.
 * Une vue « par défaut » (aucun filtre actif) efface la mémoire plutôt que de la fixer,
 * pour ne pas restaurer un état neutre inutilement.
 */
export function memoriserFiltresClients(filtres: FiltresClientsMemoire): void {
  const payload: FiltresClientsMemoire = {
    type: filtres.type || VIDE.type,
    priorite: filtres.priorite || VIDE.priorite,
    notes: Boolean(filtres.notes),
  };
  const estDefaut = payload.type === VIDE.type && payload.priorite === VIDE.priorite && !payload.notes;
  const ancien = lireBrut(CLE);
  const nouveau = estDefaut ? null : JSON.stringify(payload);
  if (estDefaut) supprimer(CLE);
  else ecrireBrut(CLE, nouveau as string);
  if ((ancien ?? null) !== nouveau) marquerPreferenceModifiee("filtres");
}

/** Oublie la vue mémorisée (revient aux filtres par défaut au prochain chargement). */
export function effacerFiltresClients(): void {
  supprimer(CLE);
}