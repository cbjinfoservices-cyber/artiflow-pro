import { todayISO } from "@/lib/dates";

/** Donnée d'un mois du mini-graphe des alertes artisan. */
export interface AlerteChartMois {
  /** Clé « AAAA-MM ». */
  cle: string;
  /** Libellé court (« oct. 25 »). */
  label: string;
  /** Nombre d'alertes email envoyées ce mois. */
  count: number;
}

/** Options de rendu de l'image du graphe des alertes. */
export interface AlerteChartImageOptions {
  /** Mois mis en évidence (clés « AAAA-MM »), correspondant au filtre de la liste. */
  highlightCles?: string[];
  /** Nombre de mois affichés (fenêtre du graphe). */
  moisAffiches?: number;
  /** Cumul complet des alertes (toutes fenêtres), pour comparer la période au total. */
  totalToutesFenetres?: number;
  /** Résumé texte de la sélection (le même que la pastille copiable), repris dans l'image. */
  resume?: string;
  /** Inclure la plage de mois filtrée dans le nom du fichier PNG (par défaut : oui). */
  plageDansNom?: boolean;
}

const CHART_W = 820;
const CHART_H = 440;
const CHART_SCALE = 2;

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
  ctx.arcTo(x + w, y + h, x, y, radius);
  ctx.arcTo(x + w, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Découpe un texte en lignes tenant dans `maxWidth` (au plus `maxLignes`), en respectant les mots.
 * Utilisé pour inscrire le résumé du filtre dans l'image exportée sans déborder.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  maxLignes = 3,
): string[] {
  ctx.font = font;
  const mots = text.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let ligne = "";
  mots.forEach((mot) => {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > maxWidth && ligne) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  });
  if (ligne) lignes.push(ligne);
  if (lignes.length <= maxLignes) return lignes;
  const tronquees = lignes.slice(0, maxLignes);
  tronquees[maxLignes - 1] = `${tronquees[maxLignes - 1]}…`;
  return tronquees;
}

/**
 * Dessine le mini-graphe des alertes email envoyées à l'artisan, par mois, sur un canvas hors
 * écran : titre, sous-titre avec la période sélectionnée, le total « toutes fenêtres » pour
 * comparaison, un histogramme dont les mois filtrés sont mis en évidence, et — quand un filtre de
 * mois est actif — le résumé copiable de la sélection. Tout est dessiné à la main, sans dépendance
 * externe. Renvoie le canvas prêt à exporter, ou null si rien à dessiner.
 */
