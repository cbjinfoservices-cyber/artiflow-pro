import type { LienAuthTestEntree } from "@/lib/liensAuthTestsMemoire";
import { calculerSemainesRegularite, libelleFenetre, nbSemainesFenetre, tendanceGlobale, type FenetreRegularite, type TendanceSemaine } from "@/lib/regulariteLiensAuth";
import { slugAdresse } from "@/lib/recapLiensAuth";
import { todayISO } from "@/lib/dates";

const CHART_W = 820;
const CHART_H = 420;
const CHART_SCALE = 2;

/** Totaux du périmètre courant (filtres actifs) repris dans le sous-titre de l'image PNG. */
export interface PerimetrePng {
  /** Nombre d'essais du périmètre courant (semaine, type, adresse et tendance filtrés). */
  total: number;
  /** Libellé du périmètre courant (type + filtre de tendance), affiché entre parenthèses. */
  libelle: string;
  /**
   * Tendance du périmètre courant (filtre de tendance actif, sinon tendance de la fenêtre),
   * reprise telle quelle du bandeau à l'écran pour que l'image y soit identique.
   */
  tendance?: TendanceSemaine | null;
}

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
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Dessine le graphique de régularité des liens d'authentification (essais relancés par semaine,
 * sur la fenêtre choisie) sur un canvas hors écran : titre, sous-titre, histogramme aux couleurs du
 * thème, et mise en évidence de la semaine filtrée. Quand la fenêtre « Tous » produit beaucoup de
 * barres, l'échelle et les libellés s'adaptent pour rester lisibles. Le sous-titre reprend aussi le
 * total du périmètre courant (filtres actifs, tendance comprise) quand il est fourni. Tout est dessiné
 * à la main, sans dépendance externe. Renvoie le canvas prêt à exporter, ou null si le canvas est
 * indisponible.
 */
function drawRegularite(
  entrees: LienAuthTestEntree[],
  semaineSelectionnee: number | null,
  fenetre: FenetreRegularite,
  adresse: string | null = null,
  perimetre: PerimetrePng | null = null,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;

  const nbSemaines = nbSemainesFenetre(fenetre, entrees);
  const semaines = calculerSemainesRegularite(entrees, nbSemaines);
  const W = CHART_W;
  const H = CHART_H;
  const scale = CHART_SCALE;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);

  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const bg = paletteVar("--background-50", "#ffffff");
  const fgStrong = paletteVar("--foreground-950", "#141414");
  const fgMuted = paletteVar("--foreground-500", "#7a7a7a");
  const fgFaint = paletteVar("--foreground-300", "#c7c7c7");
  const track = paletteVar("--background-200", "#ededed");
  const border = paletteVar("--background-200", "#e6e6e6");
  const accent = paletteVar("--accent-500", "#b0762e");
  const primary = paletteVar("--primary-500", "#8a5a2b");
  const primaryDark = paletteVar("--primary-700", "#5f3c18");

  // Fond
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Titre + sous-titre
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgStrong;
  ctx.font = `600 18px ${font}`;
  ctx.fillText("Régularité des liens d'authentification", 36, 46);

  const total = semaines.reduce((acc, s) => acc + s.count, 0);
  ctx.fillStyle = fgMuted;
  ctx.font = `13px ${font}`;
  const contexte = adresse ? ` · adresse : ${adresse}` : "";
  // Indicateur global de tendance repris du graphique : sens de la fenêtre + décompte hausse/baisse,
  // complété par le ratio « X en hausse / Y » (Y = semaines comparables, hors la première).
  const synthese = tendanceGlobale(semaines);
  const nbComparables = Math.max(0, semaines.length - 1);
  const tendanceTxt =
    semaines.length >= 2
      ? ` · ${
          synthese.sens === "hausse"
            ? "Tendance en hausse"
            : synthese.sens === "baisse"
              ? "Tendance en baisse"
              : "Tendance stable"
        } (▲${synthese.hausses} ▼${synthese.baisses}) · ${synthese.hausses} en hausse / ${nbComparables}`
      : "";
  // Total du périmètre courant (filtres actifs : semaine, type, adresse et tendance) : repris du
  // récap copiable pour que l'image rende compte de la sélection réelle, pas seulement de la fenêtre.
  const perimetreTxt = perimetre
    ? ` · périmètre courant : ${perimetre.total} essai${perimetre.total > 1 ? "s" : ""} (${perimetre.libelle}) · tendance : ${
        perimetre.tendance === "hausse"
          ? "en hausse"
          : perimetre.tendance === "baisse"
            ? "en baisse"
            : "stable"
      }`
    : "";
  ctx.fillText(
    `${libelleFenetre(fenetre)}${contexte} · ${total} essai${total > 1 ? "s" : ""} sur la période${tendanceTxt}${perimetreTxt}`,
    36,
    70,
  );

  // Zone de tracé
  const plotLeft = 36;
  const plotRight = W - 36;
  const plotTop = 118;
  const plotBottom = H - 60;
  const plotH = plotBottom - plotTop;

  const max = Math.max(1, ...semaines.map((s) => s.count));
  const n = semaines.length;
  // Beaucoup de barres (fenêtre « Tous ») : espacement plus serré, valeurs et libellés filtrés.
  const dense = n > 12;
  const gap = dense ? 4 : 18;
  const barW = Math.max(2, Math.min(90, (plotRight - plotLeft - gap * (n - 1)) / n));
  const totalW = barW * n + gap * (n - 1);
  const startX = plotLeft + Math.max(0, (plotRight - plotLeft - totalW) / 2);
  const labelStep = n > 14 ? Math.ceil(n / 8) : 1;
  const afficherValeurs = n <= 14;

  // Ligne de base
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotBottom + 0.5);
  ctx.lineTo(plotRight, plotBottom + 0.5);
  ctx.stroke();

  semaines.forEach((s, i) => {
    const x = startX + i * (barW + gap);
    const selectionnee = semaineSelectionnee === s.semainesAgo;
    const hauteur = s.count <= 0 ? 4 : Math.max(8, (s.count / max) * plotH);

    // Piste de fond + barre
    ctx.save();
    roundRect(ctx, x, plotTop, barW, plotH, 6);
    ctx.clip();
    ctx.fillStyle = track;
    ctx.fillRect(x, plotTop, barW, plotH);
    if (s.count > 0) {
      ctx.fillStyle = selectionnee ? primaryDark : s.estCourante ? primary : accent;
      ctx.fillRect(x, plotBottom - hauteur, barW, hauteur);
    } else if (selectionnee) {
      ctx.fillStyle = fgFaint;
      ctx.fillRect(x, plotBottom - hauteur, barW, hauteur);
    }
    ctx.restore();

    // Anneau autour de la semaine filtrée.
    if (selectionnee) {
      ctx.strokeStyle = primaryDark;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 1, plotBottom - hauteur - 1, barW - 2, hauteur + 2, 6);
      ctx.stroke();
    }

    // Valeur au-dessus de la barre (masquée quand les barres sont trop serrées).
    if (afficherValeurs) {
      ctx.fillStyle = selectionnee ? primaryDark : fgStrong;
      ctx.font = `600 13px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(String(s.count), x + barW / 2, plotBottom - hauteur - 8);
    }

    // Libellé de la semaine (tous les « labelStep » quand les barres sont denses).
    const montrerLabel = !dense || i % labelStep === 0 || s.estCourante || selectionnee;
    if (montrerLabel) {
      ctx.fillStyle = selectionnee ? primaryDark : fgMuted;
      ctx.font = `12px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(s.estCourante ? "Cette sem." : s.label, x + barW / 2, plotBottom + 22);
    }
  });

  // Pied de page
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fgFaint;
  ctx.font = `10px ${font}`;
  const noteSel = semaineSelectionnee === null ? "" : "Semaine mise en évidence (filtre de la liste) · ";
  ctx.fillText(`${noteSel}Exporté le ${new Date().toLocaleDateString("fr-FR")}`, plotLeft, H - 20);

  return canvas;
}

