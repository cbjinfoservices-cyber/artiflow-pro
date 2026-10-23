import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { MENU_COMPTE_REPLIE_CLE, VALIDER_MENU_COMPTE_REPLIE } from "@/lib/menuSidebarPrefs";

interface NavCompteProps {
  /** Chemins contenus dans le bloc : sert à rouvrir automatiquement le groupe de la page courante. */
  chemins: readonly string[];
  /** Liens du bloc (Mon profil, Compte gestionnaire, Comptabilité, Préférences d'affichage…). */
  children: ReactNode;
}

/**
 * Bloc « Mon compte » de la barre latérale de l'espace.
 *
 * Il reprend exactement le gabarit des sous-thèmes métier (titre repliable + chevron) pour que le
 * bas du menu ne ressemble plus à une liste en vrac de rubriques d'une seule ligne. L'état replié
 * est mémorisé sur le poste, et le bloc se rouvre tout seul dès que la page affichée en fait partie.
 */
export default function NavCompte({ chemins, children }: NavCompteProps) {
  const { pathname } = useLocation();
  const [replie, setReplie] = usePersistedState<boolean>(
    MENU_COMPTE_REPLIE_CLE,
    VALIDER_MENU_COMPTE_REPLIE,
  );

  // La page courante appartient-elle au bloc ? Si oui et que le bloc est replié, on le rouvre.
  useEffect(() => {
    if (!replie) return;
    const dedans = chemins.some((c) => pathname === c || pathname.startsWith(`${c}/`));
    if (dedans) setReplie(false);
  }, [pathname, replie, chemins, setReplie]);

  const ouvert = !replie;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setReplie(ouvert)}
        aria-expanded={ouvert}
        aria-controls="menu-mon-compte"
        title={ouvert ? "Replier le bloc Mon compte" : "Déplier le bloc Mon compte"}
        className="flex items-center gap-2 w-full px-3 pt-3 pb-1 cursor-pointer"
      >
        <span className="text-[10px] font-semibold text-foreground-400/70 uppercase tracking-wider">
          Mon compte
        </span>
        <i
          className={`${ouvert ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} ml-auto text-foreground-300 text-sm`}
        ></i>
      </button>

      {ouvert && (
        <div id="menu-mon-compte" className="flex flex-col gap-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** Classes communes aux liens du bloc, alignées sur celles de la navigation métier. */
export function classeLienCompte(isActive: boolean): string {
  return `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
    isActive
      ? "bg-primary-100 text-primary-800"
      : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
  }`;
}