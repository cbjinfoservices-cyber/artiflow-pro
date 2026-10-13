import { useVerificationSilencieuseTaches } from "@/hooks/useVerificationSilencieuseTaches";

/**
 * Déclenche au chargement du tableau de bord une vérification silencieuse de l'état des
 * tâches planifiées (ping OPTIONS, aucun email), et affiche une ligne discrète pendant
 * l'exécution. L'état rafraîchi alimente automatiquement le bandeau d'alerte et l'écran
 * Diagnostic, sans que l'utilisateur ait à cliquer.
 */
export default function VerificationTachesSilencieuse() {
  const { enCours } = useVerificationSilencieuseTaches();
  if (!enCours) return null;
  return (
    <p className="text-[11px] text-foreground-400 flex items-center gap-1.5 animate-fade-in">
      <i className="ri-loader-4-line animate-spin"></i>
      Vérification automatique de l'état des tâches planifiées…
    </p>
  );
}