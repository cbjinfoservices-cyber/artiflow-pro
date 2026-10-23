import { supabase } from "@/lib/supabase";
import { addDays, toISODate, todayISO } from "@/lib/dates";

export interface LigneInput {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  /** Taux de TVA appliqué à la ligne, en pourcentage (20, 10 ou 5.5). 20 par défaut. */
  taux_tva?: number;
}

/** Taux de TVA appliqué quand aucune valeur n'est fournie sur une ligne. */
export const DEFAULT_TVA_RATE = 20;

/** Taux de TVA proposés dans l'interface (artisanat / rénovation). */
export const TVA_RATES = [20, 10, 5.5] as const;

/** Ramène un taux quelconque vers un taux valide (20 par défaut). */
export function normalizeTvaRate(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TVA_RATE;
}

/**
 * Calcule les totaux d'un devis ou d'une facture en tenant compte du taux de TVA
 * propre à chaque ligne : une même pièce peut ainsi mélanger plusieurs taux.
 */
export function computeTotaux(lignes: LigneInput[]) {
  const round = (v: number) => Math.round(v * 100) / 100;
  const ht = lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva = lignes.reduce((sum, l) => {
    const base = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
    return sum + base * (normalizeTvaRate(l.taux_tva) / 100);
  }, 0);
  return { ht: round(ht), tva: round(tva), ttc: round(ht + tva) };
}

/* ------------------------------- DEVIS ------------------------------- */

async function nextDevisNumero(userId: string): Promise<string> {
  const { data } = await supabase.from("devis").select("numero").eq("user_id", userId);
  let max = 2418;
  (data ?? []).forEach((row) => {
    const m = /(\d+)/.exec(String(row.numero ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `DV-${max + 1}`;
}

export async function createDevis(
  userId: string,
  payload: {
    clientId: number | null;
    objet: string;
    statut: string;
    lignes: LigneInput[];
    /** Clé du modèle d'origine (« custom-12 » / « builtin-… ») si le devis a été généré depuis un modèle. */
    modeleCle?: string | null;
    /** Nom lisible du modèle d'origine, conservé pour le filtre « issu d'un modèle ». */
    modeleNom?: string | null;
  },
): Promise<number> {
  const numero = await nextDevisNumero(userId);
  const { ht, ttc } = computeTotaux(payload.lignes);
  const { data, error } = await supabase
    .from("devis")
    .insert({
      user_id: userId,
      client_id: payload.clientId,
      numero,
      objet: payload.objet,
      statut: payload.statut,
      total_ht: ht,
      total_ttc: ttc,
      modele_cle: payload.modeleCle ?? null,
      modele_nom: payload.modeleNom ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const devisId = (data as { id: number }).id;
  if (payload.lignes.length) {
    const rows = payload.lignes.map((l) => ({
      devis_id: devisId,
      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      taux_tva: normalizeTvaRate(l.taux_tva),
    }));
    const { error: lerr } = await supabase.from("lignes_devis").insert(rows);
    if (lerr) throw lerr;
  }
  return devisId;
}

export async function updateDevisStatut(devisId: number, statut: string): Promise<void> {
  const { error } = await supabase.from("devis").update({ statut }).eq("id", devisId);
  if (error) throw error;
}

export async function deleteDevis(devisId: number): Promise<void> {
  const { error } = await supabase.from("devis").delete().eq("id", devisId);
  if (error) throw error;
}

export async function fetchDevisLignes(devisId: number): Promise<LigneInput[]> {
  const { data, error } = await supabase
    .from("lignes_devis")
    .select("designation, unite, quantite, prix_unitaire, taux_tva")
    .eq("devis_id", devisId)
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    designation: String(row.designation ?? ""),
    unite: String(row.unite ?? "u"),
    quantite: Number(row.quantite ?? 1),
    prix_unitaire: Number(row.prix_unitaire ?? 0),
    taux_tva: normalizeTvaRate(row.taux_tva),
  }));
}

/** Duplique un devis existant (mêmes client, objet et lignes) en un nouveau brouillon. */
export async function duplicateDevis(userId: string, devisId: number): Promise<void> {
  const { data, error } = await supabase
    .from("devis")
    .select("client_id, objet")
    .eq("id", devisId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const lignes = await fetchDevisLignes(devisId);
  await createDevis(userId, {
    clientId: row.client_id === null || row.client_id === undefined ? null : Number(row.client_id),
    objet: row.objet ? String(row.objet) : "",
    statut: "Brouillon",
    lignes,
  });
}

/**
 * Duplique un devis pour un client donné (envoi groupé).
 * Renvoie l'id du nouveau devis, prêt à recevoir un lien de signature.
 */
export async function duplicateDevisForClient(
  userId: string,
  devisId: number,
  clientId: number,
  statut = "Envoyé",
): Promise<number> {
  const { data, error } = await supabase.from("devis").select("objet").eq("id", devisId).maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const lignes = await fetchDevisLignes(devisId);
  return createDevis(userId, {
    clientId,
    objet: row.objet ? String(row.objet) : "",
    statut,
    lignes,
  });
}

/* ------------------------------ CLIENTS ------------------------------ */

export interface ClientPayload {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  /** « professionnel » (entreprise) ou « particulier ». */
  type?: string;
  /** Interlocuteur côté entreprise. */
  contact_nom?: string;
  /** Numéro SIRET (clients professionnels). */
  siret?: string;
  /** Secteur d'activité (clients professionnels). */
  secteur?: string;
  /** Notes internes libres sur le client. */
  notes?: string;
  /** Priorité de la note interne (« a_relancer », « sensible », « urgent », « info »). */
  note_priorite?: string;
}

export interface CreatedClient {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
}

/** Crée un client et renvoie sa fiche (utile pour le sélectionner aussitôt après création). */
export async function createClient(userId: string, payload: ClientPayload): Promise<CreatedClient> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      nom: payload.nom,
      telephone: payload.telephone || null,
      email: payload.email || null,
      adresse: payload.adresse || null,
      type: payload.type || "particulier",
      contact_nom: payload.contact_nom?.trim() || null,
      siret: payload.siret?.trim() || null,
      secteur: payload.secteur?.trim() || null,
      notes: payload.notes?.trim() || null,
      note_priorite: payload.note_priorite?.trim() || null,
    })
    .select("id, nom, telephone, email, adresse")
    .single();
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: Number(row.id),
    nom: String(row.nom ?? ""),
    telephone: row.telephone === null || row.telephone === undefined ? null : String(row.telephone),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    adresse: row.adresse === null || row.adresse === undefined ? null : String(row.adresse),
  };
}

export async function updateClient(clientId: number, payload: ClientPayload): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({
      nom: payload.nom,
      telephone: payload.telephone || null,
      email: payload.email || null,
      adresse: payload.adresse || null,
      type: payload.type || "particulier",
      contact_nom: payload.contact_nom?.trim() || null,
      siret: payload.siret?.trim() || null,
      secteur: payload.secteur?.trim() || null,
      notes: payload.notes?.trim() || null,
      note_priorite: payload.note_priorite?.trim() || null,
    })
    .eq("id", clientId);
  if (error) throw error;
}

/** Enregistre uniquement les notes internes d'un client (édition rapide depuis la fiche). */
export async function updateClientNotes(
  clientId: number,
  notes: string,
  notePriorite: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ notes: notes.trim() || null, note_priorite: notePriorite || null })
    .eq("id", clientId);
  if (error) throw error;
}

export async function deleteClient(clientId: number): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

/**
 * Envoie une relance email rapide à un client (bouton « Relancer » du widget
 * « Clients à suivre »), avec l'identité de l'artisan. `message` permet de
 * personnaliser le corps ; laissé vide, un message de reprise de contact est utilisé.
 */
export async function sendClientRelanceEmail(clientId: number, message = ""): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-client-relance", {
    body: { clientId, message },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de la relance a échoué.");
}

export interface ClientRelancePreview {
  /** HTML complet de l'email de relance, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
}

/**
 * Génère l'aperçu de l'email de relance client sans rien envoyer : renvoie l'objet et le
 * HTML exacts qui seraient expédiés, en utilisant le message de la relance (ou le modèle
 * du profil à défaut). Sert au bouton « Aperçu » de la page « Relances programmées ».
 */
export async function previewClientRelance(clientId: number, message = ""): Promise<ClientRelancePreview> {
  const { data, error } = await supabase.functions.invoke("send-client-relance", {
    body: { clientId, message, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (ClientRelancePreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu de la relance a échoué.");
  return { html: String(payload.html ?? ""), subject: String(payload.subject ?? "") };
}

/* --------------------------- MODÈLES DE DEVIS --------------------------- */

export interface DevisModele {
  id: number;
  nom: string;
  objet: string;
  lignes: LigneInput[];
  created_at: string;
  /** Modèle archivé : masqué de la liste active mais conservé pour l'historique. */
  archive: boolean;
}

/** Convertit la copie JSONB des lignes d'un modèle en lignes exploitables. */
function parseModeleLignes(value: unknown): LigneInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        designation: String(row.designation ?? ""),
        unite: String(row.unite ?? "u"),
        quantite: Number(row.quantite ?? 1),
        prix_unitaire: Number(row.prix_unitaire ?? 0),
        taux_tva: normalizeTvaRate(row.taux_tva),
      };
    })
    .filter((l) => l.designation.trim().length > 0);
}

/** Liste les modèles de devis personnalisés enregistrés par l'artisan. */
export async function fetchDevisModeles(userId: string): Promise<DevisModele[]> {
  const { data, error } = await supabase
    .from("devis_modeles")
    .select("id, nom, objet, lignes, created_at, archive")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    nom: String(row.nom ?? "Modèle"),
    objet: String(row.objet ?? ""),
    lignes: parseModeleLignes(row.lignes),
    created_at: String(row.created_at ?? ""),
    archive: Boolean(row.archive),
  }));
}

