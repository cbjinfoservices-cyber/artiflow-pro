import { supabase } from "@/lib/supabase";
import { prochainRecapTauxHebdo } from "@/lib/tauxAlerteRecapHebdo";

/** Fenêtres (en jours) proposées pour le récap d'échecs « test à blanc ». */
export const FENETRES_RECAP_ECHECS = [7, 14, 30] as const;

/** Ramène une valeur quelconque à une fenêtre valide (7, 14 ou 30 jours ; défaut 7). */
export function normaliserFenetreRecapEchecs(v: unknown): number {
  const n = Math.round(Number(v));
  return (FENETRES_RECAP_ECHECS as readonly number[]).includes(n) ? n : 7;
}

/** Seuils (en jours) proposés pour le rappel « archivage en retard ». */
export const SEUILS_RECAP_ALERTE = [15, 30, 60] as const;

/** Seuil par défaut du rappel d'archivage (en jours). */
export const SEUIL_RECAP_ALERTE_DEFAUT = 30;

/** Ramène une valeur quelconque à un seuil valide de rappel d'archivage (15, 30 ou 60 j ; défaut 30). */
export function normaliserSeuilRecapAlerte(v: unknown): number {
  const n = Math.round(Number(v));
  return (SEUILS_RECAP_ALERTE as readonly number[]).includes(n) ? n : SEUIL_RECAP_ALERTE_DEFAUT;
}

/** Adresse mise en copie (Cc) : libellé libre optionnel + adresse email. */
export interface RecapEchecsBlancCc {
  /** Libellé libre (« Comptable », « Collaborateur »…), optionnel. */
  nom?: string;
  /** Adresse email de la copie. */
  email: string;
}

/** Vrai si la valeur ressemble à une adresse email valide. */
function emailCcValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

/** Réglage de l'envoi hebdomadaire du récap d'échecs « test à blanc » (CSV). */
export interface RecapEchecsBlancSettings {
  /** Envoi hebdomadaire activé. */
  actif: boolean;
  /** Jour de la semaine (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Fenêtre couverte (en jours) : 7, 14 ou 30. */
  fenetre: number;
  /** Seuil (en jours) du rappel « archivage en retard » : 15, 30 ou 60. */
  seuil: number;
  /** Adresses mises en copie (Cc) du récap d'échecs lui-même. */
  ccHebdo?: RecapEchecsBlancCc[];
  /** Adresses mises en copie (Cc) du rappel « archivage en retard ». */
  cc?: RecapEchecsBlancCc[];
}

/**
 * Enregistre le réglage de l'envoi hebdomadaire du récap d'échecs (interrupteur, jour, heure).
 * La tâche planifiée côté serveur lit ces valeurs pour expédier, une fois par semaine, un email
 * qui regroupe par automatisation les échecs des rejeux « test à blanc » (CSV en pièce jointe).
 */
