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
    const relanceId = Number(payload?.relanceId);
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename = typeof payload?.filename === "string" && payload.filename ? payload.filename : "facture.pdf";
    const groupe = payload?.groupe === true;
    // Base publique du site (transmise par le front) pour rappeler le lien partagé du devis.
    const baseUrl = String(payload?.baseUrl ?? "").replace(/\/+$/, "");
    if (!relanceId) return json({ ok: false, error: "Relance introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: relance, error: relanceError } = await admin
      .from("relances")
      .select("id, devis_id, canal, statut, message, date_prevue")
      .eq("id", relanceId)
      .maybeSingle();
    if (relanceError) return json({ ok: false, error: relanceError.message }, 500);
    if (!relance) return json({ ok: false, error: "Relance introuvable." }, 404);

    const canal = String(relance.canal ?? "").toLowerCase();
    if (!canal.includes("mail")) {
      return json({ ok: false, error: "Cette relance n'est pas de type email." }, 400);
    }

    const { data: devis, error: devisError } = await admin
      .from("devis")
      .select("id, user_id, client_id, numero, objet, sign_token")
      .eq("id", relance.devis_id)
      .maybeSingle();
    if (devisError) return json({ ok: false, error: devisError.message }, 500);
    if (!devis || devis.user_id !== user.id) return json({ ok: false, error: "Relance introuvable." }, 404);

    // Lien public de consultation / signature du devis : c'est le « lien partagé » envoyé au client.
    const signToken = String((devis as { sign_token?: string | null }).sign_token ?? "");
    const signUrl = signToken && baseUrl ? `${baseUrl}/signature-devis/${signToken}` : "";

    const [clientRes, profileRes, factureRes] = await Promise.all([
      devis.client_id
        ? admin.from("clients").select("nom, email").eq("id", devis.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, email_sujet_relance")
        .eq("id", devis.user_id)
        .maybeSingle(),
      admin
        .from("factures")
        .select("id, numero, total_ttc, date_echeance")
        .eq("devis_id", devis.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const client = clientRes.data as { nom?: string; email?: string } | null;
    const profile = profileRes.data as
      | {
          entreprise?: string;
          metier?: string;
          telephone?: string;
          email?: string;
          email_sujet_relance?: string | null;
        }
      | null;
    const facture = factureRes.data as
      | { id?: number; numero?: string; total_ttc?: number; date_echeance?: string }
      | null;
    if (!client?.email) {
      return json({ ok: false, error: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche." }, 400);
    }

    const emetteurNom = profile?.entreprise || profile?.metier || "Votre artisan";
    const contactLine = [profile?.telephone, profile?.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");
    const message = String(relance.message ?? "").trim() || `Bonjour ${client.nom ?? ""}, un rappel concernant votre dossier.`;
    const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");

    const templateValues: Record<string, string> = {
      client: client.nom ?? "",
      entreprise: emetteurNom,
      numero: facture?.numero ?? devis.numero ?? "",
      objet: devis.objet ?? "",
      montant: facture ? euros(facture.total_ttc) : "",
      echeance: facture?.date_echeance ? frDate(facture.date_echeance) : "",
      lien: signUrl,
    };

    const customSubject = String(profile?.email_sujet_relance ?? "").trim();
    const subject = customSubject
      ? applyTemplate(customSubject, templateValues)
      : facture?.numero
        ? `Relance · Facture ${facture.numero}`
        : `Relance · Dossier ${devis.numero}`;

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
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${messageHtml}</p>
        ${
          facture?.numero
            ? `<div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:14px 16px;font-size:13px;">
                 <p style="margin:0 0 6px;color:#71717a;">Facture concernée : <strong style="color:#18181b;">${escapeHtml(
                   facture.numero,
                 )}</strong></p>
                 ${
                   facture.total_ttc != null
                     ? `<p style="margin:0 0 6px;color:#71717a;">Montant TTC : <strong style="color:#18181b;">${euros(
                         facture.total_ttc,
                       )}</strong></p>`
                     : ""
                 }
                 ${
                   facture.date_echeance
                     ? `<p style="margin:0;color:#71717a;">Échéance : <strong style="color:#18181b;">${frDate(
                         facture.date_echeance,
                       )}</strong></p>`
                     : ""
                 }
               </div>`
            : ""
        }
        ${
          pdfBase64
            ? `<p style="margin:16px 0 0;font-size:13px;color:#71717a;">La facture est jointe à cet email au format PDF.</p>`
            : ""
        }
        ${
          signUrl
            ? `<div style="text-align:center;margin:20px 0 0;">
                 <a href="${escapeHtml(signUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:600;">Consulter et signer le devis en ligne</a>
               </div>
               <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;text-align:center;word-break:break-all;">Rappel du lien partagé : ${escapeHtml(signUrl)}</p>`
            : ""
        }
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

    await admin.from("relances").update({ statut: "Envoyée" }).eq("id", relance.id);
    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: facture?.id ?? null,
      devis_id: devis.id,
      relance_id: relance.id,
      type: "relance",
      canal: "email",
      mode: "reel",
      groupe,
      destinataire: client.email,
      sujet: subject,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
