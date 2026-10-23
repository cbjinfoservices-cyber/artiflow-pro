import { supabase } from "@/lib/supabase";
import { MAX_HISTORIQUE_MOT_DE_PASSE } from "@/lib/ancienneteMotDePasse";
import { originePublique } from "@/lib/site";

/**
 * URL vers laquelle Resend/Supabase renvoie l'utilisateur après le clic sur le lien de
 * réinitialisation. Elle doit être déclarée dans la configuration d'authentification
 * (URL de retour autorisées) côté Backend.
 */
export function lienReinitialisation(): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  return `${originePublique()}${base}/app/auth/reset-password`;
}

/**
 * Demande l'envoi d'un email de réinitialisation de mot de passe pour l'adresse fournie.
 * L'email contient un lien qui ramène l'utilisateur sur la page de réinitialisation,
 * où il pourra définir un nouveau mot de passe.
 */
export async function demanderReinitialisationMotDePasse(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: lienReinitialisation(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Vérifie le code à 6 chiffres reçu par email dans le cadre d'une réinitialisation de
 * mot de passe. L'email de récupération contient à la fois un lien cliquable et un code :
 * cette fonction couvre le cas où l'utilisateur recopie le code au lieu de cliquer.
 * En cas de succès, le Backend ouvre une session « récupération », ce qui permet ensuite
 * de définir un nouveau mot de passe via `mettreAJourMotDePasse`.
 */
export async function verifierCodeRecuperation(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });
  if (error) throw new Error(error.message);
}

/**
 * Définit un nouveau mot de passe pour l'utilisateur de la session courante (celle
 * ouverte par le lien de réinitialisation). À appeler depuis la page de réinitialisation.
 */
