/**
 * Diagnostic en lecture seule de la configuration Stripe.
 *
 * Objectif : savoir si le compte Stripe est capable d'encaisser une carte bancaire
 * en euros (EUR) AVANT qu'un client clique sur « S'abonner », afin d'afficher un
 * bandeau d'information sur la page Tarifs plutôt qu'une erreur brute au moment
 * du paiement.
 *
 * Aucune écriture ni création d'objet Stripe : uniquement des appels GET.
 * En cas de doute (une information indisponible), on répond « disponible » afin
 * de ne jamais bloquer inutilement l'affichage d'un bandeau.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Compte gestionnaire principal : toujours prévenu, même sans ligne en base. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

/** Anti-spam : pas plus d'une alerte de configuration toutes les 6 heures. */
const INTERVALLE_ALERTE_MS = 6 * 60 * 60 * 1000;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frDateTime(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Rassemble les adresses email des gestionnaires (principal + table gestionnaires). */
async function adressesGestionnaires(admin: Admin): Promise<string[]> {
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

/** Construit l'email d'alerte envoyé aux gestionnaires quand la config Stripe est incomplète. */
function buildAlerteHtml(
  motif: string,
  pays: string,
  destinataires: string[],
  detail?: Record<string, unknown>,
): string {
  const cause =
    motif === "pays"
      ? "Le pays du compte Stripe n'accepte pas encore la carte en euros (EUR), ou la carte n'est pas supportée pour ce pays."
      : "La carte bancaire n'est pas activée dans la configuration des moyens de paiement du compte Stripe (ou elle est réglée sur « masquée »).";
  const origine = motif === "pays" ? "Pays / devise" : "Carte non activée";
  const ouiNon = (v: unknown) => (v === true ? "oui" : v === false ? "non" : "—");
  const detailRows = detail
    ? `<tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Compte activé (charges)</td><td style="padding:6px 10px;font-size:13px;color:#18181b;font-weight:700;">${ouiNon(detail.chargesActives)}</td></tr>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Carte « disponible »</td><td style="padding:6px 10px;font-size:13px;color:#18181b;">${ouiNon(detail.carteDisponible)}</td></tr>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Préférence d'affichage carte</td><td style="padding:6px 10px;font-size:13px;color:#18181b;">${escapeHtml(String(detail.cartePreference ?? "") || "—")}</td></tr>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">EUR supporté par le pays</td><td style="padding:6px 10px;font-size:13px;color:#18181b;">${ouiNon(detail.eurSupportee)}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;border:1px solid #fecaca;padding:24px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#b91c1c;">Configuration de paiement incomplète</p>
      <p style="margin:0 0 16px;font-size:13px;color:#71717a;">ArtiFlow-pro · alerte automatique</p>
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;">
        Paiement par carte en euros (EUR) indisponible
      </div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
        Le diagnostic a détecté qu'un client ne peut pas ouvrir la page de paiement Stripe. ${escapeHtml(cause)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tbody>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Origine détectée</td><td style="padding:6px 10px;font-size:13px;color:#18181b;font-weight:700;">${escapeHtml(origine)}</td></tr>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Pays du compte Stripe</td><td style="padding:6px 10px;font-size:13px;color:#18181b;">${escapeHtml(pays || "—")}</td></tr>
          <tr><td style="padding:6px 10px;font-size:12px;color:#71717a;">Détecté le</td><td style="padding:6px 10px;font-size:13px;color:#18181b;">${escapeHtml(frDateTime(new Date().toISOString()))}</td></tr>
          ${detailRows}
        </tbody>
      </table>
      <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
        <strong>À faire :</strong> ouvrez Stripe → Paramètres → Moyens de paiement, activez « Carte » pour l'euro (EUR) et vérifiez que le compte est bien activé. Le bandeau disparaît automatiquement une fois la configuration corrigée.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
        Alerte envoyée à ${escapeHtml(destinataires.join(", "))}. Tant que le problème persiste, elle n'est renvoyée qu'au maximum une fois toutes les 6 heures.
      </p>
    </div>
  </div>
</body></html>`;
}

/**
 * Prévient les gestionnaires par email dès que le diagnostic détecte une configuration
 * Stripe incomplète. Anti-spam : au maximum un envoi toutes les 6 heures. Fonction
 * best-effort : une erreur d'envoi ne doit jamais casser le diagnostic.
 */
async function alerterConfigStripeIncomplete(
  motif: string,
  pays: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
    if (!supabaseUrl || !serviceKey) return;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: derniers } = await admin
      .from("alerte_config_stripe")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const dernier = Array.isArray(derniers) && derniers[0] ? String(derniers[0].created_at ?? "") : "";
    const t = dernier ? new Date(dernier).getTime() : 0;
    if (t && Date.now() - t < INTERVALLE_ALERTE_MS) return;

    if (!resendKey || !fromDomain) return;
    const destinataires = await adressesGestionnaires(admin);
    if (destinataires.length === 0) return;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${fromDomain}>`,
        to: destinataires,
        subject: "Alerte · configuration du paiement Stripe incomplète",
        html: buildAlerteHtml(motif, pays, destinataires, detail),
      }),
    });
    if (!res.ok) return;
    await admin.from("alerte_config_stripe").insert({ motif, pays, destinataires, detail });
  } catch {
    /* best-effort : l'alerte ne doit jamais casser le diagnostic */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      // Stripe non connecté : on ne peut pas diagnostiquer, on ne bloque rien.
      return json({ ok: true, eurDisponible: true, motif: "", pays: "", mode: "" });
    }

    // Mode de la clé branchée : « test » (sk_test_…), « live » (sk_live_…) ou inconnu.
    // Affiché dans le back-office pour savoir d'un coup d'œil sur quel mode la clé opère.
    const mode = stripeKey.startsWith("sk_test_")
      ? "test"
      : stripeKey.startsWith("sk_live_")
      ? "live"
      : "";

    const enTetes = { Authorization: `Bearer ${stripeKey}` };

    // 1) Pays du compte + état d'activation (charges activées ou non).
    //    Le pays sert ensuite à interroger les contraintes de ce pays ; l'activation sert
    //    au diagnostic détaillé (un compte restreint rend la carte « indisponible »).
    let pays = "";
    let chargesActives = true;
    // Identifiant du compte Stripe réellement interrogé (acct_…). Affiché dans le
    // back-office pour vérifier que la clé branchée pointe vers LE BON compte :
    // activer la carte dans le Dashboard ne sert à rien si la clé vise un autre compte.
    let compteId = "";
    // Nom commercial du compte Stripe (boutique / entreprise) : affiché en clair dans le
    // back-office aux côtés du pays et de l'état d'activation, pour identifier le compte
    // que la clé branchée interroge réellement.
    let compteNom = "";
    try {
      const reponse = await fetch("https://api.stripe.com/v1/account", { headers: enTetes });
      const compte = (await reponse.json().catch(() => null)) as
        | {
            id?: string;
            country?: string;
            charges_enabled?: boolean;
            business_profile?: { name?: string };
            settings?: { dashboard?: { display_name?: string } };
          }
        | null;
      compteId = String(compte?.id ?? "");
      compteNom =
        String(compte?.business_profile?.name ?? "").trim() ||
        String(compte?.settings?.dashboard?.display_name ?? "").trim();
      pays = String(compte?.country ?? "").toLowerCase();
      if (compte && typeof compte.charges_enabled === "boolean") chargesActives = compte.charges_enabled;
    } catch {
      /* pays indisponible : on continuera sans cette vérification */
    }

    // 2) Contraintes du pays : l'euro et la carte sont-ils supportés ?
    let eurSupportee = true;
    let carteSupporteePays = true;
    if (pays) {
      try {
        const reponse = await fetch(`https://api.stripe.com/v1/country_specs/${pays}`, { headers: enTetes });
        const spec = (await reponse.json().catch(() => null)) as
          | { supported_payment_currencies?: unknown[]; supported_payment_methods?: unknown[] }
          | null;
        const devises = Array.isArray(spec?.supported_payment_currencies)
          ? spec!.supported_payment_currencies.map((d) => String(d).toLowerCase())
          : [];
        const moyens = Array.isArray(spec?.supported_payment_methods)
          ? spec!.supported_payment_methods.map((m) => String(m).toLowerCase())
          : [];
        if (devises.length > 0) eurSupportee = devises.includes("eur");
        if (moyens.length > 0) carteSupporteePays = moyens.includes("card");
      } catch {
        /* contraintes indisponibles : on suppose que c'est supporté */
      }
    }

    // 3) Configuration des moyens de paiement du compte : la carte est-elle activée ?
    //    On conserve le détail (disponibilité + préférence d'affichage) pour le diagnostic.
    let carteActive = true;
    let carteDisponible = true;
    let cartePreference = "";
    try {
      const reponse = await fetch("https://api.stripe.com/v1/payment_method_configurations?limit=10", {
        headers: enTetes,
      });
      const config = (await reponse.json().catch(() => null)) as { data?: unknown[] } | null;
      const liste = Array.isArray(config?.data) ? (config!.data as Record<string, any>[]) : [];
      if (liste.length > 0) {
        const defaut = liste.find((c) => c?.is_default) ?? liste[0];
        const carte = defaut?.card as Record<string, any> | undefined;
        if (carte && typeof carte === "object") {
          // Fail-safe : on ne considère la carte « indisponible » que si Stripe le dit
          // EXPLICITEMENT (available === false). Un champ `available` absent ne doit jamais
          // provoquer un faux « indisponible » qui masquerait un paiement pourtant fonctionnel.
          carteDisponible = carte.available !== false;
          cartePreference = String(carte?.display_preference?.preference ?? "");
          // La carte est active sauf si elle est explicitement réglée sur « off ».
          carteActive = carteDisponible && cartePreference !== "off";
        }
      }
    } catch {
      /* configuration indisponible : on suppose que la carte est active */
    }

    const eurDisponible = eurSupportee && carteSupporteePays && carteActive;
    let motif = "";
    if (!eurSupportee || !carteSupporteePays) motif = "pays";
    else if (!carteActive) motif = "carte";

    // Détail de chaque contrôle : permet au back-office d'afficher PILE ce qui bloque
    // (devise/pays, carte non supportée, compte non activé, carte désactivée à l'affichage)
    // et d'enregistrer le détail brut dans l'alerte pour diagnostiquer plus vite ensuite.
    const detail = {
      eurSupportee,
      carteSupporteePays,
      carteActive,
      carteDisponible,
      cartePreference,
      chargesActives,
      pays,
      compteId,
      compteNom,
    };

    // Configuration incomplète détectée : on prévient les gestionnaires par email
    // (au maximum une fois toutes les 6 heures, voir alerterConfigStripeIncomplete).
    if (!eurDisponible) {
      await alerterConfigStripeIncomplete(motif, pays, detail);
    }

    return json({ ok: true, eurDisponible, motif, pays, detail, mode, compteId, compteNom });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
