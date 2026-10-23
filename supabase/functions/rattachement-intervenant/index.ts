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

/** Nettoie un code saisi : majuscules, sans espaces ni caractères non prévus. */
function nettoyerCode(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 16);
}

/**
 * Deux actions, toutes deux reservees a un utilisateur connecte :
 *  - "rattacherCode" : rattache le compte connecte a la fiche dont le CODE D'INVITATION
 *    correspond. C'est le code qui determine la fiche : impossible de choisir librement.
 *  - "etat"          : liste, parmi les intervenants de l'entreprise connectee, les emails
 *    de compte qui ont reellement un compte cree (repere « compte rattache » cote liste).
 *
 * Securite : le JWT de l'appelant est verifie avec un client anon ; les operations
 * privilegiees (lecture large + mise a jour) passent par un client service-role.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Configuration manquante." }, 500);
    }

    // 1) Verification du porteur du JWT (client anon uniquement).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const email = (user.email ?? "").trim().toLowerCase();
    if (!email) return json({ ok: false, error: "Aucune adresse email sur ce compte." }, 400);

    // 2) Operations privilegiees avec le client service-role.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const payload = await req.json().catch(() => null);
    const action = String((payload as { action?: unknown } | null)?.action ?? "").trim();

    if (action === "etat") {
      // Fiches de l'entreprise connectee ayant un email de compte renseigne.
      const { data: mes, error } = await admin
        .from("intervenants")
        .select("compte_email")
        .eq("user_id", user.id)
        .not("compte_email", "is", null);
      if (error) return json({ ok: false, error: "La vérification a échoué." }, 500);

      const emails = Array.from(
        new Set(
          (mes ?? [])
            .map((r) => String((r as { compte_email?: unknown }).compte_email ?? "").trim().toLowerCase())
            .filter((e) => e.length > 0),
        ),
      );
      if (emails.length === 0) return json({ ok: true, rattaches: [] });

      // Un compte reellement cree possede un profil avec cet email.
      const { data: profils } = await admin.from("profiles").select("email").in("email", emails);
      const rattaches = Array.from(
        new Set(
          (profils ?? [])
            .map((p) => String((p as { email?: unknown }).email ?? "").trim().toLowerCase())
            .filter((e) => e.length > 0),
        ),
      );
      return json({ ok: true, rattaches });
    }

    if (action === "rattacherCode") {
      const code = nettoyerCode((payload as { code?: unknown } | null)?.code);
      if (code.length < 4) return json({ ok: false, error: "Saisissez le code d'invitation reçu par email." }, 400);

      const { data: fiche } = await admin
        .from("intervenants")
        .select("id, nom, compte_email, user_id, code_invitation_expire_le")
        .ilike("code_invitation", code)
        .maybeSingle();
      if (!fiche) {
        return json({ ok: false, error: "Code d'invitation inconnu. Vérifiez le code reçu par email." }, 404);
      }

      const row = fiche as {
        id?: unknown;
        nom?: unknown;
        compte_email?: unknown;
        user_id?: unknown;
        code_invitation_expire_le?: unknown;
      };

      // Un code trop ancien n'est plus utilisable : il faut en demander un nouveau à
      // l'entreprise. Un code sans date d'expiration reste valide (anciennes fiches).
      const expireLe = row.code_invitation_expire_le;
      if (expireLe) {
        const t = new Date(String(expireLe)).getTime();
        if (Number.isFinite(t) && Date.now() > t) {
          return json(
            {
              ok: false,
              error: "Ce code d'invitation a expiré. Demandez un nouveau code à votre entreprise.",
            },
            410,
          );
        }
      }

      if (row.compte_email) {
        return json({ ok: false, error: "Cette fiche a déjà un compte associé." }, 409);
      }
      if (String(row.user_id ?? "") === user.id) {
        return json({ ok: false, error: "Cette fiche vous appartient déjà." }, 400);
      }

      // Le compte ne doit pas déjà être relié à une autre fiche.
      const { data: deja } = await admin
        .from("intervenants")
        .select("id")
        .eq("compte_email", email)
        .limit(1)
        .maybeSingle();
      if (deja) {
        return json({ ok: false, error: "Votre compte est déjà rattaché à une fiche." }, 409);
      }

      const { error: upErr } = await admin
        .from("intervenants")
        .update({ compte_email: email })
        .eq("id", Number(row.id))
        .is("compte_email", null);
      if (upErr) return json({ ok: false, error: "Le rattachement a échoué." }, 500);

      return json({ ok: true, nom: String(row.nom ?? ""), email });
    }

    return json({ ok: false, error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
