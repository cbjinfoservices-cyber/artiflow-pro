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

/** Formate une date ISO (AAAA-MM-JJ) en français long ("12 octobre 2026"). */
function formatJour(value: unknown): string {
  const s = String(value ?? "");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Nombre de jours calendaires couverts par la période (inclusif), borné pour rester lisible. */
function nbJours(debut: string, fin: string): number {
  const d = new Date(`${debut}T00:00:00Z`).getTime();
  const f = new Date(`${fin || debut}T00:00:00Z`).getTime();
  if (!Number.isFinite(d) || !Number.isFinite(f)) return 1;
  const diff = Math.floor((Math.max(d, f) - Math.min(d, f)) / 86_400_000) + 1;
  return Math.min(Math.max(diff, 1), 365);
}

/**
 * Prévient par email un intervenant qu'un congé (ou une indisponibilité) vient d'être
 * posé sur son planning. Appelée par le responsable juste après l'enregistrement.
 */
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

    // 1) Vérification du porteur du jeton : client anon, jamais le client service.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const intervenantId = Number(payload?.intervenantId);
    const dateDebut = String(payload?.dateDebut ?? "").trim();
    const dateFin = String(payload?.dateFin ?? "").trim() || dateDebut;
    const motif = String(payload?.motif ?? "Absence").trim() || "Absence";
    const note =
      payload?.note === null || payload?.note === undefined ? "" : String(payload.note).trim().slice(0, 500);
    const periodeBrute = String(payload?.periode ?? "journee").trim();
    const periode = periodeBrute === "matin" || periodeBrute === "apres-midi" ? periodeBrute : "journee";
    const libellePeriode = periode === "matin" ? "matin" : periode === "apres-midi" ? "après-midi" : "";
    if (!Number.isFinite(intervenantId) || !dateDebut) {
      return json({ ok: false, error: "Congé incomplet : intervenant ou dates manquants." }, 400);
    }

    // 2) Lecture des données privilégiées avec le client service, après vérification du jeton.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: intervenant, error: intervError } = await admin
      .from("intervenants")
      .select("id, user_id, nom, compte_email, metier")
      .eq("id", intervenantId)
      .maybeSingle();
    if (intervError || !intervenant) {
      return json({ ok: false, error: "Intervenant introuvable." }, 404);
    }

    const proprietaireId = String(intervenant.user_id ?? "");
    const destinataire = String(intervenant.compte_email ?? "").trim().toLowerCase();
    const auteurEmail = String(user.email ?? "").trim().toLowerCase();
    const estProprietaire = proprietaireId === user.id;
    const estConcerne = Boolean(destinataire) && auteurEmail === destinataire;
    if (!estProprietaire && !estConcerne) {
      return json({ ok: false, error: "Vous n'êtes pas autorisé à prévenir cette personne." }, 403);
    }
    if (!destinataire) {
      return json({ ok: false, error: "Aucune adresse email sur la fiche de l'intervenant." }, 400);
    }

    if (!resendKey || !fromDomain) {
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré." }, 400);
    }

    const { data: profil } = await admin
      .from("profiles")
      .select("entreprise, metier, email")
      .eq("id", proprietaireId)
      .maybeSingle();
    const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
    const nomIntervenant = String(intervenant.nom ?? "Intervenant");
    const jours = periode === "journee" ? nbJours(dateDebut, dateFin) : 0.5;
    const periodeTexte =
      dateDebut === dateFin
        ? `${formatJour(dateDebut)}${libellePeriode ? ` (${libellePeriode})` : ""}`
        : `du ${formatJour(dateDebut)} au ${formatJour(dateFin)}`;

    const subject = `${motif}${libellePeriode ? ` (${libellePeriode})` : ""} posé sur votre planning (${periodeTexte})`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Nouvelle absence sur votre planning</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour ${escapeHtml(nomIntervenant)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Votre responsable vient de poser une absence sur votre planning :
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 0;color:#71717a;width:130px;">Motif</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(motif)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Période</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(periodeTexte)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Durée</td>
            <td style="padding:8px 0;font-weight:700;">${jours === 1 ? "1 jour" : jours === 0.5 ? "Demi-journée" : `${jours} jours`}</td>
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
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#3f3f46;">
          Ces journées apparaissent désormais dans votre planning personnel. Vous n'avez rien à valider.
        </p>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          Message automatique envoyé depuis ArtiFlow-pro.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${escapeHtml(entreprise)} · prévenance automatique
      </div>
    </div>
  </div>
</body></html>`;

    const trace = async (statut: string, message?: string) => {
      try {
        await admin
          .from("envoi_fournisseur_historique")
          .insert({
            fonction: "notifier-conge-intervenant",
            fournisseur: "resend",
            statut,
            repli: false,
            message: message ?? null,
          });
      } catch {
        /* trace non bloquante */
      }
    };

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
        }),
      });
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await trace("echec", erreur);
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await trace("echec", erreur);
      return json({ ok: false, error: erreur }, 502);
    }

    await trace("succes");
    return json({ ok: true, to: destinataire, jours });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});