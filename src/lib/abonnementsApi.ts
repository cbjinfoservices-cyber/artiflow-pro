import { supabase } from "@/lib/supabase";
import { fetchDureeEssai } from "@/lib/parametresEssai";

/** Tarif mensuel de référence de chaque offre (en euros). */
export const OFFRE_PRIX: Record<string, number> = { Essentiel: 29, Pro: 59, Entreprise: 99 };

export const OFFRES = ["Essentiel", "Pro", "Entreprise"] as const;
export const STATUTS_ABO = ["Actif", "Essai", "Impayé", "Résilié"] as const;

/**
 * Seuil au-delà duquel un abonnement est jugé « très volatil » : un compte
 * ayant changé d'offre au moins ce nombre de fois sur les 6 derniers mois.
 * Partagé entre le classement des volatils et le filtre de la liste des abonnements.
 */
export const SEUIL_TRES_VOLATIL = 3;

// Le délai de rappel des comptes volatils à recontacter est désormais réglable depuis
// l'interface : voir `src/lib/recontactSeuil.ts` (lecture + écriture + événement partagés).

/**
 * Vrai s'il s'agit d'un recontact de « volatilité » (recontact manuel ou auto-relance
 * des oubliés). Exclut les rappels de paiement (impayés) et les relances de fin d'essai,
 * qui ne doivent pas compter comme un suivi de volatilité ni afficher le badge de recontact.
 */
export function estRecontactVolatil(r: { origine: string }): boolean {
  return r.origine !== "impaye" && r.origine !== "essai";
}

export interface AbonnementItem {
  id: number;
  entreprise: string;
  email: string | null;
  metier: string | null;
  ville: string | null;
  /** Forme juridique de l'entreprise (auto-entrepreneur, EI, EURL, SARL, SASU/SAS), ou null. */
  statut_juridique: string | null;
  /** Taille de l'entreprise (seul, 2-5, 6-20, plus-20), ou null. */
  taille_entreprise: string | null;
  offre: string;
  statut: string;
  montant_mensuel: number;
  canal_paiement: string | null;
  iban: string | null;
  mandat_sepa: string | null;
  date_debut: string | null;
  date_echeance: string | null;
  /** Date d'envoi de l'email de bienvenue automatique, ou null s'il n'est pas encore parti. */
  bienvenue_envoyee_le: string | null;
  created_at: string;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Charge tous les abonnements des artisans inscrits (back-office, lecture seule côté données sensibles). */
export async function fetchAbonnements(): Promise<AbonnementItem[]> {
  const { data, error } = await supabase.from("abonnements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: toNum(row.id),
    entreprise: toStr(row.entreprise) ?? "—",
    email: toStr(row.email),
    metier: toStr(row.metier),
    ville: toStr(row.ville),
    statut_juridique: toStr(row.statut_juridique),
    taille_entreprise: toStr(row.taille_entreprise),
    offre: toStr(row.offre) ?? "Pro",
    statut: toStr(row.statut) ?? "Actif",
    montant_mensuel: toNum(row.montant_mensuel),
    canal_paiement: toStr(row.canal_paiement),
    iban: toStr(row.iban),
    mandat_sepa: toStr(row.mandat_sepa),
    date_debut: toStr(row.date_debut),
    date_echeance: toStr(row.date_echeance),
    bienvenue_envoyee_le: toStr(row.bienvenue_envoyee_le),
    created_at: toStr(row.created_at) ?? new Date().toISOString(),
  }));
}

/**
 * Répercute la forme juridique et la taille de l'entreprise d'un artisan sur ses abonnements.
 * Le back-office lit les pros inscrits depuis la table `abonnements` (les profils étant privés),
 * on y recopie donc ces deux informations d'entreprise pour pouvoir les filtrer dans l'interface.
 * Best-effort : un souci d'écriture ne bloque jamais l'enregistrement du profil côté artisan.
 */
export async function syncEntrepriseAbonnement(
  artisanId: string,
  statutJuridique: string | null,
  tailleEntreprise: string | null,
): Promise<void> {
  try {
    await supabase
      .from("abonnements")
      .update({
        statut_juridique: statutJuridique,
        taille_entreprise: tailleEntreprise,
        updated_at: new Date().toISOString(),
      })
      .eq("artisan_id", artisanId);
  } catch {
    /* best-effort : ne bloque pas la mise à jour du profil */
  }
}

