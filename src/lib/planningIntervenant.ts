import { supabase } from "@/lib/supabase";
import type { Intervenant } from "@/lib/intervenants";

/**
 * Statut d'une intervention du planning.
 * - « confirmee » : mission ferme, l'intervenant peut s'y rendre.
 * - « provisoire » : mission à confirmer (créneau en attente de validation).
 * - « faite » : mission réalisée.
 */
export type StatutCreneau = "confirmee" | "provisoire" | "faite";

/** Un créneau du planning personnel : heure, lieu, statut, note et trace de modification. */
export interface CreneauPerso {
  id: number;
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
  chantier_id: number | null;
  intervenant_id: number | null;
  statut: StatutCreneau;
  note: string | null;
  /** Date et heure de la dernière modification (ISO), ou null. */
  updated_at: string | null;
  /** Auteur de la dernière modification (id du compte), ou null. */
  updated_by: string | null;
}

/** La fiche intervenant rattachée au compte personnel connecté. */
export interface MonIntervenant {
  id: number;
  /** Compte artisan propriétaire du planning (l'entreprise). */
  user_id: string;
  nom: string;
  metier: string | null;
  couleur: string | null;
  actif: boolean;
  compte_email: string | null;
}

/** Libellé, icône et teinte d'affichage associés à un statut de créneau. */
export interface StatutCreneauMeta {
  label: string;
  icon: string;
  tone: string;
}

/** Statuts proposés dans les interfaces. */
export const STATUTS_CRENEAU: StatutCreneau[] = ["confirmee", "provisoire", "faite"];

/** Ramène une valeur quelconque vers un statut de créneau valide (« confirmee » à défaut). */
export function normaliseStatutCreneau(value: unknown): StatutCreneau {
  const v = String(value ?? "").toLowerCase();
  if (v === "provisoire") return "provisoire";
  if (v === "faite" || v === "fait" || v === "terminee" || v === "terminée") return "faite";
  return "confirmee";
}

/** Libellé, icône et teinte d'affichage associés à un statut de créneau. */
export function statutCreneauMeta(statut: StatutCreneau): StatutCreneauMeta {
  switch (statut) {
    case "provisoire":
      return { label: "À confirmer", icon: "ri-question-line", tone: "bg-accent-100 text-accent-800" };
    case "faite":
      return { label: "Faite", icon: "ri-checkbox-circle-line", tone: "bg-secondary-100 text-secondary-900" };
    default:
      return { label: "Confirmée", icon: "ri-checkbox-circle-line", tone: "bg-primary-100 text-primary-800" };
  }
}

