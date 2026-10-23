import { supabase } from "@/lib/supabase";
import { originePublique } from "@/lib/site";

/** Une étape telle que le client la voit (aucune donnée interne n'est exposée). */
export interface SuiviEtapePublique {
  id: number;
  libelle: string;
  fait: boolean;
  /** Note rédigée spécialement pour le client, ou null. */
  note: string | null;
  /** Lien signé temporaire vers la photo, ou null. */
  photoUrl: string | null;
}

export interface SuiviPublicData {
  chantier: {
    libelle: string;
    adresse: string | null;
    statut: string;
    dateDebut: string | null;
    montant: number;
    message: string | null;
    majLe: string | null;
    clientNom: string | null;
  };
  etapes: SuiviEtapePublique[];
  progression: number;
  etapesFaites: number;
  artisan: {
    entreprise: string;
    metier: string | null;
    telephone: string | null;
    email: string | null;
    logoUrl: string | null;
    accent: string;
  };
}

/** Un chantier vu depuis l'espace client connecté. */
export interface ChantierEspaceClient {
  id: number;
  libelle: string;
  adresse: string | null;
  statut: string;
  dateDebut: string | null;
  montant: number;
  majLe: string | null;
  token: string | null;
  progression: number;
  etapesFaites: number;
  etapesTotal: number;
  artisanNom: string;
  artisanTelephone: string | null;
  artisanEmail: string | null;
}

/** Construit le lien public de suivi d'un chantier, en tenant compte du chemin de base. */
export function lienSuiviChantier(token: string): string {
  if (!token) return "";
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  const origine = originePublique();
  return `${origine}${base}/suivi/${token}`;
}

/** Charge le suivi public d'un chantier à partir de son jeton. */
export async function chargerSuiviChantier(token: string): Promise<SuiviPublicData> {
  const { data, error } = await supabase.functions.invoke("suivi-chantier-public", {
    body: { token },
  });
  if (error) {
    let message = "Impossible de charger le suivi pour le moment.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) message = body.error;
      }
    } catch {
      /* on garde le message générique */
    }
    throw new Error(message);
  }
  const payload = data as { ok?: boolean; data?: SuiviPublicData; error?: string } | null;
  if (!payload?.ok || !payload.data) throw new Error(payload?.error ?? "Ce lien de suivi est introuvable.");
  return payload.data;
}

/** Liste les chantiers suivis du client connecté (reconnaissance par son adresse email). */
export async function chargerEspaceClient(): Promise<ChantierEspaceClient[]> {
  const { data, error } = await supabase.functions.invoke("espace-client-suivi", { body: {} });
  if (error) throw new Error("Impossible de charger vos chantiers pour le moment.");
  const payload = data as { ok?: boolean; data?: { chantiers?: ChantierEspaceClient[] } } | null;
  return payload?.data?.chantiers ?? [];
}

/** D'où part un email au client : à la main, en envoi groupé, ou par la tâche automatique. */
export type OrigineEnvoiSuivi = "manuel" | "groupe" | "auto";

/** Prévient le client par email que le suivi vient de bouger. */
export async function notifierSuiviChantier(
  chantierId: number,
  lien: string,
  motif: string,
  origine: OrigineEnvoiSuivi = "manuel",
): Promise<{ ok: boolean; destinataire?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("notifier-suivi-chantier", {
    body: { chantierId, lien, motif, origine },
  });
  if (error) {
    let message = "L'email n'a pas pu être envoyé.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) message = body.error;
      }
    } catch {
      /* message générique */
    }
    return { ok: false, error: message };
  }
  const payload = data as { ok?: boolean; destinataire?: string; error?: string } | null;
  if (!payload?.ok) return { ok: false, error: payload?.error ?? "L'email n'a pas pu être envoyé." };
  return { ok: true, destinataire: payload.destinataire };
}

/** Une notification réellement tentée par email vers le client. */
export interface NotificationSuivi {
  id: number;
  destinataire: string | null;
  motif: string | null;
  /** Objet de l'email envoyé, ou null pour les anciennes lignes. */
  sujet: string | null;
  /** « envoye » ou « echec ». */
  statut: string;
  erreur: string | null;
  created_at: string;
}

