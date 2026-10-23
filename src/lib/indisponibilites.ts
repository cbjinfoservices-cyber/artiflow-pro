import { supabase } from "@/lib/supabase";
import { addDays, toISODate } from "@/lib/dates";

/**
 * Valeur de statut réservée dans la table du planning pour marquer une indisponibilité
 * (congé, formation, arrêt maladie…). Ces lignes sont volontairement séparées des
 * interventions : elles ne comptent jamais comme du travail planifié, mais elles
 * s'affichent dans le calendrier pour éviter d'affecter quelqu'un qui n'est pas là.
 */
export const STATUT_INDISPONIBLE = "indisponible";

/** Un motif d'indisponibilité proposé au responsable (libellé + icône d'affichage). */
export interface MotifIndisponibilite {
  cle: string;
  label: string;
  icon: string;
}

/** Motifs proposés dans la fenêtre « Poser un congé ». */
export const MOTIFS_INDISPONIBILITE: MotifIndisponibilite[] = [
  { cle: "conge", label: "Congé", icon: "ri-sun-line" },
  { cle: "formation", label: "Formation", icon: "ri-graduation-cap-line" },
  { cle: "maladie", label: "Arrêt maladie", icon: "ri-heart-pulse-line" },
  { cle: "recuperation", label: "Récupération", icon: "ri-rest-time-line" },
  { cle: "indisponible", label: "Indisponible", icon: "ri-forbid-line" },
];

/**
 * Portion de journée couverte par une absence. Une demi-journée ne décompte que
 * 0,5 jour du solde de congés, tout en bloquant la planification sur la période
 * concernée. L'information est portée par la colonne `heure` de la ligne d'absence
 * (00:00 = journée entière, 08:00 = matin, 13:00 = après-midi) : aucune évolution de
 * la structure de la base n'est nécessaire pour autant.
 */
export type PeriodeAbsence = "journee" | "matin" | "apres-midi";

/** Heure technique enregistrée en base pour chaque portion de journée. */
export const HEURE_PERIODE_ABSENCE: Record<PeriodeAbsence, string> = {
  journee: "00:00",
  matin: "08:00",
  "apres-midi": "13:00",
};

/** Libellé humain d'une portion de journée. */
export function libellePeriode(periode: PeriodeAbsence): string {
  if (periode === "matin") return "matin";
  if (periode === "apres-midi") return "après-midi";
  return "journée entière";
}

/** Suffixe compact à accoler au motif (« Congé (matin) »). */
export function suffixePeriode(periode: PeriodeAbsence): string {
  return periode === "journee" ? "" : ` (${libellePeriode(periode)})`;
}

/** Retrouve la portion de journée depuis la valeur d'heure enregistrée. */
export function periodeDepuisHeure(heure: unknown): PeriodeAbsence {
  const valeur = String(heure ?? "").slice(0, 5);
  if (valeur === HEURE_PERIODE_ABSENCE.matin) return "matin";
  if (valeur === HEURE_PERIODE_ABSENCE["apres-midi"]) return "apres-midi";
  return "journee";
}

/** Poids d'une absence dans le solde de congés (1 pour une journée, 0,5 pour une demi-journée). */
export function poidsPeriode(periode: PeriodeAbsence): number {
  return periode === "journee" ? 1 : 0.5;
}

/** Une indisponibilité posée sur une journée (ou une demi-journée), pour un intervenant donné. */
export interface Indisponibilite {
  id: number;
  /** Jour concerné (AAAA-MM-JJ). */
  date: string;
  /** Motif lisible (« Congé », « Formation »…). */
  motif: string;
  /** Intervenant concerné, ou null si l'indisponibilité vise toute l'entreprise. */
  intervenant_id: number | null;
  /** Précision libre (« du 12 au 20 août », « mi-temps »…), ou null. */
  note: string | null;
  /** Portion de journée couverte (journée entière par défaut). */
  periode: PeriodeAbsence;
}

/** Vrai si un statut enregistré correspond à une indisponibilité (et non à une intervention). */
export function estStatutIndisponible(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === STATUT_INDISPONIBLE;
}

/** Icône associée à un motif, pour l'afficher dans le calendrier. */
export function iconeMotif(motif: string): string {
  return MOTIFS_INDISPONIBILITE.find((m) => m.label === motif)?.icon ?? "ri-forbid-line";
}

/** Durée maximale (en jours) d'une indisponibilité posée d'un seul geste. */
export const DUREE_MAX_INDISPONIBILITE = 120;