/** Enregistre un nouveau modèle personnalisé à partir d'un objet et de lignes. */
export async function createDevisModele(
  userId: string,
  payload: { nom: string; objet: string; lignes: LigneInput[] },
): Promise<void> {
  const { error } = await supabase.from("devis_modeles").insert({
    user_id: userId,
    nom: payload.nom,
    objet: payload.objet,
    lignes: payload.lignes,
  });
  if (error) throw error;
}

/**
 * Enregistre un devis existant comme modèle personnalisé réutilisable en un clic.
 * L'objet et les lignes du devis sont copiés dans le modèle.
 */
export async function createDevisModeleFromDevis(userId: string, devisId: number, nom: string): Promise<void> {
  const { data, error } = await supabase.from("devis").select("objet").eq("id", devisId).maybeSingle();
  if (error) throw error;
  const objet = String((data as Record<string, unknown> | null)?.objet ?? "");
  const lignes = await fetchDevisLignes(devisId);
  await createDevisModele(userId, { nom, objet, lignes });
}

/** Supprime un modèle personnalisé. */
export async function deleteDevisModele(modeleId: number): Promise<void> {
  const { error } = await supabase.from("devis_modeles").delete().eq("id", modeleId);
  if (error) throw error;
}

/**
 * Archive ou désarchive un modèle personnalisé. Un modèle archivé reste en base
 * (et son historique d'usage est conservé) mais n'apparaît plus dans la liste active.
 */
export async function setDevisModeleArchive(modeleId: number, archive: boolean): Promise<void> {
  const { error } = await supabase.from("devis_modeles").update({ archive }).eq("id", modeleId);
  if (error) throw error;
}

/** Renomme / édite un modèle personnalisé existant (nom, objet et lignes). */
export async function updateDevisModele(
  modeleId: number,
  payload: { nom: string; objet: string; lignes: LigneInput[] },
): Promise<void> {
  const { error } = await supabase
    .from("devis_modeles")
    .update({ nom: payload.nom, objet: payload.objet, lignes: payload.lignes })
    .eq("id", modeleId);
  if (error) throw error;
}

/* --------------------- MODÈLES DE FACTURES --------------------- */

export interface FactureModele {
  id: number;
  nom: string;
  objet: string;
  lignes: LigneInput[];
  created_at: string;
  /** Modèle archivé : masqué de la liste active mais conservé. */
  archive: boolean;
}

/** Liste les modèles de factures personnalisés enregistrés par l'artisan. */
export async function fetchFactureModeles(userId: string): Promise<FactureModele[]> {
  const { data, error } = await supabase
    .from("facture_modeles")
    .select("id, nom, objet, lignes, created_at, archive")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    nom: String(row.nom ?? "Modèle"),
    objet: String(row.objet ?? ""),
    lignes: parseModeleLignes(row.lignes),
    created_at: String(row.created_at ?? ""),
    archive: Boolean(row.archive),
  }));
}

/** Enregistre un nouveau modèle de facture à partir d'un objet et de lignes. */
export async function createFactureModele(
  userId: string,
  payload: { nom: string; objet: string; lignes: LigneInput[] },
): Promise<number> {
  const { data, error } = await supabase
    .from("facture_modeles")
    .insert({ user_id: userId, nom: payload.nom, objet: payload.objet, lignes: payload.lignes })
    .select("id")
    .single();
  if (error) throw error;
  return Number((data as { id: number }).id);
}

/**
 * Enregistre une facture existante comme modèle réutilisable.
 * L'objet (repris du devis d'origine) et les lignes de la facture sont copiés.
 */
export async function createFactureModeleFromFacture(
  userId: string,
  factureId: number,
  nom: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("factures")
    .select("devis_id, lignes")
    .eq("id", factureId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as { devis_id?: number | null; lignes?: unknown };
  const devisId = row.devis_id ?? null;
  let objet = "";
  if (devisId) {
    const { data: devisRow } = await supabase.from("devis").select("objet").eq("id", devisId).maybeSingle();
    objet = String((devisRow as Record<string, unknown> | null)?.objet ?? "");
  }
  const lignes =
    Array.isArray(row.lignes) && row.lignes.length > 0
      ? parseModeleLignes(row.lignes)
      : devisId
        ? await fetchDevisLignes(devisId)
        : [];
  await createFactureModele(userId, { nom, objet, lignes });
}

/** Supprime un modèle de facture. */
export async function deleteFactureModele(modeleId: number): Promise<void> {
  const { error } = await supabase.from("facture_modeles").delete().eq("id", modeleId);
  if (error) throw error;
}

/** Archive ou désarchive un modèle de facture (conservé mais masqué de la liste active). */
export async function setFactureModeleArchive(modeleId: number, archive: boolean): Promise<void> {
  const { error } = await supabase.from("facture_modeles").update({ archive }).eq("id", modeleId);
  if (error) throw error;
}

/** Renomme / édite un modèle de facture existant (nom, objet et lignes). */
export async function updateFactureModele(
  modeleId: number,
  payload: { nom: string; objet: string; lignes: LigneInput[] },
): Promise<void> {
  const { error } = await supabase
    .from("facture_modeles")
    .update({ nom: payload.nom, objet: payload.objet, lignes: payload.lignes })
    .eq("id", modeleId);
  if (error) throw error;
}

/**
 * Génère une facture à partir d'un modèle : les lignes du modèle sont copiées et figées
 * sur la nouvelle facture (statut « Émise »), éventuellement rattachée à un client.
 */
export async function createFactureFromModele(
  userId: string,
  modele: { objet: string; lignes: LigneInput[] },
  clientId: number | null,
  echeanceJours = 30,
): Promise<number> {
  const numero = await nextDocumentNumero(userId, "FAC");
  const now = new Date();
  const { ht, ttc } = computeTotaux(modele.lignes);
  const { data, error } = await supabase
    .from("factures")
    .insert({
      user_id: userId,
      devis_id: null,
      client_id: clientId,
      numero,
      statut: "Émise",
      total_ht: ht,
      total_ttc: ttc,
      date_emission: toISODate(now),
      date_echeance: toISODate(addDays(now, echeanceJours)),
      lignes: modele.lignes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return Number((data as { id: number }).id);
}

export interface ModeleUsage {
  /** Nombre de devis réellement créés depuis ce modèle. */
  utilisations: number;
  /** CA total (HT) cumulé des devis créés depuis ce modèle, en euros. */
  montantTotal: number;
  /** Date du dernier usage, ou null si jamais utilisé. */
  derniere: string | null;
}

/**
 * Récupère le nombre d'utilisations de chaque modèle (perso et métier),
 * indexé par clé de modèle (« custom-12 » / « builtin-Dépannage plomberie »).
 * RLS garantit qu'un artisan ne voit que ses propres compteurs.
 */
export async function fetchModeleUsages(userId: string): Promise<Record<string, ModeleUsage>> {
  const { data, error } = await supabase
    .from("devis_modele_usages")
    .select("cle, utilisations, montant_total, derniere_utilisation")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, ModeleUsage> = {};
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    map[String(row.cle)] = {
      utilisations: Number(row.utilisations ?? 0),
      montantTotal: Number(row.montant_total ?? 0),
      derniere: row.derniere_utilisation ? String(row.derniere_utilisation) : null,
    };
  });
  return map;
}

export interface ModeleUsageEvent {
  /** Clé du modèle utilisé (« custom-12 » / « builtin-Dépannage plomberie »). */
  cle: string;
  /** Montant HT du devis créé depuis ce modèle. */
  montant: number;
  /** Date de l'utilisation (ISO). */
  createdAt: string;
}

/**
 * Récupère l'historique daté des utilisations de modèles (une entrée par devis créé
 * depuis un modèle), pour tracer l'évolution mensuelle dans le temps.
 * RLS garantit qu'un artisan ne voit que ses propres événements.
 */
export async function fetchModeleUsageEvents(userId: string): Promise<ModeleUsageEvent[]> {
  const { data, error } = await supabase
    .from("devis_modele_usage_events")
    .select("cle, montant, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    cle: String(row.cle ?? ""),
    montant: Number(row.montant ?? 0),
    createdAt: String(row.created_at ?? ""),
  }));
}

/**
 * Incrémente le compteur d'utilisations d'un modèle (appelé quand un devis est créé
 * depuis ce modèle). L'incrément est atomique et scopé à l'utilisateur courant côté base.
 */
export async function incrementModeleUsage(
  cle: string,
  modeleId?: number | null,
  montantHT = 0,
): Promise<void> {
  const { error } = await supabase.rpc("increment_modele_usage", {
    p_cle: cle,
    p_modele_id: modeleId ?? null,
    p_montant: Number.isFinite(montantHT) ? montantHT : 0,
  });
  if (error) throw error;
}

/**
 * Duplique un modèle personnalisé pour créer une variante : mêmes objet et lignes,
 * nouveau nom (« Copie de … »). Renvoie le modèle créé.
 */
export async function duplicateDevisModele(userId: string, modele: DevisModele): Promise<void> {
  await createDevisModele(userId, {
    nom: `Copie de ${modele.nom}`.slice(0, 120),
    objet: modele.objet,
    lignes: modele.lignes,
  });
}

/* ----------------------------- CHANTIERS ----------------------------- */

export interface ChantierPayload {
  libelle: string;
  adresse: string;
  statut: string;
  date_debut: string | null;
  montant: number;
  client_id: number | null;
  /** Intervenant qui pilote le chantier, ou null si personne n'est désigné. */
  intervenant_id?: number | null;
  /** Bloc note libre attaché au chantier, ou null. */
  note?: string | null;
}

export async function createChantier(userId: string, payload: ChantierPayload): Promise<void> {
  const { error } = await supabase.from("chantiers").insert({ user_id: userId, ...payload });
  if (error) throw error;
}

export async function updateChantier(chantierId: number, payload: Partial<ChantierPayload>): Promise<void> {
  const { error } = await supabase.from("chantiers").update(payload).eq("id", chantierId);
  if (error) throw error;
}

