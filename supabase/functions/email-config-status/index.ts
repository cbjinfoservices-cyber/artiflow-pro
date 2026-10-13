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

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  region?: string;
}

/**
 * Diagnostic de la configuration d'envoi d'emails (Resend).
 * Ne renvoie JAMAIS la valeur de la clé : seulement sa presence, le domaine configure,
 * et l'etat de verification reel obtenu en interrogeant l'API Resend.
 * Reserve aux utilisateurs connectes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    // Authentification obligatoire (le diagnostic reste interne a l'application).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Vous devez etre connecte." }, 401);

    const keyPresent = resendKey.length > 0;
    const domainPresent = fromDomain.length > 0;

    // Interrogation de l'API Resend pour connaitre l'etat reel des domaines.
    let apiReachable = false;
    let apiError: string | null = null;
    const domains: ResendDomain[] = [];
    let domainStatus: string | null = null;

    if (keyPresent) {
      try {
        const res = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        if (res.ok) {
          apiReachable = true;
          const body = (await res.json().catch(() => null)) as { data?: ResendDomain[] } | null;
          for (const d of body?.data ?? []) {
            domains.push({ id: d.id, name: d.name, status: d.status, region: d.region });
          }
          if (domainPresent) {
            const match = domains.find((d) => d.name.toLowerCase() === fromDomain.toLowerCase());
            domainStatus = match ? match.status : "not_found";
          }
        } else {
          const b = (await res.json().catch(() => null)) as { message?: string } | null;
          apiError = b?.message || `L'API Resend a repondu avec le code ${res.status}.`;
        }
      } catch (e) {
        apiError = e instanceof Error ? e.message : "Impossible de joindre l'API Resend.";
      }
    }

    const fromAddress = domainPresent ? `noreply@${fromDomain}` : null;
    const ready = keyPresent && domainPresent && domainStatus === "verified";

    // Verification de l'enregistrement DMARC (_dmarc.<domaine>).
    // Resend ne gere PAS le DMARC : son absence degrade fortement le placement en boite
    // de reception (surtout chez iCloud). On interroge le DNS public (DNS-over-HTTPS)
    // pour le detecter et l'afficher clairement dans le Diagnostic.
    let dmarcPresent = false;
    let dmarcValue: string | null = null;
    if (domainPresent) {
      try {
        const r = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(`_dmarc.${fromDomain}`)}&type=TXT`,
        );
        const b = (await r.json().catch(() => null)) as
          | { Status?: number; Answer?: Array<{ data?: string }> }
          | null;
        const txt = (b?.Answer ?? []).map((a) => String(a.data ?? "").trim()).join(" ").trim();
        if (b?.Status === 0 && txt.length > 0) {
          dmarcPresent = true;
          dmarcValue = txt;
        }
      } catch {
        /* la verification DMARC n'est pas bloquante pour le diagnostic */
      }
    }

    // Historisation : on ne consigne une nouvelle entree que lorsque l'etat change,
    // afin de garder une trace lisible dans le temps (et non une ligne identique a
    // chaque verification). Client service-role distinct, reserve a cette ecriture.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const current = {
          ready,
          key_present: keyPresent,
          domain_present: domainPresent,
          domain_name: fromDomain || null,
          domain_status: domainStatus,
          api_reachable: apiReachable,
        };
        const { data: last } = await admin
          .from("diagnostic_email_historique")
          .select("ready, key_present, domain_present, domain_name, domain_status, api_reachable")
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const signature = (r: Record<string, unknown>) =>
          [
            r.ready ? "1" : "0",
            r.key_present ? "1" : "0",
            r.domain_present ? "1" : "0",
            r.domain_name ?? "",
            r.domain_status ?? "",
            r.api_reachable ? "1" : "0",
          ].join("|");
        if (!last || signature(last as Record<string, unknown>) !== signature(current)) {
          await admin.from("diagnostic_email_historique").insert({
            ...current,
            api_error: apiError,
            checked_at: new Date().toISOString(),
          });
        }
      } catch {
        /* l'historisation ne doit jamais faire echouer le diagnostic */
      }
    }

    return json({
      ok: true,
      keyPresent,
      domainPresent,
      domainName: fromDomain || null,
      fromAddress,
      apiReachable,
      apiError,
      domainStatus,
      domains,
      ready,
      dmarcPresent,
      dmarcValue,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
