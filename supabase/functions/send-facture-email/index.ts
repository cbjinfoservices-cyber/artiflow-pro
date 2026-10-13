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

function euros(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function frDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => values[key.toLowerCase()] ?? "");
}

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
    const factureId = Number(payload?.factureId);
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename = typeof payload?.filename === "string" && payload.filename ? payload.filename : "facture.pdf";
    if (!factureId) return json({ ok: false, error: "Facture introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: facture, error: factureError } = await admin
      .from("factures")
      .select("id, user_id, devis_id, client_id, numero, statut, total_ht, total_ttc, date_emission, date_echeance")
      .eq("id", factureId)
      .maybeSingle();
    if (factureError) return json({ ok: false, error: factureError.message }, 500);
    if (!facture || facture.user_id !== user.id) return json({ ok: false, error: "Facture introuvable." }, 404);

    const [clientRes, profileRes, devisRes] = await Promise.all([
      facture.client_id
        ? admin.from("clients").select("nom, email").eq("id", facture.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, email_sujet_facture, email_corps_facture")
        .eq("id", facture.user_id)
        .maybeSingle(),
      facture.devis_id
        ? admin.from("devis").select("numero, objet").eq("id", facture.devis_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const client = clientRes.data as { nom?: string; email?: string } | null;
    const profile = profileRes.data as
      | {
          entreprise?: string;
          metier?: string;
          telephone?: string;
          email?: string;
          email_sujet_facture?: string | null;
          email_corps_facture?: string | null;
        }
      | null;
    const devis = devisRes.data as { numero?: string; objet?: string } | null;
    if (!client?.email) {
      return json({ ok: false, error: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche." }, 400);
    }

    const emetteurNom = profile?.entreprise || profile?.metier || "Votre artisan";
    const contactLine = [profile?.telephone, profile?.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");

    const templateValues: Record<string, string> = {
      client: client.nom ?? "",
      entreprise: emetteurNom,
      numero: facture.numero ?? "",
      objet: devis?.objet ?? "",
      montant: euros(facture.total_ttc),
      echeance: frDate(facture.date_echeance),
    };

    const customSubject = String(profile?.email_sujet_facture ?? "").trim();
    const subject = customSubject ? applyTemplate(customSubject, templateValues) : `Votre facture ${facture.numero}`;

    const customBody = String(profile?.email_corps_facture ?? "").trim();
    const introHtml = customBody
      ? escapeHtml(applyTemplate(customBody, templateValues)).replace(/\n/g, "<br>")
      : `Veuillez trouver ci-joint votre facture <strong>${escapeHtml(facture.numero)}</strong>${
          devis?.objet ? ` au titre de « ${escapeHtml(devis.objet)} »` : ""
        }. Le document PDF est en pièce jointe de cet email.`;

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
        ${
          customBody
            ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${introHtml}</p>`
            : `<p style="margin:0 0 12px;font-size:15px;">Bonjour ${escapeHtml(client.nom ?? "")},</p>
               <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${introHtml}</p>`
        }
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Numéro : <strong style="color:#18181b;">${escapeHtml(facture.numero)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Émise le : <strong style="color:#18181b;">${frDate(facture.date_emission)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Échéance : <strong style="color:#18181b;">${frDate(facture.date_echeance)}</strong></p>
          <p style="margin:0;color:#71717a;">Montant total TTC : <strong style="color:#18181b;">${euros(facture.total_ttc)}</strong></p>
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

    const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
    const body: Record<string, unknown> = {
      from: fromAddress,
      to: [client.email],
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
      facture_id: facture.id,
      devis_id: facture.devis_id ?? null,
      type: "facture",
      mode: "reel",
      destinataire: client.email,
      sujet: subject,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
