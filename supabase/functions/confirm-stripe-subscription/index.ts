import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toDateISO(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Date de fin de période couverte par un paiement unique, calculée depuis aujourd'hui
 * (1 mois au choix mensuel, 12 mois au choix annuel). Sert de date d'échéance à l'abonnement :
 * contrairement à un abonnement Stripe, rien ne se renouvelle automatiquement.
 */
function dateFinPeriode(facturation: "mensuel" | "annuel"): string {
  const d = new Date();
  d.setMonth(d.getMonth() + (facturation === "annuel" ? 12 : 1));
  return d.toISOString().slice(0, 10);
}

/** Durée d'essai par défaut (jours) si le réglage global n'est pas disponible. */
const DUREE_ESSAI_JOURS = 14;

/** Date de fin de la période d'essai à partir d'une date de début AAAA-MM-JJ et d'une durée. */
function dateFinEssai(dateDebutISO: string, dureeJours: number = DUREE_ESSAI_JOURS): string {
  const d = new Date(`${dateDebutISO}T00:00:00`);
  d.setDate(d.getDate() + dureeJours);
  return d.toISOString().slice(0, 10);
}

/**
 * Lit la durée de la période d'essai réglée depuis le back-office (table `parametres_app`,
 * ligne unique id = 1). Best-effort : renvoie la valeur par défaut en cas d'échec. Sert
 * uniquement de repli si la session de paiement ne porte pas déjà la durée.
 */
async function lireDureeEssai(admin: { from: (table: string) => any }): Promise<number> {
  try {
    const { data } = await admin.from("parametres_app").select("essai_jours").eq("id", 1).maybeSingle();
    const n = Math.round(Number((data as { essai_jours?: number } | null)?.essai_jours));
    if (!Number.isFinite(n)) return DUREE_ESSAI_JOURS;
    return Math.min(90, Math.max(0, n));
  } catch {
    return DUREE_ESSAI_JOURS;
  }
}

type StripeSession = {
  id?: string;
  status?: string;
  payment_status?: string;
  customer?: string | { id?: string };
  subscription?: string | {
    id?: string;
    current_period_end?: number;
    trial_end?: number | null;
    status?: string;
  };
  amount_total?: number;
  currency?: string;
  metadata?: Record<string, string>;
  error?: { message?: string };
};

/** Extrait l'identifiant client Stripe (parfois renvoyé comme objet développé). */
function customerId(customer: StripeSession["customer"]): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

/** Formate un montant Stripe (en centimes) dans la devise de la session. */
function montantLabel(cents: number | undefined, currency: string | undefined): string {
  const devise = (currency ?? "eur").toUpperCase();
  const valeur = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(valeur);
  } catch {
    return `${valeur.toFixed(2)} ${devise}`;
  }
}

interface EmailParams {
  to: string;
  sujet: string;
  html: string;
}

/**
 * Envoi d'un email via Resend (best-effort).
 * La clé et le domaine d'envoi sont lus à l'exécution dans les Secrets du Backend
 * (RESEND_API_KEY / RESEND_FROM_DOMAIN) : aucun secret n'est codé en dur.
 */
async function envoyerEmail(params: EmailParams): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const domain = Deno.env.get("RESEND_FROM_DOMAIN");
  if (!apiKey || !domain) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to: [params.to],
        subject: params.sujet,
        html: params.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Gabarit HTML commun aux emails de confirmation d'abonnement. */