export async function mettreAJourMotDePasse(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/**
 * Vérifie le mot de passe actuel d'un utilisateur déjà connecté, avant de le changer.
 * On ré-authentifie la session courante : une erreur signifie que le mot de passe saisi
 * ne correspond pas.
 */
export async function verifierMotDePasseActuel(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Met de côté l'alerte « renouveler le mot de passe » du tableau de bord jusqu'à une date
 * donnée (AAAA-MM-JJ), afin de la masquer plusieurs jours. `date = null` réactive l'alerte
 * immédiatement.
 */
export async function updateMotDePasseAlerteSnooze(userId: string, date: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_alerte_snooze: date || null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe l'email d'alerte « mot de passe ancien ». Ce réglage est lu par la
 * tâche planifiée : coupé, elle n'envoie plus aucune alerte à l'artisan.
 */
export async function updateMotDePasseAlerteEmailActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_alerte_email_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe le RECAP MENSUEL par email des alertes « mot de passe ancien ».
 * Ce reglage est lu par la tache planifiee du recap mensuel : coupe, elle n'envoie plus
 * aucun recapitulatif a l'artisan.
 */
export async function updateMotDePasseRecapMensuelActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_recap_mensuel_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe le RECAP TRIMESTRIEL par email des alertes « mot de passe ancien »
 * (listing des recaps mensuels adresse au comptable). Ce reglage est lu par la tache
 * planifiee du recap trimestriel : coupe, elle n'envoie plus rien au comptable.
 */
export async function updateMotDePasseRecapTrimestrielActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_recap_trimestriel_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe l'ENVOI ANNUEL du PDF d'historique des recaps « mot de passe ancien »
 * (document adresse au comptable en fin d'annee pour archivage). Ce reglage est lu par la
 * tache planifiee annuelle : coupe, elle n'envoie plus le PDF de fin d'annee.
 */
export async function updateMotDePasseRecapAnnuelActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_recap_annuel_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Active ou coupe l'ENVOI ANNUEL du comparatif de cadence (PDF des récaps mensuels,
 * fenêtre courante vs fenêtre précédente) adressé au comptable en fin d'exercice. Ce réglage
 * est lu par la tâche planifiée dédiée : coupé, elle n'envoie plus ce comparatif.
 */
export async function updateMotDePasseComparatifAnnuelActif(userId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_comparatif_annuel_actif: actif, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Mémorise la fenêtre (6, 12 ou 24 mois) retenue pour le comparatif de cadence des récaps.
 * Elle sert à l'affichage de l'encart ET à l'export PDF, ainsi qu'à l'envoi annuel automatique.
 */
export async function updateMotDePasseComparatifFenetre(userId: string, fenetre: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_comparatif_fenetre: fenetre, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Ajoute la date du changement de mot de passe à l'historique conservé dans le profil
 * (du plus récent au plus ancien, borné à 20 entrées). Sert à garder une trace consultable
 * des derniers changements, quel que soit l'écran utilisé (profil, menu du compte, email).
 */
export async function historiserChangementMotDePasse(userId: string): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("mot_de_passe_changements")
    .eq("id", userId)
    .maybeSingle();
  const existants = Array.isArray((data as { mot_de_passe_changements?: unknown } | null)?.mot_de_passe_changements)
    ? ((data as { mot_de_passe_changements: string[] }).mot_de_passe_changements)
    : [];
  const liste = [new Date().toISOString(), ...existants].slice(0, MAX_HISTORIQUE_MOT_DE_PASSE);
  const { error } = await supabase
    .from("profiles")
    .update({ mot_de_passe_changements: liste, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Détail des critères de robustesse d'un mot de passe. */
export interface CriteresMotDePasse {
  /** Au moins 8 caractères. */
  longueur: boolean;
  /** Contient à la fois une majuscule et une minuscule. */
  casse: boolean;
  /** Contient au moins un chiffre. */
  chiffre: boolean;
  /** Contient au moins un caractère spécial. */
  special: boolean;
}

/** Évaluation de la robustesse d'un mot de passe. */
export interface EvalForceMotDePasse {
  /** Niveau de robustesse, de 0 (vide) à 4 (excellent). */
  score: number;
  /** Libellé lisible (« Faible », « Moyen », « Bon », « Excellent »). */
  label: string;
  /** Critères détaillés, pour l'affichage des puces. */
  criteres: CriteresMotDePasse;
}

/**
 * Valide qu'un mot de passe atteint le niveau de robustesse exigé à l'inscription :
 * au moins 8 caractères, une minuscule, une majuscule, un chiffre et un caractère spécial.
 * Renvoie un message d'erreur clair, ou null si le mot de passe est conforme.
 */
export function validerMotDePasseFort(mdp: string): string | null {
  if (mdp.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-z]/.test(mdp)) return "Ajoutez au moins une lettre minuscule.";
  if (!/[A-Z]/.test(mdp)) return "Ajoutez au moins une lettre majuscule.";
  if (!/\d/.test(mdp)) return "Ajoutez au moins un chiffre.";
  if (!/[^A-Za-z0-9]/.test(mdp)) return "Ajoutez au moins un caractère spécial (ex. ! @ # $ %).";
  return null;
}

/**
 * Évalue la robustesse d'un mot de passe sur une échelle de 0 à 4, en croisant la
 * longueur et la variété des caractères. Sert à alimenter l'indicateur visuel.
 */
export function evaluerForceMotDePasse(mdp: string): EvalForceMotDePasse {
  const criteres: CriteresMotDePasse = {
    longueur: mdp.length >= 8,
    casse: /[a-z]/.test(mdp) && /[A-Z]/.test(mdp),
    chiffre: /\d/.test(mdp),
    special: /[^A-Za-z0-9]/.test(mdp),
  };
  const variete = [criteres.casse, criteres.chiffre, criteres.special].filter(Boolean).length;

  let score = 0;
  if (mdp.length >= 6) score += 1;
  if (mdp.length >= 10) score += 1;
  if (variete >= 2) score += 1;
  if (variete >= 3) score += 1;
  // Un mot de passe trop court reste faible, même s'il mélange des caractères.
  if (mdp.length < 6) score = Math.min(score, 1);
  score = Math.max(0, Math.min(4, score));

  const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"];
  return { score, label: mdp.length === 0 ? "" : labels[score], criteres };
}