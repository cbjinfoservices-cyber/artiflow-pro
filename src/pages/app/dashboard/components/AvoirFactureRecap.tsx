import type { FactureItem } from "@/hooks/useArtisanData";
import { factureIsAvoir } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";

/**
 * Petit récap « avoirs vs factures » affiché juste sous les KPI du tableau de bord :
 * distingue les factures classiques des avoirs (notes de crédit) et affiche le solde net.
 */
export default function AvoirFactureRecap({ factures }: { factures: FactureItem[] }) {
  const avoirs = factures.filter((f) => factureIsAvoir(f.numero));
  const classiques = factures.filter((f) => !factureIsAvoir(f.numero));

  const totalFacture = classiques.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const totalAvoir = avoirs.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const net = totalFacture + totalAvoir;

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-scales-3-line"></i>
          </span>
          <h2 className="font-heading font-semibold text-sm text-foreground-950">Avoirs vs factures</h2>
        </div>
        {avoirs.length > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 whitespace-nowrap">
            {avoirs.length} avoir{avoirs.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-md bg-background-50 border border-background-200">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Factures
          </p>
          <p className="mt-0.5 font-heading font-bold text-base text-foreground-950">{formatEuros(totalFacture)}</p>
          <p className="text-[11px] text-foreground-400">
            {classiques.length} facture{classiques.length > 1 ? "s" : ""} émise{classiques.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-3 rounded-md bg-secondary-50 border border-secondary-200">
          <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">Avoirs</p>
          <p className="mt-0.5 font-heading font-bold text-base text-foreground-950">{formatEuros(totalAvoir)}</p>
          <p className="text-[11px] text-foreground-400">
            {avoirs.length} note{avoirs.length > 1 ? "s" : ""} de crédit
          </p>
        </div>
        <div className="p-3 rounded-md bg-accent-50 border border-accent-200">
          <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">Solde net</p>
          <p className="mt-0.5 font-heading font-bold text-base text-foreground-950">{formatEuros(net)}</p>
          <p className="text-[11px] text-foreground-400">factures − avoirs</p>
        </div>
      </div>
    </div>
  );
}