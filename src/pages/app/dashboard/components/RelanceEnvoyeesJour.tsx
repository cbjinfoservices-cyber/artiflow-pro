import BoutonPartager from "@/pages/app/components/BoutonPartager";

interface Props {
  /** Nombre de relances client réellement envoyées aujourd'hui. */
  envoyees: number;
  /** Nombre de relances encore programmées pour aujourd'hui (pas encore parties). */
  programmees: number;
  /** Ouvre la page « Relances programmées ». */
  onVoir: () => void;
  /** Ouvre le détail des relances envoyées aujourd'hui (compteur cliquable). */
  onVoirEnvoyees: () => void;
}

/**
 * Compteur « effet du jour J » du tableau de bord : met en avant le nombre de relances client
 * envoyées aujourd'hui, pour suivre l'impact quotidien de la tâche d'envoi automatique.
 * Le compteur est cliquable et ouvre le détail des relances envoyées dans la journée.
 * Affiche aussi le reste à envoyer du jour, et un raccourci vers la page dédiée.
 */
export default function RelanceEnvoyeesJour({ envoyees, programmees, onVoir, onVoirEnvoyees }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-accent-50 border border-accent-200 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onVoirEnvoyees}
        title="Voir la liste des relances envoyées aujourd'hui"
        className="flex items-center gap-3 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-accent-100/70 cursor-pointer transition-colors"
      >
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xl">
          <i className="ri-send-plane-line"></i>
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Effet du jour J</p>
          <p className="font-heading font-bold text-2xl text-foreground-950 leading-tight">
            {envoyees}{" "}
            <span className="text-sm font-semibold text-foreground-600">
              relance{envoyees > 1 ? "s" : ""} envoyée{envoyees > 1 ? "s" : ""} aujourd'hui
            </span>
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 mt-0.5">
            Voir le détail
            <i className="ri-arrow-right-s-line"></i>
          </span>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-3">
        {programmees > 0 && (
          <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-background-50 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap">
            <i className="ri-calendar-check-line"></i>
            {programmees} prévue{programmees > 1 ? "s" : ""} aujourd'hui
          </span>
        )}
        <BoutonPartager
          label="Effet du jour J"
          chemin="/app/relances-programmees"
          title="Partager la vue des relances envoyées aujourd'hui"
        />
        <button
          type="button"
          onClick={onVoir}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-arrow-right-line"></i>
          Voir les relances
        </button>
      </div>
    </div>
  );
}