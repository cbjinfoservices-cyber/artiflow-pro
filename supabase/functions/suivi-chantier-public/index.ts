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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const payload = await req.json().catch(() => null);
    const token = String(payload?.token ?? "").trim();
    if (!token) return json({ ok: false, error: "Lien de suivi incomplet." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: chantier, error: chantierError } = await admin
      .from("chantiers")
      .select(
        "id, user_id, client_id, libelle, adresse, statut, date_debut, montant, message_client, suivi_actif, suivi_maj_at, created_at",
      )
      .eq("suivi_token", token)
      .maybeSingle();

    if (chantierError) return json({ ok: false, error: "Lecture impossible." }, 500);
    if (!chantier) return json({ ok: false, error: "Ce lien de suivi est introuvable." }, 404);
    if (chantier.suivi_actif === false) {
      return json({ ok: false, error: "Le partage de ce suivi a été désactivé par l'artisan." }, 403);
    }

    const [etapesRes, profileRes, clientRes] = await Promise.all([
      admin
        .from("etapes_chantier")
        .select("id, libelle, fait, photo_url, note_client, visible_client, created_at")
        .eq("chantier_id", chantier.id)
        .eq("visible_client", true)
        .order("id", { ascending: true }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, logo_url, doc_couleur, doc_afficher_logo")
        .eq("id", chantier.user_id)
        .maybeSingle(),
      chantier.client_id
        ? admin.from("clients").select("nom, adresse").eq("id", chantier.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const etapes = (etapesRes.data ?? []) as Array<Record<string, unknown>>;
    const profile = (profileRes.data ?? null) as Record<string, unknown> | null;
    const client = (clientRes.data ?? null) as Record<string, unknown> | null;

    const chemins = etapes
      .map((e) => toStr(e.photo_url))
      .filter((p): p is string => Boolean(p));
    const urlsParChemin = new Map<string, string>();
    if (chemins.length > 0) {
      const { data: signed } = await admin.storage.from("suivi-chantier").createSignedUrls(chemins, 3600);
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) urlsParChemin.set(s.path, s.signedUrl);
      });
    }

    const etapesPubliques = etapes.map((e) => ({
      id: Number(e.id),
      libelle: String(e.libelle ?? ""),
      fait: Boolean(e.fait),
      note: toStr(e.note_client),
      photoUrl: toStr(e.photo_url) ? (urlsParChemin.get(String(e.photo_url)) ?? null) : null,
    }));

    const faites = etapesPubliques.filter((e) => e.fait).length;
    const progression = etapesPubliques.length === 0 ? 0 : Math.round((faites / etapesPubliques.length) * 100);

    return json({
      ok: true,
      data: {
        chantier: {
          libelle: toStr(chantier.libelle) ?? "Chantier",
          adresse: toStr(chantier.adresse),
          statut: toStr(chantier.statut) ?? "a_venir",
          dateDebut: toStr(chantier.date_debut),
          montant: Number(chantier.montant ?? 0),
          message: toStr(chantier.message_client),
          majLe: toStr(chantier.suivi_maj_at) ?? toStr(chantier.created_at),
          clientNom: toStr(client?.nom),
        },
        etapes: etapesPubliques,
        progression,
        etapesFaites: faites,
        artisan: {
          entreprise: toStr(profile?.entreprise) ?? "Votre artisan",
          metier: toStr(profile?.metier),
          telephone: toStr(profile?.telephone),
          email: toStr(profile?.email),
          logoUrl: profile?.doc_afficher_logo === false ? null : toStr(profile?.logo_url),
          accent: /^#[0-9a-fA-F]{6}$/.test(String(profile?.doc_couleur ?? "")) ? String(profile?.doc_couleur) : "#C4783A",
        },
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
