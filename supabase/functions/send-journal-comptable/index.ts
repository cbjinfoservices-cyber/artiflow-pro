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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas. Le PDF du journal comptable suit dans les deux cas.
 * Chaque tentative est tracée pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: {
    nom: string;
    to: string[];
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: string }>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; repli: boolean; error?: string }> {
  const tracer = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* la trace ne doit jamais bloquer un envoi */
    }
  };

  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
  let erreurBrevo = "";

  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          subject: opts.subject,
          htmlContent: opts.html,
          attachment: opts.attachments && opts.attachments.length
            ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
            : undefined,
        }),
      });
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await tracer("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await tracer("brevo", "echec", false, erreurBrevo);
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
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments && opts.attachments.length ? opts.attachments : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: false };
      }
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }

  return { ok: false, fournisseur: "aucun", repli: false, error: "Aucun service d'envoi configuré (Resend non paramétré)." };
}

/**
 * Envoie à son comptable le journal comptable consolidé d'une période (devis, factures
 * et paiements), avec le PDF complet en pièce jointe. Déclenché depuis la page
 * Comptabilité. L'authentification et la clé Resend restent côté serveur.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
    const repliConfigure = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("RESEND_FROM_DOMAIN"));

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!brevoKey && !repliConfigure) {
      return json(
        { ok: false, error: "L'envoi d'email n'est pas encore configuré. Paramétrez Resend pour l'utiliser." },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const to = String(payload?.to ?? "").trim();
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename = typeof payload?.filename === "string" && payload.filename ? payload.filename : "journal-comptable.pdf";
    const periodeLabel = String(payload?.periodeLabel ?? "Toutes périodes");
    const clientLabel = typeof payload?.clientLabel === "string" ? payload.clientLabel.trim() : "";
    const customMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
    const nbLignes = Number.isFinite(Number(payload?.lignes)) ? Math.max(0, Number(payload.lignes)) : null;

    if (!EMAIL_RE.test(to)) return json({ ok: false, error: "L'adresse du comptable est invalide." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, telephone, email")
      .eq("id", user.id)
      .maybeSingle();

    const emetteurNom = String(profile?.entreprise || profile?.metier || "Votre artisan");
    const contactLine = [profile?.telephone, profile?.email]
      .filter(Boolean)
      .map((v) => escapeHtml(v))
      .join(" · ");

    const filtreTexte = clientLabel ? `${periodeLabel} · ${clientLabel}` : periodeLabel;
    const introTexte = customMessage
      ? escapeHtml(customMessage).replace(/\n/g, "<br>")
      : `Veuillez trouver ci-joint le journal comptable consolidé de la période <strong>${escapeHtml(filtreTexte)}</strong> : devis, factures et paiements réunis dans un seul document, avec la TVA collectée par taux.`;

    const subject = `Journal comptable — ${filtreTexte}`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${introTexte}</p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Période : <strong style="color:#18181b;">${escapeHtml(periodeLabel)}</strong></p>
          ${clientLabel ? `<p style="margin:0 0 6px;color:#71717a;">Client : <strong style="color:#18181b;">${escapeHtml(clientLabel)}</strong></p>` : ""}
          <p style="margin:0;color:#71717a;">Pièce jointe : <strong style="color:#18181b;">${escapeHtml(filename)}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question. Merci de votre confiance.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    // Envoi Brevo d'abord, repli automatique sur Resend si Brevo refuse ou ne répond pas.
    const envoi = await envoyerEmailAvecRepli(
      "send-journal-comptable",
      {
        nom: emetteurNom,
        to: [to],
        subject,
        html,
        attachments: pdfBase64 ? [{ filename, content: pdfBase64 }] : undefined,
      },
      admin,
    );
    if (!envoi.ok) return json({ ok: false, error: envoi.error || "L'envoi de l'email a échoué." }, 502);

    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: null,
      devis_id: null,
      relance_id: null,
      type: "comptable",
      canal: "email",
      groupe: false,
      destinataire: to,
      sujet: subject,
      mode: "manuel",
      nb_lignes: nbLignes,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
