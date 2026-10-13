import { todayISO } from "@/lib/dates";

/** Données d'une barre mensuelle du graphe des envois comptables. */
export interface EnvoisChartDatum {
  /** Clé « AAAA-MM ». */
  cle: string;
  /** Envois automatiques (tâche planifiée). */
  auto: number;
  /** Envois manuels (tests / renvois). */
  manuel: number;
  /** Total des envois du mois. */
  total: number;
  /** Envois automatiques du même mois l'année précédente (N-1), ou null si inconnu. */
  n1Auto?: number | null;
}

/** Options de rendu de l'image du graphe. */
export interface EnvoisChartImageOptions {
  /**
   * Regrouper les mois par année : dessine une bande de titre par exercice au-dessus
   * des barres, avec un séparateur entre les années. Utile aux archives longues.
   */
  groupByYear?: boolean;
}

const CHART_W = 820;
const CHART_H = 484;
const CHART_SCALE = 2;

/** Lit une variable de palette CSS et renvoie une couleur oklch exploitable par canvas. */
function paletteVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `oklch(${raw})` : fallback;
}

/** Libellé court d'un mois (« sept. »). */
function moisCourt(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
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
 * Dessine le mini-graphe des envois (auto / manuel par mois) sur un canvas hors écran,
 * avec un encart de synthèse du taux de régularité (mois avec envoi automatique / total)
 * et un marqueur discret de l'année précédente (même mois N-1) pour la comparaison.
 * Quand `groupByYear` est actif, une bande de titre regroupe les barres par exercice.
 * Renvoie le canvas prêt à être exporté, ou null si rien à dessiner. Aucune dépendance
 * externe : tout est dessiné à la main.
 */
function drawEnvoisChart(mois: EnvoisChartDatum[], groupByYear: boolean): HTMLCanvasElement | null {
  if (!mois.length || typeof document === "undefined") return null;

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

  const hasN1 = mois.some((m) => (m.n1Auto ?? 0) > 0);

  // Bande de titre par exercice : seulement si on le demande ET qu'il y a plusieurs années.
  const annees = Array.from(new Set(mois.map((m) => m.cle.slice(0, 4)))).filter(Boolean);
  const avecBandes = groupByYear && annees.length > 1;
  const bandH = 22;
  const bandGap = 8;

  // Fond
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 18px ${font}`;
  ctx.fillText("Envois du journal comptable par mois", 36, 46);

  const totalAuto = mois.reduce((s, x) => s + x.auto, 0);
  const totalManuel = mois.reduce((s, x) => s + x.manuel, 0);
  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  ctx.fillText(
    `${totalAuto} automatique${totalAuto > 1 ? "s" : ""} · ${totalManuel} manuel${totalManuel > 1 ? "s" : ""} · ${mois.length} mois${avecBandes ? ` · ${annees.length} exercices` : ""}`,
    36,
    68,
  );

  // Légende (Alignée à droite)
  let legendRight = W - 36;
  ctx.textAlign = "right";
  ctx.font = `12px ${font}`;
  ctx.fillStyle = secondary;
  ctx.fillText("Manuel", legendRight, 62);
  const manuelW = ctx.measureText("Manuel").width;
  ctx.fillRect(legendRight - manuelW - 18, 53, 10, 10);
  legendRight -= manuelW + 28;
  ctx.fillStyle = primary;
  ctx.fillText("Auto", legendRight, 62);
  const autoW = ctx.measureText("Auto").width;
  ctx.fillRect(legendRight - autoW - 18, 53, 10, 10);
  legendRight -= autoW + 28;
  if (hasN1) {
    ctx.fillStyle = accent;
    ctx.fillText("N-1", legendRight, 62);
    const n1W = ctx.measureText("N-1").width;
    ctx.fillRect(legendRight - n1W - 18, 57, 10, 2);
  }

  // Encart de synthèse : taux de régularité (mois avec envoi automatique / total)
  const moisAvecAuto = mois.filter((m) => m.auto > 0).length;
  const taux = Math.round((moisAvecAuto / mois.length) * 100);
  const boxX = 36;
  const boxY = 82;
  const boxW = W - 72;
  const boxH = 48;
  ctx.fillStyle = track;
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1, 8);
  ctx.stroke();
  // Pastille d'accent à gauche de l'encart
  ctx.fillStyle = accent;
  roundRect(ctx, boxX + 14, boxY + 13, 4, boxH - 26, 2);
  ctx.fill();
  // Libellés
  ctx.textAlign = "left";
  ctx.fillStyle = fgMuted;
  ctx.font = `11px ${font}`;
  ctx.fillText("Taux de régularité", boxX + 30, boxY + 20);
  ctx.fillStyle = fgStrong;
  ctx.font = `12px ${font}`;
  ctx.fillText(`${moisAvecAuto} mois avec envoi automatique sur ${mois.length}`, boxX + 30, boxY + 37);
  // Grande valeur du taux, alignée à droite
  ctx.textAlign = "right";
  ctx.fillStyle = primary;
  ctx.font = `800 26px ${font}`;
  ctx.fillText(`${taux} %`, boxX + boxW - 18, boxY + 34);

  // Zone de tracé (légèrement abaissée quand une bande de titre par année est ajoutée)
  const plotLeft = 36;
  const plotRight = W - 36;
  const plotTop = avecBandes ? 178 : 146;
  // Bandeau « Total (toutes années) » en bas quand on regroupe par exercice (archives
  // longues) : on remonte la ligne de base pour lui laisser la place, en cohérence avec
  // la dernière ligne « Total (toutes années) » du CSV regroupé.
  const withTotalBand = groupByYear;
  const plotBottom = H - (withTotalBand ? 118 : 70);
  const plotH = plotBottom - plotTop;

  // Largeur de barre et positions, calculées une fois (réutilisées pour les bandes).
  const maxTotal = Math.max(...mois.map((x) => Math.max(x.total, x.n1Auto ?? 0)), 1);
  const n = mois.length;
  const gap = 14;
  const barW = Math.min(72, (plotRight - plotLeft - gap * (n - 1)) / n);
  const totalW = barW * n + gap * (n - 1);
  const startX = plotLeft + (plotRight - plotLeft - totalW) / 2;
  const positions = mois.map((mo, i) => ({ mo, x: startX + i * (barW + gap) }));

  // Bande de titre par exercice, au-dessus des barres.
  if (avecBandes) {
    const bandY = plotTop - bandH - bandGap;
    let i = 0;
    while (i < positions.length) {
      const an = positions[i].mo.cle.slice(0, 4);
      let j = i;
      while (j < positions.length && positions[j].mo.cle.slice(0, 4) === an) j += 1;
      const left = positions[i].x;
      const right = positions[j - 1].x + barW;
      ctx.fillStyle = track;
      roundRect(ctx, left, bandY, right - left, bandH, 6);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      roundRect(ctx, left + 0.5, bandY + 0.5, right - left - 1, bandH - 1, 6);
      ctx.stroke();
      ctx.fillStyle = accent;
      roundRect(ctx, left + 8, bandY + 6, 3, bandH - 12, 1.5);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = fgStrong;
      ctx.font = `600 12px ${font}`;
      ctx.fillText(`Année ${an}`, left + 18, bandY + bandH / 2 + 0.5);
      ctx.textAlign = "right";
      ctx.fillStyle = fgMuted;
      ctx.font = `11px ${font}`;
      ctx.fillText(`${j - i} mois`, right - 10, bandY + bandH / 2 + 0.5);
      i = j;
    }
    ctx.textBaseline = "alphabetic";
  }

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotBottom + 0.5);
  ctx.lineTo(plotRight, plotBottom + 0.5);
  ctx.stroke();

  // Séparateurs verticaux discrets entre les exercices.
  if (avecBandes) {
    let i = 0;
    while (i < positions.length) {
      const an = positions[i].mo.cle.slice(0, 4);
      let j = i;
      while (j < positions.length && positions[j].mo.cle.slice(0, 4) === an) j += 1;
      if (j < positions.length) {
        const sepX = (positions[j - 1].x + barW + positions[j].x) / 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = border;
        ctx.beginPath();
        ctx.moveTo(sepX, plotTop);
        ctx.lineTo(sepX, plotBottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      i = j;
    }
  }

  positions.forEach(({ mo, x }) => {
    ctx.save();
    roundRect(ctx, x, plotTop, barW, plotH, 6);
    ctx.clip();
    ctx.fillStyle = track;
    ctx.fillRect(x, plotTop, barW, plotH);

    if (mo.total > 0) {
      const totalH = Math.max((mo.total / maxTotal) * plotH, 8);
      const barTop = plotBottom - totalH;
      const autoH = (mo.auto / mo.total) * totalH;
      const manuelH = (mo.manuel / mo.total) * totalH;
      if (autoH > 0) {
        ctx.fillStyle = primary;
        ctx.fillRect(x, plotBottom - autoH, barW, autoH);
      }
      if (manuelH > 0) {
        ctx.fillStyle = secondary;
        ctx.fillRect(x, barTop, barW, manuelH);
      }
    }
    ctx.restore();

    // Marqueur de l'année précédente (même mois N-1), aligné sur la hauteur auto N-1.
    if ((mo.n1Auto ?? 0) > 0) {
      const n1H = Math.max((Number(mo.n1Auto) / maxTotal) * plotH, 4);
      const n1Y = plotBottom - n1H;
      ctx.fillStyle = accent;
      ctx.fillRect(x, n1Y - 1, barW, 2);
    }

    if (mo.total > 0) {
      ctx.fillStyle = fgStrong;
      ctx.font = `600 12px ${font}`;
      ctx.textAlign = "center";
      const totalH = Math.max((mo.total / maxTotal) * plotH, 8);
      ctx.fillText(String(mo.total), x + barW / 2, plotBottom - totalH - 7);
    }

    ctx.fillStyle = fgMuted;
    ctx.font = `12px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(moisCourt(mo.cle), x + barW / 2, plotBottom + 20);
  });

  // Bandeau de clôture « Total (toutes années) », cohérent avec la dernière ligne du CSV
  // regroupé par année : un seul chiffre d'archivage pour toute la série.
  if (withTotalBand) {
    const grandAuto = mois.reduce((s, x) => s + x.auto, 0);
    const grandManuel = mois.reduce((s, x) => s + x.manuel, 0);
    const grandTotal = mois.reduce((s, x) => s + x.total, 0);
    const bandY = H - 86;
    const bandW = plotRight - plotLeft;
    ctx.fillStyle = track;
    roundRect(ctx, plotLeft, bandY, bandW, 24, 6);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRect(ctx, plotLeft + 0.5, bandY + 0.5, bandW - 1, 23, 6);
    ctx.stroke();
    ctx.fillStyle = accent;
    roundRect(ctx, plotLeft + 10, bandY + 6, 3, 12, 1.5);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = fgStrong;
    ctx.font = `600 12px ${font}`;
    ctx.fillText(
      annees.length > 1 ? "Total (toutes années)" : `Total ${annees[0] ?? ""}`,
      plotLeft + 22,
      bandY + 12.5,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = fgMuted;
    ctx.font = `11px ${font}`;
    ctx.fillText(
      `${mois.length} mois · ${grandTotal} envoi${grandTotal > 1 ? "s" : ""} (${grandAuto} auto · ${grandManuel} manuel${
        grandManuel > 1 ? "s" : ""
      })`,
      plotRight - 12,
      bandY + 12.5,
    );
    ctx.textBaseline = "alphabetic";
  }

  ctx.textAlign = "left";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  ctx.fillText(
    hasN1
      ? `Trait accent = même mois l'année précédente · Exporté le ${new Date().toLocaleDateString("fr-FR")}`
      : `Exporté le ${new Date().toLocaleDateString("fr-FR")}`,
    plotLeft,
    H - 22,
  );

  return canvas;
}

/**
 * Dessine le graphe des envois et déclenche le téléchargement d'une image PNG, pour
 * archiver la régularité des envois automatiques. `options.groupByYear` regroupe les
 * mois par exercice (une bande de titre par année).
 */
export function exportEnvoisChartImage(mois: EnvoisChartDatum[], options: EnvoisChartImageOptions = {}): void {
  const canvas = drawEnvoisChart(mois, Boolean(options.groupByYear));
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `envois-comptable-par-mois-${todayISO()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

/**
 * Génère le graphe des envois sous forme de data URL PNG (base64), pour l'envoyer
 * par email au comptable sans passer par le disque. `options.groupByYear` regroupe les
 * mois par exercice. Renvoie null si rien à dessiner.
 */
export function buildEnvoisChartImageDataUrl(
  mois: EnvoisChartDatum[],
  options: EnvoisChartImageOptions = {},
): string | null {
  const canvas = drawEnvoisChart(mois, Boolean(options.groupByYear));
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}