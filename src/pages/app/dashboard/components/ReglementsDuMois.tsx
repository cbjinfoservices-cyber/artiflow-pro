import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

interface ReglementsDuMoisProps {
  factures: FactureItem[];
}

interface Reglement {
  numero: string;
  client: string;
  date: string;
  montant: number;
}

/**
 * Encart « Règlements du mois » : liste les factures encaissées ce mois-ci,
 * avec la date réelle du règlement et le montant perçu, et le total encaissé
 * du mois. Un bouton ouvre la comptabilité pour la période.
 */
export default function ReglementsDuMois({ factures }: ReglementsDuMoisProps) {
  const navigate = useNavigate();

  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const moisLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const { items, total, count } = useMemo(() => {
    const reglements: Reglement[] = factures
      .filter((f) => f.statut === "Payée")
      .map((f) => {
        const date = f.date_paiement ?? f.date_emission ?? f.created_at;
        return {
          numero: f.numero,
          client: f.clientNom ?? "Sans client",
          date,
          montant: Number(f.total_ttc || 0),
        };
      })
      .filter((r) => (r.date ?? "").slice(0, 7) === prefix)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const sum = reglements.reduce((s, r) => s + r.montant, 0);
    return { items: reglements, total: sum, count: reglements.length };
  }, [factures, prefix]);

  const visibles = items.slice(0, 5);

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-background-200">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-hand-coin-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground-950">Règlements du mois</h3>
            <p className="text-[11px] text-foreground-500 capitalize">{moisLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <BoutonPartager label="Règlements du mois" chemin="/app/comptabilite?periode=Ce mois" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Encaissé</p>
            <p className="font-heading font-bold text-base text-accent-700">{formatEuros(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/app/comptabilite?periode=Ce mois")}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            title="Voir la comptabilité du mois"
          >
            <i className="ri-file-chart-line"></i>
            Comptabilité
          </button>
        </div>
      </div>

      {count === 0 ? (
        <p className="px-5 py-6 text-sm text-foreground-500">
          Aucun règlement encaissé ce mois-ci pour l'instant.
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {visibles.map((r, i) => (
              <li
                key={`${r.numero}-${i}`}
                className="flex items-center justify-between gap-3 px-5 py-3 border-t border-background-200 first:border-t-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                    <i className="ri-check-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950 truncate">{r.numero}</p>
                    <p className="text-[11px] text-foreground-500 truncate">{r.client}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground-950">{formatEuros(r.montant)}</p>
                  <p className="text-[11px] text-foreground-500">Réglé le {formatShortDate(r.date)}</p>
                </div>
              </li>
            ))}
          </ul>
          {count > visibles.length && (
            <button
              type="button"
              onClick={() => navigate("/app/comptabilite?periode=Ce mois")}
              className="w-full px-5 py-2.5 border-t border-background-200 text-xs font-semibold text-primary-700 hover:bg-background-50 cursor-pointer transition-colors"
            >
              Voir les {count} règlements du mois
            </button>
          )}
        </>
      )}
    </div>
  );
}