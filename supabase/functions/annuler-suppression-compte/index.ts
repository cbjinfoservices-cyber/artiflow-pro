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

/**
 * Annule une demande de suppression de compte encore dans la période de grâce.
 *
 * Deux chemins d'appel :
 *  — l'artisan clique « Annuler la suppression » dans son profil (Sécurité) ;
 *  — il s'est simplement reconnecté : le front appelle cette fonction automatiquement,
 *    avec `motif = "connexion"`.
 *
 * Effets : la demande passe en `annulee`, et si l'abonnement avait été marqué
 * « non renouvellement », on rétablit le renouvellement normal.
 * Un email confirme l'annulation (pièce du dossier en cas de litige).
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const body = await req.json().catch(() => null);
    const motifBrut = String(body?.motif ?? "action-manuelle");
    const motif = motifBrut === "connexion" ? "connexion" : "action-manuelle";

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: demandeData } = await admin
      .from("suppressions_compte")
      .select("id, prevue_le, stripe_subscription_id, email, entreprise")
      .eq("user_id", user.id)
      .eq("statut", "programmee")
      .order("demandee_le", { ascending: false })
      .limit(1)
      .maybeSingle();

    const demande = demandeData as
      | {
          id: number;
          prevue_le: string;
          stripe_subscription_id: string | null;
          email: string | null;
          entreprise: string | null;
        }
      | null;

    if (!demande) {
      return json({ ok: true, aucuneDemande: true, message: "Aucune suppression n'était programmée." });
    }

    const maintenant = new Date().toISOString();
    const { error: majError } = await admin
      .from("suppressions_compte")
      .update({
        statut: "annulee",
        annulee_le: maintenant,
        motif_annulation: motif,
        updated_at: maintenant,
      })
      .eq("id", demande.id);
    if (majError) {
      return json({ ok: false, error: "L'annulation n'a pas pu être enregistrée." }, 500);
    }

    // Rétablit le renouvellement de l'abonnement s'il avait été arrêté.
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
        /* best-effort : l'abonnement peut être réactivé depuis le back-office */
      }
    }

    const destinataire = demande.email || user.email;
    if (destinataire) {
      const raison =
        motif === "connexion"
          ? "Votre reconnexion à l'espace ArtiFlow-pro a automatiquement annulé la demande."
          : "Vous avez annulé la demande depuis votre espace.";
      await envoyerEmail(
        destinataire,
        "Suppression de compte annulée — votre compte est conservé",
        `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Suppression annulée</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Bonjour ${demande.entreprise || "à vous"}, la demande de suppression de votre compte ArtiFlow-pro est annulée.
          ${raison}
        </p>
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;">
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
      motif,
      message: "La suppression de votre compte est annulée : votre espace reste intact.",
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