/** Enregistre le bloc note libre d'un chantier (libellé vide autorisé, enregistré comme null). */
export async function updateChantierNote(chantierId: number, note: string): Promise<void> {
  await updateChantier(chantierId, { note: note.trim() ? note.trim() : null });
}

export async function deleteChantier(chantierId: number): Promise<void> {
  const { error } = await supabase.from("chantiers").delete().eq("id", chantierId);
  if (error) throw error;
}

export async function addEtape(chantierId: number, libelle: string): Promise<void> {
  const { error } = await supabase.from("etapes_chantier").insert({ chantier_id: chantierId, libelle, fait: false });
  if (error) throw error;
}

export async function toggleEtape(etapeId: number, fait: boolean): Promise<void> {
  const { error } = await supabase.from("etapes_chantier").update({ fait }).eq("id", etapeId);
  if (error) throw error;
}

export async function deleteEtape(etapeId: number): Promise<void> {
  const { error } = await supabase.from("etapes_chantier").delete().eq("id", etapeId);
  if (error) throw error;
}

/** Champs de suivi client modifiables sur un chantier. */
export interface ChantierSuiviPatch {
  suivi_actif?: boolean;
  message_client?: string | null;
  suivi_maj_at?: string;
}

/** Met à jour le partage du suivi (lien client actif, message visible par le client…). */
export async function updateChantierSuivi(chantierId: number, patch: ChantierSuiviPatch): Promise<void> {
  const { error } = await supabase.from("chantiers").update(patch).eq("id", chantierId);
  if (error) throw error;
}

/** Horodate la dernière modification visible sur la page de suivi du client. */
export async function marquerSuiviModifie(chantierId: number): Promise<void> {
  await updateChantierSuivi(chantierId, { suivi_maj_at: new Date().toISOString() });
}

/** Champs de suivi client modifiables sur une étape. */
export interface EtapeSuiviPatch {
  visible_client?: boolean;
  photo_url?: string | null;
  note_client?: string | null;
}

/** Met à jour ce que le client voit d'une étape (photo, commentaire, visibilité). */
export async function updateEtapeSuivi(etapeId: number, patch: EtapeSuiviPatch): Promise<void> {
  const { error } = await supabase.from("etapes_chantier").update(patch).eq("id", etapeId);
  if (error) throw error;
}

/* ----------------------------- PLANNING ------------------------------ */

export interface CreneauPayload {
  date: string;
  heure: string;
  libelle: string;
  ville: string;
  chantier_id: number | null;
  /** Intervenant affecté au créneau, ou null si non attribué. */
  intervenant_id?: number | null;
  /** Statut du créneau (« confirmee » / « provisoire » / « faite »), « confirmee » par défaut. */
  statut?: string;
  /** Note libre attachée au créneau, ou null. */
  note?: string | null;
}

