import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récapitulatif HEBDOMADAIRE par email : liste, pour chaque artisan, les comptes très
// volatils toujours « à recontacter » depuis plus de N jours (N = seuil « Rappel après »
// réglable dans le back-office Abonnements, mémorisé dans le profil).
//
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir Agents → Tâches planifiées), à déclencher une fois par semaine.
// Un appel avec `preview: true` renvoie simplement le HTML de l'email, sans rien envoyer.
//
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN
// dans les secrets du Backend (à activer depuis le panneau Resend).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Seuil au-delà duquel un abonnement est jugé « très volatil » (changements d'offre sur 6 mois). */
const SEUIL_TRES_VOLATIL = 3;

/** Délai de rappel (en jours) par défaut si le profil ne l'a pas réglé. */
const DELAI_DEFAUT = 7;

/** Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle (semaine sécurisée). */
const INTERVALLE_MIN_JOURS = 6;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type EnvoiEmailOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

type ResultatEnvoiEmail = {
  ok: boolean;
  fournisseur: "brevo" | "resend" | "aucun";
  repli: boolean;
  id?: string;
  error?: string;
};

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas : un récap de recontact, une auto-relance ou une alerte
 * n'est jamais perdu à cause d'un seul fournisseur. Chaque tentative est tracée pour la
 * carte « Suivi des envois » du back-office.
 * `simulerEchecBrevo` force un échec Brevo (bouton « Tester le repli ») sans appeler Brevo.
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiEmailOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  options?: { simulerEchecBrevo?: boolean },
): Promise<ResultatEnvoiEmail> {
  const tracer = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* la trace ne doit jamais bloquer un envoi */
    }
  };

  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
  let erreurBrevo = "";

  if (options?.simulerEchecBrevo) {
    erreurBrevo = "Test du repli : échec Brevo simulé volontairement.";
    await tracer("brevo", "echec", false, erreurBrevo);
  } else if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc && opts.cc.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment:
            opts.attachments && opts.attachments.length
              ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { messageId?: string; message?: string } | null;
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false, id: data?.messageId };
      }
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await tracer("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await tracer("brevo", "echec", false, erreurBrevo);
    }
  } else {
    erreurBrevo = "Clé API Brevo absente.";
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
          cc: opts.cc && opts.cc.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments && opts.attachments.length ? opts.attachments : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true, id: data?.id };
      }
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }

  return {
    ok: false,
    fournisseur: "aucun",
    repli: true,
    error: "Aucun service d'envoi configuré (Resend non paramétré).",
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remplace les variables {{clef}} d'un modèle email par leurs valeurs (modèles personnalisés). */
function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Ligne {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  nbChangements: number;
  joursDepuis: number;
  dernierChangement: string | null;
}

/** Construit l'email récapitulatif hebdomadaire des comptes à recontacter. */
function buildHtml(nom: string, delaiJours: number, lignes: Ligne[], corps?: string | null): string {
  const introDefaut = `Ces comptes ont changé d'offre plusieurs fois (au moins ${SEUIL_TRES_VOLATIL} fois sur 6 mois), leur dernier changement remonte à plus de ${delaiJours} jours, et aucun recontact ne leur a encore été envoyé. C'est le bon moment pour reprendre contact.`;
  const intro = corps && corps.trim() ? corps.trim() : introDefaut;
  const introHtml = escapeHtml(intro).replace(/\n/g, "<br>");
  const rows = lignes
    .map(
      (l) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(
          l.entreprise,
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#71717a;">${escapeHtml(
          l.email ?? "Email non renseigné",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#b45309;font-weight:600;">${l.nbChangements} chg. / 6 mois</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;text-align:right;">il y a ${l.joursDepuis} j</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap hebdomadaire des recontacts · ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${lignes.length} compte${lignes.length > 1 ? "s" : ""} très volatil${lignes.length > 1 ? "s" : ""} à recontacter
        </div>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
          ${introHtml}
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Compte</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Email</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Volatilité</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Depuis</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Ouvrez la page Abonnements pour les recontacter en un clic (bouton « Contacter tous ») · dernier changement le plus ancien mis en avant.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Email de recontact envoyé à un artisan lors de l'auto-relance d'un compte oublié. */
function buildRecontactHtml(message: string, entreprise: string): string {
  const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">ArtiFlow-pro</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Suivi de votre abonnement</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">${messageHtml}</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro${entreprise ? ` au sujet de ${escapeHtml(entreprise)}` : ""}.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Email d'alerte envoyé à l'artisan quand l'auto-relance des oubliés a réellement expédié des relances le jour même. */
function buildAlerteAutoRelanceHtml(
  nom: string,
  comptes: Array<{ entreprise: string; email: string }>,
  corps?: string | null,
): string {
  const rows = comptes
    .map(
      (c) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(c.entreprise)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#71717a;">${escapeHtml(c.email)}</td>
      </tr>`,
    )
    .join("");
  const n = comptes.length;
  const introDefaut = `Bonne nouvelle : l'auto-relance des comptes oubliés a réellement envoyé ${n} email${n > 1 ? "s" : ""} de recontact aujourd'hui, pour les comptes suivants.`;
  const intro = corps && corps.trim() ? escapeHtml(corps.trim()).replace(/\n/g, "<br>") : introDefaut;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Auto-relance des oubliés · ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:12px;font-weight:700;">
          ${n} relance${n > 1 ? "s" : ""} automatique${n > 1 ? "s" : ""} expédiée${n > 1 ? "s" : ""} aujourd'hui
        </div>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
          ${intro}
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Compte</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Destinataire</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Vous pouvez couper cette alerte ou revoir le message d'auto-relance depuis les réglages des Abonnements et de votre profil.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Objet par défaut de l'email d'alerte artisan (nombre de comptes recontactés). */
function sujetAlerteArtisanDefaut(n: number): string {
  return `Auto-relance : ${n} compte${n > 1 ? "s" : ""} recontacté${n > 1 ? "s" : ""} aujourd'hui`;
}

/**
 * Objet de l'email d'alerte artisan : personnalisable (variables {{nombre}} / {{entreprise}}),
 * avec repli sur l'objet par défaut si rien n'est réglé.
 */
function sujetAlerteArtisan(template: string, n: number, nom: string): string {
  const perso = applyTemplate(template, { nombre: String(n), entreprise: nom }).trim();
  return perso || sujetAlerteArtisanDefaut(n);
}

/** Objet et message par défaut de l'auto-relance d'un compte oublié. */
const SUJET_RECONTACT_AUTO = "Votre abonnement ArtiFlow-pro — un point sur votre formule";
const MESSAGE_RECONTACT_AUTO = [
  "Bonjour,",
  "",
  "Nous suivons votre abonnement ArtiFlow-pro et souhaitons nous assurer que l'offre en cours correspond toujours bien à votre activité.",
  "",
  "Seriez-vous disponible pour un échange rapide cette semaine ?",
  "",
  "Bien cordialement,",
  "L'équipe ArtiFlow-pro",
].join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const simulerEchecBrevo = body?.simulerEchecBrevo === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const preview = body?.preview === true;
    // Aperçu du seul email d'auto-relance des oubliés : rendu à la volée, aucun envoi.
    const previewAuto = body?.previewAuto === true;
    // Aperçu du seul email d'alerte artisan (rendu à la volée, aucun envoi).
    const previewAlerte = body?.previewAlerte === true;
    const previewAlertId = Number(body?.alertId);
    // Déclenchement manuel de l'auto-relance des oubliés « dus » (bouton du tableau de bord) :
    // n'exécute QUE la relance automatique, sans récap hebdomadaire ni alerte artisan.
    const autoNow = body?.autoNow === true;
    // Envoi de test manuel depuis l'interface : cible uniquement l'utilisateur demandé,
    // ignore l'activation / la pause / l'anti-doublon, et journalise une ligne d'historique
    // (marquée « test ») pour qu'on la voie apparaître dans l'historique des récaps.
    const isTest = body?.test === true;
    // Rejeu d'une alerte artisan depuis l'historique : on renvoie l'email d'alerte d'un jour précis
    // (mêmes comptes concernés), sans rien recalculer ni réinsérer dans l'historique.
    const replayAlerte = body?.replayAlerte === true;
    const replayAlertId = Number(body?.alertId);
    if (isTest && !scopeUserId) return json({ ok: false, error: "userId requis pour un envoi de test." }, 400);
    if (previewAuto && !scopeUserId) return json({ ok: false, error: "userId requis pour un aperçu." }, 400);
    if (previewAlerte && !scopeUserId) return json({ ok: false, error: "userId requis pour un aperçu." }, 400);
    if (autoNow && !scopeUserId) return json({ ok: false, error: "userId requis pour un envoi manuel." }, 400);
    if (replayAlerte && (!scopeUserId || !Number.isFinite(replayAlertId))) {
      return json({ ok: false, error: "userId et alertId requis pour rejouer une alerte." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Profils : destinataire + seuil de rappel + état de pause.
    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, recontact_rappel_jours, recontact_rappel_hebdo_actif, recontact_rappel_dernier_envoi, email_sujet_recontact, email_corps_recontact, email_sujet_recontact_auto, email_corps_recontact_auto, email_sujet_alerte_artisan, email_corps_alerte_artisan, recontact_oublies_auto_jours, recontact_oublies_alerte_email_actif, pause_jusqu_au",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // 2) Abonnements (le parc suivi).
    const { data: abosRaw, error: aboError } = await admin
      .from("abonnements")
      .select("id, entreprise, email, statut");
    if (aboError) return json({ ok: false, error: aboError.message }, 500);

    // 3) Historique des changements d'offre (pour la volatilité et la date du dernier passage).
    const { data: histoRaw, error: histoError } = await admin
      .from("abonnement_historique")
      .select("abonnement_id, type, ancienne_valeur, nouvelle_valeur, created_at")
      .order("created_at", { ascending: false });
    if (histoError) return json({ ok: false, error: histoError.message }, 500);

    // 4) Recontacts déjà journalisés (un compte déjà contacté est considéré traité).
    const { data: recRaw, error: recError } = await admin
      .from("recontacts_artisans")
      .select("abonnement_id, statut, created_at");
    if (recError) return json({ ok: false, error: recError.message }, 500);

    const seuil6mois = new Date();
    seuil6mois.setMonth(seuil6mois.getMonth() - 6);

    const info: Record<number, { offres6mois: number; dernierChangement: string | null }> = {};
    (histoRaw ?? []).forEach((raw) => {
      const r = raw as Record<string, unknown>;
      if (String(r.type ?? "") === "statut") return;
      if (r.ancienne_valeur === null || r.nouvelle_valeur === null) return;
      const id = Number(r.abonnement_id);
      if (!Number.isFinite(id)) return;
      const entry = info[id] ?? { offres6mois: 0, dernierChangement: null };
      const created = String(r.created_at ?? "");
      const d = new Date(created);
      if (!Number.isNaN(d.getTime()) && d >= seuil6mois) entry.offres6mois += 1;
      // Historique trié du plus récent au plus ancien : la première date conservée est le dernier changement.
      if (!entry.dernierChangement && created) entry.dernierChangement = created;
      info[id] = entry;
    });

    const hasRecontact = new Set<number>();
    (recRaw ?? []).forEach((raw) => {
      const id = Number((raw as Record<string, unknown>).abonnement_id);
      if (Number.isFinite(id)) hasRecontact.add(id);
    });

    const now = Date.now();
    const today = todayISO();
    const canSend = Boolean((Deno.env.get("BREVO_API_KEY") ?? "").trim() || (resendKey && fromDomain));

    // Aperçu de l'email d'alerte artisan : rendu exact (objet/message personnalisés de l'artisan),
    // sans aucun envoi. Les comptes d'une alerte passée sont réutilisés quand l'id est fourni,
    // sinon des comptes d'exemple illustrent le rendu.
    if (previewAlerte) {
      const profil = (profiles ?? [])[0] as Record<string, unknown> | undefined;
      if (!profil) return json({ ok: false, error: "Profil introuvable." }, 404);
      const nomProfil = String(profil.entreprise ?? profil.metier ?? "ArtiFlow-pro");
      let comptes: Array<{ entreprise: string; email: string }> = [];
      if (Number.isFinite(previewAlertId)) {
        const { data: alerte } = await admin
          .from("recap_alertes_artisan")
          .select("comptes")
          .eq("id", previewAlertId)
          .eq("user_id", scopeUserId)
          .maybeSingle();
        const rawComptes = Array.isArray((alerte as Record<string, unknown> | null)?.comptes)
          ? ((alerte as Record<string, unknown>).comptes as Array<Record<string, unknown>>)
          : [];
        comptes = rawComptes.map((c) => ({
          entreprise: String(c?.entreprise ?? "—"),
          email: String(c?.email ?? ""),
        }));
      }
      if (comptes.length === 0) {
        comptes = [
          { entreprise: "Plomberie Martin", email: "contact@plomberie-martin.fr" },
          { entreprise: "Électricité Durand", email: "hello@elec-durand.fr" },
          { entreprise: "Menuiserie Petit", email: "devis@menuiserie-petit.fr" },
        ];
      }
      const sujetBrut = typeof body?.sujetDraft === "string" ? String(body.sujetDraft) : String(profil.email_sujet_alerte_artisan ?? "");
      const corpsBrut = typeof body?.corpsDraft === "string" ? String(body.corpsDraft) : String(profil.email_corps_alerte_artisan ?? "");
      const valsAlerte: Record<string, string> = { entreprise: nomProfil, nombre: String(comptes.length) };
      const sujet = sujetAlerteArtisan(sujetBrut, comptes.length, nomProfil);
      const corps = applyTemplate(corpsBrut, valsAlerte).trim();
      return json({
        ok: true,
        previewType: "alerte",
        subject: sujet,
        html: buildAlerteAutoRelanceHtml(nomProfil, comptes, corps),
        count: comptes.length,
      });
    }

    // Rejeu d'une alerte artisan : on relit la trace conservée du jour demandé et on renvoie
    // l'email d'alerte aux mêmes comptes, à la demande de l'artisan. Aucun nouvel envoi de
    // recontact, aucune nouvelle ligne d'historique : c'est le même événement rejoué.
    if (replayAlerte) {
      const profil = (profiles ?? [])[0] as Record<string, unknown> | undefined;
      if (!profil) return json({ ok: false, error: "Profil introuvable." }, 404);
      const emailArtisan = String(profil.email ?? "").trim();
      const nomProfil = String(profil.entreprise ?? profil.metier ?? "ArtiFlow-pro");
      const { data: alerte, error: alerteError } = await admin
        .from("recap_alertes_artisan")
        .select("id, comptes, nb_comptes")
        .eq("id", replayAlertId)
        .eq("user_id", scopeUserId)
        .maybeSingle();
      if (alerteError) return json({ ok: false, error: alerteError.message }, 500);
      if (!alerte) return json({ ok: false, error: "Alerte introuvable." }, 404);
      const rawComptes = Array.isArray((alerte as Record<string, unknown>).comptes)
        ? ((alerte as Record<string, unknown>).comptes as Array<Record<string, unknown>>)
        : [];
      const comptes = rawComptes.map((c) => ({
        entreprise: String(c?.entreprise ?? "—"),
        email: String(c?.email ?? ""),
      }));
      if (comptes.length === 0) return json({ ok: false, error: "Aucun compte à rejouer pour cette alerte." }, 400);
      if (!canSend || !emailArtisan) {
        return json({
          ok: true,
          replay: true,
          configured: canSend,
          sent: false,
          count: comptes.length,
          reason: !emailArtisan ? "Email de l'artisan manquant." : "Aucun service d'envoi configuré.",
        });
      }
      try {
        const sujetAlerte = sujetAlerteArtisan(String(profil.email_sujet_alerte_artisan ?? ""), comptes.length, nomProfil);
        const corpsAlerte = applyTemplate(String(profil.email_corps_alerte_artisan ?? ""), {
          entreprise: nomProfil,
          nombre: String(comptes.length),
        }).trim();
        const envoi = await envoyerEmailAvecRepli(
          "recap-recontact-volatils",
          {
            nom: "ArtiFlow-pro",
            to: [emailArtisan],
            subject: `Rappel — ${sujetAlerte}`,
            html: buildAlerteAutoRelanceHtml(nomProfil, comptes, corpsAlerte),
          },
          admin,
          { simulerEchecBrevo },
        );
        return json({ ok: true, replay: true, configured: true, sent: envoi.ok, count: comptes.length });
      } catch {
        return json({ ok: true, replay: true, configured: true, sent: false, count: comptes.length, reason: "Erreur d'envoi." });
      }
    }

    let sent = 0;
    let skipped = 0;
    let previewHtml: string | null = null;
    let previewSubject = "";
    let previewCount = 0;
    let previewType: string | null = null;
    const details: Array<{ userId: string; count: number; sent: boolean; reason?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre équipe");
      const actif = p.recontact_rappel_hebdo_actif !== false;
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;
      const delai = Number(p.recontact_rappel_jours) > 0 ? Number(p.recontact_rappel_jours) : DELAI_DEFAUT;

      // Déclenchement manuel : on ne veut PAS de récap hebdomadaire, uniquement l'auto-relance.
      if (autoNow) break;

      // Aperçu du seul email d'auto-relance des oubliés (aucun envoi) : rendu à partir du message
      // personnalisé de l'artisan, ou du brouillon non enregistré transmis par l'interface.
      if (previewAuto) {
        const nomProfil = String(p.entreprise ?? p.metier ?? "ArtiFlow-pro");
        const sujetBrut = typeof body?.sujetDraft === "string" ? String(body.sujetDraft) : String(p.email_sujet_recontact_auto ?? "");
        const corpsBrut = typeof body?.corpsDraft === "string" ? String(body.corpsDraft) : String(p.email_corps_recontact_auto ?? "");
        const exempleCompte = "Plomberie Martin";
        const valsAuto: Record<string, string> = { entreprise: nomProfil, compte: exempleCompte, nombre: "3" };
        const sujetAuto = applyTemplate(sujetBrut.trim(), valsAuto).trim() || SUJET_RECONTACT_AUTO;
        const corpsAuto = applyTemplate(corpsBrut, valsAuto).trim() || MESSAGE_RECONTACT_AUTO;
        previewHtml = buildRecontactHtml(corpsAuto, exempleCompte);
        previewSubject = sujetAuto;
        previewCount = 3;
        previewType = "auto";
        details.push({ userId, count: 3, sent: false });
        continue;
      }

      // Comptes très volatils toujours « à recontacter » depuis plus de `delai` jours.
      const lignes: Ligne[] = (abosRaw ?? [])
        .map((a) => {
          const row = a as Record<string, unknown>;
          const id = Number(row.id);
          const inf = info[id];
          if (!inf) return null;
          if (inf.offres6mois < SEUIL_TRES_VOLATIL) return null;
          if (hasRecontact.has(id)) return null;
          if (!inf.dernierChangement) return null;
          const jours = Math.floor((now - new Date(inf.dernierChangement).getTime()) / 86400000);
          if (jours < delai) return null;
          return {
            abonnementId: id,
            entreprise: String(row.entreprise ?? "—"),
            email: row.email ? String(row.email) : null,
            nbChangements: inf.offres6mois,
            joursDepuis: jours,
            dernierChangement: inf.dernierChangement,
          } as Ligne;
        })
        .filter((x): x is Ligne => x !== null)
        .sort((x, y) => y.joursDepuis - x.joursDepuis);

      if (!actif && !force && !preview) {
        skipped += 1;
        details.push({ userId, count: lignes.length, sent: false, reason: "Récap hebdo coupé." });
        continue;
      }
      if (enPause && !force && !preview) {
        skipped += 1;
        details.push({ userId, count: lignes.length, sent: false, reason: "Pause vacances." });
        continue;
      }
      if (lignes.length === 0 && !force && !preview) {
        details.push({ userId, count: 0, sent: false });
        continue;
      }

      const vals: Record<string, string> = {
        entreprise: nom,
        nb: String(lignes.length),
        delai: String(delai),
      };
      const sujetDefaut = `${lignes.length} compte${lignes.length > 1 ? "s" : ""} très volatil${
        lignes.length > 1 ? "s" : ""
      } à recontacter · ArtiFlow-pro`;
      const sujetPersonnalise = applyTemplate(String(p.email_sujet_recontact ?? "").trim(), vals).trim();
      const sujet = sujetPersonnalise || sujetDefaut;
      const corps = applyTemplate(String(p.email_corps_recontact ?? ""), vals).trim();

      // Envoi de test manuel (bouton « Envoyer un récap maintenant ») : on tente un vrai
      // envoi si Resend est configuré, mais on journalise TOUJOURS la ligne d'historique
      // (marquée « Test ») pour qu'elle apparaisse dans l'historique des récaps.
      if (isTest) {
        if (canSend && email) {
          try {
            const envoi = await envoyerEmailAvecRepli(
              "recap-recontact-volatils",
              { nom, to: [email], subject: sujet, html: buildHtml(nom, delai, lignes, corps) },
              admin,
              { simulerEchecBrevo },
            );
            if (envoi.ok) sent += 1;
          } catch {
            /* on journalise quand même le test pour le voir dans l'historique */
          }
        }
        await admin
          .from("recap_recontact_envois")
          .insert({
            user_id: userId,
            nb_comptes: lignes.length,
            origine: "test",
            abonnement_ids: lignes.map((l) => l.abonnementId),
          });
        details.push({
          userId,
          count: lignes.length,
          sent: canSend && !!email,
          reason: canSend ? undefined : "Aucun service d'envoi configuré.",
        });
        continue;
      }

      if (preview) {
        previewHtml = buildHtml(nom, delai, lignes, corps);
        previewSubject = sujet;
        previewCount = lignes.length;
        details.push({ userId, count: lignes.length, sent: false });
        continue;
      }

      if (!canSend || !email) {
        skipped += 1;
        details.push({ userId, count: lignes.length, sent: false, reason: !email ? "Email manquant." : "Aucun service d'envoi configuré." });
        continue;
      }

      const dernier = p.recontact_rappel_dernier_envoi
        ? new Date(String(p.recontact_rappel_dernier_envoi)).getTime()
        : 0;
      if (!force && dernier && now - dernier < INTERVALLE_MIN_JOURS * 86400000) {
        skipped += 1;
        details.push({ userId, count: lignes.length, sent: false, reason: "Déjà envoyé cette semaine." });
        continue;
      }

      try {
        const envoi = await envoyerEmailAvecRepli(
          "recap-recontact-volatils",
          { nom, to: [email], subject: sujet, html: buildHtml(nom, delai, lignes, corps) },
          admin,
          { simulerEchecBrevo },
        );
        if (envoi.ok) {
          sent += 1;
          // Journal d'historique : une ligne par envoi réussi (date + nombre de comptes).
          await admin
            .from("recap_recontact_envois")
            .insert({
              user_id: userId,
              nb_comptes: lignes.length,
              origine: "auto",
              abonnement_ids: lignes.map((l) => l.abonnementId),
            });
          // On ne met à jour le repère que sur un passage planifié (pas un test manuel),
          // pour ne pas court-circuiter l'envoi hebdomadaire réel.
          if (!force) {
            await admin
              .from("profiles")
              .update({ recontact_rappel_dernier_envoi: new Date().toISOString() })
              .eq("id", userId);
          }
          details.push({ userId, count: lignes.length, sent: true });
        } else {
          skipped += 1;
          details.push({ userId, count: lignes.length, sent: false, reason: envoi.error || "Envoi refusé par les fournisseurs." });
        }
      } catch {
        skipped += 1;
        details.push({ userId, count: lignes.length, sent: false, reason: "Erreur d'envoi." });
      }
    }

    // --- Auto-relance des oubliés --------------------------------------------------
    // Une fois le délai réglé écoulé, les comptes listés dans un récap passé et jamais
    // relancés depuis reçoivent réellement un email de recontact, journalisé (origine « auto »).
    // Naturellement idempotent : une relance réussie empêche toute nouvelle relance du compte.
    let autoRelances = 0;
    let autoEchecs = 0;
    let alertesAuto = 0;
    if (!preview && !previewAuto && canSend && (autoNow || !isTest)) {
      const { data: recapsRaw } = await admin
        .from("recap_recontact_envois")
        .select("user_id, envoye_le, abonnement_ids");

      const recapsParUser: Record<string, Array<{ envoyeLe: number; ids: number[] }>> = {};
      (recapsRaw ?? []).forEach((raw) => {
        const row = raw as Record<string, unknown>;
        const uid = String(row.user_id ?? "");
        if (!uid) return;
        const t = new Date(String(row.envoye_le ?? "")).getTime();
        if (Number.isNaN(t)) return;
        const ids = Array.isArray(row.abonnement_ids)
          ? (row.abonnement_ids as unknown[]).map((v) => Number(v)).filter((v) => Number.isFinite(v))
          : [];
        if (ids.length === 0) return;
        if (!recapsParUser[uid]) recapsParUser[uid] = [];
        recapsParUser[uid].push({ envoyeLe: t, ids });
      });

      // Recontacts réussis, pour savoir si un compte listé a déjà été relancé après un récap.
      const recontactsReussis: Array<{ id: number; t: number }> = [];
      (recRaw ?? []).forEach((raw) => {
        const row = raw as Record<string, unknown>;
        if (String(row.statut ?? "envoye") !== "envoye") return;
        const id = Number(row.abonnement_id);
        const t = new Date(String(row.created_at ?? "")).getTime();
        if (Number.isFinite(id) && !Number.isNaN(t)) recontactsReussis.push({ id, t });
      });

      // Coordonnées du parc pour adresser les emails.
      const parcParId = new Map<number, { entreprise: string; email: string | null }>();
      (abosRaw ?? []).forEach((a) => {
        const row = a as Record<string, unknown>;
        const id = Number(row.id);
        if (!Number.isFinite(id)) return;
        parcParId.set(id, {
          entreprise: String(row.entreprise ?? "—"),
          email: row.email ? String(row.email) : null,
        });
      });

      for (const raw of profiles ?? []) {
        const p = raw as Record<string, unknown>;
        const userId = String(p.id);
        if (p.recontact_rappel_hebdo_actif === false) continue;
        const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;
        if (enPause) continue;
        const autoJours = Number(p.recontact_oublies_auto_jours);
        if (!Number.isFinite(autoJours) || autoJours <= 0) continue;

        const recaps = recapsParUser[userId];
        if (!recaps || recaps.length === 0) continue;
        const delta = autoJours * 86400000;

        // Comptes oubliés dus : listés dans un récap dont le délai est écoulé, sans recontact depuis.
        const dus = new Set<number>();
        recaps.forEach((recap) => {
          if (now < recap.envoyeLe + delta) return;
          const listes = new Set(recap.ids);
          const touches = new Set<number>();
          recontactsReussis.forEach((r) => {
            if (r.t > recap.envoyeLe && listes.has(r.id)) touches.add(r.id);
          });
          recap.ids.forEach((id) => {
            if (!touches.has(id)) dus.add(id);
          });
        });
        if (dus.size === 0) continue;

        const nomProfil = String(p.entreprise ?? p.metier ?? "ArtiFlow-pro");
        const emailArtisan = String(p.email ?? "").trim();
        const sujetAutoPerso = String(p.email_sujet_recontact_auto ?? "").trim();
        const corpsAutoPerso = String(p.email_corps_recontact_auto ?? "");
        const relancesOk: Array<{ id: number; entreprise: string; email: string }> = [];
        for (const id of dus) {
          const compte = parcParId.get(id);
          if (!compte || !compte.email) continue;
          // Objet et message personnalisables (variables {{entreprise}} / {{compte}} / {{nombre}}),
          // avec repli sur le message par défaut si l'artisan n'a rien réglé.
          const valsAuto: Record<string, string> = {
            entreprise: nomProfil,
            compte: compte.entreprise,
            nombre: String(dus.size),
          };
          const sujetAuto = applyTemplate(sujetAutoPerso, valsAuto).trim() || SUJET_RECONTACT_AUTO;
          const corpsAuto = applyTemplate(corpsAutoPerso, valsAuto).trim() || MESSAGE_RECONTACT_AUTO;
          let ok = false;
          let erreur: string | null = null;
          try {
            const envoi = await envoyerEmailAvecRepli(
              "recap-recontact-volatils",
              {
                nom: nomProfil,
                to: [compte.email],
                subject: sujetAuto,
                html: buildRecontactHtml(corpsAuto, compte.entreprise),
              },
              admin,
              { simulerEchecBrevo },
            );
            ok = envoi.ok;
            if (!ok) erreur = envoi.error || "Envoi refusé par les fournisseurs.";
          } catch {
            erreur = "Erreur d'envoi.";
          }
          // Journalisation systématique : une relance réussie empêche toute nouvelle relance du compte.
          await admin.from("recontacts_artisans").insert({
            abonnement_id: id,
            artisan_id: null,
            entreprise: compte.entreprise,
            email: compte.email,
            sujet: sujetAuto,
            statut: ok ? "envoye" : "echec",
            erreur: ok ? null : erreur,
            origine: "auto",
          });
          if (ok) {
            autoRelances += 1;
            relancesOk.push({ id, entreprise: compte.entreprise, email: compte.email });
          } else {
            autoEchecs += 1;
          }
        }

        // Alerte à l'artisan : on le prévient quand l'auto-relance a réellement expédié des
        // relances ce jour-là (un seul email récapitulant les comptes concernés). Best-effort.
        const alerteEmailActif = p.recontact_oublies_alerte_email_actif !== false;
        // Alerte artisan uniquement pour un passage planifié : sur un envoi manuel déclenché
        // depuis le tableau de bord, l'artisan est déjà au courant (il a cliqué).
        if (relancesOk.length > 0 && alerteEmailActif && emailArtisan && !autoNow) {
          try {
            const sujetAlerte = sujetAlerteArtisan(
              String(p.email_sujet_alerte_artisan ?? ""),
              relancesOk.length,
              nomProfil,
            );
            const corpsAlerte = applyTemplate(String(p.email_corps_alerte_artisan ?? ""), {
              entreprise: nomProfil,
              nombre: String(relancesOk.length),
            }).trim();
            const envoiAlerte = await envoyerEmailAvecRepli(
              "recap-recontact-volatils",
              {
                nom: "ArtiFlow-pro",
                to: [emailArtisan],
                subject: sujetAlerte,
                html: buildAlerteAutoRelanceHtml(nomProfil, relancesOk, corpsAlerte),
              },
              admin,
              { simulerEchecBrevo },
            );
            if (envoiAlerte.ok) {
              alertesAuto += 1;
              // Trace conservée de l'alerte réellement expédiée (date + comptes concernés).
              await admin.from("recap_alertes_artisan").insert({
                user_id: userId,
                nb_comptes: relancesOk.length,
                abonnement_ids: relancesOk.map((c) => c.id),
                comptes: relancesOk.map((c) => ({ entreprise: c.entreprise, email: c.email })),
              });
            }
          } catch {
            /* best-effort : l'échec de l'alerte ne remet pas en cause les relances déjà parties */
          }
        }
      }
    }

    return json({
      ok: true,
      configured: canSend,
      users: (profiles ?? []).length,
      sent,
      skipped,
      autoRelances,
      autoEchecs,
      alertesAuto,
      reason: canSend ? undefined : "Aucun service d'envoi configuré (clé API + domaine).",
      subject: preview ? previewSubject : undefined,
      count: preview ? previewCount : undefined,
      html: previewHtml ?? undefined,
      previewType: previewType ?? undefined,
      manual: isTest ? true : undefined,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});