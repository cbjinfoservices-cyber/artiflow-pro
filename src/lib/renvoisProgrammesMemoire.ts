import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";

/**
 * Renvois d'emails programmés depuis la cloche (« renvoyer dans 24 h »).
 *
 * Quand une adresse est encore refusée et que la fiche client n'a pas encore été corrigée,
 * l'artisan peut repousser la relance de 24 h au lieu de la tenter tout de suite. Chaque
 * programmation est mémorisée localement avec l'adresse réellement visée : à l'échéance, si
 * l'adresse n'a pas changé, le renvoi part automatiquement depuis la cloche ; si la fiche a
 * été corrigée entre-temps, la programmation est annulée (le renvoi n'a plus lieu d'être).
 */

/** Un renvoi différé en attente. */
export interface RenvoiProgramme {
  /** Chantier concerné (une seule programmation active par chantier). */
  chantierId: number;
  /** Adresse visée au moment de la programmation, pour détecter une correction entre-temps. */
  destinataire: string | null;
  /** Message d'origine, réutilisé pour rédiger le renvoi. */
  motif: string | null;
  /** Échéance du renvoi automatique (ISO). */
  prevuLe: string;
  /** Date de programmation (ISO). */
  creeLe: string;
}

const CLE = cleArtiflow("cloche", "renvoisProgrammes");
const MAX = 40;

/** Délai proposé par défaut avant le renvoi automatique, en heures. */
export const DELAI_RENVOI_PROGRAMME_HEURES = 24;

/** Événement diffusé à chaque changement, pour rafraîchir la cloche sans recharger la page. */
export const RENVOIS_PROGRAMMES_EVENT = "artiflow-cloche-renvois-programmes";

const validerListe = v.identite<unknown>([]);

/** Lit les renvois programmés (échéance la plus proche d'abord), robuste à un stockage corrompu. */
export function lireRenvoisProgrammes(): RenvoiProgramme[] {
  const brut = lireJson<unknown>(CLE, validerListe);
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      chantierId: Number(item.chantierId) || 0,
      destinataire: typeof item.destinataire === "string" ? item.destinataire : null,
      motif: typeof item.motif === "string" ? item.motif : null,
      prevuLe: typeof item.prevuLe === "string" ? item.prevuLe : "",
      creeLe: typeof item.creeLe === "string" ? item.creeLe : "",
    }))
    .filter((entree) => entree.chantierId > 0 && entree.prevuLe !== "")
    .sort((a, b) => a.prevuLe.localeCompare(b.prevuLe))
    .slice(0, MAX);
}

function ecrire(liste: RenvoiProgramme[]): void {
  if (!ecrireJson(CLE, liste.slice(0, MAX))) return;
  try {
    window.dispatchEvent(new Event(RENVOIS_PROGRAMMES_EVENT));
  } catch {
    /* environnement sans window : l'affichage se rafraîchira à la prochaine ouverture */
  }
}

/** Programme (ou reprogramme) le renvoi d'un email pour un chantier donné. */
export function programmerRenvoi(
  entree: { chantierId: number; destinataire: string | null; motif: string | null },
  heures = DELAI_RENVOI_PROGRAMME_HEURES,
): void {
  if (!entree.chantierId) return;
  const maintenant = Date.now();
  const ligne: RenvoiProgramme = {
    chantierId: entree.chantierId,
    destinataire: entree.destinataire,
    motif: entree.motif,
    prevuLe: new Date(maintenant + Math.max(1, heures) * 3_600_000).toISOString(),
    creeLe: new Date(maintenant).toISOString(),
  };
  const reste = lireRenvoisProgrammes().filter((p) => p.chantierId !== entree.chantierId);
  ecrire([...reste, ligne].sort((a, b) => a.prevuLe.localeCompare(b.prevuLe)));
}

/** Annule la programmation d'un chantier (sans erreur s'il n'y en a pas). */
export function annulerRenvoiProgramme(chantierId: number): void {
  const liste = lireRenvoisProgrammes();
  const reste = liste.filter((p) => p.chantierId !== chantierId);
  if (reste.length === liste.length) return;
  ecrire(reste);
}

/** Annule d'un coup toutes les programmations en attente. Renvoie le nombre annulé. */
export function annulerTousRenvoisProgrammes(): number {
  const liste = lireRenvoisProgrammes();
  if (liste.length === 0) return 0;
  ecrire([]);
  return liste.length;
}

/** Décompte lisible avant le départ d'un renvoi (« dans 3 h 12 min », « dans 40 s »). */
export function libelleDecompteRenvoi(prevuLe: string, maintenant = Date.now()): string {
  const cible = new Date(prevuLe).getTime();
  if (!Number.isFinite(cible)) return "—";
  const reste = cible - maintenant;
  if (reste <= 0) return "départ imminent";
  const minutes = Math.ceil(reste / 60_000);
  if (minutes <= 1) return "dans moins d'une minute";
  if (minutes < 60) return `dans ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;
  if (heures < 24) {
    return minutesRestantes > 0 ? `dans ${heures} h ${minutesRestantes} min` : `dans ${heures} h`;
  }
  const jours = Math.floor(heures / 24);
  const heuresRestantes = heures % 24;
  return heuresRestantes > 0 ? `dans ${jours} j ${heuresRestantes} h` : `dans ${jours} j`;
}

/** Programmation active d'un chantier, s'il y en a une. */
export function trouverRenvoiProgramme(chantierId: number): RenvoiProgramme | null {
  return lireRenvoisProgrammes().find((p) => p.chantierId === chantierId) ?? null;
}

/** Libellé lisible d'une échéance de renvoi (« demain à 14:32 », « le 26 oct. à 09:05 »). */
export function libelleEcheanceRenvoi(prevuLe: string): string {
  const date = new Date(prevuLe);
  if (Number.isNaN(date.getTime())) return "—";
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const aujourdhui = new Date();
  const jour = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const cible = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const ecart = Math.round((cible.getTime() - jour.getTime()) / 86_400_000);
  if (ecart === 0) return `aujourd'hui à ${heure}`;
  if (ecart === 1) return `demain à ${heure}`;
  const jourLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `le ${jourLabel} à ${heure}`;
}