export async function createCreneau(userId: string, payload: CreneauPayload): Promise<number> {
  const { data, error } = await supabase
    .from("planning_creneaux")
    .insert({
      user_id: userId,
      date: payload.date,
      heure: payload.heure,
      libelle: payload.libelle,
      ville: payload.ville,
      chantier_id: payload.chantier_id,
      intervenant_id: payload.intervenant_id ?? null,
      statut: payload.statut ?? "confirmee",
      note: payload.note?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  // L'identifiant servi à détecter un éventuel conflit de congé juste après la création.
  return Number((data as { id: number }).id);
}

export async function deleteCreneau(creneauId: number): Promise<void> {
  const { error } = await supabase.from("planning_creneaux").delete().eq("id", creneauId);
  if (error) throw error;
}

/* ----------------------------- RELANCES ------------------------------ */

export interface RelancePayload {
  devis_id: number;
  canal: string;
  message: string;
  date_prevue: string | null;
}

export interface ReprogrammationItem {
  id: number;
  ancienne_date: string | null;
  nouvelle_date: string | null;
  created_at: string;
}

export interface ReprogrammationFullItem extends ReprogrammationItem {
  relance_id: number;
}

export async function createRelance(payload: RelancePayload): Promise<number> {
  const { data, error } = await supabase
    .from("relances")
    .insert({ ...payload, statut: "Programmée" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: number }).id;
}

export async function updateRelanceStatut(relanceId: number, statut: string): Promise<void> {
  const { error } = await supabase.from("relances").update({ statut }).eq("id", relanceId);
  if (error) throw error;
}

/** Marque une relance comme envoyée automatiquement (escalade) et horodate l'envoi. */
export async function marquerEscaladeAuto(relanceId: number): Promise<void> {
  const { error } = await supabase
    .from("relances")
    .update({ escalade_auto: true, escalade_le: new Date().toISOString() })
    .eq("id", relanceId);
  if (error) throw error;
}

export interface RelanceSettings {
  auto: boolean;
  seuil: number;
  escaladeRetard: number;
}

export interface EscaladeRunResult {
  examined: number;
  envoye: number;
  echoue: number;
  journalises: number;
  recapEmails: number;
}

/**
 * Déclenche immédiatement un passage d'escalade côté serveur pour l'artisan courant
 * (exactement la même logique que la tâche planifiée 24/7), puis renvoie le résumé
 * du passage. Sert au bouton « Lancer maintenant » de la page Relances.
 */
export async function runEscaladeNow(userId: string): Promise<EscaladeRunResult> {
  const { data, error } = await supabase.functions.invoke("escalade-relances", { body: { userId } });
  if (error) throw new Error(error.message);
  const payload = data as (EscaladeRunResult & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le passage d'escalade a échoué.");
  return {
    examined: Number(payload.examined ?? 0),
    envoye: Number(payload.envoye ?? 0),
    echoue: Number(payload.echoue ?? 0),
    journalises: Number(payload.journalises ?? 0),
    recapEmails: Number(payload.recapEmails ?? 0),
  };
}

/**
 * Enregistre les réglages de relance dans le profil Backend pour que
 * l'escalade planifiée côté serveur (24/7) utilise les mêmes seuils.
 */
export async function updateRelanceSettings(userId: string, settings: RelanceSettings): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      relance_auto_actif: settings.auto,
      relance_seuil: settings.seuil,
      relance_escalade_retard: settings.escaladeRetard,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface RecapSettings {
  /** Récapitulatif quotidien activé ou coupé pour cet artisan. */
  actif: boolean;
  /** Canaux inclus dans le récapitulatif email (Email / SMS / WhatsApp). */
  canaux: string[];
  /** Heure d'envoi choisie par l'artisan (0-23, heure de Paris). */
  heure: number;
  /** Seuil (en jours) au-delà duquel un devis est considéré « sans réponse » (7 / 14 / 21). */
  devisSeuil: number;
  /** Relance automatique des factures critiques activée depuis le récap quotidien. */
  relanceFactureAuto: boolean;
  /** Seuil (en jours de retard) au-delà duquel une facture est relancée automatiquement. */
  relanceFactureSeuil: number;
  /** Délai minimum (en jours) entre deux rappels d'une même facture (anti-doublon). */
  relanceFactureDelai: number;
  /** Rappel à l'artisan la veille d'une relance programmée (email). */
  rappelActif: boolean;
  /** Heure d'envoi du rappel de la veille (0-23, heure de Paris). */
  rappelHeure: number;
}

/**
 * Enregistre les réglages du récapitulatif quotidien dans le profil Backend :
 * l'interrupteur d'activation, les canaux inclus, l'heure d'envoi, le seuil
 * des devis sans réponse, la relance automatique des factures critiques et le
 * rappel de la veille d'une relance programmée.
 */
export async function updateRecapSettings(userId: string, settings: RecapSettings): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      recap_quotidien_actif: settings.actif,
      recap_canaux: settings.canaux,
      recap_heure: settings.heure,
      recap_devis_seuil: settings.devisSeuil,
      relance_facture_auto_actif: settings.relanceFactureAuto,
      relance_facture_seuil: settings.relanceFactureSeuil,
      relance_facture_delai_min: settings.relanceFactureDelai,
      rappel_relance_actif: settings.rappelActif,
      rappel_relance_heure: settings.rappelHeure,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Une adresse mise en copie (Cc) d'un récap hebdo des envois automatiques. */
export interface AlerteEchecTestSettings {
  /** Avertir l'artisan par email quand un email de test échoue. */
  actif: boolean;
  /** Adresse de réception de l'alerte (vide = adresse du compte). */
  email: string;
}

/**
 * Mémorise le réglage de l'alerte d'échec des emails de test : l'interrupteur
 * d'activation et l'adresse de réception. La fonction Backend d'envoi de test lit
 * ces valeurs pour décider si (et à qui) expédier l'alerte automatique.
 */
export async function updateAlerteEchecTestSettings(
  userId: string,
  settings: AlerteEchecTestSettings,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      alerte_echec_test_actif: settings.actif,
      alerte_echec_test_email: settings.email.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Seuils de taux proposés pour l'alerte email (« sous X % »). */
export const SEUILS_ALERTE_TAUX = [50, 60, 70, 80, 90] as const;

/** Fenêtres de jours proposées pour l'alerte email (« pendant N jours »). */
export const JOURS_ALERTE_TAUX = [3, 5, 7, 14, 30] as const;

export interface TauxAlerteEmailSettings {
  /** Prévenir l'artisan par email si le taux de réussite passe sous le seuil. */
  actif: boolean;
  /** Seuil (en %) sous lequel on alerte. */
  seuil: number;
  /** Nombre de jours (fenêtre glissante) pendant lesquels le taux doit rester sous le seuil. */
  jours: number;
}

/**
 * Mémorise le réglage de l'alerte email sur le taux de réussite des emails de test :
 * l'interrupteur d'activation, le seuil (en %) et la fenêtre en jours. La tâche planifiée
 * horaire lit ces valeurs (et le taux réel des N derniers jours) pour décider s'il faut
 * prévenir l'artisan par email, une seule fois par période (anti-doublon côté serveur).
 */
export async function updateTauxAlerteEmailSettings(
  userId: string,
  settings: TauxAlerteEmailSettings,
): Promise<void> {
  const seuil = Math.min(100, Math.max(1, Math.round(Number.isFinite(settings.seuil) ? settings.seuil : 70)));
  const jours = Math.min(60, Math.max(1, Math.round(Number.isFinite(settings.jours) ? settings.jours : 7)));
  const { error } = await supabase
    .from("profiles")
    .update({
      taux_alerte_email_actif: settings.actif,
      taux_alerte_seuil: seuil,
      taux_alerte_jours: jours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface EnvoisAutoRecapHebdoCc {
  /** Libellé libre (« Comptable », « Collaborateur »…), optionnel. */
  nom?: string;
  /** Adresse email de la copie. */
  email: string;
}

export interface EnvoisAutoRecapHebdoSettings {
  /** Récap hebdomadaire par email activé. */
  actif: boolean;
  /** Jour de la semaine (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Adresses mises en copie (Cc) de chaque envoi (comptable, collaborateur…). */
  cc: EnvoisAutoRecapHebdoCc[];
}

/**
 * Enregistre les réglages du récapitulatif hebdomadaire des envois automatiques :
 * l'interrupteur d'activation, le jour de la semaine et l'heure d'envoi. La tâche
 * planifiée côté serveur lit ces réglages pour expédier la synthèse par email, et
 * l'artisan peut aussi se l'envoyer à la demande.
 */
export async function updateEnvoisAutoRecapHebdo(
  userId: string,
  settings: EnvoisAutoRecapHebdoSettings,
): Promise<void> {
  const jour = Math.min(7, Math.max(1, Math.round(Number.isFinite(settings.jour) ? settings.jour : 1)));
  const heure = Math.min(23, Math.max(0, Math.round(Number.isFinite(settings.heure) ? settings.heure : 8)));
  const cc = (settings.cc ?? [])
    .map((a) => ({ nom: a.nom?.trim() || undefined, email: a.email.trim() }))
    .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email));
  const { error } = await supabase
    .from("profiles")
    .update({
      envois_auto_recap_hebdo_actif: settings.actif,
      envois_auto_recap_hebdo_jour: jour,
      envois_auto_recap_hebdo_heure: heure,
      envois_auto_recap_hebdo_cc: cc,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface RecapHebdoPreview {
  /** HTML complet de l'email, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Nombre de destinataires (artisan + adresses en copie). */
  destinataires: number;
}

/**
 * Génère l'aperçu du récapitulatif hebdomadaire des envois automatiques, sans rien envoyer :
 * renvoie le HTML exact qui serait expédié (bouton « Aperçu de l'email »), même si Resend
 * n'est pas encore configuré, afin de pouvoir valider le rendu avant d'activer l'envoi.
 */
export async function previewRecapHebdoEnvois(userId: string): Promise<RecapHebdoPreview> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-envois-auto", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapHebdoPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap hebdomadaire a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    destinataires: Number(payload.destinataires ?? 1),
  };
}

export interface RecapHebdoRunResult {
  configured: boolean;
  sent: number;
  skipped: number;
  reason?: string;
}

/**
 * Déclenche à la demande l'envoi du récapitulatif hebdomadaire des envois automatiques
 * pour l'artisan courant (bouton « Tester maintenant »). `force` expédie l'email tout de
 * suite, sans attendre le jour et l'heure programmés.
 */
export async function runRecapHebdoEnvoisNow(userId: string): Promise<RecapHebdoRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-envois-auto", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RecapHebdoRunResult & {
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

export interface RecapEnvoi {
  id: number;
  envoye_le: string;
  repros: number;
  echecs: number;
  factures: number;
  devis: number;
}

/**
 * Récupère l'historique des récapitulatifs réellement envoyés (date + compteurs),
 * pour vérifier les envois passés depuis le tableau de bord.
 */
export async function fetchRecapEnvois(userId: string, limit = 8): Promise<RecapEnvoi[]> {
  const { data, error } = await supabase
    .from("recap_envois")
    .select("id, envoye_le, repros, echecs, factures, devis")
    .eq("user_id", userId)
    .order("envoye_le", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    envoye_le: String(row.envoye_le ?? ""),
    repros: Number(row.repros ?? 0),
    echecs: Number(row.echecs ?? 0),
    factures: Number(row.factures ?? 0),
    devis: Number(row.devis ?? 0),
  }));
}

export interface RelanceFacturesResult {
  configured: boolean;
  examined: number;
  sent: number;
  skipped: number;
  reason?: string;
}

/**
 * Déclenche à la demande l'envoi des relances pour les factures en retard de
 * l'artisan courant (bouton « Relancer les factures en retard » du tableau de bord).
 * Un email de rappel est envoyé au client de chaque facture non payée dont
 * l'échéance est dépassée.
 * `minJoursRetard` permet de ne cibler que les impayés les plus critiques (ex. +30 j).
 * `joindreBalanceAgee` joint à chaque client un PDF de sa propre balance âgée (ses factures
 * impayées par ancienneté) : un seul email par client, au lieu d'un email par facture.
 */
export async function runRelanceFacturesRetard(
  userId: string,
  minJoursRetard = 0,
  delaiMin = 0,
  joindreBalanceAgee = false,
): Promise<RelanceFacturesResult> {
  const { data, error } = await supabase.functions.invoke("relancer-factures-retard", {
    body: { userId, minJoursRetard, delaiMin, agedBalance: joindreBalanceAgee },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RelanceFacturesResult & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "La relance des factures a échoué.");
  return {
    configured: Boolean(payload.configured),
    examined: Number(payload.examined ?? 0),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: payload.reason ? String(payload.reason) : undefined,
  };
}

export interface RelanceFacturesPreview {
  /** HTML complet de l'email de rappel, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Nombre de factures ciblées par le filtre d'ancienneté. */
  examined: number;
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
}

/**
 * Génère l'aperçu de l'email de rappel de facture, sans rien envoyer : renvoie le
 * HTML exact qui serait expédié pour le filtre d'ancienneté courant (bouton « Aperçu »).
 */
export async function previewRelanceFactures(
  userId: string,
  minJoursRetard = 0,
  delaiMin = 0,
): Promise<RelanceFacturesPreview> {
  const { data, error } = await supabase.functions.invoke("relancer-factures-retard", {
    body: { userId, minJoursRetard, delaiMin, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RelanceFacturesPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du rappel a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    examined: Number(payload.examined ?? 0),
    configured: Boolean(payload.configured),
  };
}

export interface RelanceFactureTarget {
  factureId: number;
  numero: string;
  clientNom: string;
  email: string;
  montant: number;
  echeance: string | null;
  jours: number;
  palier: number;
}

export interface RelanceFacturesList {
  configured: boolean;
  minJoursRetard: number;
  examined: number;
  targets: RelanceFactureTarget[];
}

/**
 * Liste précisément les clients et factures qui seront relancés selon le filtre
 * d'ancienneté courant, sans rien envoyer (bouton « Vérifier avant envoi »).
 */
export async function listRelanceFactures(
  userId: string,
  minJoursRetard = 0,
  delaiMin = 0,
): Promise<RelanceFacturesList> {
  const { data, error } = await supabase.functions.invoke("relancer-factures-retard", {
    body: { userId, minJoursRetard, delaiMin, list: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RelanceFacturesList & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "La vérification avant envoi a échoué.");
  return {
    configured: Boolean(payload.configured),
    minJoursRetard: Number(payload.minJoursRetard ?? minJoursRetard),
    examined: Number(payload.examined ?? 0),
    targets: Array.isArray(payload.targets)
      ? payload.targets.map((t) => ({
          factureId: Number(t.factureId),
          numero: String(t.numero ?? ""),
          clientNom: String(t.clientNom ?? "Client"),
          email: String(t.email ?? ""),
          montant: Number(t.montant ?? 0),
          echeance: t.echeance ? String(t.echeance) : null,
          jours: Number(t.jours ?? 0),
          palier: Number(t.palier ?? 0),
        }))
      : [],
  };
}

export interface RelanceFactureEnvoi {
  id: number;
  client_nom: string;
  numero: string;
  montant: number;
  jours_retard: number;
  palier: number;
  auto: boolean;
  envoye_le: string;
}

/**
 * Récupère l'historique des relances de factures envoyées (date, client, montant,
 * palier de retard) pour l'onglet « Historique » du tableau de bord.
 */
export async function fetchRelanceFactureEnvois(userId: string, limit = 20): Promise<RelanceFactureEnvoi[]> {
  const { data, error } = await supabase
    .from("relance_facture_envois")
    .select("id, client_nom, numero, montant, jours_retard, palier, auto, envoye_le")
    .eq("user_id", userId)
    .order("envoye_le", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    client_nom: String(row.client_nom ?? "Client"),
    numero: String(row.numero ?? ""),
    montant: Number(row.montant ?? 0),
    jours_retard: Number(row.jours_retard ?? 0),
    palier: Number(row.palier ?? 0),
    auto: Boolean(row.auto),
    envoye_le: String(row.envoye_le ?? ""),
  }));
}

/**
 * Récupère tout l'historique des relances de factures envoyées (sans limite), pour
 * alimenter le mini-graphe hebdomadaire et l'export CSV d'archive comptable.
 * RLS garantit qu'un artisan ne récupère que ses propres relances.
 */
export async function fetchRelanceFactureEnvoisAll(userId: string): Promise<RelanceFactureEnvoi[]> {
  const { data, error } = await supabase
    .from("relance_facture_envois")
    .select("id, client_nom, numero, montant, jours_retard, palier, auto, envoye_le")
    .eq("user_id", userId)
    .order("envoye_le", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    client_nom: String(row.client_nom ?? "Client"),
    numero: String(row.numero ?? ""),
    montant: Number(row.montant ?? 0),
    jours_retard: Number(row.jours_retard ?? 0),
    palier: Number(row.palier ?? 0),
    auto: Boolean(row.auto),
    envoye_le: String(row.envoye_le ?? ""),
  }));
}

export interface RecapRunResult {
  configured: boolean;
  sent: number;
  skipped: number;
  users: number;
  window: string;
  reason?: string;
}

/**
 * Déclenche à la demande le récapitulatif quotidien par email pour l'artisan courant
 * (bouton « Tester le récap maintenant »). `force` envoie l'email même sans contenu,
 * pour vérifier la configuration et le rendu.
 */
export async function runRecapNow(userId: string): Promise<RecapRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-quotidien", {
    body: { userId, force: true, windowHours: 24 },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapRunResult & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le récapitulatif a échoué.");
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    users: Number(payload.users ?? 0),
    window: String(payload.window ?? ""),
    reason: payload.reason ? String(payload.reason) : undefined,
  };
}

export interface RecapPreview {
  /** HTML complet de l'email, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Nombre de reprogrammations incluses. */
  repros: number;
  /** Nombre d'échecs inclus. */
  echecs: number;
  /** Nombre de factures en retard incluses. */
  factures: number;
  /** Nombre de devis sans réponse inclus. */
  devis: number;
  /** Fenêtre temporelle affichée (ex. « dernières 24 h »). */
  window: string;
}

/**
 * Génère l'aperçu du récapitulatif quotidien pour l'artisan courant, sans envoyer
 * d'email : renvoie le HTML exact qui serait envoyé (bouton « Aperçu »).
 */
export async function previewRecap(userId: string): Promise<RecapPreview> {
  const { data, error } = await supabase.functions.invoke("recap-quotidien", {
    body: { userId, force: true, windowHours: 24, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récapitulatif a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    repros: Number(payload.repros ?? 0),
    echecs: Number(payload.echecs ?? 0),
    factures: Number(payload.factures ?? 0),
    devis: Number(payload.devis ?? 0),
    window: String(payload.window ?? ""),
  };
}

/** Enregistre une ligne d'historique pour une reprogrammation de relance (best effort). */
async function logReprogrammation(
  relanceId: number,
  ancienneDate: string | null,
  nouvelleDate: string | null,
): Promise<void> {
  await supabase.from("relance_reprogrammations").insert({
    relance_id: relanceId,
    ancienne_date: ancienneDate,
    nouvelle_date: nouvelleDate,
  });
}

export interface EscaladeJournalRow {
  id: number;
  run_at: string;
  examined: number;
  envoye: number;
  echoue: number;
  clients: { nom: string; canal: string; numero: string | null; jours: number }[];
  clientsEchoues: { nom: string; canal: string; numero: string | null; jours: number; erreur: string }[];
  relancesEchouees: number[];
}

/**
 * Récupère l'intégralité du journal d'escalade (tous les passages, sans limite),
 * pour permettre un export complet au-delà des derniers passages affichés à l'écran.
 * RLS garantit qu'un artisan ne récupère que ses propres passages.
 */
export async function fetchEscaladeJournalAll(): Promise<EscaladeJournalRow[]> {
  const { data, error } = await supabase
    .from("escalade_journal")
    .select("id, run_at, examined, envoye, echoue, clients, clients_echoues, relances_echouees")
    .order("run_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    run_at: String(row.run_at ?? ""),
    examined: Number(row.examined ?? 0),
    envoye: Number(row.envoye ?? 0),
    echoue: Number(row.echoue ?? 0),
    clients: Array.isArray(row.clients)
      ? (row.clients as Array<Record<string, unknown>>).map((c) => ({
          nom: String(c?.nom ?? "Client"),
          canal: String(c?.canal ?? "Email"),
          numero: c?.numero === null || c?.numero === undefined ? null : String(c.numero),
          jours: Number(c?.jours ?? 0),
        }))
      : [],
    clientsEchoues: Array.isArray(row.clients_echoues)
      ? (row.clients_echoues as Array<Record<string, unknown>>).map((c) => ({
          nom: String(c?.nom ?? "Client"),
          canal: String(c?.canal ?? "Email"),
          numero: c?.numero === null || c?.numero === undefined ? null : String(c.numero),
          jours: Number(c?.jours ?? 0),
          erreur: String(c?.erreur ?? "Envoi impossible."),
        }))
      : [],
    relancesEchouees: Array.isArray(row.relances_echouees)
      ? (row.relances_echouees as unknown[]).map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [],
  }));
}

/**
 * Relance l'escalade uniquement sur les relances dont l'envoi avait échoué lors d'un passage
 * (bouton « Réessayer les échecs »). Le seuil de reprogrammations n'est pas ré-appliqué :
 * on retente précisément ce qui a raté.
 */
export async function retryEscaladeFailures(userId: string, relanceIds: number[]): Promise<EscaladeRunResult> {
  const { data, error } = await supabase.functions.invoke("escalade-relances", {
    body: { userId, retryIds: relanceIds },
  });
  if (error) throw new Error(error.message);
  const payload = data as (EscaladeRunResult & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le réessai des échecs a échoué.");
  return {
    examined: Number(payload.examined ?? 0),
    envoye: Number(payload.envoye ?? 0),
    echoue: Number(payload.echoue ?? 0),
    journalises: Number(payload.journalises ?? 0),
    recapEmails: Number(payload.recapEmails ?? 0),
  };
}

/**
 * Reprogramme la date prévue d'une relance et incrémente son compteur de reprogrammations
 * (sert à détecter les relances repoussées plusieurs fois).
 */
export async function updateRelanceDate(relanceId: number, datePrevue: string | null): Promise<void> {
  const { data, error: readError } = await supabase
    .from("relances")
    .select("reprogrammations, date_prevue")
    .eq("id", relanceId)
    .maybeSingle();
  if (readError) throw readError;
  const row = (data ?? {}) as { reprogrammations?: number; date_prevue?: string | null };
  const current = Number(row.reprogrammations ?? 0);
  const { error } = await supabase
    .from("relances")
    .update({ date_prevue: datePrevue, reprogrammations: current + 1 })
    .eq("id", relanceId);
  if (error) throw error;
  await logReprogrammation(relanceId, row.date_prevue ?? null, datePrevue);
}

/** Récupère l'historique des reprogrammations d'une relance (la plus récente en premier). */
export async function fetchRelanceReprogrammations(relanceId: number): Promise<ReprogrammationItem[]> {
  const { data, error } = await supabase
    .from("relance_reprogrammations")
    .select("id, ancienne_date, nouvelle_date, created_at")
    .eq("relance_id", relanceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    ancienne_date: row.ancienne_date ? String(row.ancienne_date) : null,
    nouvelle_date: row.nouvelle_date ? String(row.nouvelle_date) : null,
    created_at: String(row.created_at ?? ""),
  }));
}

/**
 * Récupère l'historique des reprogrammations de toutes les relances fournies,
 * pour un onglet « Historique » agrégé (toutes relances confondues).
 * Scopé aux ids de l'artisan pour ne jamais remonter les données d'un autre compte.
 */
export async function fetchReprogrammationsForRelances(relanceIds: number[]): Promise<ReprogrammationFullItem[]> {
  if (!relanceIds.length) return [];
  const { data, error } = await supabase
    .from("relance_reprogrammations")
    .select("id, relance_id, ancienne_date, nouvelle_date, created_at")
    .in("relance_id", relanceIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    relance_id: Number(row.relance_id),
    ancienne_date: row.ancienne_date ? String(row.ancienne_date) : null,
    nouvelle_date: row.nouvelle_date ? String(row.nouvelle_date) : null,
    created_at: String(row.created_at ?? ""),
  }));
}

