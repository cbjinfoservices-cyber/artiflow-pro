import { supabase } from "@/lib/supabase";

/** Résultat d'un rattachement par code d'invitation. */
export interface RattachementParCode {
  /** Nom de la fiche rattachée (pour confirmer à l'utilisateur). */
  nom: string;
}

/**
 * Rattache le compte connecté à une fiche intervenant à partir du CODE D'INVITATION reçu
 * par email. La personne ne peut donc choisir que la fiche à laquelle le code correspond :
 * c'est le code qui détermine la fiche, pas un choix libre.
 */
export async function rattacherIntervenantParCode(code: string): Promise<RattachementParCode> {
  const { data, error } = await supabase.functions.invoke("rattachement-intervenant", {
    body: { action: "rattacherCode", code },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; nom?: string; error?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le rattachement a échoué.");
  return { nom: payload.nom ?? "" };
}

/**
 * Indique, pour les intervenants de l'entreprise connectée, quelles fiches disposent
 * réellement d'un compte créé (le compte lié existe). Sert au repère « compte rattaché »
 * de la liste Intervenants. Renvoie l'ensemble des emails de compte confirmés (en minuscules).
 */
export async function fetchComptesRattaches(): Promise<Set<string>> {
  const { data, error } = await supabase.functions.invoke("rattachement-intervenant", {
    body: { action: "etat" },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; rattaches?: string[] } | null;
  if (!payload?.ok) throw new Error("La vérification des comptes a échoué.");
  return new Set((payload.rattaches ?? []).map((e) => e.trim().toLowerCase()));
}