/**
 * Essais dont l'échéance tombe à la date donnée (comparaison sur le jour calendaire).
 * Base commune des compteurs partagés du back-office et de la page Abonnements.
 */
function essaisFinDate(abos: AbonnementItem[], date: Date): AbonnementItem[] {
  const iso = date.toISOString().slice(0, 10);
  return abos.filter(
    (a) => a.statut === "Essai" && !!a.date_echeance && a.date_echeance.slice(0, 10) === iso,
  );
}

/**
 * Essais dont l'échéance tombe aujourd'hui (date du jour incluse) : les conversions
 * imminentes, dont le tout premier prélèvement a lieu demain. Sert au compteur partagé
 * du back-office et de la page Abonnements.
 */
export function essaisFinAujourdhui(abos: AbonnementItem[]): AbonnementItem[] {
  return essaisFinDate(abos, new Date());
}

/**
 * Essais dont l'échéance tombe demain : les conversions à anticiper la veille, pour
 * préparer les relances avant que le tout premier prélèvement ne devienne imminent.
 * Sert au compteur partagé du back-office et de la page Abonnements.
 */
export function essaisFinDemain(abos: AbonnementItem[]): AbonnementItem[] {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  return essaisFinDate(abos, demain);
}

export interface AbonnementPayload {
  entreprise: string;
  email: string;
  metier: string;
  ville: string;
  offre: string;
  statut: string;
  montant_mensuel: number;
  canal_paiement: string;
  iban: string;
  mandat_sepa: string;
  date_debut: string | null;
  date_echeance: string | null;
}

/* --- Historique des changements d'offre et de statut ---------------------- */

export interface AbonnementHistoriqueItem {
  id: number;
  abonnement_id: number;
  type: string;
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  ancien_montant: number | null;
  nouveau_montant: number | null;
  motif: string | null;
  created_at: string;
}

interface HistoriqueInput {
  abonnement_id: number;
  artisan_id: string | null;
  entreprise: string | null;
  type: string;
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  ancien_montant: number | null;
  nouveau_montant: number | null;
  motif: string | null;
}

/**
 * Journalise un changement d'abonnement. Best-effort : si l'écriture du journal
 * échoue, l'opération principale (changement d'offre ou de statut) n'est pas bloquée.
 */
async function recordHistorique(entry: HistoriqueInput): Promise<void> {
  const { error } = await supabase.from("abonnement_historique").insert(entry);
  if (error) {
    // Best-effort : on n'interrompt pas le changement principal pour un journal manquant.
  }
}

const COLONNES_HISTORIQUE =
  "id, abonnement_id, type, ancienne_valeur, nouvelle_valeur, ancien_montant, nouveau_montant, motif, created_at";

function mapHistorique(row: Record<string, unknown>): AbonnementHistoriqueItem {
  return {
    id: toNum(row.id),
    abonnement_id: toNum(row.abonnement_id),
    type: toStr(row.type) ?? "offre",
    ancienne_valeur: toStr(row.ancienne_valeur),
    nouvelle_valeur: toStr(row.nouvelle_valeur),
    ancien_montant: toNumOrNull(row.ancien_montant),
    nouveau_montant: toNumOrNull(row.nouveau_montant),
    motif: toStr(row.motif),
    created_at: toStr(row.created_at) ?? new Date().toISOString(),
  };
}

/** Charge l'historique (le plus récent en premier) d'un abonnement donné. */
export async function fetchAbonnementHistorique(abonnementId: number): Promise<AbonnementHistoriqueItem[]> {
  const { data, error } = await supabase
    .from("abonnement_historique")
    .select(COLONNES_HISTORIQUE)
    .eq("abonnement_id", abonnementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapHistorique);
}

export interface AbonnementHistoriqueResume {
  abonnement_id: number;
  offres: number;
  statuts: number;
  total: number;
  /** Passages d'une offre à une autre (hors activation) sur les 6 derniers mois. */
  offres6mois: number;
  /** Date du dernier passage réel d'une offre à une autre (hors activation de compte). */
  dernierChangement: string | null;
  dernier: string | null;
  recentes: AbonnementHistoriqueItem[];
}

/**
 * Résumé de l'historique de chaque abonnement, indexé par `abonnement_id`.
 * Sert au compteur de changements d'offre et au mini-historique au survol du back-office.
 * `offres` ne compte que les vrais passages d'une offre à une autre (hors activation de compte),
 * et `offres6mois` restreint ce décompte aux 6 derniers mois (détection des comptes très volatils).
 */