/**
 * Duplique une relance existante en une nouvelle relance « Programmée »,
 * datée par défaut sur aujourd'hui + N jours (7 par défaut).
 */
export async function duplicateRelance(
  source: { devis_id: number; canal: string; message: string | null },
  joursAvance = 7,
): Promise<number> {
  const datePrevue = toISODate(addDays(new Date(), joursAvance));
  const { data, error } = await supabase
    .from("relances")
    .insert({
      devis_id: source.devis_id,
      canal: source.canal,
      message: source.message,
      date_prevue: datePrevue,
      statut: "Programmée",
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: number }).id;
}

/**
 * Reprogramme en une seule fois toutes les relances fournies en les reculant
 * sur aujourd'hui + N jours (7 par défaut), et incrémente leur compteur de reprogrammations.
 */
export async function reprogrammerRelancesEnRetard(relanceIds: number[], joursAvance = 7): Promise<void> {
  if (!relanceIds.length) return;
  const datePrevue = toISODate(addDays(new Date(), joursAvance));
  const { data, error: readError } = await supabase
    .from("relances")
    .select("id, reprogrammations, date_prevue")
    .in("id", relanceIds);
  if (readError) throw readError;
  const info = new Map<number, { count: number; date: string | null }>();
  (data ?? []).forEach((row) => {
    const r = row as Record<string, unknown>;
    info.set(Number(r.id), {
      count: Number(r.reprogrammations ?? 0),
      date: r.date_prevue ? String(r.date_prevue) : null,
    });
  });
  for (const id of relanceIds) {
    const current = info.get(id);
    const { error } = await supabase
      .from("relances")
      .update({ date_prevue: datePrevue, reprogrammations: (current?.count ?? 0) + 1 })
      .eq("id", id);
    if (error) throw error;
    await logReprogrammation(id, current?.date ?? null, datePrevue);
  }
}

export async function deleteRelance(relanceId: number): Promise<void> {
  const { error } = await supabase.from("relances").delete().eq("id", relanceId);
  if (error) throw error;
}

/* ----------------------------- FACTURES ------------------------------ */

