import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

// ENVOI ANNUEL automatique du PDF d'HISTORIQUE DES RÉCAPS MENSUELS « mot de passe ancien ».
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée.
// Chaque passage n'envoie qu'en janvier, le jour choisi (3 par défaut) : on transmet alors au
// comptable l'historique complet des récaps mensuels de l'exercice qui vient de s'achever,
// sous forme de PDF d'archivage. Anti-doublon via mot_de_passe_recap_annuel_dernier.
// Un appel avec { userId, force: true } (bouton « Tester ») envoie tout de suite le PDF à
// l'artisan, sans tenir compte du jour ni de l'anti-doublon.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

const autoTable = autoTableImport as unknown as (
  doc: unknown,
  options: Record<string, unknown>,
) => void;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JOUR_ENVOI = 3; // jour de janvier
const HEURE_ENVOI = 7; // 07:00, heure de Paris

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [154, 120, 44];
const SECONDARY: [number, number, number] = [122, 88, 60];

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
 * refuse l'envoi ou ne répond pas : l'historique annuel des récaps n'est jamais perdu à
 * cause d'un seul fournisseur. Chaque tentative est tracée pour la carte « Suivi des envois ».
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

  const brevoKey = (Deno.env.get("BREVO_API_KEY") ?? "").trim();
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Parties « jour / heure / année / mois » à l'heure de Paris. */
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

