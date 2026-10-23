import { couleurIntervenant } from "@/lib/intervenants";
import { formatDuree } from "@/lib/pointage";
import { heuresDecimales, type RecapHeuresIntervenant } from "@/lib/paie";

/**
 * Synthèse du mois : indicateurs clés et total d'heures par intervenant.
 * Sert de vue « patron » pour préparer la paie sans relire le planning.
 */
export default function PointagesResume({
  recap,
  minutesTotal,
  nbInterventions,
  nbJours,
  periodeLabel,
}: {
  recap: RecapHeuresIntervenant[];
  minutesTotal: number;
  nbInterventions: number;
  nbJours: number;
  periodeLabel: string;
}) {
  const personnesPayees = recap.filter((l) => l.nbPointages > 0).length;
  const enCours = recap.some((l) => l.enCours);
  const maxMinutes = Math.max(1, ...recap.map((l) => l.minutes));

  const kpis = [
    {
      label: "Heures du mois",
      valeur: minutesTotal > 0 ? formatDuree(minutesTotal) : "—",
      detail: minutesTotal > 0 ? `${heuresDecimales(minutesTotal)} h décimales` : "aucun pointage",
      icon: "ri-timer-line",
      tone: "bg-primary-100 text-primary-800",
    },
    {
      label: "Interventions pointées",
      valeur: String(nbInterventions),
      detail: `${nbJours} jour${nbJours > 1 ? "s" : ""} pointé${nbJours > 1 ? "s" : ""}`,
      icon: "ri-checkbox-multiple-line",
      tone: "bg-secondary-100 text-secondary-900",
    },
    {
      label: "Personnes concernées",
      valeur: String(personnesPayees),
      detail: `${recap.length} ligne${recap.length > 1 ? "s" : ""} de récapitulatif`,
      icon: "ri-team-line",
      tone: "bg-accent-100 text-accent-800",
    },
    {
      label: "Pointages en cours",
      valeur: enCours ? "Oui" : "Aucun",
      detail: enCours ? "une intervention tourne encore" : "tout est terminé",
      icon: "ri-timer-flash-line",
      tone: "bg-background-200 text-foreground-700",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg bg-background-100 border border-background-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                {k.label}
              </p>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full ${k.tone}`}>
                <i className={`${k.icon} text-sm`}></i>
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-foreground-950 tabular-nums">{k.valeur}</p>
            <p className="text-[11px] text-foreground-500">{k.detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground-950">Total par intervenant</h2>
          <p className="text-[11px] text-foreground-500">{periodeLabel}</p>
        </div>

        {recap.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-500">Aucun intervenant enregistré pour l'instant.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {recap.map((ligne) => (
              <div
                key={ligne.intervenantId ?? "non-affecte"}
                className="flex items-center gap-3 rounded-md bg-background-50 border border-background-200 px-3 py-2.5"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: ligne.couleur ? couleurIntervenant(ligne.couleur) : "#a8a29e",
                  }}
                />
                <div className="min-w-0 w-40 shrink-0">
                  <p className="text-xs font-semibold text-foreground-900 truncate">{ligne.nom}</p>
                  <p className="text-[10px] text-foreground-500">
                    {ligne.nbJours} jour{ligne.nbJours > 1 ? "s" : ""} · {ligne.nbPointages} interv.
                  </p>
                </div>
                <div className="flex-1 h-2 rounded-full bg-background-200 overflow-hidden min-w-0">
                  <div
                    className={`h-full rounded-full ${ligne.enCours ? "bg-accent-500" : "bg-primary-500"}`}
                    style={{ width: `${Math.round((ligne.minutes / maxMinutes) * 100)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-bold tabular-nums text-foreground-900 shrink-0">
                  {ligne.minutes > 0 ? formatDuree(ligne.minutes) : "—"}
                </span>
                <span className="hidden sm:inline w-16 text-right text-[11px] tabular-nums text-foreground-500 shrink-0">
                  {ligne.minutes > 0 ? `${heuresDecimales(ligne.minutes)} h` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}