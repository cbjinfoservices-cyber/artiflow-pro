import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

// Récapitulatif MENSUEL par email des alertes « mot de passe ancien » envoyées à l'artisan.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée (voir
// Agents → Tâches planifiées). Comme le passage est quotidien/horaire, chaque envoi n'a lieu
// que le 1er du mois à 08:00 (heure de Paris), et une seule fois par mois (anti-doublon via
// mot_de_passe_recap_mensuel_dernier_mois).
// Un appel avec { userId, force: true } (bouton « Tester maintenant ») envoie tout de suite
// le récap de cet artisan, sans tenir compte du jour ni de l'anti-doublon.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JOUR_ENVOI = 1; // 1er du mois
const HEURE_ENVOI = 8; // 08:00, heure de Paris

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
 * Aucun récapitulatif n'est perdu, même si Brevo est en incident. La tentative est
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
  const brevoKey = (Deno.env.get("BREVO_API_KEY") ?? "").trim();
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

/** Parties « année / mois / jour / heure » à l'heure de Paris. */
function parisParts(): { day: number; hour: number; year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  });
  try {
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    return { day: get("day"), hour: get("hour") % 24, year: get("year"), month: get("month") };
  } catch {
    const now = new Date();
    return { day: now.getDate(), hour: now.getHours(), year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

function estEnPause(pauseJusquAu: unknown): boolean {
  if (!pauseJusquAu) return false;
  return String(pauseJusquAu).slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

function buildEmailHtml(params: {
  nom: string;
  moisLabelCap: string;
  total: number;
  auto: number;
  tests: number;
  appUrl: string;
}): string {
  const { nom, moisLabelCap, total, auto, tests, appUrl } = params;
  const link = appUrl ? `${appUrl}/app/profil` : "";
  const bouton = link
    ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Ouvrir la Sécurité du compte</a>
        </p>`
    : "";
  const corps =
    total === 0
      ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">
          Aucune alerte « mot de passe ancien » n'a été envoyée en ${escapeHtml(moisLabelCap)}.
          Votre mot de passe reste dans les délais recommandés : rien à faire de votre côté.
        </p>`
      : `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
          <tr>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#18181b;">${total}</div>
              <div style="font-size:11px;color:#71717a;">alerte${total > 1 ? "s" : ""} au total</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#0f766e;">${auto}</div>
              <div style="font-size:11px;color:#71717a;">automatique${auto > 1 ? "s" : ""}</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#18181b;">${tests}</div>
              <div style="font-size:11px;color:#71717a;">test${tests > 1 ? "s" : ""}</div>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#52525b;">
          ${auto} alerte${auto > 1 ? "s" : ""} automatique${auto > 1 ? "s" : ""} envoyée${auto > 1 ? "s" : ""} en ${escapeHtml(moisLabelCap)}${tests > 0 ? ` · ${tests} test${tests > 1 ? "s" : ""} manuel${tests > 1 ? "s" : ""}` : ""}.
          Pensez à renouveler votre mot de passe s'il approche des 6 mois.
        </p>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap mensuel des alertes « mot de passe ancien » · ${escapeHtml(moisLabelCap)}</p>
      </div>
      <div style="padding:24px;">
        ${corps}
        ${bouton}
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Ce récapitulatif vous est envoyé une fois par mois pour suivre les rappels de sécurité liés à votre mot de passe.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

function resolveAppUrl(profileValue: unknown, req: Request): string {
  const fromProfile = typeof profileValue === "string" ? profileValue.trim() : "";
  if (fromProfile) return fromProfile.replace(/\/+$/, "");
  const origin = (req.headers.get("origin") || "").trim();
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "");
  const referer = (req.headers.get("referer") || "").trim();
  if (/^https?:\/\//i.test(referer)) {
    try {
      return new URL(referer).origin.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = cleEnvoiEmail();
    const fromDomain = domaineEnvoiEmail();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    // Un envoi ciblé (userId) vient de l'artisan : le jeton doit correspondre à cet utilisateur.
    if (scopeUserId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const authClient = createClient(supabaseUrl, anonKey ?? "", {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData } = await authClient.auth.getUser();
      if (!anonKey || userData?.user?.id !== scopeUserId) {
        return json({ ok: false, error: "Accès non autorisé." }, 401);
      }
    }

    // Mois écoulé : on récapitule du 1er au dernier jour du mois précédent (heure de Paris).
    const { year, month } = parisParts();
    const cible = new Date(year, month - 2, 1);
    const cibleKey = `${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, "0")}`;
    const rangeStart = new Date(cible.getFullYear(), cible.getMonth(), 1);
    const rangeEnd = new Date(cible.getFullYear(), cible.getMonth() + 1, 1);
    const moisLabel = cible.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const moisLabelCap = moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, email, entreprise, metier, pause_jusqu_au, comptable_app_url, comptable_email, comptable_cc_email, mot_de_passe_recap_mensuel_dernier_mois, mot_de_passe_recap_mensuel_actif",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const canSend = Boolean(Deno.env.get("BREVO_API_KEY") || (resendKey && fromDomain));
    const { day: todayDay, hour: todayHour } = parisParts();
    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; total?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre activité");
      // Le comptable est mis en copie des récaps RÉELS, pour garder une trace des rappels
      // de sécurité. On ignore les doublons d'adresse et l'adresse de l'artisan lui-même.
      const comptableEmails = [String(p.comptable_email ?? "").trim(), String(p.comptable_cc_email ?? "").trim()]
        .filter((a) => a && a !== email)
        .filter((a, i, arr) => arr.indexOf(a) === i);
      const copieComptable = !force && comptableEmails.length > 0;

      if (!force && (todayDay !== JOUR_ENVOI || todayHour !== HEURE_ENVOI)) {
        details.push({ userId, sent: false, reason: "Hors créneau d'envoi mensuel." });
        continue;
      }
      if (!force && String(p.mot_de_passe_recap_mensuel_dernier_mois ?? "") === cibleKey) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap déjà envoyé ce mois-ci." });
        continue;
      }
      if (!force && p.mot_de_passe_recap_mensuel_actif === false) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap mensuel coupé dans le profil." });
        continue;
      }
      if (!force && estEnPause(p.pause_jusqu_au)) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Pause vacances." });
        continue;
      }
      if (!email) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email de l'artisan manquant." });
        continue;
      }

      // Décompte des envois de l'alerte sur le mois écoulé.
      const { data: rows, error: rowError } = await admin
        .from("mot_de_passe_alerte_historique")
        .select("manuel")
        .eq("user_id", userId)
        .gte("created_at", rangeStart.toISOString())
        .lt("created_at", rangeEnd.toISOString());
      if (rowError) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Lecture de l'historique impossible." });
        continue;
      }
      const entrees = (rows ?? []) as Array<{ manuel: boolean }>;
      const auto = entrees.filter((e) => !e.manuel).length;
      const tests = entrees.length - auto;
      const total = auto;

      if (preview) {
        // Aperçu : on renvoie le HTML brut du récap mensuel, sans rien expédier, pour que
        // l'application l'affiche tel quel — rendu identique à l'email réellement envoyé.
        const appUrlApercu = resolveAppUrl(p.comptable_app_url, req);
        const htmlApercu = buildEmailHtml({
          nom,
          moisLabelCap,
          total,
          auto,
          tests,
          appUrl: appUrlApercu,
        });
        return json({
          ok: true,
          preview: true,
          html: htmlApercu,
          emetteurNom: nom,
          destinataire: email,
          moisLabel: moisLabelCap,
        });
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Resend non configuré." });
        continue;
      }

      const appUrl = resolveAppUrl(p.comptable_app_url, req);
      try {
        const envoi = await envoyerEmailAvecRepli(
          "recap-mensuel-mot-de-passe",
          {
            nom,
            to: [email],
            cc: copieComptable ? comptableEmails : undefined,
            subject: `Récap mensuel — ${total} alerte${total > 1 ? "s" : ""} mot de passe (${moisLabelCap})`,
            html: buildEmailHtml({ nom, moisLabelCap, total, auto, tests, appUrl }),
          },
          admin,
        );
        if (!envoi.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: envoi.error || "Envoi refusé." });
          continue;
        }
        // Anti-doublon : on mémorise le mois récapitulé et l'horodatage du dernier envoi réel.
        // En test manuel, on ne touche pas à l'anti-doublon : on note seulement la date du test.
        if (!force) {
          await admin
            .from("profiles")
            .update({
              mot_de_passe_recap_mensuel_dernier_mois: cibleKey,
              mot_de_passe_recap_mensuel_dernier_envoi_at: new Date().toISOString(),
            })
            .eq("id", userId);
        } else {
          await admin
            .from("profiles")
            .update({ mot_de_passe_recap_mensuel_test_ok_at: new Date().toISOString() })
            .eq("id", userId);
        }
        // Trace consultable : une ligne par récap effectivement expédié (réel ou test),
        // avec l'indication de la copie au comptable. Alimente le graphe 12 mois du Diagnostic.
        await admin.from("mot_de_passe_recap_historique").insert({
          user_id: userId,
          mois_cle: cibleKey,
          destinataire: email,
          copie_comptable: copieComptable,
          manuel: force,
          created_at: new Date().toISOString(),
        });
        sent += 1;
        details.push({ userId, sent: true, total });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      mois: cibleKey,
      moisLabel: moisLabelCap,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
