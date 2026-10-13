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

/**
 * Ouvre le portail client Stripe (Billing Portal) pour l'artisan connecté :
 * il peut y changer son moyen de paiement, télécharger ses factures ou résilier
 * son abonnement. L'identifiant client Stripe est lu dans la table `abonnements`
 * (colonne `stripe_customer_id`), renseignée lors de la confirmation du paiement.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      return json({ ok: false, error: "La gestion d'abonnement n'est pas encore configurée." }, 500);
    }

    // 1) Authentification de l'artisan (client anon uniquement pour vérifier le JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const body = await req.json().catch(() => null);
    const returnUrl = String(body?.returnUrl ?? "").trim();
    if (!returnUrl) return json({ ok: false, error: "URL de retour manquante." }, 400);

    // 2) Récupération de l'identifiant client Stripe (client service_role, hors RLS).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: abo } = await admin
      .from("abonnements")
      .select("stripe_customer_id")
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const customer = (abo as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;

    if (!customer) {
      return json(
        { ok: false, error: "Aucun abonnement Stripe n'est rattaché à votre compte pour le moment." },
        404,
      );
    }

    // 3) Création de la session du portail client Stripe.
    const params = new URLSearchParams();
    params.append("customer", customer);
    params.append("return_url", returnUrl);

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = (await res.json().catch(() => null)) as
      | { url?: string; error?: { message?: string } }
      | null;

    if (!res.ok || !session?.url) {
      return json(
        { ok: false, error: session?.error?.message ?? "Impossible d'ouvrir la gestion de l'abonnement." },
        502,
      );
    }

    return json({ ok: true, url: session.url });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
