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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatJour(value: unknown): string {
  const s = String(value ?? "");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function libellePeriode(heure: unknown): string {
  const valeur = String(heure ?? "").slice(0, 5);
  if (valeur === "08:00") return "matin";
  if (valeur === "13:00") return "après-midi";
  return "journée entière";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

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
    const creneauId = Number(payload?.creneauId);
    const intervenantId = Number(payload?.intervenantId);
    if (!Number.isFinite(creneauId) || !Number.isFinite(intervenantId)) {
      return json({ ok: false, error: "Intervention ou intervenant manquant." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: creneau, error: creneauError } = await admin
      .from("planning_creneaux")
      .select("id, user_id, date, heure, libelle, ville, intervenant_id, statut")
      .eq("id", creneauId)
      .maybeSingle();
    if (creneauError || !creneau) return json({ ok: false, error: "Intervention introuvable." }, 404);
    if (String(creneau.user_id) !== user.id) {
      return json({ ok: false, error: "Cette intervention n'est pas la vôtre." }, 403);
    }
    if (String(creneau.statut ?? "").toLowerCase() === "indisponible") {
      return json({ ok: false, error: "Il ne s'agit pas d'une intervention." }, 400);
    }

    const { data: intervenant, error: intervError } = await admin
      .from("intervenants")
      .select("id, user_id, nom, metier")
      .eq("id", intervenantId)
      .maybeSingle();
    if (intervError || !intervenant) {
      return json({ ok: false, error: "Intervenant introuvable." }, 404);
    }
    if (String(intervenant.user_id) !== user.id) {
      return json({ ok: false, error: "Cet intervenant n'est pas dans votre équipe." }, 403);
    }

    const dateISO = String(creneau.date ?? "");
    const { data: absences } = await admin
      .from("planning_creneaux")
      .select("id, heure, libelle, note")
      .eq("statut", "indisponible")
      .eq("intervenant_id", intervenantId)
      .eq("date", dateISO);
    if (!absences || absences.length === 0) {
      return json({ ok: false, error: "Aucune absence ce jour-là : pas de conflit." }, 409);
    }

    const premiere = absences[0] as Record<string, unknown>;
    const motif = String(premiere.libelle ?? "Absence");
    const heures = new Set(absences.map((a) => String((a as Record<string, unknown>).heure ?? "").slice(0, 5)));
    const periode =
      heures.has("00:00") || (heures.has("08:00") && heures.has("13:00"))
        ? "journée entière"
        : libellePeriode(premiere.heure);
    const note =
      absences
        .map((a) => String((a as Record<string, unknown>).note ?? "").trim())
        .find((v) => v.length > 0) ?? "";

    const marqueur = `conflit:creneau:${creneauId}:intervenant:${intervenantId}`;
    const { data: deja } = await admin
      .from("envoi_fournisseur_historique")
      .select("id")
      .eq("fonction", "notifier-conflit-conge")
      .eq("statut", "succes")
      .eq("message", marqueur)
      .limit(1);
    if (deja && deja.length > 0) {
      return json({ ok: true, dejaEnvoye: true, to: null });
    }

    const { data: profil } = await admin
      .from("profiles")
      .select("email, entreprise, metier")
      .eq("id", user.id)
      .maybeSingle();
    const destinataire = String(profil?.email ?? user.email ?? "").trim().toLowerCase();
    if (!destinataire) {
      return json({ ok: false, error: "Aucune adresse email sur votre profil de responsable." }, 400);
    }
    if (!resendKey || !fromDomain) {
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré." }, 400);
    }

    const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
    const nomIntervenant = String(intervenant.nom ?? "Intervenant");
    const heure = String(creneau.heure ?? "").slice(0, 5);
    const libelle = String(creneau.libelle ?? "Intervention");
    const ville = String(creneau.ville ?? "").trim();

    const subject = `Conflit de congé : ${libelle} le ${formatJour(dateISO)}`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#b45309;">Conflit de congé à traiter</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Une intervention vient d'être posée sur un jour où l'intervenant affecté est absent.
          Elle doit être réaffectée :
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 0;color:#71717a;width:140px;">Intervention</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(libelle)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Date</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(formatJour(dateISO))} à ${escapeHtml(heure)}</td>
          </tr>
          ${
            ville
              ? `<tr>
                   <td style="padding:8px 0;color:#71717a;">Lieu</td>
                   <td style="padding:8px 0;">${escapeHtml(ville)}</td>
                 </tr>`
              : ""
          }
          <tr>
            <td style="padding:8px 0;color:#71717a;">Personne affectée</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(nomIntervenant)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Absence</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(motif)} (${escapeHtml(periode)})</td>
          </tr>
          ${
            note
              ? `<tr>
                   <td style="padding:8px 0;color:#71717a;">Précision</td>
                   <td style="padding:8px 0;">${escapeHtml(note)}</td>
                 </tr>`
              : ""
          }
        </table>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Ouvrez le planning et utilisez le filtre « Conflits congé » pour voir d'un coup d'œil
          tout ce qui reste à réaffecter. Un remplaçant est proposé en un clic sur chaque intervention.
        </p>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          Message automatique envoyé depuis ArtiFlow-pro.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${escapeHtml(entreprise)} · alerte de conflit de planning
      </div>
    </div>
  </div>
</body></html>`;

    const trace = async (statut: string, message: string) => {
      try {
        await admin.from("envoi_fournisseur_historique").insert({
          fonction: "notifier-conflit-conge",
          fournisseur: "resend",
          statut,
          repli: false,
          message,
        });
      } catch {
        /* trace non bloquante */
      }
    };

    // Journal lisible côté planning : qui a été prévenu, quand, pour quelle intervention.
    const journaliser = async (statut: "envoye" | "echec") => {
      try {
        await admin.from("alertes_conflit_conge").insert({
          user_id: user.id,
          creneau_id: creneauId,
          intervenant_id: intervenantId,
          destinataire,
          date_intervention: dateISO,
          motif,
          periode,
          statut,
        });
      } catch {
        /* le journal ne doit jamais bloquer l'alerte */
      }
    };

    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${entreprise} <noreply@${fromDomain}>`,
          to: [destinataire],
          subject,
          html,
        }),
      });
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await trace("echec", `${marqueur} · ${erreur}`);
      await journaliser("echec");
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await trace("echec", `${marqueur} · ${erreur}`);
      await journaliser("echec");
      return json({ ok: false, error: erreur }, 502);
    }

    await trace("succes", marqueur);
    await journaliser("envoye");
    return json({ ok: true, to: destinataire });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