function gabarit(titre: string, intro: string, corps: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">${titre}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">${intro}</p>
        ${corps}
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Cet email vous est envoyé automatiquement par ArtiFlow-pro. Vos paiements sont traités de façon sécurisée par Stripe.
      </p>
    </div>
  </body>
</html>`;
}

function ligneRecap(label: string, valeur: string): string {
  return `<tr>
    <td style="padding:9px 0;font-size:13px;color:#6a6a64;border-bottom:1px solid #efede8;">${label}</td>
    <td style="padding:9px 0;font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid #efede8;">${valeur}</td>
  </tr>`;
}

interface Recapitulatif {
  entreprise: string;
  offre: string;
  facturation: string;
  modePaiement: string;
  annuel: boolean;
  montantMois: number;
  montantPaye: string;
  dateDebut: string;
  periodeFin: string | null;
  finEssai: string | null;
  /** Durée de la période d'essai (jours) ; 0 si aucun essai. */
  essaiJours: number;
  /** L'abonnement est en période d'essai (aucun débit encore effectué). */
  enEssai: boolean;
  /** Montant du tout premier prélèvement (après l'essai), déjà formaté. */
  premierPrelevement: string | null;
  reference: string;
}

function tableauRecap(r: Recapitulatif): string {
  // Détail du calcul pour la facturation annuelle : on montre explicitement que le
  // montant débité correspond au prix mensuel ramené × 12 mois, pour rassurer l'artisan.
  const ligneCalcul = r.annuel
    ? ligneRecap("Prix mensuel ramené", `${r.montantMois} € / mois`) +
      ligneRecap("Calcul annuel", `${r.montantMois} € × 12 mois = ${r.premierPrelevement ?? r.montantPaye}`)
    : ligneRecap("Montant mensuel", `${r.montantMois} €`);
  return `<table style="width:100%;border-collapse:collapse;margin:4px 0 6px;">
    ${ligneRecap("Entreprise", r.entreprise)}
    ${ligneRecap("Offre", `ArtiFlow-pro ${r.offre}`)}
    ${ligneRecap("Facturation", r.facturation)}
    ${ligneRecap("Type de paiement", r.modePaiement)}
    ${ligneCalcul}
    ${
      r.enEssai
        ? ligneRecap("Réglé aujourd'hui", "0 € — aucun débit pendant l'essai")
        : ligneRecap("Total réglé", r.montantPaye)
    }
    ${ligneRecap("Début de l'abonnement", r.dateDebut)}
    ${
      r.enEssai && r.finEssai
        ? ligneRecap(`Essai de ${r.essaiJours} jours`, `Aucun prélèvement avant le ${r.finEssai}`)
        : ""
    }
    ${
      r.enEssai && r.premierPrelevement
        ? ligneRecap("Premier prélèvement", `${r.premierPrelevement} le ${r.finEssai ?? "—"}`)
        : ""
    }
    ${!r.enEssai && r.finEssai ? ligneRecap(`Fin de la période d'essai (${r.essaiJours} j)`, r.finEssai) : ""}
    ${!r.enEssai && r.periodeFin ? ligneRecap("Prochaine échéance", r.periodeFin) : ""}
    ${ligneRecap("Référence", r.reference)}
  </table>`;
}

/**
 * Vérifie auprès de Stripe qu'une session Checkout a bien été payée, puis
 * active (ou met à jour) l'abonnement de l'artisan connecté et envoie les
 * emails de confirmation (bienvenue + reçu).
 * Appelée au retour de Stripe (success_url), elle sert de garde-fou :
 * aucun abonnement n'est activé sans paiement confirmé.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      return json({ ok: false, error: "Le paiement n'est pas encore configuré." }, 500);
    }

    // 1) Authentification de l'artisan.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const body = await req.json().catch(() => null);
    const sessionId = String(body?.sessionId ?? "").trim();
    if (!sessionId.startsWith("cs_")) return json({ ok: false, error: "Session de paiement invalide." }, 400);

    // 2) On récupère la session côté Stripe.
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const session = (await res.json().catch(() => null)) as StripeSession | null;
    if (!res.ok || !session?.id) {
      return json({ ok: false, error: session?.error?.message ?? "Session de paiement introuvable." }, 502);
    }

    // 3) Autorisation : la session doit appartenir à l'artisan connecté.
    const meta = session.metadata ?? {};
    if (meta.user_id && meta.user_id !== user.id) {
      return json({ ok: false, error: "Cette session ne vous appartient pas." }, 403);
    }

    // 4) Le paiement doit être confirmé.
    const paye = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!paye) {
      return json({ ok: false, error: "Le paiement n'est pas encore confirmé." }, 409);
    }

    const offre = String(meta.offre ?? "").trim() || "Pro";
    const facturation: "mensuel" | "annuel" = meta.facturation === "annuel" ? "annuel" : "mensuel";
    const modePaiement = meta.mode_paiement === "unique" ? "unique" : "recurrent";
    const unique = modePaiement === "unique";
    const montantMois = Number(meta.montant_mensuel) > 0 ? Number(meta.montant_mensuel) : 0;

    const stripeCustomer = customerId(session.customer);
    const stripeSubscription =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

    // Un abonnement Stripe en essai n'est pas encore prélevé : on le reflète dans
    // l'abonnement (statut « Essai » + échéance = fin de l'essai), afin que l'espace
    // artisan affiche le compte à rebours et la date du premier prélèvement.
    let periodeFin: string | null = null;
    let enEssai = false;
    let finEssaiISO: string | null = null;
    if (unique) {
      periodeFin = dateFinPeriode(facturation);
    } else if (stripeSubscription) {
      try {
        const subRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubscription)}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        const sub = (await subRes.json().catch(() => null)) as {
          current_period_end?: number;
          trial_end?: number | null;
          status?: string;
        } | null;
        enEssai = sub?.status === "trialing";
        if (enEssai) {
          finEssaiISO = toDateISO(sub?.trial_end) ?? toDateISO(sub?.current_period_end);
          periodeFin = finEssaiISO;
        } else {
          periodeFin = toDateISO(sub?.current_period_end);
        }
      } catch {
        /* échéance indisponible : on laissera la date vide */
      }
    }

    // 5) Activation de l'abonnement (client service_role, hors RLS).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, email")
      .eq("id", user.id)
      .maybeSingle();
    const profil = profile as { entreprise?: string | null; metier?: string | null; email?: string | null } | null;

    const entreprise = profil?.entreprise || user.email?.split("@")[0] || "Mon entreprise";
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await admin
      .from("abonnements")
      .select("id, offre, montant_mensuel")
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existant = existing as { id: number; offre?: string; montant_mensuel?: number } | null;

    const payload: Record<string, unknown> = {
      artisan_id: user.id,
      entreprise,
      email: user.email ?? profil?.email ?? null,
      metier: profil?.metier ?? null,
      offre,
      statut: enEssai ? "Essai" : "Actif",
      montant_mensuel: montantMois,
      canal_paiement: unique
        ? `Carte (Stripe · paiement unique ${facturation})`
        : `Carte (Stripe · abonnement ${facturation})`,
      date_debut: today,
      date_echeance: periodeFin,
      updated_at: new Date().toISOString(),
    };
    if (stripeCustomer) payload.stripe_customer_id = stripeCustomer;
    if (!unique && stripeSubscription) payload.stripe_subscription_id = stripeSubscription;

    let abonnementId = existant?.id ?? 0;
    if (existant) {
      const { error: updateError } = await admin.from("abonnements").update(payload).eq("id", existant.id);
      if (updateError) return json({ ok: false, error: updateError.message }, 500);
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("abonnements")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) return json({ ok: false, error: insertError.message }, 500);
      abonnementId = Number((inserted as { id?: number } | null)?.id ?? 0);
    }

    // 6) Journalisation du changement (best-effort).
    if (abonnementId && existant?.offre !== offre) {
      await admin.from("abonnement_historique").insert({
        abonnement_id: abonnementId,
        artisan_id: user.id,
        entreprise,
        type: "offre",
        ancienne_valeur: existant?.offre ?? null,
        nouvelle_valeur: offre,
        ancien_montant: existant?.montant_mensuel ?? null,
        nouveau_montant: montantMois,
        motif: existant
          ? `Paiement Stripe${unique ? " unique" : ""} · passage à l'offre ${offre}`
          : `Ouverture du compte (paiement Stripe${unique ? " unique" : ""})`,
      });
    }

    // 7) Emails de confirmation à l'artisan (best-effort, jamais bloquants).
    const destinataire = user.email ?? profil?.email ?? null;
    if (destinataire) {
      const debutLabel = new Date(`${today}T00:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const finLabel = periodeFin
        ? new Date(`${periodeFin}T00:00:00`).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;
      // Durée d'essai : celle portée par la session (nouveaux paiements), sinon le
      // réglage global du back-office. Aucun essai pour un paiement unique.
      const essaiJoursMeta = Math.round(Number(meta.essai_jours));
      const essaiJours = unique
        ? 0
        : Number.isFinite(essaiJoursMeta) && essaiJoursMeta >= 0
          ? essaiJoursMeta
          : await lireDureeEssai(admin);
      const essaiFinISO = !unique
        ? finEssaiISO ?? (essaiJours > 0 ? dateFinEssai(today, essaiJours) : null)
        : null;
      const essaiFinLabel = essaiFinISO
        ? new Date(`${essaiFinISO}T00:00:00`).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;
      const montantPaye = montantLabel(session.amount_total, session.currency);
      // Montant du tout premier prélèvement (après l'essai) : total mensuel ou annuel.
      const premierPrelevement = enEssai
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
            facturation === "annuel" ? montantMois * 12 : montantMois,
          )
        : null;
      const recap: Recapitulatif = {
        entreprise,
        offre,
        facturation: facturation === "annuel" ? "Annuelle (12 mois)" : "Mensuelle",
        modePaiement: unique ? "Paiement unique (non reconductible)" : "Abonnement reconductible",
        annuel: facturation === "annuel",
        montantMois,
        montantPaye,
        dateDebut: debutLabel,
        periodeFin: finLabel,
        finEssai: essaiFinLabel,
        essaiJours,
        enEssai,
        premierPrelevement,
        reference: session.id ?? sessionId,
      };

      const introBienvenue = enEssai
        ? `Votre essai gratuit de <strong>${essaiJours} jours</strong> sur l'offre <strong>ArtiFlow-pro ${offre}</strong> démarre maintenant. Aucun débit n'est effectué pendant cette période.`
        : `Votre paiement est confirmé, votre abonnement <strong>ArtiFlow-pro ${offre}</strong> est actif.`;

      const corpsBienvenue = `
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3c3c38;">
          ${introBienvenue}
          Vous pouvez dès maintenant générer vos devis, programmer vos relances et suivre vos chantiers.
        </p>
        <div style="background:#eef7f2;border:1px solid #cfe8dd;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#0f6b58;">Bien démarrer</p>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#3c3c38;">
            <li>Complétez votre profil artisan (entreprise, SIRET, logo) pour vos documents.</li>
            <li>Créez votre premier client et votre premier devis.</li>
            <li>Activez vos relances pour ne plus laisser filer un impayé.</li>
          </ul>
        </div>`;

      const ligneRassurance = facturation === "annuel"
        ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
            Concrètement : le tarif annuel applique une remise de 20 %, soit un équivalent de
            <strong>${montantMois} € / mois</strong>. Le montant réellement débité correspond donc à
            <strong>${montantMois} € × 12 mois = ${montantPaye}</strong>, réglé en une seule fois pour toute l'année.
          </p>`
        : "";

      const corpsRecu = `
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:6px 16px;">
          ${tableauRecap(recap)}
        </div>
        ${ligneRassurance}
        <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
          ${
            unique
              ? `Ce document vaut reçu de votre paiement. Il s'agit d'un <strong>paiement unique</strong> couvrant la période jusqu'au ${finLabel ?? "—"} : il ne se renouvelle pas automatiquement et aucun prélèvement futur n'est programmé. À l'échéance, vous pourrez prolonger votre accès depuis « Mon abonnement ».`
              : enEssai
                ? `Votre période d'essai de <strong>${essaiJours} jours</strong> démarre aujourd'hui : <strong>aucun prélèvement n'a lieu maintenant</strong>. Votre carte est simplement enregistrée pour le premier prélèvement de <strong>${premierPrelevement ?? montantPaye}</strong>, effectué automatiquement le <strong>${essaiFinLabel ?? "—"}</strong> — sauf si vous résiliez avant, à tout moment, depuis « Mon abonnement ».`
                : `Ce document vaut reçu de votre paiement. Le prélèvement est ${
                    facturation === "annuel" ? "annuel" : "mensuel"
                  } et sans engagement : vous pouvez résilier à tout moment depuis « Mon abonnement » dans votre espace.`
          }
        </p>`;

      await Promise.all([
        envoyerEmail({
          to: destinataire,
          sujet: `Bienvenue chez ArtiFlow-pro — votre offre ${offre} est active`,
          html: gabarit(
            `Bienvenue, ${entreprise} !`,
            "Merci de votre confiance. Votre assistant ArtiFlow-pro est prêt à vous faire gagner du temps.",
            corpsBienvenue,
          ),
        }),
        envoyerEmail({
          to: destinataire,
          sujet: `Votre reçu ArtiFlow-pro — abonnement ${offre}`,
          html: gabarit("Votre reçu d'abonnement", "Voici le récapitulatif de votre règlement.", corpsRecu),
        }),
      ]);
    }

    return json({
      ok: true,
      abonnement: { id: abonnementId, offre, statut: "Actif", montant_mensuel: montantMois, date_echeance: periodeFin },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
