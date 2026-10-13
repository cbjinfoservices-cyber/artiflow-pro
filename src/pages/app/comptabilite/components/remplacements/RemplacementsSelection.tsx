import type { ComptableRemplacement } from "@/lib/artisanApi";
import { dateHeureLabel, exerciceLabel, natureLabel, SEL_NATURES } from "./remplacementsUi";

interface RecapMois {
  journal: number;
  bilan: number;
  total: number;
  moisLabel: string;
}

interface RemplacementsSelectionProps {
  /** Récap du mois en cours (journaux / bilans renvoyés). */
  recapMois: RecapMois;
  /** Mois record de tout l'historique (pour la pastille « Record »). */
  recordGlobal: { max: number; cles: string[] };
  recordGlobalLabel: string;
  /** Un renvoi en un clic est possible (callback fourni par la page). */
  canRenvoyer: boolean;
  /** Panneau de sélection déplié ou non. */
  selectionOuverte: boolean;
  onToggleSelectionOuverte: () => void;
  /** Pièces cochées (ids). */
  selectionMois: Set<number>;
  /** Pièces renvoyées ce mois-ci. */
  remplacementsDuMois: ComptableRemplacement[];
  /** Renvoi groupé de toutes les pièces du mois. */
  renvoyerTousBusy: boolean;
  renvoyerTousMsg: { ok: boolean; text: string } | null;
  onRenvoyerTousMois: () => void;
  /** Filtres du panneau de sélection. */
  selFiltreNature: "tous" | "journal" | "bilan";
  onSelNature: (key: "tous" | "journal" | "bilan") => void;
  selFiltreAdresse: string;
  onSelAdresse: (value: string) => void;
  adressesMoisDispo: { value: string; label: string }[];
  /** Pièces affichées après application des filtres de sélection. */
  piecesMoisFiltrees: ComptableRemplacement[];
  toutesPiecesFiltreesCochees: boolean;
  onToggleToutes: () => void;
  onEffacerSelFiltres: () => void;
  onTogglePiece: (id: number) => void;
  onExportSelectionPdf: () => void;
  renvoyerSelBusy: boolean;
  renvoyerSelMsg: { ok: boolean; text: string } | null;
  onRenvoyerSelection: () => void;
}

/**
 * Bloc « Ce mois » de la vue Remplacements : récapitulatif des pièces renvoyées ce mois-ci
 * (journaux / bilans), renvoi groupé, et panneau de sélection pour ne renvoyer que les pièces
 * cochées (avec filtres nature / adresse, export PDF de la sélection).
 */
