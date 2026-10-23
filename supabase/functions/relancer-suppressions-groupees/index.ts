import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Plafonds acceptés pour un seul clic de relance groupée. */
const PLAFONDS_AUTORISES = [5, 10, 20];
const PLAFOND_DEFAUT = 10;
const PAUSE_ENTRE_ENVOIS_MS = 300;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Relance groupée des artisans dont le rappel J-7 manque.
 *
 * Le plafond d'envois (5, 10 ou 20) est contrôlé **ici**, pas seulement dans l'interface :
 * même si le site se trompait ou si quelqu'un appelait la fonction directement, jamais
 * plus de 20 emails ne peuvent partir sur un seul clic.
 *
 * Chaque envoi réutilise la fonction `relancer-suppression-artisan` avec le jeton de
 * l'appelant : contrôle gestionnaire, gabarit d'email et trace d'audit restent identiques.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "La relance groupée n'est pas encore configurée." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user?.email) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: gestionnaire } = await admin
      .from("gestionnaires")
      .select("email")
      .ilike("email", user.email)
      .maybeSingle();
    if (!gestionnaire) {
      return json({ ok: false, error: "Cette action est réservée aux gestionnaires." }, 403);
    }

    const body = await req.json().catch(() => null);
    const idsBruts = Array.isArray(body?.ids) ? (body.ids as unknown[]) : [];
    const ids = idsBruts
      .map((valeur) => Number(valeur))
      .filter((valeur) => Number.isFinite(valeur) && valeur > 0)
      .slice(0, 200);

    if (ids.length === 0) {
      return json({ ok: false, error: "Aucune demande à relancer." }, 400);
    }

    // Plafond arbitré côté serveur : seules les valeurs 5, 10 et 20 sont acceptées.
    const plafondDemande = Number(body?.plafond);
    const plafond = PLAFONDS_AUTORISES.includes(plafondDemande) ? plafondDemande : PLAFOND_DEFAUT;

    // Motif facultatif : note interne commune, jamais insérée dans l'email de l'artisan.
    const motif = String(body?.motif ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const retenues = ids.slice(0, plafond);
    const ignorees = Math.max(0, ids.length - retenues.length);
    const envoyees: { id: number; envoyeLe: string }[] = [];
    const echecs: { id: number; message: string }[] = [];

    for (let i = 0; i < retenues.length; i += 1) {
      const id = retenues[i];
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/relancer-suppression-artisan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            apikey: anonKey,
          },
          body: JSON.stringify({ demandeId: id, motif: motif || null }),
        });
        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; envoyeLe?: string; error?: string }
          | null;

        if (res.ok && payload?.ok) {
          envoyees.push({ id, envoyeLe: payload.envoyeLe || new Date().toISOString() });
        } else {
          echecs.push({
            id,
            message: payload?.error || "L'envoi a échoué pour cette demande.",
          });
        }
      } catch (e) {
        echecs.push({
          id,
          message: e instanceof Error ? e.message : "L'envoi a échoué pour cette demande.",
        });
      }

      if (i < retenues.length - 1) await sleep(PAUSE_ENTRE_ENVOIS_MS);
    }

    return json({
      ok: true,
      plafond,
      ignorees,
      envoyees,
      echecs,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
