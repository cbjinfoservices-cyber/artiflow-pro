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

/** Normalise un numéro français vers le format E.164 attendu par Twilio. */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const smsFrom = Deno.env.get("TWILIO_SMS_FROM");
    const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    // 1) Vérification de l'appelant avec la clé anon uniquement.
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
    const canalRaw = String(payload?.canal ?? "").toLowerCase();
    const groupe = payload?.groupe === true;
    const isWhatsapp = canalRaw.includes("whats");
    const isSms = canalRaw.includes("sms");
    if (!relanceId) return json({ ok: false, error: "Relance introuvable." }, 400);
    if (!isWhatsapp && !isSms) return json({ ok: false, error: "Canal non pris en charge." }, 400);

    if (!twilioSid || !twilioToken) {
      return json(
        {
          ok: false,
          error:
            "L'envoi SMS/WhatsApp n'est pas encore configuré. Ajoutez vos identifiants Twilio (Account SID + Auth Token) pour l'utiliser.",
        },
        400,
      );
    }
    const fromNumber = isWhatsapp ? whatsappFrom : smsFrom;
    if (!fromNumber) {
      return json({ ok: false, error: "Numéro d'envoi Twilio manquant pour ce canal." }, 400);
    }

    // 2) Opérations privilégiées avec la clé service.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: relance, error: relanceError } = await admin
      .from("relances")
      .select("id, devis_id, canal, message")
      .eq("id", relanceId)
      .maybeSingle();
    if (relanceError) return json({ ok: false, error: relanceError.message }, 500);
    if (!relance) return json({ ok: false, error: "Relance introuvable." }, 404);

    const { data: devis, error: devisError } = await admin
      .from("devis")
      .select("id, user_id, client_id, numero")
      .eq("id", relance.devis_id)
      .maybeSingle();
    if (devisError) return json({ ok: false, error: devisError.message }, 500);
    if (!devis || devis.user_id !== user.id) return json({ ok: false, error: "Relance introuvable." }, 404);

    const { data: client } = devis.client_id
      ? await admin.from("clients").select("nom, telephone").eq("id", devis.client_id).maybeSingle()
      : { data: null };

    const telephone = (client as { telephone?: string } | null)?.telephone ?? "";
    const to = toE164(telephone);
    if (!to) {
      return json(
        { ok: false, error: "Ce client n'a pas de numéro de téléphone valide. Ajoutez-le dans sa fiche pour envoyer un SMS." },
        400,
      );
    }

    const corps =
      String(relance.message ?? "").trim() ||
      `Bonjour ${(client as { nom?: string } | null)?.nom ?? ""}, un rappel concernant votre dossier.`;

    const toAddr = isWhatsapp ? `whatsapp:${to}` : to;
    const fromAddr = isWhatsapp ? `whatsapp:${fromNumber}` : fromNumber;

    const form = new URLSearchParams();
    form.set("To", toAddr);
    form.set("From", fromAddr);
    form.set("Body", corps);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const twilioData = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) return json({ ok: false, error: twilioData?.message || "L'envoi du message a échoué." }, 502);

    const canalLabel = isWhatsapp ? "whatsapp" : "sms";

    await admin.from("relances").update({ statut: "Envoyée" }).eq("id", relance.id);
    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: null,
      devis_id: devis.id,
      relance_id: relance.id,
      type: "relance",
      canal: canalLabel,
      mode: "reel",
      groupe,
      destinataire: to,
      sujet: corps.slice(0, 120),
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
