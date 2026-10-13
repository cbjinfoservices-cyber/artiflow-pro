import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { setOnboardingDone } from "@/lib/onboarding";

/**
 * Bandeau « Reprendre le démarrage » du tableau de bord : permet de relancer en un clic le
 * parcours de démarrage guidé (métier, premier client, premier devis) après l'avoir passé.
 */
export default function ReprendreDemarrageCard() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReprendre = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      // On rouvre le parcours : le repère repasse à « non terminé », l'espace redirige vers l'étape 1.
      await setOnboardingDone(user.id, false);
      await refreshProfile();
      navigate("/app/demarrage");
    } catch {
      setError("Impossible de relancer le parcours. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-xl">
          <i className="ri-route-line"></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950">Revoir vos premiers pas</p>
          <p className="text-xs text-foreground-500 mt-0.5">
            Relancez le parcours guidé pour revérifier votre métier, créer un client ou composer un devis d'exemple.
          </p>
          {error && (
            <p className="text-[11px] text-red-600 mt-1 inline-flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {error}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleReprendre}
        disabled={busy}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <i className={busy ? "ri-loader-4-line animate-spin" : "ri-restart-line"}></i>
        Reprendre le démarrage
      </button>
    </div>
  );
}