export async function fetchResumesHistorique(
  limiteRecentes = 4,
): Promise<Record<number, AbonnementHistoriqueResume>> {
  const { data, error } = await supabase
    .from("abonnement_historique")
    .select(COLONNES_HISTORIQUE)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const seuil6mois = new Date();
  seuil6mois.setMonth(seuil6mois.getMonth() - 6);

  const map: Record<number, AbonnementHistoriqueResume> = {};
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const item = mapHistorique(row);
    let entry = map[item.abonnement_id];
    if (!entry) {
      entry = {
        abonnement_id: item.abonnement_id,
        offres: 0,
        statuts: 0,
        total: 0,
        offres6mois: 0,
        dernierChangement: null,
        dernier: null,
        recentes: [],
      };
      map[item.abonnement_id] = entry;
    }
    entry.total += 1;
    if (item.type === "statut") {
      entry.statuts += 1;
    } else if (item.ancienne_valeur && item.nouvelle_valeur) {
      entry.offres += 1;
      if (new Date(item.created_at) >= seuil6mois) entry.offres6mois += 1;
      // La liste étant triée du plus récent au plus ancien, la première occurrence
      // conservée correspond au dernier changement d'offre réel du compte.
      if (!entry.dernierChangement) entry.dernierChangement = item.created_at;
    }
    if (item.type === "offre" && entry.recentes.length < limiteRecentes) {
      entry.recentes.push(item);
    }
    if (!entry.dernier) entry.dernier = item.created_at;
  });

  return map;
}

export interface ChangementOffreMois {
  key: string;
  label: string;
  count: number;
}

/* --- Journal des recontacts envoyés -------------------------------------- */

export interface RecontactArtisanItem {
  id: number;
  abonnement_id: number | null;
  entreprise: string | null;
  email: string | null;
  sujet: string | null;
  statut: string;
  erreur: string | null;
  /** Origine de l'envoi : « manuel » (depuis l'interface) ou « auto » (auto-relance des oubliés). */
  origine: string;
  created_at: string;
}

const COLONNES_RECONTACT =
  "id, abonnement_id, entreprise, email, sujet, statut, erreur, origine, created_at";

function mapRecontact(row: Record<string, unknown>): RecontactArtisanItem {
  return {
    id: toNum(row.id),
    abonnement_id: toNumOrNull(row.abonnement_id),
    entreprise: toStr(row.entreprise),
    email: toStr(row.email),
    sujet: toStr(row.sujet),
    statut: toStr(row.statut) ?? "envoye",
    erreur: toStr(row.erreur),
    origine: toStr(row.origine) ?? "manuel",
    created_at: toStr(row.created_at) ?? new Date().toISOString(),
  };
}

/** Charge le journal des recontacts envoyés pour un abonnement (le plus récent en premier). */
export async function fetchRecontactsArtisan(abonnementId: number): Promise<RecontactArtisanItem[]> {
  const { data, error } = await supabase
    .from("recontacts_artisans")
    .select(COLONNES_RECONTACT)
    .eq("abonnement_id", abonnementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRecontact);
}

/** Charge tout le journal des recontacts (le plus récent en premier), tous abonnements confondus. */
export async function fetchTousRecontacts(): Promise<RecontactArtisanItem[]> {
  const { data, error } = await supabase
    .from("recontacts_artisans")
    .select(COLONNES_RECONTACT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRecontact);
}

/**
 * Indexe le dernier recontact de chaque abonnement à partir d'une liste déjà triée
 * du plus récent au plus ancien (la première occurrence gagne). Sert au badge
 * « recontacté le … » de chaque ligne et au filtre « déjà recontacté / à recontacter ».
 */
export function indexerDerniersRecontacts(
  items: RecontactArtisanItem[],
): Record<number, RecontactArtisanItem> {
  const map: Record<number, RecontactArtisanItem> = {};
  items.forEach((it) => {
    const id = it.abonnement_id;
    if (id === null || map[id]) return;
    // Seuls les vrais recontacts de volatilité comptent : ni les rappels de paiement
    // (impayés), ni les relances de fin d'essai ne doivent afficher le badge « recontacté le … ».
    if (!estRecontactVolatil(it)) return;
    map[id] = it;
  });
  return map;
}

