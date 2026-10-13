import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";

// Envoi automatique mensuel du journal comptable au comptable.
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée.
// Chaque passage n'envoie qu'aux artisans dont le jour et l'heure correspondent.
// Le journal porte sur le MOIS ÉCOULÉ. Le PDF complet est transmis en pièce jointe.

// Cast : le typage Deno du module expose un objet, mais l'export est bien la fonction d'application.
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function euros(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function tauxLabel(taux: number): string {
  const s = Number.isInteger(taux) ? String(taux) : taux.toFixed(1).replace(".", ",");
  return `${s} %`;
}

function dateFr(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
}

function isAvoir(numero: string | null | undefined): boolean {
  return (numero ?? "").trim().toUpperCase().startsWith("AV");
}

function tsOf(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function joursDepuis(value: unknown): number {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function isFactureEnRetard(statut: unknown): boolean {
  const v = String(statut ?? "").trim().toLowerCase();
  if (v.includes("pay") || v.includes("régl") || v.includes("regl")) return false;
  if (v.includes("brouillon") || v.includes("annul") || v.includes("avoir")) return false;
  return true;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface JournalLigne {
  date: string;
  type: "Devis" | "Facture" | "Avoir" | "Paiement";
  numero: string;
  client: string;
  objet: string;
  ht: number;
  tva: number;
  ttc: number;
  statut: string;
  ts: number;
}

interface TvaParTaux {
  taux: number;
  baseHT: number;
  tva: number;
  ttc: number;
  nbDocuments: number;
}

interface JournalData {
  lignes: JournalLigne[];
  totaux: {
    nbDevis: number;
    nbFactures: number;
    nbPaiements: number;
    factureHT: number;
    factureTTC: number;
    avoirTTC: number;
    encaisse: number;
    resteAEncaisser: number;
    tvaCollectee: number;
  };
  tva: TvaParTaux[];
}

function buildJournalData(
  devis: Array<Record<string, unknown>>,
  factures: Array<Record<string, unknown>>,
  clientNameById: Map<number, string>,
): JournalData {
  const lignes: JournalLigne[] = [];
  const nameOf = (id: unknown): string => {
    const n = id === null || id === undefined ? null : Number(id);
    return n !== null && Number.isFinite(n) ? clientNameById.get(n) ?? "" : "";
  };

  devis.forEach((d) => {
    const ht = round2(Number(d.total_ht ?? 0));
    const ttc = round2(Number(d.total_ttc ?? 0));
    const date = String(d.created_at ?? "");
    lignes.push({
      date: dateFr(date),
      type: "Devis",
      numero: String(d.numero ?? ""),
      client: nameOf(d.client_id),
      objet: String(d.objet ?? ""),
      ht,
      tva: round2(ttc - ht),
      ttc,
      statut: String(d.statut ?? ""),
      ts: tsOf(date),
    });
  });

  const tvaAcc = new Map<number, { base: number; tva: number; docs: number }>();
  const pushTva = (taux: number, base: number, tva: number) => {
    const rate = Number.isFinite(Number(taux)) ? Number(taux) : 20;
    const cur = tvaAcc.get(rate) ?? { base: 0, tva: 0, docs: 0 };
    cur.base += base;
    cur.tva += tva;
    tvaAcc.set(rate, cur);
  };

  factures.forEach((f) => {
    const ht = round2(Number(f.total_ht ?? 0));
    const ttc = round2(Number(f.total_ttc ?? 0));
    const numero = String(f.numero ?? "");
    const dateRef = String(f.date_emission ?? f.created_at ?? "");
    const avoir = isAvoir(numero);
    lignes.push({
      date: dateFr(dateRef),
      type: avoir ? "Avoir" : "Facture",
      numero,
      client: nameOf(f.client_id),
      objet: "",
      ht,
      tva: round2(ttc - ht),
      ttc,
      statut: String(f.statut ?? ""),
      ts: tsOf(dateRef),
    });

    if (!avoir) {
      const rates = new Set<number>();
      const rawLignes = Array.isArray(f.lignes) ? (f.lignes as Array<Record<string, unknown>>) : [];
      if (rawLignes.length > 0) {
        rawLignes.forEach((l) => {
          const base = round2((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0));
          const rate = Number.isFinite(Number(l.taux_tva)) ? Number(l.taux_tva) : 20;
          pushTva(rate, base, round2((base * rate) / 100));
          rates.add(rate);
        });
      } else {
        const tva = round2(ttc - ht);
        const rate = ht > 0 && tva > 0 ? round2((tva / ht) * 100) : 20;
        pushTva(rate, ht, tva);
        rates.add(rate);
      }
      rates.forEach((rate) => {
        const cur = tvaAcc.get(rate);
        if (cur) cur.docs += 1;
      });
    }

    if (String(f.statut ?? "") === "Payée") {
      const dateReglement = String(f.date_paiement ?? dateRef);
      lignes.push({
        date: dateFr(dateReglement),
        type: "Paiement",
        numero,
        client: nameOf(f.client_id),
        objet: `Règlement de la facture ${numero}`,
        ht: 0,
        tva: 0,
        ttc,
        statut: "Encaissé",
        ts: tsOf(dateReglement),
      });
    }
  });

  lignes.sort((a, b) => a.ts - b.ts || a.numero.localeCompare(b.numero, "fr"));

  const reelles = factures.filter((f) => !isAvoir(String(f.numero ?? "")));
  const avoirs = factures.filter((f) => isAvoir(String(f.numero ?? "")));
  const factureHT = round2(reelles.reduce((s, f) => s + Number(f.total_ht ?? 0), 0));
  const factureTTC = round2(reelles.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0));
  const avoirTTC = round2(avoirs.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0));
  const paiements = factures.filter((f) => String(f.statut ?? "") === "Payée");
  const encaisse = round2(paiements.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0));

  const tva = [...tvaAcc.entries()]
    .map(([taux, v]) => ({
      taux,
      baseHT: round2(v.base),
      tva: round2(v.tva),
      ttc: round2(v.base + v.tva),
      nbDocuments: v.docs,
    }))
    .sort((a, b) => b.taux - a.taux);

  return {
    lignes,
    totaux: {
      nbDevis: devis.length,
      nbFactures: factures.length,
      nbPaiements: paiements.length,
      factureHT,
      factureTTC,
      avoirTTC,
      encaisse,
      resteAEncaisser: round2(factureTTC - encaisse),
      tvaCollectee: round2(factureTTC - factureHT),
    },
    tva,
  };
}

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];

