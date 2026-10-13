import { supabase } from "@/lib/supabase";

/** Une ligne d'historique de test lancé depuis la page « Envois automatiques ». */
export interface TestHistoriqueRow {
  /** Identifiant technique de la ligne. */
  id: number;
  /** Identifiant de l'automatisation testée (ex. « recap-hebdo »). */
  automatisation_id: string;
  /** Nom de l'automatisation au moment du test. */
  automatisation_nom: string;
  /** Résultat du test : « succes » ou « echec ». */
  resultat: string;
  /** Message de résultat renvoyé à l'utilisateur, ou null. */
  message: string | null;
  /** Horodatage du lancement du test. */
  created_at: string;
}

/**
 * Enregistre le résultat d'un test dans l'historique. L'écriture est volontairement
 * silencieuse : un souci d'historique ne doit jamais faire échouer le test lui-même.
 */
export async function enregistrerTestEnvoiAuto(params: {
  userId: string;
  automatisationId: string;
  automatisationNom: string;
  resultat: "succes" | "echec";
  message: string | null;
}): Promise<void> {
  if (!params.userId) return;
  try {
    await supabase.from("envois_auto_tests").insert({
      user_id: params.userId,
      automatisation_id: params.automatisationId,
      automatisation_nom: params.automatisationNom,
      resultat: params.resultat,
      message: params.message,
    });
  } catch {
    // Historique = confort : on ignore une erreur d'écriture ponctuelle.
  }
}

const COLONNES_HISTORIQUE = "id, automatisation_id, automatisation_nom, resultat, message, created_at";

/**
 * Période de filtrage de l'historique des tests : soit un nombre de jours glissants,
 * soit une plage personnalisée (bornes ISO de début / fin). Uniformise le filtrage entre
 * l'affichage, l'export CSV et l'export PDF.
 */
export interface PeriodeHistorique {
  /** Nombre de jours glissants (7 / 30 / 90…), ou null/0 pour toute la période. */
  depuisJours?: number | null;
  /** Borne basse personnalisée (ISO), ou null. */
  debutISO?: string | null;
  /** Borne haute personnalisée (ISO), ou null. */
  finISO?: string | null;
}

/** Borne ISO « il y a N jours » pour un filtre par plage de dates. */
function seuilIso(depuisJours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - depuisJours);
  return d.toISOString();
}

/** Applique les filtres communs (automatisation, résultat, période) à une requête. */
function appliquerFiltres<
  T extends {
    eq: (col: string, val: string) => T;
    gte: (col: string, val: string) => T;
    lte: (col: string, val: string) => T;
  },
>(
  q: T,
  automatisationId?: string | null,
  resultat?: string | null,
  periode?: PeriodeHistorique | null,
): T {
  let out = q;
  if (automatisationId) out = out.eq("automatisation_id", automatisationId);
  if (resultat) out = out.eq("resultat", resultat);
  const jours = periode?.depuisJours ?? 0;
  if (jours && jours > 0) out = out.gte("created_at", seuilIso(jours));
  if (periode?.debutISO) out = out.gte("created_at", periode.debutISO);
  if (periode?.finISO) out = out.lte("created_at", periode.finISO);
  return out;
}

/**
 * Charge les derniers tests lancés par l'utilisateur (les plus récents en premier).
 * `automatisationId` restreint éventuellement le résultat à une seule automatisation,
 * `resultat` (« succes » / « echec ») à un seul type de résultat.
 */
export async function chargerHistoriqueTests(
  userId: string,
  limite = 20,
  automatisationId?: string | null,
  resultat?: string | null,
  periode?: PeriodeHistorique | null,
): Promise<TestHistoriqueRow[]> {
  const requete = appliquerFiltres(
    supabase
      .from("envois_auto_tests")
      .select(COLONNES_HISTORIQUE)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limite),
    automatisationId,
    resultat,
    periode,
  );
  const { data, error } = await requete;
  if (error) throw new Error("Impossible de charger l'historique des tests.");
  return (data ?? []) as TestHistoriqueRow[];
}

/**
 * Charge tout l'historique d'un utilisateur (sans limite), pour l'export CSV.
 * `automatisationId` restreint éventuellement le résultat à une seule automatisation,
 * `resultat` (« succes » / « echec ») à un seul type de résultat.
 */
export async function chargerToutHistoriqueTests(
  userId: string,
  automatisationId?: string | null,
  resultat?: string | null,
  periode?: PeriodeHistorique | null,
): Promise<TestHistoriqueRow[]> {
  const requete = appliquerFiltres(
    supabase
      .from("envois_auto_tests")
      .select(COLONNES_HISTORIQUE)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    automatisationId,
    resultat,
    periode,
  );
  const { data, error } = await requete;
  if (error) throw new Error("Impossible de charger l'historique des tests.");
  return (data ?? []) as TestHistoriqueRow[];
}

