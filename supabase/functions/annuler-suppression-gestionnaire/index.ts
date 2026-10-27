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

function dateFr(valeur: string | Date | null | undefined): string {
  if (!valeur) return "—";
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

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

interface DemandeRow {
  id: number;
  user_id: string;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  stripe_subscription_id: string | null;
}

/**
 * Annule une demande de suppression de compte à la demande d'un **gestionnaire**.
 *
 * Utile depuis l'encart back-office « Suppressions en attente » : quand un artisan appelle,
 * écrit ou se rétracte par un autre canal, un gestionnaire peut annuler sa demande sans
 * attendre qu'il se reconnecte.
 *
 * Sécurité :
 *  — le JWT de l'appelant est vérifié avec la clé anon (jamais la clé service) ;
 *  — l'email de l'appelant doit figurer dans la table `gestionnaires` (vérifié avec la clé service) ;
 *  — l'identifiant de la demande est validé et doit être au statut `programmee`.
 *
 * Effets identiques à une annulation par l'artisan : statut `annulee`, motif
 * `gestionnaire`, rétablissement du renouvellement Stripe, et email de confirmation à l'artisan.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "L'annulation n'est pas encore configurée." }, 500);
    }

    // 1) Authentification du porteur du JWT (client anon uniquement).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user?.email) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    // 2) Contrôle du rôle gestionnaire (client service).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: gestionnaire } = await admin
      .from("gestionnaires")
      .select("email")
      .ilike("email", user.email)
      .maybeSingle();
    if (!gestionnaire) {
      return json({ ok: false, error: "Cette action est réservée aux gestionnaires." }, 403);
    }

    const body = await req.json().catch(() => null);
    const demandeId = Number(body?.demandeId);
    if (!Number.isFinite(demandeId) || demandeId <= 0) {
      return json({ ok: false, error: "Demande introuvable." }, 400);
    }

    const { data: demandeData } = await admin
      .from("suppressions_compte")
      .select("id, user_id, email, entreprise, demandee_le, prevue_le, stripe_subscription_id, statut")
      .eq("id", demandeId)
      .maybeSingle();
    const demande = demandeData as (DemandeRow & { statut: string }) | null;
    if (!demande) return json({ ok: false, error: "Cette demande n'existe plus." }, 404);
    if (demande.statut !== "programmee") {
      return json({ ok: false, error: "Cette demande n'est plus en attente : elle a déjà été traitée." }, 409);
    }

    const maintenant = new Date().toISOString();
    const { error: majError } = await admin
      .from("suppressions_compte")
      .update({
        statut: "annulee",
        annulee_le: maintenant,
        motif_annulation: "gestionnaire",
        updated_at: maintenant,
      })
      .eq("id", demande.id)
      .eq("statut", "programmee");
    if (majError) {
      return json({ ok: false, error: "L'annulation n'a pas pu être enregistrée." }, 500);
    }

    // 3) Rétablit le renouvellement de l'abonnement s'il avait été arrêté.
    if (stripeKey && demande.stripe_subscription_id) {
      try {
        await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(demande.stripe_subscription_id)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "cancel_at_period_end=false",
        });
      } catch {
        /* best-effort : le renouvellement peut être réactivé depuis le portail Stripe */
      }
    }

    // 4) L'artisan est prévenu : la suppression n'aura pas lieu.
    if (demande.email) {
      await envoyerEmail(
        demande.email,
        "Suppression de compte annulée — votre compte est conservé",
        `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Suppression annulée</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Bonjour ${demande.entreprise || "à vous"}, la demande de suppression de votre compte ArtiFlow-pro
          a été annulée par notre équipe, à votre demande.
        </p>
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;">
          <strong>Demande initiale du :</strong> ${dateFr(demande.demandee_le)}<br />
          <strong>Annulation enregistrée le :</strong> ${dateFr(maintenant)}<br />
          <strong>Suppression qui était prévue le :</strong> ${dateFr(demande.prevue_le)}
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#3c3c38;">
          Votre compte, vos données et votre abonnement restent en place, exactement comme avant votre demande.
        </p>
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Cet email vous est envoyé automatiquement par ArtiFlow-pro. Conservez-le : il fait foi de l'annulation.
      </p>
    </div>
  </body>
</html>`,
      );
    }

    return json({
      ok: true,
      annulee: true,
      demandeId: demande.id,
      email: demande.email,
      message: `Suppression annulée pour ${demande.entreprise || demande.email || "ce compte"}.`,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
