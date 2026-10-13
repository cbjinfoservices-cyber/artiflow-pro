import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { RemplacementChartDatum } from "@/lib/remplacementsChartImage";
import { SEUILS_REMPLACEMENTS } from "@/lib/remplacementsSeuil";
import { CHART_PERIODES, moisCleLabel, type ChartMois } from "./remplacementsUi";

/** Mois « record » de la période (total le plus élevé) et ses clés. */
export interface RecordMois {
  max: number;
  cles: string[];
}

interface RemplacementsChartProps {
  /** Données du mini-graphe (un point par mois de la période choisie). */
  chartMoisData: RemplacementChartDatum[];
  /** Total de renvois le plus élevé de la période (borne haute des barres). */
  maxChart: number;
  /** Total de renvois sur toute la période. */
  chartTotal: number;
  /** Période affichée (3 / 6 / 12 mois). */
  chartMois: ChartMois;
  onChartMois: (n: ChartMois) => void;
  /** Seuil sous lequel un mois est jugé « faible ». */
  seuilRemp: number;
  onChangeSeuil: (n: number) => void;
  /** Nombre de mois de la période sous le seuil. */
  nbSousSeuil: number;
  filtreSousSeuil: boolean;
  onBasculerFiltreSousSeuil: () => void;
  /** Mois épinglés « à surveiller » (repères permanents sur leurs barres). */
  moisEpingles: string[];
  /**
   * Mois épinglés dans l'ordre de rang affiché à l'écran (tri courant : priorité manuelle ou
   * chrono), pour numéroter les pastilles « N/total » des barres exactement comme les exports
   * (PDF / PNG). Repli sur `moisEpingles` si non fourni.
   */
  moisEpinglesRang?: string[];
  onBasculerEpinglageMois: (cle: string) => void;
  /** Mois en cours de glisser-déposer dans le mini-graphe (réordonnancement de priorité). */
  dragMois: string | null;
  onDragMoisStart: (cle: string) => void;
  onDragMoisEnd: () => void;
  /** Dépose un mois épinglé (glissé) sur la barre d'un autre, pour réordonner la priorité. */
  onDropMois: (cle: string) => void;
  /** Déplace un mois épinglé d'un cran (flèches haut / bas des barres épinglées). */
  onDeplacerMois: (cle: string, direction: -1 | 1) => void;
  /** Remonte un mois épinglé en tête de surveillance d'un seul clic (flèche double de la barre). */
  onMonterMoisEnTete: (cle: string) => void;
  onToutDetacher: () => void;
  onEpinglerSousSeuil: () => void;
  /** Mois record de la période (pic d'activité). */
  recordMois: RecordMois;
  recordMoisLabel: string;
  onEpinglerRecord: () => void;
  /** Épingle le mois le plus faible de la période (le creux d'activité). */
  onEpinglerFaible: () => void;
  /** Mois le plus faible de la période (creux d'activité). */
  moisPlusFaible: RemplacementChartDatum | null;
  onOuvrirPlusFaible: () => void;
  /** Ouvre la comptabilité filtrée sur un mois précis (clic sur la ligne de l'infobulle). */
  onOuvrirMoisFaible: (cle: string) => void;
  /** Mémorise un mois ouvert au clavier (Entrée sur une barre) pour le reproposer depuis l'en-tête. */
  onConsultClavier: (cle: string) => void;
  onExportCsv: () => void;
  onExportPng: () => void;
  onExportPngFaible: () => void;
  /** Export PNG « historique » (empile les derniers mois faibles consultés). */
  onExportHistorique: () => void;
  /** Nombre de mois faibles mémorisés (conditionne l'affichage du bouton historique). */
  nbHistoriqueFaible: number;
  /** Mois actuellement filtré dans la liste (barre active). */
  filtreMois: string;
  onBarClick: (cle: string) => void;
  pulseFaible: string | null;
  pulseMois: string | null;
  survolMois: string | null;
  onSurvolMois: (cle: string | null) => void;
}

/**
 * Mini-graphe « Renvois par mois » de la vue Remplacements : barres empilées journal / bilan par
 * mois, repères permanents des mois épinglés, mise en évidence du mois record et du mois le plus
 * faible, infobulle au survol (dont la ligne « Mois le plus faible » cliquable), et exports
 * CSV / PNG (dont un PNG « historique » des derniers mois faibles consultés).
 */
