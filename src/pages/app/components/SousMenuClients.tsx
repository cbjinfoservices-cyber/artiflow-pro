import { Link, NavLink, useLocation } from "react-router-dom";
import { classeLienNav, type ItemNav } from "@/pages/app/components/menuAppData";

interface SousMenuClientsProps {
  /** Entrée « Clients » du menu, porteuse de ses sous-entrées. */
  item: ItemNav;
  /** Nombre de particuliers au carnet (pastille de la sous-entrée). */
  nbParticuliers: number;
  /** Nombre d'entreprises au carnet (pastille de la sous-entrée). */
  nbEntreprises: number;
  /** Vrai quand la sous-liste est repliée (préférence mémorisée). */
  replie: boolean;
  /** Replie / déplie la sous-liste. */
  onBasculer: () => void;
}

/** Compteur compact d'une sous-entrée, masqué quand il n'y a aucune fiche. */
function PastilleSousEntree({
  nombre,
  tone,
}: {
  nombre: number;
  tone: "particuliers" | "entreprises";
}) {
  if (nombre <= 0) return null;
  const cls =
    tone === "entreprises"
      ? "bg-accent-100 text-accent-800"
      : "bg-secondary-100 text-secondary-800";
  return (
    <span
      className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${cls}`}
    >
      {nombre > 99 ? "99+" : nombre}
    </span>
  );
}

/**
 * Entrée « Clients » de la barre latérale, avec sa sous-liste repliable Particuliers / Entreprises.
 *
 * Un seul carnet en base : les deux sous-entrées ne sont que des portes d'entrée pré-filtrées
 * (`?type=Particuliers` / `?type=Professionnels`). La ligne principale mène au carnet complet.
 * Le chevron est un bouton distinct du lien pour ne pas casser la navigation.
 */
export default function SousMenuClients({
  item,
  nbParticuliers,
  nbEntreprises,
  replie,
  onBasculer,
}: SousMenuClientsProps) {
  const location = useLocation();
  const typeCourant = new URLSearchParams(location.search).get("type");
  const surLeCarnet = location.pathname === "/app/clients" || location.pathname.startsWith("/app/clients/");
  const sousEntrees = item.sousEntrees ?? [];
  // Vue « carnet complet » : ni particuliers, ni entreprises sélectionnés.
  const surCarnetComplet =
    surLeCarnet && typeCourant !== "Particuliers" && typeCourant !== "Professionnels";
  const totalFiches = nbParticuliers + nbEntreprises;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5">
        <NavLink
          to={item.to}
          end={item.end}
          title={item.hint}
          className={({ isActive }) => `flex-1 min-w-0 ${classeLienNav(isActive)}`}
        >
          <i className={`${item.icon} text-lg`}></i>
          {item.label}
        </NavLink>
        {sousEntrees.length > 0 && (
          <button
            type="button"
            onClick={onBasculer}
            aria-expanded={!replie}
            aria-label={replie ? "Afficher Particuliers et Entreprises" : "Masquer Particuliers et Entreprises"}
            title={replie ? "Afficher les deux types de fiches" : "Masquer les deux types de fiches"}
            className="shrink-0 w-7 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-800 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className={`${replie ? "ri-arrow-right-s-line" : "ri-arrow-down-s-line"} text-sm`}></i>
          </button>
        )}
      </div>

      {sousEntrees.length > 0 && !replie && (
        <div className="flex flex-col gap-0.5 mt-0.5 ml-5 pl-2 border-l border-background-200">
          {/* Compteur global : rappelle le volume total du carnet et y ramène en un clic. */}
          <NavLink
            to="/app/clients"
            title={`Ouvrir le carnet complet : ${totalFiches} fiche${totalFiches > 1 ? "s" : ""} (particuliers et entreprises réunis)`}
            aria-current={surCarnetComplet ? "page" : undefined}
            className={`flex items-center gap-2 h-9 px-2 rounded-md text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              surCarnetComplet
                ? "bg-primary-100 text-primary-800"
                : "text-foreground-700 hover:bg-background-200 hover:text-foreground-950"
            }`}
          >
            <i className="ri-contacts-book-2-line text-sm"></i>
            Tout le carnet
            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold tabular-nums">
              {totalFiches > 99 ? "99+" : totalFiches}
            </span>
          </NavLink>

          {sousEntrees.map((sous) => {
            const nombre = sous.compteur === "entreprises" ? nbEntreprises : nbParticuliers;
            const actif = surLeCarnet && typeCourant === (sous.compteur === "entreprises" ? "Professionnels" : "Particuliers");
            return (
              <NavLink
                key={sous.to}
                to={sous.to}
                title={sous.hint}
                aria-current={actif ? "page" : undefined}
                className={`flex items-center gap-2 h-9 px-2 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-500 hover:bg-background-200 hover:text-foreground-950"
                }`}
              >
                <i className={`${sous.icon} text-sm`}></i>
                {sous.label}
                <PastilleSousEntree nombre={nombre} tone={sous.compteur} />
              </NavLink>
            );
          })}

          {/* Création directe depuis le menu : l'adresse ouvre le carnet avec le formulaire déjà
              ouvert et le bon type pré-sélectionné, sans passer par le bouton de la page. */}
          <div className="flex items-center gap-1 mt-1">
            <Link
              to="/app/clients?type=Particuliers&nouveau=particulier"
              title="Créer une fiche particulier sans quitter votre navigation"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 h-7 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-800 transition-colors"
            >
              <i className="ri-add-line text-[12px]"></i>
              Particulier
            </Link>
            <Link
              to="/app/clients?type=Professionnels&nouveau=professionnel"
              title="Créer une fiche entreprise sans quitter votre navigation"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 h-7 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-800 transition-colors"
            >
              <i className="ri-add-line text-[12px]"></i>
              Entreprise
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}