/** Convertit une ligne du planning marquée « indisponible » en absence exploitable. */
function versIndisponibilite(row: Record<string, unknown>): Indisponibilite {
  return {
    id: Number(row.id),
    date: String(row.date ?? ""),
    motif: String(row.libelle ?? "Indisponible"),
    intervenant_id:
      row.intervenant_id === null || row.intervenant_id === undefined ? null : Number(row.intervenant_id),
    note: row.note === null || row.note === undefined ? null : String(row.note),
    periode: periodeDepuisHeure(row.heure),
  };
}

/** Récupère toutes les indisponibilités de l'entreprise (RLS : uniquement les siennes). */
export async function fetchIndisponibilites(): Promise<Indisponibilite[]> {
  const { data, error } = await supabase
    .from("planning_creneaux")
    .select("id, date, libelle, intervenant_id, note, heure")
    .eq("statut", STATUT_INDISPONIBLE)
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(versIndisponibilite);
}

/**
 * Récupère les absences d'une seule personne. Utilisé par le planning personnel de
 * l'intervenant, qui doit voir ses congés même s'il n'a aucune intervention ce jour-là.
 */
export async function fetchIndisponibilitesIntervenant(intervenantId: number): Promise<Indisponibilite[]> {
  const { data, error } = await supabase
    .from("planning_creneaux")
    .select("id, date, libelle, intervenant_id, note, heure")
    .eq("statut", STATUT_INDISPONIBLE)
    .eq("intervenant_id", intervenantId)
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(versIndisponibilite);
}

/**
 * Pose une indisponibilité sur une période (une ligne par jour, pour que le calendrier
 * puisse l'afficher directement case par case sans calcul de plage).
 */
