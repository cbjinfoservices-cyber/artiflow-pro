import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Rappel « J-7 avant la fin d'une période payée en paiement unique ».
//
// Contrairement à un abonnement reconductible (prélevé automatiquement par Stripe),
// un paiement unique couvre une période fixe : rien ne se renouvelle tout seul.
// Cette fonction prévient l'artisan quelques jours avant l'échéance pour l'inviter
// à prolonger son accès, afin d'éviter une coupure surprise.
//
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (cron), idéalement une fois par jour. L'envoi réel nécessite Resend configuré
// (RESEND_API_KEY + RESEND_FROM_DOMAIN).
//
// Paramètres optionnels (POST) :
//   - { preview: true }  → renvoie le HTML de l'email sans rien envoyer (aperçu)
//   - { force: true }    → envoie le rappel même hors de la fenêtre (test)
//   - { userId: "..." }  → ne traite qu'un seul artisan (test ciblé)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Nombre de jours avant l'échéance auxquels le rappel est envoyé. */
const JOURS_AVANT_RAPPEL = 7;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Date du jour (AAAA-MM-JJ). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre aujourd'hui et une date AAAA-MM-JJ (positif = futur). */
function joursAvant(dateISO: string): number {
  const cible = new Date(`${dateISO}T00:00:00Z`).getTime();
  const today = new Date(`${todayISO()}T00:00:00Z`).getTime();
  return Math.round((cible - today) / 86400000);
}

/** Date lisible « 12 octobre 2026 ». */
function frDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Montant formaté en euros. */
function montantLabel(valeur: number): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(valeur);
  } catch {
    return `${valeur.toFixed(2)} €`;
  }
}

interface EmailParams {
  to: string;
  sujet: string;
  html: string;
}

