import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récapitulatif HEBDOMADAIRE de l'avancement des chantiers en cours.
//
// Deux modes d'appel :
//  1. tâche planifiée (sans session) : parcourt tous les artisans et n'envoie qu'à ceux
//     dont le jour et l'heure choisis correspondent, à l'heure de Paris ;
//  2. appel manuel depuis l'application (`userId` + `force: true`) : envoie tout de suite
//     le récap de l'artisan connecté, sans attendre le jour choisi. Dans ce mode le jeton
//     de session est vérifié pour empêcher d'écrire à la place d'un autre compte.
//  3. mode aperçu (`preview: true`) : renvoie le HTML exact, sans aucun envoi.
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function euros(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function dateFr(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Ramène le statut stocké vers un libellé lisible (et sert au filtrage). */
function statutLabel(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.includes("termin") || v.includes("fini") || v.includes("clotur")) return "Terminé";
  if (v.includes("cours")) return "En cours";
  return "Planifié";
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
    /* repli */
  }
  return new Date().getHours();
}

/** Jour de la semaine courant à Paris (1 = lundi … 7 = dimanche). */
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

/** Libellés des jours de la semaine (1 = lundi … 7 = dimanche). */
const JOURS_SEMAINE: Record<number, string> = {
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
  7: "dimanche",
};

/** Jour de récap choisi par l'artisan (repli sur vendredi = 5). */
function jourChoisiDe(profil: Record<string, unknown>): number {
  const n = Number(profil.recap_chantiers_jour);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? Math.round(n) : 5;
}

/**
 * Adresses valides mises en copie du récap. Plusieurs adresses possibles (comptable, associé…),
 * chacune pouvant être décochée ; on ignore les doublons et l'adresse principale du compte.
 * Si la liste est vide, on retombe sur l'ancienne colonne à adresse unique.
 */
function adressesCcDe(profil: Record<string, unknown>, destinataire: string): string[] {
  const vues = new Set<string>();
  const liste: string[] = [];
  const principal = destinataire.trim().toLowerCase();
  const ajouter = (brut: unknown) => {
    const email = String(brut ?? "").trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
    const cle = email.toLowerCase();
    if (cle === principal || vues.has(cle)) return;
    vues.add(cle);
    liste.push(email);
  };

  const brut = profil.recap_chantiers_ccs;
  if (Array.isArray(brut)) {
    brut.forEach((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      if (row.actif === false) return;
      ajouter(row.email);
    });
  }
  if (liste.length === 0) ajouter(profil.recap_chantiers_cc);
  return liste;
}

