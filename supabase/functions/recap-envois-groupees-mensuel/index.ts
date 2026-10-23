import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";

const autoTable = autoTableImport as unknown as (doc: unknown, options: Record<string, unknown>) => void;

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

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [196, 120, 58];

interface LigneSuivi {
  chantier_id: number;
  created_at: string;
  origine: string;
  destinataire: string | null;
}

interface RecapStats {
  emailsGroupees: number;
  chantiersRelances: Set<number>;
  details: Array<{ chantierId: number; destinataire: string | null; at: number }>;
  delaiMoyenJours: number | null;
  enAttente: number;
  attenteMoyenneJours: number | null;
}

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const somme = valeurs.reduce((total, v) => total + v, 0);
  return Math.round((somme / valeurs.length) * 10) / 10;
}

function calculerRecap(rows: LigneSuivi[], debut: number, fin: number, maintenant: number): RecapStats {
  const parChantier = new Map<number, Array<{ at: number; origine: string; destinataire: string | null }>>();
  rows.forEach((row) => {
    const id = Number(row.chantier_id);
    if (!Number.isFinite(id)) return;
    const at = new Date(String(row.created_at ?? "")).getTime();
    if (!Number.isFinite(at)) return;
    const liste = parChantier.get(id) ?? [];
    liste.push({ at, origine: String(row.origine ?? "manuel"), destinataire: row.destinataire ?? null });
    parChantier.set(id, liste);
  });

  const chantiersRelances = new Set<number>();
  const details: Array<{ chantierId: number; destinataire: string | null; at: number }> = [];
  const delais: number[] = [];
  const attentes: number[] = [];
  let emailsGroupees = 0;

  parChantier.forEach((liste, chantierId) => {
    const triee = [...liste].sort((a, b) => a.at - b.at);
    triee.forEach((item, index) => {
      if (item.origine !== "groupe") return;
      if (item.at < debut || item.at >= fin) return;
      emailsGroupees += 1;
      chantiersRelances.add(chantierId);
      details.push({ chantierId, destinataire: item.destinataire, at: item.at });
      const suivant = triee.slice(index + 1).find((x) => x.at > item.at);
      if (suivant) delais.push((suivant.at - item.at) / 86_400_000);
      else attentes.push(Math.max(0, (maintenant - item.at) / 86_400_000));
    });
  });

  return {
    emailsGroupees,
    chantiersRelances,
    details,
    delaiMoyenJours: moyenne(delais),
    enAttente: attentes.length,
    attenteMoyenneJours: moyenne(attentes),
  };
}

