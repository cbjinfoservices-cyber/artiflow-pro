import { Link } from "react-router-dom";
import { useSuppressionProgrammee } from "@/hooks/useSuppressionProgrammee";
import { dateRappelSuppression, formaterDateFr, joursRestantsAvant } from "@/lib/compte";

/**
 * Bandeau discret affiché en haut de l'espace tant qu'une suppression de compte est
 * programmée. Il sert de dernier garde-fou : impossible d'oublier une échéance, et
 * l'annulation reste à un clic.
 */
export default function BandeauSuppressionProgrammee() {
  const { demande, annulationEnCours, annuler, erreur } = useSuppressionProgrammee();

  if (!demande) return null;

  const jours = joursRestantsAvant(demande.prevue_le);
  const rappelJ1 = dateRappelSuppression(demande.details, "rappel_j1_envoye_le");
  const rappelJ7 = dateRappelSuppression(demande.details, "rappel_j7_envoye_le");
  const dateRappel = rappelJ1 || rappelJ7;
  const libelleRappel = dateRappel
    ? `${rappelJ1 ? "Dernier rappel (J-1)" : "Rappel J-7"} envoyé le ${formaterDateFr(dateRappel)}`
    : "Vous recevrez un rappel par email à J-7 puis à J-1 avant l'échéance.";

  return (
    <div className="mb-4 p-3 md:p-4 rounded-lg bg-accent-100 border border-accent-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
          <i className="ri-timer-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent-900">
            Suppression de votre compte programmée le {formaterDateFr(demande.prevue_le)}
          </p>
          <p className="text-[11px] text-foreground-700 mt-0.5">
            {jours > 0
              ? `Il reste ${jours} jour${jours > 1 ? "s" : ""} pour changer d'avis. Votre espace fonctionne normalement.`
              : "L'échéance est imminente. Annulez maintenant si vous souhaitez conserver votre compte."}{" "}
            Vous pouvez annuler à tout moment, ou simplement vous reconnecter.
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] ${
              dateRappel ? "text-primary-800" : "text-foreground-600"
            }`}
          >
            <i className={dateRappel ? "ri-mail-check-line" : "ri-mail-line"}></i>
            <span>
              {dateRappel ? `${libelleRappel} — le suivi est bien à jour.` : libelleRappel}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/app/profil?onglet=securite"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-settings-3-line"></i>
            Gérer
          </Link>
          <button
            type="button"
            onClick={() => {
              void annuler("action-manuelle");
            }}
            disabled={annulationEnCours}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {annulationEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-arrow-go-back-line"></i>}
            Annuler la suppression
          </button>
        </div>
      </div>
      {erreur && (
        <p className="mt-2 text-[11px] text-red-700 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {erreur}
        </p>
      )}
    </div>
  );
}