/** Résumé du dernier email réellement parti au client d'un chantier. */
export interface DernierEmailClient {
  id: number;
  chantierId: number;
  destinataire: string | null;
  sujet: string | null;
  motif: string | null;
  created_at: string;
}

/** Email complet archivé (contenu HTML inclus) pour l'aperçu. */
export interface EmailClientArchive extends DernierEmailClient {
  html: string | null;
}

/**
 * Dernier email réellement envoyé au client, pour chaque chantier demandé.
 * Une seule requête : on ne rapatrie que les métadonnées (le HTML est chargé à l'ouverture de l'aperçu).
 */
export async function fetchDerniersEmailsClients(
  chantierIds: number[],
): Promise<Record<number, DernierEmailClient>> {
  if (chantierIds.length === 0) return {};
  const { data, error } = await supabase
    .from("suivi_notifications")
    .select("id, chantier_id, destinataire, sujet, motif, created_at")
    .in("chantier_id", chantierIds)
    .eq("statut", "envoye")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  const resultat: Record<number, DernierEmailClient> = {};
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const cid = Number(row.chantier_id);
    if (resultat[cid]) return;
    resultat[cid] = {
      id: Number(row.id),
      chantierId: cid,
      destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
      sujet: row.sujet === null || row.sujet === undefined ? null : String(row.sujet),
      motif: row.motif === null || row.motif === undefined ? null : String(row.motif),
      created_at: String(row.created_at ?? ""),
    };
  });
  return resultat;
}

/** Contenu complet d'un email archivé (objet + HTML) pour l'afficher tel qu'il est parti. */
export async function fetchEmailClientArchive(id: number): Promise<EmailClientArchive | null> {
  const { data, error } = await supabase
    .from("suivi_notifications")
    .select("id, chantier_id, destinataire, sujet, motif, created_at, html")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: Number(row.id),
    chantierId: Number(row.chantier_id),
    destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
    sujet: row.sujet === null || row.sujet === undefined ? null : String(row.sujet),
    motif: row.motif === null || row.motif === undefined ? null : String(row.motif),
    created_at: String(row.created_at ?? ""),
    html: row.html === null || row.html === undefined ? null : String(row.html),
  };
}

/** Journal des notifications envoyées au client pour un chantier (le plus récent en premier). */
export async function fetchNotificationsSuivi(chantierId: number, limit = 25): Promise<NotificationSuivi[]> {
  const { data, error } = await supabase
    .from("suivi_notifications")
    .select("id, destinataire, motif, sujet, statut, erreur, created_at")
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
    motif: row.motif === null || row.motif === undefined ? null : String(row.motif),
    sujet: row.sujet === null || row.sujet === undefined ? null : String(row.sujet),
    statut: String(row.statut ?? "envoye"),
    erreur: row.erreur === null || row.erreur === undefined ? null : String(row.erreur),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Message proposé par défaut pour l'envoi groupé automatique des nouvelles. */
export const MESSAGE_NOUVELLES_AUTO_DEFAUT =
  "Petit point sur l'avancement de votre chantier : les travaux progressent comme prévu. Le détail des étapes est à jour sur votre page de suivi.";

/** Réglages de l'envoi groupé automatique des nouvelles aux clients silencieux. */
export interface NouvellesAutoSettings {
  actif: boolean;
  /** « semaine » (un jour de la semaine) ou « mois » (un jour du mois). */
  frequence: "semaine" | "mois";
  /** Jour de la semaine (1-7) ou jour du mois (1-28) selon la fréquence. */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Message d'accompagnement envoyé à chaque client. */
  message: string;
  /** Date du dernier envoi automatique réellement effectué. */
  dernierEnvoi: string | null;
}

export async function fetchNouvellesAutoSettings(userId: string): Promise<NouvellesAutoSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "nouvelles_auto_actif, nouvelles_auto_frequence, nouvelles_auto_jour, nouvelles_auto_heure, nouvelles_auto_message, nouvelles_auto_dernier_envoi",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const frequence = row.nouvelles_auto_frequence === "mois" ? "mois" : "semaine";
  const jour = Number(row.nouvelles_auto_jour);
  const heure = Number(row.nouvelles_auto_heure);
  const message = row.nouvelles_auto_message === null || row.nouvelles_auto_message === undefined
    ? ""
    : String(row.nouvelles_auto_message);
  return {
    actif: row.nouvelles_auto_actif === true,
    frequence,
    jour: Number.isFinite(jour)
      ? Math.min(frequence === "mois" ? 28 : 7, Math.max(1, Math.round(jour)))
      : frequence === "mois"
        ? 1
        : 5,
    heure: Number.isFinite(heure) ? Math.min(23, Math.max(0, Math.round(heure))) : 8,
    message,
    dernierEnvoi:
      row.nouvelles_auto_dernier_envoi === null || row.nouvelles_auto_dernier_envoi === undefined
        ? null
        : String(row.nouvelles_auto_dernier_envoi),
  };
}

