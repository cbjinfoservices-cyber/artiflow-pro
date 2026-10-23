import { supabase } from "@/lib/supabase";
import type { AbonnementItem } from "@/lib/abonnementsApi";

/** Validation simple d'une adresse email (suffisante pour l'envoi direct). */
export const EMAIL_BIENVENUE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Objet par défaut de l'email de bienvenue, personnalisé avec le nom de l'entreprise. */
export function buildSujetBienvenue(a: AbonnementItem): string {
  return `Bienvenue chez ArtiFlow-pro, ${a.entreprise} !`;
}

/** Compose le message de bienvenue prérempli, personnalisé avec l'entreprise et son offre. */
export function buildMessageBienvenue(a: AbonnementItem): string {
  const prenom = a.metier ? `l'équipe de ${a.entreprise}` : a.entreprise;
  return [
    `Bonjour ${prenom},`,
    ``,
    `Bienvenue chez ArtiFlow-pro ! Nous sommes ravis de compter ${a.entreprise} parmi nos pros inscrits.`,
    ``,
    `Votre compte est actif avec l'offre ${a.offre}${a.montant_mensuel > 0 ? ` (${a.montant_mensuel.toFixed(2).replace(".", ",")} € / mois)` : ""}.`,
    `Tout est prêt pour créer vos devis, vos factures et suivre vos chantiers en quelques clics.`,
    ``,
    `Si vous avez la moindre question, répondez simplement à cet email : nous vous répondons rapidement.`,
    ``,
    `Bon démarrage,`,
    `L'équipe ArtiFlow-pro`,
  ].join("\n");
}

/**
 * Expédie l'email de bienvenue d'un pro via le Backend (Resend), au nom de l'équipe.
 * `sujet` / `message` permettent de personnaliser l'envoi (utilisés par la fiche) ; sans
 * précision, les textes par défaut sont utilisés (action groupée). Lève une erreur explicite
 * en cas d'email invalide ou d'échec d'envoi.
 */
export async function envoyerBienvenue(
  a: AbonnementItem,
  overrides?: { sujet?: string; message?: string },
): Promise<void> {
  if (!a.email || !EMAIL_BIENVENUE_RE.test(a.email)) {
    throw new Error("Adresse email invalide ou non renseignée pour ce pro.");
  }
  const sujet = overrides?.sujet?.trim() || buildSujetBienvenue(a);
  const message = overrides?.message?.trim() || buildMessageBienvenue(a);

  const { data, error } = await supabase.functions.invoke("send-recontact-artisan", {
    body: {
      to: a.email,
      entreprise: a.entreprise,
      sujet,
      message,
    },
  });

  if (error) {
    let msg = "L'envoi de l'email a échoué. Réessayez.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const parsed = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (parsed?.error) msg = parsed.error;
    }
    throw new Error(msg);
  }
  if (data && (data as { ok?: boolean }).ok === false) {
    throw new Error((data as { error?: string }).error || "L'envoi de l'email a échoué.");
  }
}

/** Vrai si le pro dispose d'une adresse email joignable pour recevoir l'accueil. */
export function emailBienvenueValide(a: AbonnementItem): boolean {
  return !!a.email && EMAIL_BIENVENUE_RE.test(a.email);
}