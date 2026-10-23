import type { CreneauItem } from "@/hooks/useArtisanData";
import type { Intervenant } from "@/lib/intervenants";
import {
  resumeAbsencesDuJour,
  type AbsenceJourResume,
  type Indisponibilite,
} from "@/lib/indisponibilites";
import { toISODate } from "@/lib/dates";

/**
 * Une intervention qui tombe un jour où la personne affectée est absente (congé,
 * formation, arrêt…). C'est exactement ce qu'il reste à réaffecter : la mission ne peut
 * pas être assurée par la personne prévue ce jour-là.
 */
export interface ConflitConge {
  /** L'intervention concernée. */
  creneau: CreneauItem;
  /** La personne affectée (celle qui est absente), ou null si sa fiche a été supprimée. */
  intervenant: Intervenant | null;
  /** L'absence qui crée le conflit sur cette journée. */
  absence: AbsenceJourResume;
}

/**
 * Liste les interventions en conflit avec une absence. Par défaut on ne regarde que les
 * interventions à venir (aujourd'hui inclus) : ce sont celles qui restent réellement à
 * réaffecter. Les interventions passées peuvent être incluses à la demande.
 */
export function listerConflitsConges(
  creneaux: CreneauItem[],
  indisponibilites: Indisponibilite[],
  intervenants: Intervenant[],
  options: { inclurePasse?: boolean } = {},
): ConflitConge[] {
  const intervenantParId = new Map<number, Intervenant>();
  intervenants.forEach((i) => intervenantParId.set(i.id, i));
  const aujourdHui = toISODate(new Date());

  const liste: ConflitConge[] = [];
  creneaux.forEach((creneau) => {
    if (creneau.intervenant_id === null) return;
    if (!options.inclurePasse && creneau.date < aujourdHui) return;
    const absence = resumeAbsencesDuJour(indisponibilites, creneau.intervenant_id, creneau.date);
    if (!absence) return;
    liste.push({
      creneau,
      intervenant: intervenantParId.get(creneau.intervenant_id) ?? null,
      absence,
    });
  });

  return liste.sort(
    (a, b) =>
      a.creneau.date.localeCompare(b.creneau.date) || a.creneau.heure.localeCompare(b.creneau.heure),
  );
}

/** Identifiants des interventions en conflit, pour filtrer les vues d'un seul geste. */
export function idsConflits(liste: ConflitConge[]): Set<number> {
  return new Set(liste.map((c) => c.creneau.id));
}

/** Un remplaçant possible pour une intervention, avec son niveau de disponibilité. */
export interface RemplacantSuggere {
  intervenant: Intervenant;
  /** Nombre d'interventions déjà prévues pour cette personne le jour concerné. */
  chargeJour: number;
  /** Vrai si la personne exerce le même métier que la personne absente. */
  memeMetier: boolean;
}

/**
 * Propose des remplaçants pertinents pour une intervention : uniquement des personnes
 * actives, non absentes ce jour-là, et autres que la personne déjà affectée. Le classement
 * privilégie la disponibilité (le moins d'interventions ce jour), puis la correspondance
 * de métier, puis l'ordre alphabétique.
 */
export function suggererRemplacants(params: {
  /** Jour de l'intervention (AAAA-MM-JJ). */
  date: string;
  /** Personne actuellement affectée (exclue des suggestions). */
  intervenantId: number | null;
  /** Métier de la personne absente, pour privilégier une compétence équivalente. */
  metier?: string | null;
  intervenants: Intervenant[];
  creneaux: CreneauItem[];
  indisponibilites: Indisponibilite[];
  /** Nombre maximum de suggestions renvoyées (3 par défaut). */
  limite?: number;
}): RemplacantSuggere[] {
  const charge = new Map<number, number>();
  params.creneaux.forEach((c) => {
    if (c.date !== params.date || c.intervenant_id === null) return;
    charge.set(c.intervenant_id, (charge.get(c.intervenant_id) ?? 0) + 1);
  });

  const metierReference = (params.metier ?? "").trim().toLowerCase();
  const candidats: RemplacantSuggere[] = params.intervenants
    .filter((i) => i.actif && i.id !== params.intervenantId)
    .filter((i) => !resumeAbsencesDuJour(params.indisponibilites, i.id, params.date))
    .map((i) => ({
      intervenant: i,
      chargeJour: charge.get(i.id) ?? 0,
      memeMetier:
        metierReference.length > 0 && (i.metier ?? "").trim().toLowerCase() === metierReference,
    }));

  candidats.sort((a, b) => {
    if (a.chargeJour !== b.chargeJour) return a.chargeJour - b.chargeJour;
    if (a.memeMetier !== b.memeMetier) return a.memeMetier ? -1 : 1;
    return a.intervenant.nom.localeCompare(b.intervenant.nom);
  });

  return candidats.slice(0, params.limite ?? 3);
}

/** Résume la disponibilité d'un remplaçant (« libre ce jour », « 2 interventions ce jour »). */
export function libelleDisponibilite(remplacant: RemplacantSuggere): string {
  const dispo =
    remplacant.chargeJour === 0
      ? "libre ce jour"
      : `${remplacant.chargeJour} intervention${remplacant.chargeJour > 1 ? "s" : ""} ce jour`;
  return remplacant.memeMetier ? `${dispo} · même métier` : dispo;
}