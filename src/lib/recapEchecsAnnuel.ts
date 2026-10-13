import { supabase } from "@/lib/supabase";

/** Jour de janvier par défaut de l'envoi du récap annuel de régularité. */
export const JOUR_ENVOI_ANNUEL_DEFAUT = 4;

/** Heure par défaut (heure de Paris) de l'envoi du récap annuel de régularité. */
export const HEURE_ENVOI_ANNUEL_DEFAUT = 7;

/** Ramène une valeur quelconque à un jour de janvier valide (1-28 ; défaut 4). */
export function normaliserJourEnvoiAnnuel(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : JOUR_ENVOI_ANNUEL_DEFAUT;
}

/** Ramène une valeur quelconque à une heure d'envoi valide (0-23 ; défaut 7). */
export function normaliserHeureEnvoiAnnuel(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : HEURE_ENVOI_ANNUEL_DEFAUT;
}

/**
 * Active ou coupe l'ENVOI ANNUEL du PDF de régularité d'archivage des récaps d'échecs
 * (« test à blanc »). Ce document, adressé à l'artisan en début d'année, récapitule la
 * régularité de son archivage des récaps d'échecs sur l'exercice écoulé. Le réglage est lu
 * par la tâche planifiée annuelle : coupé, elle n'envoie plus le PDF de fin d'année.
 */
export async function updateRecapEchecsAnnuelActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ echecs_blanc_recap_annuel_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Enregistre la DATE d'envoi du récap annuel de régularité (jour de janvier + heure, heure de
 * Paris). La tâche planifiée lit ces valeurs : elle n'expédie le PDF qu'en janvier, le jour et à
 * l'heure réglés ici (4 janvier 7 h par défaut).
 */
