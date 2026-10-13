import { todayISO } from "@/lib/dates";
import type { PointRecapMensuel } from "@/lib/diagnosticEmail";

/**
 * Données nécessaires pour dessiner le comparatif de cadence des récaps mensuels sous
 * forme d'image PNG : la fenêtre comparée, les deux séries (courante et précédente) et
 * leurs totaux. Source identique au tableau et au PDF, donc les chiffres concordent.
 */
export interface ComparatifCadenceImageInput {
  /** Nom de l'établissement affiché dans l'en-tête de l'image. */
  entreprise: string;
  /** Fenêtre comparée, en mois (6, 12 ou 24). Pilote les libellés et le graphe. */
  fenetre: number;
  /** Fenêtre courante : les N derniers mois (un point par mois). */
  courant: PointRecapMensuel[];
  /** Fenêtre précédente : les N mois d'avant (alignée index par index). */
  precedent: PointRecapMensuel[];
  /** Total des récaps sur la fenêtre courante. */
  totalCourant: number;
  /** Total des récaps sur la fenêtre précédente. */
  totalPrecedent: number;
}

const CHART_W = 880;
const CHART_H = 560;
const CHART_SCALE = 2;
const ROUGE = "#c94a3a";

/** Lit une variable de palette CSS et renvoie une couleur oklch exploitable par canvas. */
function paletteVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `oklch(${raw})` : fallback;
}

/** Trace un rectangle à coins arrondis dans le contexte canvas. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Dessine le comparatif de cadence (barres courantes vs précédentes, mois par mois) sur un
 * canvas hors écran, avec un titre, trois indicateurs (fenêtre courante, fenêtre précédente,
 * variation) et une légende. Aucune dépendance externe : tout est tracé à la main.
 * Renvoie le canvas prêt à être exporté, ou null si rien à dessiner.
 */
