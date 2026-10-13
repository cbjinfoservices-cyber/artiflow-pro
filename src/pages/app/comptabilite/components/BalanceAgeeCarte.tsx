import { formatEuros } from "@/lib/format";
import type { BalanceAgee } from "@/lib/exportComptable";

interface BalanceAgeeCarteProps {
  balance: BalanceAgee;
  /** Libellé du filtre actif (période / client) rappelé sous le titre. */
  filtreLabel: string;
  /** Déclenche l'export PDF de la balance âgée (document autonome). */
  onExportPdf?: () => void;
  /** Export PDF en cours (bouton désactivé + spinner). */
  exportingPdf?: boolean;
}

/** Tonalité visuelle et icône par palier d'ancienneté. */
const TONES: Record<string, { bar: string; chip: string; icon: string }> = {
  "0-30": { bar: "bg-secondary-500", chip: "bg-secondary-100 text-secondary-800", icon: "ri-time-line" },
  "30-60": { bar: "bg-accent-500", chip: "bg-accent-100 text-accent-800", icon: "ri-hourglass-2-line" },
  "60+": { bar: "bg-primary-500", chip: "bg-primary-100 text-primary-700", icon: "ri-alarm-warning-line" },
};

/**
 * Carte de balance âgée des créances : montants TTC encore impayés répartis par
 * ancienneté (0-30 j, 30-60 j, +60 j), avec un total et une barre de répartition.
 * Repose sur la date d'échéance de chaque facture (repli sur l'émission).
 */
export default function BalanceAgeeCarte({ balance, filtreLabel, onExportPdf, exportingPdf = false }: BalanceAgeeCarteProps) {
  const { buckets, totalMontant, totalCount } = balance;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-background-200">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-scales-3-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground-950">Balance âgée des créances</h3>
            <p className="text-[11px] text-foreground-500">{filtreLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Reste à encaisser</p>
            <p className="font-heading font-bold text-base text-foreground-950">{formatEuros(totalMontant)}</p>
          </div>
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exportingPdf || totalCount === 0}
              title="Télécharger la balance âgée des créances au format PDF"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingPdf ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
              PDF
            </button>
          )}
        </div>
      </div>

      {totalCount === 0 ? (
        <p className="px-5 py-6 text-sm text-foreground-500">Aucune facture impayée : toutes vos créances sont réglées.</p>
      ) : (
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {buckets.map((b) => {
              const tone = TONES[b.key] ?? TONES["0-30"];
              const pct = totalMontant > 0 ? Math.round((b.montant / totalMontant) * 100) : 0;
              return (
                <div key={b.key} className="p-4 rounded-md bg-background-50 border border-background-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold ${tone.chip}`}>
                      <i className={tone.icon}></i>
                      {b.label}
                    </span>
                    <span className="text-[11px] text-foreground-500">{pct} %</span>
                  </div>
                  <p className="mt-2.5 font-heading font-bold text-lg text-foreground-950">{formatEuros(b.montant)}</p>
                  <p className="text-[11px] text-foreground-500 mt-0.5">
                    {b.count} facture{b.count > 1 ? "s" : ""}
                  </p>
                  <span className="mt-2.5 block h-1.5 rounded-full bg-background-200 overflow-hidden" aria-hidden="true">
                    <span className={`block h-full ${tone.bar}`} style={{ width: `${pct}%` }}></span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3" aria-hidden="true">
            {buckets.map((b) => {
              const tone = TONES[b.key] ?? TONES["0-30"];
              const pct = totalMontant > 0 ? (b.montant / totalMontant) * 100 : 0;
              if (pct <= 0) return null;
              return <span key={b.key} className={`h-2 rounded-full ${tone.bar}`} style={{ width: `${pct}%` }}></span>;
            })}
          </div>

          <p className="text-[11px] text-foreground-400">
            Ancienneté calculée depuis la date d'échéance de chaque facture. Les avoirs et les factures réglées sont exclus.
            {" "}
            <strong className="text-foreground-600">{totalCount}</strong> facture{totalCount > 1 ? "s" : ""} impayée
            {totalCount > 1 ? "s" : ""} au total.
          </p>
        </div>
      )}
    </div>
  );
}