import { useState } from "react";
import { formatShortDate, todayISO } from "@/lib/dates";

const STORAGE_KEY = "artiflow:abonnements:rappel-recontact-masque";

export interface CompteARappeler {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  joursDepuis: number;
  dernierChangement: string | null;
  nbChangements: number;
}

interface Props {
  items: CompteARappeler[];
  /** Délai (en jours) au-delà duquel un compte très volatil déclenche le rappel. */
  delaiJours: number;
  /** Comptes volatils déjà recontactés depuis leur signalement (effet des relances). */
  dejaRecontactesDepuisRappel: number;
  /** Comptes volatils déjà traités (recontactés) — avancement global. */
  nbTraites: number;
  /** Nombre total de comptes volatils suivis (traités + restants). */
  nbVolatils: number;
  /** Applique le filtre « à recontacter » et amène à la liste des abonnements. */
  onVoirARecontacter: () => void;
  /** Ouvre l'envoi groupé du message de recontact à tous les comptes en retard. */
  onContacterTous: () => void;
}

/**
 * Bandeau de rappel affiché en haut du back-office Abonnements : signale les comptes
 * très volatils toujours « à recontacter » alors que leur dernier changement d'offre
 * remonte à plus de `delaiJours` jours. Masquable pour la journée.
 */
export default function RappelRecontactVolatils({
  items,
  delaiJours,
  dejaRecontactesDepuisRappel,
  nbTraites,
  nbVolatils,
  onVoirARecontacter,
  onContacterTous,
}: Props) {
  const [masque, setMasque] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === todayISO();
    } catch {
      return false;
    }
  });
  const [deplie, setDeplie] = useState(false);

  if (items.length === 0 || masque) return null;

  const masquer = () => {
    try {
      localStorage.setItem(STORAGE_KEY, todayISO());
    } catch {
      /* stockage indisponible : le bandeau se refermera juste pour la session */
    }
    setMasque(true);
  };

  const visibles = deplie ? items : items.slice(0, 3);
  const progression = nbVolatils > 0 ? Math.min(100, Math.round((nbTraites / nbVolatils) * 100)) : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-red-100 text-red-600">
          <i className="ri-alarm-warning-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-950">
            {items.length} compte{items.length > 1 ? "s" : ""} très volatil{items.length > 1 ? "s" : ""} à recontacter depuis plus de {delaiJours} jours
          </p>
          <p className="text-[11px] text-foreground-600 mt-0.5">
            Dernier changement d'offre il y a plus de {delaiJours} jours et aucun recontact envoyé pour l'instant.
          </p>
          {dejaRecontactesDepuisRappel > 0 && (
            <span
              className="inline-flex items-center gap-1.5 mt-2 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap"
              title="Comptes volatils recontactés depuis leur signalement : mesure l'effet des relances"
            >
              <i className="ri-mail-check-line"></i>
              {dejaRecontactesDepuisRappel} déjà recontacté{dejaRecontactesDepuisRappel > 1 ? "s" : ""} depuis le rappel
            </span>
          )}
          {nbVolatils > 0 && (
            <div className="mt-2 flex items-center gap-2 max-w-xs">
              <div
                className="flex-1 h-1.5 rounded-full bg-red-100 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={nbVolatils}
                aria-valuenow={nbTraites}
                aria-label="Avancement des recontacts parmi les comptes volatils"
              >
                <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progression}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                {nbTraites} traité{nbTraites > 1 ? "s" : ""} sur {nbVolatils} volatil{nbVolatils > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onContacterTous}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            title="Envoyer le message de recontact à tous les comptes en retard d'un seul clic"
          >
            <i className="ri-send-plane-2-line"></i>
            Contacter tous
          </button>
          <button
            type="button"
            onClick={onVoirARecontacter}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
          >
            <i className="ri-filter-3-line"></i>
            Voir les comptes à recontacter
          </button>
          <button
            type="button"
            onClick={masquer}
            title="Masquer ce rappel pour aujourd'hui"
            aria-label="Masquer ce rappel pour aujourd'hui"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 whitespace-nowrap cursor-pointer hover:border-red-300 transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {visibles.map((c) => (
          <li
            key={c.abonnementId}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-background-50 border border-background-200"
          >
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-foreground-900 truncate">{c.entreprise}</span>
              <span className={`block text-[10px] truncate ${c.email ? "text-foreground-500" : "text-red-600"}`}>
                {c.email ?? "Email non renseigné"}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-fire-line text-[10px]"></i>
                {c.nbChangements} chg. / 6 mois
              </span>
              <span
                className="text-[10px] text-foreground-500 whitespace-nowrap"
                title={c.dernierChangement ? `Dernier changement le ${formatShortDate(c.dernierChangement)}` : undefined}
              >
                il y a {c.joursDepuis} j
              </span>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setDeplie((d) => !d)}
          className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:text-foreground-900 transition-colors"
        >
          <i className={deplie ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
          {deplie ? "Voir moins" : `Voir les ${items.length - 3} autres`}
        </button>
      )}
    </div>
  );
}