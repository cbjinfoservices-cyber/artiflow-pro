import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction du récapitulatif HEBDOMADAIRE des alertes de taux de réussite.
// Elle est prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir Agents → Tâches planifiées). Comme chaque artisan choisit son jour et son heure
// d'envoi, la tâche planifiée est appelée CHAQUE HEURE : chaque passage n'envoie qu'aux
// artisans dont le jour ET l'heure correspondent (défaut : lundi 08:00, heure de Paris).
// Un appel avec `userId` + `force: true` (bouton « Tester maintenant ») envoie tout de suite
// le récap de cet artisan, sans tenir compte du jour/heure.
//
// Le contenu est la synthèse des alertes de taux (réelles et tests) envoyées sur les 7
// derniers jours : nombre total, répartition Auto/Test, jours concernés et détail par alerte.
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

interface AlerteTaux {
  id: number;
  taux: number;
  seuil: number;
  jours: number;
  total: number;
  echecs: number;
  manuel: boolean;
  created_at: string;
}

function frDate(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function frDateTime(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function estEnPause(pauseJusquAu: unknown): boolean {
  if (!pauseJusquAu) return false;
  return String(pauseJusquAu).slice(0, 10) >= new Date().toISOString().slice(0, 10);
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

function buildEmailHtml(nom: string, alertes: AlerteTaux[], debut: string, fin: string): string {
  const total = alertes.length;
  const auto = alertes.filter((a) => !a.manuel).length;
  const test = total - auto;
  const jours = new Set(alertes.map((a) => String(a.created_at).slice(0, 10))).size;
  const sousSeuil = alertes.filter((a) => a.taux < a.seuil).length;

  const lignes = [...alertes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(
      (a) => `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#18181b;">${escapeHtml(frDateTime(a.created_at))}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#18181b;font-weight:700;">${a.taux}%</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${a.seuil}%</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${a.jours} j</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${a.total} test${a.total > 1 ? "s" : ""}${a.echecs > 0 ? ` · ${a.echecs} échec${a.echecs > 1 ? "s" : ""}` : ""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:${a.manuel ? "#7c3aed" : "#0f766e"};">${a.manuel ? "Test" : "Auto"}</td>
      </tr>`,
    )
    .join("");

  const blocCorps =
    total === 0
      ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#3f3f46;">Aucune alerte de taux n'a été envoyée cette semaine. Tout est calme.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
          <tr>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#18181b;">${total}</div>
              <div style="font-size:11px;color:#71717a;">alerte${total > 1 ? "s" : ""}</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#0f766e;">${auto}</div>
              <div style="font-size:11px;color:#71717a;">auto</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#18181b;">${jours}</div>
              <div style="font-size:11px;color:#71717a;">jour${jours > 1 ? "s" : ""}</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${sousSeuil > 0 ? "#b91c1c" : "#18181b"};">${sousSeuil}</div>
              <div style="font-size:11px;color:#71717a;">sous seuil</div>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 8px;font-size:13px;color:#52525b;">
          ${auto} alerte${auto > 1 ? "s" : ""} automatique${auto > 1 ? "s" : ""}${test > 0 ? ` · ${test} test${test > 1 ? "s" : ""} manuel${test > 1 ? "s" : ""}` : ""}.
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Envoyée le</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Taux</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Seuil</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Fenêtre</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Échantillon</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Type</th>
          </tr></thead>
          <tbody>${lignes}</tbody>
        </table>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap hebdomadaire des alertes de taux — du ${escapeHtml(frDate(debut))} au ${escapeHtml(frDate(fin))}</p>
      </div>
      <div style="padding:24px;">
        ${blocCorps}
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Charge les alertes de taux des 7 derniers jours pour un artisan. */
async function chargerAlertesSemaine(admin: Admin, userId: string): Promise<AlerteTaux[]> {
  const debut = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("taux_alerte_historique")
    .select("id, taux, seuil, jours, total, echecs, manuel, created_at")
    .eq("user_id", userId)
    .gte("created_at", debut)
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    taux: Number(row.taux ?? 0),
    seuil: Number(row.seuil ?? 0),
    jours: Number(row.jours ?? 0),
    total: Number(row.total ?? 0),
    echecs: Number(row.echecs ?? 0),
    manuel: Boolean(row.manuel),
    created_at: String(row.created_at ?? ""),
  }));
}

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
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const dayOverride = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : null;

    if (!preview && (!resendKey || !fromDomain)) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        skipped: 0,
        reason: "Resend non configuré (clé API + domaine d'envoi).",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, pause_jusqu_au, taux_alerte_recap_hebdo_actif, taux_alerte_recap_hebdo_jour, taux_alerte_recap_hebdo_heure, taux_alerte_recap_hebdo_dernier_envoi",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const fin = new Date().toISOString();
    const debut = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Mode aperçu : on construit l'email pour l'artisan ciblé et on le renvoie tel quel, sans
    // rien envoyer (même si Resend n'est pas encore configuré), pour valider le rendu.
    if (preview && scopeUserId) {
      const rawPrev = (profiles ?? [])[0];
      if (!rawPrev) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pPrev = rawPrev as Record<string, unknown>;
      const nomPrev = String(pPrev.entreprise ?? pPrev.metier ?? "Votre artisan");
      const alertesPrev = await chargerAlertesSemaine(admin, scopeUserId);
      const subjectPrev = `Récap hebdo des alertes de taux · ${alertesPrev.length} alerte${alertesPrev.length > 1 ? "s" : ""}`;
      return json({
        ok: true,
        preview: true,
        html: buildEmailHtml(nomPrev, alertesPrev, debut, fin),
        subject: subjectPrev,
        alertes: alertesPrev.length,
      });
    }

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string }> = [];

    const cibleHour = hourOverride ?? parisHour();
    const cibleDay = dayOverride ?? parisWeekday();

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const actif = p.taux_alerte_recap_hebdo_actif === true;
      const enPause = estEnPause(p.pause_jusqu_au);

      if (!force && !actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap hebdo coupé." });
        continue;
      }
      if (!force && enPause) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Pause vacances." });
        continue;
      }
      if (!force && !ignoreTime) {
        const heureChoisie =
          p.taux_alerte_recap_hebdo_heure === null || p.taux_alerte_recap_hebdo_heure === undefined
            ? 8
            : Number(p.taux_alerte_recap_hebdo_heure);
        const jourChoisi =
          p.taux_alerte_recap_hebdo_jour === null || p.taux_alerte_recap_hebdo_jour === undefined
            ? 1
            : Number(p.taux_alerte_recap_hebdo_jour);
        if (heureChoisie !== cibleHour || jourChoisi !== cibleDay) {
          details.push({ userId, sent: false });
          continue;
        }
      }
      if (!email) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email manquant." });
        continue;
      }

      const alertes = await chargerAlertesSemaine(admin, userId);
      const subject = `Récap hebdo des alertes de taux · ${alertes.length} alerte${alertes.length > 1 ? "s" : ""}`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${nom} <noreply@${fromDomain}>`,
            to: [email],
            subject,
            html: buildEmailHtml(nom, alertes, debut, fin),
          }),
        });
        if (res.ok) {
          sent += 1;
          await admin
            .from("profiles")
            .update({ taux_alerte_recap_hebdo_dernier_envoi: new Date().toISOString() })
            .eq("id", userId);
          details.push({ userId, sent: true });
        } else {
          const errData = (await res.json().catch(() => null)) as { message?: string } | null;
          skipped += 1;
          details.push({ userId, sent: false, reason: errData?.message || "Refus de Resend." });
        }
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
