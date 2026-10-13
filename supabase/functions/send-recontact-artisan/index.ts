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

interface Cible {
  to: string;
  entreprise: string;
  sujet: string;
  message: string;
}

interface Resultat {
  to: string;
  entreprise: string;
  ok: boolean;
  id: string | null;
  error?: string;
}

function buildHtml(message: string, entreprise: string): string {
  const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">ArtiFlow-pro</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Suivi de votre abonnement</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">${messageHtml}</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro${entreprise ? ` au sujet de ${escapeHtml(entreprise)}` : ""}.
      </div>
    </div>
  </div>
</body></html>`;
}

async function envoyer(cible: Cible, resendKey: string, fromDomain: string): Promise<Resultat> {
  const base: Resultat = { to: cible.to, entreprise: cible.entreprise, ok: false, id: null };
  if (!cible.to) return { ...base, error: "Aucune adresse email pour ce contact." };
  if (!EMAIL_RE.test(cible.to)) return { ...base, error: "Adresse email invalide." };
  if (!cible.message) return { ...base, error: "Le message est vide." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${fromDomain}>`,
        to: [cible.to],
        subject: cible.sujet,
        html: buildHtml(cible.message, cible.entreprise),
      }),
    });
    const resendData = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return { ...base, error: resendData?.message || "L'envoi de l'email a échoué." };
    }
    return { to: cible.to, entreprise: cible.entreprise, ok: true, id: resendData?.id ?? null };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Erreur inconnue." };
  }
}

/**
 * Envoi réel d'un (ou plusieurs) email(s) de recontact à des artisans très volatils,
 * directement depuis le back-office via le Backend (Resend). Réservé aux utilisateurs
 * connectés : la fonction vérifie le JWT de l'appelant avant tout envoi.
 *
 * Deux modes :
 * - unitaire : `{ to, entreprise, sujet, message }`
 * - groupé   : `{ recipients: [{ to, entreprise, sujet?, message? }], sujet, message }`
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey || !fromDomain) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Activez Resend (clé API + domaine) pour l'utiliser.",
        },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const sujetGlobal = String(payload?.sujet ?? "").trim();
    const messageGlobal = String(payload?.message ?? "").trim();

    const toCible = (raw: Record<string, unknown>): Cible => {
      const to = String(raw?.to ?? "").trim();
      const entreprise = String(raw?.entreprise ?? "").trim();
      const sujet =
        String(raw?.sujet ?? "").trim() ||
        sujetGlobal ||
        `Votre abonnement ArtiFlow-pro${entreprise ? ` — ${entreprise}` : ""}`;
      const message = String(raw?.message ?? "").trim() || messageGlobal;
      return { to, entreprise, sujet, message };
    };

    const recipientsRaw = Array.isArray(payload?.recipients)
      ? (payload?.recipients as Array<Record<string, unknown>>)
      : null;

    // Mode groupé : on renvoie toujours 200 avec le détail par destinataire.
    if (recipientsRaw) {
      if (recipientsRaw.length === 0) return json({ ok: false, error: "Aucun destinataire fourni." }, 400);
      const cibles = recipientsRaw.map((r) => toCible(r));

      if (!messageGlobal && cibles.every((c) => !c.message)) {
        return json({ ok: false, error: "Le message est vide." }, 400);
      }

      const results: Resultat[] = [];
      for (const cible of cibles) {
        results.push(await envoyer(cible, resendKey, fromDomain));
      }
      const envoyes = results.filter((r) => r.ok).length;
      return json({ ok: true, envoyes, total: results.length, results });
    }

    // Mode unitaire : comportement conservé (erreur HTTP en cas d'échec).
    const cible = toCible((payload ?? {}) as Record<string, unknown>);
    if (!cible.to) return json({ ok: false, error: "Aucune adresse email pour ce contact." }, 400);
    if (!cible.message) return json({ ok: false, error: "Le message est vide." }, 400);

    const resultat = await envoyer(cible, resendKey, fromDomain);
    if (!resultat.ok) return json({ ok: false, error: resultat.error || "L'envoi de l'email a échoué." }, 400);
    return json({ ok: true, id: resultat.id });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