/** Une automatisation présente dans l'historique des tests (pour le filtre). */
export interface AutomatisationTestee {
  /** Identifiant de l'automatisation (ex. « recap-hebdo »). */
  id: string;
  /** Dernier nom connu de l'automatisation. */
  nom: string;
}

/**
 * Liste les automatisations distinctes présentes dans l'historique de l'utilisateur,
 * triées par ordre alphabétique de nom. Sert à alimenter le filtre par automatisation.
 */
export async function chargerAutomatisationsTestees(userId: string): Promise<AutomatisationTestee[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("envois_auto_tests")
    .select("automatisation_id, automatisation_nom")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les automatisations testées.");
  const map = new Map<string, string>();
  for (const ligne of (data ?? []) as { automatisation_id: string; automatisation_nom: string }[]) {
    if (ligne.automatisation_id && !map.has(ligne.automatisation_id)) {
      map.set(ligne.automatisation_id, ligne.automatisation_nom || ligne.automatisation_id);
    }
  }
  return [...map.entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** Statistiques globales de l'historique des tests d'un utilisateur. */
export interface TestHistoriqueStats {
  /** Nombre total de tests journalisés. */
  total: number;
  /** Nombre de tests réussis. */
  succes: number;
  /** Taux de réussite arrondi, en pourcentage (0 à 100). */
  tauxSucces: number;
  /** Horodatage du dernier test lancé, ou null. */
  dernier: string | null;
}

/**
 * Calcule le nombre de tests, le taux de réussite et la date du dernier test.
 * `automatisationId` et `resultat` restreignent éventuellement le périmètre aux filtres actifs.
 */
export async function chargerStatsTests(
  userId: string,
  automatisationId?: string | null,
  resultat?: string | null,
  periode?: PeriodeHistorique | null,
): Promise<TestHistoriqueStats> {
  if (!userId) return { total: 0, succes: 0, tauxSucces: 0, dernier: null };
  const [totalRes, succesRes, dernierRes] = await Promise.all([
    appliquerFiltres(
      supabase.from("envois_auto_tests").select("id", { count: "exact", head: true }).eq("user_id", userId),
      automatisationId,
      resultat,
      periode,
    ),
    appliquerFiltres(
      supabase
        .from("envois_auto_tests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("resultat", "succes"),
      automatisationId,
      resultat,
      periode,
    ),
    appliquerFiltres(
      supabase
        .from("envois_auto_tests")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      automatisationId,
      resultat,
      periode,
    ).maybeSingle(),
  ]);
  const total = totalRes.count ?? 0;
  const succes = succesRes.count ?? 0;
  return {
    total,
    succes,
    tauxSucces: total > 0 ? Math.round((succes / total) * 100) : 0,
    dernier: (dernierRes.data as { created_at: string } | null)?.created_at ?? null,
  };
}

/** Supprime tout l'historique des tests de l'utilisateur. */
export async function viderHistoriqueTests(userId: string): Promise<void> {
  const { error } = await supabase.from("envois_auto_tests").delete().eq("user_id", userId);
  if (error) throw new Error("L'historique n'a pas pu être vidé.");
}

/** Ne conserve que les `garder` tests les plus récents et supprime les plus anciens. */
export async function tronquerHistoriqueTests(userId: string, garder: number): Promise<void> {
  if (garder <= 0) {
    await viderHistoriqueTests(userId);
    return;
  }
  const { data, error } = await supabase
    .from("envois_auto_tests")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(garder - 1, garder - 1);
  if (error) throw new Error("Le nettoyage de l'historique a échoué.");
  const seuil = (data?.[0] as { id: number } | undefined)?.id;
  if (!seuil) return; // Moins de lignes que le seuil demandé : rien à supprimer.
  const { error: delErr } = await supabase
    .from("envois_auto_tests")
    .delete()
    .eq("user_id", userId)
    .lt("id", seuil);
  if (delErr) throw new Error("Le nettoyage de l'historique a échoué.");
}

/** Entreprise et email du profil, pour l'en-tête des exports PDF. */
export async function chargerEmetteurHistorique(
  userId: string,
): Promise<{ entreprise: string; email: string | null }> {
  if (!userId) return { entreprise: "Mon entreprise", email: null };
  try {
    const { data } = await supabase
      .from("profiles")
      .select("entreprise, metier, email")
      .eq("id", userId)
      .maybeSingle();
    const entreprise = (data?.entreprise as string) || (data?.metier as string) || "Mon entreprise";
    return { entreprise, email: (data?.email as string) ?? null };
  } catch {
    return { entreprise: "Mon entreprise", email: null };
  }
}

/** Date + heure lisibles d'un test (« 12 oct. 2026 à 09:14 »). */
export function formatDateHeure(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}