/** Envoi d'un email via Resend (best-effort, secrets lus à l'exécution). */
async function envoyerEmail(params: EmailParams): Promise<boolean> {
  const apiKey = cleEnvoiEmail();
  const domain = domaineEnvoiEmail();
  if (!apiKey || !domain) return false;
  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to: [params.to],
        subject: params.sujet,
        html: params.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function gabarit(titre: string, intro: string, corps: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">${titre}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">${intro}</p>
        ${corps}
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Cet email vous est envoyé automatiquement par ArtiFlow-pro. Vos paiements sont traités de façon sécurisée par Stripe.
      </p>
    </div>
  </body>
</html>`;
}

function ligneRecap(label: string, valeur: string): string {
  return `<tr>
    <td style="padding:9px 0;font-size:13px;color:#6a6a64;border-bottom:1px solid #efede8;">${label}</td>
    <td style="padding:9px 0;font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid #efede8;">${valeur}</td>
  </tr>`;
}

interface RappelData {
  entreprise: string;
  offre: string;
  montant: string;
  finPeriode: string;
  jours: number;
}

/** Construit le corps HTML du rappel de fin de période. */
function corpsRappel(r: RappelData): string {
  const joursRestants = r.jours > 1 ? `${r.jours} jours` : `${r.jours} jour`;
  return `
    <div style="background:#fdf6ec;border:1px solid #f0dcbf;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#a35b12;">Votre accès arrive à échéance</p>
    </div>
    <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:6px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        ${ligneRecap("Entreprise", r.entreprise)}
        ${ligneRecap("Offre", `ArtiFlow-pro ${r.offre}`)}
        ${ligneRecap("Formule", "Paiement unique (non reconductible)")}
        ${ligneRecap("Montant réglé", r.montant)}
        ${ligneRecap("Fin de la période couverte", r.finPeriode)}
        ${ligneRecap("Temps restant", joursRestants)}
      </table>
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
      Votre paiement unique ne se renouvelle pas automatiquement. Pour éviter toute interruption de service,
      vous pouvez <strong>prolonger votre accès</strong> dès maintenant depuis la rubrique
      <strong>Mon abonnement</strong> de votre espace ArtiFlow-pro : soit un nouveau paiement unique pour une
      période, soit un abonnement reconductible si vous préférez ne plus y penser.
    </p>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
      Aucune action n'est nécessaire si vous ne souhaitez pas prolonger : votre accès reste actif jusqu'au terme
      indiqué, puis s'arrête de lui-même sans frais additionnels.
    </p>`;
}

interface AbonnementRow {
  id: number;
  entreprise?: string | null;
  email?: string | null;
  offre?: string | null;
  montant_mensuel?: number | null;
  date_echeance?: string | null;
  rappel_echeance_unique?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "Les rappels d'échéance ne sont pas encore configurés." }, 500);
    }

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;

    const canSend = Boolean(cleEnvoiEmail() && domaineEnvoiEmail());

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Abonnements réglés en paiement unique, toujours actifs, avec une échéance connue.
    let query = admin
      .from("abonnements")
      .select(
        "id, entreprise, email, offre, montant_mensuel, date_echeance, rappel_echeance_unique",
      )
      .eq("statut", "Actif")
      .ilike("canal_paiement", "%paiement unique%")
      .not("date_echeance", "is", null);
    if (scopeUserId) query = query.eq("artisan_id", scopeUserId);
    const { data: abos, error: aboError } = await query;
    if (aboError) return json({ ok: false, error: aboError.message }, 500);

    let envois = 0;
    let ignores = 0;
    let previewHtml: string | null = null;
    const details: Array<{ abonnementId: number; echeance: string | null; jours: number | null; envoye: boolean; raison?: string }> = [];

    for (const raw of abos ?? []) {
      const abo = raw as AbonnementRow;
      const abonnementId = Number(abo.id);
      const echeance = abo.date_echeance ? String(abo.date_echeance).slice(0, 10) : null;
      const email = abo.email ? String(abo.email).trim() : null;
      if (!echeance) {
        ignores += 1;
        details.push({ abonnementId, echeance: null, jours: null, envoye: false, raison: "Aucune échéance." });
        continue;
      }

      const jours = joursAvant(echeance);
      const entreprise = abo.entreprise ? String(abo.entreprise) : "votre entreprise";
      const offre = abo.offre ? String(abo.offre) : "Pro";
      const montant = montantLabel(Number(abo.montant_mensuel) || 0);

      // Aperçu : rendu de l'email sans envoi.
      if (preview) {
        previewHtml = gabarit(
          "Votre accès ArtiFlow-pro arrive à échéance",
          "Petit rappel : la période couverte par votre paiement unique touche bientôt à sa fin. Voici le récapitulatif.",
          corpsRappel({
            entreprise,
            offre,
            montant,
            finPeriode: frDate(echeance),
            jours: Math.max(jours, 0),
          }),
        );
        details.push({ abonnementId, echeance, jours, envoye: false, raison: "Aperçu." });
        continue;
      }

      const dejaEnvoye = abo.rappel_echeance_unique
        ? String(abo.rappel_echeance_unique).slice(0, 10) === echeance
        : false;
      const dansLaFenetre = jours === JOURS_AVANT_RAPPEL;

      // On n'envoie que dans la fenêtre (ou en test forcé), et jamais deux fois pour la même échéance.
      if (!force && !dansLaFenetre) {
        ignores += 1;
        details.push({
          abonnementId,
          echeance,
          jours,
          envoye: false,
          raison: `Hors fenêtre (J${jours >= 0 ? "-" : "+"}${Math.abs(jours)}).`,
        });
        continue;
      }
      if (!force && dejaEnvoye) {
        ignores += 1;
        details.push({ abonnementId, echeance, jours, envoye: false, raison: "Rappel déjà envoyé pour cette échéance." });
        continue;
      }

      const html = gabarit(
        "Votre accès ArtiFlow-pro arrive à échéance",
        "Petit rappel : la période couverte par votre paiement unique touche bientôt à sa fin. Voici le récapitulatif.",
        corpsRappel({ entreprise, offre, montant, finPeriode: frDate(echeance), jours: Math.max(jours, 0) }),
      );
      const sujet = `Votre accès ${offre} arrive à échéance — à prolonger`;

      if (!canSend || !email) {
        ignores += 1;
        details.push({
          abonnementId,
          echeance,
          jours,
          envoye: false,
          raison: !email ? "Email manquant." : "Resend non configuré.",
        });
        continue;
      }

      const ok = await envoyerEmail({ to: email, sujet, html });
      if (ok) {
        // On mémorise l'échéance déjà annoncée pour ne pas relancer la même.
        await admin
          .from("abonnements")
          .update({ rappel_echeance_unique: echeance, updated_at: new Date().toISOString() })
          .eq("id", abonnementId);
        envois += 1;
        details.push({ abonnementId, echeance, jours, envoye: true });
      } else {
        ignores += 1;
        details.push({ abonnementId, echeance, jours, envoye: false, raison: "Refus de Resend." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      fenetre: `J-${JOURS_AVANT_RAPPEL}`,
      abonnements: (abos ?? []).length,
      envois,
      ignores,
      html: previewHtml ?? undefined,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});