function drawAlertesChart(mois: AlerteChartMois[], options: AlerteChartImageOptions): HTMLCanvasElement | null {
  if (!mois.length || typeof document === "undefined") return null;

  const highlight = new Set(options.highlightCles ?? []);
  const W = CHART_W;
  const scale = CHART_SCALE;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const bg = paletteVar("--background-50", "#ffffff");
  const fgStrong = paletteVar("--foreground-950", "#141414");
  const fgMuted = paletteVar("--foreground-500", "#7a7a7a");
  const fgFaint = paletteVar("--foreground-300", "#c7c7c7");
  const track = paletteVar("--background-200", "#ededed");
  const border = paletteVar("--background-200", "#e6e6e6");
  const accent = paletteVar("--accent-500", "#b0762e");
  const accentDark = paletteVar("--accent-700", "#7c4f1a");
  const accentSoft = paletteVar("--accent-200", "#e7d5c6");

  // Résumé du filtre : mesuré d'abord pour réserver la bonne hauteur (le redimensionnement du
  // canvas réinitialise l'état du contexte, on repasse donc l'échelle juste après).
  const resume = (options.resume ?? "").trim();
  const resumeBoxW = W - 72;
  const resumeLines = resume
    ? wrapText(ctx, resume, resumeBoxW - 44, `12px ${font}`)
    : [];

  // Zone de tracé (constante) : les mois restent à la même hauteur quelle que soit la présence
  // du résumé, celui-ci venant s'ajouter sous les libellés.
  const plotBottom = CHART_H - 62;
  const lineH = 16;
  const padTop = 12;
  const labelH = 16;
  const padBottom = 12;
  const resumeBoxY = plotBottom + 40;
  const resumeBoxH = resumeLines.length > 0 ? padTop + labelH + resumeLines.length * lineH + padBottom : 0;
  const H = resumeLines.length > 0 ? resumeBoxY + resumeBoxH + 34 : CHART_H;

  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);

  const totalPeriode = mois.reduce((s, m) => s + m.count, 0);
  const totalToutes = options.totalToutesFenetres ?? totalPeriode;
  const moisActifs = mois.filter((m) => m.count > 0).length;

  // Fond
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre + sous-titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 18px ${font}`;
  ctx.fillText("Alertes artisan — envois par mois", 36, 46);

  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  const fenetre = options.moisAffiches ? `${options.moisAffiches} derniers mois` : `${mois.length} mois`;
  ctx.fillText(
    `${fenetre} · ${totalPeriode} alerte${totalPeriode > 1 ? "s" : ""} sur la période · ${totalToutes} au total (toutes fenêtres)`,
    36,
    68,
  );

  // Encart de synthèse : période vs total toutes fenêtres.
  const boxX = 36;
  const boxY = 84;
  const boxW = W - 72;
  const boxH = 50;
  ctx.fillStyle = track;
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1, 8);
  ctx.stroke();
  ctx.fillStyle = accent;
  roundRect(ctx, boxX + 14, boxY + 14, 4, boxH - 28, 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = fgMuted;
  ctx.font = `11px ${font}`;
  ctx.fillText("Période affichée vs cumul", boxX + 30, boxY + 20);
  ctx.fillStyle = fgStrong;
  ctx.font = `12px ${font}`;
  ctx.fillText(
    `${totalPeriode} sur la fenêtre · ${moisActifs} mois actif${moisActifs > 1 ? "s" : ""}`,
    boxX + 30,
    boxY + 38,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = accentDark;
  ctx.font = `800 24px ${font}`;
  ctx.fillText(`${totalToutes}`, boxX + boxW - 18, boxY + 34);

  // Zone de tracé
  const plotLeft = 36;
  const plotRight = W - 36;
  const plotTop = 166;
  const plotH = plotBottom - plotTop;

  const maxCount = Math.max(1, ...mois.map((m) => m.count));
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
    const selectionne = highlight.has(m.cle);
    const hauteur = m.count <= 0 ? 4 : Math.max(8, (m.count / maxCount) * plotH);

    // Piste de fond
    ctx.save();
    roundRect(ctx, x, plotTop, barW, plotH, 6);
    ctx.clip();
    ctx.fillStyle = track;
    ctx.fillRect(x, plotTop, barW, plotH);
    if (m.count > 0) {
      ctx.fillStyle = selectionne ? accentDark : accent;
      ctx.fillRect(x, plotBottom - hauteur, barW, hauteur);
    } else if (selectionne) {
      ctx.fillStyle = fgFaint;
      ctx.fillRect(x, plotBottom - hauteur, barW, hauteur);
    }
    ctx.restore();

    // Anneau autour des mois filtrés.
    if (selectionne) {
      ctx.strokeStyle = accentDark;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 1, plotBottom - hauteur - 1, barW - 2, hauteur + 2, 6);
      ctx.stroke();
    }

    // Valeur au-dessus de la barre.
    if (m.count > 0) {
      ctx.fillStyle = selectionne ? accentDark : fgStrong;
      ctx.font = `600 12px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(String(m.count), x + barW / 2, plotBottom - hauteur - 7);
    }

    // Libellé du mois.
    ctx.fillStyle = selectionne ? accentDark : fgMuted;
    ctx.font = `12px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(m.label, x + barW / 2, plotBottom + 20);
  });

  // Résumé copiable de la sélection (même texte que la pastille de la carte).
  if (resumeLines.length > 0) {
    const rX = 36;
    ctx.fillStyle = track;
    roundRect(ctx, rX, resumeBoxY, resumeBoxW, resumeBoxH, 8);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRect(ctx, rX + 0.5, resumeBoxY + 0.5, resumeBoxW - 1, resumeBoxH - 1, 8);
    ctx.stroke();
    ctx.fillStyle = accent;
    roundRect(ctx, rX + 14, resumeBoxY + padTop, 3, resumeBoxH - padTop * 2, 2);
    ctx.fill();
    // Titre de l'encart.
    ctx.textAlign = "left";
    ctx.fillStyle = fgMuted;
    ctx.font = `600 10px ${font}`;
    ctx.fillText("RÉSUMÉ DU FILTRE", rX + 28, resumeBoxY + padTop + 11);
    // Lignes de résumé.
    ctx.fillStyle = fgStrong;
    ctx.font = `12px ${font}`;
    resumeLines.forEach((ligne, i) => {
      ctx.fillText(ligne, rX + 28, resumeBoxY + padTop + labelH + 12 + i * lineH);
    });
  }

  // Pied de page
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  const noteFiltre =
    highlight.size > 0
      ? `${highlight.size} mois sélectionné${highlight.size > 1 ? "s" : ""} (filtre de la liste) · `
      : "";
  ctx.fillText(`${noteFiltre}Exporté le ${new Date().toLocaleDateString("fr-FR")}`, plotLeft, H - 22);

  void accentSoft;
  return canvas;
}

/**
 * Suffixe de plage « AAAA-MM » (ou « AAAA-MM_AAAA-MM ») à partir d'une liste de mois triée.
 * Renvoie une chaîne vide quand aucun mois n'est sélectionné.
 */
export function suffixePlagePng(cles: string[]): string {
  const tries = [...cles].filter(Boolean).sort();
  if (tries.length === 0) return "";
  return tries.length === 1 ? `-${tries[0]}` : `-${tries[0]}_${tries[tries.length - 1]}`;
}

/**
 * Nom du fichier PNG exporté depuis le mini-graphe des alertes. Sert à la fois au téléchargement
 * réel et à l'aperçu affiché au survol du bouton « Exporter PNG », pour vérifier le format avant
 * de télécharger. Quand `plageDansNom` est désactivé, la plage de mois n'apparaît pas dans le nom.
 */
export function nomFichierPngAlertes(cles: string[], plageDansNom = true, dateISO: string = todayISO()): string {
  const suffixePlage = plageDansNom ? suffixePlagePng(cles) : "";
  return `alertes-artisan-par-mois${suffixePlage}-${dateISO}.png`;
}

/**
 * Génère l'image PNG du mini-graphe des alertes sous forme de Blob, sans déclencher de
 * téléchargement : utile pour l'export combiné (archive ZIP réunissant le CSV et le PNG de la
 * sélection de mois). Renvoie `null` si la liste des mois est vide ou le canvas indisponible.
 */
export function creerAlertesChartBlob(
  mois: AlerteChartMois[],
  options: AlerteChartImageOptions = {},
): Promise<Blob | null> {
  const canvas = drawAlertesChart(mois, options);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Dessine le mini-graphe des alertes artisan et déclenche le téléchargement d'une image PNG,
 * pour archiver la tendance mensuelle. Les mois filtrés sont mis en évidence dans l'image, et le
 * résumé copiable de la sélection y est repris quand un filtre de mois est actif.
 */
export function exportAlertesChartImage(mois: AlerteChartMois[], options: AlerteChartImageOptions = {}): void {
  const canvas = drawAlertesChart(mois, options);
  if (!canvas) return;
  // Nom du fichier : plage « AAAA-MM » quand un filtre est actif et que le réglage « plage dans le
  // nom » est activé (même calcul que l'aperçu affiché au survol du bouton).
  const nomFichier = nomFichierPngAlertes(options.highlightCles ?? [], options.plageDansNom !== false);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}