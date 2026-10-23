import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/pages/app/components/AppLayout";
import IntervenantLayout from "@/pages/app/components/IntervenantLayout";

/**
 * Choisit la coquille d'espace selon le rôle du compte connecté :
 * - un compte intervenant (membre d'équipe) obtient une coquille allégée, centrée sur son planning ;
 * - tous les autres comptes obtiennent l'espace artisan complet.
 *
 * Ce choix se fait au niveau du routeur (et non à l'intérieur d'AppLayout) pour préserver
 * l'ordre des hooks React lorsque le rôle est résolu après le chargement.
 */
export default function RoleLayout() {
  const { isIntervenant, isGestionnaire, intervenantLoading } = useAuth();

  if (intervenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500 text-background-50 animate-pulse">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <p className="text-sm text-foreground-500">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  if (isIntervenant && !isGestionnaire) return <IntervenantLayout />;
  return <AppLayout />;
}