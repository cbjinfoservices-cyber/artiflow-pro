import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

// Récapitulatif HEBDOMADAIRE des invitations d'intervenants à relancer.
// Fonction prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée.
// Elle liste, pour chaque artisan, les fiches « invitées sans compte » : l'invitation
// (avec le code) est partie, mais l'intervenant n'a jamais créé son compte. Il reçoit un
// email récapitulatif pour les relancer d'un coup d'œil.
//
// Cadence conseillée : appelée chaque heure ; elle vérifie elle-même le jour/l'heure réglés
// par le responsable (intervenants_recap_jour / intervenants_recap_heure, défaut lundi 08:00,
// heure de Paris) ainsi que l'interrupteur (intervenants_recap_actif), avec un anti-doublon
// stocké sur le profil (intervenants_recap_dernier_envoi).
//
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

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
  return { ok: false, fournisseur: "aucun", repli: false, error: erreurBrevo };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Heure courante (0-23) à l'heure de Paris. */
function parisHour(): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h !== undefined) return Number(h) % 24;
  } catch {
    /* repli sur l'heure serveur */
  }
  return new Date().getHours();
}

/** Jour de la semaine courant à l'heure de Paris (1 = lundi … 7 = dimanche). */
function parisWeekday(): number {
  try {
    const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
    const map: Record<string, number> = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 };
    const key = wd.toLowerCase().replace(".", "").slice(0, 3);
    if (map[key]) return map[key];
  } catch {
    /* repli */
  }
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/** Formate une date en « 07 oct. 2026 ». */
function frDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Nombre de jours entiers écoulés depuis une date (ISO), ou null. */
function joursDepuis(value: unknown): number | null {
  if (!value) return null;
  const t = new Date(String(value)).getTime();
  if (!Number.isNaN(t)) return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  return null;
}

interface FicheARelancer {
  nom: string;
  email: string;
  invitationEnvoyeeLe: string | null;
  code: string | null;
  codeExpire: boolean;
  joursDepuisInvitation: number | null;
}

