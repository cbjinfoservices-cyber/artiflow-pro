import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Réserve une route aux comptes gestionnaires. Un compte artisan qui tenterait
 * d'ouvrir l'URL du back-office est renvoyé vers son tableau de bord.
 */
export default function GestionnaireGuard({ children }: { children: ReactNode }) {
  const { isGestionnaire, loading, gestionnairesLoading } = useAuth();

  if (loading || gestionnairesLoading) return null;
  if (!isGestionnaire) return <Navigate to="/app" replace />;

  return <>{children}</>;
}