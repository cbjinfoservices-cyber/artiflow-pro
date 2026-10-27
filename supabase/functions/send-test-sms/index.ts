import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envoyerMessage, messagerieConfiguree, messageNonConfigure } from "../_shared/envoiMessage.ts";

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

/** Normalise un numéro français (ou international) vers le format E.164 attendu par Twilio. */
function toE164(raw: unknown, defaultCountry = "+33"): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Envoie un SMS ou WhatsApp de TEST vers un numéro saisi à la volée, afin de valider
 * la configuration d'envoi (Brevo, ou Twilio en repli) sans créer de relance. Réservé aux utilisateurs connectés.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    // 1) Authentification de l'appelant avec la clé anon uniquement.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const canalRaw = String(payload?.canal ?? "SMS").toLowerCase();
    const isWhatsapp = canalRaw.includes("whats");
    const isSms = canalRaw.includes("sms");
    if (!isWhatsapp && !isSms) return json({ ok: false, error: "Canal non pris en charge." }, 400);

    const to = toE164(payload?.telephone);
    if (!to) {
      return json(
        { ok: false, error: "Renseignez un numéro de téléphone valide (ex. 06 12 34 56 78 ou +33612345678)." },
        400,
      );
    }

    const canal = isWhatsapp ? "whatsapp" : "sms";
    if (!messagerieConfiguree(canal)) return json({ ok: false, error: messageNonConfigure(canal) }, 400);

    const canalLabel = isWhatsapp ? "WhatsApp" : "SMS";
    const corps =
      String(payload?.message ?? "").trim() ||
      `Test ${canalLabel} ArtiFlow-pro : votre configuration d'envoi fonctionne. Vous pouvez relancer vos clients par ${canalLabel}.`;

    const envoi = await envoyerMessage(canal, to, corps);
    if (!envoi.ok) return json({ ok: false, error: envoi.error || "L'envoi du message a échoué." }, 502);

    return json({ ok: true, to, canal: canalLabel, fournisseur: envoi.fournisseur });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
