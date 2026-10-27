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

/**
 * Interroge Resend pour connaitre le VERDICT REEL de livraison d'un email deja envoye.
 * Un envoi « accepte » (200) ne dit pas si le message a ete livre : cet appel recupere le
 * dernier evenement connu (delivered, bounced, complained, delivery_delayed, ...).
 * Reserve aux utilisateurs connectes (outil interne a l'application).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const brevoKey = (Deno.env.get("BREVO_API_KEY") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey && !brevoKey) {
      return json(
        { ok: false, error: "La configuration d'envoi (cle Brevo ou Resend) n'est pas disponible." },
        400,
      );
    }

    // Authentification obligatoire : l'outil reste interne a l'application.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Vous devez etre connecte." }, 401);

    const payload = await req.json().catch(() => null);
    const id = String(payload?.id ?? "").trim();
    if (!id) return json({ ok: false, error: "Identifiant d'email manquant." }, 400);

    // Les identifiants Brevo ont la forme « <…@smtp-relay.mailin.fr> » ; ceux de Resend sont des UUID.
    if (id.includes("@")) {
      if (!brevoKey) return json({ ok: false, error: "Cet email a été envoyé par Brevo, dont la clé n'est pas configurée." }, 400);
      const params = new URLSearchParams({ messageId: id, limit: "50", sort: "desc" });
      const resBrevo = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${params}`, {
        headers: { "api-key": brevoKey, Accept: "application/json" },
      });
      if (!resBrevo.ok) {
        const b = (await resBrevo.json().catch(() => null)) as { message?: string } | null;
        return json({ ok: false, error: b?.message || `Brevo n'a pas pu fournir l'etat de cet email (code ${resBrevo.status}).` }, 502);
      }
      const corps = (await resBrevo.json().catch(() => null)) as
        | { events?: Array<{ email?: string; date?: string; subject?: string; event?: string; from?: string }> }
        | null;
      const evenements = [...(corps?.events ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      // Vocabulaire Brevo → vocabulaire Resend attendu par l'application.
      const traduction: Record<string, string> = {
        requests: "sent", delivered: "delivered", opened: "opened", clicks: "clicked",
        hardBounces: "bounced", softBounces: "bounced", blocked: "bounced", invalid: "bounced",
        spam: "complained", deferred: "delivery_delayed",
      };
      const premier = evenements[0];
      const dernier = evenements[evenements.length - 1];
      return json({
        ok: true,
        id,
        to: premier?.email ?? null,
        from: premier?.from ?? null,
        subject: premier?.subject ?? null,
        createdAt: premier?.date ?? null,
        lastEvent: dernier?.event ? (traduction[dernier.event] ?? dernier.event) : null,
      });
    }
    if (!resendKey) return json({ ok: false, error: "Cet email a été envoyé par Resend, dont la clé n'est pas configurée." }, 400);

    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      const message =
        body?.message || `Resend n'a pas pu fournir l'etat de cet email (code ${res.status}).`;
      return json({ ok: false, error: message }, 502);
    }

    const body = (await res.json().catch(() => null)) as
      | {
          id?: string;
          to?: string | string[];
          from?: string;
          subject?: string;
          created_at?: string;
          last_event?: string;
        }
      | null;

    const to = Array.isArray(body?.to) ? body?.to[0] : body?.to;

    return json({
      ok: true,
      id: body?.id ?? id,
      to: to ?? null,
      from: body?.from ?? null,
      subject: body?.subject ?? null,
      createdAt: body?.created_at ?? null,
      lastEvent: body?.last_event ?? null,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
