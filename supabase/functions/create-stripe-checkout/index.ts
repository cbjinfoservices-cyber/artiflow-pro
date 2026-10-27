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

/** Tarif mensuel de référence de chaque offre (en euros). */
const OFFRE_PRIX: Record<string, number> = { Essentiel: 29, Pro: 59, Entreprise: 99 };
const REMISE_ANNUELLE = 0.8;

/** Compte gestionnaire principal : toujours prévenu, même sans ligne en base. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

type AdminClient = { from: (table: string) => any };

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rassemble les adresses email des gestionnaires (principal + table gestionnaires). */
async function adressesGestionnaires(admin: AdminClient): Promise<string[]> {
  const set = new Set<string>();
  set.add(GESTIONNAIRE_PRINCIPAL_EMAIL);
  try {
    const { data } = await admin.from("gestionnaires").select("email");
    (data ?? []).forEach((row: { email?: string }) => {
      const email = String(row?.email ?? "").trim();
      if (email) set.add(email);
    });
  } catch {
    /* best-effort : on garde au minimum le gestionnaire principal */
  }
  return Array.from(set);
}

/** Le compte Stripe que la clé branchée interroge réellement. */
interface CompteStripe {
  id: string;
  nom: string;
  pays: string;
}

/**
 * Récupère le compte Stripe réellement utilisé par la clé branchée (identifiant acct_…,
 * nom, pays). Sert à inclure l'identifiant du compte dans l'email d'alerte quand un échec
 * « no valid payment method » survient : les gestionnaires voient immédiatement QUEL compte
 * Stripe doit être configuré. Best-effort : renvoie null en cas d'échec.
 */
async function recupererCompteStripe(stripeKey: string): Promise<CompteStripe | null> {
  try {
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!res.ok) return null;
    const compte = (await res.json().catch(() => null)) as
      | {
          id?: string;
          country?: string;
          business_profile?: { name?: string };
          settings?: { dashboard?: { display_name?: string } };
        }
      | null;
    if (!compte?.id) return null;
    const nom =
      String(compte.business_profile?.name ?? "").trim() ||
      String(compte.settings?.dashboard?.display_name ?? "").trim();
    return { id: String(compte.id), nom, pays: String(compte.country ?? "").toUpperCase() };
  } catch {
    return null;
  }
}

interface ContexteEchec {
  artisanEmail: string | null;
  artisanId: string | null;
  offre: string;
  facturation: string;
  montantLabel: string;
  message: string;
}

/**
 * Prévient les gestionnaires par email qu'une création de session de paiement Stripe
 * a échoué. Best-effort : ne bloque jamais la réponse renvoyée au client.
 */
async function notifierGestionnairesEchec(
  admin: AdminClient,
  resendKey: string | undefined,
  fromDomain: string | undefined,
  ctx: ContexteEchec,
  compte: CompteStripe | null = null,
): Promise<void> {
  if (!resendKey || !fromDomain) return;
  try {
    const destinataires = await adressesGestionnaires(admin);
    if (destinataires.length === 0) return;
    const quand = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "full",
      timeStyle: "short",
    });
    const ligne = (label: string, valeur: string) =>
      `<tr><td style="padding:8px 0;font-size:13px;color:#6a6a64;border-bottom:1px solid #efede8;">${label}</td><td style="padding:8px 0;font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid #efede8;">${escapeHtml(valeur)}</td></tr>`;
    // Motif précis : « no valid payment method ». On met alors en avant le COMPTE Stripe
    // concerné (identifiant acct_…, nom, pays), car la correction se fait dans son Dashboard.
    const estMoyenPaiement = /no valid payment method/i.test(ctx.message || "");
    const lignesCompte = compte
      ? `${ligne("Compte Stripe", compte.id)}${compte.nom ? ligne("Nom du compte", compte.nom) : ""}${
          compte.pays ? ligne("Pays du compte", compte.pays) : ""
        }`
      : "";
    const encartMoyenPaiement = estMoyenPaiement
      ? `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;">Aucun moyen de paiement « carte » valide sur le compte Stripe${
              compte ? ` ${escapeHtml(compte.id)}` : ""
            }.</p>
            <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">À faire : ouvrir Stripe → Paramètres → Moyens de paiement et activer « Carte » pour l'euro (en Test ET en Live), sur le compte dont l'identifiant figure ci-dessus. Vérifier aussi que le compte est entièrement activé.</p>
          </div>`
      : "";
    const sujet = estMoyenPaiement
      ? `Action requise · carte non activée sur le compte Stripe${compte ? ` ${compte.id}` : ""}`
      : `Échec paiement Stripe — ${ctx.offre} (${ctx.facturation})`;
    const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #f0d3d3;border-radius:12px;padding:26px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#b91c1c;">${
            estMoyenPaiement ? "Aucun moyen de paiement sur Stripe" : "Échec d'ouverture d'un paiement"
          }</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3c3c38;">Une tentative de souscription n'a pas pu ouvrir la page de paiement Stripe. Aucun abonnement n'a été créé et aucune somme n'a été prélevée.</p>
          <table style="width:100%;border-collapse:collapse;">
            ${ligne("Date", quand)}
            ${ligne("Artisan", ctx.artisanEmail ?? "—")}
            ${ligne("Identifiant", ctx.artisanId ?? "—")}
            ${ligne("Offre", ctx.offre)}
            ${ligne("Facturation", ctx.facturation)}
            ${ligne("Montant attendu", ctx.montantLabel)}
            ${lignesCompte}
          </table>
          ${encartMoyenPaiement}
          <div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;">
            <p style="margin:0;font-size:12px;color:#b91c1c;line-height:1.6;">${escapeHtml(ctx.message || "Erreur inconnue.")}</p>
          </div>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#8a8a84;text-align:center;">Alerte automatique ArtiFlow-pro.</p>
      </div>
    </body></html>`;
    await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${fromDomain}>`,
        to: destinataires,
        subject: sujet,
        html,
      }),
    });
  } catch {
    /* best-effort : l'alerte ne doit jamais bloquer la réponse au client */
  }
}

