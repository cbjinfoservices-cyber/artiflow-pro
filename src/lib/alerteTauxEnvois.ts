import { supabase } from "@/lib/supabase";

/**
 * Résumé du taux de réussite réel des emails sur une fenêtre glissante.
 *
 * Depuis la bascule, Resend est le seul canal d'envoi : on ne lit donc que les traces
 * du fournisseur « resend ». Les envois de test et de démonstration sont exclus du
 * calcul, sinon ils feraient chuter le taux à tort.
 */
export interface ResumeTauxEnvois {
  taux: number;
  total: number;
  succes: number;
  echecs: number;
}

/** Une alerte de taux déjà envoyée aux gestionnaires. */
export interface AlerteTauxEntree {
  id: number;
  taux: number;
  total: number;
  succes: number;
  echecs: number;
  seuil: number;
  destinataires: number;
  created_at: string;
}

/** Seuil d'alerte appliqué côté Backend (95 % sur 24 h). */
export const SEUIL_ALERTE_ENVOIS = 95;

/**
 * Table d'historique des alertes de taux. Son nom est historique (elle a été créée quand
 * un autre fournisseur était en place) : elle n'est pas renommée pour ne rien casser,
 * mais elle ne contient plus que des alertes calculées sur Resend.
 */
const TABLE_HISTORIQUE = "brevo_taux_alerte_historique";

/** Fonctions dont les traces ne doivent jamais peser dans le taux de réussite. */
const FONCTIONS_EXCLUES = ["test-repli", "alerte-taux-brevo", "alerte-taux-brevo-demo"];

/**
 * Calcule le taux de réussite des emails sur les N dernières heures (24 h par défaut),
 * à partir des traces d'envoi écrites par le Backend.
 */
export async function chargerTauxEnvois(heures = 24): Promise<ResumeTauxEnvois> {
  const depuis = new Date(Date.now() - heures * 3600000).toISOString();
  const { data, error } = await supabase
    .from("envoi_fournisseur_historique")
    .select("fonction, statut")
    .eq("fournisseur", "resend")
    .gte("created_at", depuis);
  if (error) throw error;

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter(
    (row) => !FONCTIONS_EXCLUES.includes(String(row.fonction ?? "")),
  );
  const total = rows.length;
  const succes = rows.filter((row) => String(row.statut ?? "") === "succes").length;
  const echecs = total - succes;
  return { total, succes, echecs, taux: total > 0 ? Math.round((succes / total) * 100) : 100 };
}

/**
 * Charge l'historique des alertes de taux envoyées, du plus récent au plus ancien.
 * Sert à montrer quand le seuil a réellement été franchi pour la dernière fois.
 * Avec une limite élevée, alimente aussi l'export CSV d'archivage des incidents.
 */
export async function chargerAlertesTaux(limite = 5): Promise<AlerteTauxEntree[]> {
  const { data, error } = await supabase
    .from(TABLE_HISTORIQUE)
    .select("id, taux, total, succes, echecs, seuil, destinataires, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id) || 0,
    taux: Number(row.taux ?? 0),
    total: Number(row.total ?? 0),
    succes: Number(row.succes ?? 0),
    echecs: Number(row.echecs ?? 0),
    seuil: Number(row.seuil ?? SEUIL_ALERTE_ENVOIS),
    destinataires: Number(row.destinataires ?? 0),
    created_at: String(row.created_at ?? ""),
  }));
}