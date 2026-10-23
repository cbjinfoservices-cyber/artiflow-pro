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

type EnvoiOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

/**
 * Envoie via Brevo, puis bascule automatiquement sur Resend si Brevo échoue.
 * Aucun bilan n'est perdu, même si Brevo est en incident. La tentative est
 * tracée dans `envoi_fournisseur_historique` pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; repli: boolean; error?: string }> {
  const trace = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* trace non bloquante */
    }
  };
  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
  let erreurBrevo = "";
  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc?.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment: opts.attachments?.length
            ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
            : undefined,
        }),
      });
      if (res.ok) {
        await trace("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await trace("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await trace("brevo", "echec", false, erreurBrevo);
    }
  }
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
  if (resendKey && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${opts.nom} <noreply@${fromDomain}>`,
          to: opts.to,
          cc: opts.cc?.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments?.length ? opts.attachments : undefined,
        }),
      });
      if (res.ok) {
        await trace("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }
  return { ok: false, fournisseur: "aucun", repli: false, error: "Aucun service d'envoi configuré (Resend non paramétré)." };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formate une date ISO (AAAA-MM-JJ) en français court (« lun. 6 oct. »). */
function formatJour(value: unknown): string {
  const s = String(value ?? "");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

interface InterventionLigne {
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
}

/**
 * Envoie au responsable (le proprietaire du planning) un petit bilan quand un
 * intervenant cloture sa semaine depuis « Mon planning ». La configuration Resend
 * (cle + domaine) est lue depuis les secrets du Backend.
 */
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
    if (!Deno.env.get("BREVO_API_KEY") && (!resendKey || !fromDomain)) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Activez Brevo (clé API + expéditeur vérifié) puis réessayez.",
        },
        400,
      );
    }

    // Authentification obligatoire : seul un compte connecté peut déclencher ce bilan.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user || !user.email) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const intervenantId = Number(payload?.intervenantId);
    if (!Number.isFinite(intervenantId)) {
      return json({ ok: false, error: "Intervenant inconnu." }, 400);
    }
    const semaineLabel = String(payload?.semaineLabel ?? "").trim() || "la semaine";
    const totalSemaine = Math.max(0, Number(payload?.totalSemaine) || 0);
    const faites = Math.max(0, Number(payload?.faites) || 0);
    const cloturees = Math.max(0, Number(payload?.cloturees) || 0);
    const restantes = Math.max(0, totalSemaine - faites);
    const interventions: InterventionLigne[] = Array.isArray(payload?.interventions)
      ? payload.interventions.slice(0, 50).map((item: Record<string, unknown>) => ({
          date: String(item?.date ?? ""),
          heure: String(item?.heure ?? ""),
          libelle: String(item?.libelle ?? ""),
          ville: item?.ville === null || item?.ville === undefined ? null : String(item?.ville),
        }))
      : [];

    // Origine de la clôture : l'intervenant lui-même, ou son responsable qui clôture pour lui.
    const origine = String(payload?.origine ?? "intervenant").trim() === "responsable" ? "responsable" : "intervenant";
    const parResponsable = origine === "responsable";

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Fiche intervenant : sert a retrouver le responsable (proprietaire) et a verifier l'auteur.
    const { data: intervenant, error: intervError } = await admin
      .from("intervenants")
      .select("id, user_id, nom, compte_email")
      .eq("id", intervenantId)
      .maybeSingle();
    if (intervError || !intervenant) {
      return json({ ok: false, error: "Intervenant introuvable." }, 404);
    }

    const auteurEmail = String(user.email).trim().toLowerCase();
    const attendu = String(intervenant.compte_email ?? "").trim().toLowerCase();
    // Autorisé : l'intervenant lui-même (même email), ou le responsable propriétaire du planning.
    const estIntervenant = Boolean(attendu) && auteurEmail === attendu;
    const estProprietaire = String(intervenant.user_id ?? "") === user.id;
    if (!estIntervenant && !estProprietaire) {
      return json({ ok: false, error: "Vous n'êtes pas autorisé à clôturer ce planning." }, 403);
    }

    const proprietaireId = String(intervenant.user_id ?? "");
    // Profil du proprietaire : nom d'entreprise + email de destinataire.
    const { data: profil } = await admin
      .from("profiles")
      .select("entreprise, metier, email")
      .eq("id", proprietaireId)
      .maybeSingle();
    const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
    const destinataire = String(profil?.email ?? "").trim();
    if (!destinataire) {
      return json({ ok: false, error: "Adresse du responsable introuvable." }, 400);
    }

    const nomIntervenant = String(intervenant.nom ?? "Intervenant");
    const fromAddress = `${entreprise} <noreply@${fromDomain}>`;
    const subject = parResponsable
      ? `${nomIntervenant} : semaine clôturée (${faites}/${totalSemaine} faites)`
      : `${nomIntervenant} a clôturé sa semaine (${faites}/${totalSemaine} faites)`;

    const lignesHtml = interventions.length
      ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
          <thead>
            <tr style="text-align:left;color:#71717a;font-size:11px;text-transform:uppercase;">
              <th style="padding:6px 8px;border-bottom:1px solid #eee;">Jour</th>
              <th style="padding:6px 8px;border-bottom:1px solid #eee;">Heure</th>
              <th style="padding:6px 8px;border-bottom:1px solid #eee;">Intervention</th>
              <th style="padding:6px 8px;border-bottom:1px solid #eee;">Lieu</th>
            </tr>
          </thead>
          <tbody>
            ${interventions
              .map(
                (l) => `<tr>
                  <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;">${escapeHtml(formatJour(l.date))}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;">${escapeHtml(l.heure)}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;">${escapeHtml(l.libelle)}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;color:#52525b;">${escapeHtml(l.ville || "—")}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>`
      : "";

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Clôture de semaine · ${escapeHtml(semaineLabel)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          ${
            parResponsable
              ? `Le responsable a clôturé la semaine de <strong>${escapeHtml(nomIntervenant)}</strong> : les interventions restantes ont été marquées comme faites.`
              : `<strong>${escapeHtml(nomIntervenant)}</strong> vient de clôturer sa semaine : les interventions restantes ont été marquées comme faites.`
          }
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px;">
          <span style="display:inline-block;padding:10px 14px;border-radius:8px;background:#f0fdf4;color:#166534;font-size:13px;font-weight:700;">
            Faites : ${faites}/${totalSemaine}
          </span>
          <span style="display:inline-block;padding:10px 14px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">
            Restantes : ${restantes}
          </span>
          <span style="display:inline-block;padding:10px 14px;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:13px;font-weight:700;">
            Soldées par ce geste : ${cloturees}
          </span>
        </div>
        ${lignesHtml}
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Bilan automatique envoyé depuis ArtiFlow-pro.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Bilan de clôture pour ${escapeHtml(entreprise)}.
      </div>
    </div>
  </div>
</body></html>`;

    const envoi = await envoyerEmailAvecRepli(
      "recap-cloture-semaine",
      { nom: entreprise, to: [destinataire], subject, html },
      admin,
    );
    if (!envoi.ok) {
      return json({ ok: false, error: envoi.error || "L'envoi du bilan a échoué." }, 502);
    }

    return json({ ok: true, to: destinataire, fromAddress });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
