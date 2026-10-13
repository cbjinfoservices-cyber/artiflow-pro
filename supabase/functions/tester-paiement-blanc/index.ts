/**
 * Test à blanc du tunnel de paiement Stripe.
 *
 * Crée une VRAIE session Stripe Checkout en MODE TEST (clé `sk_test_...`) afin de
 * valider de bout en bout que le compte, le moyen de paiement « carte » et la devise
 * EUR fonctionnent — sans jamais encaisser d'argent réel. La session est ouverte dans
 * un nouvel onglet côté back-office, avec la carte de test 4242 4242 4242 4242.
 *
 * Sécurité : action réservée aux gestionnaires (vérification du JWT via un client anon,
 * puis contrôle de l'appartenance à la table `gestionnaires` via un client service_role).
 * Aucune écriture en base : c'est un test.
 */
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

/** Compte gestionnaire principal : toujours autorisé, même sans ligne en base. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

/** Montant symbolique du test (1,00 €), jamais réellement débité. */
const MONTANT_TEST_CENTS = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/**
 * Consigne un test à blanc dans l'historique back-office (date, résultat, détail).
 * Best-effort : un souci d'écriture ne doit jamais faire échouer le test lui-même.
 */
async function enregistrerTestBlanc(
  admin: Admin,
  auteurEmail: string,
  resultat: {
    ok: boolean;
    message: string;
    sessionId?: string;
    mode?: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  if (!admin || !auteurEmail) return;
  try {
    await admin.from("test_paiement_blanc_historique").insert({
      auteur_email: auteurEmail,
      ok: resultat.ok,
      mode: resultat.mode ?? "test",
      session_id: resultat.sessionId ?? null,
      message: resultat.message,
      detail: resultat.detail ?? null,
    });
  } catch {
    /* historique = confort : on ignore une erreur ponctuelle d'écriture */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeTestKey = (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "").trim();
    if (!supabaseUrl || !anonKey) {
      return json({ ok: false, error: "Le test n'est pas configuré pour l'instant." }, 500);
    }

    // 1) Authentification : client anon uniquement pour vérifier le JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    // 2) Action réservée aux gestionnaires (lecture hors RLS via service_role).
    const email = String(user.email ?? "").trim().toLowerCase();
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;
    let estGestionnaire = email === GESTIONNAIRE_PRINCIPAL_EMAIL.toLowerCase();
    if (!estGestionnaire && admin) {
      const { data } = await admin.from("gestionnaires").select("email");
      estGestionnaire = (data ?? []).some(
        (row: { email?: string }) => String(row?.email ?? "").trim().toLowerCase() === email,
      );
    }
    if (!estGestionnaire) return json({ ok: false, error: "Action réservée aux gestionnaires." }, 403);

    // 3) La clé de test doit être une vraie clé de test Stripe.
    if (!stripeTestKey) {
      const message =
        "Aucune clé de test Stripe n'est configurée. Ajoutez la clé de test (sk_test_…) côté Backend pour activer le test à blanc.";
      await enregistrerTestBlanc(admin, email, { ok: false, message, detail: { etape: "cle_absente" } });
      return json({ ok: false, error: message }, 400);
    }
    if (!stripeTestKey.startsWith("sk_test_")) {
      const message = "La clé configurée n'est pas une clé de test Stripe (elle doit commencer par sk_test_).";
      await enregistrerTestBlanc(admin, email, { ok: false, message, detail: { etape: "cle_invalide" } });
      return json({ ok: false, error: message }, 400);
    }

    const body = await req.json().catch(() => null);
    const successUrl = String(body?.successUrl ?? "").trim() || "https://stripe.com/docs/testing";
    const cancelUrl = String(body?.cancelUrl ?? "").trim() || "https://stripe.com/docs/testing";

    // 4) Création d'une session Checkout en mode test (carte, EUR, montant symbolique).
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    // `payment_method_types` n'est plus supporté par Stripe (dynamic payment methods) :
    // les moyens acceptés proviennent du Dashboard Stripe pour la devise EUR.
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "eur");
    params.append("line_items[0][price_data][unit_amount]", String(MONTANT_TEST_CENTS));
    params.append("line_items[0][price_data][product_data][name]", "Test à blanc — ArtiFlow-pro");
    params.append("metadata[test_a_blanc]", "true");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeTestKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = (await res.json().catch(() => null)) as
      | { id?: string; url?: string; error?: { message?: string } }
      | null;

    if (!res.ok || !session?.url) {
      const message = session?.error?.message ?? "La création de la session de test a échoué.";
      await enregistrerTestBlanc(admin, email, {
        ok: false,
        message,
        mode: "test",
        detail: { etape: "creation_session", statut_http: res.status },
      });
      return json({ ok: false, error: message }, 502);
    }

    await enregistrerTestBlanc(admin, email, {
      ok: true,
      message: "Session de test ouverte — tunnel validé en mode test.",
      mode: "test",
      sessionId: session.id,
      detail: { etape: "session_ouverte" },
    });

    return json({ ok: true, mode: "test", url: session.url, sessionId: session.id });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
