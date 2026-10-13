import { supabase } from "@/lib/supabase";

/**
 * Une ligne d'historique d'un « test à blanc » du tunnel de paiement Stripe.
 *
 * Chaque lancement du bouton « Tester un paiement à blanc » (mode test, carte
 * 4242 4242 4242 4242) est consigné par la fonction Backend `tester-paiement-blanc`
 * dans la table `test_paiement_blanc_historique` : date, auteur, résultat et détail.
 * Le back-office s'en sert pour suivre l'état du tunnel dans le temps.
 */
export interface TestPaiementBlancItem {
  id: number;
  /** Email du gestionnaire qui a lancé le test. */
  auteur_email: string;
  /** Vrai si la session de test a bien pu être ouverte. */
  ok: boolean;
  /** Mode utilisé pour le test (« test »). */
  mode: string;
  /** Identifiant de session Stripe créée (vide en cas d'échec). */
  session_id: string;
  /** Message lisible accompagnant le résultat. */
  message: string;
  /** Horodatage ISO du test. */
  created_at: string;
}

const COLONNES = "id, auteur_email, ok, mode, session_id, message, created_at";

function mapRow(row: Record<string, unknown>): TestPaiementBlancItem {
  return {
    id: Number(row.id) || 0,
    auteur_email: String(row.auteur_email ?? "").trim(),
    ok: row.ok === true,
    mode: String(row.mode ?? "test"),
    session_id: String(row.session_id ?? ""),
    message: String(row.message ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Charge l'historique des tests à blanc (le plus récent en premier).
 * Lecture réservée aux gestionnaires (règle d'accès de la table).
 */
export async function fetchTestsPaiementBlanc(limite = 50): Promise<TestPaiementBlancItem[]> {
  const { data, error } = await supabase
    .from("test_paiement_blanc_historique")
    .select(COLONNES)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}