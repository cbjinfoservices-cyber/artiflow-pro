import type { FactureItem } from "@/hooks/useArtisanData";
import { factureIsAvoir } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";

/**
 * Widget de suivi des encaissements : compare le CA facturé au CA réellement encaissé
 * pour mettre en évidence les impayés.
 */
export default function FacturationWidget({ factures }: { factures: FactureItem[] }) {
  const facture = factures.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const encaisse = factures
    .filter((f) => f.statut === "Payée")
    .reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const reste = Math.max(facture - encaisse, 0);
  const pct = facture > 0 ? Math.round((encaisse / facture) * 100) : 0;
  const avoirs = factures.filter((f) => factureIsAvoir(f.numero));
  const totalAvoirs = avoirs.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const factureBrute = facture - totalAvoirs;
  const horsAvoirs = factures.filter((f) => !factureIsAvoir(f.numero));
  const impayees = horsAvoirs.filter((f) => f.statut !== "Payée");
  const enRetard = horsAvoirs.filter((f) => f.statut === "En retard");

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-wallet-3-line"></i>
          </span>
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground-950">CA facturé vs encaissé</h2>
            <p className="text-xs text-foreground-500">Suivi des impayés en temps réel</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-foreground-600">{pct}% encaissé</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-md bg-background-50 border border-background-200">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Facturé {avoirs.length > 0 ? "net" : ""}
          </p>
          <p className="mt-1 font-heading font-bold text-lg text-foreground-950">{formatEuros(facture)}</p>
          {avoirs.length > 0 && (
            <p className="text-[11px] text-foreground-400 mt-0.5">
              {formatEuros(factureBrute)} − {formatEuros(Math.abs(totalAvoirs))} d'avoirs
            </p>
          )}
        </div>
        <div className="p-3.5 rounded-md bg-accent-50 border border-accent-200">
          <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">Encaissé</p>
          <p className="mt-1 font-heading font-bold text-lg text-foreground-950">{formatEuros(encaisse)}</p>
        </div>
        <div className="p-3.5 rounded-md bg-secondary-50 border border-secondary-200">
          <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">Reste à encaisser</p>
          <p className="mt-1 font-heading font-bold text-lg text-foreground-950">{formatEuros(reste)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2.5 w-full rounded-full bg-background-200 overflow-hidden">
          <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }}></div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-500"></span>
            {factures.filter((f) => f.statut === "Payée").length} facture(s) payée(s)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-400"></span>
            {impayees.length} en attente{enRetard.length > 0 ? ` dont ${enRetard.length} en retard` : ""}
          </span>
          {avoirs.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary-500"></span>
              {avoirs.length} avoir(s) · {formatEuros(Math.abs(totalAvoirs))} déduit(s)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}