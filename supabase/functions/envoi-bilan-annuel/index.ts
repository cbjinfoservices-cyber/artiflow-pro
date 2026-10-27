import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

// Envoi automatique du bilan d'archivage annuel.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée.
// Chaque passage n'envoie qu'aux artisans dont le jour correspond, et seulement en
// janvier : on transmet alors au comptable l'HISTORIQUE des envois comptables de
// l'exercice qui vient de s'achever, sous forme de PDF d'archivage (bilan d'archivage).
// Même principe que l'envoi mensuel du journal comptable.

const autoTable = autoTableImport as unknown as (
  doc: unknown,
  options: Record<string, unknown>,
) => void;

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
 * refuse l'envoi ou ne répond pas : le bilan d'archivage annuel n'est jamais perdu à cause
 * d'un seul fournisseur. Chaque tentative est tracée pour la carte « Suivi des envois ».
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

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];

/** Date et heure courtes françaises (« 12 oct. 2026 à 08:00 »), en heure de Paris. */
function dateHeureLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} à ${heure}`;
}

interface HistoriqueLigne {
  mois: string;
  date: string;
  mode: string;
  lignes: string;
  destinataire: string;
  type: string;
  vers: string;
}

interface Emetteur {
  entreprise: string;
  metier?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
  tva?: string | null;
}

/**
 * Construit un PDF « historique des envois au comptable » pour un exercice :
 * en-tête émetteur, synthèse (total, récaps reçus / transmis), détail des envois
 * (avec la colonne « Vers (moi / comptable) ») et récap envois + lignes par
 * destinataire. Document d'archivage cohérent avec l'export de l'Espace comptable.
 */
function buildHistoriquePdf(params: {
  emetteur: Emetteur;
  filtreLabel: string;
  lignes: HistoriqueLigne[];
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
  doc.text("BILAN D'ARCHIVAGE ANNUEL", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Historique des envois comptables de l'exercice", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(params.filtreLabel, pageW - margin, 71, { align: "right" });

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

  const lignes = params.lignes;
  const total = lignes.length;
  const recapMoi = lignes.filter((l) => l.vers === "Moi").length;
  const recapComptable = lignes.filter((l) => l.vers === "Comptable").length;
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "ENVOIS AU TOTAL", value: String(total) },
    { label: "RÉCAPS REÇUS (VOUS)", value: String(recapMoi) },
    { label: "VERS LE COMPTABLE", value: String(recapComptable) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  const y = boxTop + boxH + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des envois de l'exercice", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${total} ligne${total > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Mois", "Date", "Mode", "Lignes", "Destinataire", "Type", "Vers (moi / comptable)"]],
    body: total
      ? lignes.map((l) => [l.mois, l.date || "—", l.mode, l.lignes, l.destinataire || "—", l.type, l.vers])
      : [["Aucun envoi sur cet exercice", "", "", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 84 },
      2: { cellWidth: 56 },
      3: { halign: "right", cellWidth: 40 },
      5: { cellWidth: 66 },
      6: { halign: "right", cellWidth: 70 },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Récap par destinataire (moi / comptable) : envois et lignes transmises.
  const parDest = new Map<string, { envois: number; lignes: number }>();
  lignes.forEach((l) => {
    const key = l.vers === "Moi" ? "Moi" : "Comptable";
    const b = parDest.get(key) ?? { envois: 0, lignes: 0 };
    b.envois += 1;
    const n = Number(l.lignes);
    if (Number.isFinite(n)) b.lignes += n;
    parDest.set(key, b);
  });
  const versMoi = parDest.get("Moi") ?? { envois: 0, lignes: 0 };
  const versComptable = parDest.get("Comptable") ?? { envois: 0, lignes: 0 };

  let afterDest = afterTable;
  if (afterDest > pageH - 170) {
    doc.addPage();
    afterDest = margin + 10;
  }
  const destY = afterDest + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Envois et lignes par destinataire", margin, destY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("moi / comptable", pageW - margin, destY, { align: "right" });

  autoTable(doc, {
    startY: destY + 8,
    margin: { left: margin, right: margin },
    head: [["Destinataire", "Envois", "Lignes transmises"]],
    body: [
      ["Vers moi (récap artisan)", String(versMoi.envois), String(versMoi.lignes)],
      ["Vers le comptable", String(versComptable.envois), String(versComptable.lignes)],
    ],
    foot: [["Total", String(total), String(versMoi.lignes + versComptable.lignes)]],
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right", cellWidth: 80 },
      2: { halign: "right", cellWidth: 120 },
    },
  });

  const afterRecapDest = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? destY;
  if (afterRecapDest + 40 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Colonne « Vers » : « Moi » = récap de régularité reçu par l'artisan ; « Comptable » = journal mensuel ou récap transmis au comptable.",
      margin,
      afterRecapDest + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Bilan d'archivage généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

function buildEmailHtml(emetteurNom: string, annee: string, total: number, lignes: number): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Bilan d'archivage annuel · exercice ${escapeHtml(annee)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le <strong>bilan d'archivage</strong> de l'exercice <strong>${escapeHtml(annee)}</strong> :
          l'historique complet des envois comptables de l'année (journaux mensuels et récaps de régularité), à conserver.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Envois archivés : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0;color:#71717a;">Lignes transmises (journaux) : <strong style="color:#18181b;">${lignes}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question. Merci de votre confiance.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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

/** Libellé du mois extrait d'un objet d'email (« Journal comptable — Septembre 2026 »). */
function moisFromSujet(sujet: string | null): string | null {
  if (!sujet) return null;
  const m = /—\s*(.+)$/.exec(sujet);
  return m ? m[1].trim() : null;
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
    const simulerEchecBrevo = body?.simulerEchecBrevo === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    // Adresse ponctuelle : ajouter une copie du bilan à un destinataire de passage
    // (ex. expert-comptable remplaçant), sans toucher à l'email mémorisé dans le profil.
    const overrideTo = typeof body?.overrideTo === "string" ? String(body.overrideTo).trim() : "";
    // Libellé associé à l'adresse ponctuelle (« Cabinet externe »), pour tracer le remplacement.
    const overrideNom = typeof body?.overrideNom === "string" ? String(body.overrideNom).trim() : "";

    const { day: todayDay, year, month } = parisParts();
    // Exercice clôturé : l'année qui vient de s'achever si l'on est en janvier, sinon l'année en cours.
    const anneeCible = month <= 1 ? year - 1 : year;
    // Un renvoi manuel peut cibler un exercice précis (body.annee = « AAAA »).
    const anneeForcee =
      typeof body?.annee === "string" && /^\d{4}$/.test(body.annee) ? Number(body.annee) : null;
    const anneeNum = anneeForcee ?? anneeCible;
    const anneeStr = String(anneeNum);
    const rangeStart = new Date(anneeNum, 0, 1).toISOString();
    const rangeEnd = new Date(anneeNum + 1, 0, 1).toISOString();
    const canSend = Boolean((Deno.env.get("BREVO_API_KEY") ?? "").trim() || (resendKey && fromDomain));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, siret, tva, comptable_email, comptable_bilan_auto_actif, comptable_bilan_jour, comptable_bilan_dernier_annee, comptable_bilan_copie_artisan",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; lignes?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const comptableEmail = String(p.comptable_email ?? "").trim();
      const actif = p.comptable_bilan_auto_actif === true || force;
      const jourChoisi =
        Number.isFinite(Number(p.comptable_bilan_jour)) && Number(p.comptable_bilan_jour) > 0
          ? Number(p.comptable_bilan_jour)
          : 5;
      const dejaEnvoye = String(p.comptable_bilan_dernier_annee ?? "") === anneeStr;

      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Bilan d'archivage inactif." });
        continue;
      }
      if (!comptableEmail) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (dejaEnvoye && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Bilan déjà envoyé pour cet exercice." });
        continue;
      }
      // Passage planifié : uniquement en janvier, le jour choisi. Un test forcé ignore la fenêtre.
      if (!scopeUserId && !ignoreTime) {
        if (month !== 1) {
          details.push({ userId, sent: false, reason: "Hors fenêtre (janvier)." });
          continue;
        }
        if (jourChoisi !== todayDay) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }

      const { data: rows } = await admin
        .from("envois_email")
        .select("destinataire, sujet, created_at, mois_cle, mode, nb_lignes, type")
        .eq("user_id", userId)
        .in("type", ["comptable", "comptable_recap"])
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: true });

      const artisanEmail = String(p.email ?? "").trim();
      const historique: HistoriqueLigne[] = ((rows ?? []) as Array<Record<string, unknown>>).map((row) => {
        const type = String(row.type ?? "");
        const recap = type === "comptable_recap";
        const destinataire = row.destinataire == null ? "" : String(row.destinataire);
        const versMoi =
          recap &&
          Boolean(artisanEmail) &&
          destinataire.trim().toLowerCase() === artisanEmail.toLowerCase();
        return {
          mois: recap
            ? "Récap de régularité"
            : moisFromSujet(row.sujet == null ? null : String(row.sujet)) ||
              (row.mois_cle ? String(row.mois_cle) : "Journal comptable"),
          date: row.created_at ? dateHeureLabel(String(row.created_at)) : "",
          mode: String(row.mode ?? "").toLowerCase() === "automatique" ? "Automatique" : "Manuel",
          lignes: row.nb_lignes == null ? "" : String(row.nb_lignes),
          destinataire,
          type: recap ? "Récap régularité" : "Journal comptable",
          vers: recap ? (versMoi ? "Moi" : "Comptable") : "Comptable",
        };
      });

      if (historique.length === 0 && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun envoi sur l'exercice.", lignes: 0 });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun service d'envoi configuré." });
        continue;
      }

      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      // Destinataires : le comptable ; une copie à une adresse ponctuelle (ex. expert-comptable
      // remplaçant) si fournie ; et — si l'option est activée — une copie à l'artisan lui-même.
      // On dédoublonne systématiquement les adresses (casse ignorée).
      const copieArtisan = p.comptable_bilan_copie_artisan === true;
      const destinataires: string[] = [];
      const pushDest = (addr: string) => {
        const a = addr.trim();
        if (!a) return;
        if (!destinataires.some((d) => d.toLowerCase() === a.toLowerCase())) destinataires.push(a);
      };
      pushDest(comptableEmail);
      pushDest(overrideTo);
      if (copieArtisan) pushDest(artisanEmail);
      const pdf = buildHistoriquePdf({
        emetteur: {
          entreprise: emetteurNom,
          metier: p.metier ? String(p.metier) : null,
          telephone: p.telephone ? String(p.telephone) : null,
          email: p.email ? String(p.email) : null,
          siret: p.siret ? String(p.siret) : null,
          tva: p.tva ? String(p.tva) : null,
        },
        filtreLabel: `Exercice ${anneeStr}`,
        lignes: historique,
      });
      const pdfBase64 = toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer));
      const filename = `bilan-archivage-envois-comptable-${anneeStr}.pdf`;
      const nbLignes = historique.reduce((s, l) => {
        const n = Number(l.lignes);
        return s + (Number.isFinite(n) && l.type === "Journal comptable" ? n : 0);
      }, 0);
      const subject = `Bilan d'archivage annuel — exercice ${anneeStr}`;

      try {
        const envoi = await envoyerEmailAvecRepli(
          "envoi-bilan-annuel",
          {
            nom: emetteurNom,
            to: destinataires,
            subject,
            html: buildEmailHtml(emetteurNom, anneeStr, historique.length, nbLignes),
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
        // Le repère anti-doublon n'est posé que par un passage planifié : un test forcé
        // ne doit pas marquer l'exercice comme archivé.
        if (!force) {
          await admin
            .from("profiles")
            .update({ comptable_bilan_dernier_annee: anneeStr, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        // Trace de l'envoi : type dédié, ignoré par l'historique des envois comptables.
        // On historise le(s) destinataire(s) RÉELLEMENT utilisé(s) (comptable + adresse
        // ponctuelle de remplacement + copie artisan le cas échéant), pour tracer les envois
        // de remplacement et non plus le seul comptable.
        await admin.from("envois_email").insert({
          user_id: userId,
          facture_id: null,
          devis_id: null,
          relance_id: null,
          type: "comptable_bilan",
          canal: "email",
          groupe: false,
          destinataire: destinataires.join(", "),
          sujet: subject,
          mois_cle: anneeStr,
          mode: force ? "manuel" : "automatique",
          nb_lignes: historique.length,
          pieces: "Bilan d'archivage (PDF)",
        });
        sent += 1;
        details.push({ userId, sent: true, lignes: historique.length });

        // Remplacement : le bilan a été renvoyé à une adresse ponctuelle (ex. cabinet externe).
        // On le journalise pour la vue « Remplacements » de l'Espace comptable.
        if (overrideTo) {
          await admin.from("comptable_remplacements").insert({
            user_id: userId,
            adresse: overrideTo,
            nom: overrideNom || null,
            exercice: anneeStr,
            type: "bilan",
          });
        }
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
