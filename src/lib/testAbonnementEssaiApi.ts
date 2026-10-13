import { supabase } from "@/lib/supabase";

/**
 * Une ligne d'historique d'un « vrai test d'essai reconductible ».
 *
 * Chaque lancement du bouton « Lancer le test d'essai » (back-office) exécute un test
 * réel en MODE TEST Stripe : création d'un abonnement avec la durée d'essai réglée, puis
 * vérification qu'aucun débit n'est enregistré avant la fin. Le résultat (statut Stripe,
 * montant réellement encaissé, message) est consigné ici pour traçabilité.
 */
export interface TestAbonnementEssaiItem {
  id: number;
  /** Email du gestionnaire qui a lancé le test. */
  auteur_email: string;
  /** Vrai si le comportement attendu (essai sans débit) a bien été vérifié. */
  ok: boolean;
  /** Durée d'essai appliquée au test (jours), telle que réglée dans le back-office. */
  essai_jours: number;
  /** Statut Stripe de l'abonnement de test (« trialing », « active »…). */
  statut: string;
  /** Identifiant de l'abonnement de test créé (supprimé après vérification). */
  subscription_id: string;
  /** Montant réellement encaissé pendant le test (0 € attendu). */
  montant_facture: number;
  /** Message lisible accompagnant le résultat. */
  message: string;
  /** Horodatage ISO du test. */
  created_at: string;
}

/** Résultat renvoyé par la fonction Backend après un test d'essai. */
export interface TestAbonnementEssaiResultat {
  /** Vrai si le comportement attendu a été vérifié (essai sans débit). */
  verifie: boolean;
  /** Durée d'essai appliquée. */
  essaiJours: number;
  /** Statut Stripe de l'abonnement de test. */
  statut: string;
  /** Montant encaissé pendant le test (0 € attendu). */
  montantFacture: number;
  /** Date de fin d'essai lisible, quand disponible. */
  trialEnd: string | null;
  /** Message lisible du résultat. */
  message: string;
}

const COLONNES =
  "id, auteur_email, ok, essai_jours, statut, subscription_id, montant_facture, message, created_at";

function mapRow(row: Record<string, unknown>): TestAbonnementEssaiItem {
  return {
    id: Number(row.id) || 0,
    auteur_email: String(row.auteur_email ?? "").trim(),
    ok: row.ok === true,
    essai_jours: Number(row.essai_jours) || 0,
    statut: String(row.statut ?? ""),
    subscription_id: String(row.subscription_id ?? ""),
    montant_facture: Number(row.montant_facture) || 0,
    message: String(row.message ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

/** Charge l'historique des tests d'essai (le plus récent en premier, gestionnaires). */
export async function fetchTestsAbonnementEssai(limite = 40): Promise<TestAbonnementEssaiItem[]> {
  const { data, error } = await supabase
    .from("test_abonnement_essai_historique")
    .select(COLONNES)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

/**
 * Lance un vrai test d'essai reconductible côté Stripe (mode test) et renvoie le verdict :
 * l'abonnement démarre-t-il bien en période d'essai sans aucun débit ?
 */
export async function lancerTestAbonnementEssai(): Promise<TestAbonnementEssaiResultat> {
  const { data, error } = await supabase.functions.invoke("tester-abonnement-essai-blanc", {
    body: {},
  });
  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    let message = "Impossible de lancer le test d'essai pour l'instant. Réessayez dans un instant.";
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as { error?: string } | null;
        if (body?.error) message = body.error;
      } catch {
        /* corps non JSON : on garde le message de repli */
      }
    }
    throw new Error(message);
  }
  const result = data as ({ ok?: boolean } & Partial<TestAbonnementEssaiResultat> & { error?: string }) | null;
  if (!result?.ok) {
    throw new Error(result?.error || "Le test d'essai n'a pas pu être lancé.");
  }
  return {
    verifie: result.verifie === true,
    essaiJours: Number(result.essaiJours) || 0,
    statut: String(result.statut ?? ""),
    montantFacture: Number(result.montantFacture) || 0,
    trialEnd: result.trialEnd ?? null,
    message: String(result.message ?? ""),
  };
}