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

function euros(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Envoie au comptable la fiche PDF « factures rejetées à corriger » (numéro, client,
 * motif, montant) générée depuis le registre de facturation électronique, avec un
 * message d'accompagnement facultatif. L'envoi est tracé dans `envois_email`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);

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
    const ccRaw = String(payload?.cc ?? "").trim();
    const cc = ccRaw && emailValide(ccRaw) ? [ccRaw] : [];
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename =
      typeof payload?.filename === "string" && payload.filename ? payload.filename : "rejets-factures-electroniques.pdf";
    const moisLabel = String(payload?.moisLabel ?? "").trim() || "Tous les mois";
    const nbRejets = Number(payload?.nbRejets ?? 0) || 0;
    const montantTtc = Number(payload?.montantTtc ?? 0) || 0;
    const entreprise = String(payload?.entreprise ?? "").trim() || "Votre artisan";
    const message = String(payload?.message ?? "").trim().slice(0, 500);

    if (!emailValide(to)) {
      return json({ ok: false, error: "Renseignez l'adresse email de votre comptable." }, 400);
    }
    if (!pdfBase64) {
      return json({ ok: false, error: "La fiche des rejets n'a pas pu être générée." }, 400);
    }

    const resendKey = (cleEnvoiEmail() ?? "").trim();
    const fromDomain = (domaineEnvoiEmail() ?? "").trim();
    if (!resendKey || !fromDomain) {
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré (Resend)." }, 400);
    }

    const subject = `Factures électroniques rejetées à corriger — ${moisLabel}`;
    const intro = message
      ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>`
      : `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">Bonjour,<br>Vous trouverez ci-joint la liste des factures électroniques rejetées à corriger. Merci d'avance pour votre aide sur ces pièces.</p>`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:#C4783A;"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Fiche des factures rejetées à corriger</p>
      </div>
      <div style="padding:24px;">
        ${intro}
        <div style="background:#fafafa;border:1px solid #eee;border-left:4px solid #C4783A;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Période : <strong style="color:#18181b;">${escapeHtml(moisLabel)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Factures rejetées : <strong style="color:#18181b;">${nbRejets}</strong></p>
          <p style="margin:0;color:#71717a;">Montant TTC bloqué : <strong style="color:#18181b;">${euros(montantTtc)}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          La fiche en pièce jointe liste, pour chaque facture, le numéro, le client, le motif du rejet et le montant.
          Une colonne « Fait » permet de cocher les corrections au fur et à mesure.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(entreprise)}.
      </div>
    </div>
  </div>
</body></html>`;

    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${entreprise} <noreply@${fromDomain}>`,
        to: [to],
        cc: cc.length ? cc : undefined,
        subject,
        html,
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return json({ ok: false, error: data?.message || "L'envoi de l'email a échoué." }, 502);
    }

    // Trace de l'envoi : visible dans l'historique des envois au comptable.
    try {
      await authClient.from("envois_email").insert({
        user_id: user.id,
        type: "comptable",
        canal: "Email",
        groupe: false,
        mode: "reel",
        destinataire: to,
        sujet: subject,
        pieces: "fiche-rejets-factures-electroniques",
      });
    } catch {
      /* la trace ne doit jamais bloquer l'envoi */
    }

    return json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
