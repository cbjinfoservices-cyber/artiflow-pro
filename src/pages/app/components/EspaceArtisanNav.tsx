import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import AccesVuesFavorites from "@/pages/app/components/AccesVuesFavorites";
import { GROUPE_RESSOURCES, navItems, type ItemNav } from "@/pages/app/components/menuAppData";
import { usePersistedState } from "@/hooks/usePersistedState";
import { MENU_GROUPES_REPLIES_CLE, VALIDER_GROUPES_REPLIES } from "@/lib/menuSidebarPrefs";
import { formatEuros } from "@/lib/format";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import CompteurNouvellesRessources from "@/components/base/CompteurNouvellesRessources";
import { compterGuidesNouveaux, sujetDateRecente } from "@/mocks/ressources";

interface EspaceArtisanNavProps {
  enRetard: number;
  critiques: number;
  montantRetard: number;
  retardCible: number;
  relancesProgrammees: number;
  montantProgramme: number;
  retardProgramme: number;
  envoisAutoAttention: number;
  biblio: number;
}

/** Nombre de ressources publiées récemment, signalé sur le groupe « Ressources ». */
const nbNouvellesRessources = compterGuidesNouveaux();

/** Date ISO du guide le plus récent du thème « Sécurité du compte » (badge « Nouveau »). */
const dateSecuriteRecente = sujetDateRecente("securite-du-compte");

/** Classes communes à tous les liens de la barre latérale (état actif / survol). */
function classeLien(isActive: boolean): string {
  return `relative flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
    isActive
      ? "bg-primary-100 text-primary-800"
      : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
  }`;
}

/** Retire les accents et passe en minuscules, pour une recherche tolérante. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Une entrée correspond-elle au chemin courant ? (respecte la correspondance exacte `end`). */
function estActif(item: ItemNav, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Pastille « relances en retard » avec son infobulle détaillée. */
function BadgeRelances({
  enRetard,
  critiques,
  montantRetard,
  retardCible,
  onOuvrir,
}: {
  enRetard: number;
  critiques: number;
  montantRetard: number;
  retardCible: number;
  onOuvrir: () => void;
}) {
  return (
    <span className="relative group ml-auto inline-flex items-center">
      <span
        role="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOuvrir();
        }}
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-background-50 text-[10px] font-bold cursor-pointer hover:bg-red-600 transition-colors"
        aria-label={`${enRetard} relance(s) en retard — ouvrir la liste filtrée`}
      >
        {enRetard > 99 ? "99+" : enRetard}
      </span>
      <span className="pointer-events-none absolute right-0 bottom-full mb-2 z-50 hidden group-hover:block w-52 p-3 rounded-lg bg-background-50 border border-background-200 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground-900 mb-1.5">
          <i className="ri-alarm-warning-line text-red-500"></i>
          Relances en retard
        </span>
        <span className="flex items-center justify-between text-[11px] text-foreground-600">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-time-line text-red-500"></i>
            À traiter
          </span>
          <strong className="text-foreground-900 tabular-nums">{enRetard}</strong>
        </span>
        <span className="flex items-center justify-between text-[11px] text-foreground-600 mt-1.5">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-money-euro-circle-line text-accent-600"></i>
            Montant en jeu
          </span>
          <strong className="text-foreground-900 tabular-nums">{formatEuros(montantRetard)}</strong>
        </span>
        {critiques > 0 && (
          <span className="flex items-center justify-between text-[11px] text-foreground-500 mt-2 pt-2 border-t border-background-200">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-fire-line text-secondary-600"></i>
              Dont critiques (+30 j)
            </span>
            <strong className="text-foreground-900 tabular-nums">{critiques}</strong>
          </span>
        )}
      </span>
    </span>
  );
}