/** Libellé long « octobre 2026 » à partir d'une clé « AAAA-MM ». */
function libelleMoisCle(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return cle;
  const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface LigneRecap {
  moisLabel: string;
  dateLabel: string;
  heureLabel: string;
  type: string;
  destinataire: string;
  copieComptable: boolean;
}

interface Emetteur {
  entreprise: string;
  metier?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
  tva?: string | null;
}

interface CellInfo {
  section: string;
  column: { index: number };
  cell: { raw: unknown; styles: Record<string, unknown> };
}

/**
 * Construit un PDF « historique des récaps mensuels » de l'exercice : en-tête émetteur,
 * indicateurs (total, réels, tests, dernier envoi) et tableau détaillé (mois récapitulé,
 * date, heure, type, destinataire, comptable en copie). Document d'archivage annuel.
 */
function buildRecapMensuelPdf(params: {
  emetteur: Emetteur;
  annee: string;
  lignes: LigneRecap[];
  stats: { total: number; reels: number; tests: number; dernier: string };
}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("HISTORIQUE DES RÉCAPS MENSUELS", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Alertes « mot de passe ancien » transmises à l'artisan", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(`Exercice ${params.annee}`, pageW - margin, 71, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(params.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    params.emetteur.metier,
    params.emetteur.telephone,
    params.emetteur.email,
    params.emetteur.siret ? `SIRET : ${params.emetteur.siret}` : null,
    params.emetteur.tva ? `N° TVA : ${params.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => doc.text(line, margin, 115 + i * 12));

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  const gap = 10;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 50;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "RÉCAPS ENVOYÉS", value: String(params.stats.total) },
    { label: "RÉELS", value: String(params.stats.reels) },
    { label: "TESTS", value: String(params.stats.tests) },
    { label: "DERNIER ENVOI", value: params.stats.dernier },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 17);
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 36);
  });

  const y = boxTop + boxH + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Récaps de l'exercice (${params.lignes.length})`, margin, y);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois récapitulé", "Date", "Heure", "Type", "Destinataire", "Comptable"]] as string[][],
    body: params.lignes.length
      ? params.lignes.map((r) => [
          r.moisLabel,
          r.dateLabel,
          r.heureLabel,
          r.type,
          r.destinataire || "—",
          r.copieComptable ? "En copie" : "Non",
        ])
      : [["—", "Aucun récap sur cet exercice", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { cellWidth: 74 },
      2: { cellWidth: 46 },
      3: { cellWidth: 78 },
      5: { cellWidth: 62 },
    },
    didParseCell: (data: CellInfo) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = String(data.cell.raw ?? "");
        if (val === "Automatique") data.cell.styles.textColor = ACCENT;
        else if (val === "Test manuel") data.cell.styles.textColor = SECONDARY;
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Historique généré avec ArtiFlow-Pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

function buildEmailHtml(nom: string, annee: string, total: number, reels: number, tests: number): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Historique annuel des récaps mot de passe · exercice ${escapeHtml(annee)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint l'<strong>historique des récaps mensuels de sécurité</strong> de l'exercice
          <strong>${escapeHtml(annee)}</strong> : l'ensemble des récapitulatifs « mot de passe ancien » adressés à
          l'artisan, à conserver pour votre archivage.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Récaps envoyés : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Automatiques : <strong style="color:#18181b;">${reels}</strong></p>
          <p style="margin:0;color:#71717a;">Tests : <strong style="color:#18181b;">${tests}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question. Merci de votre confiance.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-Pro pour ${escapeHtml(nom)}.
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
    const resendKey = cleEnvoiEmail();
    const fromDomain = domaineEnvoiEmail();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const simulerEchecBrevo = body?.simulerEchecBrevo === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    const anneeForcee = typeof body?.annee === "string" && /^\d{4}$/.test(body.annee) ? Number(body.annee) : null;

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

    const { day: todayDay, hour: todayHour, year, month } = parisParts();
    // Exercice clôturé : l'année qui vient de s'achever si l'on est en janvier, sinon l'année en cours.
    const anneeCible = month <= 1 ? year - 1 : year;
    const anneeNum = anneeForcee ?? anneeCible;
    const anneeStr = String(anneeNum);
    const rangeStart = new Date(anneeNum, 0, 1).toISOString();
    const rangeEnd = new Date(anneeNum + 1, 0, 1).toISOString();
    const canSend = Boolean((Deno.env.get("BREVO_API_KEY") ?? "").trim() || (resendKey && fromDomain));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, siret, tva, comptable_email, comptable_cc_email, comptable_app_url, mot_de_passe_recap_annuel_actif, mot_de_passe_recap_annuel_dernier",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; total?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const artisanEmail = String(p.email ?? "").trim();
      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const comptableEmails = [String(p.comptable_email ?? "").trim(), String(p.comptable_cc_email ?? "").trim()]
        .filter((a) => a)
        .filter((a, i, arr) => arr.indexOf(a) === i);

      const actif = p.mot_de_passe_recap_annuel_actif !== false || force;
      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Envoi annuel désactivé." });
        continue;
      }
      if (!force && String(p.mot_de_passe_recap_annuel_dernier ?? "") === anneeStr) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Historique déjà envoyé pour cet exercice." });
        continue;
      }
      // Passage planifié : uniquement en janvier, le jour et l'heure choisis.
      if (!scopeUserId && !ignoreTime) {
        if (month !== 1) {
          details.push({ userId, sent: false, reason: "Hors fenêtre (janvier)." });
          continue;
        }
        if (todayDay !== JOUR_ENVOI || todayHour !== HEURE_ENVOI) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }

      const { data: rows, error: rowError } = await admin
        .from("mot_de_passe_recap_historique")
        .select("mois_cle, destinataire, copie_comptable, manuel, created_at")
        .eq("user_id", userId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: true });
      if (rowError) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Lecture de l'historique impossible." });
        continue;
      }

      const entrees = (rows ?? []) as Array<Record<string, unknown>>;
      const reels = entrees.filter((e) => e.manuel !== true).length;
      const tests = entrees.length - reels;

      // En usage normal : il faut un comptable destinataire. En test : l'email de l'artisan suffit.
      if (!force && comptableEmails.length === 0) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (entrees.length === 0 && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun récap sur l'exercice." });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun service d'envoi configuré." });
        continue;
      }

      // Destinataires : le comptable (+ Cc) ; en test, l'artisan.
      const destinataires: string[] = [];
      const pushDest = (addr: string) => {
        const a = addr.trim();
        if (!a) return;
        if (!destinataires.some((d) => d.toLowerCase() === a.toLowerCase())) destinataires.push(a);
      };
      if (force) {
        pushDest(artisanEmail);
      } else {
        comptableEmails.forEach(pushDest);
        pushDest(artisanEmail); // copie à l'artisan pour sa propre archive
      }
      if (destinataires.length === 0) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucune adresse destinataire." });
        continue;
      }

      const lignes: LigneRecap[] = entrees.map((r) => {
        const d = new Date(String(r.created_at ?? ""));
        const valide = !Number.isNaN(d.getTime());
        return {
          moisLabel: libelleMoisCle(String(r.mois_cle ?? "")),
          dateLabel: valide ? d.toLocaleDateString("fr-FR") : String(r.created_at ?? ""),
          heureLabel: valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
          type: r.manuel === true ? "Test manuel" : "Automatique",
          destinataire: r.destinataire == null ? "" : String(r.destinataire),
          copieComptable: r.copie_comptable === true,
        };
      });
      const dernier = lignes.length ? lignes[lignes.length - 1].dateLabel : "—";

      const pdf = buildRecapMensuelPdf({
        emetteur: {
          entreprise: emetteurNom,
          metier: p.metier ? String(p.metier) : null,
          telephone: p.telephone ? String(p.telephone) : null,
          email: p.email ? String(p.email) : null,
          siret: p.siret ? String(p.siret) : null,
          tva: p.tva ? String(p.tva) : null,
        },
        annee: anneeStr,
        lignes,
        stats: { total: entrees.length, reels, tests, dernier },
      });
      const pdfBase64 = toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer));
      const filename = `historique-recaps-mensuels-${anneeStr}.pdf`;
      const subject = force
        ? `Historique annuel des récaps mot de passe (test) — ${anneeStr}`
        : `Historique annuel des récaps mot de passe — ${anneeStr}`;

      try {
        const envoi = await envoyerEmailAvecRepli(
          "envoi-recap-mensuel-annuel",
          {
            nom: emetteurNom,
            to: destinataires,
            subject,
            html: buildEmailHtml(emetteurNom, anneeStr, entrees.length, reels, tests),
            attachments: [{ filename, content: pdfBase64 }],
          },
          admin,
          { simulerEchecBrevo },
        );
        if (!envoi.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: envoi.error || "Envoi refusé par les fournisseurs." });
          continue;
        }
        if (!force) {
          await admin
            .from("profiles")
            .update({ mot_de_passe_recap_annuel_dernier: anneeStr, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        sent += 1;
        details.push({ userId, sent: true, total: entrees.length });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      annee: anneeStr,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
