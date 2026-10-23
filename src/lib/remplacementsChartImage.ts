import { todayISO } from "@/lib/dates";
import { telechargerBlob } from "@/lib/telechargement";

/** Données d'une barre mensuelle du mini-graphe des remplacements. */
export interface RemplacementChartDatum {
  /** Clé « AAAA-MM ». */
  cle: string;
  /** Libellé lisible (« Octobre 2026 »). */
  label: string;
  /** Libellé court (« oct. »). */
  court: string;
  /** Renvois de journal du mois. */
  journal: number;
  /** Renvois de bilan du mois. */
  bilan: number;
  /** Total des renvois du mois. */
  total: number;
}

/** Options d'export du mini-graphe (mise en évidence d'une barre « mois le plus faible »). */
export interface RemplacementChartOptions {
  /** Clé « AAAA-MM » de la barre à mettre en évidence (mois le plus faible de la période). */
  highlightCle?: string | null;
  /** Mention affichée sous le graphe quand une barre est mise en évidence. */
  highlightLabel?: string;
  /**
   * Mois épinglés « à surveiller » dans l'ordre de rangement affiché : chaque barre concernée porte
   * alors son rang de surveillance sous la forme « N/total » (1 = le plus prioritaire), cohérent
   * avec les puces de la pastille « Épinglé » et le mini-récap PDF.
   */
  epinglesTries?: string[];
}

/** Ligne du récap « historique des mois faibles consultés » (une par mois). */
export interface RemplacementHistoriqueEntry {
  /** Clé « AAAA-MM ». */
  cle: string;
  /** Libellé lisible (« Octobre 2026 »). */
  label: string;
  /** Renvois de journal du mois. */
  journal: number;
  /** Renvois de bilan du mois. */
  bilan: number;
  /** Total des renvois du mois. */
  total: number;
}

const CHART_W = 820;
const CHART_H = 430;
const CHART_SCALE = 2;

const HIST_W = 640;
const HIST_ROW_H = 96;
const HIST_HEADER = 104;
const HIST_FOOTER = 48;

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
 * Dessine le mini-graphe des remplacements (journal / bilan par mois) sur un canvas hors
 * écran : titre, légende, barres empilées et total par mois mis en avant pour le mois
 * « record » de la période. Si une clé de mois est fournie dans les options, sa barre est
 * peinte d'un dégradé secondary pour marquer le « mois le plus faible » (creux d'activité).
 * Aucune dépendance externe, tout est dessiné à la main.
 * Renvoie le canvas prêt à être exporté, ou null si rien à dessiner.
 */