interface ChantierResume {
  id: number;
  libelle: string;
  adresse: string | null;
  statut: string;
  dateDebut: string | null;
  montant: number;
  clientNom: string | null;
  progression: number;
  faites: number;
  total: number;
  suiviActif: boolean;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length ? s : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Reconstruit la liste des chantiers en cours d'un artisan, avec leur avancement. */
async function chargerChantiers(admin: Admin, userId: string): Promise<ChantierResume[]> {
  const { data: chantiers } = await admin
    .from("chantiers")
    .select("id, libelle, adresse, statut, date_debut, montant, client_id, suivi_actif")
    .eq("user_id", userId);

  const lignes = (chantiers ?? []) as Array<Record<string, unknown>>;
  const enCours = lignes.filter((c) => statutLabel(c.statut) !== "Terminé");
  if (enCours.length === 0) return [];

  const ids = enCours.map((c) => toNum(c.id));
  const [etapesRes, clientsRes] = await Promise.all([
    admin.from("etapes_chantier").select("chantier_id, fait").in("chantier_id", ids),
    admin.from("clients").select("id, nom").eq("user_id", userId),
  ]);

  const etapesParChantier = new Map<number, { total: number; faites: number }>();
  ((etapesRes.data ?? []) as Array<Record<string, unknown>>).forEach((e) => {
    const cid = toNum(e.chantier_id);
    const item = etapesParChantier.get(cid) ?? { total: 0, faites: 0 };
    item.total += 1;
    if (e.fait) item.faites += 1;
    etapesParChantier.set(cid, item);
  });

  const nomParClient = new Map<number, string>();
  ((clientsRes.data ?? []) as Array<Record<string, unknown>>).forEach((c) => {
    nomParClient.set(toNum(c.id), toStr(c.nom) ?? "");
  });

  return enCours
    .map((c) => {
      const stats = etapesParChantier.get(toNum(c.id)) ?? { total: 0, faites: 0 };
      const progression = stats.total === 0 ? 0 : Math.round((stats.faites / stats.total) * 100);
      const clientId = c.client_id === null || c.client_id === undefined ? null : toNum(c.client_id);
      return {
        id: toNum(c.id),
        libelle: toStr(c.libelle) ?? "Chantier",
        adresse: toStr(c.adresse),
        statut: statutLabel(c.statut),
        dateDebut: toStr(c.date_debut),
        montant: toNum(c.montant),
        clientNom: clientId !== null ? nomParClient.get(clientId) ?? null : null,
        progression,
        faites: stats.faites,
        total: stats.total,
        suiviActif: c.suivi_actif !== false,
      };
    })
    .sort((a, b) => b.progression - a.progression || a.libelle.localeCompare(b.libelle));
}

function buildEmailHtml(params: {
  emetteur: string;
  chantiers: ChantierResume[];
  appUrl: string;
  accent: string;
  jourLabel?: string;
}): string {
  const { emetteur, chantiers, appUrl, accent } = params;
  const jourLabel = params.jourLabel ?? "vendredi";
  const jourLower = jourLabel.toLowerCase();
  const termines = chantiers.filter((c) => c.progression >= 100).length;
  const moyenne =
    chantiers.length === 0
      ? 0
      : Math.round(chantiers.reduce((sum, c) => sum + c.progression, 0) / chantiers.length);

  const cartes = chantiers
    .map(
      (c) => `<div style="border:1px solid #e5e5e5;border-radius:10px;padding:14px 16px;margin:0 0 12px;background:#ffffff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;padding:0;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">${escapeHtml(c.libelle)}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#71717a;">
                ${escapeHtml(c.clientNom ?? "Sans client")}${c.adresse ? ` · ${escapeHtml(c.adresse)}` : ""}
              </p>
            </td>
            <td style="vertical-align:top;text-align:right;padding:0;white-space:nowrap;">
              <span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:#f4f4f5;color:#52525b;">${escapeHtml(
                c.statut,
              )}</span>
            </td>
          </tr>
        </table>
        <div style="margin:12px 0 6px;">
          <span style="font-size:11px;color:#71717a;">Avancement${c.total > 0 ? ` (${c.faites}/${c.total})` : ""}</span>
          <span style="font-size:12px;font-weight:700;color:#18181b;float:right;">${c.progression} %</span>
        </div>
        <div style="height:8px;background:#e4e4e7;border-radius:99px;overflow:hidden;clear:both;">
          <div style="height:8px;width:${c.progression}%;background:${accent};border-radius:99px;"></div>
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;">
          ${c.dateDebut ? `Début ${escapeHtml(dateFr(c.dateDebut))} · ` : ""}${euros(c.montant)}
          ${c.suiviActif ? " · suivi partagé avec le client" : ""}
        </p>
      </div>`,
    )
    .join("");

  const corps =
    chantiers.length === 0
      ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">
           Aucun chantier en cours cette semaine. Tout est terminé ou rien n'est encore ouvert : profitez-en.
         </p>`
      : `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
           <tr>
             <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
               <div style="font-size:20px;font-weight:700;color:#18181b;">${chantiers.length}</div>
               <div style="font-size:11px;color:#71717a;">chantier${chantiers.length > 1 ? "s" : ""} en cours</div>
             </td>
             <td style="width:10px;"></td>
             <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
               <div style="font-size:20px;font-weight:700;color:${accent};">${moyenne} %</div>
               <div style="font-size:11px;color:#71717a;">avancement moyen</div>
             </td>
             <td style="width:10px;"></td>
             <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
               <div style="font-size:20px;font-weight:700;color:#18181b;">${termines}</div>
               <div style="font-size:11px;color:#71717a;">à clôturer</div>
             </td>
           </tr>
         </table>
         ${cartes}`;

  const bouton = appUrl
    ? `<div style="text-align:center;margin:20px 0 4px;">
         <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:600;">Ouvrir mes chantiers</a>
       </div>`
    : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${accent};"></div>
      <div style="padding:24px 24px 18px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteur)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#71717a;">Récap du ${escapeHtml(jourLower)} · avancement de vos chantiers</p>
      </div>
      <div style="padding:24px;">
        ${corps}
        ${bouton}
        <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;line-height:1.6;text-align:center;">
          Récap automatique envoyé chaque ${escapeHtml(jourLower)}. Vous pouvez changer ce jour ou le désactiver à tout moment depuis l'écran Chantiers.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique ArtiFlow-pro
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body.force === true;
    const preview = body.preview === true;
    const appUrlBody = typeof body.appUrl === "string" ? String(body.appUrl).trim() : "";
    const hourOverride = Number.isFinite(Number(body.hour)) ? Number(body.hour) % 24 : null;
    const today = new Date().toISOString().slice(0, 10);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Appel ciblé : on vérifie que la session correspond bien à l'artisan visé.
    if (scopeUserId) {
      if (!anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) return json({ ok: false, error: "Vous devez être connecté." }, 401);
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user || userData.user.id !== scopeUserId) {
        return json({ ok: false, error: "Vous devez être connecté." }, 401);
      }
    }

    const configure = Boolean(resendKey && fromDomain);
    if (!preview && !configure) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        skipped: 0,
        reason: "L'envoi d'email n'est pas configuré (Resend).",
      });
    }

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, doc_couleur, recap_chantiers_actif, recap_chantiers_jour, recap_chantiers_heure, recap_chantiers_dernier_envoi, recap_chantiers_cc, recap_chantiers_ccs, pause_jusqu_au, comptable_app_url",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    if (preview) {
      const rawPrev = (profiles ?? [])[0];
      if (!rawPrev) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pPrev = rawPrev as Record<string, unknown>;
      const idPrev = String(pPrev.id);
      const chantiersPrev = await chargerChantiers(admin, idPrev);
      const emetteurPrev = String(pPrev.entreprise ?? pPrev.metier ?? "Votre artisan");
      return json({
        ok: true,
        preview: true,
        cc: adressesCcDe(pPrev, String(pPrev.email ?? "")).join(", "),
        html: buildEmailHtml({
          emetteur: emetteurPrev,
          chantiers: chantiersPrev,
          appUrl: appUrlBody || String(pPrev.comptable_app_url ?? "").trim() || "https://artiflow-pro.com",
          accent: /^#[0-9a-fA-F]{6}$/.test(String(pPrev.doc_couleur ?? "")) ? String(pPrev.doc_couleur) : "#C4783A",
          jourLabel: JOURS_SEMAINE[jourChoisiDe(pPrev)] ?? "vendredi",
        }),
        subject: `Récap chantiers · ${chantiersPrev.length} en cours`,
      });
    }

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string }> = [];

    const cibleHour = hourOverride ?? parisHour();
    const cibleJour = parisWeekday();

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const emetteur = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const actif = p.recap_chantiers_actif !== false;
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;

      if (!force && !actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap chantiers désactivé." });
        continue;
      }
      if (!force && enPause) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Pause vacances." });
        continue;
      }
      if (!force) {
        const heureChoisie =
          p.recap_chantiers_heure === null || p.recap_chantiers_heure === undefined
            ? 8
            : Number(p.recap_chantiers_heure);
        // La tâche planifiée est appelée chaque heure : seul le jour ET l'heure choisis envoient.
        if (jourChoisiDe(p) !== cibleJour || heureChoisie !== cibleHour) {
          details.push({ userId, sent: false });
          continue;
        }
      }
      if (!email) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email manquant." });
        continue;
      }

      const chantiers = await chargerChantiers(admin, userId);
      // Adresses en copie (comptable, associé…) : toutes celles cochées, jamais l'adresse principale.
      const cc = adressesCcDe(p, email);
      const accent = /^#[0-9a-fA-F]{6}$/.test(String(p.doc_couleur ?? "")) ? String(p.doc_couleur) : "#C4783A";
      const appUrl = appUrlBody || String(p.comptable_app_url ?? "").trim() || "https://artiflow-pro.com";
      const subject =
        chantiers.length > 0
          ? `Récap chantiers · ${chantiers.length} chantier${chantiers.length > 1 ? "s" : ""} en cours`
          : "Récap chantiers · rien en cours cette semaine";

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${emetteur} <noreply@${fromDomain}>`,
            to: [email],
            ...(cc.length ? { cc } : {}),
            subject,
            html: buildEmailHtml({
              emetteur,
              chantiers,
              appUrl,
              accent,
              jourLabel: JOURS_SEMAINE[jourChoisiDe(p)] ?? "vendredi",
            }),
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { message?: string } | null;
          skipped += 1;
          details.push({ userId, sent: false, reason: err?.message || `Envoi refusé (code ${res.status}).` });
          continue;
        }
        sent += 1;
        await admin
          .from("profiles")
          .update({ recap_chantiers_dernier_envoi: new Date().toISOString() })
          .eq("id", userId);
        details.push({ userId, sent: true });
      } catch (e) {
        skipped += 1;
        details.push({ userId, sent: false, reason: e instanceof Error ? e.message : "Erreur d'envoi." });
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
