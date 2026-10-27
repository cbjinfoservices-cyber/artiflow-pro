import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Rappel automatique de la veille de la réunion d'équipe : chaque compte reçoit, la veille
// du jour de réunion qu'il a choisi, un email avec la liste des conflits de congé en CSV joint.
// Fonction prévue pour tourner sans session (tâche planifiée / cron), donc verify_jwt = false.
// Appelable avec { force: true } pour un envoi immédiat, ou { ignoreTime: true } pour tester
// hors créneau. Un anti-doublon empêche un second envoi automatique le même jour.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HEURE_ENVOI_DEFAUT = 7; // 07:00 heure de Paris quand le compte n'a rien réglé
const JOUR_REUNION_DEFAUT = 1; // lundi

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

/** Encode un texte UTF-8 en base64, pour la pièce jointe CSV. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Date, heure et jour de la semaine courants à l'heure de Paris. */
function parisNow(): { iso: string; hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour")) % 24;
  const jours: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = jours[get("weekday").slice(0, 3)] ?? 1;
  return { iso, hour, weekday };
}

function formatJourCourt(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatDateHeureFr(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Libellé de la portion de journée depuis l'heure technique de la ligne d'absence. */
function libellePeriode(heure: unknown): string {
  const h = String(heure ?? "").slice(0, 5);
  if (h === "08:00") return "matin";
  if (h === "13:00") return "après-midi";
  return "journée entière";
}

interface LigneCreneau {
  user_id: string;
  id: number;
  date: string;
  heure: string | null;
  libelle: string;
  ville: string | null;
  intervenant_id: number | null;
  statut: string | null;
}

interface ConflitLigne {
  creneauId: number;
  intervenantId: number;
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
  nomIntervenant: string;
  motif: string;
  periode: string;
  traiteLe: string | null;
}

/** Échappe une valeur pour un CSV séparé par des points-virgules (Excel FR). */
function celluleCsv(value: unknown): string {
  const texte = String(value ?? "");
  if (/[";\n\r]/.test(texte)) return `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

/** Construit le CSV des conflits, aligné sur celui produit dans l'application. */
function buildCsv(conflits: ConflitLigne[]): string {
  const entetes = [
    "Date",
    "Heure",
    "Intervention",
    "Lieu",
    "Personne absente",
    "Motif de l'absence",
    "Période",
    "Statut",
    "Traitée le",
    "Alerte responsable",
    "Destinataire",
    "Alerte envoyée le",
    "État de l'alerte",
  ];
  const lignes = conflits.map((c) =>
    [
      c.date,
      c.heure.slice(0, 5),
      c.libelle,
      c.ville || "Lieu à définir",
      c.nomIntervenant,
      c.motif,
      c.periode,
      c.traiteLe ? "Traitée" : "À réaffecter",
      formatDateHeureFr(c.traiteLe),
      "",
      "",
      "",
      "",
    ]
      .map(celluleCsv)
      .join(";"),
  );
  const restants = conflits.filter((c) => !c.traiteLe).length;
  lignes.push(
    [
      "Total",
      "",
      `${conflits.length} conflit${conflits.length > 1 ? "s" : ""}`,
      "",
      "",
      "",
      "",
      `${restants} à réaffecter`,
      "",
      "",
      "",
      "",
      "",
    ]
      .map(celluleCsv)
      .join(";"),
  );
  return [entetes.map(celluleCsv).join(";"), ...lignes].join("\r\n");
}

function buildEmailHtml(params: {
  entreprise: string;
  jourReunion: string;
  conflits: ConflitLigne[];
  restants: number;
  fichier: string;
}): string {
  const { entreprise, jourReunion, conflits, restants, fichier } = params;
  const apercu = conflits
    .slice(0, 8)
    .map(
      (c) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;white-space:nowrap;">${escapeHtml(
          formatJourCourt(c.date),
        )} · ${escapeHtml(c.heure.slice(0, 5))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(c.libelle)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:#3f3f46;">${escapeHtml(
          c.nomIntervenant,
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#71717a;white-space:nowrap;">${escapeHtml(
          c.motif,
        )}</td>
      </tr>`,
    )
    .join("");
  const reste = conflits.length > 8 ? conflits.length - 8 : 0;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#b45309;">Réunion de demain · conflits de congé</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Votre réunion d'équipe a lieu demain (${escapeHtml(jourReunion)}). Voici les interventions qui tombent
          un jour où la personne affectée est absente : elles sont à réaffecter pendant la réunion.
          Le fichier <strong>${escapeHtml(fichier)}</strong> est joint à ce message.
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 0;color:#71717a;width:190px;">Interventions en conflit</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(conflits.length)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;">Encore à réaffecter</td>
            <td style="padding:8px 0;font-weight:700;">${escapeHtml(restants)}</td>
          </tr>
        </table>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Quand</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Intervention</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Personne absente</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Motif</th>
            </tr>
          </thead>
          <tbody>${apercu}</tbody>
        </table>
        ${
          reste > 0
            ? `<p style="margin:10px 0 0;font-size:12px;color:#71717a;">+ ${escapeHtml(reste)} autre(s) intervention(s) dans le fichier joint.</p>`
            : ""
        }
        <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
          Dans le planning, le filtre « Conflits congé » affiche la même liste et propose un remplaçant
          en un clic sur chaque intervention.
        </p>
        <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">Message automatique envoyé depuis ArtiFlow-pro.</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${escapeHtml(entreprise)} · rappel de la veille de la réunion d'équipe
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
    const resendKey = (cleEnvoiEmail() ?? "").trim();
    const fromDomain = (domaineEnvoiEmail() ?? "").trim();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const body = (req.method === "POST" ? await req.json().catch(() => null) : null) ?? {};
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;

    // Restriction à un seul responsable : uniquement quand un jeton valide est présenté.
    // On vérifie l'identité avec le client anon, jamais avec le client service.
    let userFiltre = typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (userFiltre) {
      if (!anonKey || !authHeader) {
        return json({ ok: false, error: "Vous devez être connecté pour lancer ce rappel." }, 401);
      }
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      const appelant = userData?.user;
      if (userError || !appelant) {
        return json({ ok: false, error: "Vous devez être connecté pour lancer ce rappel." }, 401);
      }
      userFiltre = appelant.id;
    }

    const maintenant = parisNow();

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Réglages : un par compte. Sans réglage, aucun rappel n'est envoyé (l'utilisateur ne l'a
    // pas encore activé depuis le planning).
    let requeteConfig = admin
      .from("rappels_conflits_config")
      .select("user_id, jour_reunion, heure_rappel, actif")
      .eq("actif", true);
    if (userFiltre) requeteConfig = requeteConfig.eq("user_id", userFiltre);
    const { data: configs, error: erreurConfig } = await requeteConfig;
    if (erreurConfig) return json({ ok: false, error: erreurConfig.message }, 500);

    // La veille de la réunion : jour de réunion - 1 (dimanche si la réunion est le lundi),
    // puis à l'heure choisie par chaque compte (7 h par défaut). La tâche tourne toutes les
    // heures : chaque compte est donc servi pile à son heure.
    const proprietaires = ((configs ?? []) as Array<Record<string, unknown>>)
      .filter((c) => {
        if (force || ignoreTime) return true;
        const jour = Number(c.jour_reunion ?? JOUR_REUNION_DEFAUT);
        const veille = jour === 1 ? 7 : jour - 1;
        const heure = Number(c.heure_rappel ?? HEURE_ENVOI_DEFAUT);
        return maintenant.weekday === veille && maintenant.hour === heure;
      })
      .map((c) => ({
        userId: String(c.user_id),
        jourReunion: Number(c.jour_reunion ?? JOUR_REUNION_DEFAUT),
        heureRappel: Number(c.heure_rappel ?? HEURE_ENVOI_DEFAUT),
      }));

    if (proprietaires.length === 0) {
      return json({
        ok: true,
        sent: 0,
        reason: "Aucun rappel à envoyer à cette heure-ci (jour ou heure de réunion différents).",
      });
    }

    const ids = proprietaires.map((p) => p.userId);

    // Une seule émission automatique par jour et par compte.
    const { data: traces } = await admin
      .from("envois_liste_conflits")
      .select("user_id, created_at")
      .eq("mode", "auto")
      .in("user_id", ids)
      .gte("created_at", new Date(Date.now() - 20 * 3_600_000).toISOString());
    const dejaEnvoyes = new Set(
      (traces ?? []).map((t) => String((t as Record<string, unknown>).user_id ?? "")),
    );

    const [creneauxRes, traitesRes, profilsRes, intervenantsRes] = await Promise.all([
      admin
        .from("planning_creneaux")
        .select("user_id, id, date, heure, libelle, ville, intervenant_id, statut")
        .in("user_id", ids)
        .gte("date", maintenant.iso),
      admin
        .from("conflits_conges_traites")
        .select("user_id, creneau_id, intervenant_id, traite_le")
        .in("user_id", ids),
      admin.from("profiles").select("id, email, entreprise, metier").in("id", ids),
      admin.from("intervenants").select("id, user_id, nom").in("user_id", ids),
    ]);

    const lignes = (creneauxRes.data ?? []) as LigneCreneau[];
    const nomsIntervenants = new Map<number, string>();
    ((intervenantsRes.data ?? []) as Array<Record<string, unknown>>).forEach((i) => {
      nomsIntervenants.set(Number(i.id), String(i.nom ?? "Intervenant"));
    });
    const profils = new Map<string, Record<string, unknown>>();
    ((profilsRes.data ?? []) as Array<Record<string, unknown>>).forEach((p) => {
      profils.set(String(p.id), p);
    });
    const traites = new Map<string, string>();
    ((traitesRes.data ?? []) as Array<Record<string, unknown>>).forEach((t) => {
      traites.set(`${t.user_id}|${t.creneau_id}|${t.intervenant_id}`, String(t.traite_le ?? ""));
    });

    // Absences par compte : clé « user|intervenant|date ».
    const absences = new Map<string, { motif: string; heure: string | null }>();
    lignes
      .filter((l) => String(l.statut ?? "").toLowerCase() === "indisponible")
      .forEach((l) => {
        if (l.intervenant_id === null) return;
        absences.set(`${l.user_id}|${l.intervenant_id}|${l.date}`, {
          motif: l.libelle,
          heure: l.heure,
        });
      });

    const details: Array<{ userId: string; sent: boolean; reason?: string; conflits?: number }> = [];
    let sent = 0;

    for (const proprietaire of proprietaires) {
      const { userId } = proprietaire;
      const profil = profils.get(userId);
      const destinataire = String(profil?.email ?? "").trim().toLowerCase();
      const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";

      if (dejaEnvoyes.has(userId)) {
        details.push({ userId, sent: false, reason: "Rappel automatique déjà envoyé aujourd'hui." });
        continue;
      }

      const conflits: ConflitLigne[] = lignes
        .filter((l) => l.user_id === userId)
        .filter((l) => String(l.statut ?? "").toLowerCase() !== "indisponible")
        .filter((l) => l.intervenant_id !== null)
        .filter((l) => absences.has(`${userId}|${l.intervenant_id}|${l.date}`))
        .map((l) => {
          const absence = absences.get(`${userId}|${l.intervenant_id}|${l.date}`) as {
            motif: string;
            heure: string | null;
          };
          const cle = `${userId}|${l.id}|${l.intervenant_id}`;
          return {
            creneauId: l.id,
            intervenantId: Number(l.intervenant_id),
            date: l.date,
            heure: String(l.heure ?? "00:00"),
            libelle: l.libelle,
            ville: l.ville,
            nomIntervenant: nomsIntervenants.get(Number(l.intervenant_id)) ?? "Intervenant supprimé",
            motif: absence.motif,
            periode: libellePeriode(absence.heure),
            traiteLe: traites.get(cle) ?? null,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

      if (conflits.length === 0) {
        details.push({ userId, sent: false, reason: "Aucune intervention en conflit de congé." });
        continue;
      }
      if (!destinataire) {
        details.push({ userId, sent: false, reason: "Aucune adresse email sur le profil." });
        continue;
      }

      const restants = conflits.filter((c) => !c.traiteLe).length;
      const fichier = `conflits-conges-${maintenant.iso}.csv`;
      const csv = buildCsv(conflits);
      const jourReunion =
        ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][
          proprietaire.jourReunion - 1
        ] ?? "lundi";
      const subject = `Conflits de congé · réunion de demain (${restants} à réaffecter)`;

      // Aucun envoi possible sans configuration email : on le signale sans casser le cron.
      if (!resendKey || !fromDomain) {
        details.push({
          userId,
          sent: false,
          reason: "Envoi d'email non configuré (Resend).",
          conflits: conflits.length,
        });
        continue;
      }

      try {
        const res = await envoyerEmail("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${entreprise} <noreply@${fromDomain}>`,
            to: [destinataire],
            subject,
            html: buildEmailHtml({ entreprise, jourReunion, conflits, restants, fichier }),
            attachments: [{ filename: fichier, content: toBase64(`\uFEFF${csv}`) }],
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          const message = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
          await admin.from("envois_liste_conflits").insert({
            user_id: userId,
            destinataire,
            total_conflits: conflits.length,
            restants,
            mode: "auto",
            fichier,
            statut: "echec",
            message,
          });
          details.push({ userId, sent: false, reason: message, conflits: conflits.length });
          continue;
        }

        await admin.from("envois_liste_conflits").insert({
          user_id: userId,
          destinataire,
          total_conflits: conflits.length,
          restants,
          mode: "auto",
          fichier,
          statut: "envoye",
        });
        sent += 1;
        details.push({ userId, sent: true, conflits: conflits.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resend injoignable.";
        await admin.from("envois_liste_conflits").insert({
          user_id: userId,
          destinataire,
          total_conflits: conflits.length,
          restants,
          mode: "auto",
          fichier,
          statut: "echec",
          message,
        });
        details.push({ userId, sent: false, reason: message, conflits: conflits.length });
      }
    }

    return json({
      ok: true,
      date: maintenant.iso,
      heureParis: maintenant.hour,
      sent,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});