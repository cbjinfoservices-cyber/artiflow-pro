import Infobulle from "@/components/base/Infobulle";

export interface Kpi {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  icon: string;
  /** Explication en langage simple affichée au survol de la carte (optionnel). */
  aide?: string;
}

export default function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="p-4 rounded-lg bg-background-100 border border-background-200">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 min-w-0">
              <span className="text-xs text-foreground-500 truncate">{kpi.label}</span>
              {kpi.aide && (
                <Infobulle contenu={kpi.aide} position="haut" largeur={240} className="shrink-0">
                  <i className="ri-information-line text-foreground-300 hover:text-foreground-600 cursor-help text-xs"></i>
                </Infobulle>
              )}
            </span>
            <i className={`${kpi.icon} text-foreground-400 shrink-0`}></i>
          </div>
          <p className="mt-2 font-heading font-bold text-2xl text-foreground-950">{kpi.value}</p>
          <p className={`mt-1 text-xs font-medium ${kpi.up ? "text-accent-600" : "text-primary-600"}`}>
            <i className={kpi.up ? "ri-arrow-up-line" : "ri-time-line"}></i> {kpi.trend}
          </p>
        </div>
      ))}
    </div>
  );
}