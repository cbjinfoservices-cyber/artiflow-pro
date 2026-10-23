import { cleArtiflow, ecrireBrut, ecrireJson, lireJson, lireTexte, supprimer, v } from "@/lib/stockageLocal";

/**
 * Report de l'alerte « récap mensuel oublié ». Quand l'artisan choisit d'envoyer ou d'archiver
 * le récap à la main plus tard, il peut masquer l'alerte pendant 7 jours. Le report est propre
 * au mois concerné : passé le délai, si le mois n'est toujours pas traité, l'alerte revient.
 */

const CLE = cleArtiflow("recap", "snoozeOublie");

/** Événement diffusé quand le report change, pour rafraîchir l'alerte sans recharger la page. */
export const RECAP_OUBLIE_SNOOZE_EVENT = "artiflow-recap-oublie-snooze";

interface Report {
  /** Clé « AAAA-MM » du mois dont l'alerte est masquée. */
  cle: string;
  /** Fin du report (ISO). */
  jusquA: string;
}

const REPORT_VIDE: Report = { cle: "", jusquA: "" };

const validerReport = v.objetPartiel<Report>(
  { cle: v.chaine(""), jusquA: v.chaine("") },
  REPORT_VIDE,
);

function lireReport(): Report | null {
  const report = lireJson<Report>(CLE, validerReport);
  if (!report.cle || !report.jusquA) return null;
  return report;
}

/** Jusqu'à quand l'alerte d'un mois est-elle masquée ? (null si aucun report actif) */
export function lireSnoozeRecap(cle: string): Date | null {
  const report = lireReport();
  if (!report || report.cle !== cle) return null;
  const fin = new Date(report.jusquA);
  if (Number.isNaN(fin.getTime())) return null;
  return fin;
}

/** Durées de report proposées à l'artisan, en jours. */
export const DUREES_SNOOZE_RECAP = [7, 14, 30] as const;

/** Une durée de report reconnue. */
export type DureeSnoozeRecap = (typeof DUREES_SNOOZE_RECAP)[number];

/** Durée proposée par défaut au premier report. */
export const DUREE_SNOOZE_RECAP_DEFAUT: DureeSnoozeRecap = 7;

/** Clé du réglage « durée de report » (préférence d'affichage, aucune donnée métier). */
const CLE_DUREE = cleArtiflow("recap", "snoozeDuree");

/** Vrai si la valeur est une durée proposée (7 / 14 / 30 jours). */
function estDureeValide(jours: number): jours is DureeSnoozeRecap {
  return (DUREES_SNOOZE_RECAP as readonly number[]).includes(jours);
}

/**
 * Durée de report choisie la dernière fois, reproposée au prochain report.
 * Retombe sur 7 jours si rien n'a été mémorisé ou si la valeur est inconnue.
 */
export function lireDureeSnoozePreferee(): DureeSnoozeRecap {
  const brut = lireTexte(CLE_DUREE, "");
  const jours = brut ? Number(brut) : Number.NaN;
  return estDureeValide(jours) ? jours : DUREE_SNOOZE_RECAP_DEFAUT;
}

/** Mémorise la durée de report pour la reproposer la fois suivante. */
export function memoriserDureeSnooze(jours: number): void {
  if (!estDureeValide(jours)) return;
  ecrireBrut(CLE_DUREE, String(jours));
}

/** Masque l'alerte du mois pendant un nombre de jours (7 par défaut). */
export function snoozerRecapOublie(cle: string, jours = 7): void {
  const fin = new Date(Date.now() + Math.max(1, Math.round(jours)) * 86_400_000);
  const ecrit = ecrireJson(CLE, { cle, jusquA: fin.toISOString() });
  if (!ecrit) return;
  // La durée retenue est mémorisée : elle sera reproposée au prochain report.
  memoriserDureeSnooze(jours);
  try {
    window.dispatchEvent(new Event(RECAP_OUBLIE_SNOOZE_EVENT));
  } catch {
    /* environnement sans window : l'alerte reviendra au prochain chargement */
  }
}

/** Annule un report en cours (l'alerte revient tout de suite). */
export function annulerSnoozeRecap(): void {
  supprimer(CLE);
  try {
    window.dispatchEvent(new Event(RECAP_OUBLIE_SNOOZE_EVENT));
  } catch {
    /* environnement sans window : rien à rafraîchir */
  }
}