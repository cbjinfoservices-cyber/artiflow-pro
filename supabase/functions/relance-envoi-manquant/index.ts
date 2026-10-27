import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Alerte à l'artisan : un mois attendu est resté sans envoi automatique du journal
// comptable, passé un délai après le jour d'envoi choisi.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée
// QUOTIDIENNE. Chaque passage n'alerte que les artisans concernés, une seule fois
// par mois manquant (anti-doublon via comptable_relance_dernier_cle).
// Un appel avec { userId, force: true } (bouton « Tester maintenant ») expédie
// immédiatement l'email à l'artisan pour vérifier le rendu, sans toucher au repère
// anti-doublon ni au mois en cours.

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

interface DocIdentite {
  accent: string;
  logoHtml: string;
  piedHtml: string;
}

/**
 * Identité visuelle des documents reprise du profil de l'artisan : couleur d'accent,
 * logo (optionnel) et message de pied de page. Reprise ici pour une identité cohérente
 * avec les PDF et les autres emails automatiques.
 */
function docIdentite(p: Record<string, unknown>): DocIdentite {
  const nom = String(p?.entreprise ?? p?.metier ?? "Votre artisan");
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(p?.doc_couleur ?? "")) ? String(p?.doc_couleur) : "#C4783A";
  const logoUrl = p?.doc_afficher_logo !== false ? String(p?.logo_url ?? "").trim() : "";
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nom)}" style="max-height:44px;max-width:180px;display:block;margin:0 0 10px;">`
    : "";
  const pied = String(p?.doc_pied_page ?? "").trim();
  const piedHtml = pied
    ? `<p style="margin:10px 0 0;font-size:11px;color:#a1a1aa;">${escapeHtml(pied).replace(/\n/g, "<br>")}</p>`
    : "";
  return { accent, logoHtml, piedHtml };
}

/** Jour / mois / année courants à Paris (l'envoi automatique est calé sur cette zone). */
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

/**
 * Base publique de l'application, pour construire le lien direct vers l'Espace
 * comptable dans l'email. On utilise l'URL mémorisée dans le profil, sinon l'en-tête
 * Origin/Referer de la requête (présent lors d'un envoi déclenché depuis le site).
 */
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