/** Pastille « relances programmées » avec son infobulle détaillée. */
function BadgeRelancesProgrammees({
  relancesProgrammees,
  montantProgramme,
  retardProgramme,
  onOuvrir,
}: {
  relancesProgrammees: number;
  montantProgramme: number;
  retardProgramme: number;
  onOuvrir: () => void;
}) {
  return (
    <span className="relative group ml-auto inline-flex items-center">
      <span
        role="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOuvrir();
        }}
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold cursor-pointer hover:bg-accent-600 transition-colors"
        aria-label={`${relancesProgrammees} relance(s) programmée(s) — ouvrir la page`}
      >
        {relancesProgrammees > 99 ? "99+" : relancesProgrammees}
      </span>
      <span className="pointer-events-none absolute right-0 bottom-full mb-2 z-50 hidden group-hover:block w-56 p-3 rounded-lg bg-background-50 border border-background-200 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground-900 mb-1.5">
          <i className="ri-calendar-schedule-line text-accent-600"></i>
          Relances programmées
        </span>
        <span className="flex items-center justify-between text-[11px] text-foreground-600">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-calendar-check-line text-accent-600"></i>
            À venir
          </span>
          <strong className="text-foreground-900 tabular-nums">{relancesProgrammees}</strong>
        </span>
        <span className="flex items-center justify-between text-[11px] text-foreground-600 mt-1.5">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-money-euro-circle-line text-secondary-600"></i>
            Montant concerné
          </span>
          <strong className="text-foreground-900 tabular-nums">{formatEuros(montantProgramme)}</strong>
        </span>
        {retardProgramme > 0 && (
          <span className="flex items-center justify-between text-[11px] text-foreground-500 mt-2 pt-2 border-t border-background-200">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-alarm-warning-line text-red-500"></i>
              Dont en retard
            </span>
            <strong className="text-foreground-900 tabular-nums">{retardProgramme}</strong>
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Navigation de l'espace artisan, sous forme de sous-thèmes repliables (accordéons) avec un champ
 * de recherche qui filtre les entrées au fur et à mesure. Les groupes repliés sont mémorisés sur
 * le poste, et le groupe de la page courante se rouvre automatiquement.
 */
export default function EspaceArtisanNav({
  enRetard,
  critiques,
  montantRetard,
  retardCible,
  relancesProgrammees,
  montantProgramme,
  retardProgramme,
  envoisAutoAttention,
  biblio,
}: EspaceArtisanNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState("");
  const [replies, setReplies] = usePersistedState(MENU_GROUPES_REPLIES_CLE, VALIDER_GROUPES_REPLIES);

  // Regroupe les entrées par sous-thème, en conservant l'ordre d'apparition.
  const groupes = useMemo(() => {
    const ordre: string[] = [];
    const map = new Map<string, ItemNav[]>();
    navItems.forEach((item) => {
      if (!map.has(item.groupe)) {
        map.set(item.groupe, []);
        ordre.push(item.groupe);
      }
      map.get(item.groupe)!.push(item);
    });
    return ordre.map((titre) => ({ titre, items: map.get(titre) ?? [] }));
  }, []);

  const q = normaliser(recherche);
  const rechercheActive = q.length > 0;

  // Groupes filtrés par la recherche (un groupe sans résultat est masqué).
  const groupesAffiches = useMemo(() => {
    if (!rechercheActive) return groupes;
    return groupes
      .map((g) => ({
        titre: g.titre,
        items: g.items.filter((i) => normaliser(`${i.label} ${i.short ?? ""} ${g.titre} ${i.hint}`).includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupes, q, rechercheActive]);

  // Le groupe « Ressources » (bibliothèque + vues favorites) est affiché sauf recherche sans correspondance.
  const ressourcesAffiche =
    !rechercheActive ||
    normaliser("ma bibliotheque ressources vues favorites securite du compte").includes(q);
  const aucunResultat = rechercheActive && groupesAffiches.length === 0 && !ressourcesAffiche;

  const ouvrir = (titre: string): boolean => rechercheActive || !replies.includes(titre);

  const basculer = (titre: string) => {
    setReplies(replies.includes(titre) ? replies.filter((g) => g !== titre) : [...replies, titre]);
  };

  const tousTitres = useMemo(() => [...groupes.map((g) => g.titre), GROUPE_RESSOURCES], [groupes]);
  const tousReplies = tousTitres.every((t) => replies.includes(t));

  const basculerTout = () => {
    setReplies(tousReplies ? [] : tousTitres);
  };

  // Rouvre automatiquement le groupe de la page courante (navigation directe par URL, lien externe…).
  useEffect(() => {
    const groupeCourant = location.pathname.startsWith("/ressources")
      ? GROUPE_RESSOURCES
      : navItems.find((i) => estActif(i, location.pathname))?.groupe;
    if (groupeCourant && replies.includes(groupeCourant)) {
      setReplies(replies.filter((g) => g !== groupeCourant));
    }
  }, [location.pathname, replies, setReplies]);

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">
        Espace artisan
      </p>

      {/* Recherche + replier/déplier tout */}
      <div className="px-3 pb-1 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 focus-within:border-primary-300 transition-colors">
          <i className="ri-search-line text-foreground-400 text-sm"></i>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer le menu…"
            aria-label="Filtrer les entrées du menu"
            className="w-full bg-transparent text-sm text-foreground-800 placeholder:text-foreground-400 outline-none"
          />
          {rechercheActive && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label="Effacer la recherche"
              title="Effacer la recherche"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 hover:text-foreground-700 cursor-pointer"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={basculerTout}
          aria-label={tousReplies ? "Déplier tous les sous-thèmes" : "Replier tous les sous-thèmes"}
          title={tousReplies ? "Déplier tous les sous-thèmes" : "Replier tous les sous-thèmes"}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:border-primary-300 hover:text-foreground-800 cursor-pointer transition-colors"
        >
          <i className={tousReplies ? "ri-expand-vertical-line" : "ri-collapse-vertical-line"}></i>
        </button>
      </div>

      {/* Sous-thèmes repliables */}
      {groupesAffiches.map((groupe) => {
        const ouvert = ouvrir(groupe.titre);
        return (
          <div key={groupe.titre} className="flex flex-col">
            <button
              type="button"
              onClick={() => basculer(groupe.titre)}
              disabled={rechercheActive}
              aria-expanded={ouvert}
              className={`flex items-center gap-2 w-full px-3 pt-3 pb-1 cursor-pointer ${
                rechercheActive ? "cursor-default" : ""
              }`}
            >
              <span className="text-[10px] font-semibold text-foreground-400/70 uppercase tracking-wider">
                {groupe.titre}
              </span>
              <i
                className={`${ouvert ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} ml-auto text-foreground-300 text-sm`}
              ></i>
            </button>

            {ouvert && (
              <div className="flex flex-col gap-1">
                {groupe.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} title={item.hint} className={({ isActive }) => classeLien(isActive)}>
                    <i className={`${item.icon} text-lg`}></i>
                    {item.label}
                    {item.to === "/app/relances" && enRetard > 0 && (
                      <BadgeRelances
                        enRetard={enRetard}
                        critiques={critiques}
                        montantRetard={montantRetard}
                        retardCible={retardCible}
                        onOuvrir={() => navigate(`/app/relances?retard=${retardCible}`)}
                      />
                    )}
                    {item.to === "/app/relances-programmees" && relancesProgrammees > 0 && (
                      <BadgeRelancesProgrammees
                        relancesProgrammees={relancesProgrammees}
                        montantProgramme={montantProgramme}
                        retardProgramme={retardProgramme}
                        onOuvrir={() => navigate("/app/relances-programmees")}
                      />
                    )}
                    {item.to === "/app/envois-automatiques" && envoisAutoAttention > 0 && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate("/app/envois-automatiques");
                        }}
                        title={`${envoisAutoAttention} automatisation(s) à vérifier`}
                        aria-label={`${envoisAutoAttention} automatisation(s) à vérifier — ouvrir la page`}
                        className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-background-50 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors"
                      >
                        {envoisAutoAttention > 99 ? "99+" : envoisAutoAttention}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Groupe Ressources : bibliothèque + vues épinglées */}
      {ressourcesAffiche && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => basculer(GROUPE_RESSOURCES)}
            disabled={rechercheActive}
            aria-expanded={ouvrir(GROUPE_RESSOURCES)}
            className={`flex items-center gap-2 w-full px-3 pt-3 pb-1 cursor-pointer ${
              rechercheActive ? "cursor-default" : ""
            }`}
          >
            <span className="text-[10px] font-semibold text-foreground-400/70 uppercase tracking-wider">
              {GROUPE_RESSOURCES}
            </span>
            <CompteurNouvellesRessources count={nbNouvellesRessources} />
            <i
              className={`${ouvrir(GROUPE_RESSOURCES) ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} ml-auto text-foreground-300 text-sm`}
            ></i>
          </button>

          {ouvrir(GROUPE_RESSOURCES) && (
            <div className="flex flex-col gap-1">
              <NavLink
                to="/ressources/sujets#sujet-securite-du-compte"
                title="Protéger votre compte, c'est protéger vos devis, vos clients et vos factures : le guide pour choisir un mot de passe solide."
                className="relative flex items-center gap-3 h-11 pl-1.5 pr-3 rounded-md text-sm font-semibold bg-accent-100 text-accent-900 hover:bg-accent-200 cursor-pointer transition-colors"
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-accent-500 text-background-50 shrink-0">
                  <i className="ri-shield-keyhole-line text-[13px]"></i>
                </span>
                Sécurité du compte
                <BadgeNouveau dateISO={dateSecuriteRecente} compact className="ml-auto" />
              </NavLink>
              <NavLink
                to="/ressources/bibliotheque"
                title="Vos articles et guides mis de côté, pour les retrouver en un clin d'œil."
                className={({ isActive }) => classeLien(isActive)}
              >
                <i className="ri-bookmark-3-line text-lg"></i>
                Ma bibliothèque
                {biblio > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                    {biblio > 99 ? "99+" : biblio}
                  </span>
                )}
              </NavLink>
              <AccesVuesFavorites />
            </div>
          )}
        </div>
      )}

      {aucunResultat && (
        <p className="px-3 py-4 text-xs text-foreground-400 text-center">
          Aucune entrée ne correspond à « {recherche.trim()} ».
        </p>
      )}
    </div>
  );
}