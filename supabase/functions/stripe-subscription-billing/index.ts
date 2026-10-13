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

interface StripeInvoice {
  id?: string;
  number?: string | null;
  created?: number;
  amount_paid?: number;
  amount_due?: number;
  amount_remaining?: number;
  currency?: string;
  status?: string;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  next_payment_attempt?: number | null;
  period_end?: number | null;
}

/** Convertit un horodatage Unix Stripe en date AAAA-MM-JJ. */
function toDateISO(unix: number | null | undefined): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

/** Libellé français lisible d'un statut de facture Stripe. */
function statutFR(status: string | undefined): string {
  switch (status) {
    case "paid":
      return "Payée";
    case "open":
      return "En attente";
    case "void":
      return "Annulée";
    case "uncollectible":
      return "Impayée";
    case "draft":
      return "Brouillon";
    default:
      return "—";
  }
}

/**
 * Traduit le statut d'un abonnement Stripe en statut ArtiFlow-pro. Renvoie null si
 * le statut Stripe ne correspond à aucune transition connue (on garde alors l'existant).
 */
function statutDepuisStripe(status: string): string | null {
  switch (status) {
    case "trialing":
      return "Essai";
    case "active":
      return "Actif";
    case "past_due":
    case "unpaid":
      return "Impayé";
    case "canceled":
    case "incomplete_expired":
      return "Résilié";
    default:
      return null;
  }
}

/**
 * Récupère l'espace de facturation de l'artisan connecté : la liste de ses
 * dernières factures Stripe (avec liens de téléchargement) et le prochain
 * prélèvement prévu. Lecture seule, à partir de l'identifiant client Stripe
 * mémorisé sur l'abonnement.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      return json({ ok: false, error: "La facturation n'est pas encore configurée." }, 500);
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

    // 2) Identifiants Stripe de l'abonnement (client service_role, hors RLS).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: abo } = await admin
      .from("abonnements")
      .select("id, statut, date_echeance, stripe_customer_id, stripe_subscription_id")
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = abo as {
      id?: number;
      statut?: string | null;
      date_echeance?: string | null;
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
    } | null;
    const customer = row?.stripe_customer_id ?? null;
    const subscription = row?.stripe_subscription_id ?? null;

    // Resynchronisation du statut depuis Stripe (sans webhook) : quand la période
    // d'essai se termine, Stripe prélève et l'abonnement passe de « trialing » à
    // « active ». On reflète ce passage en base pour que l'espace artisan arrête
    // d'afficher l'essai et montre l'abonnement actif et la nouvelle échéance.
    if (row?.id && subscription) {
      try {
        const subRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription)}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        const sub = (await subRes.json().catch(() => null)) as {
          status?: string;
          current_period_end?: number;
        } | null;
        const nouveauStatut = statutDepuisStripe(sub?.status ?? "");
        const nouvelleEcheance = toDateISO(sub?.current_period_end);
        const changement =
          (nouveauStatut && nouveauStatut !== (row.statut ?? "")) ||
          (nouvelleEcheance && nouvelleEcheance !== (row.date_echeance ?? null));
        if (subRes.ok && changement) {
          await admin
            .from("abonnements")
            .update({
              ...(nouveauStatut ? { statut: nouveauStatut } : {}),
              date_echeance: nouvelleEcheance,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      } catch {
        /* resynchronisation best-effort : ne bloque jamais l'affichage */
      }
    }

    if (!customer) {
      return json({ ok: true, prochain: null, factures: [] });
    }

    // 3) Liste des dernières factures du client.
    const invoicesRes = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(customer)}&limit=36`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const invoicesJson = (await invoicesRes.json().catch(() => null)) as
      | { data?: StripeInvoice[] }
      | null;

    const factures = (invoicesJson?.data ?? []).map((inv) => ({
      id: inv.id ?? "",
      numero: inv.number ?? "—",
      date: toDateISO(inv.created),
      montant: (Number(inv.amount_paid) || Number(inv.amount_due) || 0) / 100,
      devise: (inv.currency ?? "eur").toUpperCase(),
      statut: inv.status ?? "open",
      statutLabel: statutFR(inv.status),
      url: inv.hosted_invoice_url ?? null,
      pdf: inv.invoice_pdf ?? null,
    }));

    // 4) Prochain prélèvement (facture à venir), best-effort.
    let prochain: { montant: number; devise: string; date: string | null } | null = null;
    try {
      const params = new URLSearchParams();
      params.append("customer", customer);
      if (subscription) params.append("subscription", subscription);
      const upcomingRes = await fetch(`https://api.stripe.com/v1/invoices/upcoming?${params.toString()}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const upcoming = (await upcomingRes.json().catch(() => null)) as StripeInvoice | null;
      if (upcomingRes.ok && upcoming && upcoming.id) {
        const montant = (Number(upcoming.amount_due) || Number(upcoming.amount_remaining) || 0) / 100;
        const date = toDateISO(upcoming.next_payment_attempt ?? upcoming.period_end);
        if (montant > 0) {
          prochain = { montant, devise: (upcoming.currency ?? "eur").toUpperCase(), date };
        }
      }
    } catch {
      /* le prochain prélèvement reste indisponible, sans bloquer les factures */
    }

    return json({ ok: true, prochain, factures });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
