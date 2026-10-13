import { devisList } from "@/mocks/dashboard";
import { toneBadge } from "./tone";

export default function DevisView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-3 h-9 rounded-md bg-background-50 border border-background-200 flex-1 sm:max-w-xs">
          <i className="ri-search-line text-foreground-400 text-sm"></i>
          <span className="text-xs text-foreground-400">Rechercher un devis…</span>
        </div>
        <span className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap justify-center">
          <i className="ri-magic-line"></i> Nouveau devis IA
        </span>
      </div>

      <div className="rounded-lg border border-background-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-background-100 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <span className="col-span-2">N°</span>
          <span className="col-span-3">Client</span>
          <span className="col-span-4">Objet</span>
          <span className="col-span-2">Montant</span>
          <span className="col-span-1 text-right">Statut</span>
        </div>
        {devisList.map((devis) => (
          <div
            key={devis.id}
            className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 px-4 py-3 border-t border-background-200 bg-background-50 hover:bg-background-100 transition-colors"
          >
            <span className="md:col-span-2 text-xs font-semibold text-foreground-900">{devis.id}</span>
            <span className="md:col-span-3 text-xs text-foreground-700">{devis.client}</span>
            <span className="md:col-span-4 text-xs text-foreground-700">{devis.objet}</span>
            <span className="md:col-span-2 text-xs font-semibold text-foreground-950">{devis.montant}</span>
            <span className="md:col-span-1 md:text-right">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${toneBadge[devis.statusTone]}`}>
                {devis.statut}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-lg bg-accent-50 border border-accent-200 flex items-start gap-3">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-mic-line"></i>
        </span>
        <p className="text-xs text-foreground-600">
          « Chauffe-eau à remplacer, plus mise en sécurité du tableau » → l'IA a généré 6 lignes de devis avec vos prix habituels.
        </p>
      </div>
    </div>
  );
}