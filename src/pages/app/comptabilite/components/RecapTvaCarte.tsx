import { formatEuros } from "@/lib/format";
import type { TvaParTaux } from "@/lib/exportComptable";

interface RecapTvaCarteProps {
  tva: TvaParTaux[];
  totalTva: number;
  filtreLabel: string;
  /** Déclenche l'export PDF du récapitulatif de TVA par taux. */
  onExportPdf?: () => void;
  /** Indique qu'un export PDF est en cours (bouton désactivé + spinner). */
  exportingPdf?: boolean;
}

/** Libellé français d'un taux de TVA (« 20 % », « 5,5 % »). */
function tauxLabel(taux: number): string {
  const s = Number.isInteger(taux) ? String(taux) : taux.toFixed(1).replace(".", ",");
  return `${s} %`;
}

/**
 * Carte de synthèse de la TVA collectée ventilée par taux (20 %, 10 %, 5,5 %…).
 * Chaque taux affiche sa base taxable HT, la TVA collectée, le TTC et le nombre
 * de factures concernées, avec une barre de répartition visuelle.
 */
export default function RecapTvaCarte({ tva, totalTva, filtreLabel, onExportPdf, exportingPdf = false }: RecapTvaCarteProps) {
  const totalBase = tva.reduce((s, t) => s + t.baseHT, 0);

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-background-200">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-percent-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground-950">TVA collectée par taux</h3>
            <p className="text-[11px] text-foreground-500">{filtreLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Total TVA</p>
            <p className="font-heading font-bold text-base text-foreground-950">{formatEuros(totalTva)}</p>
          </div>
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exportingPdf || tva.length === 0}
              title="Télécharger le récapitulatif de TVA par taux au format PDF"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingPdf ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
              PDF au comptable
            </button>
          )}
        </div>
      </div>

      {tva.length === 0 ? (
        <p className="px-5 py-6 text-sm text-foreground-500">Aucune facture sur la période ou le client sélectionné.</p>
      ) : (
        <div className="flex flex-col">
          {tva.map((t) => {
            const pct = totalBase > 0 ? Math.round((t.baseHT / totalBase) * 100) : 0;
            return (
              <div key={t.taux} className="px-5 py-3.5 border-t border-background-200 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-[52px] h-7 px-2 rounded-full bg-accent-100 text-accent-800 text-xs font-bold">
                      {tauxLabel(t.taux)}
                    </span>
                    <span className="text-xs text-foreground-500">
                      {t.nbDocuments} facture{t.nbDocuments > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="text-foreground-600">
                      Base <strong className="text-foreground-800">{formatEuros(t.baseHT)}</strong>
                    </span>
                    <span className="text-foreground-500">TVA</span>
                    <strong className="text-foreground-950">{formatEuros(t.tva)}</strong>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-accent-500" style={{ width: `${pct}%` }}></span>
                  </span>
                  <span className="text-[11px] text-foreground-500 whitespace-nowrap">{pct} % de la base</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}