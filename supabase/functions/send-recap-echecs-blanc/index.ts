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

/** Une automatisation rejouee en echec, telle que transmise par l'interface. */
interface EchecBlanc {
  /** Nom affiche de l'automatisation. */
  nom: string;
  /** Message d'erreur renvoye par le rejeu. */
  message: string;
}

/**
 * Envoie a l'artisan connecte un recapitulatif listant UNIQUEMENT les automatisations
 * qui ont echoue lors d'un rejeu global « test a blanc ». Sert de trace datee des rendus
 * restant a corriger avant publication. Le destinataire est TOUJOURS l'adresse de
 * l'artisan lui-meme (issue de son profil) : jamais un tiers. Reserve aux connectes.
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
    const brut = Array.isArray(payload?.echecs) ? payload.echecs : [];
    const echecs: EchecBlanc[] = brut
      .map((e: unknown) => {
        const o = (e ?? {}) as Record<string, unknown>;
        return {
          nom: String(o.nom ?? "").trim() || "Automatisation",
          message: String(o.message ?? "").trim(),
        };
      })
      .filter((e: EchecBlanc) => e.nom.length > 0);

    if (echecs.length === 0) {
      return json({ ok: false, error: "Aucune automatisation en échec à récapituler." }, 400);
    }
    const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : echecs.length;
    const dateRejeu = String(payload?.dateRejeu ?? "").trim() || new Date().toISOString();

    // Client service-role : lecture du profil (nom d'emetteur + adresse de destination).
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

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
        { ok: false, error: "Aucune adresse email n'est renseignée sur votre profil : impossible d'envoyer le récap." },
        400,
      );
    }

    const lignes = echecs
      .map(
        (e) => `<li style="margin:0 0 12px;padding:12px 14px;background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#b91c1c;">${escapeHtml(e.nom)}</p>
          ${
            e.message
              ? `<p style="margin:6px 0 0;font-size:12px;color:#7f1d1d;line-height:1.6;">${escapeHtml(e.message)}</p>`
              : ""
          }
        </li>`,
      )
      .join("");

    const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
    const subject = `Rejeux test à blanc — ${echecs.length} automatisation${echecs.length > 1 ? "s" : ""} en échec`;
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap des rejeux test à blanc en échec</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${echecs.length} échec${echecs.length > 1 ? "s" : ""} sur ${total} rejeu${total > 1 ? "x" : ""}
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici uniquement les automatisations dont le rejeu en test à blanc a échoué. Corrigez ces rendus
          avant de publier.
        </p>
        <ul style="margin:0;padding:0;list-style:none;">${lignes}</ul>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(new Date(dateRejeu).toLocaleString("fr-FR"))} et envoyé à ${escapeHtml(destinataire)}.
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
        body: JSON.stringify({ from: fromAddress, to: [destinataire], subject, html }),
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