export default function RemplacementsChart({
  chartMoisData,
  maxChart,
  chartTotal,
  chartMois,
  onChartMois,
  seuilRemp,
  onChangeSeuil,
  nbSousSeuil,
  filtreSousSeuil,
  onBasculerFiltreSousSeuil,
  moisEpingles,
  moisEpinglesRang,
  onBasculerEpinglageMois,
  dragMois,
  onDragMoisStart,
  onDragMoisEnd,
  onDropMois,
  onDeplacerMois,
  onMonterMoisEnTete,
  onToutDetacher,
  onEpinglerSousSeuil,
  recordMois,
  recordMoisLabel,
  onEpinglerRecord,
  onEpinglerFaible,
  moisPlusFaible,
  onOuvrirPlusFaible,
  onOuvrirMoisFaible,
  onConsultClavier,
  onExportCsv,
  onExportPng,
  onExportPngFaible,
  onExportHistorique,
  nbHistoriqueFaible,
  filtreMois,
  onBarClick,
  pulseFaible,
  pulseMois,
  survolMois,
  onSurvolMois,
}: RemplacementsChartProps) {
  // Délai de fermeture de l'infobulle : laisse le temps d'atteindre la ligne cliquable
  // « Mois le plus faible » sans que la bulle ne disparaisse avant.
  const hideTimer = useRef<number | null>(null);
  // Navigation clavier des barres : index de la barre focus (roving tabindex type « toolbar »),
  // calqué sur le mini-graphe de tendance de « Santé du compte ».
  const [barFocus, setBarFocus] = useState(() => {
    const idx = chartMoisData.findIndex((m) => m.total > 0);
    return idx >= 0 ? idx : 0;
  });
  const barRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Survol du mini-graphe : affiche l'infobulle « barre au clavier » rappelant le raccourci Entrée.
  const [survolGraphe, setSurvolGraphe] = useState(false);
  const ouvrirSurvol = (cle: string) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    onSurvolMois(cle);
  };
  const planifierFermeture = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      onSurvolMois(null);
      hideTimer.current = null;
    }, 320);
  };
  // Ordre de rang affiché sur les barres (tri courant) : on numérote les pastilles « N/total » comme
  // les exports (PDF / PNG), en se repliant sur l'ordre brut d'épinglage si l'ordre trié n'est pas fourni.
  const ordreRang = moisEpinglesRang && moisEpinglesRang.length > 0 ? moisEpinglesRang : moisEpingles;

  /** Déplace le focus clavier vers la barre voulue, en sautant les mois sans renvoi (désactivés). */
  const focusBar = (target: number, dir: 1 | -1) => {
    const n = chartMoisData.length;
    if (n === 0) return;
    let cible = Math.max(0, Math.min(n - 1, target));
    while (cible >= 0 && cible < n && chartMoisData[cible].total === 0) cible += dir;
    if (cible < 0 || cible >= n) return;
    setBarFocus(cible);
    barRefs.current[cible]?.focus();
  };

  /** Navigation clavier : flèches pour changer de mois, Entrée/Espace pour ouvrir la comptabilité filtrée. */
  const onBarKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number, cle: string) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusBar(index + 1, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusBar(index - 1, -1);
        break;
      case "Home":
        e.preventDefault();
        focusBar(0, 1);
        break;
      case "End":
        e.preventDefault();
        focusBar(chartMoisData.length - 1, -1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        // Ouverture au clavier : on mémorise ce mois pour le reproposer en « Reprendre » dans l'en-tête.
        onConsultClavier(cle);
        onBarClick(cle);
        break;
      default:
        break;
    }
  };

  return (
    <div className="rounded-md bg-background-50 border border-background-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className="ri-bar-chart-2-line"></i>
          Renvois par mois
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary-500"></span>
            Journal
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary-500"></span>
            Bilan
          </span>
          {nbSousSeuil > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-secondary-600 to-secondary-200"></span>
              Sous le seuil
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background-200 text-foreground-700 font-semibold whitespace-nowrap text-[10px]">
            <strong className="text-foreground-800">{chartTotal}</strong> renvoi{chartTotal > 1 ? "s" : ""}
          </span>
          {/* Seuil de renvois réglable : sous ce seuil, un mois est jugé « faible » (filtre du graphe) */}
          <label
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap"
            title="Un mois dont le total de renvois est sous ce seuil est considéré « sous le seuil »"
          >
            <i className="ri-filter-3-line"></i>
            <span className="text-foreground-400">Seuil</span>
            <select
              value={seuilRemp}
              onChange={(e) => onChangeSeuil(Number(e.target.value))}
              className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
            >
              {SEUILS_REMPLACEMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                nbSousSeuil > 0 ? "bg-secondary-500 text-background-50" : "bg-background-200 text-foreground-500"
              }`}
              title={
                nbSousSeuil > 0
                  ? `${nbSousSeuil} mois sous le seuil de ${seuilRemp} renvoi${seuilRemp > 1 ? "s" : ""}`
                  : `Aucun mois sous le seuil de ${seuilRemp} renvoi${seuilRemp > 1 ? "s" : ""}`
              }
              aria-label={
                nbSousSeuil > 0
                  ? `${nbSousSeuil} mois sous le seuil de ${seuilRemp} renvois`
                  : `Aucun mois sous le seuil de ${seuilRemp} renvois`
              }
            >
              {nbSousSeuil}
            </span>
          </label>
          <button
            type="button"
            onClick={onBasculerFiltreSousSeuil}
            aria-pressed={filtreSousSeuil}
            title={
              filtreSousSeuil
                ? `Filtre actif : n'éclaire que les ${nbSousSeuil} mois sous ${seuilRemp} renvoi${seuilRemp > 1 ? "s" : ""}`
                : `N'éclairer que les mois sous le seuil (${nbSousSeuil})`
            }
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filtreSousSeuil
                ? "bg-secondary-500 border-secondary-500 text-background-50 hover:bg-secondary-600"
                : "bg-background-50 border-background-200 text-foreground-700 hover:border-accent-300"
            }`}
          >
            <i className="ri-filter-3-line"></i>
            Sous le seuil
          </button>
          {/* Épingler d'un clic tous les mois à faible activité (sous le seuil), pour les
              surveiller d'un seul geste sans les épingler un par un. */}
          {nbSousSeuil > 0 && (
            <button
              type="button"
              onClick={onEpinglerSousSeuil}
              title={`Épingler à surveiller les ${nbSousSeuil} mois sous le seuil de ${seuilRemp} renvoi${seuilRemp > 1 ? "s" : ""}`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-200 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 hover:bg-secondary-100 transition-colors"
            >
              <i className="ri-pushpin-2-line"></i>
              Épingler sous le seuil
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-bold">
                {nbSousSeuil}
              </span>
            </button>
          )}
          {/* Épingler d'un clic le(s) mois « record » (le pic d'activité de la période), pour
              le surveiller d'un seul geste — à côté du raccourci « sous le seuil ». */}
          {recordMois.max > 0 && (
            <button
              type="button"
              onClick={onEpinglerRecord}
              title={`Épingler à surveiller le mois record de la période (${recordMoisLabel} · ${recordMois.max} renvoi${recordMois.max > 1 ? "s" : ""})`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-accent-200 text-[10px] font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:border-accent-400 hover:bg-accent-100 transition-colors"
            >
              <i className="ri-award-line"></i>
              Épingler le mois record
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold">
                {recordMois.cles.length}
              </span>
            </button>
          )}
          {/* Épingle d'un clic le mois le plus faible de la période (le creux), pour le surveiller
              d'un seul geste — juste à côté du raccourci « Épingler le mois record ». */}
          {moisPlusFaible && (
            <button
              type="button"
              onClick={onEpinglerFaible}
              title={`Épingler à surveiller le mois le plus faible de la période (${moisCleLabel(moisPlusFaible.cle)} · ${moisPlusFaible.total} renvoi${moisPlusFaible.total > 1 ? "s" : ""})`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-200 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 hover:bg-secondary-100 transition-colors"
            >
              <i className="ri-pushpin-2-line"></i>
              Épingler le mois faible
            </button>
          )}
          {/* Ouvre d'un clic le mois à plus faible activité de la période (le creux),
              pour sauter directement à ses pièces dans la liste filtrée. */}
          {moisPlusFaible && (
            <button
              type="button"
              onClick={onOuvrirPlusFaible}
              title={`Ouvrir la comptabilité filtrée sur le mois le plus faible de la période (${moisCleLabel(moisPlusFaible.cle)} · ${moisPlusFaible.total} renvoi${moisPlusFaible.total > 1 ? "s" : ""})`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-200 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 hover:bg-secondary-100 transition-colors"
            >
              <i className="ri-arrow-down-circle-line"></i>
              Ouvrir le mois le plus faible
            </button>
          )}
          {/* Détacher d'un coup tous les repères « à surveiller » posés sur le mini-graphe */}
          {moisEpingles.length > 0 && (
            <button
              type="button"
              onClick={onToutDetacher}
              title={`Retirer d'un coup les ${moisEpingles.length} repère(s) « à surveiller » du mini-graphe`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-800 transition-colors"
            >
              <i className="ri-pushpin-2-line"></i>
              Tout détacher
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-bold">
                {moisEpingles.length}
              </span>
            </button>
          )}
          {/* Export du mini-graphe (période choisie), à archiver avec le PDF des remplacements */}
          <button
            type="button"
            onClick={onExportCsv}
            title="Exporter le graphe (période choisie) en CSV, à archiver avec le PDF des remplacements"
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className="ri-file-text-line"></i>
            CSV
          </button>
          <button
            type="button"
            onClick={onExportPng}
            title="Exporter le graphe (période choisie) en PNG, à archiver avec le PDF des remplacements"
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className="ri-image-line"></i>
            PNG
          </button>
          {/* Export PNG dédié : même graphe, mais avec la barre du mois le plus faible mise en
              évidence (dégradé secondary + anneau), pour l'archiver d'un coup d'œil. */}
          {moisPlusFaible && (
            <button
              type="button"
              onClick={onExportPngFaible}
              title={`Exporter en PNG le graphe avec la barre du mois le plus faible mise en évidence (${moisCleLabel(moisPlusFaible.cle)})`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-100 border border-secondary-200 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors"
            >
              <i className="ri-image-line"></i>
              PNG mois faible
            </button>
          )}
          {/* Export PNG « historique » : empile les derniers mois faibles consultés dans une seule image */}
          {nbHistoriqueFaible > 0 && (
            <button
              type="button"
              onClick={onExportHistorique}
              title={`Exporter en PNG les ${Math.min(nbHistoriqueFaible, 3)} derniers mois faibles consultés, empilés dans une seule image`}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-100 border border-secondary-200 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors"
            >
              <i className="ri-history-line"></i>
              PNG historique
            </button>
          )}
          {/* Période du mini-graphe : 3 / 6 / 12 mois, mémorisée comme le tri */}
          <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200 w-fit">
            {CHART_PERIODES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChartMois(n)}
                title={`Afficher les ${n} derniers mois`}
                aria-pressed={chartMois === n}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  chartMois === n ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {n} mois
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="relative flex items-end gap-2 h-24"
        role="toolbar"
        onMouseEnter={() => setSurvolGraphe(true)}
        onMouseLeave={() => setSurvolGraphe(false)}
        aria-label="Renvois par mois : au clavier, déplacez-vous avec les flèches puis Entrée pour ouvrir la comptabilité filtrée sur le mois"
      >
        {/* Infobulle « barre au clavier » : rappelle le raccourci Entrée au survol du mini-graphe
            (masquée dès qu'une barre précise est survolée, pour ne pas doubler son infobulle). */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-950/90 text-background-50 text-[10px] font-semibold whitespace-nowrap transition-opacity duration-150 ${
            survolGraphe && !survolMois ? "opacity-100" : "opacity-0"
          }`}
        >
          <i className="ri-keyboard-line"></i>
          Au clavier : flèches puis Entrée pour ouvrir
        </span>
        {chartMoisData.map((m, i) => {
          const h = Math.max((m.total / maxChart) * 100, m.total > 0 ? 8 : 3);
          const jH = m.total ? (m.journal / m.total) * 100 : 0;
          const bH = m.total ? (m.bilan / m.total) * 100 : 0;
          const actif = filtreMois === m.cle;
          const estRecord = recordMois.max > 0 && m.total === recordMois.max;
          const estEpingle = moisEpingles.includes(m.cle);
          // Position du mois dans l'ordre de priorité de la surveillance (0 = le plus prioritaire),
          // pour afficher son petit numéro et activer/désactiver les flèches de réordonnancement.
          const idxEpingle = estEpingle ? moisEpingles.indexOf(m.cle) : -1;
          const idxRang = estEpingle ? ordreRang.indexOf(m.cle) : -1;
          const dernierEpingle = idxEpingle === moisEpingles.length - 1;
          // Filtre « sous le seuil » : estompe les mois qui ne sont pas à faible activité.
          const estompe = filtreSousSeuil && m.total >= seuilRemp;
          // Mois à faible activité (sous le seuil) : sa barre prend un dégradé secondary pour
          // le repérer d'un coup d'œil, même sans activer le filtre « sous le seuil ».
          const sousSeuil = m.total > 0 && m.total < seuilRemp;
          return (
            <div
              key={m.cle}
              draggable={estEpingle}
              onDragStart={estEpingle ? () => onDragMoisStart(m.cle) : undefined}
              onDragEnd={estEpingle ? onDragMoisEnd : undefined}
              onDragOver={estEpingle ? (e) => e.preventDefault() : undefined}
              onDrop={estEpingle ? () => onDropMois(m.cle) : undefined}
              className={`relative flex-1 min-w-0 flex flex-col items-stretch justify-end group/bar ${
                dragMois === m.cle ? "opacity-60" : ""
              }`}
            >
              {/* Repère « à surveiller » : bouton-épingle permanent sur le mois épinglé,
                  calqué sur la semaine épinglée du mini-graphe de tendance de la santé. */}
              {m.total > 0 && (
                <button
                  type="button"
                  onClick={() => onBasculerEpinglageMois(m.cle)}
                  aria-pressed={estEpingle}
                  title={
                    estEpingle
                      ? `Retirer le repère « à surveiller » de ${moisCleLabel(m.cle)}`
                      : `Épingler ${moisCleLabel(m.cle)} à surveiller (repère permanent sur sa barre)`
                  }
                  className={`absolute top-0 left-0 z-30 w-4 h-4 flex items-center justify-center rounded-full ring-1 ring-background-50 cursor-pointer transition-opacity ${
                    estEpingle
                      ? "bg-secondary-500 text-background-50 opacity-100 hover:bg-secondary-600"
                      : "bg-background-200 text-foreground-600 opacity-0 group-hover/bar:opacity-100 focus-visible:opacity-100 hover:bg-secondary-200"
                  }`}
                >
                  <i className={estEpingle ? "ri-pushpin-2-fill text-[9px]" : "ri-pushpin-2-line text-[9px]"}></i>
                </button>
              )}
              {/* Mois épinglé : petit rang de surveillance « N/total » (1 = le plus prioritaire) posé
                  sur la barre, et commandes de réordonnancement au survol (glisser la barre ou
                  flèches), sans quitter le mini-graphe. */}
              {estEpingle && idxEpingle >= 0 && (
                <>
                  <span
                    className="absolute top-0 right-0 z-30 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-secondary-500 text-background-50 ring-1 ring-background-50 text-[9px] font-bold pointer-events-none"
                    title={`Rang de surveillance ${idxRang + 1}/${ordreRang.length} — glissez la barre pour réordonner`}
                  >
                    {idxRang + 1}/{ordreRang.length}
                  </span>
                  <span className="absolute top-[18px] right-0 z-40 flex flex-col items-center rounded-md border border-background-200 bg-background-50/95 overflow-hidden opacity-0 pointer-events-none transition-opacity group-hover/bar:opacity-100 group-hover/bar:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => onMonterMoisEnTete(m.cle)}
                      disabled={idxEpingle === 0}
                      title={idxEpingle === 0 ? "Déjà en tête de surveillance" : `Monter ${moisCleLabel(m.cle)} en tête de surveillance`}
                      aria-label={`Monter ${moisCleLabel(m.cle)} en tête`}
                      className="inline-flex items-center justify-center w-4 h-4 text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-secondary-100 hover:text-secondary-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-up-double-line text-[10px]"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeplacerMois(m.cle, -1)}
                      disabled={idxEpingle === 0}
                      title={idxEpingle === 0 ? "Déjà en tête de surveillance" : `Rendre ${moisCleLabel(m.cle)} plus prioritaire`}
                      aria-label={`Rendre ${moisCleLabel(m.cle)} plus prioritaire`}
                      className="inline-flex items-center justify-center w-4 h-4 border-t border-background-200 text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-secondary-100 hover:text-secondary-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-up-s-line text-[10px]"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeplacerMois(m.cle, 1)}
                      disabled={dernierEpingle}
                      title={dernierEpingle ? "Déjà en bas de la surveillance" : `Rendre ${moisCleLabel(m.cle)} moins prioritaire`}
                      aria-label={`Rendre ${moisCleLabel(m.cle)} moins prioritaire`}
                      className="inline-flex items-center justify-center w-4 h-4 border-t border-background-200 text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-secondary-100 hover:text-secondary-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-down-s-line text-[10px]"></i>
                    </button>
                  </span>
                </>
              )}
              <button
                type="button"
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                tabIndex={i === barFocus ? 0 : -1}
                onClick={() => onBarClick(m.cle)}
                onKeyDown={(e) => onBarKeyDown(e, i, m.cle)}
                onMouseEnter={() => ouvrirSurvol(m.cle)}
                onMouseLeave={planifierFermeture}
                onFocus={() => {
                  setBarFocus(i);
                  ouvrirSurvol(m.cle);
                }}
                onBlur={planifierFermeture}
                disabled={m.total === 0}
                aria-pressed={actif}
                aria-label={`${moisCleLabel(m.cle)} : ${m.journal} journal${m.journal > 1 ? "x" : ""}, ${m.bilan} bilan${m.bilan > 1 ? "s" : ""}`}
                className={`relative w-full flex flex-col items-center gap-1 min-w-0 rounded-md pt-0.5 transition-all disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                  estompe ? "opacity-25 " : ""
                }${
                  actif
                    ? "bg-accent-100 ring-1 ring-accent-400"
                    : estEpingle
                      ? "ring-2 ring-secondary-400 cursor-pointer hover:bg-background-100"
                      : "cursor-pointer hover:bg-background-100"
                }${pulseFaible === m.cle ? " animate-mois-faible-highlight" : pulseMois === m.cle ? " animate-mois-highlight" : ""}`}
              >
                {/* Badge « record » : marque visiblement le(s) mois le plus actif(s) de la période */}
                {estRecord && m.total > 0 && (
                  <span
                    className="absolute -top-1.5 right-0.5 z-20 w-4 h-4 flex items-center justify-center rounded-full bg-accent-500 text-background-50 ring-1 ring-background-50"
                    title={`Mois record : ${recordMois.max} renvoi${recordMois.max > 1 ? "s" : ""}`}
                  >
                    <i className="ri-award-line text-[9px]"></i>
                  </span>
                )}
                {/* Infobulle au survol : détail du mois + rappel du mois « record » de la période.
                    La ligne « Mois le plus faible » est cliquable pour ouvrir la compta filtrée
                    sur ce mois (un léger délai de fermeture laisse le temps de l'atteindre). */}
                {survolMois === m.cle && m.total > 0 && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 z-30 w-48 pb-2 pointer-events-none">
                    <span className="block p-2 rounded-md bg-foreground-950 text-background-50 text-[10px] leading-snug text-left">
                      <span className="block font-semibold text-[11px]">{moisCleLabel(m.cle)}</span>
                      <span className="block mt-1 text-background-50/90">
                        <i className="ri-calendar-schedule-line"></i> {m.journal} journal{m.journal > 1 ? "x" : ""} ·
                        <i className="ri-archive-drawer-line"></i> {m.bilan} bilan{m.bilan > 1 ? "s" : ""}
                      </span>
                      <span className="block mt-1 font-bold">
                        {m.total} renvoi{m.total > 1 ? "s" : ""}
                      </span>
                      <span className="block mt-1 pt-1 border-t border-background-50/20 text-background-50/90">
                        {estRecord
                          ? `Record de la période : ${recordMois.max} renvoi${recordMois.max > 1 ? "s" : ""}`
                          : `Record : ${recordMoisLabel} (${recordMois.max})`}
                      </span>
                      {/* Repère du mois le plus faible de la période : sur sa propre barre c'est une
                          simple note, sur les autres une ligne cliquable qui ouvre ce mois filtré. */}
                      {moisPlusFaible &&
                        (m.cle === moisPlusFaible.cle ? (
                          <span className="block mt-0.5 text-secondary-200 font-semibold">
                            <i className="ri-arrow-down-circle-line"></i> Mois le plus faible de la période
                          </span>
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onMouseEnter={() => ouvrirSurvol(m.cle)}
                            onFocus={() => ouvrirSurvol(m.cle)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOuvrirMoisFaible(moisPlusFaible.cle);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                onOuvrirMoisFaible(moisPlusFaible.cle);
                              }
                            }}
                            title={`Ouvrir la comptabilité filtrée sur ${moisCleLabel(moisPlusFaible.cle)}`}
                            className="pointer-events-auto mt-0.5 inline-flex items-center gap-1 text-background-50/80 hover:text-secondary-200 font-semibold cursor-pointer underline decoration-dotted underline-offset-2"
                          >
                            <i className="ri-arrow-down-circle-line"></i>
                            Mois le plus faible : {moisCleLabel(moisPlusFaible.cle)} ({moisPlusFaible.total})
                          </span>
                        ))}
                      <span className="block mt-0.5 text-background-50/60 italic">
                        {sousSeuil
                          ? "Cliquer pour ouvrir la comptabilité filtrée sur ce mois faible"
                          : "Cliquer pour ouvrir la comptabilité filtrée sur ce mois"}
                      </span>
                    </span>
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold ${m.total > 0 ? "text-foreground-600" : "text-foreground-300"}`}
                >
                  {m.total > 0 ? m.total : ""}
                </span>
                <div
                  className={`w-full flex flex-col justify-end rounded-t-md overflow-hidden ${
                    sousSeuil
                      ? "bg-gradient-to-t from-secondary-600 via-secondary-500 to-secondary-200"
                      : "bg-background-200/50"
                  }`}
                  style={{ height: `${h}%` }}
                >
                  {sousSeuil ? (
                    <span className="w-full h-full" aria-hidden="true"></span>
                  ) : (
                    <>
                      {jH > 0 && <div className="w-full bg-primary-500" style={{ height: `${jH}%` }}></div>}
                      {bH > 0 && <div className="w-full bg-secondary-500" style={{ height: `${bH}%` }}></div>}
                    </>
                  )}
                </div>
                <span
                  className={`text-[10px] whitespace-nowrap ${
                    actif ? "text-accent-700 font-semibold" : "text-foreground-400"
                  }`}
                >
                  {m.court}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-foreground-400 flex items-center gap-1">
        <i className="ri-cursor-line"></i>
        Cliquez une barre pour ouvrir la comptabilité filtrée sur ce mois — ou au clavier, déplacez-vous avec les
        flèches puis Entrée.
      </p>
      {moisEpingles.length > 0 && (
        <p className="mt-1.5 text-[10px] text-foreground-400 flex flex-wrap items-center gap-1">
          <i className="ri-pushpin-2-fill text-secondary-600"></i>
          Barre au repère = mois épinglé à surveiller ({moisEpingles.length}), numéroté selon le rangement en cours.
          Survolez une barre épinglée pour la réordonner (glissez-la ou utilisez les flèches, dont « monter en
          tête »), ou cliquez l'épingle pour épingler / retirer le repère.
        </p>
      )}
      {filtreSousSeuil && (
        <p className="mt-0.5 text-[10px] text-foreground-400 flex items-center gap-1">
          <i className="ri-filter-3-line text-secondary-600"></i>
          Filtre « sous le seuil » actif : les {nbSousSeuil} mois sous {seuilRemp} renvoi{seuilRemp > 1 ? "s" : ""}
          restent éclairés, les autres sont estompés.
        </p>
      )}
      {!filtreSousSeuil && nbSousSeuil > 0 && (
        <p className="mt-0.5 text-[10px] text-foreground-400 flex items-center gap-1">
          <i className="ri-filter-3-line text-secondary-600"></i>
          Les {nbSousSeuil} barre{nbSousSeuil > 1 ? "s" : ""} en dégradé secondary correspondent aux mois sous le seuil
          de {seuilRemp} renvoi{seuilRemp > 1 ? "s" : ""} (faible activité), repérables sans activer le filtre.
          Cliquez l'une d'elles pour ouvrir directement la comptabilité filtrée sur ce mois faible.
        </p>
      )}
    </div>
  );
}