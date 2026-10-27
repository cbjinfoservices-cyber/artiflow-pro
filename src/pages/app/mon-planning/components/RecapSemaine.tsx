import type { CreneauPerso } from "@/lib/planningIntervenant";

/**
 * Récapitulatif de fin de semaine pour l'intervenant : combien d'interventions sont
 * faites, combien restent à faire, et combien sont encore à confirmer. Une barre de
 * progression donne l'avancement de la semaine en un coup d'œil.
 */
export default function RecapSemaine({
  creneaux,
  isoList,
  labelSemaine,
}: {
  /** Toutes les interventions de la personne (toutes semaines confondues). */
  creneaux: CreneauPerso[];
  /** Les 7 jours (ISO) de la semaine affichée. */
  isoList: string[];
  /** Libellé de la semaine affichée (« Cette semaine · Octobre 2026 »). */
  labelSemaine: string;
}) {
  const semaine = creneaux.filter((c) => isoList.includes(c.date));
  const total = semaine.length;
  const faites = semaine.filter((c) => c.statut === "faite").length;
  const aConfirmer = semaine.filter((c) => c.statut === "provisoire").length;
  const restantes = total - faites;
  const pct = total > 0 ? Math.round((faites / total) * 100) : 0;

  const statBox = (label: string, valeur: number, icon: string, tone: string, texte: string) => (
    <div className="flex flex-col gap-1 p-3 rounded-md bg-background-50 border border-background-200">
      <span className={`w-7 h-7 flex items-center justify-center rounded-full ${tone}`}>
        <i className={`${icon} text-sm`}></i>
      </span>
      <span className="mt-1 text-xl font-bold text-foreground-950 tabular-nums">{valeur}</span>
      <span className="text-[11px] font-semibold text-foreground-800">{label}</span>
      <span className="text-[10px] text-foreground-500">{texte}</span>
    </div>
  );

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-bar-chart-box-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Récapitulatif de la semaine</p>
            <p className="text-[11px] text-foreground-500 truncate">{labelSemaine}</p>
          </div>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap">
            <i className="ri-line-chart-line"></i>
            {pct}% réalisé
          </span>
        )}
      </div>

      {/* Avancement de la semaine */}
      <div className="mt-4 h-2 rounded-full bg-background-200 overflow-hidden">
        <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground-500">
        <span>{faites} faite{faites > 1 ? "s" : ""}</span>
        <span>{restantes} restante{restantes > 1 ? "s" : ""}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {statBox("Au total", total, "ri-calendar-check-line", "bg-primary-100 text-primary-700", "prévues cette semaine")}
        {statBox("Faites", faites, "ri-checkbox-circle-line", "bg-secondary-100 text-secondary-800", "interventions terminées")}
        {statBox("Restantes", restantes, "ri-timer-line", "bg-accent-100 text-accent-700", restantes > 0 ? "à réaliser" : "tout est fait")}
        {statBox("À confirmer", aConfirmer, "ri-question-line", "bg-background-200 text-foreground-600", aConfirmer > 0 ? "en attente de validation" : "aucune en attente")}
      </div>

      {total > 0 && restantes === 0 && (
        <p className="mt-3 text-[11px] text-secondary-700 inline-flex items-center gap-1.5">
          <i className="ri-check-double-line"></i>
          Bravo, toutes vos interventions de la semaine sont terminées.
        </p>
      )}
    </div>
  );
}