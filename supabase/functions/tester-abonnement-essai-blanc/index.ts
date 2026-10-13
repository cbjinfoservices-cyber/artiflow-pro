/**
 * Vrai test du tunnel d'abonnement reconductible AVEC période d'essai.
 *
 * Objectif : vérifier de façon fiable, côté serveur, qu'une souscription reconductible
 * configurée avec la durée d'essai réglée dans le back-office démarre bien en période
 * d'essai et que Stripe n'enregistre AUCUN débit avant la fin de l'essai.
 *
 * Le test s'exécute intégralement en MODE TEST (clé `sk_test_...`) : il crée un client,
 * y attache la carte de test partagée `pm_card_visa`, crée un abonnement avec
 * `trial_period_days` = durée réglée, puis inspecte la facture générée : elle doit être
 * de 0 € et sans PaymentIntent (donc aucun prélèvement). Toutes les ressources créées
 * sont supprimées à la fin — ce test ne laisse aucune trace dans Stripe.
 *
 * Sécurité : action réservée aux gestionnaires (JWT vérifié via un client anon, puis
 * contrôle d'appartenance à la table `gestionnaires` via un client service_role).
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

/** Base de l'API Stripe (form-urlencoded). */
const STRIPE_BASE = "https://api.stripe.com/v1";

/** Carte de test partagée de Stripe : aucune donnée bancaire réelle manipulée. */
const PM_TEST = "pm_card_visa";

/** Durée d'essai par défaut (jours) si le réglage global est indisponible. */
const ESSAI_JOURS_DEFAUT = 14;

type Admin = any;