export async function updateNouvellesAutoSettings(
  userId: string,
  patch: Partial<Omit<NouvellesAutoSettings, "dernierEnvoi">>,
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.actif !== undefined) payload.nouvelles_auto_actif = patch.actif;
  if (patch.frequence !== undefined) payload.nouvelles_auto_frequence = patch.frequence === "mois" ? "mois" : "semaine";
  if (patch.jour !== undefined) {
    const max = (patch.frequence ?? "semaine") === "mois" ? 28 : 7;
    payload.nouvelles_auto_jour = Math.min(max, Math.max(1, Math.round(patch.jour)));
  }
  if (patch.heure !== undefined) payload.nouvelles_auto_heure = Math.min(23, Math.max(0, Math.round(patch.heure)));
  if (patch.message !== undefined) payload.nouvelles_auto_message = patch.message.trim() ? patch.message.trim() : null;
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/**
 * Envoie un seul email d'essai à l'artisan lui-même, avec exactement la mise en forme de
 * l'envoi automatique. Aucun client n'est contacté, aucune date de contact n'est modifiée.
 */
export async function envoyerEssaiNouvellesGroupees(
  userId: string,
): Promise<{ destinataire: string | null; chantiers: number }> {
  const { data, error } = await supabase.functions.invoke("envoi-auto-nouvelles-groupees", {
    body: { userId, test: true },
  });
  if (error) {
    let message = "L'essai n'a pas pu être envoyé.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) message = body.error;
      }
    } catch {
      /* message générique */
    }
    throw new Error(message);
  }
  const payload = data as {
    ok?: boolean;
    destinataire?: string;
    chantiers?: number;
    error?: string;
  } | null;
  if (!payload?.ok) throw new Error(payload?.error ?? "L'essai n'a pas pu être envoyé.");
  return {
    destinataire: payload.destinataire ?? null,
    chantiers: Number(payload.chantiers ?? 0),
  };
}

/** Rendu de l'email groupé, tel qu'il partirait, sans aucun envoi réel. */
export interface ApercuNouvellesGroupees {
  html: string;
  sujet: string;
  /** Adresse du client pris en exemple. */
  destinataire: string | null;
  /** Nom du client pris en exemple. */
  client: string | null;
  /** Nombre de chantiers figurant dans l'exemple. */
  chantiers: number;
}

/**
 * Récupère le rendu exact de l'email groupé automatique, sans passer par la boîte mail.
 * Rien n'est envoyé : la fonction Backend construit le même HTML puis le renvoie.
 */
export async function previsualiserNouvellesGroupees(
  userId: string,
  message?: string,
): Promise<ApercuNouvellesGroupees> {
  const { data, error } = await supabase.functions.invoke("envoi-auto-nouvelles-groupees", {
    body: { userId, preview: true, message: message ?? "" },
  });
  if (error) {
    let messageErreur = "L'aperçu de l'email groupé n'a pas pu être généré.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) messageErreur = body.error;
      }
    } catch {
      /* message générique */
    }
    throw new Error(messageErreur);
  }
  const payload = data as {
    ok?: boolean;
    html?: string;
    subject?: string;
    destinataire?: string | null;
    client?: string | null;
    chantiers?: number;
    error?: string;
  } | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error ?? "Aperçu indisponible pour l'instant.");
  }
  return {
    html: payload.html,
    sujet: payload.subject ?? "Nouvelles de vos chantiers",
    destinataire: payload.destinataire ?? null,
    client: payload.client ?? null,
    chantiers: Number(payload.chantiers ?? 0),
  };
}

