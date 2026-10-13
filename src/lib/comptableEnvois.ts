import { formatShortDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import type { ComptableEnvoi } from "@/lib/artisanApi";

/** Catégories de nature d'un envoi au comptable, utilisées par les filtres de l'historique. */
export type NatureCle = "tous" | "pack" | "recap" | "journal";

/** Date + heure courtes (« 05 oct. 2026 à 14:32 »), pour l'historique des envois. */
export function formatDateHeure(value: string | null | undefined): string {
  if (!value) return "Date inconnue";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatShortDate(value);
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/** Nature lisible d'un envoi au comptable, réutilisée par l'historique et son export CSV. */
export function natureEnvoi(envoi: ComptableEnvoi): string {
  if (envoi.recap) return "Récap de régularité";
  if (envoi.pieces && envoi.pieces.includes("releve-prelevements")) return "Relevé des prélèvements";
  if (envoi.pieces && envoi.pieces.includes("pack-comptable")) return "Pack comptable";
  if (envoi.pieces) return "Journal + pièces";
  return "Journal";
}

/** Catégorie de filtrage d'un envoi (pack / récap / journal), dérivée de sa nature. */
export function categorieNature(envoi: ComptableEnvoi): Exclude<NatureCle, "tous"> {
  if (envoi.recap) return "recap";
  // Le relevé seul fait partie de la famille « pack » (même bloc d'envoi au comptable).
  if (envoi.pieces && (envoi.pieces.includes("pack-comptable") || envoi.pieces.includes("releve-prelevements"))) {
    return "pack";
  }
  return "journal";
}

/** Périmètre lisible d'un envoi (extrait de l'objet), réutilisé par l'historique et son export CSV. */
export function perimetreEnvoi(envoi: ComptableEnvoi): string {
  const sujet = envoi.sujet || "";
  const idx = sujet.indexOf("—");
  if (idx >= 0) {
    const apres = sujet.slice(idx + 1).trim();
    if (apres) return apres;
  }
  return envoi.mois || sujet || "—";
}

/**
 * Compte, par adresse destinataire (clé en minuscules), le nombre d'envois déjà effectués.
 * Les envois de test (vers l'artisan lui-même) sont ignorés : on ne compte que les
 * transmissions réelles. Sert à afficher « (N renvois) » à côté de chaque adresse
 * enregistrée dans les sélecteurs de destinataire.
 */
export function compterEnvoisParAdresse(envois: ComptableEnvoi[]): Record<string, number> {
  const map: Record<string, number> = {};
  envois.forEach((e) => {
    if (e.test) return;
    const cle = (e.destinataire ?? "").trim().toLowerCase();
    if (!cle) return;
    map[cle] = (map[cle] ?? 0) + 1;
  });
  return map;
}

/** Clé de mois « AAAA-MM » d'un envoi, pour les récaps « ce mois-ci ». */
export function cleMoisEnvoi(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sens d'évolution de l'usage d'une adresse : en hausse, en baisse ou stable. */
export type TendanceEnvoi = "hausse" | "baisse" | "stable";

/**
 * Compare, pour chaque adresse destinataire (clé en minuscules), le nombre d'envois réels
 * de la période récente (N derniers jours) à celui de la période précédente (N jours d'avant),
 * afin d'afficher une petite flèche de tendance à côté du compteur. Les envois de test sont
 * exclus. Une adresse sans variation renvoie « stable ».
 */
export function tendanceEnvoisParAdresse(envois: ComptableEnvoi[], jours = 30): Record<string, TendanceEnvoi> {
  const jourMs = 24 * 60 * 60 * 1000;
  const maintenant = Date.now();
  const debutRecent = maintenant - jours * jourMs;
  const debutPrecedent = maintenant - 2 * jours * jourMs;
  const recents: Record<string, number> = {};
  const precedents: Record<string, number> = {};
  envois.forEach((e) => {
    if (e.test) return;
    const cle = (e.destinataire ?? "").trim().toLowerCase();
    if (!cle) return;
    const t = new Date(e.envoye_le).getTime();
    if (Number.isNaN(t)) return;
    if (t >= debutRecent) recents[cle] = (recents[cle] ?? 0) + 1;
    else if (t >= debutPrecedent) precedents[cle] = (precedents[cle] ?? 0) + 1;
  });
  const touches = new Set([...Object.keys(recents), ...Object.keys(precedents)]);
  const map: Record<string, TendanceEnvoi> = {};
  touches.forEach((cle) => {
    const r = recents[cle] ?? 0;
    const p = precedents[cle] ?? 0;
    map[cle] = r > p ? "hausse" : r < p ? "baisse" : "stable";
  });
  return map;
}

/**
 * Mémorise le message d'accompagnement des renvois de pack comptable dans le profil, afin
 * de le reproposer pré-rempli au prochain renvoi sans avoir à le ressaisir. Un message vide
 * l'efface (le corps par défaut de l'email est alors utilisé).
 */
export async function updateComptablePackMessage(userId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_pack_message: message.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise le message d'accompagnement des envois du relevé des prélèvements seul dans le
 * profil, afin de le reproposer pré-rempli au prochain envoi sans avoir à le ressaisir. Un
 * message vide l'efface (le corps par défaut de l'email est alors utilisé).
 */
export async function updateComptableReleveMessage(userId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_releve_message: message.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise l'adresse secondaire mise en copie (Cc) des emails au comptable dans le profil,
 * afin de la reproposer pré-remplie au prochain envoi. Un email vide l'efface.
 */
export async function updateComptableCcEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_cc_email: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise le dernier destinataire choisi pour un renvoi (pack ou relevé seul) dans le profil,
 * afin de le reproposer pré-rempli à la prochaine session sans avoir à le resélectionner. Une
 * adresse vide l'efface (retour au destinataire d'origine du dernier envoi).
 */
export async function updateComptableRenvoiDestinataire(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_renvoi_destinataire: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise la dernière adresse de comptable remplaçant utilisée pour un renvoi, cible du bouton
 * « Renvoyer au remplaçant habituel ». Une adresse vide l'efface.
 */
export async function updateComptableRemplacantHabituel(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_remplacant_habituel: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}