/** Corps HTML de l'email d'alerte adressé à l'artisan. */
function buildAlerteHtml(params: {
  emetteurNom: string;
  moisLabel: string;
  /** Clé du mois attendu (« AAAA-MM »), pour pré-filtrer l'Espace comptable. */
  moisCle: string;
  jourChoisi: number;
  delai: number;
  appUrl: string;
  /** Nombre total de mois manquants (pour le bouton de renvoi groupé). */
  manquantsCount: number;
  identite: DocIdentite;
}): string {
  const { emetteurNom, moisLabel, moisCle, jourChoisi, delai, appUrl, manquantsCount, identite } = params;
  const link = appUrl ? `${appUrl}/app/comptabilite` : "";
  // Lien pré-rempli : ouvre l'Espace comptable déjà filtré sur le mois manquant,
  // pour renvoyer ce mois en un clic sans avoir à le rechercher dans l'historique.
  const renvoiLink = appUrl && moisCle ? `${appUrl}/app/comptabilite?mois=${encodeURIComponent(moisCle)}` : "";
  // Lien groupé : ouvre l'Espace comptable avec l'alerte de régularité dépliée sur
  // tous les mois concernés, prêt à les renvoyer d'un seul geste.
  const tousLink = appUrl ? `${appUrl}/app/comptabilite?manquants=1` : "";
  const groupeBouton =
    manquantsCount > 1 && tousLink
      ? `<p style="margin:16px 0 0;">
          <a href="${escapeHtml(tousLink)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#ffffff;border:1px solid #b45309;color:#b45309;font-size:13px;font-weight:700;text-decoration:none;">Renvoyer tous les mois manquants (${manquantsCount})</a>
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
          Ouvre votre Espace comptable avec l'alerte dépliée sur les ${manquantsCount} mois concernés, pour les renvoyer tous ensemble.
        </p>`
      : "";
  const bouton = renvoiLink
    ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(renvoiLink)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Renvoyer ce mois</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;">
          Ce bouton ouvre votre Espace comptable déjà filtré sur ${escapeHtml(moisLabel)} : renvoyez ce mois au comptable en un clic.
        </p>${link ? `
        <p style="margin:8px 0 0;">
          <a href="${escapeHtml(link)}" style="font-size:12px;color:#71717a;text-decoration:underline;">Ou ouvrir l'Espace comptable</a>
        </p>` : ""}`
    : link
      ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Ouvrir l'Espace comptable</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;">
          Depuis l'alerte de régularité, cliquez « Renvoyer ce mois » pour expédier le journal en un clic.
        </p>`
      : `<p style="margin:0;font-size:12px;color:#a1a1aa;">Ouvrez votre Espace comptable pour renvoyer le journal de ce mois en un clic.</p>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${identite.accent};"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        ${identite.logoHtml}
        <p style="margin:0;font-size:18px;font-weight:700;">Journal comptable : un mois reste sans envoi</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">${escapeHtml(emetteurNom)}</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;font-size:14px;color:#92400e;margin:0 0 18px;">
          Aucun envoi automatique n'a été effectué pour <strong>${escapeHtml(moisLabel)}</strong>.
        </div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Votre envoi automatique mensuel du journal comptable est configuré pour partir le
          <strong>${jourChoisi === 1 ? "1er" : jourChoisi}</strong> du mois. Plus de
          <strong>${delai} jour${delai > 1 ? "s" : ""}</strong> se sont écoulés et le mois de
          <strong>${escapeHtml(moisLabel)}</strong> n'a toujours pas été transmis à votre comptable.
        </p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Causes possibles : envoi automatique désactivé, email du comptable manquant, ou configuration d'envoi d'emails
          incomplète. Ouvrez l'Espace comptable pour vérifier vos réglages et, si besoin, renvoyer le journal de ce mois
          au comptable en un clic.
        </p>
        ${bouton}
        ${groupeBouton}
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Vous recevez cet email car l'alerte « mois sans envoi automatique » est activée dans votre profil.
          Vous pouvez la désactiver à tout moment depuis l'Espace comptable.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.</p>
        ${identite.piedHtml}
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
    const resendKey = cleEnvoiEmail();
    const fromDomain = domaineEnvoiEmail();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    // Mode test : envoi immédiat à l'artisan, sans tenir compte du délai ni de l'anti-doublon.
    const force = body?.force === true;

    const canSend = Boolean(resendKey && fromDomain);
    const { day: todayDay, year, month } = parisParts();
    // Mois attendu = mois écoulé (celui que l'envoi automatique du mois courant doit transmettre).
    const prev = new Date(year, month - 2, 1);
    const expectedKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const rawLabel = prev.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const expectedLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page, comptable_auto_actif, comptable_auto_jour, comptable_auto_dernier_mois, comptable_relance_manquante_actif, comptable_relance_delai, comptable_relance_dernier_cle, comptable_app_url",
      );
    if (scopeUserId) {
      // En mode test, on cible uniquement cet artisan sans exiger que ses interrupteurs soient actifs.
      query = query.eq("id", scopeUserId);
      if (!force) {
        query = query.eq("comptable_auto_actif", true).eq("comptable_relance_manquante_actif", true);
      }
    } else {
      query = query.eq("comptable_auto_actif", true).eq("comptable_relance_manquante_actif", true);
    }
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const artisanEmail = String(p.email ?? "").trim();
      const jourChoisi =
        Number.isFinite(Number(p.comptable_auto_jour)) && Number(p.comptable_auto_jour) > 0
          ? Number(p.comptable_auto_jour)
          : 1;
      const delai =
        Number.isFinite(Number(p.comptable_relance_delai)) && Number(p.comptable_relance_delai) > 0
          ? Number(p.comptable_relance_delai)
          : 3;
      const dernierAuto = String(p.comptable_auto_dernier_mois ?? "");
      const relanceDernierCle = String(p.comptable_relance_dernier_cle ?? "");

      // Trop tôt : on laisse à l'envoi automatique le temps de partir (jour + délai).
      if (!force && todayDay < jourChoisi + delai) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Délai non dépassé." });
        continue;
      }
      // Le mois attendu a bien été transmis automatiquement : rien à signaler.
      if (!force && dernierAuto === expectedKey) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Mois déjà envoyé automatiquement." });
        continue;
      }
      // L'artisan a déjà été prévenu pour ce mois : anti-doublon.
      if (!force && relanceDernierCle === expectedKey) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Alerte déjà envoyée ce mois-ci." });
        continue;
      }
      if (!artisanEmail) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email de l'artisan manquant." });
        continue;
      }

      if (preview) {
        details.push({ userId, sent: false, reason: "Aperçu." });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Resend non configuré." });
        continue;
      }

      const emetteurNom = String(p.entreprise || p.metier || "Votre activité");
      const appUrl = resolveAppUrl(p.comptable_app_url, req);
      // Liste des mois attendus restés sans envoi automatique : sert au lien « Renvoyer
      // tous les mois manquants » qui ouvre l'Espace comptable avec l'alerte dépliée.
      const { data: envoisAuto } = await admin
        .from("envois_email")
        .select("created_at, mode")
        .eq("user_id", userId)
        .eq("type", "comptable");
      const autoMonths = new Set<string>();
      let premierAuto: string | null = null;
      for (const r of (envoisAuto ?? []) as Array<Record<string, unknown>>) {
        if (String(r.mode ?? "").toLowerCase() !== "automatique") continue;
        const d = new Date(String(r.created_at ?? ""));
        if (Number.isNaN(d.getTime())) continue;
        const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        autoMonths.add(cle);
        if (premierAuto === null || cle < premierAuto) premierAuto = cle;
      }
      let manquantsCount = 0;
      if (premierAuto !== null) {
        const [fy, fm] = premierAuto.split("-").map((v) => Number(v));
        let yy = fy;
        let mm = fm + 1;
        if (mm > 12) {
          mm = 1;
          yy += 1;
        }
        const cleCourante = `${year}-${String(month).padStart(2, "0")}`;
        while (true) {
          const cle = `${yy}-${String(mm).padStart(2, "0")}`;
          if (cle >= cleCourante) break;
          if (!autoMonths.has(cle)) manquantsCount += 1;
          mm += 1;
          if (mm > 12) {
            mm = 1;
            yy += 1;
          }
        }
      }
      const html = buildAlerteHtml({
        emetteurNom,
        moisLabel: expectedLabel,
        moisCle: expectedKey,
        jourChoisi,
        delai,
        appUrl,
        manquantsCount,
        identite: docIdentite(p),
      });
      try {
        const res = await envoyerEmail("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${emetteurNom} <noreply@${fromDomain}>`,
            to: [artisanEmail],
            subject: `Journal comptable — ${expectedLabel} : aucun envoi automatique`,
            html,
          }),
        });
        if (!res.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: "Refus de Resend." });
          continue;
        }
        // Le repère anti-doublon n'est posé que par un passage réel (pas un test forcé),
        // pour ne pas court-circuiter l'alerte du mois en cours.
        if (!force) {
          await admin
            .from("profiles")
            .update({ comptable_relance_dernier_cle: expectedKey, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
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
      month: expectedKey,
      monthLabel: expectedLabel,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
