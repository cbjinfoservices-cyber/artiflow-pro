interface Props {
  /** Récap hebdomadaire activé (sinon en pause). */
  actif: boolean;
  /** Texte de la prochaine date contextuelle (ex. « Prochain : 12 oct. 2026 »). */
  dateLabel: string;
  /** Libellés des prochains créneaux d'envoi prévus (jusqu'à 3), d'après la cadence réglée. */
  prochains?: string[];
  /** Amène aux réglages du récap (bandeau d'options) au clic. */
  onOpen?: () => void;
}

/**
 * Badge d'en-tête de la page Abonnements : donne d'un coup d'œil l'état du récap
 * hebdomadaire (activé / en pause) et les prochains créneaux d'envoi prévus selon la cadence.
 */
export default function RecapHebdoBadge({ actif, dateLabel, prochains = [], onOpen }: Props) {
  const afficherCreneaux = actif && prochains.length > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        actif
          ? `Récap hebdomadaire activé · ${dateLabel}`
          : "Récap hebdomadaire en pause — cliquez pour ouvrir les réglages"
      }
      className={`inline-flex items-start gap-3 p-2.5 pr-4 rounded-lg border whitespace-nowrap cursor-pointer transition-colors ${
        actif ? "bg-background-100 border-background-200 hover:border-accent-300" : "bg-red-50 border-red-200 hover:border-red-300"
      }`}
    >
      <span
        className={`w-9 h-9 flex items-center justify-center rounded-md shrink-0 ${
          actif ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-600"
        }`}
      >
        <i className="ri-mail-send-line"></i>
      </span>
      <span className="flex flex-col items-start gap-1.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Récap hebdo</span>
          <span
            className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[10px] font-bold ${
              actif ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${actif ? "bg-accent-500" : "bg-red-500"}`} />
            {actif ? "Activé" : "En pause"}
          </span>
        </span>

        {afficherCreneaux ? (
          <span className="flex flex-col items-start gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground-500">
              <i className="ri-calendar-schedule-line text-accent-600"></i>
              {prochains.length} prochains créneaux prévus
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {prochains.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700"
                >
                  {p}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
            <i className="ri-calendar-schedule-line"></i>
            {dateLabel}
          </span>
        )}
      </span>
    </button>
  );
}