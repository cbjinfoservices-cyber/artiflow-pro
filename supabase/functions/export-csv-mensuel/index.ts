import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction de l'EXPORT CSV MENSUEL par email.
// Elle est prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée.
// Comme chaque artisan choisit son jour et son heure d'envoi, la tâche planifiée est appelée
// CHAQUE HEURE : chaque passage n'envoie qu'aux artisans dont le jour ET l'heure correspondent
// (défaut : le 1er du mois à 08:00, heure de Paris).
// Un appel avec `userId` + `force: true` (« Tester l'envoi ») expédie tout de suite les exports.
// Un appel avec `userId` + `preview: true` (« Aperçu ») renvoie le HTML de l'email SANS envoyer.
//
// L'email contient deux pièces jointes CSV : le journal des réessais d'envoi et le journal de
// l'escalade serveur des 31 derniers jours. Il peut être mis en copie (Cc) à une liste de
// destinataires (ex. le comptable) pour archivage. Chaque envoi réel est consigné dans
// l'historique export_csv_mensuel_historique et met à jour export_csv_mensuel_dernier_envoi.
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
 * refuse l'envoi ou ne répond pas. Les deux CSV restent joints dans les deux cas.
 * Chaque tentative est tracée pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiEmailOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
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

/** Jour du mois courant à l'heure de Paris (1-31). */
function parisDayOfMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "numeric",
    }).formatToParts(new Date());
    const d = parts.find((p) => p.type === "day")?.value;
    if (d !== undefined) return Number(d);
  } catch {
    /* repli */
  }
  return new Date().getDate();
}

/** Encodage base64 (UTF-8) d'un texte, pour une pièce jointe CSV. */
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(`\uFEFF${text}`);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((row) => row.map(escapeCell).join(";"))];
  return lines.join("\r\n");
}

