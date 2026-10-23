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
 * Marque (ou démarque) un artisan comme appelé par téléphone.
 *
 * Sert à sortir de la liste « à appeler » les personnes déjà relancées au moins deux fois
 * puis réellement jointes. La trace est conservée dans `details` (`appele_le`, `appele_par`)
 * pour l'audit, avec la même autorisation que les autres actions du back-office :
 * réservé aux gestionnaires.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Le marquage n'est pas encore configuré." }, 500);
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
    const demandeId = Number(body?.demandeId);
    if (!Number.isFinite(demandeId) || demandeId <= 0) {
      return json({ ok: false, error: "Demande introuvable." }, 400);
    }
    const appele = body?.appele !== false;
    const action = String(body?.action ?? "appel").trim();

    // Résultat de l'appel : trois issues possibles, contrôlées côté serveur.
    const resultatBrut = String(body?.resultat ?? "");
    const resultat =
      resultatBrut === "joint" || resultatBrut === "ne_repond_pas" || resultatBrut === "veut_partir"
        ? resultatBrut
        : "joint";
    const note = String(body?.note ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const { data: demandeData } = await admin
      .from("suppressions_compte")
      .select("id, entreprise, email, details, statut")
      .eq("id", demandeId)
      .maybeSingle();
    const demande = demandeData as {
      id: number;
      entreprise: string | null;
      email: string | null;
      details: Record<string, unknown> | null;
      statut: string;
    } | null;
    if (!demande) return json({ ok: false, error: "Cette demande n'existe plus." }, 404);
    if (demande.statut !== "programmee") {
      return json({ ok: false, error: "Cette demande n'est plus en attente : elle a déjà été traitée." }, 409);
    }

    const details = (demande.details ?? {}) as Record<string, unknown>;
    const maintenant = new Date().toISOString();
    const suivants: Record<string, unknown> = { ...details };

    // Clôture d'un rappel de suivi : aucun email n'est envoyé, on consigne
    // simplement la décision pour que la ligne ne soit plus proposée comme « due ».
    if (action === "valider_suivi") {
      // Motif facultatif de clôture (ex. « artisan rappelé, renouvelle finalement ») :
      // il enrichit la trace d'audit sans jamais partir par email.
      const motifSuivi = String(body?.motif ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      suivants.suivi_valide_le = maintenant;
      suivants.suivi_valide_par = user.email;
      suivants.suivi_valide_motif = motifSuivi || null;
      const historiqueExistant = Array.isArray(details.suivis_clos_historique)
        ? (details.suivis_clos_historique as unknown[])
        : [];
      suivants.suivis_clos_historique = [
        ...historiqueExistant,
        { le: maintenant, par: user.email, motif: motifSuivi || "" },
      ]
        .filter((entree) => entree && typeof entree === "object")
        .slice(-8);

      const { error: erreurSuivi } = await admin
        .from("suppressions_compte")
        .update({ details: suivants, updated_at: maintenant })
        .eq("id", demande.id)
        .eq("statut", "programmee");
      if (erreurSuivi) {
        return json({ ok: false, error: "Le suivi n'a pas pu être clos. Réessayez." }, 500);
      }

      return json({
        ok: true,
        valideLe: maintenant,
        motif: motifSuivi,
        message: `Suivi clos pour ${demande.entreprise || demande.email || "cet artisan"}${
          motifSuivi ? ` (motif consigné : « ${motifSuivi} »)` : ""
        } : aucun email n'a été envoyé.`,
      });
    }

    if (appele) {
      suivants.appele_le = maintenant;
      suivants.appele_par = user.email;
      suivants.appel_resultat = resultat;
      suivants.appel_note = note || null;

      // Journal court des appels (date + résultat + note) pour la trace d'audit :
      // on conserve les 8 derniers pour garder l'historique des tentatives.
      const historiqueExistant = Array.isArray(details.appels_historique)
        ? (details.appels_historique as unknown[])
        : [];
      const historique = [
        ...historiqueExistant,
        { le: maintenant, resultat, note: note || "", par: user.email },
      ]
        .filter((entree) => entree && typeof entree === "object")
        .slice(-8);
      suivants.appels_historique = historique;
    } else {
      delete suivants.appele_le;
      delete suivants.appele_par;
      delete suivants.appel_resultat;
      delete suivants.appel_note;
    }

    const { error: updateError } = await admin
      .from("suppressions_compte")
      .update({ details: suivants, updated_at: maintenant })
      .eq("id", demande.id)
      .eq("statut", "programmee");
    if (updateError) {
      return json({ ok: false, error: "Le marquage n'a pas pu être enregistré. Réessayez." }, 500);
    }

    return json({
      ok: true,
      appele,
      appeleLe: appele ? maintenant : null,
      resultat: appele ? resultat : null,
      message: appele
        ? `${demande.entreprise || demande.email || "Cet artisan"} est marqué comme appelé${resultat === "joint" ? " (joint)" : resultat === "ne_repond_pas" ? " (ne répond pas)" : " (veut partir)"} : il sort de la liste à appeler.`
        : `${demande.entreprise || demande.email || "Cet artisan"} revient dans la liste à appeler.`,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