export async function creerIndisponibilite(
  userId: string,
  params: {
    intervenantId: number;
    dateDebut: string;
    dateFin: string;
    motif: string;
    note?: string | null;
    /** Portion de journée : journée entière, matin ou après-midi. */
    periode?: PeriodeAbsence;
  },
): Promise<void> {
  const debut = new Date(`${params.dateDebut}T00:00:00`);
  const fin = new Date(`${params.dateFin || params.dateDebut}T00:00:00`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    throw new Error("Dates invalides.");
  }
  // Une demi-journée ne concerne qu'une seule date : on ignore la date de fin.
  const periode = params.periode ?? "journee";
  const dernier = periode !== "journee" || fin.getTime() < debut.getTime() ? debut : fin;
  const rows: Record<string, unknown>[] = [];
  for (let d = debut; d.getTime() <= dernier.getTime(); d = addDays(d, 1)) {
    rows.push({
      user_id: userId,
      date: toISODate(d),
      heure: HEURE_PERIODE_ABSENCE[periode],
      libelle: params.motif,
      ville: null,
      chantier_id: null,
      intervenant_id: params.intervenantId,
      statut: STATUT_INDISPONIBLE,
      note: params.note?.trim() || null,
    });
    if (rows.length >= DUREE_MAX_INDISPONIBILITE) break;
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from("planning_creneaux").insert(rows);
  if (error) throw error;
}

/** Retire une indisponibilité (une seule journée). */
export async function supprimerIndisponibilite(id: number): Promise<void> {
  const { error } = await supabase.from("planning_creneaux").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Droit annuel de référence appliqué à chaque intervenant, exprimé en jours ouvrés.
 * Il sert de base au calcul des « jours restants » du récapitulatif annuel.
 */
export const DROIT_ANNUEL_CONGES_JOURS = 25;

/** Vrai si la date ISO tombe un samedi ou un dimanche. */
export function estWeekend(dateISO: string): boolean {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const jour = d.getDay();
  return jour === 0 || jour === 6;
}

/** Compte les jours ouvrés (lundi → vendredi) d'une liste de dates ISO. */
export function joursOuvres(isos: string[]): number {
  return isos.filter((iso) => !estWeekend(iso)).length;
}

/**
 * Décompte pondéré des jours d'absence : une journée compte 1, une demi-journée 0,5.
 * Deux demi-journées le même jour (matin + après-midi) ne comptent jamais plus d'une
 * journée, et les week-ends sont systématiquement ignorés.
 */
export function joursAbsence(liste: Indisponibilite[]): number {
  const parDate = new Map<string, number>();
  liste.forEach((item) => {
    if (estWeekend(item.date)) return;
    const cumul = Math.min(1, (parDate.get(item.date) ?? 0) + poidsPeriode(item.periode ?? "journee"));
    parDate.set(item.date, cumul);
  });
  let total = 0;
  parDate.forEach((valeur) => {
    total += valeur;
  });
  return Math.round(total * 10) / 10;
}

/** Formate un nombre de jours pour l'affichage (« 1,5 jour », « 0,5 jour »). */
export function formatJoursConges(valeur: number): string {
  const arrondi = Math.round(valeur * 10) / 10;
  const texte = arrondi.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${texte} jour${arrondi > 1 ? "s" : ""}`;
}

/** Vrai si le motif correspond à un congé au sens strict (base du droit annuel). */
function estMotifConge(motif: string): boolean {
  return motif.trim().toLowerCase().startsWith("cong");
}

/** Ligne du récapitulatif annuel des congés pour une personne. */
export interface LigneRecapConges {
  intervenantId: number;
  nom: string;
  couleur: string | null;
  /** Jours de congé posés sur l'année (jours ouvrés uniquement). */
  congesPoses: number;
  /** Jours d'absence d'un autre motif (formation, maladie, récupération…). */
  autresAbsences: number;
  /** Droit annuel de référence appliqué. */
  droit: number;
  /** Jours de congé restants (jamais négatif). */
  restants: number;
  /** Vrai si les congés posés dépassent le droit annuel. */
  depassement: boolean;
}

/**
 * Construit le récapitulatif annuel des congés, une ligne par intervenant : jours posés,
 * jours restants et éventuel dépassement du droit annuel de référence.
 */
export function recapAnnuelConges(
  indisponibilites: Indisponibilite[],
  intervenants: { id: number; nom: string; couleur: string | null }[],
  annee: number,
  droit: number = DROIT_ANNUEL_CONGES_JOURS,
): LigneRecapConges[] {
  const prefixe = `${annee}-`;
  return intervenants
    .map((interv) => {
      const absencesAnnee = indisponibilites.filter(
        (i) => i.intervenant_id === interv.id && i.date.startsWith(prefixe),
      );
      const congesPoses = joursAbsence(absencesAnnee.filter((i) => estMotifConge(i.motif)));
      const autresAbsences = joursAbsence(absencesAnnee.filter((i) => !estMotifConge(i.motif)));
      const restants = Math.max(0, Math.round((droit - congesPoses) * 10) / 10);
      return {
        intervenantId: interv.id,
        nom: interv.nom,
        couleur: interv.couleur,
        congesPoses,
        autresAbsences,
        droit,
        restants,
        depassement: congesPoses > droit,
      };
    })
    .sort((a, b) => b.congesPoses - a.congesPoses || a.nom.localeCompare(b.nom));
}

/** Absences d'un intervenant sur une journée donnée (une ligne par demi-journée possible). */
export function absencesIntervenantDuJour(
  indisponibilites: Indisponibilite[],
  intervenantId: number | null | undefined,
  dateISO: string,
): Indisponibilite[] {
  if (intervenantId === null || intervenantId === undefined) return [];
  return indisponibilites.filter((i) => i.intervenant_id === intervenantId && i.date === dateISO);
}

/** Absence résumée d'un intervenant sur une journée, tous motifs confondus. */
export interface AbsenceJourResume {
  /** Identifiant de la première ligne d'absence de la journée. */
  id: number;
  /** Motif lisible (« Congé », « Formation »…). */
  motif: string;
  /** Portion de journée réellement couverte (matin + après-midi = journée entière). */
  periode: PeriodeAbsence;
  /** Précision libre, ou null. */
  note: string | null;
}

/**
 * Résume les absences d'un intervenant sur une journée : pratique pour signaler d'un badge
 * qu'une intervention tombe un jour où la personne affectée n'est pas là.
 */
export function resumeAbsencesDuJour(
  indisponibilites: Indisponibilite[],
  intervenantId: number | null | undefined,
  dateISO: string,
): AbsenceJourResume | null {
  const liste = absencesIntervenantDuJour(indisponibilites, intervenantId, dateISO);
  if (liste.length === 0) return null;
  const periodes = new Set(liste.map((i) => i.periode ?? "journee"));
  const journeeEntiere = periodes.has("journee") || (periodes.has("matin") && periodes.has("apres-midi"));
  return {
    id: liste[0].id,
    motif: liste[0].motif,
    periode: journeeEntiere ? "journee" : liste[0].periode ?? "journee",
    note: liste.find((i) => i.note)?.note ?? null,
  };
}

/** Nombre de jours couverts par une indisponibilité d'un intervenant donné (sur un mois affiché). */
export function compteJoursIndisponible(
  indisponibilites: Indisponibilite[],
  intervenantId: number | null,
  isoList: string[],
): number {
  const set = new Set(isoList);
  return indisponibilites.filter(
    (i) => i.intervenant_id === intervenantId && set.has(i.date),
  ).length;
}