function dateCourte(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Les N derniers mois (clés « AAAA-MM »), du plus ancien au plus récent, finissant à `cle`. */
function clesMoisRecents(cle: string, nombre = 12): string[] {
  const [annee, mois] = cle.split("-").map(Number);
  const cles: string[] = [];
  for (let i = nombre - 1; i >= 0; i -= 1) {
    const d = new Date(annee, mois - 1 - i, 1);
    cles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return cles;
}

/** Libellé court d'un mois (« oct. 25 »). */
function libelleMoisCourt(cle: string): string {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

/** Un point de la courbe de tendance. */
interface PointTendance {
  moisLabel: string;
  emailsGroupees: number;
  clientsRelances: number;
}

/**
 * Dessine la courbe de tendance à deux séries (emails groupés, clients relancés).
 * `top` est l'ordonnée du titre du bloc ; renvoie l'ordonnée juste sous le graphique.
 */
function dessinerCourbeTendance(
  doc: any,
  params: { serie: PointTendance[]; top: number; margin: number; pageW: number; pageH: number },
): number {
  const { serie, margin, pageW, pageH } = params;
  const maxVal = Math.max(1, ...serie.map((p) => Math.max(p.emailsGroupees, p.clientsRelances)));
  const hauteurBloc = 186;
  let blocTop = params.top;
  if (blocTop + hauteurBloc > pageH - 70) {
    doc.addPage();
    blocTop = margin + 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Tendance des 12 derniers mois", margin, blocTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("emails groupés et clients relancés, mois par mois", pageW - margin, blocTop, { align: "right" });

  const legY = blocTop + 18;
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1.8);
  doc.line(margin, legY - 2.5, margin + 16, legY - 2.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 74, 70);
  doc.text("Emails groupés", margin + 21, legY);
  doc.setDrawColor(96, 112, 128);
  doc.line(margin + 96, legY - 2.5, margin + 112, legY - 2.5);
  doc.text("Clients relancés", margin + 117, legY);

  const plotTop = blocTop + 34;
  const plotBottom = blocTop + 166;
  const plotLeft = margin + 22;
  const plotRight = pageW - margin;

  [0, 0.5, 1].forEach((frac) => {
    const gy = plotBottom - frac * (plotBottom - plotTop);
    doc.setDrawColor(frac === 0 ? LINE[0] : 240, frac === 0 ? LINE[1] : 238, frac === 0 ? LINE[2] : 234);
    doc.setLineWidth(frac === 0 ? 1 : 0.5);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(String(Math.round(maxVal * frac)), plotLeft - 5, gy + 2, { align: "right" });
  });

  const stepX = (plotRight - plotLeft) / (serie.length - 1);
  const point = (index: number, valeur: number): [number, number] => [
    plotLeft + index * stepX,
    plotBottom - (valeur / maxVal) * (plotBottom - plotTop),
  ];

  const tracer = (valeurs: number[], couleur: [number, number, number]) => {
    doc.setDrawColor(couleur[0], couleur[1], couleur[2]);
    doc.setLineWidth(1.7);
    for (let i = 0; i < valeurs.length - 1; i += 1) {
      const [x1, y1] = point(i, valeurs[i]);
      const [x2, y2] = point(i + 1, valeurs[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
    doc.setFillColor(couleur[0], couleur[1], couleur[2]);
    valeurs.forEach((valeur, i) => {
      const [x, y] = point(i, valeur);
      doc.circle(x, y, 1.8, "F");
    });
  };

  tracer(serie.map((p) => p.emailsGroupees), ACCENT);
  tracer(serie.map((p) => p.clientsRelances), [96, 112, 128]);

  serie.forEach((p, i) => {
    const [x] = point(i, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(p.moisLabel, x, plotBottom + 12, { align: "center" });
  });

  return plotBottom + 16;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function buildRecapPdf(params: {
  emetteur: { entreprise: string; email: string | null };
  moisLabel: string;
  clientsRelances: number;
  stats: RecapStats;
  rows: Array<{ dateLabel: string; chantier: string; client: string; destinataire: string }>;
  /** Les douze derniers mois, du plus ancien au plus récent (courbe de tendance). */
  serie: PointTendance[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(params.emetteur.entreprise || "Mon entreprise", margin, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  if (params.emetteur.email) doc.text(params.emetteur.email, margin, 68);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(38, 36, 33);
  doc.text("RÉCAP MENSUEL DES ENVOIS GROUPÉS", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(params.moisLabel, pageW - margin, 68, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 82, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 94, pageW - margin, 94);

  const gap = 10;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 52;
  const boxTop = 110;
  const delaiLabel =
    params.stats.delaiMoyenJours === null ? "—" : `${String(params.stats.delaiMoyenJours).replace(".", ",")} j`;
  const kpis = [
    { label: "CLIENTS RELANCÉS", value: String(params.clientsRelances), sub: "clients distincts" },
    { label: "EMAILS GROUPÉS", value: String(params.stats.emailsGroupees), sub: "réellement partis" },
    { label: "CHANTIERS CONCERNÉS", value: String(params.stats.chantiersRelances.size), sub: "relancés ce mois-ci" },
    {
      label: "DÉLAI AVANT LE PROCHAIN EMAIL",
      value: delaiLabel,
      sub:
        params.stats.enAttente > 0
          ? `${params.stats.enAttente} en attente${
              params.stats.attenteMoyenneJours !== null
                ? ` (${String(params.stats.attenteMoyenneJours).replace(".", ",")} j)`
                : ""
            }`
          : "moyenne sur le même chantier",
    },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 16);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(doc.splitTextToSize(b.sub, boxW - 22)[0] ?? "", bx + 12, boxTop + 45);
  });

  const y = boxTop + boxH + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Détail des envois groupés (${params.rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(params.moisLabel, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Date", "Chantier", "Client", "Destinataire"]] as string[][],
    body: params.rows.length
      ? params.rows.map((r) => [r.dateLabel, r.chantier, r.client, r.destinataire])
      : [["—", "Aucun envoi groupé sur ce mois", "", ""]],
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
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 170 } },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Courbe des douze derniers mois : la tendance de fond des relances groupées, au-delà du
  // seul mois récapitulé. Même bloc que dans le PDF de comparaison.
  const apresCourbe =
    params.serie.length >= 2
      ? dessinerCourbeTendance(doc, {
          serie: params.serie,
          top: finalY + 44,
          margin,
          pageW,
          pageH,
        })
      : finalY;

  const lecture = doc.splitTextToSize(
    "Un envoi groupé regroupe dans un seul email tous les chantiers silencieux d'un même client, avec son avancement réel et son lien de suivi. Un client n'est compté qu'une fois, même si plusieurs de ses chantiers ont été relancés. Le délai mesure le temps écoulé entre un envoi groupé et l'email suivant sur le même chantier.",
    pageW - margin * 2 - 28,
  ) as string[];
  const lectureH = 30 + lecture.length * 11;
  let lectureY = apresCourbe + 24;
  if (lectureY + lectureH > pageH - 60) {
    doc.addPage();
    lectureY = margin + 10;
  }
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, lectureY, pageW - margin * 2, lectureH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, lectureY, 4, lectureH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("LECTURE", margin + 14, lectureY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 74, 70);
  lecture.forEach((line, i) => {
    doc.text(line, margin + 14, lectureY + 31 + i * 11);
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
    doc.text("Récap généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

function buildEmailHtml(nom: string, moisLabel: string, clients: number, emails: number, chantiers: number): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap mensuel des envois groupés · ${escapeHtml(moisLabel)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le récapitulatif du mois écoulé des relances groupées envoyées aux clients
          silencieux de <strong>${escapeHtml(nom)}</strong>.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Clients relancés : <strong style="color:#18181b;">${clients}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Emails groupés envoyés : <strong style="color:#18181b;">${emails}</strong></p>
          <p style="margin:0;color:#71717a;">Chantiers concernés : <strong style="color:#18181b;">${chantiers}</strong></p>
        </div>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          Pièce jointe : le récap mensuel en PDF (détail daté des envois, chantier par chantier).
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

// Le client service-role ne sert ici qu'à des lectures simples et à des écritures ciblées :
// on le décrit structurellement pour rester compatible avec les différentes versions du SDK.
type AdminDb = { from: (table: string) => any };

/**
 * Prépare tout le récap d'un mois pour un artisan : stats, PDF en base64 et email prêt à partir.
 * Utilisé par l'envoi programmé comme par l'essai immédiat, pour un rendu strictement identique.
 */
async function preparerRecap(
  admin: AdminDb,
  profile: Record<string, unknown>,
  targetKey: string,
  targetLabelCap: string,
  debut: number,
  fin: number,
): Promise<{
  nom: string;
  stats: RecapStats;
  clientsRelances: Set<number>;
  pdfBase64: string;
  filename: string;
  html: string;
  sujet: string;
}> {
  const userId = String(profile.id);
  // On remonte douze mois en arrière : le récap du mois, plus la courbe de tendance.
  const clesSerie = clesMoisRecents(targetKey, 12);
  const [anneeSerie, moisSerie] = clesSerie[0].split("-").map(Number);
  const debutSerie = new Date(anneeSerie, moisSerie - 1, 1);
  debutSerie.setDate(debutSerie.getDate() - 45);
  const depuis = debutSerie.toISOString();
  const { data: notifRaw } = await admin
    .from("suivi_notifications")
    .select("chantier_id, created_at, origine, destinataire")
    .eq("user_id", userId)
    .eq("statut", "envoye")
    .gte("created_at", depuis)
    .order("created_at", { ascending: true })
    .limit(6000);

  const rows = (notifRaw ?? []) as unknown as LigneSuivi[];
  const stats = calculerRecap(rows, debut, fin, Date.now());

  const chantierIds = Array.from(
    new Set(
      rows
        .map((r) => Number(r.chantier_id))
        .filter((id) => Number.isFinite(id))
        .concat([...stats.chantiersRelances, ...stats.details.map((d) => d.chantierId)]),
    ),
  );

  const libelles = new Map<number, string>();
  const clientIdParChantier = new Map<number, number>();
  if (chantierIds.length > 0) {
    const { data: chantiersData } = await admin.from("chantiers").select("id, libelle, client_id").in("id", chantierIds);
    ((chantiersData ?? []) as Array<Record<string, unknown>>).forEach((c) => {
      const id = Number(c.id);
      libelles.set(id, c.libelle ? String(c.libelle) : "Chantier");
      if (c.client_id !== null && c.client_id !== undefined) clientIdParChantier.set(id, Number(c.client_id));
    });
  }

  const clientIds = Array.from(new Set(Array.from(clientIdParChantier.values())));
  const nomsClients = new Map<number, string>();
  if (clientIds.length > 0) {
    const { data: clientsData } = await admin.from("clients").select("id, nom").in("id", clientIds);
    ((clientsData ?? []) as Array<Record<string, unknown>>).forEach((c) => {
      nomsClients.set(Number(c.id), String(c.nom ?? "Client"));
    });
  }

  const clientsRelances = new Set<number>();
  stats.chantiersRelances.forEach((id) => {
    const clientId = clientIdParChantier.get(id);
    clientsRelances.add(clientId ?? -id);
  });

  // Courbe de tendance : mêmes chiffres, calculés mois par mois sur douze mois.
  const serie: PointTendance[] = clesSerie.map((cle) => {
    const [annee, mois] = cle.split("-").map(Number);
    const debutMois = new Date(annee, mois - 1, 1).getTime();
    const finMois = new Date(annee, mois, 1).getTime();
    const statsMois = calculerRecap(rows, debutMois, finMois, Date.now());
    const clientsMois = new Set<number>();
    statsMois.chantiersRelances.forEach((id) => {
      const clientId = clientIdParChantier.get(id);
      clientsMois.add(clientId ?? -id);
    });
    return {
      moisLabel: libelleMoisCourt(cle),
      emailsGroupees: statsMois.emailsGroupees,
      clientsRelances: clientsMois.size,
    };
  });

  const nom = String(profile.entreprise ?? profile.metier ?? "Votre entreprise");
  const pdf = buildRecapPdf({
    emetteur: { entreprise: nom, email: profile.email ? String(profile.email) : null },
    moisLabel: targetLabelCap,
    clientsRelances: clientsRelances.size,
    stats,
    rows: stats.details.map((d) => ({
      dateLabel: dateCourte(d.at),
      chantier: libelles.get(d.chantierId) ?? "Chantier",
      client: (() => {
        const clientId = clientIdParChantier.get(d.chantierId);
        return clientId !== undefined ? nomsClients.get(clientId) ?? "Client" : "Client";
      })(),
      destinataire: d.destinataire ?? "—",
    })),
    serie,
  });

  return {
    nom,
    stats,
    clientsRelances,
    pdfBase64: toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer)),
    filename: `recap-envois-groupees-${targetKey}.pdf`,
    html: buildEmailHtml(nom, targetLabelCap, clientsRelances.size, stats.emailsGroupees, stats.chantiersRelances.size),
    sujet: `Récap mensuel des envois groupés — ${targetLabelCap}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;

    const { day: todayDay, hour: todayHour, year, month } = parisParts();
    const target = new Date(year, month - 2, 1);
    const targetKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    const targetLabel = target.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const targetLabelCap = targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1);
    const debut = target.getTime();
    const fin = new Date(target.getFullYear(), target.getMonth() + 1, 1).getTime();

    const configured = Boolean(resendKey && fromDomain);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Mode essai : l'artisan demande à recevoir tout de suite le récap du mois écoulé
    // sur sa propre adresse, pour vérifier la mise en forme avant la date programmée.
    // Rien n'est marqué comme envoyé, aucun client n'est contacté.
    if (body?.test === true) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!anonKey || !authHeader.startsWith("Bearer ")) {
        return json({ ok: false, error: "Authentification requise." }, 401);
      }
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) return json({ ok: false, error: "Session invalide." }, 401);
      const moi = userData.user;

      const { data: profil, error: profilError } = await admin
        .from("profiles")
        .select("id, entreprise, metier, email")
        .eq("id", moi.id)
        .maybeSingle();
      if (profilError) return json({ ok: false, error: profilError.message }, 500);

      const profilComplet = (profil ?? { id: moi.id }) as Record<string, unknown>;
      const destinataire = String(profilComplet.email ?? moi.email ?? "").trim();
      if (!destinataire) return json({ ok: false, error: "Aucune adresse email sur votre profil." }, 400);
      if (!configured) {
        return json({ ok: false, configured: false, error: "Le service d'envoi n'est pas configuré." }, 503);
      }

      const recap = await preparerRecap(admin, profilComplet, targetKey, targetLabelCap, debut, fin);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${recap.nom} <noreply@${fromDomain}>`,
          to: [destinataire],
          subject: `[Essai] ${recap.sujet}`,
          html: recap.html,
          attachments: [{ filename: recap.filename, content: recap.pdfBase64 }],
        }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok) {
        return json({ ok: false, error: data?.message || `L'envoi a été refusé (code ${res.status}).` }, 502);
      }

      return json({
        ok: true,
        test: true,
        sent: true,
        destinataire,
        month: targetKey,
        monthLabel: targetLabelCap,
        emails: recap.stats.emailsGroupees,
        clients: recap.clientsRelances.size,
        chantiers: recap.stats.chantiersRelances.size,
      });
    }

    let query = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, comptable_email, recap_groupe_auto_actif, recap_groupe_auto_mode, recap_groupe_auto_jour, recap_groupe_auto_heure, recap_groupe_auto_dernier_mois",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; emails?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const actif = p.recap_groupe_auto_actif === true || force;
      const mode = String(p.recap_groupe_auto_mode ?? "envoi") === "archive" ? "archive" : "envoi";
      const recipient = String(p.comptable_email ?? "").trim();
      const jourChoisi =
        Number.isFinite(Number(p.recap_groupe_auto_jour)) && Number(p.recap_groupe_auto_jour) > 0
          ? Number(p.recap_groupe_auto_jour)
          : 1;
      const heureChoisie =
        p.recap_groupe_auto_heure === null || p.recap_groupe_auto_heure === undefined
          ? 8
          : Number(p.recap_groupe_auto_heure);
      const dejaFait = String(p.recap_groupe_auto_dernier_mois ?? "") === targetKey;

      if (mode !== "envoi") {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Mode archivage local (rien à envoyer)." });
        continue;
      }
      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap automatique inactif." });
        continue;
      }
      if (!recipient) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (dejaFait && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Déjà envoyé ce mois-ci." });
        continue;
      }
      if (!scopeUserId && !ignoreTime && !force) {
        if (jourChoisi !== todayDay || heureChoisie !== todayHour) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }

      const { nom, stats, pdfBase64, filename, html, sujet } = await preparerRecap(
        admin,
        p,
        targetKey,
        targetLabelCap,
        debut,
        fin,
      );

      if (!configured) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun service d'envoi configuré." });
        continue;
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${nom} <noreply@${fromDomain}>`,
            to: [recipient],
            subject: sujet,
            html,
            attachments: [{ filename, content: pdfBase64 }],
          }),
        });
        const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
        if (!res.ok) {
          skipped += 1;
          details.push({
            userId,
            sent: false,
            reason: data?.message || `Resend a refusé l'envoi (code ${res.status}).`,
          });
          continue;
        }

        await admin
          .from("profiles")
          .update({ recap_groupe_auto_dernier_mois: targetKey, updated_at: new Date().toISOString() })
          .eq("id", userId);

        await admin.from("envois_email").insert({
          user_id: userId,
          facture_id: null,
          devis_id: null,
          relance_id: null,
          type: "recap_groupe",
          canal: "email",
          groupe: false,
          destinataire: recipient,
          sujet,
          mois_cle: targetKey,
          mode: force ? "manuel" : "automatique",
          nb_lignes: stats.emailsGroupees,
          pieces: "Récap PDF joint",
        });

        sent += 1;
        details.push({ userId, sent: true, emails: stats.emailsGroupees });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured,
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
