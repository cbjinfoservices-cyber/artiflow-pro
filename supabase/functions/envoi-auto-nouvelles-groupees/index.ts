import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Envoi groupé AUTOMATIQUE des nouvelles aux clients silencieux.
//
// Deux modes d'appel :
//  1. tâche planifiée (sans session) : parcourt tous les artisans et n'envoie qu'à ceux dont
//     la fréquence (semaine ou mois), le jour et l'heure choisis correspondent (heure de Paris) ;
//  2. appel ciblé (`userId` + `force: true`) : vérifie la session puis envoie tout de suite.
//
// Un client ne reçoit qu'UN email par passage, même s'il a plusieurs chantiers silencieux :
// l'email regroupe tous ses chantiers. Les chantiers terminés, sans suivi partagé ou dont le
// client n'a pas d'adresse email sont écartés.
//
// L'envoi réel nécessite Resend : RESEND_API_KEY + RESEND_FROM_DOMAIN.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEUIL_JOURS = 14;

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

function statutLabel(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.includes("termin") || v.includes("fini") || v.includes("clotur")) return "Terminé";
  if (v.includes("cours")) return "En cours";
  return "Planifié";
}

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

function parisDayOfMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric" }).formatToParts(new Date());
    const d = parts.find((p) => p.type === "day")?.value;
    if (d !== undefined) return Number(d);
  } catch {
    /* repli */
  }
  return new Date().getDate();
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