/** Jours d'envoi possibles du récap (1 = lundi … 7 = dimanche, heure de Paris). */
export const JOURS_RECAP_CHANTIERS = [
  { valeur: 1, libelle: "Lundi" },
  { valeur: 2, libelle: "Mardi" },
  { valeur: 3, libelle: "Mercredi" },
  { valeur: 4, libelle: "Jeudi" },
  { valeur: 5, libelle: "Vendredi" },
  { valeur: 6, libelle: "Samedi" },
  { valeur: 7, libelle: "Dimanche" },
] as const;

/** Libellé lisible d'un jour de récap (repli sur vendredi). */
export function libelleJourRecap(jour: number): string {
  return JOURS_RECAP_CHANTIERS.find((j) => j.valeur === jour)?.libelle ?? "Vendredi";
}

/** Une adresse mise en copie du récap (comptable, associé, banque…). */
export interface AdresseCcRecap {
  email: string;
  /** L'adresse reçoit bien une copie du récap. */
  actif: boolean;
  /** Adresse proposée en premier et toujours cochée (une seule par compte). */
  parDefaut: boolean;
}

/**
 * Lit la liste d'adresses en copie telle qu'enregistrée en base. Tolérant : on ignore les
 * entrées vides ou en double, et on garantit qu'une seule adresse est marquée par défaut.
 */
export function parseAdressesCcRecap(value: unknown): AdresseCcRecap[] {
  if (!Array.isArray(value)) return [];
  const vues = new Set<string>();
  const liste: AdresseCcRecap[] = [];
  value.forEach((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const email = String(row.email ?? "").trim();
    if (!email || vues.has(email.toLowerCase())) return;
    vues.add(email.toLowerCase());
    liste.push({ email, actif: row.actif !== false, parDefaut: row.parDefaut === true });
  });
  if (liste.length === 0) return liste;
  const defaut = liste.find((a) => a.parDefaut) ?? liste[0];
  return liste.map((a) => ({ ...a, parDefaut: a.email === defaut.email }));
}

/** Adresses qui recevront réellement une copie du récap. */
export function adressesCcActives(liste: AdresseCcRecap[]): string[] {
  return liste.filter((a) => a.actif).map((a) => a.email);
}

/** Réglages du récap email hebdomadaire sur l'avancement des chantiers. */
export interface RecapChantiersSettings {
  actif: boolean;
  /** Jour d'envoi (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Date du dernier récap réellement expédié, ou null. */
  dernierEnvoi: string | null;
  /** Adresses mises en copie du récap (plusieurs possibles). */
  ccs: AdresseCcRecap[];
}

export async function fetchRecapChantiersSettings(userId: string): Promise<RecapChantiersSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "recap_chantiers_actif, recap_chantiers_jour, recap_chantiers_heure, recap_chantiers_dernier_envoi, recap_chantiers_cc, recap_chantiers_ccs",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const heure = Number(row.recap_chantiers_heure);
  const jour = Number(row.recap_chantiers_jour);
  return {
    actif: row.recap_chantiers_actif !== false,
    jour: Number.isFinite(jour) ? Math.min(7, Math.max(1, Math.round(jour))) : 5,
    heure: Number.isFinite(heure) ? Math.min(23, Math.max(0, heure)) : 8,
    dernierEnvoi:
      row.recap_chantiers_dernier_envoi === null || row.recap_chantiers_dernier_envoi === undefined
        ? null
        : String(row.recap_chantiers_dernier_envoi),
    ccs: (() => {
      const liste = parseAdressesCcRecap(row.recap_chantiers_ccs);
      if (liste.length > 0) return liste;
      // Comptes réglés avant la liste : l'ancienne adresse unique devient l'adresse par défaut.
      const ancienne = row.recap_chantiers_cc === null || row.recap_chantiers_cc === undefined ? "" : String(row.recap_chantiers_cc).trim();
      return ancienne ? [{ email: ancienne, actif: true, parDefaut: true }] : [];
    })(),
  };
}