interface ContexteEchecDb {
  artisanId: string;
  artisanEmail: string | null;
  entreprise: string | null;
  offre: string;
  facturation: "mensuel" | "annuel";
  montantMensuel: number;
  montantTotal: number;
  message: string;
}

/**
 * Trace un échec d'ouverture de paiement dans `paiements_echecs` pour que les
 * gestionnaires puissent consulter l'historique des incidents Stripe dans le
 * back-office. Best-effort : ne bloque jamais la réponse renvoyée au client.
 */
async function enregistrerEchecPaiement(admin: AdminClient, ctx: ContexteEchecDb): Promise<void> {
  if (!admin) return;
  try {
    let entreprise = ctx.entreprise;
    if (!entreprise) {
      const { data } = await admin.from("profiles").select("entreprise").eq("id", ctx.artisanId).maybeSingle();
      entreprise = String((data as { entreprise?: string | null } | null)?.entreprise ?? "") || null;
    }
    await admin.from("paiements_echecs").insert({
      artisan_id: ctx.artisanId,
      artisan_email: ctx.artisanEmail,
      entreprise,
      offre: ctx.offre,
      facturation: ctx.facturation === "annuel" ? "Annuelle (12 mois)" : "Mensuelle",
      montant_mensuel: ctx.montantMensuel,
      montant_total: ctx.montantTotal,
      message: ctx.message,
      source: "create-stripe-checkout",
    });
  } catch {
    /* best-effort : un journal manquant ne doit jamais bloquer la réponse */
  }
}

type Facturation = "mensuel" | "annuel";

/** Mode de règlement : reconduction automatique (abonnement) ou paiement unique. */
type ModePaiement = "recurrent" | "unique";

/** Durée d'essai par défaut (jours) si le réglage global n'est pas disponible. */
const ESSAI_JOURS_DEFAUT = 14;

/**
 * Lit la durée de la période d'essai réglée depuis le back-office (table `parametres_app`,
 * ligne unique id = 1). Best-effort : renvoie la valeur par défaut en cas d'échec.
 */