export interface RecontactPayload {
  abonnement_id: number | null;
  artisan_id: string | null;
  entreprise: string;
  email: string | null;
  sujet: string;
  statut: string;
  erreur: string | null;
  /** Origine de l'envoi : « manuel », « auto » (auto-relance des oubliés) ou « impaye » (rappel de paiement). */
  origine?: string;
}

/**
 * Journalise un recontact (envoyé ou en échec) sur un compte volatil.
 * Best-effort : un souci d'écriture du journal ne bloque pas l'action principale.
 */
export async function recordRecontact(payload: RecontactPayload): Promise<void> {
  const { error } = await supabase.from("recontacts_artisans").insert(payload);
  if (error) {
    // Best-effort : on n'interrompt pas l'envoi pour un journal manquant.
  }
}

/**
 * Nombre de changements d'offre par mois sur les `mois` derniers mois (mois courant inclus),
 * tous abonnements confondus. Alimente le résumé du back-office Abonnements.
 */
export async function fetchChangementsOffreParMois(mois = 6): Promise<ChangementOffreMois[]> {
  const now = new Date();
  const buckets: ChangementOffreMois[] = [];
  for (let i = mois - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      count: 0,
    });
  }

  const depuis = new Date(now.getFullYear(), now.getMonth() - (mois - 1), 1);
  const { data, error } = await supabase
    .from("abonnement_historique")
    .select("created_at, ancienne_valeur")
    .eq("type", "offre")
    .not("ancienne_valeur", "is", null)
    .gte("created_at", depuis.toISOString());
  if (error) throw error;

  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const raw = toStr(row.created_at);
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.count += 1;
  });

  return buckets;
}

export interface MrrHistoriquePoint {
  key: string;
  label: string;
  mrr: number;
  /** Variation du MRR par rapport au mois précédent (en euros). */
  delta: number;
  /** Nombre d'abonnements contribuant au MRR estimé ce mois-ci. */
  abonnes: number;
}

/**
 * Reconstitue le MRR estimé mois par mois à partir de l'historique des changements d'offre.
 * Pour chaque abonnement on rejoue sa suite de passages d'offre : à la fin de chaque mois,
 * le montant retenu est celui de la dernière offre en vigueur à cette date. Cela fait donc
 * apparaître dans le temps les remontées (montées en gamme) et les descentes.
 *
 * C'est une estimation indicative : elle ne s'appuie que sur les changements d'offre
 * enregistrés et ignore volontairement les statuts (impayés, résiliations).
 */
export async function fetchEvolutionMrrHistorique(mois = 12): Promise<MrrHistoriquePoint[]> {
  const { data, error } = await supabase
    .from("abonnement_historique")
    .select("abonnement_id, nouvelle_valeur, nouveau_montant, created_at")
    .eq("type", "offre")
    .not("nouvelle_valeur", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Chronologie par abonnement : suite d'événements { instant, montant } triés par date.
  const chronologies: Record<number, Array<{ t: number; montant: number }>> = {};
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const id = toNum(row.abonnement_id);
    const raw = toStr(row.created_at);
    const offre = toStr(row.nouvelle_valeur);
    if (!raw || !offre) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const brut = toNumOrNull(row.nouveau_montant);
    const montant = brut && brut > 0 ? brut : OFFRE_PRIX[offre] ?? 0;
    if (!chronologies[id]) chronologies[id] = [];
    chronologies[id].push({ t: d.getTime(), montant });
  });

  const now = new Date();
  const buckets: Array<{ key: string; label: string; fin: number }> = [];
  for (let i = mois - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      fin,
    });
  }

  let precedent: number | null = null;
  return buckets.map((b) => {
    let mrr = 0;
    let abonnes = 0;
    Object.values(chronologies).forEach((events) => {
      let montantCourant = 0;
      for (let i = 0; i < events.length; i += 1) {
        if (events[i].t <= b.fin) montantCourant = events[i].montant;
        else break;
      }
      if (montantCourant > 0) {
        mrr += montantCourant;
        abonnes += 1;
      }
    });
    const delta = precedent === null ? 0 : mrr - precedent;
    precedent = mrr;
    return { key: b.key, label: b.label, mrr, delta, abonnes };
  });
}

