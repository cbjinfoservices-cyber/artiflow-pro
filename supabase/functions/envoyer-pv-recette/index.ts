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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(`${String(value)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Envoi du PV de recette signé au client, avec le PDF (généré côté navigateur) en pièce jointe.
 * - L'appelant doit être connecté (JWT vérifié).
 * - Le PV est relu avec le client de l'utilisateur : les règles RLS garantissent qu'il lui
 *   appartient (patron propriétaire ou intervenant affecté). Un PV non signé est refusé.
 * - L'email part via Resend avec l'identité de l'entreprise.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const resendKey = (cleEnvoiEmail() ?? "").trim();
    const fromDomain = (domaineEnvoiEmail() ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey || !fromDomain) {
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré (Resend)." }, 400);
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
    const pvId = Number(payload?.pvId);
    const email = String(payload?.email ?? "").trim();
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename =
      typeof payload?.filename === "string" && payload.filename.trim()
        ? payload.filename.replace(/[^\w.-]/g, "-")
        : "PV-recette.pdf";
    const entreprise = String(payload?.entreprise ?? "").trim() || "Votre artisan";
    const intervenant = String(payload?.intervenant ?? "").trim();
    const objet = String(payload?.objet ?? "").trim();
    const dateIntervention = String(payload?.dateIntervention ?? "").trim();
    const ville = String(payload?.ville ?? "").trim();
    const clientNom = String(payload?.clientNom ?? "").trim();

    if (!Number.isFinite(pvId) || pvId <= 0) return json({ ok: false, error: "PV introuvable." }, 400);
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: "L'adresse email du client n'est pas valide." }, 400);
    }
    if (pdfBase64.length < 200) {
      return json({ ok: false, error: "Le PDF du PV est vide ou incomplet." }, 400);
    }

    // Relecture du PV avec le client utilisateur : RLS applique la propriété (patron / intervenant).
    const { data: pv, error: pvError } = await authClient
      .from("pv_recettes")
      .select("id, statut, client_nom, signe_le")
      .eq("id", pvId)
      .maybeSingle();
    if (pvError) return json({ ok: false, error: pvError.message }, 500);
    if (!pv) return json({ ok: false, error: "Ce PV est introuvable ou ne vous appartient pas." }, 404);
    if (String(pv.statut) !== "valide") {
      return json(
        { ok: false, error: "Le PV n'est pas encore signé : faites signer le client et validez-le avant l'envoi." },
        400,
      );
    }

    const nomClient = clientNom || String(pv.client_nom ?? "").trim() || "Madame, Monsieur";
    const details = [
      objet ? `Intervention : <strong>${escapeHtml(objet)}</strong>` : "",
      dateIntervention ? `Date : <strong>${escapeHtml(frDate(dateIntervention))}</strong>` : "",
      ville ? `Lieu : <strong>${escapeHtml(ville)}</strong>` : "",
      intervenant ? `Intervenant : <strong>${escapeHtml(intervenant)}</strong>` : "",
    ].filter(Boolean);

    const subject = `Votre PV de recette signé${objet ? ` — ${objet}` : ""}`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:#c4783a;"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#71717a;">Procès-verbal de recette d'intervention</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour ${escapeHtml(nomClient)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le procès-verbal de recette de l'intervention, signé sur place.
          Il récapitule les travaux réalisés, les points de conformité contrôlés, les éventuelles
          réserves, les photos du chantier terminé et votre signature.
        </p>
        ${
          details.length
            ? `<div style="background:#fafafa;border:1px solid #eee;border-left:4px solid #c4783a;border-radius:10px;padding:16px;font-size:13px;color:#71717a;margin:0 0 18px;">
                 ${details.map((l) => `<p style="margin:0 0 6px;">${l}</p>`).join("")}
               </div>`
            : ""
        }
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Le document PDF est en pièce jointe de cet email. Conservez-le : il fait foi de la
          réception des travaux.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Email envoyé via ArtiFlow-pro pour ${escapeHtml(entreprise)}.</p>
      </div>
    </div>
  </div>
</body></html>`;

    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${entreprise} <noreply@${fromDomain}>`,
        to: [email],
        subject,
        html,
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return json(
        { ok: false, error: data?.message || `Resend a refusé l'envoi (code ${res.status}).` },
        502,
      );
    }

    return json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});