async function lireDureeEssai(admin: AdminClient | null): Promise<number> {
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

/**
 * Crée une session Stripe Checkout en mode abonnement pour l'offre choisie.
 * Le tarif récurrent est transmis inline (price_data) : aucune fiche produit
 * préalable n'est nécessaire dans Stripe.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendKey = cleEnvoiEmail();
    const fromDomain = domaineEnvoiEmail();
    if (!supabaseUrl || !anonKey || !stripeKey) {
      return json({ ok: false, error: "Le paiement n'est pas encore configuré." }, 500);
    }

    // Client service_role : utilisé uniquement pour prévenir les gestionnaires par email
    // en cas d'échec (lecture de la table `gestionnaires`, hors RLS).
    const admin = serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

    // 1) Authentification de l'artisan (client anon uniquement pour vérifier le JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté pour vous abonner." }, 401);

    // 2) Paramètres de la demande.
    const body = await req.json().catch(() => null);
    const offre = String(body?.offre ?? "").trim();
    const facturation: Facturation = body?.facturation === "annuel" ? "annuel" : "mensuel";
    const modePaiement: ModePaiement = body?.modePaiement === "unique" ? "unique" : "recurrent";
    const successUrl = String(body?.successUrl ?? "").trim();
    const cancelUrl = String(body?.cancelUrl ?? "").trim();

    if (!OFFRE_PRIX[offre]) return json({ ok: false, error: "Offre inconnue." }, 400);
    if (!successUrl || !cancelUrl) return json({ ok: false, error: "URL de retour manquante." }, 400);

    const mensuel = OFFRE_PRIX[offre];
    const interval = facturation === "annuel" ? "year" : "month";
    const montantMois = facturation === "annuel" ? Math.round(mensuel * REMISE_ANNUELLE) : mensuel;
    // Quel que soit le mode, le montant débité couvre la même période : 1 mois au choix mensuel,
    // 12 mois au choix annuel. Seule la reconduction diffère (abonnement vs paiement unique).
    const unitAmountCents = (facturation === "annuel" ? montantMois * 12 : mensuel) * 100;

    const unique = modePaiement === "unique";
    // Durée d'essai réel : un essai Stripe ne s'applique qu'aux abonnements
    // reconductibles (un paiement unique est réglé immédiatement). La durée est le
    // réglage global du back-office (0 = pas d'essai).
    const essaiJours = unique ? 0 : await lireDureeEssai(admin);

    // 3) Création de la session Stripe Checkout.
    const params = new URLSearchParams();
    params.append("mode", unique ? "payment" : "subscription");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    // IMPORTANT : on ne passe PLUS `payment_method_types` ici.
    // Stripe gère désormais les moyens de paiement via « dynamic payment methods » :
    // le paramètre `payment_method_types` n'est plus supporté et fait échouer la
    // session (« The payment_method_types parameter is no longer supported… »).
    // Les moyens acceptés sont ceux activés pour la devise EUR dans le Dashboard
    // Stripe (Paramètres > Moyens de paiement) — la carte doit y être activée.
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "eur");
    params.append("line_items[0][price_data][unit_amount]", String(unitAmountCents));
    if (unique) {
      // Paiement unique : on demande à Stripe de générer une facture pour ce règlement et
      // on force la création d'un client, afin que l'artisan retrouve sa facture et puisse
      // gérer son moyen de paiement depuis son espace.
      params.append("invoice_creation[enabled]", "true");
      params.append("customer_creation", "always");
    } else {
      params.append("line_items[0][price_data][recurring][interval]", interval);
      if (essaiJours > 0) {
        // Vrai essai Stripe : la carte est collectée mais AUCUN débit n'a lieu pendant
        // la durée d'essai ; le premier prélèvement survient automatiquement à la fin.
        params.append("subscription_data[trial_period_days]", String(essaiJours));
      }
    }
    params.append(
      "line_items[0][price_data][product_data][name]",
      `ArtiFlow-pro ${offre} — ${unique ? "paiement unique" : "abonnement"} ${
        facturation === "annuel" ? "annuel" : "mensuel"
      }`,
    );
    params.append("metadata[user_id]", user.id);
    params.append("metadata[offre]", offre);
    params.append("metadata[facturation]", facturation);
    params.append("metadata[mode_paiement]", modePaiement);
    params.append("metadata[montant_mensuel]", String(montantMois));
    params.append("metadata[essai_jours]", String(essaiJours));
    if (!unique) {
      params.append("subscription_data[metadata][user_id]", user.id);
      params.append("subscription_data[metadata][offre]", offre);
      params.append("subscription_data[metadata][facturation]", facturation);
      params.append("subscription_data[metadata][essai_jours]", String(essaiJours));
    }
    if (user.email) params.append("customer_email", user.email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = (await res.json().catch(() => null)) as
      | { id?: string; url?: string; error?: { message?: string } }
      | null;

    if (!res.ok || !session?.url) {
      const messageEchec = session?.error?.message ?? "La création du paiement a échoué.";
      if (admin) {
        const montantLabel = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
          unitAmountCents / 100,
        );
        // Journalisation de l'incident pour le back-office (traçabilité des échecs Stripe).
        await enregistrerEchecPaiement(admin, {
          artisanId: user.id,
          artisanEmail: user.email ?? null,
          entreprise: null,
          offre,
          facturation,
          montantMensuel: montantMois,
          montantTotal: unitAmountCents / 100,
          message: messageEchec,
        });
        // Sur l'échec précis « no valid payment method », on récupère le compte Stripe
        // réellement utilisé par la clé branchée et on l'inclut dans l'alerte aux
        // gestionnaires (identifiant acct_…, nom, pays).
        const estMoyenPaiement = /no valid payment method/i.test(messageEchec);
        const compteStripe = estMoyenPaiement ? await recupererCompteStripe(stripeKey) : null;
        await notifierGestionnairesEchec(
          admin,
          resendKey,
          fromDomain,
          {
            artisanEmail: user.email ?? null,
            artisanId: user.id,
            offre,
            facturation: facturation === "annuel" ? "Annuelle (12 mois)" : "Mensuelle",
            montantLabel,
            message: messageEchec,
          },
          compteStripe,
        );
      }
      return json({ ok: false, error: messageEchec }, 502);
    }

    return json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