function drawRemplacementsChart(
  mois: RemplacementChartDatum[],
  options?: RemplacementChartOptions,
): HTMLCanvasElement | null {
  if (!mois.length || typeof document === "undefined") return null;

  const highlightCle = options?.highlightCle ?? "";
  const epinglesTries = options?.epinglesTries ?? [];
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
  const primary = paletteVar("--primary-500", "#3a3a3a");
  const secondary = paletteVar("--secondary-500", "#8a8a8a");
  const accent = paletteVar("--accent-500", "#b0762e");
  const secondaryDark = paletteVar("--secondary-600", "#7c5232");
  const secondaryLight = paletteVar("--secondary-200", "#e7d5c6");

  const totalJournal = mois.reduce((s, m) => s + m.journal, 0);
  const totalBilan = mois.reduce((s, m) => s + m.bilan, 0);
  const total = totalJournal + totalBilan;

  // Fond
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre + sous-titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 18px ${font}`;
  ctx.fillText("Remplacements — renvois par mois", 36, 46);

  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `${mois.length} mois · ${total} renvoi${total > 1 ? "s" : ""}${epinglesTries.length > 0 ? ` · ${epinglesTries.length} épinglé${epinglesTries.length > 1 ? "s" : ""}` : ""}`,
    36,
    68,
  );

  // Légende (alignée à droite) : reflète ce qui est réellement mis en avant.
  let legendRight = W - 36;
  ctx.textAlign = "right";
  ctx.font = `12px ${font}`;
  if (highlightCle) {
    ctx.fillStyle = secondaryDark;
    ctx.fillText("Mois le plus faible", legendRight, 62);
    const lblW = ctx.measureText("Mois le plus faible").width;
    ctx.fillRect(legendRight - lblW - 18, 53, 10, 10);
    legendRight -= lblW + 28;
  }
  ctx.fillStyle = secondary;
  ctx.fillText("Bilan", legendRight, 62);
  const bilanW = ctx.measureText("Bilan").width;
  ctx.fillRect(legendRight - bilanW - 18, 53, 10, 10);
  legendRight -= bilanW + 28;
  ctx.fillStyle = primary;
  ctx.fillText("Journal", legendRight, 62);
  const journalW = ctx.measureText("Journal").width;
  ctx.fillRect(legendRight - journalW - 18, 53, 10, 10);

  // Zone de tracé
  const plotLeft = 36;
  const plotRight = W - 36;
  const plotTop = 108;
  const plotBottom = H - 62;
  const plotH = plotBottom - plotTop;

  const maxTotal = Math.max(...mois.map((m) => m.total), 1);
  const n = mois.length;
  const gap = 14;
  const barW = Math.min(84, (plotRight - plotLeft - gap * (n - 1)) / n);
  const totalW = barW * n + gap * (n - 1);
  const startX = plotLeft + (plotRight - plotLeft - totalW) / 2;

  // Ligne de base
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotBottom + 0.5);
  ctx.lineTo(plotRight, plotBottom + 0.5);
  ctx.stroke();

  mois.forEach((m, i) => {
    const x = startX + i * (barW + gap);
    const isRecord = m.total > 0 && m.total === maxTotal;
    const isFaible = highlightCle !== "" && m.cle === highlightCle && m.total > 0;
    const totalH = m.total > 0 ? Math.max((m.total / maxTotal) * plotH, 8) : 0;

    ctx.save();
    roundRect(ctx, x, plotTop, barW, plotH, 6);
    ctx.clip();
    ctx.fillStyle = track;
    ctx.fillRect(x, plotTop, barW, plotH);
    if (m.total > 0) {
      if (isFaible) {
        // Barre du mois le plus faible : dégradé secondary montant, pour la repérer d'un coup d'œil.
        const grad = ctx.createLinearGradient(0, plotBottom - totalH, 0, plotBottom);
        grad.addColorStop(0, secondaryLight);
        grad.addColorStop(1, secondaryDark);
        ctx.fillStyle = grad;
        ctx.fillRect(x, plotBottom - totalH, barW, totalH);
      } else {
        const journalH = (m.journal / m.total) * totalH;
        const bilanH = (m.bilan / m.total) * totalH;
        if (journalH > 0) {
          ctx.fillStyle = primary;
          ctx.fillRect(x, plotBottom - journalH, barW, journalH);
        }
        if (bilanH > 0) {
          ctx.fillStyle = secondary;
          ctx.fillRect(x, plotBottom - totalH, barW, bilanH);
        }
      }
    }
    ctx.restore();

    // Anneau de mise en évidence autour de la barre du mois le plus faible.
    if (isFaible) {
      ctx.strokeStyle = secondaryDark;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 1, plotBottom - totalH - 1, barW - 2, totalH + 2, 6);
      ctx.stroke();
    }

    // Rang de surveillance « N/total » des mois épinglés, posé sur la barre comme les puces de la
    // pastille « Épinglé » et le mini-récap PDF (1 = le plus prioritaire, dans l'ordre de rangement).
    const idxEpingle = epinglesTries.indexOf(m.cle);
    if (idxEpingle >= 0 && m.total > 0) {
      const badge = `${idxEpingle + 1}/${epinglesTries.length}`;
      ctx.save();
      ctx.font = `700 9px ${font}`;
      const badgeW = ctx.measureText(badge).width + 9;
      const badgeH = 14;
      const badgeX = x + barW - badgeW;
      const badgeY = plotTop + 2;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fillStyle = secondaryDark;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = bg;
      ctx.stroke();
      ctx.fillStyle = bg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);
      ctx.restore();
    }

    if (m.total > 0) {
      ctx.fillStyle = isFaible ? secondaryDark : isRecord ? accent : fgStrong;
      ctx.font = `600 12px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(String(m.total), x + barW / 2, plotBottom - totalH - (isFaible ? 9 : 7));
    }

    ctx.fillStyle = isFaible ? secondaryDark : isRecord ? accent : fgMuted;
    ctx.font = `12px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(m.court, x + barW / 2, plotBottom + 20);
  });

  // Note du mois le plus faible (sous le graphe), quand une barre est mise en évidence.
  if (highlightCle && options?.highlightLabel) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = secondaryDark;
    ctx.font = `600 11px ${font}`;
    ctx.fillText(options.highlightLabel, plotLeft, H - 38);
  }

  // Note de bas de page
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  ctx.fillText(
    `${totalJournal} journal${totalJournal > 1 ? "x" : ""} · ${totalBilan} bilan${totalBilan > 1 ? "s" : ""} · Exporté le ${new Date().toLocaleDateString("fr-FR")}`,
    plotLeft,
    H - 20,
  );

  return canvas;
}

/**
 * Renvoie le mini-graphe des remplacements (période choisie) sous forme d'image PNG
 * encodée en data URL, par exemple pour l'intégrer directement dans le PDF des
 * remplacements. Renvoie null si le graphe ne peut pas être dessiné.
 */
function drawRemplacementsHistorique(entries: RemplacementHistoriqueEntry[]): HTMLCanvasElement | null {
  if (!entries.length || typeof document === "undefined") return null;

  const W = HIST_W;
  const H = HIST_HEADER + entries.length * HIST_ROW_H + HIST_FOOTER;
  const scale = CHART_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const bg = paletteVar("--background-50", "#ffffff");
  const card = paletteVar("--background-100", "#f7f7f7");
  const track = paletteVar("--background-200", "#ededed");
  const border = paletteVar("--background-200", "#e6e6e6");
  const fgStrong = paletteVar("--foreground-950", "#141414");
  const fgMuted = paletteVar("--foreground-500", "#7a7a7a");
  const fgFaint = paletteVar("--foreground-300", "#c7c7c7");
  const primary = paletteVar("--primary-500", "#3a3a3a");
  const secondary = paletteVar("--secondary-500", "#8a8a8a");
  const secondaryDark = paletteVar("--secondary-600", "#7c5232");
  const secondaryLight = paletteVar("--secondary-200", "#e7d5c6");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre + sous-titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 18px ${font}`;
  ctx.fillText("Historique — mois faibles consultés", 32, 44);
  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `${entries.length} dernier${entries.length > 1 ? "s" : ""} mois faible${entries.length > 1 ? "s" : ""} · du plus récent au plus ancien`,
    32,
    66,
  );

  const maxTotal = Math.max(...entries.map((e) => e.total), 1);
  const barLeft = 200;
  const barRight = W - 72;
  const barFullW = barRight - barLeft;
  const cardTop = HIST_HEADER;
  const cardH = HIST_ROW_H - 14;

  entries.forEach((e, i) => {
    const y = cardTop + i * HIST_ROW_H;

    // Carte du mois
    roundRect(ctx, 24, y, W - 48, cardH, 10);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pastille de rang (1 = le plus récent)
    const cy = y + cardH / 2;
    ctx.beginPath();
    ctx.arc(52, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = secondaryLight;
    ctx.fill();
    ctx.fillStyle = secondaryDark;
    ctx.font = `700 13px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 52, cy + 0.5);

    // Libellé du mois + détail
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = fgStrong;
    ctx.font = `600 14px ${font}`;
    ctx.fillText(e.label, 80, y + 32);
    ctx.fillStyle = fgMuted;
    ctx.font = `11px ${font}`;
    ctx.fillText(
      `${e.total} renvoi${e.total > 1 ? "s" : ""} · ${e.journal} journal${e.journal > 1 ? "x" : ""} · ${e.bilan} bilan${e.bilan > 1 ? "s" : ""}`,
      80,
      y + 50,
    );

    // Barre empilée horizontale (journal + bilan), longueur relative au plus fort des mois
    const barY = y + cardH - 30;
    const barH = 12;
    roundRect(ctx, barLeft, barY, barFullW, barH, 6);
    ctx.fillStyle = track;
    ctx.fill();

    const totalW = (e.total / maxTotal) * barFullW;
    if (e.total > 0 && totalW > 0) {
      const jW = (e.journal / e.total) * totalW;
      const bW = (e.bilan / e.total) * totalW;
      ctx.save();
      roundRect(ctx, barLeft, barY, totalW, barH, 6);
      ctx.clip();
      if (jW > 0) {
        ctx.fillStyle = primary;
        ctx.fillRect(barLeft, barY, jW, barH);
      }
      if (bW > 0) {
        ctx.fillStyle = secondary;
        ctx.fillRect(barLeft + jW, barY, bW, barH);
      }
      ctx.restore();
    }
  });

  // Pied de page
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  ctx.fillText(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 32, H - 18);

  return canvas;
}

/**
 * Exporte en PNG un récap « historique » empilant les mois faibles consultés (du plus récent
 * au plus ancien) dans une seule image : chaque mois occupe une carte avec son détail
 * journaux / bilans et une barre empilée. Utile pour archiver d'un coup d'œil les creux suivis.
 */
export function exportRemplacementsHistoriqueImage(entries: RemplacementHistoriqueEntry[]): void {
  const canvas = drawRemplacementsHistorique(entries);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    telechargerBlob(`remplacements-historique-mois-faibles-${todayISO()}.png`, blob);
  }, "image/png");
}

/**
 * Renvoie le mini-graphe des remplacements (période choisie) sous forme d'image PNG
 * encodée en data URL, par exemple pour l'intégrer directement dans le PDF des
 * remplacements. Renvoie null si le graphe ne peut pas être dessiné.
 */
export function getRemplacementsChartDataUrl(
  mois: RemplacementChartDatum[],
  options?: RemplacementChartOptions,
): string | null {
  const canvas = drawRemplacementsChart(mois, options);
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Dessine le mini-graphe des remplacements (période choisie) et déclenche le
 * téléchargement d'une image PNG, à archiver avec le PDF des remplacements.
 * Si `options.highlightCle` est fourni, la barre de ce mois est mise en évidence
 * (dégradé secondary) et le nom du fichier le mentionne.
 */
export function exportRemplacementsChartImage(
  mois: RemplacementChartDatum[],
  options?: RemplacementChartOptions,
): void {
  const canvas = drawRemplacementsChart(mois, options);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const suffixeFaible = options?.highlightCle ? `-mois-faible-${options.highlightCle}` : "";
    telechargerBlob(`remplacements-renvois-par-mois${suffixeFaible}-${todayISO()}.png`, blob);
  }, "image/png");
}