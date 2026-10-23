import { cleArtiflow, ecrireJson, lireJson, supprimer, v } from "@/lib/stockageLocal";

/**
 * Historique local des renvois d'emails effectués directement depuis la cloche d'alertes.
 * Chaque tentative (réussie ou refusée) y laisse une ligne : date, destinataire, résultat.
 * Ce mémo ne sert qu'à l'affichage « sous chaque adresse » — la trace métier réelle reste
 * le journal des notifications du chantier, écrit par la fonction d'envoi.
 */

/** Un renvoi tenté depuis la cloche pour une adresse en échec. */
export interface RenvoiCloche {
  /** Clé unique de la ligne (chantier + horodatage). */
  cle: string;
  /** Chantier concerné par le renvoi. */
  chantierId: number;
  /** Adresse réellement utilisée (celle de la fiche client au moment du renvoi). */
  destinataire: string | null;
  /** Le renvoi est-il parti ? */
  ok: boolean;
  /** Résultat lisible : « Renvoyé à … » ou la raison exacte du refus. */
  message: string;
  /** Horodatage ISO du renvoi. */
  faitLe: string;
}

const CLE = cleArtiflow("cloche", "renvois");
const MAX = 60;

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const RENVOIS_CLOCHE_EVENT = "artiflow-cloche-renvois";

/** Lit l'historique (du plus récent au plus ancien), robuste à un stockage corrompu. */
export function lireRenvoisCloche(): RenvoiCloche[] {
  const brut = lireJson<unknown>(CLE, v.identite<unknown>([]));
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      cle: typeof item.cle === "string" ? item.cle : "",
      chantierId: Number(item.chantierId) || 0,
      destinataire: typeof item.destinataire === "string" ? item.destinataire : null,
      ok: item.ok === true,
      message: typeof item.message === "string" ? item.message : "",
      faitLe: typeof item.faitLe === "string" ? item.faitLe : "",
    }))
    .filter((entree) => entree.cle !== "" && entree.faitLe !== "")
    .slice(0, MAX);
}

/** Ajoute un renvoi en tête de l'historique et le plafonne. */
export function ajouterRenvoiCloche(entree: {
  chantierId: number;
  destinataire: string | null;
  ok: boolean;
  message: string;
}): void {
  const faitLe = new Date().toISOString();
  const ligne: RenvoiCloche = {
    cle: `${entree.chantierId}-${faitLe}`,
    chantierId: entree.chantierId,
    destinataire: entree.destinataire,
    ok: entree.ok,
    message: entree.message,
    faitLe,
  };
  const liste = [ligne, ...lireRenvoisCloche()].slice(0, MAX);
  if (!ecrireJson(CLE, liste)) return;
  try {
    window.dispatchEvent(new Event(RENVOIS_CLOCHE_EVENT));
  } catch {
    /* environnement sans window : l'affichage se rafraîchira à la prochaine ouverture */
  }
}

/** Vide l'historique des renvois de la cloche. */
export function viderRenvoisCloche(): void {
  supprimer(CLE);
  try {
    window.dispatchEvent(new Event(RENVOIS_CLOCHE_EVENT));
  } catch {
    /* environnement sans window : rien à rafraîchir */
  }
}