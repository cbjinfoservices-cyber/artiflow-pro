import { supabase } from "@/lib/supabase";

/**
 * Historique local des rejeux « test à blanc ».
 *
 * On conserve les N derniers rejeux (date, automatisation rejouée, adresse de test, résultat)
 * pour vérifier d'un coup d'œil ce qui a déjà été validé avant de publier. L'affichage lit le
 * stockage navigateur (rapide, hors ligne). Chaque rejeu est AUSSI consigné côté Backend pour
 * qu'une tâche planifiée puisse en dresser un récapitulatif hebdomadaire par email.
 */

/** Une ligne d'historique de rejeu « test à blanc ». */
export interface RejeuBlancEntree {
  /** Identifiant de l'automatisation rejouée (ex. « recap-hebdo »). */
  id: string;
  /** Nom de l'automatisation au moment du rejeu. */
  nom: string;
  /** Adresse de test vers laquelle la copie a été envoyée. */
  destinataire: string;
  /** Vrai si la copie a bien été expédiée. */
  ok: boolean;
  /** Horodatage ISO du rejeu. */
  date: string;
}

const CLE = "artiflow.envoisAuto.testABlancHistorique";
/** Événement diffusé quand l'historique des rejeux change. */
export const TEST_A_BLANC_HISTO_EVENT = "artiflow-envoisauto-testablanc-histo";
/** Nombre maximal de rejeux conservés (les plus récents). */
export const MAX_REJEUX_BLANCS = 50;

/** Normalise une valeur brute en entrée d'historique valide, ou null si irrécupérable. */
function normaliser(valeur: unknown): RejeuBlancEntree | null {
  if (!valeur || typeof valeur !== "object") return null;
  const o = valeur as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.date !== "string") return null;
  return {
    id: o.id,
    nom: typeof o.nom === "string" ? o.nom : o.id,
    destinataire: typeof o.destinataire === "string" ? o.destinataire : "",
    ok: o.ok === true,
    date: o.date,
  };
}

/** Lit l'historique des rejeux à blanc (robuste à un stockage indisponible ou corrompu). */
export function lireRejeuxBlancs(): RejeuBlancEntree[] {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return [];
    const parsed = JSON.parse(brut) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliser).filter((e): e is RejeuBlancEntree => e !== null);
  } catch {
    return [];
  }
}

/** Écrit l'historique (tronqué aux N plus récents) et prévient l'affichage. */
function ecrire(entrees: RejeuBlancEntree[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(entrees.slice(0, MAX_REJEUX_BLANCS)));
    window.dispatchEvent(new Event(TEST_A_BLANC_HISTO_EVENT));
  } catch {
    /* stockage indisponible : l'historique n'est pas persistant */
  }
}

/**
 * Consigne un rejeu à blanc côté Backend (fire-and-forget). Sert de source à l'envoi
 * planifié du récapitulatif hebdomadaire des échecs. Un souci réseau ne doit jamais
 * perturber le rejeu : l'écriture est volontairement silencieuse.
 */
async function enregistrerRejeuBlancServeur(
  userId: string,
  entree: RejeuBlancEntree,
): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("rejeux_blanc_historique").insert({
      user_id: userId,
      automatisation_id: entree.id,
      automatisation_nom: entree.nom,
      destinataire: entree.destinataire,
      ok: entree.ok,
    });
  } catch {
    /* historique serveur = confort : on ignore une erreur ponctuelle */
  }
}

/**
 * Ajoute un rejeu en tête d'historique local (le plus récent en premier), élague le surplus,
 * et le consigne côté Backend quand l'identifiant du profil est fourni.
 */
export function ajouterRejeuBlanc(entree: RejeuBlancEntree & { userId?: string }): void {
  const { userId, ...ligne } = entree;
  const actuel = lireRejeuxBlancs();
  ecrire([ligne, ...actuel]);
  if (userId) void enregistrerRejeuBlancServeur(userId, ligne);
}

/** Vide l'historique des rejeux à blanc. */
export function viderRejeuxBlancs(): void {
  ecrire([]);
}