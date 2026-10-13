import type { ReprogrammationItem } from "@/lib/artisanApi";
import { formatShortDate } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

interface Props {
  loading: boolean;
  error: string | null;
  rows: ReprogrammationItem[];
  onExport: () => void;
  onClose: () => void;
}

/** Modale de l'historique des reprogrammations d'une relance (avec export CSV). */
export default function HistoriqueReproModal({ loading, error, rows, onExport, onClose }: Props) {
  return (
    <Modal title="Historique des reports" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-foreground-500 flex items-center gap-2">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-foreground-500">Aucun report enregistré pour cette relance.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-foreground-500">{rows.length} report(s) enregistré(s).</p>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              title="Télécharger l'historique au format CSV"
            >
              <i className="ri-download-2-line"></i>
              Exporter en CSV
            </button>
          </div>
          <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {rows.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200"
              >
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <i className="ri-calendar-line"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground-800">
                    {h.ancienne_date ? formatShortDate(h.ancienne_date) : "Sans date"}
                    <i className="ri-arrow-right-line mx-1.5 text-foreground-400"></i>
                    <strong>{h.nouvelle_date ? formatShortDate(h.nouvelle_date) : "Sans date"}</strong>
                  </p>
                  <p className="text-[11px] text-foreground-500">Repoussée le {formatShortDate(h.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}