/** Email récapitulatif : la liste des fiches invitées sans compte, à relancer. */
function buildRecapHtml(nom: string, fiches: FicheARelancer[]): string {
  const lignes = fiches
    .map((f) => {
      const codeCell = f.code
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#fafafa;border:1px solid #e5e5e5;font-family:monospace;font-weight:700;letter-spacing:2px;">${escapeHtml(
            f.code,
          )}</span>${f.codeExpire ? ` <span style="color:#b45309;font-size:11px;">(expiré)</span>` : ""}`
        : "—";
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(f.nom)}
          <br><span style="font-size:11px;color:#71717a;">${escapeHtml(f.email)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${escapeHtml(
          frDate(f.invitationEnvoyeeLe),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#b45309;font-weight:600;">${
          f.joursDepuisInvitation !== null ? `${f.joursDepuisInvitation} j` : "—"
        }</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#18181b;">${codeCell}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Invitations d'intervenants à relancer</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">
          ${fiches.length} fiche${fiches.length > 1 ? "s" : ""} invitée${fiches.length > 1 ? "s" : ""} sans compte
        </div>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
          Ces personnes ont reçu une invitation mais n'ont pas encore créé leur compte. Un petit rappel
          (avec leur code) suffit souvent à débloquer la situation. Ouvrez la fenêtre « Intervenants » de
          votre planning pour les relancer en un clic.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:14px 0 0;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Personne</th>
              <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Invité le</th>
              <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Ancienneté</th>
              <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Code</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Récapitulatif hebdomadaire automatique envoyé par ArtiFlow-pro.</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
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
    const envoiConfigure = Boolean(
      Deno.env.get("BREVO_API_KEY") || (cleEnvoiEmail() && domaineEnvoiEmail()),
    );

    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const dayOverride = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : null;
    const today = new Date().toISOString().slice(0, 10);

    if (!preview && !envoiConfigure) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        skipped: 0,
        reason: "Aucun service d'envoi configuré (Brevo ou Resend).",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Destinataires : les responsables (profils) avec leur nom d'entreprise et l'anti-doublon.
    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, pause_jusqu_au, intervenants_recap_actif, intervenants_recap_jour, intervenants_recap_heure, intervenants_recap_dernier_envoi",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // Toutes les fiches disposant d'un email de compte, regroupées par responsable.
    const { data: intervs, error: intervError } = await admin
      .from("intervenants")
      .select("id, user_id, nom, compte_email, invitation_envoyee_le, code_invitation, code_invitation_expire_le")
      .not("compte_email", "is", null);
    if (intervError) return json({ ok: false, error: intervError.message }, 500);

    const fichesParUser = new Map<string, Array<Record<string, unknown>>>();
    const emailsCompte = new Set<string>();
    (intervs ?? []).forEach((raw) => {
      const row = raw as Record<string, unknown>;
      const uid = String(row.user_id ?? "");
      const email = String(row.compte_email ?? "").trim().toLowerCase();
      if (!uid || !email) return;
      emailsCompte.add(email);
      const arr = fichesParUser.get(uid) ?? [];
      arr.push(row);
      fichesParUser.set(uid, arr);
    });

    // Comptes réellement créés : un profil existe avec cet email.
    const rattaches = new Set<string>();
    if (emailsCompte.size > 0) {
      const { data: profils } = await admin.from("profiles").select("email").in("email", [...emailsCompte]);
      (profils ?? []).forEach((p) => {
        const e = String((p as { email?: unknown }).email ?? "").trim().toLowerCase();
        if (e) rattaches.add(e);
      });
    }

    /** Fiches « invitées mais sans compte » d'un responsable (invitation partie, compte absent). */
    const fichesARelancer = (userId: string): FicheARelancer[] => {
      const rows = fichesParUser.get(userId) ?? [];
      return rows
        .filter((r) => {
          const email = String(r.compte_email ?? "").trim().toLowerCase();
          const invitee = Boolean(r.invitation_envoyee_le);
          return invitee && email && !rattaches.has(email);
        })
        .map((r) => {
          const email = String(r.compte_email ?? "").trim().toLowerCase();
          const expireLe = r.code_invitation_expire_le ? new Date(String(r.code_invitation_expire_le)).getTime() : null;
          return {
            nom: String(r.nom ?? "Intervenant"),
            email,
            invitationEnvoyeeLe: r.invitation_envoyee_le ? String(r.invitation_envoyee_le) : null,
            code: r.code_invitation ? String(r.code_invitation) : null,
            codeExpire: expireLe !== null && Number.isFinite(expireLe) && Date.now() > expireLe,
            joursDepuisInvitation: joursDepuis(r.invitation_envoyee_le),
          };
        })
        .sort((a, b) => (b.joursDepuisInvitation ?? 0) - (a.joursDepuisInvitation ?? 0));
    };

    // Mode aperçu : on construit l'email pour le responsable ciblé sans rien envoyer.
    if (preview && scopeUserId) {
      const rawPrev = (profiles ?? [])[0];
      if (!rawPrev) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pPrev = rawPrev as Record<string, unknown>;
      const nomPrev = String(pPrev.entreprise ?? pPrev.metier ?? "Votre artisan");
      const fichesPrev = fichesARelancer(scopeUserId);
      return json({
        ok: true,
        preview: true,
        html: buildRecapHtml(nomPrev, fichesPrev),
        subject: `Récap invitations · ${fichesPrev.length} fiche${fichesPrev.length > 1 ? "s" : ""} à relancer`,
        nbFiches: fichesPrev.length,
      });
    }

    const cibleHour = hourOverride ?? parisHour();
    const cibleDay = dayOverride ?? parisWeekday();
    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; fiches: number; sent: boolean; reason?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;

      if (!force && enPause) {
        skipped += 1;
        details.push({ userId, fiches: 0, sent: false, reason: "Pause vacances." });
        continue;
      }
      // Interrupteur : le responsable peut couper le récap. Sauf envoi manuel forcé.
      if (!force && p.intervenants_recap_actif === false) {
        details.push({ userId, fiches: 0, sent: false, reason: "Récap des invitations désactivé." });
        continue;
      }
      // Déclenchement au jour/heure réglés sur le profil (défaut lundi 08:00, heure de Paris),
      // sauf test manuel/aperçu (force) ou vérification horaire ignorée.
      const jourRegle = Number.isFinite(Number(p.intervenants_recap_jour))
        ? Math.min(7, Math.max(1, Math.round(Number(p.intervenants_recap_jour))))
        : 1;
      const heureRegle = Number.isFinite(Number(p.intervenants_recap_heure))
        ? Math.min(23, Math.max(0, Math.round(Number(p.intervenants_recap_heure))))
        : 8;
      if (!force && !ignoreTime && (cibleHour !== heureRegle || cibleDay !== jourRegle)) {
        details.push({ userId, fiches: 0, sent: false });
        continue;
      }
      // Anti-doublon : pas plus d'un récap par semaine.
      if (!force) {
        const dernier = p.intervenants_recap_dernier_envoi
          ? new Date(String(p.intervenants_recap_dernier_envoi)).getTime()
          : 0;
        if (dernier && Date.now() - dernier < 6 * 86_400_000) {
          details.push({ userId, fiches: 0, sent: false, reason: "Déjà envoyé cette semaine." });
          continue;
        }
      }

      const fiches = fichesARelancer(userId);
      // Rien à relancer : on n'envoie pas d'email vide.
      if (fiches.length === 0) {
        details.push({ userId, fiches: 0, sent: false });
        continue;
      }
      if (!email) {
        skipped += 1;
        details.push({ userId, fiches: fiches.length, sent: false, reason: "Email manquant." });
        continue;
      }

      const subject = `Récap invitations · ${fiches.length} fiche${fiches.length > 1 ? "s" : ""} invitée${
        fiches.length > 1 ? "s" : ""
      } sans compte`;
      try {
        const envoi = await envoyerEmailAvecRepli(
          "recap-invitations-intervenants",
          {
            nom,
            to: [email],
            subject,
            html: buildRecapHtml(nom, fiches),
          },
          admin,
        );
        if (envoi.ok) {
          sent += 1;
          await admin
            .from("profiles")
            .update({ intervenants_recap_dernier_envoi: new Date().toISOString() })
            .eq("id", userId);
          details.push({ userId, fiches: fiches.length, sent: true });
        } else {
          skipped += 1;
          details.push({
            userId,
            fiches: fiches.length,
            sent: false,
            reason: envoi.error || "Envoi refusé.",
          });
        }
      } catch (e) {
        skipped += 1;
        details.push({
          userId,
          fiches: fiches.length,
          sent: false,
          reason: e instanceof Error ? e.message : "Erreur d'envoi.",
        });
      }
    }

    return json({
      ok: true,
      configured: true,
      users: scopeUserId ? 1 : (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