export async function updateRecapChantiersSettings(
  userId: string,
  patch: { actif?: boolean; jour?: number; heure?: number; ccs?: AdresseCcRecap[] },
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.actif !== undefined) payload.recap_chantiers_actif = patch.actif;
  if (patch.ccs !== undefined) {
    const liste = parseAdressesCcRecap(patch.ccs);
    payload.recap_chantiers_ccs = liste;
    // On garde l'ancienne colonne alignée sur la première adresse incluse, pour les
    // lectures qui n'ont pas encore connaissance de la liste.
    payload.recap_chantiers_cc = adressesCcActives(liste)[0] ?? null;
  }
  if (patch.jour !== undefined) {
    payload.recap_chantiers_jour = Math.min(7, Math.max(1, Math.round(patch.jour)));
  }
  if (patch.heure !== undefined) {
    payload.recap_chantiers_heure = Math.min(23, Math.max(0, Math.round(patch.heure)));
  }
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/**
 * Récupère le rendu de l'email de récap sans rien envoyer : sert à l'aperçu de validation.
 * La fonction Backend reconstruit l'email exact qui partirait à l'artisan.
 */
export async function previsualiserRecapChantiers(
  userId: string,
): Promise<{ html: string; sujet: string; cc: string | null }> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-chantiers", {
    body: { preview: true, userId },
  });
  if (error) throw new Error("L'aperçu du récap n'a pas pu être généré.");
  const payload = data as {
    ok?: boolean;
    html?: string;
    subject?: string;
    cc?: string;
    error?: string;
  } | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error ?? "Aperçu indisponible pour l'instant.");
  }
  return {
    html: payload.html,
    sujet: payload.subject ?? "Récap chantiers",
    cc: payload.cc && payload.cc.trim() ? payload.cc.trim() : null,
  };
}

/** Envoie tout de suite le récap hebdomadaire des chantiers en cours à l'artisan. */
export async function envoyerRecapChantiersMaintenant(
  userId: string,
): Promise<{ configure: boolean; sent: number; reason?: string }> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-chantiers", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error("Le récap n'a pas pu être envoyé.");
  const payload = data as
    | { ok?: boolean; configured?: boolean; sent?: number; reason?: string; error?: string }
    | null;
  if (!payload?.ok) throw new Error(payload?.error ?? "Le récap n'a pas pu être envoyé.");
  return {
    configure: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    reason: payload.reason ? String(payload.reason) : undefined,
  };
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Téléverse une photo d'étape dans le stockage et renvoie son chemin.
 * Le chemin (et non une URL) est enregistré : les liens d'affichage sont signés à la demande.
 */
export async function televerserPhotoEtape(userId: string, file: File): Promise<string> {
  const ext = EXTENSIONS[file.type] ?? "jpg";
  const nom = `${crypto.randomUUID()}.${ext}`;
  const chemin = `${userId}/${nom}`;
  const { error } = await supabase.storage.from("suivi-chantier").upload(chemin, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error("L'envoi de la photo a échoué. Réessayez avec une image plus légère.");
  return chemin;
}

/** Renvoie un lien signé temporaire pour afficher une photo stockée (ou null). */
export async function urlPhotoEtape(chemin: string | null | undefined): Promise<string | null> {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  const { data, error } = await supabase.storage.from("suivi-chantier").createSignedUrl(chemin, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Renvoie au client l'email de suivi qui n'était pas parti, sans quitter l'écran.
 * Sert depuis la cloche d'alertes : on relit le jeton public du chantier pour reconstruire
 * le lien de suivi, puis on relance l'envoi avec le même message qu'à la première tentative.
 * L'adresse utilisée est toujours celle de la fiche client (donc la version corrigée).
 */
export async function renvoyerEmailClientEnEchec(
  chantierId: number,
  motif?: string | null,
): Promise<{ ok: boolean; destinataire?: string; error?: string }> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("suivi_token")
    .eq("id", chantierId)
    .maybeSingle();
  if (error) return { ok: false, error: "Le chantier n'a pas pu être relu." };
  const token = (data as { suivi_token?: string | null } | null)?.suivi_token;
  const lien = token ? lienSuiviChantier(String(token)) : "";
  const texte = (motif ?? "").trim() || "Le suivi de votre chantier vient d'être mis à jour.";
  return notifierSuiviChantier(chantierId, lien, texte, "manuel");
}

