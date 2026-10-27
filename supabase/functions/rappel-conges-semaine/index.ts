import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Rappel hebdomadaire au responsable : chaque lundi matin (heure de Paris), un email
// récapitule les congés et indisponibilités qui DÉMARRENT la semaine suivante.
// Fonction prévue pour tourner sans session (tâche planifiée / cron), donc verify_jwt = false.
// Appelable avec { force: true } pour un envoi immédiat (test), ou { ignoreTime: true }.
// Un anti-doublon empêche un second envoi pour la même semaine.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FONCTION = "rappel-conges-semaine";
const HEURE_ENVOI = 7; // 07:00 heure de Paris
const JOUR_ENVOI = 1; // lundi

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

function formatJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
}

function formatJourCourt(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function addDaysIso(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
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

/** Libellé de la portion de journée depuis l'heure technique de la ligne d'absence. */
function libellePeriode(heure: unknown): string {
  const h = String(heure ?? "").slice(0, 5);
  if (h === "08:00") return "matin";
  if (h === "13:00") return "après-midi";
  return "";
}

interface LigneAbsence {
  user_id: string;
  date: string;
  heure: string | null;
  libelle: string;
  intervenant_id: number | null;
  note: string | null;
}

interface CongeSemaine {
  nom: string;
  motif: string;
  periode: string;
  debut: string;
  fin: string;
  note: string | null;
}

/** Construit la liste des absences qui commencent dans la semaine cible, pour un propriétaire. */
function construireConges(
  lignes: LigneAbsence[],
  lundi: string,
  dimanche: string,
  nomIntervenant: Map<number, string>,
  userId: string,
): CongeSemaine[] {
  const parCle = new Map<string, LigneAbsence[]>();
  lignes
    .filter((l) => l.user_id === userId)
    .forEach((l) => {
      const cle = `${l.intervenant_id ?? "equipe"}|${l.libelle}`;
      parCle.set(cle, [...(parCle.get(cle) ?? []), l]);
    });

  const resultat: CongeSemaine[] = [];
  parCle.forEach((liste) => {
    const set = new Set(liste.map((l) => l.date));
    const triees = [...liste].sort((a, b) => a.date.localeCompare(b.date));
    // Démarrage : la veille n'appartient pas à la même absence.
    triees.forEach((ligne) => {
      if (ligne.date < lundi || ligne.date > dimanche) return;
      if (set.has(addDaysIso(ligne.date, -1))) return;
      // Fin de la période : on avance tant que le lendemain est absent pour la même clé.
      let fin = ligne.date;
      for (let i = 0; i < 120; i += 1) {
        const suivant = addDaysIso(fin, 1);
        if (!set.has(suivant)) break;
        fin = suivant;
      }
      const intervenantId = ligne.intervenant_id;
      resultat.push({
        nom: intervenantId === null ? "Toute l'équipe" : nomIntervenant.get(intervenantId) ?? `Intervenant #${intervenantId}`,
        motif: ligne.libelle,
        periode: libellePeriode(ligne.heure),
        debut: ligne.date,
        fin,
        note: ligne.note,
      });
    });
  });

  return resultat.sort((a, b) => a.debut.localeCompare(b.debut) || a.nom.localeCompare(b.nom));
}

function buildEmailHtml(params: {
  entreprise: string;
  lundi: string;
  dimanche: string;
  conges: CongeSemaine[];
}): string {
  const { entreprise, lundi, dimanche, conges } = params;
  const lignes = conges
    .map((c) => {
      const periodeTxt = c.periode ? ` (${c.periode})` : "";
      const duree =
        c.debut === c.fin ? formatJourCourt(c.debut) : `${formatJourCourt(c.debut)} → ${formatJourCourt(c.fin)}`;
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;font-weight:700;color:#18181b;">${escapeHtml(c.nom)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;color:#3f3f46;">${escapeHtml(c.motif)}${escapeHtml(periodeTxt)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;color:#3f3f46;white-space:nowrap;">${escapeHtml(duree)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:12px;color:#71717a;">${escapeHtml(c.note ?? "")}</td>
      </tr>`;
    })
    .join("");

  const personnes = new Set(conges.map((c) => c.nom)).size;
  // Aucun congé cette semaine : on garde un email lisible (utile pour l'aperçu avant envoi).
  const corpsTableau =
    lignes ||
    `<tr><td colspan="4" style="padding:14px 8px;font-size:13px;color:#71717a;">Aucune absence ne démarre cette semaine.</td></tr>`;
  const resume =
    conges.length === 0
      ? "Aucune absence ne démarre la semaine prochaine — rien à signaler à l'équipe."
      : `${conges.length} absence${conges.length > 1 ? "s" : ""} pour ${personnes} personne${personnes > 1 ? "s" : ""} — à prendre en compte dans la planification.`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:19px;font-weight:700;">${escapeHtml(entreprise)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Congés qui démarrent la semaine prochaine</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;">Semaine du ${escapeHtml(formatJour(lundi))} au ${escapeHtml(formatJour(dimanche))}</p>
        <p style="margin:0 0 18px;font-size:13px;color:#71717a;">
          ${escapeHtml(resume)}
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Personne</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Motif</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Période</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#71717a;text-transform:uppercase;">Précision</th>
            </tr>
          </thead>
          <tbody>${corpsTableau}</tbody>
        </table>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#3f3f46;">
          Pensez à ne pas affecter ces personnes sur les chantiers de la semaine. Le détail reste visible
          dans le planning (vue Mois, vue Jour et PDF mural).
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Rappel automatique ArtiFlow-pro · envoyé chaque lundi matin
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
    // Mode aperçu : on renvoie le rendu exact de l'email, sans rien envoyer ni journaliser.
    const preview = body?.preview === true;
    // Restriction à un seul responsable : sert au bouton « Tester maintenant ».
    let userFiltre = typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : null;

    // Aperçu et test manuel : on vérifie le porteur du jeton avec le client anon (jamais le
    // client service) et on ne fait confiance qu'à l'identité vérifiée, pas au userId envoyé.
    if (preview || userFiltre) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!supabaseUrl || !anonKey || !authHeader) {
        return json({ ok: false, error: "Vous devez être connecté pour lancer un aperçu." }, 401);
      }
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      const appelant = userData?.user;
      if (userError || !appelant) {
        return json({ ok: false, error: "Vous devez être connecté pour lancer un aperçu." }, 401);
      }
      userFiltre = appelant.id;
    }

    const maintenant = parisNow();
    if (!preview && !force && !ignoreTime && (maintenant.weekday !== JOUR_ENVOI || maintenant.hour !== HEURE_ENVOI)) {
      return json({ ok: true, skipped: true, reason: "Hors créneau (lundi 07:00, heure de Paris)." });
    }

    // Semaine prochaine : du lundi au dimanche (dates civiles de Paris).
    const delta = ((8 - maintenant.weekday) % 7) || 7;
    const lundi = addDaysIso(maintenant.iso, delta);
    const dimanche = addDaysIso(lundi, 6);
    const veille = addDaysIso(lundi, -1);
    const cleSemaine = lundi;

    if (!preview && (!resendKey || !fromDomain)) {
      return json({ ok: false, error: "Envoi d'email non configuré (Resend)." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Absences de la veille au dimanche : la veille permet de savoir si une absence démarre
    // réellement dans la semaine (et non la continuation d'une absence en cours).
    const { data: donnees, error: erreurAbsences } = await admin
      .from("planning_creneaux")
      .select("user_id, date, heure, libelle, intervenant_id, note")
      .eq("statut", "indisponible")
      .gte("date", veille)
      .lte("date", dimanche);
    if (erreurAbsences) return json({ ok: false, error: erreurAbsences.message }, 500);

    const lignes = (donnees ?? []) as LigneAbsence[];
    let proprietaires = Array.from(new Set(lignes.map((l) => l.user_id).filter(Boolean)));
    if (userFiltre) proprietaires = proprietaires.filter((id) => id === userFiltre);
    // L'aperçu doit rester disponible même sans aucune absence : on garde le responsable demandé.
    if (preview && userFiltre && proprietaires.length === 0) proprietaires = [userFiltre];
    if (proprietaires.length === 0) {
      return json({ ok: true, lundi, dimanche, sent: 0, reason: "Aucune absence la semaine prochaine." });
    }

    // Anti-doublon : une seule émission par propriétaire et par semaine.
    const { data: traces } = await admin
      .from("envoi_fournisseur_historique")
      .select("message, created_at")
      .eq("fonction", FONCTION)
      .gte("created_at", new Date(Date.now() - 6 * 86_400_000).toISOString());
    const dejaEnvoyes = new Set(
      (traces ?? []).map((t) => String((t as Record<string, unknown>).message ?? "")),
    );

    const [intervenantsRes, profilsRes] = await Promise.all([
      admin.from("intervenants").select("id, nom, user_id").in("user_id", proprietaires),
      admin.from("profiles").select("id, entreprise, metier, email").in("id", proprietaires),
    ]);

    const nomsIntervenants = new Map<number, string>();
    ((intervenantsRes.data ?? []) as Array<Record<string, unknown>>).forEach((i) => {
      nomsIntervenants.set(Number(i.id), String(i.nom ?? "Intervenant"));
    });
    const profils = new Map<string, Record<string, unknown>>();
    ((profilsRes.data ?? []) as Array<Record<string, unknown>>).forEach((p) => {
      profils.set(String(p.id), p);
    });

    // Aperçu avant envoi : le même HTML que celui réellement expédié, sans envoi.
    if (preview) {
      const userId = proprietaires[0];
      const profil = profils.get(userId);
      const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
      const destinataire = String(profil?.email ?? "").trim() || null;
      const conges = construireConges(lignes, lundi, dimanche, nomsIntervenants, userId);
      const subject =
        conges.length === 0
          ? `Congés à venir · semaine du ${formatJourCourt(lundi)} au ${formatJourCourt(dimanche)}`
          : `Congés de la semaine du ${formatJourCourt(lundi)} au ${formatJourCourt(dimanche)} · ${conges.length} absence${conges.length > 1 ? "s" : ""}`;
      return json({
        ok: true,
        preview: true,
        lundi,
        dimanche,
        conges: conges.length,
        destinataire,
        subject,
        html: buildEmailHtml({ entreprise, lundi, dimanche, conges }),
      });
    }

    let sent = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; conges?: number }> = [];

    for (const userId of proprietaires) {
      const profil = profils.get(userId);
      const destinataire = String(profil?.email ?? "").trim();
      const entreprise = String(profil?.entreprise || profil?.metier || "").trim() || "ArtiFlow-pro";
      const conges = construireConges(lignes, lundi, dimanche, nomsIntervenants, userId);
      const cle = `${userId}|${cleSemaine}`;

      if (conges.length === 0) {
        details.push({ userId, sent: false, reason: "Aucun congé ne démarre cette semaine." });
        continue;
      }
      if (!force && dejaEnvoyes.has(cle)) {
        details.push({ userId, sent: false, reason: "Rappel déjà envoyé pour cette semaine.", conges: conges.length });
        continue;
      }
      if (!destinataire) {
        details.push({ userId, sent: false, reason: "Aucune adresse email sur le profil.", conges: conges.length });
        continue;
      }

      const subject = `Congés de la semaine du ${formatJourCourt(lundi)} au ${formatJourCourt(dimanche)} · ${conges.length} absence${conges.length > 1 ? "s" : ""}`;

      try {
        const res = await envoyerEmail("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${entreprise} <noreply@${fromDomain}>`,
            to: [destinataire],
            subject,
            html: buildEmailHtml({ entreprise, lundi, dimanche, conges }),
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          const message = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
          await admin.from("envoi_fournisseur_historique").insert({
            fonction: FONCTION,
            fournisseur: "resend",
            statut: "echec",
            repli: false,
            message,
          });
          details.push({ userId, sent: false, reason: message, conges: conges.length });
          continue;
        }
        sent += 1;
        await admin.from("envoi_fournisseur_historique").insert({
          fonction: FONCTION,
          fournisseur: "resend",
          statut: "succes",
          repli: false,
          message: cle,
        });
        details.push({ userId, sent: true, conges: conges.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resend injoignable.";
        await admin.from("envoi_fournisseur_historique").insert({
          fonction: FONCTION,
          fournisseur: "resend",
          statut: "echec",
          repli: false,
          message,
        });
        details.push({ userId, sent: false, reason: message, conges: conges.length });
      }
    }

    return json({ ok: true, lundi, dimanche, sent, details });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
