import { supabase } from "@/lib/supabase";
import { recordRecontact } from "@/lib/abonnementsApi";
import type { PaiementEchecItem } from "@/lib/paiementsEchecsApi";
import { originePublique } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Construit l'URL de la page Tarifs en tenant compte du basePath de déploiement. */
function urlTarifs(): string {
  const basePath = (__BASE_PATH__ || "").split("/").filter(Boolean).join("/");
  const prefix = basePath ? `/${basePath}` : "";
  return `${originePublique()}${prefix}/tarifs`;
}

/** Objet par défaut de l'email de relance après un échec de paiement. */
export function sujetRelancePaiement(): string {
  return "Votre paiement ArtiFlow-pro n'a pas abouti — on réessaie ?";
}

/**
 * Message rassurant proposé par défaut pour relancer un artisan dont le paiement
 * n'a pas abouti : on rappelle qu'aucun montant n'a été débité et on l'invite à
 * reprendre la souscription en un clic depuis la page Tarifs.
 */
export function messageRelancePaiement(it: PaiementEchecItem): string {
  const offre = it.offre?.trim() || "votre offre";
  const facturation = it.facturation ? ` (${it.facturation})` : "";
  return [
    "Bonjour,",
    "",
    `Nous avons constaté que la mise en place de votre abonnement ${offre}${facturation} n'a pas pu aboutir de notre côté.`,
    "Bonne nouvelle : aucun montant n'a été débité de votre compte.",
    "",
    "Souhaitez-vous que nous réessayions ensemble ? Vous pouvez relancer le paiement en un clic depuis la page Tarifs :",
    urlTarifs(),
    "",
    "Si un moyen de paiement vous pose problème, répondez simplement à cet email et nous trouverons une solution.",
    "",
    "Bien cordialement,",
    "L'équipe ArtiFlow-pro",
  ].join("\n");
}

/** Adresse de relance exploitable pour un échec donné (null si absente ou invalide). */
export function emailRelanceValide(it: PaiementEchecItem): string | null {
  const email = (it.artisan_email ?? "").trim();
  return EMAIL_RE.test(email) ? email : null;
}

export interface RelancePaiementResultat {
  ok: boolean;
  erreur?: string;
}

/**
 * Relance un artisan en un clic après un échec de paiement : envoie l'email
 * « votre paiement n'a pas abouti, on réessaie ? » via le Backend (Resend),
 * puis journalise la tentative dans le journal des recontacts (origine « impaye »
 * pour ne pas la confondre avec un recontact de volatilité). Best-effort côté journal.
 */
export async function relancerArtisanApresEchec(it: PaiementEchecItem): Promise<RelancePaiementResultat> {
  const email = emailRelanceValide(it);
  if (!email) return { ok: false, erreur: "Aucune adresse email valide pour cet artisan." };

  const entreprise = it.entreprise?.trim() || email;
  const sujet = sujetRelancePaiement();
  const message = messageRelancePaiement(it);

  const journaliser = (statut: "envoye" | "echec", erreur: string | null) =>
    recordRecontact({
      abonnement_id: null,
      artisan_id: it.artisan_id,
      entreprise,
      email,
      sujet,
      statut,
      erreur,
      origine: "impaye",
    });

  try {
    const { data, error } = await supabase.functions.invoke("send-recontact-artisan", {
      body: { to: email, entreprise, sujet, message },
    });

    if (error) {
      let msg = "L'envoi de l'email a échoué. Réessayez dans un instant.";
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = (await ctx.json().catch(() => null)) as { error?: string } | null;
        if (parsed?.error) msg = parsed.error;
      }
      await journaliser("echec", msg);
      return { ok: false, erreur: msg };
    }

    if (data && (data as { ok?: boolean; error?: string }).ok === false) {
      const msg = (data as { error?: string }).error || "L'envoi de l'email a échoué.";
      await journaliser("echec", msg);
      return { ok: false, erreur: msg };
    }

    await journaliser("envoye", null);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "L'envoi de l'email a échoué.";
    await journaliser("echec", msg);
    return { ok: false, erreur: msg };
  }
}