export default function RemplacementsSelection({
  recapMois,
  recordGlobal,
  recordGlobalLabel,
  canRenvoyer,
  selectionOuverte,
  onToggleSelectionOuverte,
  selectionMois,
  remplacementsDuMois,
  renvoyerTousBusy,
  renvoyerTousMsg,
  onRenvoyerTousMois,
  selFiltreNature,
  onSelNature,
  selFiltreAdresse,
  onSelAdresse,
  adressesMoisDispo,
  piecesMoisFiltrees,
  toutesPiecesFiltreesCochees,
  onToggleToutes,
  onEffacerSelFiltres,
  onTogglePiece,
  onExportSelectionPdf,
  renvoyerSelBusy,
  renvoyerSelMsg,
  onRenvoyerSelection,
}: RemplacementsSelectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-background-50 border border-background-200">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className="ri-history-line"></i>
          Ce mois
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold whitespace-nowrap">
          <i className="ri-calendar-schedule-line"></i>
          {recapMois.journal} journal{recapMois.journal > 1 ? "x" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap">
          <i className="ri-archive-drawer-line"></i>
          {recapMois.bilan} bilan{recapMois.bilan > 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-send-plane-line text-accent-600"></i>
          <strong className="text-foreground-700">{recapMois.total}</strong> pièce{recapMois.total > 1 ? "s" : ""}{" "}
          renvoyée{recapMois.total > 1 ? "s" : ""} en {recapMois.moisLabel}
        </span>
        {/* Pastille « Record » : mois le plus actif de tout l'historique, rappelé ici comme
            sur le tableau de bord. */}
        {recordGlobal.max > 0 && (
          <span
            title={`Mois record de votre historique : ${recordGlobalLabel} (${recordGlobal.max} renvoi${recordGlobal.max > 1 ? "s" : ""})`}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap"
          >
            <i className="ri-award-line"></i>
            Record : {recordGlobalLabel} · {recordGlobal.max}
          </span>
        )}
        {canRenvoyer && recapMois.total > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleSelectionOuverte}
              aria-expanded={selectionOuverte}
              title="Choisir les pièces du mois à renvoyer (cases à cocher)"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                selectionOuverte
                  ? "bg-secondary-200 border-secondary-300 text-secondary-900"
                  : "bg-background-50 border-background-200 text-foreground-700 hover:border-secondary-300"
              }`}
            >
              <i className="ri-checkbox-multiple-line"></i>
              Choisir les pièces
              {selectionMois.size > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold">
                  {selectionMois.size}
                </span>
              )}
              <i className={selectionOuverte ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
            </button>
            <button
              type="button"
              onClick={onRenvoyerTousMois}
              disabled={renvoyerTousBusy}
              title={`Renvoyer d'un coup les ${recapMois.total} pièce(s) renvoyée(s) ce mois (journal ou bilan), chacune vers son adresse d'origine`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={renvoyerTousBusy ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
              Renvoyer toutes les pièces du mois
            </button>
          </div>
        )}
      </div>
      {renvoyerTousMsg && (
        <p
          className={`text-[11px] -mt-2 inline-flex items-center gap-1.5 ${
            renvoyerTousMsg.ok ? "text-accent-700" : "text-red-600"
          }`}
        >
          <i className={renvoyerTousMsg.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
          {renvoyerTousMsg.text}
        </p>
      )}

      {/* Sélection des pièces du mois : une case à cocher par pièce, pour ne renvoyer que celles cochées */}
      {selectionOuverte && canRenvoyer && remplacementsDuMois.length > 0 && (
        <div className="flex flex-col gap-2 p-2.5 rounded-md bg-background-50 border border-secondary-200 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-checkbox-multiple-line"></i>
              Pièces renvoyées en {recapMois.moisLabel}
            </span>
            <button
              type="button"
              onClick={onToggleToutes}
              disabled={piecesMoisFiltrees.length === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={toutesPiecesFiltreesCochees ? "ri-checkbox-indeterminate-line" : "ri-checkbox-multiple-line"}></i>
              {toutesPiecesFiltreesCochees ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          {/* Filtre du panneau : par nature (journal / bilan) ou par adresse, pour cocher plus vite */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-md bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-filter-3-line"></i>
              Filtrer
            </span>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-50 border border-background-200 w-fit">
              {SEL_NATURES.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => onSelNature(n.key)}
                  aria-pressed={selFiltreNature === n.key}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    selFiltreNature === n.key
                      ? "bg-secondary-500 text-background-50"
                      : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  <i className={n.icon}></i>
                  {n.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <i className="ri-user-shared-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
              <select
                value={selFiltreAdresse}
                onChange={(e) => onSelAdresse(e.target.value)}
                title="Filtrer les pièces du mois par adresse"
                aria-label="Filtrer les pièces par adresse"
                className="h-7 pl-7 pr-7 rounded-full bg-background-50 border border-background-200 text-[11px] font-medium text-foreground-700 outline-none focus:border-secondary-400 cursor-pointer appearance-none max-w-[200px]"
              >
                <option value="">Toutes les adresses</option>
                {adressesMoisDispo.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none text-xs"></i>
            </div>
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-foreground-600 font-semibold whitespace-nowrap text-[10px]">
              {piecesMoisFiltrees.length} pièce{piecesMoisFiltrees.length > 1 ? "s" : ""}
            </span>
            {(selFiltreNature !== "tous" || selFiltreAdresse) && (
              <button
                type="button"
                onClick={onEffacerSelFiltres}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
              >
                <i className="ri-close-line"></i>
                Effacer
              </button>
            )}
          </div>

          {piecesMoisFiltrees.length === 0 ? (
            <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 py-1">
              <i className="ri-filter-off-line"></i>
              Aucune pièce ne correspond à ce filtre.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {piecesMoisFiltrees.map((r) => {
                const coche = selectionMois.has(r.id);
                return (
                  <li key={r.id}>
                    <label
                      className={`flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer select-none transition-colors ${
                        coche ? "bg-secondary-100" : "hover:bg-background-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() => onTogglePiece(r.id)}
                        className="w-4 h-4 shrink-0 cursor-pointer rounded border-background-300"
                      />
                      <i
                        className={
                          r.type === "bilan"
                            ? "ri-archive-drawer-line text-secondary-600"
                            : "ri-calendar-schedule-line text-primary-600"
                        }
                      ></i>
                      <span className="text-xs font-medium text-foreground-800">{natureLabel(r.type)}</span>
                      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-background-100 border border-background-200 text-foreground-700 font-medium whitespace-nowrap text-[11px]">
                        <i className="ri-folder-line"></i>
                        {exerciceLabel(r.exercice, r.type)}
                      </span>
                      <span className="text-[11px] text-foreground-500 truncate max-w-[220px]" title={r.adresse}>
                        {r.nom ? `${r.nom} · ` : ""}
                        {r.adresse}
                      </span>
                      <span className="ml-auto whitespace-nowrap text-[11px] text-foreground-500">
                        {dateHeureLabel(r.envoye_le)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-background-200">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-information-line"></i>
              {selectionMois.size} pièce{selectionMois.size > 1 ? "s" : ""} sélectionnée{selectionMois.size > 1 ? "s" : ""} ·
              chacune repart vers son adresse d'origine.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExportSelectionPdf}
                disabled={selectionMois.size === 0}
                title="Exporter en PDF uniquement les pièces cochées (à archiver avec le PDF des remplacements)"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className="ri-file-pdf-2-line"></i>
                Exporter la sélection en PDF
              </button>
              <button
                type="button"
                onClick={onRenvoyerSelection}
                disabled={selectionMois.size === 0 || renvoyerSelBusy}
                title="Renvoyer uniquement les pièces cochées, chacune vers son adresse d'origine"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={renvoyerSelBusy ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                Renvoyer la sélection ({selectionMois.size})
              </button>
            </div>
          </div>
          {renvoyerSelMsg && (
            <p
              className={`text-[11px] inline-flex items-center gap-1.5 ${
                renvoyerSelMsg.ok ? "text-accent-700" : "text-red-600"
              }`}
            >
              <i className={renvoyerSelMsg.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
              {renvoyerSelMsg.text}
            </p>
          )}
        </div>
      )}
    </>
  );
}