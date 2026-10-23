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

type EnvoiOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

/**
 * Envoie via Brevo, puis bascule automatiquement sur Resend si Brevo échoue.
 * Aucune alerte n'est perdue, même si Brevo est en incident. La tentative est
 * tracée dans `envoi_fournisseur_historique` pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; repli: boolean; error?: string }> {
  const trace = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* trace non bloquante */
    }
  };
  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
  let erreurBrevo = "";
  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc?.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment: opts.attachments?.length
            ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
            : undefined,
        }),
      });
      if (res.ok) {
        await trace("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await trace("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await trace("brevo", "echec", false, erreurBrevo);
    }
  }
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
  if (resendKey && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${opts.nom} <noreply@${fromDomain}>`,
          to: opts.to,
          cc: opts.cc?.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments?.length ? opts.attachments : undefined,
        }),
      });
      if (res.ok) {
        await trace("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }
  return { ok: false, fournisseur: "aucun", repli: false, error: erreurBrevo };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Seuil par défaut (en échecs consécutifs) si l'artisan n'en a pas choisi un autre. */
const SEUIL_DEFAUT = 3;
/** Seuils autorisés pour l'alerte, pour éviter toute valeur incohérente venue du client. */
const SEUILS_AUTORISES = [2, 3, 5];

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Enveloppe HTML commune à toutes les alertes (rendu cohérent). */
function buildEmail(params: {
  emetteurNom: string;
  badgeTone: "red" | "neutral";
  badgeText: string;
  intro: string;
  highlight: string | null;
  outro: string;
  footer: string;
}): string {
  const badgeBg = params.badgeTone === "red" ? "#fee2e2" : "#e4e4e7";
  const badgeColor = params.badgeTone === "red" ? "#b91c1c" : "#3f3f46";
  const boxBg = params.badgeTone === "red" ? "#fef2f2" : "#f4f4f5";
  const boxBorder = params.badgeTone === "red" ? "#fee2e2" : "#e4e4e7";
  const boxColor = params.badgeTone === "red" ? "#b91c1c" : "#3f3f46";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(params.emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Alerte de réessai d'envoi — ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:700;">${escapeHtml(params.badgeText)}</div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.7;color:#3f3f46;">${params.intro}</p>
        ${
          params.highlight
            ? `<div style="background:${boxBg};border:1px solid ${boxBorder};border-radius:10px;padding:14px;font-size:13px;color:${boxColor};line-height:1.6;">${params.highlight}</div>`
            : ""
        }
        <p style="margin:16px 0 0;font-size:13px;color:#71717a;line-height:1.6;">${params.outro}</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${escapeHtml(params.footer)}
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Alerte l'artisan par email lorsque ses réessais d'envoi restent en échec plusieurs fois de
 * suite. La décision est prise côté serveur (au moins `seuil` échecs consécutifs — seuil réglable
 * par l'artisan, 2/3/5, envoi unique au franchissement du seuil) pour éviter tout spam, et la clé
 * Resend reste protégée. Un mode « test » envoie un email de démonstration pour vérifier le rendu.
 * Réservé à l'utilisateur connecté (l'artisan ne peut alerter que sa propre boîte).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    // Seuil réglable (2 / 3 / 5) et mode test transmis par le client, validés côté serveur.
    let body: { seuil?: unknown; test?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const seuilDemande = Number(body?.seuil);
    const seuil = SEUILS_AUTORISES.includes(seuilDemande) ? seuilDemande : SEUIL_DEFAUT;
    const isTest = body?.test === true;

    // Authentification obligatoire : l'artisan ne peut déclencher une alerte que pour lui-même.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    // Si l'email n'est pas configuré, on ne bloque pas : on indique simplement qu'aucune
    // alerte n'a été envoyée (le réessai côté client reste fonctionnel).
    if (!resendKey || !fromDomain) {
      return json({ ok: true, sent: false, reason: "L'envoi d'email n'est pas configuré." });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, email")
      .eq("id", user.id)
      .maybeSingle();

    const emetteurNom = String(profile?.entreprise || profile?.metier || "Votre activité");
    const to = String(profile?.email ?? user.email ?? "").trim();
    if (!EMAIL_RE.test(to)) {
      return json({ ok: true, sent: false, reason: "Aucune adresse email valide dans votre profil." });
    }

    let subject: string;
    let html: string;

    if (isTest) {
      // Email de démonstration : même habillage que l'alerte réelle, pour valider le rendu.
      subject = "Test d'alerte ArtiFlow-pro — voici le rendu de votre email d'alerte";
      html = buildEmail({
        emetteurNom,
        badgeTone: "neutral",
        badgeText: "Email de test",
        intro:
          "Ceci est un <strong>email de démonstration</strong> : il reproduit exactement le rendu de l'alerte que vous recevrez si vos réessais d'envoi restent en échec. Aucune action n'est requise de votre part.",
        highlight: `Votre alerte se déclenchera au bout de <strong>${seuil} réessai${seuil > 1 ? "s" : ""} consécutif${seuil > 1 ? "s" : ""} resté${seuil > 1 ? "s" : ""} en échec</strong> (seuil réglable dans le bloc de surveillance).`,
        outro:
          "Si ce message s'affiche correctement, votre alerte est bien configurée. En cas de problème réel, vérifiez vos identifiants d'envoi (Resend pour l'email, Twilio pour le SMS / WhatsApp).",
        footer: "Email de test envoyé par ArtiFlow-pro.",
      });
    } else {
      // Derniers réessais de cet artisan (le plus récent en premier) pour compter les échecs
      // consécutifs. Un réessai est considéré en échec si des envois clients sont restés ratés.
      const { data: rows, error: rowsError } = await admin
        .from("reessais_envoi_historique")
        .select("id, relances_echouees, relances_relancees, fenetre_jours, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (rowsError) return json({ ok: false, error: rowsError.message }, 500);

      const historique = (rows ?? []) as Array<Record<string, unknown>>;
      let consecutifs = 0;
      for (const r of historique) {
        if (num(r.relances_echouees) > 0) consecutifs += 1;
        else break;
      }

      // On n'envoie l'alerte qu'au franchissement exact du seuil : une seule fois par série,
      // pour ne pas inonder la boîte si la config reste cassée plusieurs réessais d'affilée.
      if (consecutifs !== seuil) {
        return json({ ok: true, sent: false, streak: consecutifs, seuil });
      }

      const dernier = historique[0];
      const relancesEchouees = num(dernier?.relances_echouees);
      const fenetreJours = num(dernier?.fenetre_jours) || 1;
      const fenetreLabel = fenetreJours === 1 ? "24 h" : `${fenetreJours} j`;

      subject = `Alerte ArtiFlow-pro : ${consecutifs} réessais d'envoi restent en échec`;
      html = buildEmail({
        emetteurNom,
        badgeTone: "red",
        badgeText: "Envois toujours en échec",
        intro: `Vos <strong>${consecutifs} derniers réessais d'envoi</strong> n'ont toujours pas abouti : des relances clients restent bloquées. Tant que ce n'est pas réglé, vos clients ne reçoivent pas leurs messages.`,
        highlight: `Sur le dernier réessai (fenêtre ${escapeHtml(fenetreLabel)}) : ${relancesEchouees} envoi${relancesEchouees > 1 ? "s" : ""} encore en échec.`,
        outro:
          "Ouvrez ArtiFlow-pro et vérifiez vos identifiants d'envoi (Resend pour l'email, Twilio pour le SMS / WhatsApp), puis relancez un réessai depuis le bloc de surveillance des échecs.",
        footer: "Alerte automatique envoyée par ArtiFlow-pro.",
      });
    }

    try {
      const envoi = await envoyerEmailAvecRepli(
        "alerte-reessai-echec",
        { nom: emetteurNom, to: [to], subject, html },
        admin,
      );
      if (!envoi.ok) {
        return json({ ok: false, error: envoi.error || "L'envoi de l'alerte a échoué." }, 502);
      }
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Le service d'envoi est injoignable." }, 502);
    }

    return json({ ok: true, sent: true, test: isTest, seuil });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
