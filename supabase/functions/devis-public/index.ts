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
 * Fonction publique (verify_jwt = false) : permet au CLIENT de consulter et de
 * signer un devis a partir d'un jeton secret transmis par l'artisan.
 * Le client n'a pas de compte : l'acces est filtre uniquement par le jeton,
 * via un client service-role qui contourne la RLS de facon controlee.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const payload = await req.json().catch(() => null);
    const action = String(payload?.action ?? "read");
    const token = String(payload?.token ?? "").trim();
    if (!token) return json({ ok: false, error: "Lien invalide." }, 400);

    const { data: devis, error: devisError } = await supabase
      .from("devis")
      .select(
        "id, user_id, client_id, numero, objet, statut, total_ht, total_ttc, created_at, signed_at, signataire_nom, signature_image",
      )
      .eq("sign_token", token)
      .maybeSingle();

    if (devisError) return json({ ok: false, error: devisError.message }, 500);
    if (!devis) return json({ ok: false, error: "Ce devis est introuvable ou le lien a expire." }, 404);

    if (action === "sign") {
      if (devis.signed_at) return json({ ok: false, error: "Ce devis a deja ete signe." }, 409);

      const signature = typeof payload?.signature === "string" ? String(payload.signature) : "";
      const signataire = String(payload?.signataire ?? "").trim();
      if (!signature) return json({ ok: false, error: "Signature manquante." }, 400);

      const signedAt = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("devis")
        .update({
          signature_image: signature,
          signataire_nom: signataire || null,
          signed_at: signedAt,
          statut: "Signé",
        })
        .eq("id", devis.id);
      if (updErr) return json({ ok: false, error: updErr.message }, 500);

      return json({ ok: true, data: { signed_at: signedAt, signataire_nom: signataire || null } });
    }

    const [lignesRes, clientRes, profileRes] = await Promise.all([
      supabase
        .from("lignes_devis")
        .select("designation, unite, quantite, prix_unitaire")
        .eq("devis_id", devis.id)
        .order("id", { ascending: true }),
      devis.client_id
        ? supabase.from("clients").select("nom, adresse, telephone, email").eq("id", devis.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("profiles")
        .select("entreprise, metier, telephone, email, logo_url, siret, tva, assurance, doc_couleur, doc_afficher_logo, doc_pied_page")
        .eq("id", devis.user_id)
        .maybeSingle(),
    ]);

    return json({
      ok: true,
      data: {
        devis: {
          numero: devis.numero,
          objet: devis.objet,
          statut: devis.statut,
          total_ht: devis.total_ht,
          total_ttc: devis.total_ttc,
          created_at: devis.created_at,
          signed_at: devis.signed_at,
          signataire_nom: devis.signataire_nom,
          signature_image: devis.signature_image,
        },
        client: clientRes.data ?? null,
        lignes: lignesRes.data ?? [],
        emetteur: profileRes.data ?? null,
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