/** Génère le prochain numéro séquentiel de facture (FAC) ou d'avoir (AV) pour l'année en cours. */
async function nextDocumentNumero(userId: string, prefix: "FAC" | "AV"): Promise<string> {
  const { data } = await supabase.from("factures").select("numero").eq("user_id", userId);
  let max = 0;
  (data ?? []).forEach((row) => {
    const numero = String((row as { numero?: unknown }).numero ?? "");
    if (!numero.startsWith(prefix)) return;
    const m = /(\d+)\s*$/.exec(numero);
    if (m) max = Math.max(max, Number(m[1]));
  });
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export interface SourceDevisFacture {
  id: number;
  client_id: number | null;
  numero: string;
  total_ht: number;
  total_ttc: number;
}

/**
 * Génère une facture (statut « Émise ») à partir d'un devis signé.
 * Les lignes de prestation sont copiées à cet instant : la facture reste figée
 * même si le devis d'origine est modifié plus tard.
 * Le délai d'échéance est paramétrable (15, 30 ou 45 jours).
 */
export async function createFactureFromDevis(
  userId: string,
  devis: SourceDevisFacture,
  echeanceJours = 30,
): Promise<void> {
  const numero = await nextDocumentNumero(userId, "FAC");
  const now = new Date();
  const lignes = await fetchDevisLignes(devis.id);
  const { error } = await supabase.from("factures").insert({
    user_id: userId,
    devis_id: devis.id,
    client_id: devis.client_id,
    numero,
    statut: "Émise",
    total_ht: devis.total_ht,
    total_ttc: devis.total_ttc,
    date_emission: toISODate(now),
    date_echeance: toISODate(addDays(now, echeanceJours)),
    lignes,
  });
  if (error) throw error;
}

/**
 * Met à jour le statut d'une facture. Au passage en « Payée », la date de
 * règlement est posée automatiquement au jour courant (si elle n'existe pas
 * encore) ; elle devient ensuite modifiable à la main. Un retour à un autre
 * statut efface la date de règlement.
 */
export async function updateFactureStatut(factureId: number, statut: string): Promise<void> {
  const estPayee = statut === "Payée";
  const patch: Record<string, unknown> = { statut };
  if (estPayee) {
    const { data } = await supabase.from("factures").select("date_paiement").eq("id", factureId).maybeSingle();
    const existante = (data as { date_paiement?: string | null } | null)?.date_paiement ?? null;
    patch.date_paiement = existante ?? todayISO();
  } else {
    patch.date_paiement = null;
  }
  const { error } = await supabase.from("factures").update(patch).eq("id", factureId);
  if (error) throw error;
}

/** Enregistre (ou efface) la date de règlement réelle d'une facture réglée. */
export async function updateFactureDatePaiement(factureId: number, datePaiement: string | null): Promise<void> {
  const { error } = await supabase
    .from("factures")
    .update({ date_paiement: datePaiement || null })
    .eq("id", factureId);
  if (error) throw error;
}

export async function deleteFacture(factureId: number): Promise<void> {
  const { error } = await supabase.from("factures").delete().eq("id", factureId);
  if (error) throw error;
}

export interface FactureDuplicationSource {
  devis_id: number | null;
  client_id: number | null;
  total_ht: number;
  total_ttc: number;
  lignes: LigneInput[];
}

/**
 * Duplique une facture à l'identique : mêmes lignes et montants, nouveau numéro FAC,
 * statut « Émise » et dates recalées sur aujourd'hui.
 */
export async function duplicateFacture(userId: string, source: FactureDuplicationSource): Promise<void> {
  const numero = await nextDocumentNumero(userId, "FAC");
  const now = new Date();
  const { error } = await supabase.from("factures").insert({
    user_id: userId,
    devis_id: source.devis_id,
    client_id: source.client_id,
    numero,
    statut: "Émise",
    total_ht: source.total_ht,
    total_ttc: source.total_ttc,
    date_emission: toISODate(now),
    date_echeance: toISODate(addDays(now, 30)),
    lignes: source.lignes,
  });
  if (error) throw error;
}

/**
 * Crée un avoir (note de crédit) à partir d'une facture : mêmes lignes mais quantités et
 * montants négatifs, numéro AV-YYYY-NNNN, statut « Émise ».
 */
export async function createAvoirFromFacture(userId: string, source: FactureDuplicationSource): Promise<void> {
  const numero = await nextDocumentNumero(userId, "AV");
  const now = new Date();
  const lignes = source.lignes.map((l) => ({ ...l, quantite: -Math.abs(Number(l.quantite) || 0) }));
  const { error } = await supabase.from("factures").insert({
    user_id: userId,
    devis_id: source.devis_id,
    client_id: source.client_id,
    numero,
    statut: "Émise",
    total_ht: -Math.abs(Number(source.total_ht) || 0),
    total_ttc: -Math.abs(Number(source.total_ttc) || 0),
    date_emission: toISODate(now),
    date_echeance: toISODate(now),
    lignes,
  });
  if (error) throw error;
}

/**
 * Enregistre la pause vacances dans le profil Backend. `jours` = null lève la pause ;
 * sinon on coupe le récap quotidien et les relances automatiques jusqu'à aujourd'hui + N jours.
 */
export async function updatePauseVacances(userId: string, dateFin: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ pause_jusqu_au: dateFin, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Enregistre (ou retire) le décalage favori utilisé pour la reprogrammation en lot
 * des relances programmées. `days = null` retire le réglage par défaut.
 */
export async function updateDecalageFavori(userId: string, days: number | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ decalage_favori: days, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/* --------------------------- COMPTABILITÉ --------------------------- */

/** Mémorise l'adresse email du comptable dans le profil, pour les prochains envois. */
export async function updateComptableEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_email: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise le commentaire libre joint aux envois de régularité au comptable, afin de le
 * reproposer tel quel au prochain envoi sans avoir à le ressaisir. Un commentaire vide l'efface.
 */
export async function updateComptableCommentaire(userId: string, commentaire: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_commentaire: commentaire.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise la dernière adresse ponctuelle utilisée pour un renvoi du journal (ex. un
 * expert-comptable remplaçant), afin de la reproposer en suggestion au prochain renvoi.
 * Un email vide efface la suggestion. L'email habituel du comptable n'est pas modifié.
 */
export async function updateComptableOverrideEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_override_email: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise l'adresse ponctuelle PAR DÉFAUT (ex. l'expert-comptable remplaçant habituel) dans
 * le profil : elle est pré-remplie au tout premier renvoi à une adresse ponctuelle, avant même
 * qu'une adresse n'ait été utilisée. Un email vide l'efface. L'email habituel du comptable n'est
 * pas modifié.
 */
export async function updateComptableOverrideEmailDefaut(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_override_email_defaut: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Adresse ponctuelle nommée (ex. « Comptable remplaçant A ») proposée au moment d'un renvoi. */
export interface OverrideAdresse {
  nom: string;
  email: string;
}

/**
 * Enregistre la liste des adresses ponctuelles nommées de l'artisan (ex. « Comptable remplaçant A »,
 * « Cabinet externe »). Ces adresses sont proposées au moment d'un renvoi (journal ou bilan) pour
 * éviter de les ressaisir. L'email habituel du comptable n'est pas modifié.
 */
export async function updateComptableOverrideAdresses(
  userId: string,
  adresses: OverrideAdresse[],
): Promise<void> {
  const propre = adresses
    .map((a) => ({ nom: a.nom.trim(), email: a.email.trim() }))
    .filter((a) => a.nom.length > 0 && a.email.length > 0);
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_override_adresses: propre, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Met de côté l'alerte « bilan manquant » du tableau de bord jusqu'à une date donnée
 * (AAAA-MM-JJ), afin de ne plus l'avoir à l'écran pendant l'attente. `date = null` réactive
 * l'alerte immédiatement.
 */
export async function updateComptableBilanAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_bilan_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Met de côté l'alerte « santé du compte sous le seuil deux semaines de suite » du tableau de
 * bord jusqu'à une date donnée (AAAA-MM-JJ), afin de ne plus l'avoir à l'écran pendant l'attente.
 * `date = null` réactive l'alerte immédiatement.
 */
export async function updateSanteAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ sante_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Met de côté l'alerte « taux de réussite en chute » du tableau de bord jusqu'à une date donnée
 * (AAAA-MM-JJ), afin de ne plus l'avoir à l'écran pendant l'attente. `date = null` réactive
 * l'alerte immédiatement.
 */
export async function updateTauxAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ taux_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Met de côté l'alerte « taux d'encaissement faible » du tableau de bord jusqu'à une date donnée
 * (AAAA-MM-JJ), afin de ne plus l'avoir à l'écran pendant l'attente. `date = null` réactive
 * l'alerte immédiatement.
 */
export async function updateEncaissementAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ encaissement_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Met de côté l'alerte « comptes oubliés sur vos derniers récaps » du tableau de bord jusqu'à
 * une date donnée (AAAA-MM-JJ). Le raccourci « Masquer aujourd'hui » y place la date du jour :
 * le bandeau reste masqué pour la journée et réapparaît le lendemain. `date = null` réactive
 * l'alerte immédiatement.
 */
export async function updateRecontactOubliesAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ recontact_oublies_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Renvoi de remplacement : un bilan ou un journal transmis à une adresse ponctuelle nommée. */
export interface ComptableRemplacement {
  id: number;
  /** Adresse ponctuelle réellement utilisée. */
  adresse: string;
  /** Libellé choisi par l'artisan (« Comptable remplaçant A »), ou null. */
  nom: string | null;
  /** Exercice concerné (« 2025 » pour un bilan, « AAAA-MM » pour un journal), ou null. */
  exercice: string | null;
  /** Nature du renvoi : « bilan » ou « journal ». */
  type: string | null;
  /** Date et heure du renvoi (ISO). */
  envoye_le: string;
}

/**
 * Récupère la liste des renvois de remplacement déjà effectués (adresse ponctuelle, libellé,
 * exercice concerné, nature et date), pour la vue « Remplacements » de l'Espace comptable.
 * RLS garantit qu'un artisan ne voit que ses propres renvois.
 */
export async function fetchComptableRemplacements(
  userId: string,
  limit = 100,
): Promise<ComptableRemplacement[]> {
  const { data, error } = await supabase
    .from("comptable_remplacements")
    .select("id, adresse, nom, exercice, type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    adresse: String(row.adresse ?? ""),
    nom: row.nom === null || row.nom === undefined ? null : String(row.nom),
    exercice: row.exercice === null || row.exercice === undefined ? null : String(row.exercice),
    type: row.type === null || row.type === undefined ? null : String(row.type),
    envoye_le: String(row.created_at ?? ""),
  }));
}

export interface ComptableAutoSettings {
  /** Envoi automatique mensuel activé. */
  actif: boolean;
  /** Jour du mois (1-28) de l'envoi. */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Joindre en plus un récap de régularité (graphe + CSV) au même envoi automatique. */
  rapportAuto: boolean;
  /** Recevoir aussi une copie du récap de régularité dans sa propre boîte. */
  copieArtisan: boolean;
}

/**
 * Enregistre les réglages de l'envoi automatique mensuel du journal au comptable.
 * La tâche planifiée côté serveur lit ces réglages pour expédier le journal du mois
 * écoulé au comptable, le jour et à l'heure choisis. `rapportAuto` ajoute, au même
 * moment, un second email de récapitulatif de régularité (graphe + CSV) ; `copieArtisan`
 * décide si l'artisan en reçoit également une copie dans sa propre boîte.
 */
export async function updateComptableAutoSettings(
  userId: string,
  settings: ComptableAutoSettings,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      comptable_auto_actif: settings.actif,
      comptable_auto_jour: settings.jour,
      comptable_auto_heure: settings.heure,
      comptable_rapport_auto_actif: settings.rapportAuto,
      comptable_rapport_copie_artisan: settings.copieArtisan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface ComptableExportPrefs {
  /** Période d'archive mémorisée (« 6 » / « 12 » / « 24 »). */
  periode: string;
  /** Format d'export par défaut (« image » / « csv » / « both »). */
  format: "image" | "csv" | "both";
}

/**
 * Mémorise les préférences d'export du mini-graphe de régularité (période 6/12/24 mois
 * et format par défaut), afin de les reproposer telles quelles à la prochaine visite.
 */
export async function updateComptableExportPrefs(userId: string, prefs: ComptableExportPrefs): Promise<void> {
  const periode = ["6", "12", "24"].includes(prefs.periode) ? prefs.periode : "12";
  const format = ["image", "csv", "both"].includes(prefs.format) ? prefs.format : "both";
  const { error } = await supabase
    .from("profiles")
    .update({
      comptable_export_periode: periode,
      comptable_export_format: format,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Type d'export de l'historique des envois, mémorisé pour être reproposé à la prochaine visite. */
export type ComptableExportKind = "csv-filtre" | "csv-complet" | "pdf-filtre" | "pdf-complet" | "bilan";

const COMPTABLE_EXPORT_KINDS: ComptableExportKind[] = [
  "csv-filtre",
  "csv-complet",
  "pdf-filtre",
  "pdf-complet",
  "bilan",
];

/**
 * Mémorise le dernier type d'export utilisé dans l'historique des envois (CSV filtré ou
 * complet, PDF filtré ou complet), afin de le mettre en avant et de le reproposer à la
 * prochaine visite de l'Espace comptable.
 */
export async function updateComptableDernierExport(userId: string, kind: ComptableExportKind): Promise<void> {
  const valide = COMPTABLE_EXPORT_KINDS.includes(kind) ? kind : "csv-filtre";
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_export_dernier: valide, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export interface ComptableRelanceManquanteSettings {
  /** Prévenir l'artisan quand un mois attendu reste sans envoi automatique. */
  actif: boolean;
  /** Délai (en jours) après le jour d'envoi avant de prévenir l'artisan. */
  delai: number;
}

/**
 * Enregistre le réglage d'alerte à l'artisan : quand un mois attendu reste sans envoi
 * automatique passé le délai choisi, un email de relance lui est expédié par la tâche
 * planifiée côté serveur (la clé Resend reste côté serveur).
 */
export async function updateComptableRelanceSettings(
  userId: string,
  settings: ComptableRelanceManquanteSettings,
): Promise<void> {
  const delai = Number.isFinite(settings.delai) ? Math.min(Math.max(Math.round(settings.delai), 1), 30) : 3;
  const { error } = await supabase
    .from("profiles")
    .update({
      comptable_relance_manquante_actif: settings.actif,
      comptable_relance_delai: delai,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise la base publique de l'application dans le profil, afin que les emails
 * comptables (récap de régularité, alerte artisan) puissent contenir un lien direct
 * vers l'Espace comptable, y compris lors d'un envoi automatique déclenché côté serveur.
 */
export async function updateComptableAppUrl(userId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comptable_app_url: url.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export interface ComptableBilanSettings {
  /** Envoi automatique du bilan d'archivage annuel activé. */
  actif: boolean;
  /** Jour du mois de janvier (1-28) où part le bilan. */
  jour: number;
  /** Recevoir aussi une copie du bilan d'archivage dans sa propre boîte. */
  copieArtisan: boolean;
}

/**
 * Enregistre le réglage du bilan d'archivage annuel : en début d'année, l'historique des
 * envois comptables de l'exercice écoulé est expédié au comptable (PDF d'archivage), sur le
 * même principe que l'envoi mensuel. La tâche planifiée côté serveur lit ces réglages.
 */
export async function updateComptableBilanSettings(
  userId: string,
  settings: ComptableBilanSettings,
): Promise<void> {
  const jour = Number.isFinite(settings.jour) ? Math.min(Math.max(Math.round(settings.jour), 1), 28) : 5;
  const { error } = await supabase
    .from("profiles")
    .update({
      comptable_bilan_auto_actif: settings.actif,
      comptable_bilan_jour: jour,
      comptable_bilan_copie_artisan: settings.copieArtisan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface BilanRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Année clôturée visée (ex. « 2026 »). */
  annee: string;
  /** Nombre d'envois réellement effectués. */
  sent: number;
  /** Nombre d'envois ignorés. */
  skipped: number;
  /** Nombre de lignes d'historique reprises dans le bilan. */
  lignes?: number;
  /** Raison de l'ignorance éventuelle (utile pour un test immédiat). */
  reason?: string;
}

/**
 * Déclenche immédiatement un envoi réel du bilan d'archivage annuel au comptable, exactement
 * comme le ferait la tâche planifiée (mode « forcé » qui ignore la fenêtre de janvier et
 * l'anti-doublon). Sert au bouton « Tester maintenant » de la carte d'envoi automatique, au
 * renvoi d'un exercice depuis la liste des bilans et au bouton « Renvoyer le dernier bilan »
 * du tableau de bord. `overrideTo`, s'il est fourni, ajoute une adresse ponctuelle (ex.
 * expert-comptable remplaçant) en copie du bilan, sans modifier l'email mémorisé du comptable.
 * `overrideNom` ajoute le libellé choisi (ex. « Comptable remplaçant A ») à la trace du remplacement.
 */
export async function runEnvoiBilanNow(
  userId: string,
  annee?: string,
  overrideTo?: string,
  overrideNom?: string,
): Promise<BilanRunResult> {
  const body: Record<string, unknown> = { userId, force: true };
  if (annee && /^\d{4}$/.test(annee)) body.annee = annee;
  if (overrideTo && overrideTo.trim()) body.overrideTo = overrideTo.trim();
  if (overrideNom && overrideNom.trim()) body.overrideNom = overrideNom.trim();
  const { data, error } = await supabase.functions.invoke("envoi-bilan-annuel", {
    body,
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (BilanRunResult & { ok?: boolean; error?: string; details?: Array<{ sent?: boolean; reason?: string; lignes?: number }> })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le test du bilan d'archivage a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    annee: String(payload.annee ?? ""),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    lignes: detail?.lignes != null ? Number(detail.lignes) : undefined,
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

export interface RelanceManquanteRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Nombre d'emails de relance réellement envoyés. */
  sent: number;
  /** Nombre de profils ignorés. */
  skipped: number;
  /** Raison de l'ignorance éventuelle (utile pour un test immédiat). */
  reason?: string;
}

/**
 * Déclenche immédiatement un envoi réel de l'email d'alerte à l'artisan (« Tester
 * maintenant ») : le mois attendu est simulé et l'email part tout de suite, sans
 * attendre un vrai mois manquant. Le repère anti-doublon n'est pas touché, afin de
 * ne pas court-circuiter l'alerte réelle du mois en cours.
 */
export async function runRelanceManquanteNow(userId: string): Promise<RelanceManquanteRunResult> {
  const { data, error } = await supabase.functions.invoke("relance-envoi-manquant", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RelanceManquanteRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le test de l'alerte a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/**
 * Envoie le journal comptable (devis, factures et paiements de la période) au comptable
 * par email, avec le PDF consolidé en pièce jointe. Passe par une Edge Function pour que
 * la clé Resend reste côté serveur.
 */
export async function sendJournalComptableEmail(payload: {
  to: string;
  pdfBase64: string;
  filename: string;
  periodeLabel: string;
  clientLabel?: string;
  message?: string;
  /** Nombre de lignes du journal transmis (tracé dans l'historique). */
  lignes?: number;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-journal-comptable", { body: payload });
  if (error) throw new Error(error.message);
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) throw new Error(result?.error || "L'envoi du journal au comptable a échoué.");
}

export interface JournalRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Mois écoulé visé (clé « AAAA-MM »). */
  month: string;
  /** Libellé lisible du mois écoulé (« Septembre 2026 »). */
  monthLabel: string;
  /** Nombre d'envois réellement effectués. */
  sent: number;
  /** Nombre d'envois ignorés. */
  skipped: number;
  /** Raison de l'ignorance éventuelle (utile pour un test immédiat). */
  reason?: string;
}

export interface RecapRapportPreview {
  /** HTML complet de l'email de régularité, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Audience visée : l'email dédié à l'artisan, ou celui du comptable. */
  audience: "artisan" | "comptable";
  /** Nombre de mois couverts par le récap. */
  periode: number;
  /** Nombre de mois présents dans l'historique analysé. */
  mois: number;
}

/**
 * Génère l'aperçu de l'email de récapitulatif de régularité, sans rien envoyer : renvoie
 * l'objet et le HTML exacts qui seraient expédiés. `audience = "artisan"` cible l'email
 * dédié à l'artisan (« voici votre régularité »), `"comptable"` celui du comptable.
 * Sert au bouton « Aperçu » de la carte d'envoi automatique.
 */
export async function previewRecapRapport(
  userId: string,
  audience: "artisan" | "comptable" = "artisan",
): Promise<RecapRapportPreview> {
  const { data, error } = await supabase.functions.invoke("envoi-journal-mensuel", {
    body: { userId, previewRecap: audience },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapRapportPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap de régularité a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    audience: payload.audience === "comptable" ? "comptable" : "artisan",
    periode: Number(payload.periode ?? 12),
    mois: Number(payload.mois ?? 0),
  };
}

/**
 * Déclenche immédiatement un envoi réel du journal du mois écoulé au comptable,
 * exactement comme le ferait la tâche planifiée (mode « forcé » qui ignore le
 * jour/heure programmés et l'anti-doublon). Sert au bouton « Tester maintenant » :
 * on vérifie le rendu de l'email et de la pièce jointe avant de compter sur
 * l'envoi automatique mensuel.
 */
export async function runEnvoiJournalNow(userId: string): Promise<JournalRunResult> {
  const { data, error } = await supabase.functions.invoke("envoi-journal-mensuel", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (JournalRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de test a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    month: String(payload.month ?? ""),
    monthLabel: String(payload.monthLabel ?? ""),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

export interface ComptableEnvoi {
  id: number;
  /** Date et heure de l'envoi (ISO). */
  envoye_le: string;
  /** Mois du journal envoyé (« Septembre 2026 »), extrait de l'objet, ou null. */
  mois: string | null;
  /** Clé du mois du journal (« 2026-09 »), pour permettre le renvoi ciblé, ou null. */
  moisCle: string | null;
  /** Origine de l'envoi : « automatique » (planifié) ou « manuel » (test/renvoi). */
  mode: string | null;
  /** Nombre de lignes du journal transmis, ou null si inconnu. */
  lignes: number | null;
  /** Adresse du comptable destinataire. */
  destinataire: string | null;
  /** Objet de l'email envoyé. */
  sujet: string | null;
  /** Type technique de l'envoi : « comptable » (journal) ou « comptable_recap » (récap régularité). */
  type: string | null;
  /** Vrai s'il s'agit du second email (récap de régularité) et non du journal. */
  recap: boolean;
  /** Description des pièces jointes de l'envoi (« CSV joint », « Graphe + CSV joint »…), ou null. */
  pieces: string | null;
  /** Envoi de test (« Envoyer un test à moi-même ») : à distinguer des transmissions réelles. */
  test: boolean;
}

/** Convertit un libellé de mois français (« Septembre 2026 ») en clé « 2026-09 ». */
function cleDepuisMoisLabel(label: string | null): string | null {
  if (!label) return null;
  const m = /([A-Za-zéûôàè]+)\s+(\d{4})/.exec(label);
  if (!m) return null;
  const norm = m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const MOIS: Record<string, number> = {
    janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  };
  const num = MOIS[norm];
  if (!num) return null;
  return `${m[2]}-${String(num).padStart(2, "0")}`;
}

/**
 * Récupère l'historique des envois comptables (journal + récaps de régularité),
 * automatiques ou manuels : une entrée par email expédié, la plus récente en premier.
 * RLS garantit qu'un artisan ne voit que ses propres envois.
 */
export async function fetchComptableEnvois(userId: string, limit = 12, offset = 0): Promise<ComptableEnvoi[]> {
  const { data, error } = await supabase
    .from("envois_email")
    .select("id, destinataire, sujet, created_at, mois_cle, mode, nb_lignes, type, pieces, est_test")
    .eq("user_id", userId)
    .in("type", ["comptable", "comptable_recap"])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const sujet = row.sujet === null || row.sujet === undefined ? null : String(row.sujet);
    let mois: string | null = null;
    if (sujet) {
      // Objets du type « Journal comptable — Septembre 2026 » : on isole le mois.
      const m = /—\s*(.+)$/.exec(sujet);
      if (m) mois = m[1].trim();
    }
    const type = row.type === null || row.type === undefined ? null : String(row.type);
    const moisCle = row.mois_cle ? String(row.mois_cle) : cleDepuisMoisLabel(mois);
    return {
      id: Number(row.id),
      envoye_le: String(row.created_at ?? ""),
      mois,
      moisCle,
      mode: row.mode === null || row.mode === undefined ? null : String(row.mode),
      lignes: row.nb_lignes === null || row.nb_lignes === undefined ? null : Number(row.nb_lignes),
      destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
      sujet,
      type,
      recap: type === "comptable_recap",
      pieces: row.pieces === null || row.pieces === undefined ? null : String(row.pieces),
      test: Boolean(row.est_test),
    };
  });
}

/**
 * Compte le nombre total d'envois comptables de l'artisan (journal + récaps de régularité),
 * pour afficher « X envois affichés sur Y » à côté du bouton « Charger plus ». RLS garantit
 * qu'un artisan ne compte que ses propres envois.
 */
export async function compterComptableEnvois(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("envois_email")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("type", ["comptable", "comptable_recap"]);
  if (error) throw error;
  return count ?? 0;
}

export interface DernierBilan {
  /** Date et heure du dernier bilan d'archivage envoyé (ISO). */
  envoye_le: string;
  /** Exercice archivé (ex. « 2025 »). */
  annee: string;
  /** Nombre de lignes d'historique reprises dans le bilan, ou null. */
  nbLignes: number | null;
  /** Vrai si le bilan a été expédié par la tâche planifiée (faux pour un test manuel). */
  auto: boolean;
}

export interface BilanArchive {
  id: number;
  /** Date et heure d'envoi du bilan (ISO). */
  envoye_le: string;
  /** Exercice archivé (ex. « 2025 »). */
  annee: string;
  /** Nombre de lignes d'historique reprises dans le bilan, ou null. */
  nbLignes: number | null;
  /** Vrai si le bilan a été expédié par la tâche planifiée (faux pour un test manuel). */
  auto: boolean;
  /** Adresse du comptable destinataire, ou null. */
  destinataire: string | null;
}

/**
 * Récupère la liste des bilans d'archivage déjà envoyés au comptable (un par exercice),
 * du plus récent au plus ancien : date, exercice, taille et destinataire. RLS garantit
 * qu'un artisan ne voit que ses propres envois.
 */
export async function fetchBilansEnvoyes(userId: string, limit = 12): Promise<BilanArchive[]> {
  const { data, error } = await supabase
    .from("envois_email")
    .select("id, created_at, mois_cle, mode, nb_lignes, destinataire")
    .eq("user_id", userId)
    .eq("type", "comptable_bilan")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    envoye_le: String(row.created_at ?? ""),
    annee: String(row.mois_cle ?? ""),
    nbLignes: row.nb_lignes === null || row.nb_lignes === undefined ? null : Number(row.nb_lignes),
    auto: String(row.mode ?? "").toLowerCase() === "automatique",
    destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
  }));
}

/**
 * Récupère le dernier bilan d'archivage envoyé au comptable (date, exercice, taille),
 * pour l'afficher dans la carte d'envoi automatique. RLS garantit qu'un artisan ne
 * voit que ses propres envois.
 */
export async function fetchDernierBilan(userId: string): Promise<DernierBilan | null> {
  const { data, error } = await supabase
    .from("envois_email")
    .select("created_at, mois_cle, mode, nb_lignes")
    .eq("user_id", userId)
    .eq("type", "comptable_bilan")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    envoye_le: String(row.created_at ?? ""),
    annee: String(row.mois_cle ?? ""),
    nbLignes: row.nb_lignes === null || row.nb_lignes === undefined ? null : Number(row.nb_lignes),
    auto: String(row.mode ?? "").toLowerCase() === "automatique",
  };
}

/**
 * Renvoie d'un clic le journal comptable d'un mois donné au comptable, exactement
 * comme l'envoi automatique (PDF + résumé), mais de façon immédiate et ciblée.
 * `overrideTo` permet d'expédier le journal à une adresse ponctuelle (ex. un
 * expert-comptable remplaçant) sans modifier l'email mémorisé dans le profil.
 * `overrideNom` ajoute le libellé choisi (ex. « Cabinet externe ») à la trace du remplacement.
 * L'envoi est marqué « manuel » et n'affecte pas le repère du mois auto.
 */
export async function renvoyerJournalMois(
  userId: string,
  monthKey: string,
  overrideTo?: string,
  overrideNom?: string,
): Promise<JournalRunResult> {
  const body: Record<string, unknown> = { userId, force: true, ignoreTime: true, monthKey, mode: "manuel" };
  if (overrideTo && overrideTo.trim()) body.overrideTo = overrideTo.trim();
  if (overrideNom && overrideNom.trim()) body.overrideNom = overrideNom.trim();
  const { data, error } = await supabase.functions.invoke("envoi-journal-mensuel", {
    body,
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (JournalRunResult & { ok?: boolean; error?: string; details?: Array<{ sent?: boolean; reason?: string }> })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le renvoi du journal a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    month: String(payload.month ?? ""),
    monthLabel: String(payload.monthLabel ?? ""),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/**
 * Envoie au comptable un récapitulatif de la régularité des envois du journal
 * comptable (graphe PNG, export CSV, ou les deux en pièce jointe, avec un
 * commentaire libre). Passe par une Edge Function pour que la clé Resend reste
 * côté serveur.
 */
export async function sendRapportComptableEmail(payload: {
  to: string;
  /** Pièces jointes (graphe PNG et/ou CSV). */
  attachments: Array<{ filename: string; content: string; contentType: string }>;
  periodeLabel: string;
  format: "image" | "csv" | "both" | "pdf";
  /** Nombre de mois couverts par l'export, pour le libellé de l'email. */
  moisCount?: number;
  /** Commentaire libre ajouté dans le corps de l'email. */
  commentaire?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-rapport-comptable", { body: payload });
  if (error) throw new Error(error.message);
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) throw new Error(result?.error || "L'envoi du rapport au comptable a échoué.");
}