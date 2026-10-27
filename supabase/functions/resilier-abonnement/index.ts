import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

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

function euros(cents: number, devise = "eur"): string {
  const valeur = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: (devise || "eur").toUpperCase(),
    }).format(valeur);
  } catch {
    return `${valeur.toFixed(2)} €`;
  }
}

interface AbonnementRow {
  id: number;
  statut: string | null;
  offre: string | null;
  entreprise: string | null;
  montant_mensuel: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  date_debut: string | null;
}

interface Remboursement {
  montant: number;
  devise: string;
  effectue: boolean;
}

/**
 * Envoi d'un email de confirmation via Resend (best-effort, jamais bloquant).
 * Les secrets sont lus à l'exécution : aucun secret codé en dur.
 */
async function envoyerEmail(destinataire: string, sujet: string, html: string): Promise<boolean> {
  const apiKey = cleEnvoiEmail();
  const domain = domaineEnvoiEmail();
  if (!apiKey || !domain) return false;
  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to: [destinataire],
        subject: sujet,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function gabaritEmail(titre: string, intro: string, corps: string): string {
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
        Cet email vous est envoyé automatiquement par ArtiFlow-pro.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Résilie immédiatement l'abonnement de l'artisan connecté.
 *
 * Principe :
 *  1. On vérifie le porteur du JWT (client anon uniquement pour l'authentification).
 *  2. Si l'abonnement est rattaché à Stripe, on annule l'abonnement immédiatement,
 *     puis on rembourse au prorata la période non consommée du dernier règlement.
 *  3. On met à jour la fiche `abonnements` (statut « Résilié ») sur le client service_role.
 *  4. On journalise l'opération dans `abonnement_historique` et on prévient l'artisan par email.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "La résiliation n'est pas encore configurée." }, 500);
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

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: aboData, error: aboError } = await admin
      .from("abonnements")
      .select(
        "id, statut, offre, entreprise, montant_mensuel, stripe_customer_id, stripe_subscription_id, date_debut",
      )
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aboError) return json({ ok: false, error: "Impossible de lire votre abonnement." }, 500);

    const abo = aboData as AbonnementRow | null;
    if (!abo) {
      return json({ ok: false, error: "Aucun abonnement n'est rattaché à votre compte." }, 404);
    }
    if ((abo.statut ?? "").toLowerCase() === "résilié") {
      return json({
        ok: true,
        statut: "Résilié",
        remboursement: null,
        message: "Votre abonnement est déjà résilié.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const entreprise = abo.entreprise || user.email?.split("@")[0] || "votre entreprise";
    let remboursement: Remboursement | null = null;
    let message = "";

    // 2) Résiliation côté Stripe (immédiate) + remboursement au prorata.
    if (stripeKey && abo.stripe_subscription_id) {
      const subId = abo.stripe_subscription_id;

      // On lit d'abord l'abonnement pour connaître la période en cours.
      let statutStripe = "";
      try {
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const sub = (await subRes.json().catch(() => null)) as { status?: string } | null;
        if (subRes.ok && sub) statutStripe = sub.status ?? "";
      } catch {
        /* détails indisponibles : on tente malgré tout l'annulation */
      }

      // Annulation immédiate (pas de report à la prochaine échéance).
      const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const cancelBody = (await cancelRes.json().catch(() => null)) as
        | { id?: string; status?: string; error?: { message?: string } }
        | null;
      if (!cancelRes.ok) {
        return json(
          {
            ok: false,
            error:
              cancelBody?.error?.message ??
              "L'annulation de l'abonnement n'a pas pu être effectuée. Contactez le support.",
          },
          502,
        );
      }

      // Remboursement au prorata de la période non consommée.
      if (statutStripe === "trialing") {
        message =
          "Votre abonnement est résilié. Vous étiez en période d'essai : aucun prélèvement n'a été effectué, il n'y a donc rien à rembourser.";
      } else {
        try {
          const invRes = await fetch(
            `https://api.stripe.com/v1/invoices?subscription=${encodeURIComponent(subId)}&status=paid&limit=1`,
            { headers: { Authorization: `Bearer ${stripeKey}` } },
          );
          const invBody = (await invRes.json().catch(() => null)) as
            | {
                data?: Array<{
                  amount_paid?: number;
                  currency?: string;
                  payment_intent?: string | { id?: string } | null;
                  charge?: string | { id?: string } | null;
                  period_start?: number;
                  period_end?: number;
                }>;
              }
            | null;
          const facture = invBody?.data?.[0] ?? null;

          if (facture) {
            const montantPaye = Number(facture.amount_paid ?? 0);
            const debut = Number(facture.period_start ?? 0);
            const fin = Number(facture.period_end ?? 0);
            const maintenant = Math.floor(Date.now() / 1000);
            const duree = fin - debut;
            const restantSecondes = Math.max(0, fin - maintenant);
            const ratio = duree > 0 ? Math.min(1, restantSecondes / duree) : 0;
            const montantRembourse = Math.floor(montantPaye * ratio);
            const paymentIntent =
              typeof facture.payment_intent === "string"
                ? facture.payment_intent
                : facture.payment_intent?.id ?? null;
            const charge = typeof facture.charge === "string" ? facture.charge : facture.charge?.id ?? null;

            if (montantRembourse > 0 && (paymentIntent || charge)) {
              const params = new URLSearchParams();
              params.append("amount", String(montantRembourse));
              params.append("reason", "requested_by_customer");
              params.append("metadata[artisan_id]", user.id);
              params.append("metadata[motif]", "Resiliation immediate avec remboursement au prorata");
              if (paymentIntent) params.append("payment_intent", paymentIntent);
              else if (charge) params.append("charge", charge);

              const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${stripeKey}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
              });
              const refundBody = (await refundRes.json().catch(() => null)) as
                | { id?: string; status?: string; error?: { message?: string } }
                | null;

              remboursement = {
                montant: montantRembourse / 100,
                devise: (facture.currency ?? "eur").toUpperCase(),
                effectue: refundRes.ok && !!refundBody?.id,
              };
              message =
                refundRes.ok && refundBody?.id
                  ? `Votre abonnement est résilié. Un remboursement de ${euros(
                      montantRembourse,
                      facture.currency ?? "eur",
                    )} correspondant à la période non utilisée a été déclenché sur votre moyen de paiement (5 à 10 jours ouvrés).`
                  : `Votre abonnement est résilié. Le remboursement au prorata (${euros(
                      montantRembourse,
                      facture.currency ?? "eur",
                    )}) sera traité par notre équipe sous 5 jours ouvrés.`;
            } else {
              message =
                "Votre abonnement est résilié. Aucun montant restant à rembourser sur la période en cours.";
            }
          }
        } catch {
          /* remboursement impossible : on le signale sans bloquer la résiliation */
        }

        if (!message) {
          message =
            "Votre abonnement est résilié. Le remboursement au prorata de la période non utilisée est traité par notre équipe sous 5 jours ouvrés.";
        }
      }
    } else {
      // Abonnement hors Stripe : résiliation immédiate enregistrée, remboursement traité à la main.
      message =
        "Votre abonnement est résilié immédiatement. Le remboursement au prorata de la période non utilisée est traité par notre équipe sous 5 jours ouvrés sur votre moyen de paiement habituel.";
    }

    // 3) Mise à jour de la fiche abonnement.
    const { error: majError } = await admin
      .from("abonnements")
      .update({
        statut: "Résilié",
        date_echeance: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", abo.id);
    if (majError) return json({ ok: false, error: "La résiliation n'a pas pu être enregistrée." }, 500);

    // 4) Journalisation (best-effort).
    await admin.from("abonnement_historique").insert({
      abonnement_id: abo.id,
      artisan_id: user.id,
      entreprise,
      type: "resiliation",
      ancienne_valeur: abo.statut ?? null,
      nouvelle_valeur: "Résilié",
      ancien_montant: abo.montant_mensuel ?? null,
      nouveau_montant: 0,
      motif: remboursement
        ? `Résiliation immédiate · remboursement ${remboursement.montant.toFixed(2)} ${remboursement.devise}`
        : "Résiliation immédiate",
    });

    // 5) Email de confirmation (best-effort).
    if (user.email) {
      const recapRemboursement = remboursement
        ? `<div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.6;">
             <strong>Remboursement au prorata :</strong> ${euros(
               Math.round(remboursement.montant * 100),
               remboursement.devise,
             )}<br />
             <span style="color:#6a6a64;">${
               remboursement.effectue
                 ? "Le remboursement a été déclenché sur votre moyen de paiement d'origine (5 à 10 jours ouvrés)."
                 : "Notre équipe déclenche le remboursement sous 5 jours ouvrés."
             }</span>
           </div>`
        : "";
      await envoyerEmail(
        user.email,
        "Votre abonnement ArtiFlow-pro est résilié",
        gabaritEmail(
          "Votre abonnement est résilié",
          `Bonjour ${entreprise}, nous confirmons la résiliation immédiate de votre abonnement ArtiFlow-pro ${
            abo.offre ?? ""
          }. Votre accès à l'espace est désormais fermé.`,
          `${recapRemboursement}
           <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#3c3c38;">
             Vos données (devis, factures, clients) restent conservées : vous pourrez reprendre une offre à tout
             moment et retrouver votre espace tel que vous l'avez laissé.
           </p>
           <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#3c3c38;">
             Vous souhaitez aussi supprimer définitivement votre compte ? Cela se fait en un clic depuis
             votre espace, onglet « Sécurité ».
           </p>`,
        ),
      );
    }

    return json({
      ok: true,
      statut: "Résilié",
      remboursement,
      message,
      date_resiliation: today,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
