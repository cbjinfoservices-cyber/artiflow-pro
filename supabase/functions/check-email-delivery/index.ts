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

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey) {
      return json(
        { ok: false, error: "La configuration d'envoi (cle Resend) n'est pas disponible." },
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