function drawComparatifCadence(input: ComparatifCadenceImageInput): HTMLCanvasElement | null {
  if (!input.courant.length || typeof document === "undefined") return null;

  const W = CHART_W;
  const H = CHART_H;
  const scale = CHART_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const bg = paletteVar("--background-50", "#ffffff");
  const fgStrong = paletteVar("--foreground-950", "#141414");
  const fgMuted = paletteVar("--foreground-500", "#7a7a7a");
  const fgFaint = paletteVar("--foreground-300", "#c7c7c7");
  const track = paletteVar("--background-200", "#ededed");
  const border = paletteVar("--background-200", "#e6e6e6");
  const accent = paletteVar("--accent-500", "#b0762e");
  const secondarySoft = paletteVar("--secondary-200", "#e2d6ca");
  const secondaryBorder = paletteVar("--secondary-300", "#cdbfb0");

  // Fond
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre + sous-titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `700 20px ${font}`;
  ctx.fillText("Comparatif de cadence", 40, 46);

  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `${input.fenetre} derniers mois vs ${input.fenetre} mois précédents · ${input.entreprise}`,
    40,
    68,
  );

  // Trois indicateurs
  const delta =
    input.totalPrecedent > 0
      ? Math.round(((input.totalCourant - input.totalPrecedent) / input.totalPrecedent) * 100)
      : null;
  const kpiY = 88;
  const kpiH = 58;
  const gap = 12;
  const kpiW = (W - 80 - gap * 2) / 3;
  const kpis: { label: string; value: string; color: string }[] = [
    { label: `${input.fenetre} DERNIERS MOIS`, value: String(input.totalCourant), color: accent },
    { label: `${input.fenetre} MOIS PRÉCÉDENTS`, value: String(input.totalPrecedent), color: fgMuted },
    {
      label: "VARIATION",
      value: delta === null ? "N/A" : `${delta > 0 ? "+" : ""}${delta} %`,
      color: delta !== null && delta < 0 ? ROUGE : accent,
    },
  ];
  kpis.forEach((k, i) => {
    const x = 40 + i * (kpiW + gap);
    ctx.fillStyle = track;
    roundRect(ctx, x, kpiY, kpiW, kpiH, 8);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, kpiY + 0.5, kpiW - 1, kpiH - 1, 8);
    ctx.stroke();
    ctx.fillStyle = k.color;
    roundRect(ctx, x + 14, kpiY + 14, 4, kpiH - 28, 2);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = fgMuted;
    ctx.font = `11px ${font}`;
    ctx.fillText(k.label, x + 28, kpiY + 22);
    ctx.fillStyle = fgStrong;
    ctx.font = `800 24px ${font}`;
    ctx.fillText(k.value, x + 28, kpiY + 46);
  });

  // Titre du graphe + légende alignée à droite
  const chartTitleY = kpiY + kpiH + 34;
  ctx.textAlign = "left";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 14px ${font}`;
  ctx.fillText("Cadence mois par mois", 40, chartTitleY);

  let right = W - 40;
  ctx.textAlign = "right";
  ctx.font = `12px ${font}`;
  ctx.fillStyle = secondaryBorder;
  ctx.fillText(`${input.fenetre} mois précédents`, right, chartTitleY);
  const w1 = ctx.measureText(`${input.fenetre} mois précédents`).width;
  ctx.fillRect(right - w1 - 18, chartTitleY - 10, 10, 10);
  right -= w1 + 30;
  ctx.fillStyle = accent;
  ctx.fillText("Période courante", right, chartTitleY);
  const w2 = ctx.measureText("Période courante").width;
  ctx.fillRect(right - w2 - 18, chartTitleY - 10, 10, 10);

  // Zone de tracé
  const plotLeft = 62;
  const plotRight = W - 40;
  const plotTop = chartTitleY + 24;
  const plotBottom = H - 84;
  const plotH = plotBottom - plotTop;
  const usableH = plotH - 10;

  const n = input.courant.length;
  const maxVal = Math.max(
    ...input.courant.map((p) => p.total),
    ...input.precedent.map((p) => p.total),
    1,
  );

  // Axe horizontal + graduations
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft - 14, plotBottom + 0.5);
  ctx.lineTo(plotRight, plotBottom + 0.5);
  ctx.stroke();
  ctx.textAlign = "right";
  ctx.fillStyle = fgMuted;
  ctx.font = `11px ${font}`;
  ctx.fillText(String(maxVal), plotLeft - 20, plotTop + 4);
  ctx.fillText("0", plotLeft - 20, plotBottom);

  const groupW = (plotRight - plotLeft) / n;
  const pairW = Math.min(groupW * 0.6, 26);
  const barGap = 2;
  const barW = Math.max((pairW - barGap) / 2, 1.5);

  input.courant.forEach((p, i) => {
    const prec = input.precedent[i]?.total ?? 0;
    const gx = plotLeft + i * groupW + (groupW - pairW) / 2;
    const hPrec = (prec / maxVal) * usableH;
    const hCur = (p.total / maxVal) * usableH;

    // Barre de la période précédente (à gauche)
    if (prec > 0) {
      ctx.fillStyle = secondarySoft;
      roundRect(ctx, gx, plotBottom - hPrec, barW, hPrec, 3);
      ctx.fill();
      ctx.strokeStyle = secondaryBorder;
      ctx.lineWidth = 1;
      roundRect(ctx, gx + 0.5, plotBottom - hPrec + 0.5, barW - 1, Math.max(hPrec - 1, 0.5), 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = track;
      ctx.fillRect(gx, plotBottom - 3, barW, 3);
    }

    // Barre de la période courante (à droite)
    if (p.total > 0) {
      ctx.fillStyle = accent;
      roundRect(ctx, gx + barW + barGap, plotBottom - hCur, barW, hCur, 3);
      ctx.fill();
    } else {
      ctx.fillStyle = track;
      ctx.fillRect(gx + barW + barGap, plotBottom - 3, barW, 3);
    }

    // Valeur au-dessus de la barre courante (si la place le permet)
    if (n <= 12 && p.total > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = accent;
      ctx.font = `700 11px ${font}`;
      ctx.fillText(String(p.total), gx + barW + barGap + barW / 2, plotBottom - hCur - 5);
    }

    // Libellé du mois (un sur deux si la fenêtre est longue)
    if (n <= 12 || i % 2 === 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = fgMuted;
      ctx.font = `11px ${font}`;
      ctx.fillText(p.label, gx + pairW / 2, plotBottom + 18);
    }
  });

  ctx.textAlign = "left";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  ctx.fillText(
    `Comparatif généré avec ArtiFlow-pro · exporté le ${new Date().toLocaleDateString("fr-FR")}`,
    40,
    H - 24,
  );

  return canvas;
}

/**
 * Dessine le comparatif de cadence et déclenche le téléchargement d'une image PNG, pour
 * partager ou archiver le visuel du comparatif sans générer de PDF.
 */
export function exportComparatifCadenceImage(input: ComparatifCadenceImageInput): void {
  const canvas = drawComparatifCadence(input);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparatif-cadence-${todayISO()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}