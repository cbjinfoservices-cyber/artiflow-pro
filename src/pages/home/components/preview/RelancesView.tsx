import { relancesList } from "@/mocks/dashboard";
import { toneBadge } from "./tone";

export default function RelancesView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-background-50 border border-background-200 text-center">
          <p className="font-heading font-bold text-lg text-foreground-950">12</p>
          <p className="text-[10px] text-foreground-500">relances ce mois</p>
        </div>
        <div className="p-3 rounded-lg bg-background-50 border border-background-200 text-center">
          <p className="font-heading font-bold text-lg text-accent-600">5</p>
          <p className="text-[10px] text-foreground-500">devis sauvés</p>
        </div>
        <div className="p-3 rounded-lg bg-background-50 border border-background-200 text-center">
          <p className="font-heading font-bold text-lg text-primary-600">3</p>
          <p className="text-[10px] text-foreground-500">programmées</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {relancesList.map((relance) => (
          <div key={relance.client + relance.when} className="flex items-start gap-3 p-3.5 rounded-lg bg-background-50 border border-background-200">
            <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg ${toneBadge[relance.statusTone]}`}>
              <i className={relance.icon}></i>
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground-950">{relance.client}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-100 text-foreground-500">{relance.canal}</span>
              </div>
              <p className="mt-1 text-xs text-foreground-600 leading-snug">{relance.message}</p>
              <p className="mt-1 text-[10px] text-foreground-400">{relance.when}</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${toneBadge[relance.statusTone]}`}>
              {relance.statut}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}