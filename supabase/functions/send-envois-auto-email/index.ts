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
 * Envoie à l'artisan (adresse de son profil) la synthèse CSV des envois automatiques
 * en pièce jointe. L'authentification et la clé Resend restent côté serveur.
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
    const csvBase64 = typeof payload?.csvBase64 === "string" ? payload.csvBase64 : "";
    const filename = typeof payload?.filename === "string" && payload.filename ? payload.filename : "envois-automatiques.csv";
    const nbItems = Number.isFinite(Number(payload?.nbItems)) ? Math.max(0, Number(payload.nbItems)) : 0;
    const aJour = Number.isFinite(Number(payload?.aJour)) ? Math.max(0, Number(payload.aJour)) : 0;
    const aVerifier = Number.isFinite(Number(payload?.aVerifier)) ? Math.max(0, Number(payload.aVerifier)) : 0;
    const inactifs = Number.isFinite(Number(payload?.inactifs)) ? Math.max(0, Number(payload.inactifs)) : 0;

    if (!csvBase64) return json({ ok: false, error: "La pièce jointe est vide." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, telephone, email")
      .eq("id", user.id)
      .maybeSingle();

    const emetteurNom = String(profile?.entreprise || profile?.metier || "Votre artisan");
    const to = String(profile?.email ?? user.email ?? "").trim();

    if (!EMAIL_RE.test(to)) {
      return json({ ok: false, error: "Aucune adresse email valide n'est renseignée dans votre profil." }, 400);
    }

    const subject = `Synthèse des envois automatiques (${nbItems} automatisation${nbItems > 1 ? "s" : ""})`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Synthèse de vos envois automatiques</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Voici la synthèse de vos envois automatiques, en pièce jointe au format CSV (ouvrable directement dans Excel).
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 18px;">
          <tr>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;">${aJour}</div>
              <div style="font-size:11px;color:#71717a;">à jour</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${aVerifier > 0 ? "#b94141" : "#18181b"};">${aVerifier}</div>
              <div style="font-size:11px;color:#71717a;">à vérifier</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;">${inactifs}</div>
              <div style="font-size:11px;color:#71717a;">inactive${inactifs > 1 ? "s" : ""}</div>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question.
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
      attachments: [{ filename, content: csvBase64, content_type: "text/csv" }],
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resendData = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) return json({ ok: false, error: resendData?.message || "L'envoi de l'email a échoué." }, 502);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
