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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey || !fromDomain) {
      return json(
        { ok: false, error: "L'envoi d'email n'est pas encore configuré. Activez Resend (clé API + domaine) pour l'utiliser." },
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

    const body: Record<string, unknown> = {
      from: `${emetteurNom} <noreply@${fromDomain}>`,
      to: [to],
      subject,
      html,
    };
    if (pdfBase64) {
      body.attachments = [{ filename, content: pdfBase64 }];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resendData = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) return json({ ok: false, error: resendData?.message || "L'envoi de l'email a échoué." }, 502);

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