/** POST form-urlencoded vers Stripe, avec parsing JSON tolérant. */
async function stripePost(
  path: string,
  stripeKey: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/** DELETE simple vers Stripe (nettoyage best-effort). */
async function stripeDelete(path: string, stripeKey: string): Promise<void> {
  try {
    await fetch(`${STRIPE_BASE}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
  } catch {
    /* nettoyage best-effort : on ignore un échec ponctuel */
  }
}

/** Lit la durée d'essai réglée dans le back-office (`parametres_app`, ligne id = 1). */
async function lireDureeEssai(admin: Admin): Promise<number> {
  if (!admin) return ESSAI_JOURS_DEFAUT;
  try {
    const { data } = await admin.from("parametres_app").select("essai_jours").eq("id", 1).maybeSingle();
    const n = Math.round(Number((data as { essai_jours?: number } | null)?.essai_jours));
    if (!Number.isFinite(n)) return ESSAI_JOURS_DEFAUT;
    return Math.min(90, Math.max(0, n));
  } catch {
    return ESSAI_JOURS_DEFAUT;
  }
}

/** Date lisible en français depuis un horodatage Unix Stripe. */
function frDateFromUnix(unix: number | null | undefined): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Consigne le test d'essai dans l'historique back-office (best-effort). */
async function enregistrerTest(
  admin: Admin,
  auteurEmail: string,
  resultat: {
    ok: boolean;
    essaiJours: number;
    statut?: string;
    subscriptionId?: string | null;
    montantFacture?: number;
    message: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  if (!admin || !auteurEmail) return;
  try {
    await admin.from("test_abonnement_essai_historique").insert({
      auteur_email: auteurEmail,
      ok: resultat.ok,
      essai_jours: resultat.essaiJours,
      statut: resultat.statut ?? null,
      subscription_id: resultat.subscriptionId ?? null,
      montant_facture: resultat.montantFacture ?? 0,
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
        "Aucune clé de test Stripe n'est configurée. Ajoutez la clé de test (sk_test_…) côté Backend pour activer ce test.";
      await enregistrerTest(admin, email, { ok: false, essaiJours: 0, message, detail: { etape: "cle_absente" } });
      return json({ ok: false, error: message }, 400);
    }
    if (!stripeTestKey.startsWith("sk_test_")) {
      const message = "La clé configurée n'est pas une clé de test Stripe (elle doit commencer par sk_test_).";
      await enregistrerTest(admin, email, { ok: false, essaiJours: 0, message, detail: { etape: "cle_invalide" } });
      return json({ ok: false, error: message }, 400);
    }

    const essaiJours = await lireDureeEssai(admin);

    // Ressources créées pendant le test : supprimées quoi qu'il arrive.
    let customerId: string | null = null;
    let subscriptionId: string | null = null;

    try {
      // 4) Client de test.
      const custParams = new URLSearchParams();
      custParams.append("email", `test-essai-${Date.now()}@artiflow-pro.fr`);
      custParams.append("description", "Test automatique essai abonnement (ArtiFlow-pro)");
      const cust = await stripePost("/customers", stripeTestKey, custParams);
      if (!cust.ok || !cust.data?.id) {
        throw new Error(cust.data?.error?.message ?? "Création du client de test impossible.");
      }
      customerId = cust.data.id;

      // 5) Carte de test partagée attachée au client.
      const attachParams = new URLSearchParams();
      attachParams.append("customer", customerId as string);
      const attach = await stripePost(`/payment_methods/${PM_TEST}/attach`, stripeTestKey, attachParams);
      const pmId: string = attach.data?.id ?? PM_TEST;
      if (!attach.ok) {
        throw new Error(attach.data?.error?.message ?? "Attachement du moyen de paiement de test impossible.");
      }

      // 6) Moyen de paiement par défaut du client.
      const upd = new URLSearchParams();
      upd.append("invoice_settings[default_payment_method]", pmId);
      await stripePost(`/customers/${customerId}`, stripeTestKey, upd);

      // 7) Tarif de test (abonnement mensuel 59 €) — jamais réellement encaissé.
      const priceParams = new URLSearchParams();
      priceParams.append("currency", "eur");
      priceParams.append("unit_amount", "5900");
      priceParams.append("recurring[interval]", "month");
      priceParams.append("product_data[name]", "Test essai — ArtiFlow-pro (abonnement)");
      const price = await stripePost("/prices", stripeTestKey, priceParams);
      if (!price.ok || !price.data?.id) {
        throw new Error(price.data?.error?.message ?? "Création du tarif de test impossible.");
      }

      // 8) Abonnement AVEC période d'essai = durée réglée dans le back-office.
      const subParams = new URLSearchParams();
      subParams.append("customer", customerId as string);
      subParams.append("items[0][price]", price.data.id);
      subParams.append("default_payment_method", pmId);
      if (essaiJours > 0) subParams.append("trial_period_days", String(essaiJours));
      subParams.append("expand[0]", "latest_invoice");
      const sub = await stripePost("/subscriptions", stripeTestKey, subParams);
      if (!sub.ok || !sub.data?.id) {
        throw new Error(sub.data?.error?.message ?? "Création de l'abonnement de test impossible.");
      }
      subscriptionId = sub.data.id;

      const statut: string = String(sub.data.status ?? "");
      const invoice = sub.data.latest_invoice ?? null;
      const montantFacture = (Number(invoice?.amount_paid) || 0) / 100;
      const montantDu = (Number(invoice?.amount_due) || 0) / 100;
      const aPaymentIntent = Boolean(invoice?.payment_intent);
      const trialEndLabel = frDateFromUnix(sub.data.trial_end);

      // 9) Vérification : en essai, la facture générée doit être de 0 €, sans PaymentIntent.
      const enEssai = statut === "trialing";
      const aucunDebit = montantFacture === 0 && montantDu === 0 && !aPaymentIntent;

      let verifie: boolean;
      let message: string;
      if (essaiJours > 0) {
        verifie = enEssai && aucunDebit;
        message = verifie
          ? `Essai reconductible de ${essaiJours} jours validé : l'abonnement démarre en période d'essai et Stripe n'enregistre aucun débit avant le ${
              trialEndLabel ?? "terme de l'essai"
            } (montant encaissé : 0 €).`
          : `L'essai de ${essaiJours} jours n'a pas été appliqué comme prévu (statut : ${statut || "inconnu"}, montant facturé : ${montantFacture} €).`;
      } else {
        verifie = statut === "active";
        message = verifie
          ? "Essai désactivé (0 jour) : le premier prélèvement a bien lieu immédiatement à la souscription, sans période d'essai."
          : `La souscription sans essai n'a pas abouti comme prévu (statut : ${statut || "inconnu"}).`;
      }

      await enregistrerTest(admin, email, {
        ok: verifie,
        essaiJours,
        statut,
        subscriptionId,
        montantFacture,
        message,
        detail: {
          etape: "verification",
          trial_end: trialEndLabel,
          montant_du: montantDu,
          payment_intent: aPaymentIntent,
        },
      });

      return json({
        ok: true,
        verifie,
        essaiJours,
        statut,
        montantFacture,
        trialEnd: trialEndLabel,
        message,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Le test d'essai a échoué.";
      await enregistrerTest(admin, email, {
        ok: false,
        essaiJours,
        message,
        detail: { etape: "erreur" },
      });
      return json({ ok: false, error: message }, 502);
    } finally {
      // 10) Nettoyage : on annule l'abonnement puis on supprime le client de test.
      if (subscriptionId) await stripeDelete(`/subscriptions/${subscriptionId}`, stripeTestKey);
      if (customerId) await stripeDelete(`/customers/${customerId}`, stripeTestKey);
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