function buildJournalPdf(params: {
  emetteur: { entreprise: string; metier?: string | null; telephone?: string | null; email?: string | null; siret?: string | null; tva?: string | null };
  filtreLabel: string;
  data: JournalData;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("JOURNAL COMPTABLE", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Devis, factures et paiements consolidés", margin, 71);

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

  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "FACTURÉ HT", value: euros(params.data.totaux.factureHT) },
    { label: "TVA COLLECTÉE", value: euros(params.data.totaux.tvaCollectee) },
    { label: "ENCAISSÉ TTC", value: euros(params.data.totaux.encaisse) },
    { label: "RESTE À ENCAISSER", value: euros(params.data.totaux.resteAEncaisser) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 13, boxTop + 17);
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 13, boxTop + 35);
  });

  let y = boxTop + boxH + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Journal de la période", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${params.data.lignes.length} ligne${params.data.lignes.length > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Date", "Type", "N°", "Client", "HT", "TVA", "TTC", "Statut"]],
    body: params.data.lignes.length
      ? params.data.lignes.map((l) => [
          l.date || "—",
          l.type,
          l.numero,
          l.client || "Sans client",
          euros(l.ht),
          euros(l.tva),
          euros(l.ttc),
          l.statut,
        ])
      : [["Aucun mouvement sur la période", "", "", "", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 4.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 50 },
      2: { cellWidth: 66 },
      4: { halign: "right", cellWidth: 58 },
      5: { halign: "right", cellWidth: 48 },
      6: { halign: "right", cellWidth: 62 },
      7: { cellWidth: 58 },
    },
  });

  let afterJournal =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  if (afterJournal > pageH - 170) {
    doc.addPage();
    afterJournal = margin + 10;
  }
  y = afterJournal + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("TVA collectée par taux", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${params.data.tva.length} taux`, pageW - margin, y, { align: "right" });

  const totalBase = params.data.tva.reduce((s, t) => s + t.baseHT, 0);
  const totalTtc = params.data.tva.reduce((s, t) => s + t.ttc, 0);
  const totalDocs = params.data.tva.reduce((s, t) => s + t.nbDocuments, 0);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Taux", "Base taxable HT", "TVA collectée", "Total TTC", "Nb factures"]],
    body: params.data.tva.length
      ? params.data.tva.map((t) => [tauxLabel(t.taux), euros(t.baseHT), euros(t.tva), euros(t.ttc), String(t.nbDocuments)])
      : [["Aucune base taxable sur la période", "", "", "", ""]],
    foot: params.data.tva.length
      ? [["Total", euros(totalBase), euros(params.data.totaux.tvaCollectee), euros(totalTtc), String(totalDocs)]]
      : undefined,
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
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", cellWidth: 74 },
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
    doc.text("Journal comptable généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

function buildEmailHtml(
  emetteurNom: string,
  periodeLabel: string,
  data: JournalData,
  balance: { b0: number; b30: number; b60: number },
): string {
  const tvaRows = data.tva.length
    ? data.tva
        .map(
          (t) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(tauxLabel(t.taux))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;text-align:right;">${escapeHtml(euros(t.baseHT))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;text-align:right;">${escapeHtml(euros(t.tva))}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:8px 10px;font-size:13px;color:#71717a;">Aucune base taxable sur la période.</td></tr>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Journal comptable automatique · ${escapeHtml(periodeLabel)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le journal comptable consolidé du <strong>${escapeHtml(periodeLabel)}</strong> :
          devis, factures, avoirs et paiements réunis dans un seul document, avec la TVA collectée par taux.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Facturé HT : <strong style="color:#18181b;">${escapeHtml(euros(data.totaux.factureHT))}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">TVA collectée : <strong style="color:#18181b;">${escapeHtml(euros(data.totaux.tvaCollectee))}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Facturé TTC : <strong style="color:#18181b;">${escapeHtml(euros(data.totaux.factureTTC))}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Encaissé TTC : <strong style="color:#18181b;">${escapeHtml(euros(data.totaux.encaisse))}</strong></p>
          <p style="margin:0;color:#b45309;">Reste à encaisser : <strong>${escapeHtml(euros(data.totaux.resteAEncaisser))}</strong></p>
        </div>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#18181b;">TVA collectée par taux</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Taux</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Base HT</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">TVA</th>
          </tr></thead>
          <tbody>${tvaRows}</tbody>
        </table>
        <p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Balance âgée des créances</p>
        <p style="margin:0 0 8px;font-size:12px;color:#71717a;">Montants TTC impayés par ancienneté, à la date d'envoi.</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">0-30 j</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">30-60 j</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">+60 j</th>
          </tr></thead>
          <tbody><tr>
            <td style="padding:8px 10px;font-size:13px;color:#18181b;">${escapeHtml(euros(balance.b0))}</td>
            <td style="padding:8px 10px;font-size:13px;color:#18181b;">${escapeHtml(euros(balance.b30))}</td>
            <td style="padding:8px 10px;font-size:13px;color:#b91c1c;font-weight:600;">${escapeHtml(euros(balance.b60))}</td>
          </tr></tbody>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">Pièce jointe complète : journal comptable (devis, factures, paiements) + TVA par taux.</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/* ----------------- Récap de régularité (graphe + CSV) ------------------- */

interface RecapMois {
  cle: string;
  auto: number;
  manuel: number;
  total: number;
}

/** Clé « AAAA-MM » à partir d'une date ISO, ou null. */
function moisCleFromISO(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé court d'un mois (« sept. 25 »). */
function moisLabelCourt(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

/** Libellé long d'un mois (« Septembre 2026 »). */
function moisLabelLong(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  const s = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Agrège les envois (lignes `envois_email` de type comptable) en compteurs auto/manuel
 * par mois, en comblant les mois vides, puis ne garde que les N derniers mois demandés.
 */
function buildRecapMois(rows: Array<Record<string, unknown>>, periode: number): RecapMois[] {
  const map = new Map<string, { auto: number; manuel: number }>();
  rows.forEach((r) => {
    const cle = moisCleFromISO(String(r.created_at ?? r.envoye_le ?? ""));
    if (!cle) return;
    const b = map.get(cle) ?? { auto: 0, manuel: 0 };
    if (String(r.mode ?? "").toLowerCase() === "automatique") b.auto += 1;
    else b.manuel += 1;
    map.set(cle, b);
  });
  const cles = Array.from(map.keys()).sort();
  if (!cles.length) return [];
  const [fy, fm] = cles[0].split("-").map(Number);
  const [ly, lm] = cles[cles.length - 1].split("-").map(Number);
  const out: RecapMois[] = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    const cle = `${y}-${String(m).padStart(2, "0")}`;
    const b = map.get(cle) ?? { auto: 0, manuel: 0 };
    out.push({ cle, auto: b.auto, manuel: b.manuel, total: b.auto + b.manuel });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.slice(-Math.max(1, periode));
}

/** CSV de la régularité des envois (une ligne par mois), avec BOM pour Excel. */
function recapCsv(mois: RecapMois[]): string {
  const lignes = ["Mois;Automatique;Manuel;Total"];
  mois.forEach((m) => lignes.push(`${m.cle};${m.auto};${m.manuel};${m.total}`));
  return `\uFEFF${lignes.join("\n")}`;
}

/** Graphe de régularité en barres horizontales, robuste dans les clients email. */
function recapChartHtml(mois: RecapMois[]): string {
  const max = Math.max(...mois.map((m) => m.total), 1);
  return `
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${mois
          .map((m) => {
            const w = Math.round((m.total / max) * 100);
            const autoPct = m.total ? (m.auto / m.total) * 100 : 0;
            return `<tr>
              <td style="padding:3px 8px 3px 0;font-size:11px;color:#71717a;white-space:nowrap;">${escapeHtml(moisLabelCourt(m.cle))}</td>
              <td style="padding:3px 0;width:100%;">
                <div style="height:12px;background:#f0f0f0;border-radius:6px;overflow:hidden;width:100%;">
                  <div style="height:12px;width:${w}%;display:flex;">
                    <div style="height:12px;width:${autoPct}%;background:#b45309;"></div>
                    <div style="height:12px;width:${100 - autoPct}%;background:#a3a3a3;"></div>
                  </div>
                </div>
              </td>
              <td style="padding:3px 0 3px 8px;font-size:11px;color:#18181b;white-space:nowrap;">${m.auto} auto · ${m.manuel} man.</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

/**
 * Base publique de l'application, pour construire un lien direct vers l'Espace
 * comptable dans les emails. On privilégie l'URL mémorisée dans le profil ; à défaut,
 * on retombe sur l'en-tête Origin/Referer (présent lors d'un envoi depuis le site).
 */
function resolveAppUrl(profileValue: unknown, req: Request): string {
  const fromProfile = typeof profileValue === "string" ? profileValue.trim() : "";
  if (fromProfile) return fromProfile.replace(/\/+$/, "");
  const origin = (req.headers.get("origin") || "").trim();
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "");
  const referer = (req.headers.get("referer") || "").trim();
  if (/^https?:\/\//i.test(referer)) {
    try {
      return new URL(referer).origin.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  return "";
}

/** Libellé lisible des pièces jointes du récap, selon le format choisi. */
function recapPiecesLabel(format: string): string {
  if (format === "csv") return "CSV joint";
  if (format === "image") return "Graphe dans l'email";
  return "Graphe + CSV joint";
}

/**
 * Corps HTML de l'email de récapitulatif de régularité.
 * `audience` distingue l'email du comptable de l'email DÉDIÉ à l'artisan : ce dernier
 * n'est adressé qu'à l'artisan (sans le comptable) et s'ouvre sur « voici votre régularité ».
 */
function buildRecapEmailHtml(params: {
  emetteurNom: string;
  periode: number;
  mois: RecapMois[];
  format: string;
  targetLabelCap: string;
  appUrl: string;
  audience?: "comptable" | "artisan";
}): string {
  const { emetteurNom, periode, mois, format, targetLabelCap, appUrl, audience = "comptable" } = params;
  const moisAvecAuto = mois.filter((m) => m.auto > 0).length;
  const taux = mois.length ? Math.round((moisAvecAuto / mois.length) * 100) : 0;
  // Décompte explicite des mois comblés (au moins un envoi automatique) et des mois
  // manquants (aucun envoi automatique) sur la fenêtre du récap, hors mois en cours.
  const maintenant = new Date();
  const cleCourante = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
  const moisCombles = mois.filter((m) => m.auto > 0).length;
  const moisManquants = mois.filter((m) => m.auto === 0 && m.cle < cleCourante).length;
  // Email dédié à l'artisan : sous-titre et introduction distincts (« voici votre régularité »).
  const estArtisan = audience === "artisan";
  const sousTitre = estArtisan
    ? `Votre régularité d'envois comptables · ${periode} mois`
    : `Récap de régularité des envois comptables · ${periode} mois`;
  const introHtml = estArtisan
    ? `Voici votre régularité : le nombre d'envois automatiques et manuels de votre journal comptable, mois par mois, sur les ${periode} derniers mois. C'est le même récapitulatif que celui transmis à votre comptable, à conserver pour anticiper vos échéances.`
    : `En complément du journal comptable de <strong>${escapeHtml(targetLabelCap)}</strong>, voici un récapitulatif de la régularité des envois : le nombre d'envois automatiques et manuels mois par mois, sur les ${periode} derniers mois.`;
  const csvJoint = format === "csv" || format === "both";
  const link = appUrl ? `${appUrl}/app/comptabilite` : "";
  const bouton = link
    ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#b45309;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Ouvrir l'Espace comptable</a>
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;">
          Un mois semble manquant ? Ouvrez l'Espace comptable : depuis l'alerte de régularité, renvoyez le journal de ce mois en un clic.
        </p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">${escapeHtml(sousTitre)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          ${introHtml}
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 4px;color:#71717a;">Taux de régularité</p>
          <p style="margin:0;font-size:24px;font-weight:800;color:#b45309;">${taux} %</p>
          <p style="margin:4px 0 0;color:#71717a;">${moisAvecAuto} mois avec envoi automatique sur ${mois.length}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;border-top:1px solid #eee;">
            <tbody><tr>
              <td style="padding:10px 0 0;font-size:13px;vertical-align:top;">
                <span style="color:#15803d;font-weight:800;font-size:20px;">${moisCombles}</span>
                <span style="color:#71717a;"> mois comblé${moisCombles > 1 ? "s" : ""}</span>
              </td>
              <td style="padding:10px 0 0;font-size:13px;text-align:right;vertical-align:top;">
                <span style="color:${moisManquants > 0 ? "#b45309" : "#71717a"};font-weight:800;font-size:20px;">${moisManquants}</span>
                <span style="color:#71717a;"> mois manquant${moisManquants > 1 ? "s" : ""}</span>
              </td>
            </tr></tbody>
          </table>
        </div>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#18181b;">Envois par mois</p>
        ${recapChartHtml(mois)}
        <p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;">Barre colorée = envois automatiques · barre grise = envois manuels.</p>
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          ${csvJoint ? "Le détail mois par mois est joint en CSV (lisible dans Excel)." : ""}
        </p>
        ${bouton}
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
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
    const force = body?.force === true;
    const preview = body?.preview === true;
    const ignoreTime = body?.ignoreTime === true;
    // Aperçu (sans aucun envoi) d'un email de régularité : « artisan » (email dédié à
    // l'artisan, texte « voici votre régularité ») ou « comptable ». Renvoie le HTML
    // exact qui serait expédié, pour valider le texte et le graphe avant tout envoi réel.
    const previewRecapAudience =
      body?.previewRecap === "artisan" || body?.previewRecap === "comptable" ? String(body.previewRecap) : "";
    // Un envoi forcé (test immédiat ou renvoi manuel d'un mois passé) est un envoi
    // « manuel » ; un passage planifié sans force est l'envoi « automatique » mensuel.
    const explicitMode = typeof body?.mode === "string" && body.mode ? String(body.mode) : "";
    const runMode = explicitMode || (force ? "manuel" : "automatique");
    // Adresse ponctuelle : renvoyer à un destinataire de passage (ex. expert-comptable
    // remplaçant) sans toucher à l'email mémorisé dans le profil.
    const overrideTo = typeof body?.overrideTo === "string" ? String(body.overrideTo).trim() : "";
    // Libellé associé à l'adresse ponctuelle (« Comptable remplaçant A »), pour tracer le remplacement.
    const overrideNom = typeof body?.overrideNom === "string" ? String(body.overrideNom).trim() : "";

    const { day: todayDay, hour: todayHour, year, month } = parisParts();
    // Mois visé : « mois écoulé » par défaut, ou un mois précis (clé « AAAA-MM »)
    // lorsqu'on renvoie depuis l'historique le journal d'un mois donné.
    const monthKeyParam = typeof body?.monthKey === "string" ? body.monthKey.trim() : "";
    const target = /^\d{4}-\d{2}$/.test(monthKeyParam)
      ? new Date(Number(monthKeyParam.slice(0, 4)), Number(monthKeyParam.slice(5, 7)) - 1, 1)
      : new Date(year, month - 2, 1);
    const targetKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    const targetLabel = target.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const targetLabelCap = targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1);
    const rangeStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const rangeEnd = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    const filtreLabel = `Mois écoulé — ${targetLabelCap}`;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, siret, tva, comptable_email, comptable_auto_actif, comptable_auto_jour, comptable_auto_heure, comptable_auto_dernier_mois, comptable_rapport_auto_actif, comptable_rapport_copie_artisan, comptable_export_periode, comptable_export_format, comptable_app_url",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const canSend = Boolean(resendKey && fromDomain);
    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; lignes?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const comptableEmail = String(p.comptable_email ?? "").trim();
      const recipient = overrideTo || comptableEmail;
      const actif = p.comptable_auto_actif === true || force;
      const jourChoisi =
        Number.isFinite(Number(p.comptable_auto_jour)) && Number(p.comptable_auto_jour) > 0
          ? Number(p.comptable_auto_jour)
          : 1;
      const heureChoisie =
        p.comptable_auto_heure === null || p.comptable_auto_heure === undefined
          ? 8
          : Number(p.comptable_auto_heure);
      const dejaEnvoye = String(p.comptable_auto_dernier_mois ?? "") === targetKey;

      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Envoi automatique inactif." });
        continue;
      }
      if (!recipient) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (dejaEnvoye && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Déjà envoyé ce mois-ci." });
        continue;
      }
      if (!scopeUserId && !ignoreTime && !preview) {
        if (jourChoisi !== todayDay || heureChoisie !== todayHour) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }

      const { data: facturesRaw } = await admin
        .from("factures")
        .select("id, numero, statut, total_ht, total_ttc, date_emission, date_echeance, date_paiement, created_at, client_id, lignes")
        .eq("user_id", userId);
      const { data: devisRaw } = await admin
        .from("devis")
        .select("id, numero, objet, statut, total_ht, total_ttc, created_at, client_id")
        .eq("user_id", userId);

      const inRange = (value: unknown) => {
        const d = new Date(String(value ?? ""));
        return !Number.isNaN(d.getTime()) && d >= rangeStart && d < rangeEnd;
      };

      const factures = ((facturesRaw ?? []) as Array<Record<string, unknown>>).filter((f) =>
        inRange(f.date_emission ?? f.created_at),
      );
      const devis = ((devisRaw ?? []) as Array<Record<string, unknown>>).filter((d) => inRange(d.created_at));

      const clientIds = new Set<number>();
      factures.forEach((f) => {
        if (f.client_id != null) clientIds.add(Number(f.client_id));
      });
      devis.forEach((d) => {
        if (d.client_id != null) clientIds.add(Number(d.client_id));
      });
      const clientNameById = new Map<number, string>();
      if (clientIds.size > 0) {
        const { data: clientsData } = await admin
          .from("clients")
          .select("id, nom")
          .in("id", [...clientIds]);
        (clientsData ?? []).forEach((c) => {
          const row = c as Record<string, unknown>;
          clientNameById.set(Number(row.id), String(row.nom ?? ""));
        });
      }

      const data = buildJournalData(devis, factures, clientNameById);

      // Aperçu du récap de régularité : on assemble le même email que celui réellement
      // expédié (même période, même format, même graphe) et on renvoie le HTML au front,
      // sans rien envoyer ni toucher à l'historique.
      if (previewRecapAudience === "artisan" || previewRecapAudience === "comptable") {
        const emetteurNomPreview = String(p.entreprise ?? p.metier ?? "Votre artisan");
        const recapPeriodePreview = [6, 12, 24].includes(Number(p.comptable_export_periode))
          ? Number(p.comptable_export_periode)
          : 12;
        const recapFormatPreview = ["image", "csv", "both"].includes(String(p.comptable_export_format))
          ? String(p.comptable_export_format)
          : "both";
        const { data: recapRowsPreview } = await admin
          .from("envois_email")
          .select("created_at, mode")
          .eq("user_id", userId)
          .eq("type", "comptable");
        const recapMoisPreview = buildRecapMois(
          (recapRowsPreview ?? []) as Array<Record<string, unknown>>,
          recapPeriodePreview,
        );
        const appUrlPreview = resolveAppUrl(p.comptable_app_url, req);
        const subjectPreview =
          previewRecapAudience === "artisan"
            ? `Votre régularité d'envois comptables — ${recapPeriodePreview} mois`
            : `Régularité des envois comptables — ${recapPeriodePreview} mois`;
        return json({
          ok: true,
          preview: true,
          audience: previewRecapAudience,
          subject: subjectPreview,
          periode: recapPeriodePreview,
          mois: recapMoisPreview.length,
          html: buildRecapEmailHtml({
            emetteurNom: emetteurNomPreview,
            periode: recapPeriodePreview,
            mois: recapMoisPreview,
            format: recapFormatPreview,
            targetLabelCap,
            appUrl: appUrlPreview,
            audience: previewRecapAudience as "artisan" | "comptable",
          }),
        });
      }

      if (data.lignes.length === 0 && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun mouvement sur la période.", lignes: 0 });
        continue;
      }

      const { data: allFactures } = await admin
        .from("factures")
        .select("numero, statut, total_ttc, date_echeance, date_emission, created_at")
        .eq("user_id", userId);
      const balanceAgg = { b0: 0, b30: 0, b60: 0 };
      ((allFactures ?? []) as Array<Record<string, unknown>>).forEach((f) => {
        if (!isFactureEnRetard(f.statut) || isAvoir(String(f.numero ?? ""))) return;
        const ref = f.date_echeance ?? f.date_emission ?? f.created_at;
        const jours = joursDepuis(ref);
        const montant = Number(f.total_ttc ?? 0);
        if (jours <= 30) balanceAgg.b0 += montant;
        else if (jours <= 60) balanceAgg.b30 += montant;
        else balanceAgg.b60 += montant;
      });

      if (preview) {
        details.push({ userId, sent: false, reason: "Aperçu.", lignes: data.lignes.length });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Resend non configuré." });
        continue;
      }

      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      // L'artisan peut recevoir une copie du récap de régularité en plus du comptable
      // (le lien « Ouvrir l'Espace comptable » lui est réellement utile, car le comptable
      // n'y a pas accès). La copie est optionnelle : elle se règle dans la carte d'envoi
      // automatique. On dédoublonne les adresses au cas où elles seraient identiques.
      const artisanEmail = String(p.email ?? "").trim();
      const copieArtisan = p.comptable_rapport_copie_artisan !== false;
      const pdf = buildJournalPdf({
        emetteur: {
          entreprise: emetteurNom,
          metier: p.metier ? String(p.metier) : null,
          telephone: p.telephone ? String(p.telephone) : null,
          email: p.email ? String(p.email) : null,
          siret: p.siret ? String(p.siret) : null,
          tva: p.tva ? String(p.tva) : null,
        },
        filtreLabel,
        data,
      });
      const pdfBase64 = toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer));
      const filename = `journal-comptable-artiflow-${targetKey}.pdf`;
      const html = buildEmailHtml(emetteurNom, targetLabelCap, data, {
        b0: round2(balanceAgg.b0),
        b30: round2(balanceAgg.b30),
        b60: round2(balanceAgg.b60),
      });

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${emetteurNom} <noreply@${fromDomain}>`,
            to: [recipient],
            subject: `Journal comptable — ${targetLabelCap}`,
            html,
            attachments: [{ filename, content: pdfBase64 }],
          }),
        });
        if (!res.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: "Refus de Resend." });
          continue;
        }
        // Le repère du « dernier mois envoyé automatiquement » n'est mis à jour que par
        // un passage planifié : un test ou un renvoi manuel ne doit surtout pas marquer
        // le mois comme envoyé, sinon l'envoi automatique serait court-circuité.
        if (runMode === "automatique" && !force) {
          await admin
            .from("profiles")
            .update({ comptable_auto_dernier_mois: targetKey, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        await admin.from("envois_email").insert({
          user_id: userId,
          facture_id: null,
          devis_id: null,
          relance_id: null,
          type: "comptable",
          canal: "email",
          groupe: false,
          destinataire: recipient,
          sujet: `Journal comptable — ${targetLabelCap}`,
          mois_cle: targetKey,
          mode: runMode,
          nb_lignes: data.lignes.length,
        });
        sent += 1;
        details.push({ userId, sent: true, lignes: data.lignes.length });

        // Remplacement : le journal a été renvoyé à une adresse ponctuelle (ex. comptable
        // remplaçant). On le journalise pour la vue « Remplacements » de l'Espace comptable.
        if (overrideTo) {
          await admin.from("comptable_remplacements").insert({
            user_id: userId,
            adresse: overrideTo,
            nom: overrideNom || null,
            exercice: targetKey,
            type: "journal",
          });
        }

        // En plus du journal mensuel : récap de régularité (graphe + CSV) au comptable.
        // Envoyé au fil du passage automatique, et aussi au « test maintenant » (sans mois
        // ciblé), pour vérifier le rendu. Un renvoi ciblé d'un mois ne le redéclenche pas.
        const rapportAuto = p.comptable_rapport_auto_actif === true;
        const recapPeriode = [6, 12, 24].includes(Number(p.comptable_export_periode))
          ? Number(p.comptable_export_periode)
          : 12;
        const recapFormat = ["image", "csv", "both"].includes(String(p.comptable_export_format))
          ? String(p.comptable_export_format)
          : "both";
        if (rapportAuto && (runMode === "automatique" || (force && !monthKeyParam))) {
          try {
            const { data: recapRows } = await admin
              .from("envois_email")
              .select("created_at, mode")
              .eq("user_id", userId)
              .eq("type", "comptable");
            const recapMois = buildRecapMois((recapRows ?? []) as Array<Record<string, unknown>>, recapPeriode);
            if (recapMois.length) {
              const recapSubject = `Régularité des envois comptables — ${recapPeriode} mois`;
              const recapAttachments =
                recapFormat === "image"
                  ? []
                  : [
                      {
                        filename: `regularite-envois-comptable-${targetKey}.csv`,
                        content: toBase64(new TextEncoder().encode(recapCsv(recapMois))),
                      },
                    ];
              const appUrl = resolveAppUrl(p.comptable_app_url, req);

              // 1) Email du récap au comptable (destinataire habituel), sans l'artisan.
              const recapRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: `${emetteurNom} <noreply@${fromDomain}>`,
                  to: [recipient],
                  subject: recapSubject,
                  html: buildRecapEmailHtml({
                    emetteurNom,
                    periode: recapPeriode,
                    mois: recapMois,
                    format: recapFormat,
                    targetLabelCap,
                    appUrl,
                    audience: "comptable",
                  }),
                  ...(recapAttachments.length ? { attachments: recapAttachments } : {}),
                }),
              });
              if (recapRes.ok) {
                await admin.from("envois_email").insert({
                  user_id: userId,
                  facture_id: null,
                  devis_id: null,
                  relance_id: null,
                  type: "comptable_recap",
                  canal: "email",
                  groupe: false,
                  destinataire: recipient,
                  sujet: recapSubject,
                  mois_cle: targetKey,
                  mode: runMode,
                  nb_lignes: recapMois.length,
                  pieces: recapPiecesLabel(recapFormat),
                });
              }

              // 2) Email DÉDIÉ à l'artisan : uniquement lui, texte « voici votre régularité ».
              //    Il ne part que si la copie est activée et si son adresse diffère de
              //    celle du comptable (sinon l'email ci-dessus lui suffit déjà).
              if (copieArtisan && artisanEmail && artisanEmail !== recipient) {
                const artisanSubject = `Votre régularité d'envois comptables — ${recapPeriode} mois`;
                const artisanRes = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: `${emetteurNom} <noreply@${fromDomain}>`,
                    to: [artisanEmail],
                    subject: artisanSubject,
                    html: buildRecapEmailHtml({
                      emetteurNom,
                      periode: recapPeriode,
                      mois: recapMois,
                      format: recapFormat,
                      targetLabelCap,
                      appUrl,
                      audience: "artisan",
                    }),
                    ...(recapAttachments.length ? { attachments: recapAttachments } : {}),
                  }),
                });
                if (artisanRes.ok) {
                  await admin.from("envois_email").insert({
                    user_id: userId,
                    facture_id: null,
                    devis_id: null,
                    relance_id: null,
                    type: "comptable_recap",
                    canal: "email",
                    groupe: false,
                    destinataire: artisanEmail,
                    sujet: artisanSubject,
                    mois_cle: targetKey,
                    mode: runMode,
                    nb_lignes: recapMois.length,
                    pieces: recapPiecesLabel(recapFormat),
                  });
                }
              }
            }
          } catch {
            /* le récap est un complément : son échec ne doit pas invalider le journal */
          }
        }
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      month: targetKey,
      monthLabel: targetLabelCap,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
