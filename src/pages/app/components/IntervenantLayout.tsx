import { NavLink, Link, Outlet } from "react-router-dom";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { useAuth } from "@/hooks/useAuth";
import { couleurIntervenant } from "@/lib/intervenants";
import BoutonAide from "@/pages/app/components/aide/BoutonAide";

/**
 * Coquille allégée pour les comptes « intervenant » (membres d'équipe) : ils ne voient que
 * leur planning personnel et les préférences d'affichage, jamais les données de l'entreprise.
 */
const liens = [
  {
    to: "/app/mon-planning",
    label: "Mon planning",
    icon: "ri-calendar-2-line",
    hint: "Vos interventions de la semaine, à jour en temps réel.",
  },
  {
    to: "/app/preferences",
    label: "Préférences d'affichage",
    icon: "ri-equalizer-2-line",
    hint: "Réglez ce que vous voyez à l'écran.",
  },
];

export default function IntervenantLayout() {
  const { profile, user, signOut, monIntervenant } = useAuth();
  useRobotsMeta("noindex, nofollow");

  const nom =
    monIntervenant?.nom || profile?.entreprise || user?.email?.split("@")[0] || "Mon compte";
  const initiales =
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "IN";
  const couleur = couleurIntervenant(monIntervenant?.couleur ?? null);

  const lienCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
      isActive
        ? "bg-primary-100 text-primary-800"
        : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
    }`;

  const lienMobileCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
      isActive
        ? "bg-primary-500 text-background-50"
        : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-background-50">
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-background-100 border-r border-background-200">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-background-200">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <span className="font-heading font-bold text-lg text-foreground-950">ArtiFlow-pro</span>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          <p className="px-3 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">
            Mon espace
          </p>
          {liens.map((l) => (
            <NavLink key={l.to} to={l.to} title={l.hint} className={lienCls}>
              <i className={`${l.icon} text-lg`}></i>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-background-200">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background-50 border border-background-200">
            <span
              className="w-9 h-9 flex items-center justify-center rounded-full text-background-50 font-semibold text-sm shrink-0"
              style={{ backgroundColor: couleur }}
            >
              {initiales}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground-950 truncate">{nom}</p>
              <p className="text-[10px] text-foreground-500 truncate">
                {monIntervenant?.metier || user?.email || "Intervenant"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 flex items-center gap-2 h-9 px-3 w-full rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 hover:text-red-600 cursor-pointer"
          >
            <i className="ri-logout-box-r-line"></i>
            Se déconnecter
          </button>
          <Link
            to="/"
            className="mt-1 flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            Retour au site
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 bg-background-50 border-b border-background-200">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50 lg:hidden">
              <i className="ri-tools-fill text-lg"></i>
            </span>
            <h1 className="font-heading font-bold text-lg md:text-xl text-foreground-950 truncate">
              Mon planning
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <BoutonAide contexteSeulement ouvertureAuto={false} />
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-logout-box-r-line"></i>
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </header>

        <nav className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-background-200 bg-background-50 overflow-x-auto">
          {liens.map((l) => (
            <NavLink key={l.to} to={l.to} className={lienMobileCls}>
              <i className={l.icon}></i>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}