function str(value: unknown, defaut = ""): string {
  return value === null || value === undefined ? defaut : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Extrait et nettoie une liste d'adresses email (séparateurs virgule/point-virgule/espace). */
function parseEmailList(raw: unknown): string[] {
  const texte = str(raw).trim();
  if (!texte) return [];
  const valides: string[] = [];
  const vus = new Set<string>();
  for (const morceau of texte.split(/[,;\s]+/)) {
    const mail = morceau.trim().toLowerCase();
    if (!mail) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) continue;
    if (vus.has(mail)) continue;
    vus.add(mail);
    valides.push(mail);
  }
  return valides;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Construit le CSV du journal des réessais d'envoi (table reessais_envoi_historique). */
function buildReessaisCsv(rows: Array<Record<string, unknown>>): string {
  const data = rows.map((r) => {
    const d = new Date(str(r.created_at));
    const valide = !Number.isNaN(d.getTime());
    const fenetre = num(r.fenetre_jours) === 1 ? "24 h" : `${num(r.fenetre_jours)} j`;
    return [
      valide ? d.toLocaleDateString("fr-FR") : str(r.created_at),
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      fenetre,
      str(r.resume, "Réessai effectué"),
      String(num(r.relances_relancees)),
      String(num(r.relances_echouees)),
      r.test_relance ? "Oui" : "Non",
    ];
  });
  return toCsv(
    ["Date", "Heure", "Fenêtre", "Résultat", "Envois relancés", "Encore en échec", "Test email"],
    data,
  );
}

/** Construit le CSV du journal de l'escalade serveur (table escalade_journal). */
function buildEscaladeCsv(rows: Array<Record<string, unknown>>): string {
  const data = rows.map((run) => {
    const d = new Date(str(run.run_at));
    const valide = !Number.isNaN(d.getTime());
    const clientsEchoues = Array.isArray(run.clients_echoues)
      ? (run.clients_echoues as Array<Record<string, unknown>>)
      : [];
    const detail = clientsEchoues
      .map((c) => {
        const numero = c.numero ? ` (${str(c.numero)})` : "";
        const retard = num(c.jours) > 0 ? ` - ${num(c.jours)} j de retard` : "";
        return `${str(c.nom, "Client")}${numero} [${str(c.canal, "Email")}]${retard} : ${str(c.erreur, "Envoi impossible.")}`;
      })
      .join(" | ");
    return [
      valide ? d.toLocaleDateString("fr-FR") : str(run.run_at),
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      String(num(run.examined)),
      String(num(run.envoye)),
      String(num(run.echoue)),
      detail,
    ];
  });
  return toCsv(
    ["Date", "Heure", "Dossiers examinés", "Envois réussis", "Échecs", "Clients non envoyés"],
    data,
  );
}

function buildEmailHtml(
  nom: string,
  nbReessais: number,
  nbPassages: number,
  reessaisName: string,
  escaladeName: string,
  ccList: string[],
): string {
  const blocCc = ccList.length
    ? `<p style="margin:16px 0 0;font-size:12px;color:#71717a;line-height:1.6;">Copie archive envoyée à : ${escapeHtml(
        ccList.join(", "),
      )}</p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Vos exports CSV mensuels</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">
          Voici l'archive de vos journaux des 31 derniers jours, en pièces jointes prêtes à ouvrir dans Excel.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0 0;">
          <tr>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;width:50%;">
              <div style="font-size:22px;font-weight:700;color:#0f766e;">${nbReessais}</div>
              <div style="font-size:11px;color:#71717a;">réessais</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;width:50%;">
              <div style="font-size:22px;font-weight:700;color:#0f766e;">${nbPassages}</div>
              <div style="font-size:11px;color:#71717a;">passages d'escalade</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Pièces jointes</p>
        <ul style="margin:0;padding-left:18px;">
          <li style="font-size:13px;color:#3f3f46;margin-bottom:4px;">${escapeHtml(reessaisName)} — journal des réessais d'envoi</li>
          <li style="font-size:13px;color:#3f3f46;">${escapeHtml(escaladeName)} — journal de l'escalade serveur</li>
        </ul>
        ${blocCc}
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Export automatique mensuel envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
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
    const brevoKey = (Deno.env.get("BREVO_API_KEY") ?? "").trim();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    const envoiConfigure = Boolean(brevoKey || (resendKey && fromDomain));

    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    const preview = body?.preview === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const dayOverride = Number.isFinite(Number(body?.day)) ? Number(body.day) : null;
    const today = new Date().toISOString().slice(0, 10);
    // Fenêtre analysée : les 31 derniers jours.
    const depuis = new Date(Date.now() - 31 * 86400000).toISOString();

    const admin: Admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // --- Mode APERÇU : renvoie le HTML de l'email sans rien envoyer ---------------------------
    if (preview) {
      if (!scopeUserId) return json({ ok: false, error: "userId requis pour l'aperçu." }, 400);
      const { data: prof, error: prevErr } = await admin
        .from("profiles")
        .select("id, entreprise, metier, email, export_csv_mensuel_cc")
        .eq("id", scopeUserId)
        .maybeSingle();
      if (prevErr) return json({ ok: false, error: prevErr.message }, 500);
      const p = (prof ?? {}) as Record<string, unknown>;
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const email = String(p.email ?? "").trim();
      const ccList = parseEmailList(p.export_csv_mensuel_cc).filter((m) => m !== email.toLowerCase());

      const { data: reessaisRows } = await admin
        .from("reessais_envoi_historique")
        .select("created_at")
        .eq("user_id", scopeUserId)
        .gte("created_at", depuis);
      const { data: escaladeRows } = await admin
        .from("escalade_journal")
        .select("run_at")
        .eq("user_id", scopeUserId)
        .gte("run_at", depuis);

      const reessaisName = `journal-reessais-${today}.csv`;
      const escaladeName = `journal-escalade-${today}.csv`;
      return json({
        ok: true,
        preview: true,
        subject: "Vos exports CSV mensuels — réessais & escalade",
        html: buildEmailHtml(
          nom,
          (reessaisRows ?? []).length,
          (escaladeRows ?? []).length,
          reessaisName,
          escaladeName,
          ccList,
        ),
        cc: ccList,
      });
    }

    if (!envoiConfigure) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        skipped: 0,
        reason: "Aucun service d'envoi configuré (Brevo ou Resend).",
      });
    }

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, export_csv_mensuel_actif, export_csv_mensuel_jour, export_csv_mensuel_heure, export_csv_mensuel_cc",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; reessais?: number; passages?: number }> = [];

    const cibleHour = hourOverride ?? parisHour();
    const cibleDay = dayOverride ?? parisDayOfMonth();

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const actif = p.export_csv_mensuel_actif === true;
      const ccList = parseEmailList(p.export_csv_mensuel_cc).filter((m) => m !== email.toLowerCase());

      if (!force && !actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Export mensuel coupé." });
        continue;
      }
      if (!force && !ignoreTime) {
        const heureChoisie =
          p.export_csv_mensuel_heure === null || p.export_csv_mensuel_heure === undefined
            ? 8
            : Number(p.export_csv_mensuel_heure);
        const jourChoisi =
          p.export_csv_mensuel_jour === null || p.export_csv_mensuel_jour === undefined
            ? 1
            : Number(p.export_csv_mensuel_jour);
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

      // Journal des réessais (31 derniers jours).
      const { data: reessaisRows } = await admin
        .from("reessais_envoi_historique")
        .select("created_at, fenetre_jours, relances_relancees, relances_echouees, test_relance, resume")
        .eq("user_id", userId)
        .gte("created_at", depuis)
        .order("created_at", { ascending: false });
      // Journal de l'escalade serveur (31 derniers jours).
      const { data: escaladeRows } = await admin
        .from("escalade_journal")
        .select("run_at, examined, envoye, echoue, clients_echoues")
        .eq("user_id", userId)
        .gte("run_at", depuis)
        .order("run_at", { ascending: false });

      const reessais = (reessaisRows ?? []) as Array<Record<string, unknown>>;
      const escalade = (escaladeRows ?? []) as Array<Record<string, unknown>>;

      const reessaisName = `journal-reessais-${today}.csv`;
      const escaladeName = `journal-escalade-${today}.csv`;
      const reessaisCsv = buildReessaisCsv(reessais);
      const escaladeCsv = buildEscaladeCsv(escalade);
      const subject = "Vos exports CSV mensuels — réessais & escalade";

      const envoi = await envoyerEmailAvecRepli(
        "export-csv-mensuel",
        {
          nom,
          to: [email],
          cc: ccList,
          subject,
          html: buildEmailHtml(nom, reessais.length, escalade.length, reessaisName, escaladeName, ccList),
          attachments: [
            { filename: reessaisName, content: textToBase64(reessaisCsv) },
            { filename: escaladeName, content: textToBase64(escaladeCsv) },
          ],
        },
        admin,
      );

      if (envoi.ok) {
        sent += 1;
        await admin
          .from("profiles")
          .update({ export_csv_mensuel_dernier_envoi: new Date().toISOString() })
          .eq("id", userId);
        // Consigne l'envoi dans l'historique (best effort).
        try {
          await admin.from("export_csv_mensuel_historique").insert({
            user_id: userId,
            destinataires: email,
            cc: ccList.length ? ccList.join(", ") : null,
            nb_reessais: reessais.length,
            nb_passages: escalade.length,
            test: force,
            statut: "envoye",
          });
        } catch {
          /* l'historique ne bloque pas l'envoi */
        }
        details.push({ userId, sent: true, reessais: reessais.length, passages: escalade.length });
      } else {
        skipped += 1;
        details.push({ userId, sent: false, reason: envoi.error || "Envoi impossible." });
      }
    }

    return json({
      ok: true,
      configured: true,
      users: scopeUserId ? 1 : (profiles ?? []).length,
      sent,
      skipped,
      today,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
