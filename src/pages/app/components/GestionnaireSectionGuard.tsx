import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Réserve une section du back-office (Comptabilité, Mon abonnement) selon les préférences
 * du compte gestionnaire connecté. Sans effet pour un compte artisan, qui conserve
 * toujours ces entrées. Un gestionnaire qui aurait désactivé la section et forcerait
 * l'URL est renvoyé vers son tableau de bord.
 */
export default function GestionnaireSectionGuard({
  section,
  children,
}: {
  section: "comptabilite" | "mon-abonnement";
  children: ReactNode;
}) {
  const { loading, gestionnairesLoading, voirComptabilite, voirMonAbonnement } = useAuth();

  if (loading || gestionnairesLoading) return null;
  const autorise = section === "comptabilite" ? voirComptabilite : voirMonAbonnement;
  if (!autorise) return <Navigate to="/app" replace />;

  return <>{children}</>;
}