import type { Intervenant } from "@/lib/intervenants";
import { dureeMinutes, etatPointage, type Pointage } from "@/lib/pointage";
import { recapAnnuelConges, type Indisponibilite } from "@/lib/indisponibilites";
import { toISODate } from "@/lib/dates";

/**
 * Intervention réduite au strict nécessaire pour les statistiques d'équipe.
 * On évite volontairement de dépendre du hook de données : ces calculs restent
 * utilisables depuis n'importe quel écran (page Intervenants, fiche, etc.).
 */
export interface CreneauStats {
  id: number;
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
  intervenant_id: number | null;
  statut: string;
}

/** Chiffres clés d'une personne de l'équipe, affichés sur sa carte et dans sa fiche. */
export interface StatsIntervenant {
  /** Identifiant de la fiche. */
  id: number;
  /** Temps réellement pointé sur le mois en cours (pause déduite), en minutes. */
  minutesMois: number;
  /** Nombre d'interventions pointées sur le mois en cours. */
  nbPointagesMois: number;
  /** Nombre de jours distincts travaillés sur le mois en cours. */
  joursPointesMois: number;
  /** Interventions encore à venir (aujourd'hui inclus), toutes dates confondues. */
  interventionsAVenir: number;
  /** Prochaine intervention à venir, ou null si le planning est vide pour cette personne. */
  prochaine: CreneauStats | null;
  /** Jours de congé posés sur l'année en cours (jours ouvrés, demi-journées comprises). */
  congesPoses: number;
  /** Jours de congé restants sur le droit annuel de référence. */
  congesRestants: number;
  /** Autres absences (formation, maladie, récupération…) posées sur l'année. */
  autresAbsences: number;
  /** Vrai si la personne est absente aujourd'hui (congé ou indisponibilité). */
  absentAujourdhui: boolean;
  /** Motif de l'absence du jour, ou null. */
  motifAbsenceJour: string | null;
}

/**
 * Calcule les statistiques de chaque intervenant à partir des pointages, des
 * interventions du planning et des absences. Une seule passe sur les données :
 * le résultat est une table indexée par identifiant de fiche.
 */
export function calculerStatsIntervenants(params: {
  intervenants: Intervenant[];
  pointages: Pointage[];
  creneaux: CreneauStats[];
  indisponibilites: Indisponibilite[];
  maintenant?: Date;
}): Map<number, StatsIntervenant> {
  const maintenant = params.maintenant ?? new Date();
  const maintenantMs = maintenant.getTime();
  const aujourdHui = toISODate(maintenant);
  const prefixeMois = aujourdHui.slice(0, 7);
  const annee = maintenant.getFullYear();

  // Congés : la même source que le récapitulatif annuel du planning, pour rester cohérent.
  const conges = new Map<number, { poses: number; restants: number; autres: number }>();
  recapAnnuelConges(params.indisponibilites, params.intervenants, annee).forEach((ligne) => {
    conges.set(ligne.intervenantId, {
      poses: ligne.congesPoses,
      restants: ligne.restants,
      autres: ligne.autresAbsences,
    });
  });

  const resultat = new Map<number, StatsIntervenant>();

  params.intervenants.forEach((intervenant) => {
    const pointagesPerso = params.pointages.filter(
      (p) => p.intervenant_id === intervenant.id && p.date.startsWith(prefixeMois) && Boolean(p.arrivee_le),
    );
    const minutesMois = pointagesPerso.reduce((total, p) => total + dureeMinutes(p, maintenantMs), 0);
    const joursPointes = new Set(pointagesPerso.map((p) => p.date)).size;

    const aVenir = params.creneaux
      .filter((c) => c.intervenant_id === intervenant.id && c.date >= aujourdHui)
      .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

    const absencesJour = params.indisponibilites.filter(
      (i) => i.intervenant_id === intervenant.id && i.date === aujourdHui,
    );
    const conge = conges.get(intervenant.id);

    resultat.set(intervenant.id, {
      id: intervenant.id,
      minutesMois,
      nbPointagesMois: pointagesPerso.filter((p) => etatPointage(p) !== "absent").length,
      joursPointesMois: joursPointes,
      interventionsAVenir: aVenir.length,
      prochaine: aVenir[0] ?? null,
      congesPoses: conge?.poses ?? 0,
      congesRestants: conge?.restants ?? 0,
      autresAbsences: conge?.autres ?? 0,
      absentAujourdhui: absencesJour.length > 0,
      motifAbsenceJour: absencesJour[0]?.motif ?? null,
    });
  });

  return resultat;
}