/**
 * Nom du fichier PNG exporté depuis le graphique de régularité. Quand une semaine est filtrée,
 * son rang (nombre de semaines en arrière) apparaît dans le nom pour retrouver l'export.
 */
export function nomFichierPngRegularite(semainesAgo: number | null = null, dateISO: string = todayISO()): string {
  const suffixe = semainesAgo === null ? "" : `-s${semainesAgo}`;
  return `regularite-liens-auth${suffixe}-${dateISO}.png`;
}

/** Nom du fichier PNG d'un export dédié à une adresse isolée (adresse dans le nom). */
export function nomFichierPngRegulariteAdresse(email: string, dateISO: string = todayISO()): string {
  return `regularite-liens-auth-${slugAdresse(email)}-${dateISO}.png`;
}

/**
 * Génère l'image PNG du graphique de régularité sous forme de Blob, sans déclencher de
 * téléchargement : utile pour joindre le graphique à un récap ou un ticket. Le paramètre
 * `adresse` (facultatif) restreint le graphique à une adresse isolée et l'affiche dans le
 * sous-titre. Renvoie null si le canvas est indisponible.
 */
export function creerRegulariteChartBlob(
  entrees: LienAuthTestEntree[],
  semaineSelectionnee: number | null = null,
  fenetre: FenetreRegularite = "6s",
  adresse: string | null = null,
  perimetre: PerimetrePng | null = null,
): Promise<Blob | null> {
  const canvas = drawRegularite(entrees, semaineSelectionnee, fenetre, adresse, perimetre);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Dessine le graphique de régularité des liens d'authentification et déclenche le téléchargement
 * d'une image PNG, pour l'archiver ou le joindre à un récap ou un ticket. La semaine filtrée est
 * mise en évidence dans l'image le cas échéant.
 */
export function exportRegulariteChartImage(
  entrees: LienAuthTestEntree[],
  semaineSelectionnee: number | null = null,
  fenetre: FenetreRegularite = "6s",
  adresse: string | null = null,
  perimetre: PerimetrePng | null = null,
): void {
  const canvas = drawRegularite(entrees, semaineSelectionnee, fenetre, adresse, perimetre);
  if (!canvas) return;
  const nomFichier = nomFichierPngRegularite(semaineSelectionnee);
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