/** Vrai si le créneau a été modifié récemment (fenêtre glissante, 48 h par défaut). */
export function estCreneauRecent(creneau: { updated_at: string | null }, heures = 48): boolean {
  if (!creneau.updated_at) return false;
  const t = new Date(creneau.updated_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= heures * 3_600_000;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Récupère la fiche intervenant rattachée à un compte via son email, ou null.
 * Renvoie null quand aucune ligne ne correspond, ou quand la ligne trouvée
 * appartient au compte lui-même (le patron propriétaire n'est pas un intervenant).
 */
export async function fetchMonIntervenant(email: string, userId: string): Promise<MonIntervenant | null> {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, user_id, nom, metier, couleur, actif, compte_email")
    .eq("compte_email", email.trim().toLowerCase())
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const owner = toStr(row.user_id);
  if (!owner || owner === userId) return null;
  return {
    id: toNum(row.id),
    user_id: owner,
    nom: toStr(row.nom) ?? "",
    metier: toStr(row.metier),
    couleur: toStr(row.couleur),
    actif: Boolean(row.actif),
    compte_email: toStr(row.compte_email),
  };
}

/** Récupère une fiche intervenant par son identifiant (utile au responsable). */
export async function fetchIntervenantById(intervenantId: number): Promise<Intervenant | null> {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, nom, couleur, metier, telephone, compte_email, actif, invitation_envoyee_le, created_at")
    .eq("id", intervenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: toNum(row.id),
    nom: toStr(row.nom) ?? "",
    couleur: toStr(row.couleur),
    metier: toStr(row.metier),
    telephone: toStr(row.telephone),
    compte_email: toStr(row.compte_email),
    actif: Boolean(row.actif),
    invitation_envoyee_le: toStr(row.invitation_envoyee_le),
    created_at: toStr(row.created_at) ?? "",
  };
}

/** Récupère les créneaux d'un intervenant (RLS : le patron ou l'intervenant lui-même). */
export async function fetchCreneauxIntervenant(intervenantId: number): Promise<CreneauPerso[]> {
  const { data, error } = await supabase
    .from("planning_creneaux")
    .select("id, date, heure, libelle, ville, chantier_id, intervenant_id, statut, note, updated_at, updated_by")
    .eq("intervenant_id", intervenantId)
    .neq("statut", "indisponible")
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: toNum(row.id),
    date: toStr(row.date) ?? "",
    heure: toStr(row.heure) ?? "08:00",
    libelle: toStr(row.libelle) ?? "",
    ville: toStr(row.ville),
    chantier_id: toNullableNum(row.chantier_id),
    intervenant_id: toNullableNum(row.intervenant_id),
    statut: normaliseStatutCreneau(row.statut),
    note: toStr(row.note),
    updated_at: toStr(row.updated_at),
    updated_by: toStr(row.updated_by),
  }));
}

/**
 * Met à jour un créneau du planning (heure, libellé, statut, note) et trace la
 * modification (date + auteur) pour alimenter le bandeau « changements récents ».
 */
export async function majCreneauIntervenant(
  creneauId: number,
  patch: Partial<{ heure: string; libelle: string; statut: StatutCreneau; note: string | null }>,
  updatedBy: string,
): Promise<void> {
  const row: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  if (typeof patch.note === "string") row.note = patch.note.trim() || null;
  const { error } = await supabase.from("planning_creneaux").update(row).eq("id", creneauId);
  if (error) throw error;
}

/**
 * Clôture une semaine : marque d'un seul geste toutes les interventions listées comme
 * « faite » et trace la modification (date + auteur). Utilisé par le bouton « Clôturer ma
 * semaine » de l'intervenant pour solder ce qui reste à faire.
 */
export async function cloturerSemaine(creneauIds: number[], updatedBy: string): Promise<void> {
  if (creneauIds.length === 0) return;
  const { error } = await supabase
    .from("planning_creneaux")
    .update({ statut: "faite", updated_at: new Date().toISOString(), updated_by: updatedBy })
    .in("id", creneauIds);
  if (error) throw error;
}

/** Récapitulatif envoyé au responsable à la clôture de la semaine d'un intervenant. */
export interface RecapClotureSemaine {
  intervenantId: number;
  /** Qui déclenche la clôture : l'intervenant lui-même, ou son responsable. */
  origine?: "intervenant" | "responsable";
  /** Libellé de la semaine clôturée (« Cette semaine · Octobre 2026 »). */
  semaineLabel: string;
  /** Nombre d'interventions de la semaine (toutes confondues). */
  totalSemaine: number;
  /** Nombre d'interventions terminées après la clôture. */
  faites: number;
  /** Nombre d'interventions soldées par ce geste de clôture. */
  cloturees: number;
  /** Détail des interventions soldées, pour information du responsable. */
  interventions: { date: string; heure: string; libelle: string; ville: string | null }[];
}

/**
 * Préviens le responsable par email que l'intervenant vient de clôturer sa semaine,
 * avec un petit bilan (nombre d'interventions faites / restantes).
 */
export async function envoyerRecapClotureSemaine(params: RecapClotureSemaine): Promise<void> {
  const { data, error } = await supabase.functions.invoke("recap-cloture-semaine", {
    body: params,
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du bilan au responsable a échoué.");
}