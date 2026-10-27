import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

// RÉCAP TRIMESTRIEL par email au comptable : listing des récaps mensuels « mot de passe
// ancien » réellement envoyés à l'artisan au cours du trimestre écoulé. Sert de trace des
// rappels de sécurité transmis, en plus du récap mensuel habituel.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée.
// Comme le passage est quotidien/horaire, chaque envoi n'a lieu que le 1er des mois de
// clôture (janvier, avril, juillet, octobre) à 09:00 (heure de Paris), une seule fois par
// trimestre (anti-doublon via mot_de_passe_recap_trimestre_dernier).
// Un appel avec { userId, force: true } (bouton « Tester ») envoie tout de suite le récap
// du trimestre à l'artisan, sans tenir compte du jour ni de l'anti-doublon.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JOUR_ENVOI = 1; // 1er des mois de clôture trimestrielle
const HEURE_ENVOI = 9; // 09:00, heure de Paris
const MOIS_CLOTURE = [1, 4, 7, 10]; // mois de clôture d'un trimestre

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

/** Parties « jour / heure / année / mois » à l'heure de Paris. */
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

/** Libellé long « octobre 2026 » à partir d'une clé « AAAA-MM ». */
function libelleMoisCle(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return cle;
  const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface LigneRecap {
  moisLabel: string;
  dateLabel: string;
  heureLabel: string;
  type: string;
  destinataire: string;
  copieComptable: boolean;
}

function buildEmailHtml(params: {
  nom: string;
  trimestreLabel: string;
  lignes: LigneRecap[];
  total: number;
  reels: number;
  tests: number;
  appUrl: string;
}): string {
  const { nom, trimestreLabel, lignes, total, reels, tests, appUrl } = params;
  const link = appUrl ? `${appUrl}/app` : "";
  const bouton = link
    ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Ouvrir le suivi des récaps</a>
        </p>`
    : "";
  const rows = lignes.length
    ? lignes
        .map(
          (l) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(l.moisLabel)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${escapeHtml(l.dateLabel)}${l.heureLabel ? ` · ${escapeHtml(l.heureLabel)}` : ""}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:${l.type === "Automatique" ? "#b45309" : "#7a583c"};">${escapeHtml(l.type)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${escapeHtml(l.destinataire || "—")}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:${l.copieComptable ? "#15803d" : "#a1a1aa"};">${l.copieComptable ? "Oui" : "Non"}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" style="padding:12px 10px;font-size:13px;color:#71717a;">Aucun récap mensuel envoyé sur le trimestre.</td></tr>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap trimestriel des alertes « mot de passe ancien » · ${escapeHtml(trimestreLabel)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Voici, en copie pour votre suivi, la liste des <strong>récaps mensuels de sécurité</strong> envoyés à
          l'artisan au cours du trimestre <strong>${escapeHtml(trimestreLabel)}</strong>. Ces rappels l'invitent à
          renouveler son mot de passe lorsqu'il approche des 6 mois.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
          <tr>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#18181b;">${total}</div>
              <div style="font-size:11px;color:#71717a;">récap${total > 1 ? "s" : ""} au total</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#b45309;">${reels}</div>
              <div style="font-size:11px;color:#71717a;">automatique${reels > 1 ? "s" : ""}</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:14px;background:#fafafa;border:1px solid #eee;border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#18181b;">${tests}</div>
              <div style="font-size:11px;color:#71717a;">test${tests > 1 ? "s" : ""}</div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Détail des récaps du trimestre</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:10px;color:#71717a;text-transform:uppercase;">Mois récapitulé</th>
            <th style="text-align:left;padding:6px 10px;font-size:10px;color:#71717a;text-transform:uppercase;">Envoi</th>
            <th style="text-align:left;padding:6px 10px;font-size:10px;color:#71717a;text-transform:uppercase;">Type</th>
            <th style="text-align:left;padding:6px 10px;font-size:10px;color:#71717a;text-transform:uppercase;">Destinataire</th>
            <th style="text-align:left;padding:6px 10px;font-size:10px;color:#71717a;text-transform:uppercase;">Comptable</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${bouton}
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Ce récapitulatif trimestriel vous est adressé une fois par trimestre pour conserver une trace des rappels de sécurité.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-Pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
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
    const force = body?.force === true;
    const preview = body?.preview === true;
    const ignoreTime = body?.ignoreTime === true;
    // Un aperçu se comporte comme un envoi « forcé » : il ignore le créneau, l'anti-doublon,
    // l'interrupteur et la pause, mais il ne déclenche strictement aucun envoi.
    const bypass = force || preview;

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

    const { day: todayDay, hour: todayHour, year, month } = parisParts();

    // Trimestre qui vient de s'achever : le mois précédent détermine le trimestre visé.
    let refYear = year;
    let refMonth = month - 1;
    if (refMonth < 1) {
      refMonth = 12;
      refYear = year - 1;
    }
    const qIndex = Math.floor((refMonth - 1) / 3); // 0..3
    const qNum = qIndex + 1;
    const rangeStart = new Date(refYear, qIndex * 3, 1);
    const rangeEnd = new Date(refYear, qIndex * 3 + 3, 1);
    const trimestreCle = `${refYear}-T${qNum}`;
    const trimestreLabel = `T${qNum} ${refYear}`;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, email, entreprise, metier, pause_jusqu_au, comptable_app_url, comptable_email, comptable_cc_email, mot_de_passe_recap_trimestre_dernier, mot_de_passe_recap_mensuel_actif, mot_de_passe_recap_trimestriel_actif",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const canSend = Boolean(Deno.env.get("BREVO_API_KEY") || (resendKey && fromDomain));
    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; total?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const artisanEmail = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre activité");
      const comptableEmails = [String(p.comptable_email ?? "").trim(), String(p.comptable_cc_email ?? "").trim()]
        .filter((a) => a)
        .filter((a, i, arr) => arr.indexOf(a) === i);

      // Fenêtre planifiée : uniquement le 1er d'un mois de clôture trimestrielle, à 09:00.
      if (!bypass && !ignoreTime && (todayDay !== JOUR_ENVOI || todayHour !== HEURE_ENVOI)) {
        details.push({ userId, sent: false, reason: "Hors créneau d'envoi trimestriel." });
        continue;
      }
      if (!bypass && !ignoreTime && !MOIS_CLOTURE.includes(month)) {
        details.push({ userId, sent: false, reason: "Hors mois de clôture trimestrielle." });
        continue;
      }
      if (!bypass && String(p.mot_de_passe_recap_trimestre_dernier ?? "") === trimestreCle) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap trimestriel déjà envoyé." });
        continue;
      }
      if (!bypass && p.mot_de_passe_recap_trimestriel_actif === false) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap trimestriel coupé." });
        continue;
      }
      if (!bypass && estEnPause(p.pause_jusqu_au)) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Pause vacances." });
        continue;
      }

      // Destinataire : le comptable en usage normal, l'artisan en test (force) ou en aperçu.
      const destinataire = bypass ? artisanEmail : comptableEmails[0] ?? "";
      if (!bypass && comptableEmails.length === 0) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (!destinataire) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du destinataire manquant." });
        continue;
      }

      // Recaps mensuels réellement envoyés sur le trimestre (RLS contournée : service role).
      const { data: rows, error: rowError } = await admin
        .from("mot_de_passe_recap_historique")
        .select("mois_cle, destinataire, copie_comptable, manuel, created_at")
        .eq("user_id", userId)
        .gte("created_at", rangeStart.toISOString())
        .lt("created_at", rangeEnd.toISOString())
        .order("created_at", { ascending: true });
      if (rowError) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Lecture de l'historique impossible." });
        continue;
      }

      const entrees = (rows ?? []) as Array<Record<string, unknown>>;
      const lignes: LigneRecap[] = entrees.map((r) => {
        const d = new Date(String(r.created_at ?? ""));
        const valide = !Number.isNaN(d.getTime());
        return {
          moisLabel: libelleMoisCle(String(r.mois_cle ?? "")),
          dateLabel: valide ? d.toLocaleDateString("fr-FR") : String(r.created_at ?? ""),
          heureLabel: valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
          type: r.manuel === true ? "Test manuel" : "Automatique",
          destinataire: r.destinataire == null ? "" : String(r.destinataire),
          copieComptable: r.copie_comptable === true,
        };
      });
      const reels = entrees.filter((e) => e.manuel !== true).length;
      const tests = entrees.length - reels;

      if (entrees.length === 0 && !bypass) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun récap sur le trimestre." });
        continue;
      }
      if (preview) {
        // Aperçu : on renvoie le HTML brut du récap trimestriel, sans rien expédier, pour
        // que l'application l'affiche tel quel — rendu identique à l'email réellement envoyé.
        const appUrlApercu = resolveAppUrl(p.comptable_app_url, req);
        const htmlApercu = buildEmailHtml({
          nom,
          trimestreLabel,
          lignes,
          total: entrees.length,
          reels,
          tests,
          appUrl: appUrlApercu,
        });
        return json({
          ok: true,
          preview: true,
          html: htmlApercu,
          emetteurNom: nom,
          destinataire,
          trimestreLabel,
        });
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Resend non configuré." });
        continue;
      }

      const appUrl = resolveAppUrl(p.comptable_app_url, req);
      const subject = force
        ? `Récap trimestriel des alertes mot de passe (test) — ${trimestreLabel}`
        : `Récap trimestriel des alertes mot de passe — ${trimestreLabel}`;
      try {
        const envoi = await envoyerEmailAvecRepli(
          "recap-trimestriel-mot-de-passe",
          {
            nom,
            to: [destinataire],
            cc: !force && comptableEmails.length > 1 ? comptableEmails.slice(1) : undefined,
            subject,
            html: buildEmailHtml({
              nom,
              trimestreLabel,
              lignes,
              total: entrees.length,
              reels,
              tests,
              appUrl,
            }),
          },
          admin,
        );
        if (!envoi.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: envoi.error || "Envoi refusé." });
          continue;
        }
        // Anti-doublon : on mémorise le trimestre récapitulé (jamais en test manuel).
        if (!force) {
          await admin
            .from("profiles")
            .update({ mot_de_passe_recap_trimestre_dernier: trimestreCle, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        sent += 1;
        details.push({ userId, sent: true, total: entrees.length });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      trimestre: trimestreCle,
      trimestreLabel,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
