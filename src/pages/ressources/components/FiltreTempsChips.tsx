import { FILTRES_TEMPS, type FiltreTemps } from "@/lib/ressourcesPrefs";

/**
 * Filtre par temps de lecture (chips) : permet de ne garder que les guides courts,
 * moyens ou longs. Les compteurs, quand fournis, indiquent le nombre de guides
 * disponibles dans chaque tranche pour les filtres déjà actifs.
 */
export default function FiltreTempsChips({
  value,
  onChange,
  counts,
}: {
  value: FiltreTemps;
  onChange: (value: FiltreTemps) => void;
  counts?: Record<FiltreTemps, number>;
}) {
  return (
    <div className="inline-flex flex-wrap p-1 rounded-full bg-background-100 border border-background-200">
      {FILTRES_TEMPS.map((option) => {
        const actif = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.hint}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              actif ? "bg-foreground-950 text-background-50 font-semibold" : "text-foreground-600 hover:text-foreground-950"
            }`}
          >
            <i className={option.icon}></i>
            {option.label}
            {counts && (
              <span className={actif ? "text-background-200" : "text-foreground-400"}>{counts[option.id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}