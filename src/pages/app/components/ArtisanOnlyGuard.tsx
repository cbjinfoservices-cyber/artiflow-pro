import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Réserve une route à l'espace artisan (devis, factures, clients, chantiers…).
 * Un compte gestionnaire n'est pas un compte professionnel : il est renvoyé vers
 * son back-office au lieu de voir des pages métier.
 */
export default function ArtisanOnlyGuard({ children }: { children: ReactNode }) {
  const { isGestionnaire, isIntervenant, loading, gestionnairesLoading, intervenantLoading } = useAuth();

  if (loading || gestionnairesLoading || intervenantLoading) return null;
  if (isGestionnaire) return <Navigate to="/app/back-office" replace />;
  if (isIntervenant) return <Navigate to="/app/mon-planning" replace />;

  return <>{children}</>;
}