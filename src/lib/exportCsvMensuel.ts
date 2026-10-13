import { supabase } from "@/lib/supabase";

/** Jour par défaut de l'export CSV mensuel (le 1er du mois). */
export const EXPORT_CSV_JOUR_DEFAUT = 1;
/** Heure par défaut de l'export CSV mensuel (08:00, heure de Paris). */
export const EXPORT_CSV_HEURE_DEFAUT = 8;

export interface ExportCsvMensuelSettings {
  /** Envoi mensuel automatique de l'export CSV par email activé. */
  actif: boolean;
  /** Jour du mois (1-28) de l'envoi. */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Liste de destinataires en copie (Cc), séparés par des virgules (ex. le comptable). */
  cc: string;
}

/**
 * Enregistre les réglages de l'export CSV mensuel par email dans le profil Backend.
 * La tâche planifiée côté serveur lit ces valeurs pour expédier, le jour et à l'heure
 * choisis, le journal des réessais et le journal d'escalade au format CSV (deux pièces
 * jointes), à l'adresse de l'artisan et aux destinataires en copie.
 */
export async function updateExportCsvMensuel(
  userId: string,
  settings: ExportCsvMensuelSettings,
): Promise<void> {
  const jour = Math.min(28, Math.max(1, Math.round(Number.isFinite(settings.jour) ? settings.jour : 1)));
  const heure = Math.min(23, Math.max(0, Math.round(Number.isFinite(settings.heure) ? settings.heure : 8)));
  const cc = String(settings.cc ?? "").trim();
  const { error } = await supabase
    .from("profiles")
    .update({
      export_csv_mensuel_actif: settings.actif,
      export_csv_mensuel_jour: jour,
      export_csv_mensuel_heure: heure,
      export_csv_mensuel_cc: cc || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface ExportCsvMensuelRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Nombre d'emails réellement envoyés. */
  sent: number;
  /** Nombre d'artisans ignorés. */
  skipped: number;
  /** Nombre de réessais inclus dans la pièce jointe, si connu. */
  reessais?: number;
  /** Nombre de passages d'escalade inclus dans la pièce jointe, si connu. */
  passages?: number;
  /** Raison de l'ignorance éventuelle (utile pour un test immédiat). */
  reason?: string;
}

/**
 * Déclenche immédiatement un envoi réel de l'export CSV mensuel pour l'artisan courant
 * (« Tester l'envoi ») : les deux CSV (réessais + journal d'escalade) partent tout de suite
 * par email, sans attendre le jour programmé. L'anti-doublon n'est pas touché.
 */
export async function runExportCsvMensuelNow(userId: string): Promise<ExportCsvMensuelRunResult> {
  const { data, error } = await supabase.functions.invoke("export-csv-mensuel", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (ExportCsvMensuelRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string; reessais?: number; passages?: number }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de test des exports a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reessais: detail?.reessais != null ? Number(detail.reessais) : undefined,
    passages: detail?.passages != null ? Number(detail.passages) : undefined,
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/** Une ligne de l'historique des exports CSV mensuels envoyés. */
export interface ExportCsvMensuelHistoriqueItem {
  id: number;
  /** Date et heure d'envoi. */
  sentAt: string;
  /** Adresse principale du carton (l'artisan). */
  destinataires: string;
  /** Destinataires en copie (comptable, etc.), séparés par des virgules. */
  cc: string;
  /** Nombre de réessais contenus dans la pièce jointe. */
  nbReessais: number;
  /** Nombre de passages d'escalade contenus dans la pièce jointe. */
  nbPassages: number;
  /** Envoi de démonstration (« Tester l'envoi ») plutôt qu'un envoi programmé. */
  test: boolean;
}

/**
 * Charge le petit historique des derniers exports CSV mensuels envoyés à cet artisan, du plus
 * récent au plus ancien (envois programmés et tests de démonstration confondus).
 */
export async function chargerHistoriqueExportCsvMensuel(
  userId: string,
): Promise<ExportCsvMensuelHistoriqueItem[]> {
  const { data, error } = await supabase
    .from("export_csv_mensuel_historique")
    .select("id, sent_at, destinataires, cc, nb_reessais, nb_passages, test")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: Number(row.id ?? 0),
      sentAt: String(row.sent_at ?? ""),
      destinataires: String(row.destinataires ?? ""),
      cc: String(row.cc ?? ""),
      nbReessais: Number(row.nb_reessais ?? 0),
      nbPassages: Number(row.nb_passages ?? 0),
      test: row.test === true,
    };
  });
}

/**
 * Récupère le rendu exact de l'email d'export CSV mensuel (objet + HTML) via la fonction Backend,
 * en mode aperçu : rien n'est envoyé, c'est juste pour vérifier le rendu avant d'activer.
 */
export async function obtenirApercuExportCsvMensuel(
  userId: string,
): Promise<{ html: string; subject: string }> {
  const { data, error } = await supabase.functions.invoke("export-csv-mensuel", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; html?: string; subject?: string } | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error || "Aperçu indisponible pour l'instant.");
  }
  return {
    html: payload.html,
    subject: payload.subject ?? "Vos exports CSV mensuels — réessais & escalade",
  };
}