export async function createAbonnement(payload: AbonnementPayload): Promise<void> {
  const { data, error } = await supabase
    .from("abonnements")
    .insert({
      entreprise: payload.entreprise,
      email: payload.email || null,
      metier: payload.metier || null,
      ville: payload.ville || null,
      offre: payload.offre,
      statut: payload.statut,
      montant_mensuel: payload.montant_mensuel,
      canal_paiement: payload.canal_paiement || null,
      iban: payload.iban || null,
      mandat_sepa: payload.mandat_sepa || null,
      date_debut: payload.date_debut,
      date_echeance: payload.date_echeance,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data ? toNum((data as Record<string, unknown>).id) : 0;
  if (id) {
    await recordHistorique({
      abonnement_id: id,
      artisan_id: null,
      entreprise: payload.entreprise,
      type: "offre",
      ancienne_valeur: null,
      nouvelle_valeur: payload.offre,
      ancien_montant: null,
      nouveau_montant: payload.montant_mensuel,
      motif: "Ouverture du compte",
    });
  }
}

/**
 * Crée l'abonnement d'essai initial d'un artisan qui vient de s'inscrire, afin que son
 * compte apparaisse aussitôt dans le back-office « Pros inscrits » (cette page ne lit que la
 * table des abonnements, jamais les profils). Idempotent : n'agit que si aucune ligne n'existe
 * pour ce compte. Best-effort : une erreur n'empêche jamais l'accès à l'espace artisan.
 */
export async function creerAbonnementEssaiInitial(params: {
  artisanId: string;
  entreprise: string | null;
  email: string | null;
  metier: string | null;
}): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("abonnements")
      .select("id")
      .eq("artisan_id", params.artisanId)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const duree = await fetchDureeEssai();
    const debut = new Date();
    const echeance = new Date(debut);
    echeance.setDate(echeance.getDate() + duree);

    await supabase.from("abonnements").insert({
      artisan_id: params.artisanId,
      entreprise: params.entreprise?.trim() || "Entreprise non renseignée",
      email: params.email,
      metier: params.metier,
      offre: "Essentiel",
      statut: "Essai",
      montant_mensuel: 0,
      date_debut: debut.toISOString().slice(0, 10),
      date_echeance: echeance.toISOString().slice(0, 10),
    });
  } catch {
    /* best-effort : ne bloque pas l'accès à l'espace artisan */
  }
}

/** Change le statut d'un abonnement (Actif / Essai / Impayé / Résilié). */
export async function updateAbonnementStatut(id: number, statut: string): Promise<void> {
  const { data: current } = await supabase
    .from("abonnements")
    .select("statut, artisan_id, entreprise")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("abonnements")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const row = (current as Record<string, unknown> | null) ?? null;
  if (row && toStr(row.statut) !== statut) {
    await recordHistorique({
      abonnement_id: id,
      artisan_id: toStr(row.artisan_id),
      entreprise: toStr(row.entreprise),
      type: "statut",
      ancienne_valeur: toStr(row.statut),
      nouvelle_valeur: statut,
      ancien_montant: null,
      nouveau_montant: null,
      motif: "Mise à jour du statut",
    });
  }
}

/** Change l'offre d'un abonnement et réaligne le montant mensuel sur le tarif de l'offre. */
export async function updateAbonnementOffre(id: number, offre: string): Promise<void> {
  const { data: current } = await supabase
    .from("abonnements")
    .select("offre, montant_mensuel, artisan_id, entreprise")
    .eq("id", id)
    .maybeSingle();

  const nouveauMontant = OFFRE_PRIX[offre] ?? 0;
  const { error } = await supabase
    .from("abonnements")
    .update({ offre, montant_mensuel: nouveauMontant, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const row = (current as Record<string, unknown> | null) ?? null;
  if (row && toStr(row.offre) !== offre) {
    await recordHistorique({
      abonnement_id: id,
      artisan_id: toStr(row.artisan_id),
      entreprise: toStr(row.entreprise),
      type: "offre",
      ancienne_valeur: toStr(row.offre),
      nouvelle_valeur: offre,
      ancien_montant: toNumOrNull(row.montant_mensuel),
      nouveau_montant: nouveauMontant,
      motif: `Passage à l'offre ${offre}`,
    });
  }
}

/**
 * Marque l'email de bienvenue comme envoyé (date du jour) pour un abonnement.
 * Utilisé après un envoi MANUEL (renvoi de secours depuis la fiche d'un pro) : on
 * mémorise la date pour refléter le statut dans la liste et la fiche, et pour que la
 * tâche planifiée ne renvoie pas une seconde fois l'accueil automatique.
 */
export async function marquerBienvenueEnvoyee(id: number): Promise<void> {
  const { error } = await supabase
    .from("abonnements")
    .update({ bienvenue_envoyee_le: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}