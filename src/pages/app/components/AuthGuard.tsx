import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function AuthGuard() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  if (!session) {
    return <Navigate to="/app/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}