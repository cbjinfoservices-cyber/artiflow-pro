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

/** Durée de la période de grâce avant la suppression réelle. */
const JOURS_GRACE = 30;

/** Formate une date en français (fuseau de Paris). */
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

/** Envoi d'un email via Resend (best-effort, jamais bloquant). */
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
        Cet email vous est envoyé automatiquement par ArtiFlow-pro. Conservez-le : il fait foi de la date de votre demande.
      </p>
    </div>
  </body>
</html>`;
}

interface AbonnementRow {
  id: number;
  entreprise: string | null;
  offre: string | null;
  statut: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Enregistre la **demande** de suppression de compte de l'artisan connecté.
 *
 * Depuis cette version, la suppression n'est plus immédiate : elle est **programmée à
 * J+30**. L'artisan dispose donc de 30 jours pour changer d'avis — se reconnecter à son
 * espace annule automatiquement la demande (fonction `annuler-suppression-compte`).
 *
 * Le mot de passe est revérifié côté serveur, et la confirmation doit valoir « SUPPRIMER ».
 *
 * Côté abonnement : le prélèvement n'est plus renouvelé. L'abonnement Stripe est marqué
 * `cancel_at_period_end` (arrêt à la fin de la période déjà payée, sans remboursement).
 *
 * Un email de confirmation est envoyé : il rappelle la date réelle de suppression, la fin
 * de l'abonnement, et la façon d'annuler. C'est la première pièce du dossier en cas de litige.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "La suppression de compte n'est pas encore configurée." }, 500);
    }

    // 1) Authentification du porteur du JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const body = await req.json().catch(() => null);
    const motDePasse = String(body?.motDePasse ?? "");
    const confirmation = String(body?.confirmation ?? "").trim();
    if (!motDePasse) {
      return json({ ok: false, error: "Saisissez votre mot de passe pour confirmer." }, 400);
    }
    if (confirmation !== "SUPPRIMER") {
      return json({ ok: false, error: "Saisissez « SUPPRIMER » pour confirmer la demande." }, 400);
    }
    if (!user.email) {
      return json({ ok: false, error: "Aucune adresse email n'est associée à ce compte." }, 400);
    }

    // 2) Revérification réelle du mot de passe.
    const verifClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { error: verifError } = await verifClient.auth.signInWithPassword({
      email: user.email,
      password: motDePasse,
    });
    if (verifError) {
      return json({ ok: false, error: "Le mot de passe saisi est incorrect." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Une demande est-elle déjà en cours ? On la renvoie telle quelle (idempotent).
    const { data: existante } = await admin
      .from("suppressions_compte")
      .select("id, demandee_le, prevue_le")
      .eq("user_id", user.id)
      .eq("statut", "programmee")
      .order("demandee_le", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existante) {
      const row = existante as { prevue_le: string };
      return json({
        ok: true,
        dejaProgrammee: true,
        dateSuppression: row.prevue_le,
        message: `La suppression de votre compte est déjà programmée le ${dateFr(row.prevue_le)}. Vous pouvez encore l'annuler depuis votre espace.`,
      });
    }

    // 3) Abonnement : plus de renouvellement, arrêt à la fin de la période en cours.
    const { data: aboData } = await admin
      .from("abonnements")
      .select("id, entreprise, offre, statut, stripe_subscription_id")
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const abo = aboData as AbonnementRow | null;
    const entreprise = abo?.entreprise || user.email.split("@")[0];

    let finDePeriode: string | null = null;
    if (stripeKey && abo?.stripe_subscription_id) {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(abo.stripe_subscription_id)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "cancel_at_period_end=true",
          },
        );
        const sub = (await res.json().catch(() => null)) as
          | { current_period_end?: number; status?: string }
          | null;
        if (res.ok && sub?.current_period_end) {
          finDePeriode = new Date(sub.current_period_end * 1000).toISOString();
        }
      } catch {
        /* le non-renouvellement sera retenté par l'équipe, la demande reste enregistrée */
      }
    }

    // 4) Enregistrement de la demande (J + 30).
    const maintenant = new Date();
    const prevue = new Date(maintenant.getTime() + JOURS_GRACE * 24 * 60 * 60 * 1000);

    const { data: creee, error: insertError } = await admin
      .from("suppressions_compte")
      .insert({
        user_id: user.id,
        email: user.email,
        entreprise,
        demandee_le: maintenant.toISOString(),
        prevue_le: prevue.toISOString(),
        statut: "programmee",
        stripe_subscription_id: abo?.stripe_subscription_id ?? null,
        fin_de_periode_le: finDePeriode,
        details: { offre: abo?.offre ?? null, jours_grace: JOURS_GRACE },
      })
      .select("id, prevue_le")
      .single();
    if (insertError) {
      return json({ ok: false, error: "La demande n'a pas pu être enregistrée. Réessayez." }, 500);
    }

    // 5) Email de confirmation (preuve de la demande).
    const recapPeriode = finDePeriode
      ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
           Votre abonnement <strong>${abo?.offre ?? ""}</strong> ne sera pas renouvelé : il s'arrête à la fin de la
           période en cours, le <strong>${dateFr(finDePeriode)}</strong>. Aucun remboursement de la période déjà
           réglée n'est effectué.
         </p>`
      : `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
           Aucun prélèvement ne sera plus effectué pour votre abonnement.
         </p>`;

    await envoyerEmail(
      user.email,
      "Votre demande de suppression de compte est enregistrée",
      gabaritEmail(
        "Votre demande de suppression est enregistrée",
        `Bonjour ${entreprise}, nous confirmons avoir reçu votre demande de suppression de compte ArtiFlow-pro.`,
        `<div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;margin-bottom:18px;">
           <strong>Demande reçue le :</strong> ${dateFr(maintenant)}<br />
           <strong>Suppression réelle de vos données le :</strong> ${dateFr(prevue)}<br />
           <strong>Période de grâce :</strong> ${JOURS_GRACE} jours
         </div>
         ${recapPeriode}
         <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
           <strong>Vous changez d'avis ?</strong> Reconnectez-vous simplement à votre espace : la demande est annulée
           automatiquement. Vous pouvez aussi annuler d'un clic depuis <em>Mon profil → Sécurité</em>.
         </p>
         <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
           D'ici la suppression, vous gardez un accès complet à votre espace. Pensez à récupérer vos données depuis
           <em>Mon profil → Sécurité → Mes droits RGPD → Exporter mes données</em>.
         </p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#6a6a64;">
           À la date prévue, nous vous enverrons un second email récapitulant précisément ce qui a été effacé.
         </p>`,
      ),
    );

    return json({
      ok: true,
      programmee: true,
      demandeId: (creee as { id: number }).id,
      dateSuppression: prevue.toISOString(),
      finDePeriode: finDePeriode,
      joursRestants: JOURS_GRACE,
      message: `Votre demande est enregistrée. Vos données seront définitivement supprimées le ${dateFr(
        prevue,
      )} — vous pouvez annuler à tout moment en vous reconnectant.`,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