export async function updateRecapEchecsBlancSettings(
  userId: string,
  settings: RecapEchecsBlancSettings,
): Promise<void> {
  const jour = Math.min(7, Math.max(1, Math.round(Number.isFinite(settings.jour) ? settings.jour : 1)));
  const heure = Math.min(23, Math.max(0, Math.round(Number.isFinite(settings.heure) ? settings.heure : 8)));
  const fenetre = normaliserFenetreRecapEchecs(settings.fenetre);
  const seuil = normaliserSeuilRecapAlerte(settings.seuil);
  // Normalise une liste d'adresses en copie : libellé facultatif + adresse email valide.
  const normaliserCc = (liste?: RecapEchecsBlancCc[]): RecapEchecsBlancCc[] =>
    (liste ?? [])
      .map((a) => ({ nom: a.nom?.trim() || undefined, email: String(a.email ?? "").trim() }))
      .filter((a) => emailCcValide(a.email));
  const ccHebdo = normaliserCc(settings.ccHebdo);
  const cc = normaliserCc(settings.cc);
  const { error } = await supabase
    .from("profiles")
    .update({
      echecs_blanc_recap_hebdo_actif: settings.actif,
      echecs_blanc_recap_hebdo_jour: jour,
      echecs_blanc_recap_hebdo_heure: heure,
      echecs_blanc_recap_hebdo_fenetre: fenetre,
      echecs_blanc_recap_alerte_seuil: seuil,
      echecs_blanc_recap_hebdo_cc: ccHebdo,
      echecs_blanc_recap_alerte_cc: cc,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Une entrée du journal des récaps d'échecs envoyés (manuel ou automatique). */
export interface JournalRecapsEchecsEntree {
  id: number;
  /** « manuel » (bouton) ou « hebdo » (envoi planifié). */
  source: string;
  created_at: string;
}

/**
 * Charge le journal des récaps d'échecs envoyés par email, du plus récent au plus ancien
 * (RLS : chacun ne voit que ses propres envois). Sert au repère d'archivage du bandeau.
 */
export async function chargerJournalRecapsEchecs(
  userId: string,
  limit = 120,
): Promise<JournalRecapsEchecsEntree[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("recap_echecs_blanc_envois")
    .select("id, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Impossible de charger le journal des récaps d'échecs.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    source: String(row.source ?? "manuel"),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Nombre de récaps d'échecs envoyés sur le mois calendaire de `ref` (par défaut, ce mois-ci). */
export function compterRecapsEchecsMois(
  entrees: JournalRecapsEchecsEntree[],
  ref: Date = new Date(),
): number {
  const cle = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  return entrees.filter((e) => {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) return false;
    const c = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return c === cle;
  }).length;
}

/** Vrai si une valeur de `source` correspond à un archivage automatique (tâche planifiée). */
function estSourceArchivageAuto(source: unknown): boolean {
  const s = String(source ?? "").trim().toLowerCase();
  return s === "hebdo" || s === "auto" || s === "automatique";
}

/** Un mois manquant d'un exercice : clé « AAAA-MM » et libellé long (« mars »). */
export interface MoisManquant {
  cle: string;
  label: string;
}

/** Détail, par exercice, des mois sans aucun récap d'échecs archivé. */
export interface MoisManquantsExercice {
  /** Exercice (année civile) concerné. */
  exercice: number;
  /** Nombre total de récaps archivés sur l'exercice. */
  total: number;
  /** Récaps repris à la main. */
  manuel: number;
  /** Récaps archivés automatiquement (tâche planifiée). */
  auto: number;
  /** Nombre de mois de l'exercice ayant au moins un archivage. */
  moisCouverts: number;
  /** Mois de l'exercice sans aucun archivage (les mois futurs de l'année en cours sont ignorés). */
  moisManquants: MoisManquant[];
}

/**
 * Regroupe le journal d'archivage par exercice (année civile) et repère, pour chacun, les mois
 * restés SANS aucun récap d'échecs archivé. Pour l'année en cours, seuls les mois déjà écoulés
 * sont considérés (les mois à venir ne sont pas comptés comme « manquants »). Résultat trié du
 * plus récent exercice au plus ancien.
 */
export function detailMoisManquantsParExercice(
  entrees: JournalRecapsEchecsEntree[],
  ref: Date = new Date(),
): MoisManquantsExercice[] {
  const acc = new Map<number, { total: number; manuel: number; auto: number; mois: Set<number> }>();
  entrees.forEach((e) => {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) return;
    const annee = d.getFullYear();
    let bucket = acc.get(annee);
    if (!bucket) {
      bucket = { total: 0, manuel: 0, auto: 0, mois: new Set<number>() };
      acc.set(annee, bucket);
    }
    bucket.total += 1;
    if (estSourceArchivageAuto(e.source)) bucket.auto += 1;
    else bucket.manuel += 1;
    bucket.mois.add(d.getMonth());
  });

  const res: MoisManquantsExercice[] = [];
  acc.forEach((bucket, annee) => {
    const dernierMois = annee === ref.getFullYear() ? ref.getMonth() : 11;
    const moisManquants: MoisManquant[] = [];
    for (let m = 0; m <= dernierMois; m += 1) {
      if (bucket.mois.has(m)) continue;
      const d = new Date(annee, m, 1);
      moisManquants.push({
        cle: `${annee}-${String(m + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "long" }),
      });
    }
    res.push({
      exercice: annee,
      total: bucket.total,
      manuel: bucket.manuel,
      auto: bucket.auto,
      moisCouverts: bucket.mois.size,
      moisManquants,
    });
  });

  return res.sort((a, b) => b.exercice - a.exercice);
}

/** Un mois de la série de régularité : clé « AAAA-MM », libellé court et nombre de récaps. */
export interface MoisArchivage {
  cle: string;
  label: string;
  count: number;
}

/**
 * Série mensuelle des récaps d'échecs archivés sur les `nbMois` derniers mois (par défaut 12),
 * du plus ancien au plus récent, avec le libellé court du mois. Partagée entre le bandeau du
 * Diagnostic et le PDF de régularité annuelle pour garantir des chiffres identiques partout.
 */
export function serieArchivageMois(
  entrees: JournalRecapsEchecsEntree[],
  nbMois = 12,
  ref: Date = new Date(),
): MoisArchivage[] {
  const mois: MoisArchivage[] = [];
  for (let i = nbMois - 1; i >= 0; i -= 1) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    mois.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      count: 0,
    });
  }
  const index = new Map(mois.map((m) => [m.cle, m]));
  entrees.forEach((e) => {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) return;
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = index.get(cle);
    if (m) m.count += 1;
  });
  return mois;
}

/** Synthèse de la régularité d'archivage déduite d'une série mensuelle. */
export interface SyntheseRegularite {
  /** Nombre total de récaps archivés sur la période. */
  total: number;
  /** Nombre de mois de la série. */
  nbMois: number;
  /** Nombre de mois comportant au moins un archivage. */
  moisCouverts: number;
  /** Moyenne de récaps archivés par mois (sur toute la fenêtre). */
  moyenne: number;
  /** Mois le plus actif de la série (ou null si aucun archivage). */
  moisPlusActif: MoisArchivage | null;
}

/** Calcule la synthèse (total, moyenne mensuelle, mois le plus actif) d'une série mensuelle. */
export function synthetiserRegularite(serie: MoisArchivage[]): SyntheseRegularite {
  const total = serie.reduce((s, m) => s + m.count, 0);
  const nbMois = serie.length;
  const moisCouverts = serie.filter((m) => m.count > 0).length;
  const moyenne = nbMois > 0 ? total / nbMois : 0;
  const moisPlusActif = serie.reduce<MoisArchivage | null>(
    (max, m) => (m.count > 0 && (!max || m.count > max.count) ? m : max),
    null,
  );
  return { total, nbMois, moisCouverts, moyenne, moisPlusActif };
}

/**
 * Consigne l'envoi d'un récap d'échecs côté Backend (fire-and-forget) pour alimenter le
 * compteur « récaps envoyés ce mois ». Appelée après un envoi manuel réussi ; l'envoi
 * automatique hebdomadaire est, lui, consigné directement par la tâche planifiée.
 */
export async function consignerRecapEchecsEnvoye(source = "manuel"): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    await supabase.from("recap_echecs_blanc_envois").insert({ user_id: uid, source });
  } catch {
    /* journal = confort : on ignore une erreur ponctuelle */
  }
}

/** Aperçu (aucun envoi) du récap hebdomadaire d'échecs pour l'artisan connecté. */
export interface RecapEchecsBlancPreview {
  html: string;
  subject: string;
  /** Nombre d'échecs résumés dans l'aperçu (7 derniers jours). */
  echecs: number;
}

export async function previewRecapEchecsBlanc(userId: string): Promise<RecapEchecsBlancPreview> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-echecs-blanc", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapEchecsBlancPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap hebdomadaire a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    echecs: Number(payload.echecs ?? 0),
  };
}

/** Résultat d'un déclenchement immédiat du récap hebdomadaire d'échecs. */
export interface RecapEchecsBlancRunResult {
  configured: boolean;
  sent: number;
  skipped: number;
  reason?: string;
}

/**
 * Déclenche immédiatement l'envoi du récap hebdomadaire d'échecs pour l'artisan courant
 * (bouton « Tester maintenant »), sans attendre le jour/heure programmés.
 */
export async function runRecapEchecsBlancNow(userId: string): Promise<RecapEchecsBlancRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-echecs-blanc", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RecapEchecsBlancRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap hebdomadaire a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/** Prochaine occurrence (ISO) de l'envoi hebdo pour un jour/heure donnés (heure locale). */
export function prochainRecapEchecsBlanc(jour: number, heure: number, now: Date = new Date()): string {
  return prochainRecapTauxHebdo(jour, heure, now);
}

/**
 * Déclenche IMMÉDIATEMENT l'envoi du rappel « archivage en retard » à l'artisan courant
 * (bouton « Tester le rappel »), sans tenir compte du seuil ni de l'anti-doublon, pour
 * vérifier que l'email de rappel arrive bien. Le destinataire est toujours sa propre adresse.
 */
export async function testerAlerteArchivageRetard(userId: string): Promise<{ jours?: number }> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-echecs-blanc", {
    body: { userId, testAlerte: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        configured?: boolean;
        sent?: number;
        jours?: number;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le test du rappel d'archivage a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié).",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de rappel n'a pas pu être envoyé.");
  }
  return { jours: payload.jours };
}