import { kpiCards, activityFeed } from "@/mocks/dashboard";
import { toneBadge, toneDot } from "./tone";

export default function DashboardView() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-lg bg-background-50 border border-background-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-500">{kpi.label}</span>
              <i className={`${kpi.icon} text-foreground-400`}></i>
            </div>
            <p className="mt-2 font-heading font-bold text-xl text-foreground-950">{kpi.value}</p>
            <p className={`mt-1 text-xs font-medium ${kpi.up ? "text-accent-600" : "text-primary-600"}`}>
              <i className={kpi.up ? "ri-arrow-up-line" : "ri-time-line"}></i> {kpi.trend}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 p-4 rounded-lg bg-background-50 border border-background-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-heading font-semibold text-sm text-foreground-950">Prévision de chiffre d'affaires</h4>
            <span className="text-xs text-foreground-500">6 mois</span>
          </div>
          <div className="flex items-end gap-2.5 h-36">
            {[42, 55, 48, 68, 74, 88].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full rounded-t-md ${i === 5 ? "bg-primary-500" : "bg-primary-200"}`}
                  style={{ height: `${h}%` }}
                ></div>
                <span className="text-[10px] text-foreground-400">
                  {["Mai", "Juin", "Juil", "Août", "Sep", "Oct"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-background-50 border border-background-200">
          <h4 className="font-heading font-semibold text-sm text-foreground-950 mb-3">Activité récente</h4>
          <ul className="flex flex-col gap-3">
            {activityFeed.map((item) => (
              <li key={item.text} className="flex items-start gap-2.5">
                <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-sm ${toneBadge[item.tone]}`}>
                  <i className={item.icon}></i>
                </span>
                <div>
                  <p className="text-xs text-foreground-800 leading-snug">{item.text}</p>
                  <p className="text-[10px] text-foreground-400 mt-0.5">{item.when}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`p-4 rounded-lg border flex items-start gap-3 ${"bg-accent-50 border-accent-200"}`}>
        <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full ${toneBadge.accent}`}>
          <i className="ri-sparkling-2-line"></i>
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground-950">Recommandation IA</p>
          <p className="text-xs text-foreground-600 mt-0.5">
            Regroupez les 3 chantiers de Villeurbanne cette semaine : environ 1 h 20 de trajet économisée.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-foreground-500">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${toneDot.primary}`}></span> Devis en cours
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${toneDot.accent}`}></span> Signé / encaissé
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${toneDot.secondary}`}></span> À relancer
        </span>
      </div>
    </div>
  );
}