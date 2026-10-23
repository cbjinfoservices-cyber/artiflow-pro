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

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * Espace client : liste les chantiers dont le suivi est partagé avec le client connecté.
 *
 * L'accès est déterminé par l'adresse email du compte connecté (vérifiée côté serveur), et
 * non par un identifiant envoyé par le navigateur : un client ne peut pas demander les
 * chantiers d'un autre.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const email = (user.email ?? "").trim().toLowerCase();
    if (!email) return json({ ok: true, data: { chantiers: [] } });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: fiches } = await admin.from("clients").select("id, nom, email").ilike("email", email);
    const ids = (fiches ?? []).map((f) => Number(f.id)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return json({ ok: true, data: { chantiers: [] } });

    const { data: chantiers } = await admin
      .from("chantiers")
      .select("id, user_id, libelle, adresse, statut, date_debut, montant, suivi_token, suivi_maj_at, created_at")
      .in("client_id", ids)
      .eq("suivi_actif", true)
      .order("created_at", { ascending: false });

    const lignes = chantiers ?? [];
    if (lignes.length === 0) return json({ ok: true, data: { chantiers: [] } });

    const [{ data: etapes }, { data: profils }] = await Promise.all([
      admin
        .from("etapes_chantier")
        .select("chantier_id, fait, visible_client")
        .in("chantier_id", lignes.map((c) => c.id))
        .eq("visible_client", true),
      admin
        .from("profiles")
        .select("id, entreprise, metier, telephone, email")
        .in("id", Array.from(new Set(lignes.map((c) => c.user_id)))),
    ]);

    const compteParChantier = new Map<number, { total: number; faites: number }>();
    (etapes ?? []).forEach((e) => {
      const id = Number(e.chantier_id);
      const courant = compteParChantier.get(id) ?? { total: 0, faites: 0 };
      courant.total += 1;
      if (e.fait) courant.faites += 1;
      compteParChantier.set(id, courant);
    });

    const artisanParId = new Map<string, Record<string, unknown>>();
    (profils ?? []).forEach((p) => artisanParId.set(String(p.id), p));

    return json({
      ok: true,
      data: {
        chantiers: lignes.map((c) => {
          const compte = compteParChantier.get(Number(c.id)) ?? { total: 0, faites: 0 };
          const artisan = artisanParId.get(String(c.user_id)) ?? null;
          return {
            id: Number(c.id),
            libelle: toStr(c.libelle) ?? "Chantier",
            adresse: toStr(c.adresse),
            statut: toStr(c.statut) ?? "a_venir",
            dateDebut: toStr(c.date_debut),
            montant: Number(c.montant ?? 0),
            majLe: toStr(c.suivi_maj_at) ?? toStr(c.created_at),
            token: toStr(c.suivi_token),
            progression: compte.total === 0 ? 0 : Math.round((compte.faites / compte.total) * 100),
            etapesFaites: compte.faites,
            etapesTotal: compte.total,
            artisanNom: toStr(artisan?.entreprise) ?? "Votre artisan",
            artisanTelephone: toStr(artisan?.telephone),
            artisanEmail: toStr(artisan?.email),
          };
        }),
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