export async function updateRecapEchecsAnnuelDate(
  userId: string,
  jour: number,
  heure: number,
): Promise<void> {
  const jourPropre = normaliserJourEnvoiAnnuel(jour);
  const heurePropre = normaliserHeureEnvoiAnnuel(heure);
  const { error } = await supabase
    .from("profiles")
    .update({
      echecs_blanc_recap_annuel_jour: jourPropre,
      echecs_blanc_recap_annuel_heure: heurePropre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Enregistre le DÉLAI de relance du récap annuel (15, 30 ou 45 jours après la date d'envoi réglée).
 * Ce délai pilote le badge « Récap annuel à confirmer » et la relance automatique par email :
 * au-delà, la tâche planifiée adresse une relance douce si le PDF de l'exercice n'est pas parti.
 */
export async function updateRecapEchecsAnnuelDelai(userId: string, delai: number): Promise<void> {
  const propre = normaliserDelaiRelanceAnnuel(delai);
  const { error } = await supabase
    .from("profiles")
    .update({ echecs_blanc_recap_annuel_relance_delai: propre, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe l'envoi du récap annuel de régularité AU COMPTABLE en copie (Cc). Quand cette
 * option est activée, l'adresse du comptable (et son éventuelle adresse secondaire) reçoit une
 * copie du PDF annuel, en plus de l'artisan. Le réglage est lu par la tâche planifiée annuelle.
 */
export async function updateRecapEchecsAnnuelCcComptable(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ echecs_blanc_recap_annuel_cc_comptable: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Exercice (année) attendu pour le récap annuel : l'année qui vient de s'achever. */
export function exerciceAnnuelAttendu(ref: Date = new Date()): number {
  return ref.getFullYear() - 1;
}

/**
 * Date d'envoi (ISO) PRÉVUE pour un exercice donné : janvier de l'année suivante, au jour et à
 * l'heure réglés (heure de Paris côté tâche planifiée). Sert à afficher l'échéance exacte et à
 * calculer le délai de confirmation.
 */
export function dateEnvoiExercice(exercice: number, jour: number, heure: number): string {
  const j = normaliserJourEnvoiAnnuel(jour);
  const h = normaliserHeureEnvoiAnnuel(heure);
  return new Date(exercice + 1, 0, j, h, 0, 0, 0).toISOString();
}

/** Date/heure (ISO) du PROCHAIN envoi annuel programmé (jour de janvier + heure réglés). */
export function prochainEnvoiAnnuel(jour: number, heure: number, now: Date = new Date()): string {
  const j = normaliserJourEnvoiAnnuel(jour);
  const h = normaliserHeureEnvoiAnnuel(heure);
  let candidat = new Date(now.getFullYear(), 0, j, h, 0, 0, 0);
  if (candidat.getTime() <= now.getTime()) {
    candidat = new Date(now.getFullYear() + 1, 0, j, h, 0, 0, 0);
  }
  return candidat.toISOString();
}

/** Délais (en jours) proposés pour la relance automatique du récap annuel. */
export const DELAIS_RELANCE_ANNUEL = [15, 30, 45] as const;

/** Délai par défaut de la relance automatique du récap annuel (en jours). */
export const DELAI_RELANCE_ANNUEL_DEFAUT = 15;

/** Ramène une valeur quelconque à un délai de relance valide (15, 30 ou 45 j ; défaut 15). */
export function normaliserDelaiRelanceAnnuel(v: unknown): number {
  const n = Math.round(Number(v));
  return (DELAIS_RELANCE_ANNUEL as readonly number[]).includes(n) ? n : DELAI_RELANCE_ANNUEL_DEFAUT;
}

/** Délai (en jours) après la date réglée au-delà duquel on demande une confirmation (valeur par défaut). */
export const DELAI_CONFIRMATION_ANNUEL_JOURS = DELAI_RELANCE_ANNUEL_DEFAUT;

/** État de cadence du récap annuel d'un exercice donné. */
export type EtatCadenceAnnuel = "confirme" | "attente" | "a-confirmer";

/**
 * Décide de l'état de cadence du récap annuel pour un exercice :
 * - « confirme » : le PDF de l'exercice a déjà été transmis ;
 * - « a-confirmer » : la date réglée est passée de plus de 15 jours sans envoi (relance douce) ;
 * - « attente » : l'échéance approche encore, rien à signaler.
 */
export function etatCadenceAnnuel(params: {
  exercice: number;
  jour: number;
  heure: number;
  dernierAnnuel: string | null;
  /** Délai (en jours) après la date réglée avant de demander une confirmation : 15, 30 ou 45. */
  delai?: number;
  now?: Date;
}): EtatCadenceAnnuel {
  const now = params.now ?? new Date();
  const envoye = params.dernierAnnuel != null && Number(params.dernierAnnuel) >= params.exercice;
  if (envoye) return "confirme";
  const delai = normaliserDelaiRelanceAnnuel(params.delai);
  const prevue = new Date(dateEnvoiExercice(params.exercice, params.jour, params.heure)).getTime();
  const limite = prevue + delai * 86400000;
  return now.getTime() > limite ? "a-confirmer" : "attente";
}

/** Résultat d'un envoi immédiat (test) du récap annuel de régularité par email. */
export interface RecapEchecsAnnuelRunResult {
  configured: boolean;
  sent: number;
  skipped: number;
  annee?: string;
  total?: number;
  reason?: string;
}

/**
 * Déclenche IMMÉDIATEMENT l'envoi du récap annuel (PDF) de régularité d'archivage des récaps
 * d'échecs à l'artisan courant (bouton « Tester maintenant »), sans tenir compte du jour ni de
 * l'anti-doublon, pour vérifier que l'email et le PDF arrivent bien.
 */
export async function testerRecapEchecsAnnuel(userId: string): Promise<RecapEchecsAnnuelRunResult> {
  const { data, error } = await supabase.functions.invoke("envoi-recap-echecs-annuel", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RecapEchecsAnnuelRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string; total?: number }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap annuel a échoué.");
  if (payload.configured === false) {
    throw new Error("L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié).");
  }
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  if (!payload.sent) {
    throw new Error(detail?.reason || "L'email de récap annuel n'a pas pu être envoyé.");
  }
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    annee: payload.annee ? String(payload.annee) : undefined,
    total: Number(detail?.total ?? payload.total ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/**
 * Déclenche IMMÉDIATEMENT l'envoi de l'email de RELANCE du récap annuel à l'artisan courant
 * (bouton « Recevoir la relance maintenant »), sans tenir compte du délai réglé ni de
 * l'anti-doublon, pour vérifier que l'email de relance « à confirmer » arrive bien. Le
 * destinataire est toujours sa propre adresse (et les copies Cc configurées).
 * `jours` permet de SIMULER une autre échéance de délai (15/30/45 j) pour tester différents
 * réglages avant de figer le délai.
 */
export async function testerRelanceAnnuel(
  userId: string,
  jours?: number,
): Promise<{ jours?: number; annee?: string }> {
  const { data, error } = await supabase.functions.invoke("envoi-recap-echecs-annuel", {
    body: {
      userId,
      testRelance: true,
      ...(jours != null ? { jours: normaliserDelaiRelanceAnnuel(jours) } : {}),
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        configured?: boolean;
        sent?: number;
        jours?: number;
        annee?: string;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le test de la relance annuelle a échoué.");
  if (payload.configured === false) {
    throw new Error("L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié).");
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de relance n'a pas pu être envoyé.");
  }
  return { jours: payload.jours, annee: payload.annee };
}

/** Aperçu (aucun envoi) de l'email de relance du récap annuel pour l'artisan connecté. */
export interface RelanceAnnuelPreview {
  html: string;
  subject: string;
  /** Échéance de délai simulée dans l'aperçu (15/30/45 j). */
  jours?: number;
  annee?: string;
}

/**
 * Construit l'APERÇU de l'email de relance du récap annuel (celui du badge « à confirmer ») sans
 * rien envoyer. `jours` permet de simuler une autre échéance de délai (15/30/45 j) pour comparer
 * les rendus avant de figer le réglage — comme l'aperçu du récap hebdomadaire.
 */
export async function previewRelanceAnnuel(
  userId: string,
  jours?: number,
): Promise<RelanceAnnuelPreview> {
  const { data, error } = await supabase.functions.invoke("envoi-recap-echecs-annuel", {
    body: {
      userId,
      previewRelance: true,
      ...(jours != null ? { jours: normaliserDelaiRelanceAnnuel(jours) } : {}),
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RelanceAnnuelPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu de la relance a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    jours: payload.jours,
    annee: payload.annee,
  };
}

/** Une entrée du journal des relances du récap annuel (automatique ou manuelle). */
export interface JournalRelanceAnnuelEntree {
  id: number;
  /** Exercice (année) concerné par la relance. */
  exercice: string;
  /** « auto » (tâche planifiée) ou « manuel » (test depuis l'application). */
  source: string;
  created_at: string;
}

/**
 * Charge le journal des relances du récap annuel adressées par email, du plus récent au plus
 * ancien (RLS : chacun ne voit que ses propres relances). Sert au compteur « relances par
 * exercice » du 3ᵉ repère du Diagnostic.
 */
export async function chargerRelancesAnnuel(
  userId: string,
  limit = 120,
): Promise<JournalRelanceAnnuelEntree[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("recap_echecs_annuel_relances")
    .select("id, exercice, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Impossible de charger le journal des relances annuelles.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    exercice: String(row.exercice ?? ""),
    source: String(row.source ?? "auto"),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Résumé, pour un exercice, du nombre de relances adressées et de la date du dernier envoi. */
export interface ResumeRelancesExercice {
  exercice: number;
  /** Nombre total de relances adressées pour cet exercice. */
  total: number;
  /** Relances envoyées automatiquement (tâche planifiée). */
  auto: number;
  /** Relances envoyées à la main (test depuis l'application). */
  manuel: number;
  /** Date (ISO) de la dernière relance adressée pour cet exercice, ou null. */
  dernier: string | null;
}

/**
 * Regroupe le journal des relances par exercice : nombre adressé (auto + manuel) et date du
 * dernier envoi. Résultat trié du plus récent exercice au plus ancien.
 */
export function resumerRelancesParExercice(
  entrees: JournalRelanceAnnuelEntree[],
): ResumeRelancesExercice[] {
  const acc = new Map<number, { total: number; auto: number; manuel: number; dernier: string | null }>();
  entrees.forEach((e) => {
    const annee = Number(e.exercice);
    if (!Number.isFinite(annee)) return;
    let bucket = acc.get(annee);
    if (!bucket) {
      bucket = { total: 0, auto: 0, manuel: 0, dernier: null };
      acc.set(annee, bucket);
    }
    bucket.total += 1;
    if (e.source === "auto") bucket.auto += 1;
    else bucket.manuel += 1;
    const t = new Date(e.created_at).getTime();
    if (!bucket.dernier || t > new Date(bucket.dernier).getTime()) bucket.dernier = e.created_at;
  });
  return Array.from(acc.entries())
    .map(([exercice, b]) => ({ exercice, ...b }))
    .sort((a, b) => b.exercice - a.exercice);
}

/** Nombre de relances adressées pour un exercice donné. */
export function compterRelancesExercice(
  entrees: JournalRelanceAnnuelEntree[],
  exercice: number,
): number {
  return entrees.filter((e) => Number(e.exercice) === exercice).length;
}

/** Répartition par source (auto planifiée vs test à la main) des relances d'un exercice. */
export interface RepartitionRelancesExercice {
  /** Nombre total de relances adressées pour l'exercice. */
  total: number;
  /** Relances envoyées automatiquement (tâche planifiée). */
  auto: number;
  /** Relances envoyées à la main (test depuis l'application). */
  manuel: number;
}

/**
 * Compte, pour un exercice donné, les relances adressées automatiquement (tâche planifiée) et
 * celles rejouées à la main (test depuis l'application). Alimente la répartition du 3ᵉ repère.
 */
export function repartitionRelancesExercice(
  entrees: JournalRelanceAnnuelEntree[],
  exercice: number,
): RepartitionRelancesExercice {
  let auto = 0;
  let manuel = 0;
  entrees.forEach((e) => {
    if (Number(e.exercice) !== exercice) return;
    if (e.source === "auto") auto += 1;
    else manuel += 1;
  });
  return { total: auto + manuel, auto, manuel };
}

/** Date (ISO) de la dernière relance adressée pour un exercice donné, ou null si aucune. */
export function derniereRelanceExercice(
  entrees: JournalRelanceAnnuelEntree[],
  exercice: number,
): string | null {
  let dernier: string | null = null;
  entrees.forEach((e) => {
    if (Number(e.exercice) !== exercice) return;
    const t = new Date(e.created_at).getTime();
    if (!dernier || t > new Date(dernier).getTime()) dernier = e.created_at;
  });
  return dernier;
}

/** Délai moyen (en jours), pour un exercice, entre la date d'envoi réglée et la relance effective. */
export interface DelaiMoyenRelanceExercice {
  exercice: number;
  /** Délai moyen (en jours) entre la date d'envoi réglée de l'exercice et la relance. */
  delaiMoyen: number;
  /** Nombre de relances prises en compte. */
  total: number;
}

/**
 * Calcule, par exercice, le DÉLAI MOYEN (en jours) entre la date d'envoi réglée de l'exercice
 * (jour + heure de janvier) et la date à laquelle la relance a effectivement été adressée. Sert
 * à suivre l'écart moyen entre l'échéance prévue et la relance réelle, exercice après exercice.
 * Résultat trié du plus ancien exercice au plus récent, pour lire l'évolution chronologiquement.
 */
export function delaiMoyenRelancesParExercice(
  entrees: JournalRelanceAnnuelEntree[],
  jour: number,
  heure: number,
): DelaiMoyenRelanceExercice[] {
  const acc = new Map<number, { somme: number; n: number }>();
  entrees.forEach((e) => {
    const annee = Number(e.exercice);
    if (!Number.isFinite(annee)) return;
    const t = new Date(e.created_at).getTime();
    if (Number.isNaN(t)) return;
    const prevue = new Date(dateEnvoiExercice(annee, jour, heure)).getTime();
    const delai = (t - prevue) / 86400000;
    let bucket = acc.get(annee);
    if (!bucket) {
      bucket = { somme: 0, n: 0 };
      acc.set(annee, bucket);
    }
    bucket.somme += delai;
    bucket.n += 1;
  });
  return Array.from(acc.entries())
    .map(([exercice, b]) => ({
      exercice,
      delaiMoyen: b.n > 0 ? b.somme / b.n : 0,
      total: b.n,
    }))
    .sort((a, b) => a.exercice - b.exercice);
}

/** Périodes (en mois) proposées pour la fenêtre de la courbe du délai moyen (1, 2 ou 3 ans). */
export const PERIODES_MOIS_DELAI = [12, 24, 36] as const;

/** Fenêtre par défaut (en mois) de la courbe du délai moyen. */
export const PERIODE_MOIS_DELAI_DEFAUT = 36;

/** Ramène une valeur quelconque à une période valide (12, 24 ou 36 mois ; défaut 36). */
export function normaliserPeriodeMoisDelai(v: unknown): number {
  const n = Math.round(Number(v));
  return (PERIODES_MOIS_DELAI as readonly number[]).includes(n) ? n : PERIODE_MOIS_DELAI_DEFAUT;
}

/**
 * Ne conserve que les exercices dont la date d'échéance (envoi réglé de janvier) tombe dans les
 * `mois` derniers mois — 12 → le dernier exercice, 24 → les deux derniers, 36 → les trois derniers.
 * Alimente le sélecteur de période (12 / 24 / 36 mois) de la courbe du délai moyen.
 */
export function filtrerDelaisParPeriode(
  serie: DelaiMoyenRelanceExercice[],
  mois: number,
  jour: number,
  heure: number,
  now: Date = new Date(),
): DelaiMoyenRelanceExercice[] {
  const fenetre = normaliserPeriodeMoisDelai(mois);
  const limite = new Date(now.getFullYear(), now.getMonth() - fenetre, now.getDate()).getTime();
  return serie.filter((d) => new Date(dateEnvoiExercice(d.exercice, jour, heure)).getTime() >= limite);
}

/** Un point de la moyenne mobile du délai moyen avant relance. */
export interface MoyenneMobileDelaiPoint {
  exercice: number;
  /** Moyenne glissante du délai moyen (en jours) sur la fenêtre retenue. */
  moyenne: number;
}

/**
 * Lisse la série du délai moyen avant relance en calculant une MOYENNE MOBILE (fenêtre glissante
 * de `fenetre` exercices, 2 par défaut) : chaque point est la moyenne de l'exercice courant et des
 * exercices précédents de la fenêtre. Sert à tracer une ligne de tendance en pointillés qui atténue
 * les variations d'un exercice à l'autre.
 */
export function moyenneMobileDelais(
  serie: DelaiMoyenRelanceExercice[],
  fenetre = 2,
): MoyenneMobileDelaiPoint[] {
  const w = Math.max(2, Math.round(fenetre));
  return serie.map((point, i) => {
    const debut = Math.max(0, i - w + 1);
    const tranche = serie.slice(debut, i + 1);
    const somme = tranche.reduce((s, x) => s + x.delaiMoyen, 0);
    return {
      exercice: point.exercice,
      moyenne: tranche.length > 0 ? somme / tranche.length : point.delaiMoyen,
    };
  });
}

/** Sens de la tendance du délai moyen, déduit de la pente de la moyenne mobile. */
export type SensTendanceDelai = "allonge" | "raccourcit" | "stable";

/** Tendance du délai moyen avant relance, déduite de la pente de la moyenne mobile. */
export interface TendanceDelai {
  /** « allonge » (la relance traîne de plus en plus), « raccourcit » (plus rapide) ou « stable ». */
  sens: SensTendanceDelai;
  /** Pente de la moyenne mobile, en jours par exercice (positive = s'allonge). */
  pente: number;
  /** Écart, en jours, entre le dernier et le premier point de la moyenne mobile. */
  ecart: number;
}

/**
 * Déduit la TENDANCE du délai moyen avant relance de la PENTE de la moyenne mobile :
 * - « allonge » : la relance met de plus en plus de temps d'un exercice à l'autre ;
 * - « raccourcit » : la relance est de plus en plus rapide ;
 * - « stable » : la pente reste sous le seuil de sensibilité (0,2 j/exercice).
 * Alimente l'indicateur de tendance affiché dans l'en-tête de la courbe.
 */
export function tendanceMoyenneMobile(
  serie: DelaiMoyenRelanceExercice[],
  fenetre = 2,
): TendanceDelai {
  const points = moyenneMobileDelais(serie, fenetre);
  if (points.length < 2) return { sens: "stable", pente: 0, ecart: 0 };
  const premier = points[0].moyenne;
  const dernier = points[points.length - 1].moyenne;
  const ecart = dernier - premier;
  const pente = ecart / (points.length - 1);
  const seuil = 0.2;
  const sens: SensTendanceDelai = pente > seuil ? "allonge" : pente < -seuil ? "raccourcit" : "stable";
  return { sens, pente, ecart };
}