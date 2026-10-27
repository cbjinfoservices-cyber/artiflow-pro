import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Encode un texte UTF-8 en base64, pour la pièce jointe CSV. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (cleEnvoiEmail() ?? "").trim();
    const fromDomain = (domaineEnvoiEmail() ?? "").trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Configuration manquante." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const csv = String(payload?.csv ?? "");
    const total = Number(payload?.total ?? 0);
    const restants = Number(payload?.restants ?? 0);
    const filename =
      String(payload?.filename ?? "conflits-conges.csv").replace(/[^\w.-]/g, "") ||
      "conflits-conges.csv";
    // « manuel » depuis la carte, « relance » quand la liste est renvoyée depuis l'historique.
    const modeEnvoi =
      String(payload?.mode ?? "manuel").toLowerCase() === "relance" ? "relance" : "manuel";

    if (!csv.trim()) {
      return json({ ok: false, error: "La liste des conflits est vide." }, 400);
    }
    if (!resendKey || !fromDomain) {
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profil } = await admin
      .from("profiles")
      .select("email, entreprise, metier")
      .eq("id", user.id)
      .maybeSingle();
    const destinataire = String(profil?.email ?? user.email ?? "").trim().toLowerCase();
    if (!destinataire) {
      return json({ ok: false, error: "Aucune adresse email sur votre profil de responsable." }, 400);
    }

    const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
    const nbTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const nbRestants = Number.isFinite(restants) && restants > 0 ? restants : 0;

    const subject =
      nbTotal > 0
        ? `Conflits de congé à traiter en réunion (${nbRestants} à réaffecter)`
        : "Conflits de congé à traiter en réunion";

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#b45309;">Liste des conflits de congé</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici la liste des interventions qui tombent un jour où la personne affectée est absente,
          pour préparer la réunion d'équipe. Le fichier CSV est joint à ce message.
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 0;color:#71717a;width:180px;">Interventions listées</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(nbTotal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Encore à réaffecter</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(nbRestants)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Pièce jointe</td>
            <td style="padding:8px 0;">${escapeHtml(filename)}</td>
          </tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Dans le planning, le filtre « Conflits congé » affiche la même liste et propose un
          remplaçant en un clic sur chaque intervention.
        </p>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">Message automatique envoyé depuis ArtiFlow-pro.</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${escapeHtml(entreprise)} · préparation de la réunion d'équipe
      </div>
    </div>
  </div>
</body></html>`;

    let res: Response;
    try {
      res = await envoyerEmail("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${entreprise} <noreply@${fromDomain}>`,
          to: [destinataire],
          subject,
          html,
          attachments: [
            {
              filename,
              content: toBase64(`\uFEFF${csv}`),
            },
          ],
        }),
      });
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      // L'échec est journalisé : l'historique doit refléter la réalité, pas seulement les succès.
      await admin.from("envois_liste_conflits").insert({
        user_id: user.id,
        destinataire,
        total_conflits: nbTotal,
        restants: nbRestants,
        mode: modeEnvoi,
        fichier: filename,
        statut: "echec",
        message: erreur,
      });
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await admin.from("envois_liste_conflits").insert({
        user_id: user.id,
        destinataire,
        total_conflits: nbTotal,
        restants: nbRestants,
        mode: modeEnvoi,
        fichier: filename,
        statut: "echec",
        message: erreur,
      });
      return json({ ok: false, error: erreur }, 502);
    }

    // Envoi réussi : on le trace pour l'historique affiché sous la liste des conflits.
    await admin.from("envois_liste_conflits").insert({
      user_id: user.id,
      destinataire,
      total_conflits: nbTotal,
      restants: nbRestants,
      mode: "manuel",
      fichier: filename,
      statut: "envoye",
    });

    return json({ ok: true, to: destinataire });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
