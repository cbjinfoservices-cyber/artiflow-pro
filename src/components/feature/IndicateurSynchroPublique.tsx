import { useAuth } from "@/hooks/useAuth";
import { usePreferencesAffichageSync } from "@/hooks/usePreferencesAffichageSync";
import { tempsRelatifPreference } from "@/lib/preferencesAffichageNotif";

/**
 * Petit indicateur « dernière synchro réussie », affiché sur les pages publiques dès qu'un compte
 * est connecté. Il rappelle, d'un coup d'œil, que les préférences d'affichage sont bien enregistrées
 * sur le compte et quand l'enregistrement a réussi pour la dernière fois.
 * Ne rend rien tant qu'aucun compte n'est connecté.
 */
export default function IndicateurSynchroPublique({
  dark = false,
  className,
}: {
  /** Style clair, adapté à une barre de navigation transparente sur fond sombre. */
  dark?: boolean;
  /** Classes d'affichage, pour réutiliser l'indicateur ailleurs (ex. menu mobile plein largeur). */
  className?: string;
}) {
  const { user } = useAuth();
  const sync = usePreferencesAffichageSync();

  if (!user) return null;

  const enErreur = Boolean(sync.erreur);
  const icone = enErreur
    ? "ri-error-warning-line"
    : sync.enCours
      ? "ri-loader-4-line"
      : sync.derniereSynchro
        ? "ri-cloud-line"
        : "ri-cloud-off-line";
  const texte = enErreur
    ? "Synchro à reprendre"
    : sync.enCours
      ? "Synchronisation…"
      : sync.derniereSynchro
        ? `Synchro ${tempsRelatifPreference(sync.derniereSynchro)}`
        : "Préférences locales";
  const detail = enErreur
    ? sync.erreur ?? "L'enregistrement des préférences a échoué."
    : sync.enCours
      ? "Enregistrement de vos préférences sur votre compte en cours…"
      : sync.derniereSynchro
        ? `Dernière synchro réussie ${tempsRelatifPreference(sync.derniereSynchro)}.`
        : "Vos préférences seront bientôt enregistrées sur votre compte.";

  const ton = dark
    ? "bg-background-50/15 text-background-50 hover:bg-background-50/25"
    : enErreur
      ? "bg-red-100 text-red-700 border border-red-200"
      : "bg-background-100 text-foreground-600 border border-background-200";

  const affichage = className ?? "hidden md:inline-flex";

  return (
    <span
      title={detail}
      className={`${affichage} items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${ton}`}
    >
      <i className={`${icone}${sync.enCours ? " animate-spin" : ""}`}></i>
      {texte}
    </span>
  );
}