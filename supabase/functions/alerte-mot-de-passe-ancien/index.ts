import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Alerte à l'artisan : son mot de passe n'a pas été renouvelé depuis longtemps.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée
// QUOTIDIENNE. Chaque passage n'alerte que les comptes concernés, une seule fois
// par changement de mot de passe (anti-doublon via mot_de_passe_alerte_email_at).
// L'interrupteur du profil (mot_de_passe_alerte_email_actif) coupe l'alerte : si
// l'artisan l'a désactivé, aucun email n'est envoyé.
// Un appel avec { userId, force: true } expédie immédiatement l'email pour vérifier
// le rendu, sans tenir compte du seuil ni de l'anti-doublon. Cet appel ciblé doit
// provenir de l'artisan lui-même (le jeton doit correspondre au userId demandé).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEUIL_JOURS = 180;
const COOLDOWN_JOURS = 30;

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
 * Aucune alerte n'est perdue, même si Brevo est en incident. La tentative est
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
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
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

function dernierChangement(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  let meilleur: string | null = null;
  let meilleurT = -Infinity;
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) continue;
    if (t > meilleurT) {
      meilleurT = t;
      meilleur = v;
    }
  }
  return meilleur;
}

function libelleAnciennete(jours: number): string {
  if (jours >= 365) return "plus d'un an";
  const mois = Math.max(1, Math.round(jours / 30));
  return mois <= 1 ? "environ un mois" : `environ ${mois} mois`;
}

function buildHtml(params: { emetteurNom: string; jours: number; appUrl: string }): string {
  const { emetteurNom, jours, appUrl } = params;
  const link = appUrl ? `${appUrl}/app/profil` : "";
  const bouton = link
    ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Modifier mon mot de passe</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;">
          Ouvre la page « Mon profil » → « Sécurité du compte », où vous définissez un nouveau mot de passe.
        </p>`
    : `<p style="margin:0;font-size:12px;color:#a1a1aa;">Ouvrez votre profil, rubrique « Sécurité du compte », pour renouveler votre mot de passe.</p>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">Sécurité : renouvelez votre mot de passe</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">${escapeHtml(emetteurNom)}</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;font-size:14px;color:#9a3412;margin:0 0 18px;">
          Votre mot de passe n'a pas été changé depuis <strong>${escapeHtml(libelleAnciennete(jours))}</strong>.
        </div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Pour protéger votre espace ArtiFlow-pro et vos données clients, nous vous recommandons de renouveler
          régulièrement votre mot de passe. Un mot de passe ancien augmente le risque d'accès non autorisé.
        </p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Choisissez un mot de passe solide : au moins <strong>8 caractères</strong>, avec une majuscule, une minuscule,
          un chiffre et un caractère spécial.
        </p>
        ${bouton}
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Vous recevez cet email car votre mot de passe dépasse le seuil de 6 mois recommandé. Il ne sera renvoyé
          qu'en cas de nouveau dépassement.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    // Un envoi ciblé (userId) est déclenché par l'artisan depuis l'application : on exige
    // alors que le jeton fourni corresponde bien à cet utilisateur (le cron appelle sans userId).
    const estTestUtilisateur = force && Boolean(scopeUserId);
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

    const canSend = Boolean(Deno.env.get("BREVO_API_KEY") || (resendKey && fromDomain));
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, email, entreprise, metier, mot_de_passe_changements, mot_de_passe_alerte_snooze, mot_de_passe_alerte_email_actif, mot_de_passe_alerte_email_at, mot_de_passe_alerte_test_ok_at, comptable_app_url, created_at",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const aujourdhui = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      // Un aperçu (preview) se comporte comme un envoi « forcé » : il ignore le seuil,
      // la mise de côté et l'anti-doublon, mais ne déclenche strictement aucun envoi.
      const bypass = force || preview;
      const dernier = dernierChangement(p.mot_de_passe_changements);
      const dateRef = dernier ?? (typeof p.created_at === "string" ? p.created_at : null);
      const jours = dateRef ? Math.max(0, Math.floor((Date.now() - new Date(dateRef).getTime()) / 86400000)) : null;

      if (!bypass && (jours === null || jours < SEUIL_JOURS)) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Mot de passe récent." });
        continue;
      }

      // Interrupteur du profil : l'artisan peut couper l'email d'alerte.
      if (!bypass && p.mot_de_passe_alerte_email_actif === false) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Alerte coupée par l'artisan." });
        continue;
      }

      const snooze = String(p.mot_de_passe_alerte_snooze ?? "");
      if (!bypass && snooze && snooze >= aujourdhui) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Alerte mise de côté." });
        continue;
      }

      const dernierEnvoi = typeof p.mot_de_passe_alerte_email_at === "string" ? p.mot_de_passe_alerte_email_at : null;
      if (!bypass && dernierEnvoi) {
        const tEnvoi = new Date(dernierEnvoi).getTime();
        const dansCooldown = Date.now() - tEnvoi < COOLDOWN_JOURS * 86400000;
        const memeChangement = dernier ? new Date(dernier).getTime() <= tEnvoi : true;
        if (dansCooldown && memeChangement) {
          skipped += 1;
          details.push({ userId, sent: false, reason: "Alerte déjà envoyée récemment." });
          continue;
        }
      }

      if (!email) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email de l'artisan manquant." });
        continue;
      }
      if (preview) {
        // Aperçu : on renvoie le HTML brut de l'email, sans rien expédier, pour que
        // l'application l'affiche tel quel — rendu identique à l'email réellement envoyé.
        const emetteurNomApercu = String(p.entreprise || p.metier || "Votre activité");
        const appUrlApercu = resolveAppUrl(p.comptable_app_url, req);
        const htmlApercu = buildHtml({
          emetteurNom: emetteurNomApercu,
          jours: jours ?? SEUIL_JOURS,
          appUrl: appUrlApercu,
        });
        return json({
          ok: true,
          preview: true,
          html: htmlApercu,
          emetteurNom: emetteurNomApercu,
          destinataire: email,
        });
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Resend non configuré." });
        continue;
      }

      const emetteurNom = String(p.entreprise || p.metier || "Votre activité");
      const appUrl = resolveAppUrl(p.comptable_app_url, req);
      const html = buildHtml({ emetteurNom, jours: jours ?? SEUIL_JOURS, appUrl });
      try {
        const envoi = await envoyerEmailAvecRepli(
          "alerte-mot-de-passe-ancien",
          {
            nom: emetteurNom,
            to: [email],
            subject: "Sécurité : renouvelez votre mot de passe ArtiFlow-pro",
            html,
          },
          admin,
        );
        if (!envoi.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: envoi.error || "Envoi refusé." });
          continue;
        }
        if (force) {
          // Envoi de test à la demande : on horodate le dernier test réussi (affiché au Diagnostic).
          if (estTestUtilisateur) {
            await admin
              .from("profiles")
              .update({ mot_de_passe_alerte_test_ok_at: new Date().toISOString() })
              .eq("id", userId);
          }
        } else {
          await admin
            .from("profiles")
            .update({ mot_de_passe_alerte_email_at: new Date().toISOString() })
            .eq("id", userId);
        }
        // Trace consultable : chaque envoi (réel par la tâche planifiée, ou test à la demande)
        // est consigné dans l'historique, avec l'ancienneté et le destinataire au moment de l'envoi.
        await admin.from("mot_de_passe_alerte_historique").insert({
          user_id: userId,
          destinataire: email,
          anciennete_jours: jours ?? SEUIL_JOURS,
          manuel: force,
        });
        sent += 1;
        details.push({ userId, sent: true });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      seuilJours: SEUIL_JOURS,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
