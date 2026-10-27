import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Cast : le typage Deno du module expose un objet, mais l'export est bien la fonction d'application.
const autoTable = autoTableImport as unknown as (
  doc: unknown,
  options: Record<string, unknown>,
) => void;

// Fonction de relance des factures en retard.
// Elle est appelée par le bouton « Relancer les factures en retard » du tableau
// de bord, avec l'identifiant de l'artisan courant. Pour chaque facture non payée
// dont l'échéance est dépassée, elle envoie un email de rappel au client.
//
// Un filtre « ancienneté de retard » permet de ne cibler que les impayés les plus
// critiques (ex. +30 jours). Le mode « preview » renvoie le HTML exact de l'email
// sans rien expédier, pour l'aperçu visuel avant relance en masse. Le mode « list »
// renvoie la liste précise des clients/factures ciblés, pour vérifier avant envoi.
//
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN
// dans les secrets du Backend. Sans Resend, la fonction renvoie un résumé honnête
// (examined / sent = 0 / reason) sans rien expédier.
// Chaque envoi réussi est tracé dans relance_facture_envois (historique des relances).

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
 * logo (optionnel) et message de pied de page. Reprise dans les relances automatiques
 * pour une identité cohérente avec les PDF et les devis.
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

/** Montant en euros (ex. « 1 250,00 € »). */
function frEuro(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Formate une date en « 07 octobre 2026 ». */
function frDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Nombre de jours entiers de retard depuis l'échéance (0 si non dépassée). */
function joursDepuis(value: unknown): number {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/** Date du jour (ISO, YYYY-MM-DD). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Une facture est « en retard » si elle est émise (non payée) et son échéance est dépassée. */
function isFactureEnRetard(statut: unknown): boolean {
  const v = String(statut ?? "").trim().toLowerCase();
  if (v.includes("pay") || v.includes("régl") || v.includes("regl")) return false;
  if (v.includes("brouillon") || v.includes("annul") || v.includes("avoir")) return false;
  return true;
}

/** Applique un modèle de sujet contenant des variables type {{client}}. */
function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

/** Construit l'email de rappel envoyé au client pour une facture en retard. */
function buildReminderHtml(
  emetteurNom: string,
  contactLine: string,
  clientNom: string,
  numero: string,
  montant: string,
  echeance: string,
  jours: number,
  introHtml: string,
  identite: DocIdentite,
): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${identite.accent};"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        ${identite.logoHtml}
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">
          Rappel de paiement
        </div>
        <p style="margin:16px 0 12px;font-size:15px;">Bonjour ${escapeHtml(clientNom || "")},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${introHtml}</p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Facture : <strong style="color:#18181b;">${escapeHtml(numero)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Montant total TTC : <strong style="color:#18181b;">${escapeHtml(montant)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Échéance : <strong style="color:#18181b;">${escapeHtml(echeance)}</strong></p>
          <p style="margin:0;color:#b45309;">Retard : <strong>${jours} jour${jours > 1 ? "s" : ""}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce message. Nous restons à votre disposition pour toute question.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Rappel envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.</p>
        ${identite.piedHtml}
      </div>
    </div>
  </div>
</body></html>`;
}

/** Construit l'objet + le HTML de rappel pour une facture, à partir des réglages du profil. */
function buildFactureReminder(params: {
  emetteurNom: string;
  contactLine: string;
  sujetModele: string;
  clientNom: string;
  numero: string;
  montant: string;
  echeance: string;
  jours: number;
  identite: DocIdentite;
}): { subject: string; html: string } {
  const templateValues: Record<string, string> = {
    client: params.clientNom,
    entreprise: params.emetteurNom,
    numero: params.numero,
    montant: params.montant,
    echeance: params.echeance,
  };
  const subject = params.sujetModele
    ? applyTemplate(params.sujetModele, templateValues)
    : `Rappel : facture ${params.numero} en attente de règlement`;
  const introHtml = `Nous vous rappelons que la facture <strong>${escapeHtml(
    params.numero,
  )}</strong> d'un montant de <strong>${escapeHtml(params.montant)}</strong> reste en attente de règlement (échéance du ${escapeHtml(
    params.echeance,
  )}).`;
  const html = buildReminderHtml(
    params.emetteurNom,
    params.contactLine,
    params.clientNom,
    params.numero,
    params.montant,
    params.echeance,
    params.jours,
    introHtml,
    params.identite,
  );
  return { subject, html };
}

/** Encode un tableau d'octets en base64 (pour la pièce jointe Resend). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Construit le PDF de la balance âgée d'un client : ses factures impayées réparties par
 * ancienneté (0-30 j / 30-60 j / +60 j), avec le total dû et le détail ligne par ligne.
 */
function buildClientBalancePdf(params: {
  emetteurNom: string;
  contactLine: string;
  clientNom: string;
  lignes: Array<{ numero: string; echeance: string | null; montant: number; jours: number }>;
  accent: string;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const INK: [number, number, number] = [32, 30, 27];
  const MUTED: [number, number, number] = [124, 117, 111];
  const LINE: [number, number, number] = [232, 228, 222];
  const SOFT_BG: [number, number, number] = [247, 245, 241];

  const accentMatch = /^#?([0-9a-f]{6})$/i.exec(String(params.accent ?? "").trim());
  const accentRgb: [number, number, number] = accentMatch
    ? [(Number.parseInt(accentMatch[1], 16) >> 16) & 255, (Number.parseInt(accentMatch[1], 16) >> 8) & 255, Number.parseInt(accentMatch[1], 16) & 255]
    : [196, 120, 58];

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("BALANCE ÂGÉE", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Vos factures impayées réparties par ancienneté", margin, 71);
  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(`Client : ${params.clientNom}`, pageW - margin, 71, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(params.emetteurNom, margin, 100);
  if (params.contactLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(params.contactLine.replace(/<[^>]+>/g, ""), margin, 115);
  }

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 132, pageW - margin, 132);

  const sum = (arr: Array<{ montant: number }>): number => arr.reduce((s, l) => s + l.montant, 0);
  const b0 = params.lignes.filter((l) => l.jours <= 30);
  const b30 = params.lignes.filter((l) => l.jours > 30 && l.jours <= 60);
  const b60 = params.lignes.filter((l) => l.jours > 60);
  const total = sum(params.lignes);

  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, 152, pageW - margin * 2, 48, 6, 6, "F");
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(margin, 152, 4, 48, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("TOTAL DÛ (TTC)", margin + 14, 170);
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(frEuro(total), margin + 14, 189);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${params.lignes.length} facture${params.lignes.length > 1 ? "s" : ""}`, pageW - margin - 14, 182, {
    align: "right",
  });

  let y = 152 + 48 + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Répartition par ancienneté", margin, y);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Palier", "Montant TTC", "Nb factures"]],
    body: [
      ["0 à 30 jours", frEuro(sum(b0)), String(b0.length)],
      ["30 à 60 jours", frEuro(sum(b30)), String(b30.length)],
      ["Plus de 60 jours", frEuro(sum(b60)), String(b60.length)],
    ],
    foot: [["Total", frEuro(total), String(params.lignes.length)]],
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
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right", cellWidth: 84 } },
  });

  const afterBuckets = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = afterBuckets + 28;
  if (y > pageH - 120) {
    doc.addPage();
    y = margin + 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des factures impayées", margin, y);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["N°", "Échéance", "Ancienneté", "Montant TTC"]],
    body: params.lignes.map((l) => [l.numero, frDate(l.echeance), `${l.jours} j`, frEuro(l.montant)]),
    styles: {
      font: "helvetica",
      fontSize: 8.8,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: { 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90 } },
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
    doc.text("Balance âgée générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

/** Email de rappel groupé par client, avec sa balance âgée en pièce jointe. */
function buildClientGroupedReminderHtml(
  emetteurNom: string,
  contactLine: string,
  clientNom: string,
  nbFactures: number,
  total: string,
  identite: DocIdentite,
): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${identite.accent};"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        ${identite.logoHtml}
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">
          Rappel de paiement
        </div>
        <p style="margin:16px 0 12px;font-size:15px;">Bonjour ${escapeHtml(clientNom || "")},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Sauf erreur de notre part, ${nbFactures} de vos factures restent en attente de r\u00e8glement, pour un total de <strong>${escapeHtml(
            total,
          )}</strong>. Vous trouverez en pi\u00e8ce jointe le d\u00e9tail de vos impay\u00e9s, r\u00e9parti par anciennet\u00e9.
        </p>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Si le r\u00e8glement a d\u00e9j\u00e0 \u00e9t\u00e9 effectu\u00e9, merci de ne pas tenir compte de ce message. Nous restons \u00e0 votre disposition pour toute question.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Rappel envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.</p>
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
    if (!scopeUserId) return json({ ok: false, error: "Artisan introuvable." }, 400);

    // Filtre « ancienneté de retard » : ne cibler que les impayés dépassés d'au moins N jours.
    const minJoursRetard = Math.max(0, Math.floor(Number(body?.minJoursRetard ?? 0) || 0));
    // Mode aperçu : renvoie l'email sans rien expédier.
    const preview = body?.preview === true;
    // Mode liste : renvoie la liste précise des cibles, sans rien expédier.
    const list = body?.list === true;
    // Mode « balance âgée » : un seul email par client, avec le PDF de SA balance âgée.
    const agedBalance = body?.agedBalance === true;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, telephone, email, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page, email_sujet_relance, relance_facture_delai_min")
      .eq("id", scopeUserId)
      .maybeSingle();
    const p = (profile ?? {}) as Record<string, unknown>;
    const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
    const contactLine = [p.telephone, p.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");
    const sujetModele = String(p.email_sujet_relance ?? "").trim();

    // Anti-doublon : délai minimum (jours) entre deux rappels d'une même facture.
    // Priorité au paramètre reçu du front, sinon au réglage enregistré dans le profil (défaut 14 j).
    const delaiProfil = Number.isFinite(Number(p.relance_facture_delai_min))
      ? Number(p.relance_facture_delai_min)
      : 14;
    const delaiMin =
      body?.delaiMin !== undefined
        ? Math.max(0, Math.floor(Number(body.delaiMin) || 0))
        : Math.max(0, Math.floor(delaiProfil));

    // Factures non payées dont l'échéance est dépassée.
    const today = todayISO();
    const { data: factures, error: factError } = await admin
      .from("factures")
      .select("id, devis_id, client_id, numero, statut, total_ttc, date_echeance")
      .eq("user_id", scopeUserId)
      .lt("date_echeance", today);
    if (factError) return json({ ok: false, error: factError.message }, 500);

    let enRetard = ((factures ?? []).filter((f) =>
      isFactureEnRetard((f as Record<string, unknown>).statut),
    ) as Array<Record<string, unknown>>).filter((f) => joursDepuis(f.date_echeance) >= minJoursRetard);

    // Anti-doublon : on écarte les factures déjà relancées il y a moins de `delaiMin` jours.
    if (delaiMin > 0 && enRetard.length > 0) {
      const ids = enRetard.map((f) => Number(f.id)).filter((v) => Number.isFinite(v));
      const lastByFacture = new Map<number, number>();
      if (ids.length > 0) {
        const { data: relRows } = await admin
          .from("relance_facture_envois")
          .select("facture_id, envoye_le")
          .eq("user_id", scopeUserId)
          .in("facture_id", ids);
        (relRows ?? []).forEach((row) => {
          const r = row as Record<string, unknown>;
          const fid = Number(r.facture_id);
          const t = new Date(String(r.envoye_le ?? "")).getTime();
          if (Number.isFinite(fid) && Number.isFinite(t)) {
            const prev = lastByFacture.get(fid);
            if (prev === undefined || t > prev) lastByFacture.set(fid, t);
          }
        });
      }
      enRetard = enRetard.filter((f) => {
        const last = lastByFacture.get(Number(f.id));
        return last === undefined || Date.now() - last >= delaiMin * 86400000;
      });
    }

    const examined = enRetard.length;

    // Coordonnées clients des factures ciblées (pour la liste de vérification).
    const clientIds = [
      ...new Set(
        enRetard
          .map((f) => (f.client_id != null ? Number(f.client_id) : null))
          .filter((v): v is number => v !== null && Number.isFinite(v)),
      ),
    ];
    const clientsById = new Map<number, { nom: string; email: string }>();
    if (clientIds.length > 0) {
      const { data: clientsData } = await admin.from("clients").select("id, nom, email").in("id", clientIds);
      (clientsData ?? []).forEach((c) => {
        const row = c as Record<string, unknown>;
        clientsById.set(Number(row.id), {
          nom: String(row.nom ?? ""),
          email: String(row.email ?? "").trim(),
        });
      });
    }
    const clientOf = (id: unknown) =>
      id != null && Number.isFinite(Number(id)) ? clientsById.get(Number(id)) ?? null : null;

    // Mode « Vérifier avant envoi » : liste précise des clients et factures ciblés.
    if (list) {
      const targets = enRetard.map((f) => {
        const c = clientOf(f.client_id);
        return {
          factureId: Number(f.id),
          numero: String(f.numero ?? ""),
          clientNom: c?.nom || "Client",
          email: c?.email ?? "",
          montant: Number(f.total_ttc ?? 0),
          echeance: f.date_echeance ? String(f.date_echeance) : null,
          jours: joursDepuis(f.date_echeance),
          palier: minJoursRetard,
        };
      });
      return json({
        ok: true,
        list: true,
        configured: Boolean(resendKey && fromDomain),
        minJoursRetard,
        examined,
        targets,
      });
    }

    // Mode aperçu : construit l'email pour une facture représentative, sans rien envoyer.
    if (preview) {
      const sample = enRetard[0] ?? null;
      let clientNom = "Client";
      let numero = "FAC-" + new Date().getFullYear() + "-0001";
      let montant = frEuro(1240);
      let echeance = frDate(new Date(Date.now() - 45 * 86400000).toISOString());
      let jours = 45;
      if (sample) {
        const clientId = sample.client_id != null ? Number(sample.client_id) : null;
        const { data: clientData } = clientId
          ? await admin.from("clients").select("nom").eq("id", clientId).maybeSingle()
          : { data: null };
        clientNom = String((clientData as { nom?: string } | null)?.nom ?? "Client");
        numero = String(sample.numero ?? numero);
        montant = frEuro(sample.total_ttc);
        echeance = frDate(sample.date_echeance);
        jours = joursDepuis(sample.date_echeance);
      }
      const reminder = buildFactureReminder({
        emetteurNom,
        contactLine,
        sujetModele,
        clientNom,
        numero,
        montant,
        echeance,
        jours,
        identite: docIdentite(p),
      });
      return json({
        ok: true,
        preview: true,
        configured: Boolean(resendKey && fromDomain),
        examined,
        subject: reminder.subject,
        html: reminder.html,
      });
    }

    // Sans Resend configuré : on n'envoie rien et on l'explique honnêtement.
    if (!resendKey || !fromDomain) {
      return json({
        ok: true,
        configured: false,
        examined,
        sent: 0,
        skipped: examined,
        reason: "Resend non configuré (clé API + domaine d'envoi).",
      });
    }

    // Mode « balance âgée » : on regroupe les impayés par client et on envoie UN email par
    // client, avec le PDF de sa propre balance âgée (ses factures impayées par ancienneté).
    if (agedBalance) {
      const byClient = new Map<number, Array<Record<string, unknown>>>();
      for (const f of enRetard) {
        const cid = f.client_id != null ? Number(f.client_id) : null;
        if (cid === null || !Number.isFinite(cid)) continue;
        const arr = byClient.get(cid) ?? [];
        arr.push(f);
        byClient.set(cid, arr);
      }
      let sent = 0;
      let skipped = 0;
      const details: Array<{ factureId: number; numero: string; sent: boolean; reason?: string }> = [];
      for (const [cid, invoices] of byClient.entries()) {
        const c = clientsById.get(cid) ?? null;
        const email = String(c?.email ?? "").trim();
        const clientNom = String(c?.nom ?? "Client");
        if (!email) {
          skipped += invoices.length;
          invoices.forEach((f) =>
            details.push({ factureId: Number(f.id), numero: String(f.numero ?? ""), sent: false, reason: "Client sans email." }),
          );
          continue;
        }
        const lignes = invoices.map((f) => ({
          numero: String(f.numero ?? ""),
          echeance: f.date_echeance ? String(f.date_echeance) : null,
          montant: Number(f.total_ttc ?? 0),
          jours: joursDepuis(f.date_echeance),
        }));
        const totalMontant = lignes.reduce((s, l) => s + l.montant, 0);
        const pdfBytes = buildClientBalancePdf({ emetteurNom, contactLine, clientNom, lignes, accent: docIdentite(p).accent });
        const pdfBase64 = toBase64(pdfBytes);
        const slug = clientNom
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const filename = `balance-agee-${slug || "client"}.pdf`;
        const subject = "Rappel : vos factures en attente de règlement";
        const html = buildClientGroupedReminderHtml(
          emetteurNom,
          contactLine,
          clientNom,
          lignes.length,
          frEuro(totalMontant),
          docIdentite(p),
        );
        try {
          const res = await envoyerEmail("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${emetteurNom} <noreply@${fromDomain}>`,
              to: [email],
              subject,
              html,
              attachments: [{ filename, content: pdfBase64 }],
            }),
          });
          if (!res.ok) {
            skipped += invoices.length;
            invoices.forEach((f) =>
              details.push({ factureId: Number(f.id), numero: String(f.numero ?? ""), sent: false, reason: "Refus de Resend." }),
            );
            continue;
          }
          await admin.from("envois_email").insert({
            user_id: scopeUserId,
            facture_id: null,
            devis_id: null,
            relance_id: null,
            type: "relance",
            canal: "email",
            groupe: true,
            destinataire: email,
            sujet: subject,
          });
          for (const f of invoices) {
            const numero = String(f.numero ?? "");
            await admin.from("relance_facture_envois").insert({
              user_id: scopeUserId,
              facture_id: Number(f.id),
              client_id: f.client_id ?? null,
              client_nom: clientNom,
              numero,
              montant: Number(f.total_ttc ?? 0),
              jours_retard: joursDepuis(f.date_echeance),
              palier: minJoursRetard,
              auto: false,
            });
            details.push({ factureId: Number(f.id), numero, sent: true });
          }
          sent += invoices.length;
        } catch {
          skipped += invoices.length;
          invoices.forEach((f) =>
            details.push({ factureId: Number(f.id), numero: String(f.numero ?? ""), sent: false, reason: "Erreur d'envoi." }),
          );
        }
      }
      return json({ ok: true, configured: true, examined, sent, skipped, details });
    }

    let sent = 0;
    let skipped = 0;
    const details: Array<{ factureId: number; numero: string; sent: boolean; reason?: string }> = [];

    for (const f of enRetard) {
      const factureId = Number(f.id);
      const numero = String(f.numero ?? "");
      const clientId = f.client_id != null ? Number(f.client_id) : null;
      const { data: clientData } = clientId
        ? await admin.from("clients").select("nom, email").eq("id", clientId).maybeSingle()
        : { data: null };
      const client = (clientData ?? null) as { nom?: string; email?: string } | null;
      const email = String(client?.email ?? "").trim();
      if (!email) {
        skipped += 1;
        details.push({ factureId, numero, sent: false, reason: "Client sans email." });
        continue;
      }

      const clientNom = String(client?.nom ?? "");
      const montant = frEuro(f.total_ttc);
      const echeance = frDate(f.date_echeance);
      const jours = joursDepuis(f.date_echeance);
      const { subject, html } = buildFactureReminder({
        emetteurNom,
        contactLine,
        sujetModele,
        clientNom,
        numero,
        montant,
        echeance,
        jours,
        identite: docIdentite(p),
      });

      try {
        const res = await envoyerEmail("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${emetteurNom} <noreply@${fromDomain}>`,
            to: [email],
            subject,
            html,
          }),
        });
        if (!res.ok) {
          skipped += 1;
          details.push({ factureId, numero, sent: false, reason: "Refus de Resend." });
          continue;
        }
        // Trace de l'envoi dans l'historique des envois.
        await admin.from("envois_email").insert({
          user_id: scopeUserId,
          facture_id: factureId,
          devis_id: f.devis_id ?? null,
          relance_id: null,
          type: "relance",
          canal: "email",
          groupe: true,
          destinataire: email,
          sujet: subject,
        });
        // Trace dans l'historique dédié des relances de factures (date, client, montant, palier).
        await admin.from("relance_facture_envois").insert({
          user_id: scopeUserId,
          facture_id: factureId,
          client_id: f.client_id ?? null,
          client_nom: clientNom || "Client",
          numero,
          montant: Number(f.total_ttc ?? 0),
          jours_retard: jours,
          palier: minJoursRetard,
          auto: false,
        });
        sent += 1;
        details.push({ factureId, numero, sent: true });
      } catch {
        skipped += 1;
        details.push({ factureId, numero, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({ ok: true, configured: true, examined, sent, skipped, details });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});