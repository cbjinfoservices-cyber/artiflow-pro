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

/**
 * Envoie a l'artisan connecte une copie de son export CSV par email, en piece jointe,
 * afin de conserver une trace datee hors du navigateur. Le destinataire est TOUJOURS
 * l'adresse de l'artisan lui-meme (issue de son profil) : jamais un tiers. Reserve aux
 * utilisateurs connectes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey || !fromDomain) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Activez Resend (clé API + domaine vérifié) puis relancez le diagnostic.",
        },
        400,
      );
    }

    // Authentification obligatoire (l'outil reste interne a l'application).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const contentBase64 = String(payload?.contentBase64 ?? "").trim();
    if (!contentBase64) {
      return json({ ok: false, error: "Aucun contenu CSV à envoyer." }, 400);
    }
    const filename = String(payload?.filename ?? "export.csv").replace(/[^\w.\-]/g, "_") || "export.csv";
    const subject = String(payload?.subject ?? "").trim() || "Votre export ArtiFlow-pro";

    // Client service-role : lecture du profil (nom d'emetteur + adresse de destination).
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    // Nom d'emetteur : l'entreprise du profil si disponible, sinon un libelle generique.
    // La destination est TOUJOURS l'adresse de l'artisan : on n'envoie jamais a un tiers.
    let emetteurNom = "ArtiFlow-pro";
    let destinataire = String(user.email ?? "").trim();
    if (admin) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("entreprise, metier, email")
          .eq("id", user.id)
          .maybeSingle();
        const nom = (profile?.entreprise || profile?.metier || "").trim();
        if (nom) emetteurNom = nom;
        destinataire = String(profile?.email ?? "").trim() || destinataire;
      } catch {
        /* le nom d'emetteur n'est pas bloquant */
      }
    }

    if (!destinataire) {
      return json(
        { ok: false, error: "Aucune adresse email n'est renseignée sur votre profil : impossible d'envoyer l'export." },
        400,
      );
    }

    const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Votre export ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici votre export en pièce jointe, pour conserver une trace datée hors du navigateur.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:14px;font-size:13px;color:#3f3f46;">
          Pièce jointe : <strong>${escapeHtml(filename)}</strong>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Cet export a été envoyé à ${escapeHtml(destinataire)} le ${escapeHtml(new Date().toLocaleString("fr-FR"))}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    let res: Response;
    let resendData: { id?: string; message?: string } | null;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: [destinataire],
          subject,
          html,
          attachments: [{ filename, content: contentBase64 }],
        }),
      });
      resendData = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    } catch (netErr) {
      const erreur = netErr instanceof Error ? netErr.message : "Le service d'envoi est injoignable.";
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const erreur = resendData?.message || `L'API Resend a refusé l'envoi (code ${res.status}).`;
      return json({ ok: false, error: erreur }, 502);
    }

    return json({ ok: true, id: resendData?.id ?? null, to: destinataire });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