/** Jours écoulés depuis le dernier email client (ou la création du chantier). */
function joursSansEmail(dernier: string | null, creation: string | null): number | null {
  const ref = dernier ?? creation;
  if (!ref) return null;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

interface ChantierSilencieux {
  id: number;
  libelle: string;
  adresse: string | null;
  statut: string;
  dateDebut: string | null;
  montant: number;
  message: string | null;
  token: string;
  progression: number;
  faites: number;
  total: number;
  jours: number;
}

function buildEmailHtml(params: {
  emetteur: string;
  clientNom: string;
  message: string;
  chantiers: ChantierSilencieux[];
  baseUrl: string;
  accent: string;
  logo: string;
  pied: string;
  telephone: string;
  /** Bandeau affiché seulement pour l'essai envoyé à l'artisan lui-même. */
  bandeauEssai?: string;
}): string {
  const { emetteur, clientNom, message, chantiers, baseUrl, accent, logo, pied, telephone, bandeauEssai } = params;

  const cartes = chantiers
    .map((c) => {
      const lien = c.token ? `${baseUrl}/suivi/${c.token}` : "";
      return `<div style="border:1px solid #e5e5e5;border-radius:10px;padding:14px 16px;margin:0 0 12px;background:#ffffff;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;">${escapeHtml(c.libelle)}</p>
        <p style="margin:3px 0 0;font-size:12px;color:#71717a;">
          ${c.adresse ? escapeHtml(c.adresse) : "Adresse à préciser"} · ${escapeHtml(statutLabel(c.statut))}
        </p>
        <div style="margin:12px 0 6px;">
          <span style="font-size:11px;color:#71717a;">Avancement${c.total > 0 ? ` (${c.faites}/${c.total})` : ""}</span>
          <span style="font-size:12px;font-weight:700;color:#18181b;float:right;">${c.progression} %</span>
        </div>
        <div style="height:8px;background:#e4e4e7;border-radius:99px;overflow:hidden;clear:both;">
          <div style="height:8px;width:${c.progression}%;background:${accent};border-radius:99px;"></div>
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;">
          ${c.dateDebut ? `Début ${escapeHtml(dateFr(c.dateDebut))} · ` : ""}${euros(c.montant)}
        </p>
        ${
          lien
            ? `<div style="margin:10px 0 0;text-align:right;">
                 <a href="${escapeHtml(lien)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:8px 16px;border-radius:7px;font-size:12px;font-weight:600;">Voir le suivi</a>
               </div>`
            : ""
        }
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${accent};"></div>
      ${bandeauEssai ? `<div style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:10px 24px;font-size:12px;line-height:1.5;color:#9a3412;">${escapeHtml(bandeauEssai)}</div>` : ""}
      <div style="padding:24px 24px 18px;border-bottom:1px solid #eee;">
        ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(emetteur)}" style="max-height:44px;max-width:170px;display:block;margin:0 0 10px;">` : ""}
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteur)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#71717a;">Des nouvelles de votre chantier</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 10px;font-size:15px;">Bonjour ${escapeHtml(clientNom)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(message)}</p>
        ${cartes}
        <p style="margin:14px 0 0;font-size:11px;color:#a1a1aa;line-height:1.6;text-align:center;">
          Vous recevez ce message car votre artisan suit l'avancement de vos travaux. Le lien du chantier donne accès au détail des étapes.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">${escapeHtml(emetteur)}${telephone ? ` · ${escapeHtml(telephone)}` : ""}</p>
        ${pied ? `<p style="margin:6px 0 0;">${escapeHtml(pied).replace(/\n/g, "<br>")}</p>` : ""}
      </div>
    </div>
  </div>
</body></html>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

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
    // Mode essai : on construit exactement l'email automatique mais on l'envoie à
    // l'artisan lui-même. Aucun client n'est contacté, aucune date n'est mise à jour.
    const test = body.test === true;
    // Mode aperçu : on construit le même email et on renvoie simplement son rendu HTML,
    // sans passer par la boîte mail et sans appeler Resend.
    const preview = body.preview === true;
    // Message en cours de rédaction dans l'application, utilisé pour l'aperçu.
    const messagePreview = typeof body.message === "string" ? body.message.trim() : "";
    if ((test || preview) && !scopeUserId) return json({ ok: false, error: "Vous devez être connecté." }, 401);
    const today = new Date().toISOString().slice(0, 10);

    const admin: Admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

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

    if ((!resendKey || !fromDomain) && !preview) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        clients: 0,
        reason: "L'envoi d'email n'est pas configuré (Resend).",
      });
    }

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, telephone, doc_couleur, doc_afficher_logo, logo_url, doc_pied_page, pause_jusqu_au, comptable_app_url, nouvelles_auto_actif, nouvelles_auto_frequence, nouvelles_auto_jour, nouvelles_auto_heure, nouvelles_auto_message, nouvelles_auto_dernier_envoi",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const cibleHour = parisHour();
    const cibleJour = parisWeekday();
    const cibleJourMois = parisDayOfMonth();

    let sent = 0;
    let clientsTouches = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: number; reason?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const actif = p.nouvelles_auto_actif === true;
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;
      const frequence = p.nouvelles_auto_frequence === "mois" ? "mois" : "semaine";
      const jourChoisi = Number(p.nouvelles_auto_jour);
      const heureChoisie = p.nouvelles_auto_heure === null || p.nouvelles_auto_heure === undefined ? 8 : Number(p.nouvelles_auto_heure);
      const dernierEnvoi = p.nouvelles_auto_dernier_envoi ? String(p.nouvelles_auto_dernier_envoi) : null;

      if (!force && !test && !preview) {
        if (!actif) {
          skipped += 1;
          details.push({ userId, sent: 0, reason: "Envoi automatique désactivé." });
          continue;
        }
        if (enPause) {
          skipped += 1;
          details.push({ userId, sent: 0, reason: "Pause vacances." });
          continue;
        }
        const jourAttendu = frequence === "mois" ? cibleJourMois : cibleJour;
        const jourValide = Number.isFinite(jourChoisi)
          ? Math.round(jourChoisi) === jourAttendu
          : (frequence === "mois" ? 1 : 5) === jourAttendu;
        if (!jourValide || heureChoisie !== cibleHour) {
          details.push({ userId, sent: 0 });
          continue;
        }
        if (dernierEnvoi && dernierEnvoi.slice(0, 10) === today) {
          skipped += 1;
          details.push({ userId, sent: 0, reason: "Déjà envoyé aujourd'hui." });
          continue;
        }
      }

      const { data: chantiersData } = await admin
        .from("chantiers")
        .select(
          "id, libelle, adresse, statut, date_debut, montant, message_client, suivi_token, suivi_actif, suivi_dernier_email_at, created_at, client_id",
        )
        .eq("user_id", userId);
      const chantiers = ((chantiersData ?? []) as Array<Record<string, unknown>>).filter(
        (c) => statutLabel(c.statut) !== "Terminé" && c.suivi_actif !== false && Boolean(toStr(c.suivi_token)) && c.client_id !== null,
      );
      if (chantiers.length === 0) {
        details.push({ userId, sent: 0, reason: "Aucun chantier suivi." });
        continue;
      }

      const clientIds = Array.from(new Set(chantiers.map((c) => toNum(c.client_id)))).filter((id) => id > 0);
      const { data: clientsData } = await admin.from("clients").select("id, nom, email").in("id", clientIds);
      const clientParId = new Map<number, { nom: string; email: string }>();
      ((clientsData ?? []) as Array<Record<string, unknown>>).forEach((c) => {
        const email = toStr(c.email) ?? "";
        if (!email) return;
        clientParId.set(toNum(c.id), { nom: toStr(c.nom) ?? "Client", email });
      });
      if (clientParId.size === 0) {
        if (preview) {
          return json(
            {
              ok: false,
              error:
                "Aucun client joignable pour l'instant : il faut une adresse email dans la fiche client et un suivi partagé.",
            },
            400,
          );
        }
        details.push({ userId, sent: 0, reason: "Aucune adresse email client." });
        continue;
      }

      const idsChantiers = chantiers.map((c) => toNum(c.id));
      const { data: etapesData } = await admin
        .from("etapes_chantier")
        .select("chantier_id, fait")
        .in("chantier_id", idsChantiers)
        .eq("visible_client", true);
      const etapesParChantier = new Map<number, { total: number; faites: number }>();
      ((etapesData ?? []) as Array<Record<string, unknown>>).forEach((e) => {
        const cid = toNum(e.chantier_id);
        const item = etapesParChantier.get(cid) ?? { total: 0, faites: 0 };
        item.total += 1;
        if (e.fait) item.faites += 1;
        etapesParChantier.set(cid, item);
      });

      const parClient = new Map<number, ChantierSilencieux[]>();
      chantiers.forEach((c) => {
        const clientId = toNum(c.client_id);
        if (!clientParId.has(clientId)) return;
        const jours = joursSansEmail(toStr(c.suivi_dernier_email_at), toStr(c.created_at));
        if (jours === null) return;
        // Pour l'essai et l'aperçu, on illustre avec tous les chantiers suivis, même récents :
        // l'artisan voit ainsi un email complet sans attendre 14 jours.
        if (!test && !preview && jours < SEUIL_JOURS) return;
        const stats = etapesParChantier.get(toNum(c.id)) ?? { total: 0, faites: 0 };
        const item: ChantierSilencieux = {
          id: toNum(c.id),
          libelle: toStr(c.libelle) ?? "Chantier",
          adresse: toStr(c.adresse),
          statut: statutLabel(c.statut),
          dateDebut: toStr(c.date_debut),
          montant: toNum(c.montant),
          message: toStr(c.message_client),
          token: toStr(c.suivi_token) ?? "",
          progression: stats.total === 0 ? 0 : Math.round((stats.faites / stats.total) * 100),
          faites: stats.faites,
          total: stats.total,
          jours,
        };
        const liste = parClient.get(clientId) ?? [];
        liste.push(item);
        parClient.set(clientId, liste);
      });

      if (parClient.size === 0) {
        if (preview) {
          return json(
            {
              ok: false,
              error:
                "Aucun chantier suivi à faire figurer dans l'aperçu : partagez le suivi d'un chantier et renseignez l'email de son client.",
            },
            400,
          );
        }
        details.push({ userId, sent: 0, reason: "Aucun client silencieux." });
        continue;
      }

      const emetteur = String(p.entreprise ?? p.metier ?? "Votre artisan").trim() || "Votre artisan";
      const accent = /^#[0-9a-fA-F]{6}$/.test(String(p.doc_couleur ?? "")) ? String(p.doc_couleur) : "#C4783A";
      const logo = p.doc_afficher_logo === false ? "" : String(p.logo_url ?? "").trim();
      const pied = String(p.doc_pied_page ?? "").trim();
      const telephone = String(p.telephone ?? "").trim();
      const baseUrl = (String(p.comptable_app_url ?? "").trim() || "https://artiflow-pro.com").replace(/\/+$/, "");
      const messagePerso = String(p.nouvelles_auto_message ?? "").trim();
      const messageDefaut =
        "Petit point sur l'avancement de votre chantier : les travaux progressent comme prévu. Le détail des étapes est à jour sur votre page de suivi.";

      if (test || preview) {
        const entree = Array.from(parClient.entries())[0];
        if (!entree) {
          return json({ ok: false, error: "Aucun chantier suivi à faire figurer dans cet email." }, 400);
        }
        const destinataire = String(p.email ?? "").trim();
        if (!preview && !destinataire) {
          return json(
            { ok: false, error: "Renseignez l'adresse email de votre profil pour recevoir l'essai." },
            400,
          );
        }
        const [clientIdEssai, listeEssai] = entree;
        const clientEssai = clientParId.get(clientIdEssai);
        const extrait = listeEssai.slice(0, 3);
        const sujetEssai = preview
          ? extrait.length === 1
            ? `Suivi de chantier · ${extrait[0].libelle}${extrait[0].progression ? ` — ${extrait[0].progression} %` : ""}`
            : `Nouvelles de vos chantiers · ${extrait.length} chantiers`
          : extrait.length === 1
            ? `Essai · Suivi de chantier · ${extrait[0].libelle}`
            : `Essai · Nouvelles de vos chantiers · ${extrait.length} chantiers`;
        const htmlEssai = buildEmailHtml({
          emetteur,
          clientNom: clientEssai?.nom ?? "Client",
          message: messagePreview || messagePerso || messageDefaut,
          chantiers: extrait,
          baseUrl,
          accent,
          logo,
          pied,
          telephone,
          bandeauEssai: preview
            ? "Aperçu de l'email groupé : voici exactement ce que recevrait ce client. Aucun email n'a été envoyé et aucune date de contact n'a été modifiée."
            : "Email d'essai envoyé à votre propre adresse pour vérifier le rendu. Aucun client ne l'a reçu et aucune date de contact n'a été modifiée.",
        });

        // Aperçu : on s'arrête ici, rien ne part vers Resend.
        if (preview) {
          return json({
            ok: true,
            configured: Boolean(resendKey && fromDomain),
            preview: true,
            html: htmlEssai,
            subject: sujetEssai,
            destinataire: clientEssai?.email ?? null,
            client: clientEssai?.nom ?? null,
            chantiers: extrait.length,
          });
        }
        const resEssai = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${emetteur} <noreply@${fromDomain}>`,
            to: [destinataire],
            reply_to: destinataire,
            subject: sujetEssai,
            html: htmlEssai,
          }),
        });
        if (!resEssai.ok) {
          const errEssai = (await resEssai.json().catch(() => null)) as { message?: string } | null;
          return json(
            { ok: false, error: errEssai?.message || `Resend a refusé l'envoi de l'essai (code ${resEssai.status}).` },
            502,
          );
        }
        return json({ ok: true, configured: true, test: true, destinataire, chantiers: extrait.length });
      }

      let envoyesUtilisateur = 0;

      for (const [clientId, liste] of parClient) {
        const client = clientParId.get(clientId);
        if (!client) continue;
        const subjects =
          liste.length === 1
            ? `Suivi de chantier · ${liste[0].libelle}${liste[0].progression ? ` — ${liste[0].progression} %` : ""}`
            : `Nouvelles de vos chantiers · ${liste.length} chantiers`;
        const html = buildEmailHtml({
          emetteur,
          clientNom: client.nom,
          message: messagePerso || messageDefaut,
          chantiers: liste,
          baseUrl,
          accent,
          logo,
          pied,
          telephone,
        });

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${emetteur} <noreply@${fromDomain}>`,
              to: [client.email],
              reply_to: String(p.email ?? "").trim() || undefined,
              subject: subjects,
              html,
            }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => null)) as { message?: string } | null;
            const raison = err?.message || `Envoi refusé (code ${res.status}).`;
            for (const c of liste) {
              await admin.from("suivi_notifications").insert({
                user_id: userId,
                chantier_id: c.id,
                destinataire: client.email,
                motif: messagePerso || messageDefaut,
                statut: "echec",
                erreur: raison,
                origine: "auto",
              });
            }
            continue;
          }

          envoyesUtilisateur += 1;
          clientsTouches += 1;
          sent += liste.length;
          const maintenant = new Date().toISOString();
          for (const c of liste) {
            await admin
              .from("chantiers")
              .update({ suivi_dernier_email_at: maintenant, suivi_maj_at: maintenant })
              .eq("id", c.id);
            await admin.from("suivi_notifications").insert({
              user_id: userId,
              chantier_id: c.id,
              destinataire: client.email,
              motif: messagePerso || messageDefaut,
              statut: "envoye",
              sujet: subjects,
              html,
              origine: "auto",
            });
          }
        } catch {
          /* on continue avec les autres clients : un incident ne bloque pas la tournée */
        }
      }

      if (envoyesUtilisateur > 0) {
        await admin
          .from("profiles")
          .update({ nouvelles_auto_dernier_envoi: new Date().toISOString() })
          .eq("id", userId);
      }
      details.push({ userId, sent: envoyesUtilisateur });
    }

    return json({
      ok: true,
      configured: true,
      clients: clientsTouches,
      sent,
      skipped,
      users: scopeUserId ? 1 : (profiles ?? []).length,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
