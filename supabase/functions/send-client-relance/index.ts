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

/** Applique un modèle de message contenant des variables type {{client}}. */
function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

/**
 * Envoie une relance email rapide à un client, déclenchée en un clic depuis le widget
 * « Clients à suivre » (fiches marquées « À relancer »). L'email est expédié via Resend
 * avec l'identité de l'artisan, en utilisant l'objet et le corps personnalisés du profil
 * (ou un message ponctuel passé explicitement). L'envoi est tracé dans l'historique.
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
    const clientId = Number(payload?.clientId);
    const customMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
    const preview = payload?.preview === true;
    if (!clientId) return json({ ok: false, error: "Client introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const [clientRes, profileRes] = await Promise.all([
      admin.from("clients").select("id, user_id, nom, email").eq("id", clientId).maybeSingle(),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, email_sujet_relance, email_corps_relance")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (clientRes.error) return json({ ok: false, error: clientRes.error.message }, 500);
    const client = clientRes.data as { id?: number; user_id?: string; nom?: string; email?: string } | null;
    if (!client || client.user_id !== user.id) return json({ ok: false, error: "Client introuvable." }, 404);
    if (!preview && !client.email) {
      return json({ ok: false, error: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche." }, 400);
    }

    const profile = profileRes.data as
      | {
          entreprise?: string;
          metier?: string;
          telephone?: string;
          email?: string;
          email_sujet_relance?: string | null;
          email_corps_relance?: string | null;
        }
      | null;
    const emetteurNom = profile?.entreprise || profile?.metier || "Votre artisan";
    const contactLine = [profile?.telephone, profile?.email]
      .filter(Boolean)
      .map((v) => escapeHtml(v))
      .join(" · ");

    const templateValues: Record<string, string> = {
      client: client.nom ?? "",
      entreprise: emetteurNom,
    };

    // Message ponctuel prioritaire, sinon le corps personnalisé du profil, sinon un texte par défaut.
    const corpsModele = String(profile?.email_corps_relance ?? "").trim();
    const message =
      customMessage ||
      (corpsModele
        ? applyTemplate(corpsModele, templateValues)
        : `Bonjour ${client.nom ?? ""}, je me permets de vous recontacter au sujet de notre dossier. N'hésitez pas à revenir vers moi dès que vous le souhaitez.`);
    const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");

    // Objet personnalisé du profil, sinon un objet par défaut.
    const sujetModele = String(profile?.email_sujet_relance ?? "").trim();
    const subject = sujetModele ? applyTemplate(sujetModele, templateValues) : `Un mot de ${emetteurNom}`;

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
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    // Mode aperçu : on renvoie l'email exact (objet + HTML) sans rien envoyer.
    if (preview) return json({ ok: true, html, subject });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${emetteurNom} <noreply@${fromDomain}>`,
        to: [client.email],
        subject,
        html,
      }),
    });
    const resendData = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) return json({ ok: false, error: resendData?.message || "L'envoi de l'email a échoué." }, 502);

    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: null,
      devis_id: null,
      relance_id: null,
      type: "relance",
      canal: "email",
      mode: "reel",
      groupe: false,
      destinataire: client.email,
      sujet: subject,
    });

    // On horodate la dernière relance pour repérer les doubles envois rapprochés.
    await admin.from("clients").update({ derniere_relance_at: new Date().toISOString() }).eq("id", clientId);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});