import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AccesVuesFavorites from "@/pages/app/components/AccesVuesFavorites";
import LienQuoiDeNeufNav from "@/pages/app/components/LienQuoiDeNeufNav";
import ModaleEcheancesJour from "@/pages/app/components/ModaleEcheancesJour";
import SousMenuClients from "@/pages/app/components/SousMenuClients";
import {
  GROUPE_AUJOURDHUI,
  GROUPE_RESSOURCES,
  GROUPE_SUIVI_CLIENTS,
  ORDRE_GROUPES_DEFAUT,
  classeLienNav,
  navItems,
  navSecondaires,
  type ItemNav,
  type ItemNavSecondaire,
} from "@/pages/app/components/menuAppData";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { EcheancesDuJour } from "@/hooks/useEcheancesDuJour";
import {
  MENU_CLIENTS_REPLIE_CLE,
  MENU_GROUPES_REPLIES_CLE,
  MENU_ORDRE_GROUPES_CLE,
  VALIDER_CLIENTS_REPLIE,
  VALIDER_GROUPES_REPLIES,
  VALIDER_ORDRE_GROUPES,
  normaliserOrdreGroupes,
} from "@/lib/menuSidebarPrefs";
import { formatEuros } from "@/lib/format";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import CompteurNouvellesRessources from "@/components/base/CompteurNouvellesRessources";
import { compterGuidesNouveaux, sujetDateRecente } from "@/mocks/ressources";

/** Compteur cumulé d'un sous-thème, affiché sur le titre du groupe même quand il est replié. */
interface CompteurGroupe {
  /** Somme des pastilles des entrées du groupe. */
  total: number;
  /** Vrai dès qu'une entrée du groupe est en alerte rouge (retard ou automatisation à vérifier). */
  urgent: boolean;
  /** Détail lisible repris dans l'infobulle (ex. « 3 relances en retard »). */
  details: string[];
}

/** Un groupe de la barre latérale : ses entrées de page et ses modules secondaires. */
interface GroupeNav {
  /** Libellé du groupe (sert aussi d'identifiant de glisser-déposer). */
  titre: string;
  /** Entrées de navigation classiques. */
  items: ItemNav[];
  /** Modules secondaires rendus en fin de groupe (bibliothèque, vues épinglées…). */
  secondaires: ItemNavSecondaire[];
}

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
  /** Factures électroniques rejetées à corriger : pastille sur l'entrée « Facturation électronique ». */
  rejetsEfacture: number;
  /** Échéances du jour : encaissements attendus et relances qui partent aujourd'hui. */
  echeancesJour: EcheancesDuJour;
  /** Nombre d'entreprises au carnet : pastille de la sous-entrée « Entreprises ». */
  clientsPro: number;
  /** Nombre de particuliers au carnet : pastille de la sous-entrée « Particuliers ». */
  clientsParticuliers: number;
  /** Chantiers dont le client n'a plus de nouvelles depuis 14 jours : pastille de « Chantiers ». */
  chantiersSansNouvelles: number;
  /** Mois comptables manquants : pastille du bloc « Comptabilité ». */
  moisManquants: number;
  /** Réservé aux comptes autorisés à voir la comptabilité. */
  voirComptabilite: boolean;
  /** Masque le lien « Quoi de neuf » (le tiroir mobile affiche son propre compteur en tête). */
  masquerQuoiDeNeuf?: boolean;
}

/** Nombre de ressources publiées récemment, signalé sur le groupe « Ressources ». */
const nbNouvellesRessources = compterGuidesNouveaux();

/** Date ISO du guide le plus récent du thème « Sécurité du compte » (badge « Nouveau »). */
const dateSecuriteRecente = sujetDateRecente("securite-du-compte");

/** Mots-clés du groupe « Ressources » pour la recherche du menu. */
const MOTS_RESSOURCES = "ressources securite du compte mot de passe guide";

/** Retire les accents et passe en minuscules, pour une recherche tolérante. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Petit pluriel français (« 1 facture », « 2 factures »). */
function pluriel(nombre: number, singulier: string, plurielMot = `${singulier}s`): string {
  return `${nombre} ${nombre > 1 ? plurielMot : singulier}`;
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
  onOuvrir,
}: {
  enRetard: number;
  critiques: number;
  montantRetard: number;
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
 * En-tête repliable d'un groupe, déplaçable par glisser-déposer.
 * Deux boutons distincts : la poignée (glisser) et le titre (replier/déplier), pour rester
 * utilisable au clavier et au lecteur d'écran.
 */
function GroupeRepliable({
  titre,
  ouvert,
  compteur,
  badge,
  reorderPossible,
  rechercheActive,
  onBasculer,
  onOuvrirCompteur,
  onApercuCompteur,
  children,
}: {
  titre: string;
  ouvert: boolean;
  compteur?: CompteurGroupe;
  badge?: ReactNode;
  reorderPossible: boolean;
  rechercheActive: boolean;
  onBasculer: () => void;
  /** Rend le compteur du groupe cliquable (ouvre la liste pré-filtrée correspondante). */
  onOuvrirCompteur?: () => void;
  /** Affiche un bouton « œil » à côté du compteur (aperçu rapide sans quitter la page). */
  onApercuCompteur?: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: titre,
    disabled: !reorderPossible,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-md ${isDragging ? "relative z-20 bg-background-100 opacity-90" : ""}`}
    >
      <div className="flex items-center gap-1 pl-1 pr-1 pt-3 pb-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Déplacer le bloc « ${titre} »`}
          title={
            reorderPossible
              ? "Glisser pour réordonner ce bloc (ordre mémorisé)"
              : "Le réordonnancement est indisponible pendant une recherche"
          }
          className={`shrink-0 w-5 h-6 flex items-center justify-center rounded text-foreground-300 hover:text-foreground-700 hover:bg-background-200 touch-none transition-colors ${
            reorderPossible ? "cursor-grab active:cursor-grabbing" : "invisible"
          }`}
        >
          <i className="ri-draggable text-[13px]"></i>
        </button>

        <button
          type="button"
          onClick={onBasculer}
          disabled={rechercheActive}
          aria-expanded={ouvert}
          className={`flex items-center gap-2 flex-1 min-w-0 h-6 px-1 ${
            rechercheActive ? "cursor-default" : "cursor-pointer"
          }`}
        >
          <span className="text-[10px] font-semibold text-foreground-400/70 uppercase tracking-wider truncate">
            {titre}
          </span>
          {badge}
          <i
            className={`${ouvert ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} ml-auto text-foreground-300 text-sm`}
          ></i>
        </button>

        {/* Compteur hors du bouton d'accordéon : un clic ouvre la liste déjà filtrée. */}
        {compteur &&
          (onOuvrirCompteur ? (
            <button
              type="button"
              onClick={onOuvrirCompteur}
              title={`${compteur.details.join(" · ")} — cliquer pour ouvrir la liste filtrée`}
              aria-label={`Groupe ${titre} : ${compteur.details.join(", ")} — ouvrir la liste filtrée`}
              className={`shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums whitespace-nowrap cursor-pointer transition-colors ${
                compteur.urgent
                  ? "bg-red-500 text-background-50 hover:bg-red-600"
                  : "bg-accent-100 text-accent-800 hover:bg-accent-200"
              }`}
            >
              {compteur.total > 99 ? "99+" : compteur.total}
            </button>
          ) : (
            <span
              title={compteur.details.join(" · ")}
              aria-label={`Groupe ${titre} : ${compteur.details.join(", ")}`}
              className={`shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                compteur.urgent ? "bg-red-500 text-background-50" : "bg-accent-100 text-accent-800"
              }`}
            >
              {compteur.total > 99 ? "99+" : compteur.total}
            </span>
          ))}

        {/* Aperçu rapide des factures à encaisser, sans quitter la page courante. */}
        {compteur && onApercuCompteur && (
          <button
            type="button"
            onClick={onApercuCompteur}
            title="Voir les factures à encaisser (aperçu rapide, sans quitter la page)"
            aria-label={`Voir les factures à encaisser du groupe ${titre} — aperçu rapide`}
            className="shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded text-foreground-300 hover:text-foreground-800 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className="ri-eye-line text-[12px]"></i>
          </button>
        )}
      </div>

      {ouvert && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  );
}

/**
 * Navigation de l'espace artisan, sous forme de sous-thèmes repliables (accordéons) avec un champ
 * de recherche qui filtre les entrées au fur et à mesure. Les groupes repliés **et leur ordre**
 * sont mémorisés sur le poste, et le groupe de la page courante se rouvre automatiquement.
 * Chaque groupe se réordonne par glisser-déposer depuis sa poignée.
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
  rejetsEfacture,
  echeancesJour,
  clientsPro,
  clientsParticuliers,
  chantiersSansNouvelles,
  moisManquants,
  voirComptabilite,
  masquerQuoiDeNeuf = false,
}: EspaceArtisanNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState("");
  // Aperçu rapide des factures à encaisser (ouvert depuis l'œil de la pastille « Aujourd'hui »).
  const [apercuEcheances, setApercuEcheances] = useState(false);
  const [replies, setReplies] = usePersistedState(MENU_GROUPES_REPLIES_CLE, VALIDER_GROUPES_REPLIES);
  const [ordreMemorise, setOrdreMemorise] = usePersistedState(MENU_ORDRE_GROUPES_CLE, VALIDER_ORDRE_GROUPES);
  // Sous-liste du bloc « Clients » : dépliée par défaut, état mémorisé sur le poste.
  const [clientsReplie, setClientsReplie] = usePersistedState(MENU_CLIENTS_REPLIE_CLE, VALIDER_CLIENTS_REPLIE);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Entrées réellement affichables : la comptabilité n'apparaît que pour les comptes qui y ont accès.
  const itemsVisibles = useMemo(
    () => navItems.filter((item) => item.to !== "/app/comptabilite" || voirComptabilite),
    [voirComptabilite],
  );

  // Assemble les groupes : entrées de page, puis modules secondaires (bibliothèque, vues épinglées).
  const groupesBase = useMemo<GroupeNav[]>(() => {
    const map = new Map<string, GroupeNav>();
    const garantir = (titre: string): GroupeNav => {
      const existant = map.get(titre);
      if (existant) return existant;
      const cree: GroupeNav = { titre, items: [], secondaires: [] };
      map.set(titre, cree);
      return cree;
    };
    itemsVisibles.forEach((item) => garantir(item.groupe).items.push(item));
    navSecondaires.forEach((sec) => garantir(sec.groupe).secondaires.push(sec));
    garantir(GROUPE_RESSOURCES);
    return Array.from(map.values());
  }, [itemsVisibles]);

  // Ordre mémorisé (glisser-déposer), complété automatiquement si de nouveaux groupes apparaissent.
  const ordre = useMemo(
    () => normaliserOrdreGroupes(ORDRE_GROUPES_DEFAUT, ordreMemorise),
    [ordreMemorise],
  );

  const groupesOrdonnes = useMemo(() => {
    const parTitre = new Map(groupesBase.map((g) => [g.titre, g]));
    return ordre
      .map((titre) => parTitre.get(titre))
      .filter((g): g is GroupeNav => Boolean(g));
  }, [groupesBase, ordre]);

  // Compteurs cumulés par groupe : additionne les pastilles des lignes pour que l'alerte reste
  // visible même quand le sous-thème est replié (sinon une relance en retard peut se cacher).
  const compteursGroupes = useMemo(() => {
    const map = new Map<string, CompteurGroupe>();
    const ajouter = (groupe: string, nombre: number, urgent: boolean, details: string[]) => {
      if (nombre <= 0) return;
      const courant = map.get(groupe) ?? { total: 0, urgent: false, details: [] };
      courant.total += nombre;
      courant.urgent = courant.urgent || urgent;
      courant.details.push(...details);
      map.set(groupe, courant);
    };

    // « Aujourd'hui » : ce qu'il reste à encaisser et ce qui part tout seul aujourd'hui.
    const detailsJour: string[] = [];
    if (echeancesJour.facturesJour > 0) {
      detailsJour.push(`${pluriel(echeancesJour.facturesJour, "facture")} à encaisser aujourd'hui`);
    }
    if (echeancesJour.facturesRetard > 0) {
      detailsJour.push(
        `${pluriel(echeancesJour.facturesRetard, "facture")} en retard (${formatEuros(echeancesJour.montant)} en jeu)`,
      );
    }
    if (echeancesJour.relancesJour > 0) {
      detailsJour.push(`${pluriel(echeancesJour.relancesJour, "relance")} à partir aujourd'hui`);
    }
    ajouter(
      GROUPE_AUJOURDHUI,
      echeancesJour.facturesJour + echeancesJour.facturesRetard + echeancesJour.relancesJour,
      echeancesJour.facturesRetard > 0,
      detailsJour,
    );

    itemsVisibles.forEach((item) => {
      if (item.to === "/app/relances") {
        ajouter(item.groupe, enRetard, true, [`${pluriel(enRetard, "relance")} en retard`]);
      } else if (item.to === "/app/relances-programmees") {
        ajouter(item.groupe, relancesProgrammees, false, [
          `${pluriel(relancesProgrammees, "relance")} programmée${relancesProgrammees > 1 ? "s" : ""}`,
        ]);
      } else if (item.to === "/app/envois-automatiques") {
        ajouter(item.groupe, envoisAutoAttention, true, [
          `${pluriel(envoisAutoAttention, "automatisation")} à vérifier`,
        ]);
      } else if (item.to === "/app/chantiers") {
        ajouter(item.groupe, chantiersSansNouvelles, false, [
          `${pluriel(chantiersSansNouvelles, "chantier")} sans nouvelles depuis 14 jours`,
        ]);
      }
    });

    return map;
  }, [enRetard, relancesProgrammees, envoisAutoAttention, echeancesJour, itemsVisibles, chantiersSansNouvelles]);

  const q = normaliser(recherche);
  const rechercheActive = q.length > 0;

  // Groupes filtrés par la recherche (un groupe sans résultat est masqué).
  const groupesAffiches = useMemo(() => {
    if (!rechercheActive) return groupesOrdonnes;
    return groupesOrdonnes
      .map((g) => ({
        ...g,
        items:
          g.titre === GROUPE_RESSOURCES
            ? []
            : g.items.filter((i) =>
                normaliser(
                  `${i.label} ${i.short ?? ""} ${g.titre} ${i.hint} ${(i.sousEntrees ?? [])
                    .map((s) => `${s.label} ${s.hint}`)
                    .join(" ")}`,
                ).includes(q),
              ),
        secondaires: g.secondaires.filter((s) =>
          normaliser(`${s.label} ${s.groupe} ${s.hint} ${s.motsCles}`).includes(q),
        ),
      }))
      .filter((g) =>
        g.titre === GROUPE_RESSOURCES
          ? normaliser(MOTS_RESSOURCES).includes(q)
          : g.items.length > 0 || g.secondaires.length > 0,
      );
  }, [groupesOrdonnes, q, rechercheActive]);

  const aucunResultat = rechercheActive && groupesAffiches.length === 0;

  const ouvrir = (titre: string): boolean => rechercheActive || !replies.includes(titre);

  const basculer = (titre: string) => {
    setReplies(replies.includes(titre) ? replies.filter((g) => g !== titre) : [...replies, titre]);
  };

  const tousReplies = ordre.every((t) => replies.includes(t));

  // « Tout replier » / « Tout déplier » entraîne aussi la sous-liste Particuliers / Entreprises
  // du bloc Clients : elle vit dans sa propre préférence, on l'aligne donc sur le mouvement général.
  const basculerTout = () => {
    const replierTout = !tousReplies;
    setReplies(replierTout ? [...ordre] : []);
    setClientsReplie(replierTout);
  };

  // L'ordre affiché est-il encore celui d'origine ? (sert à désactiver le bouton de rétablissement)
  const ordreParDefaut = ordre.join("|") === ORDRE_GROUPES_DEFAUT.join("|");

  /** Revient au classement d'origine des blocs, en oubliant l'ordre personnalisé mémorisé. */
  const retablirOrdre = () => {
    setOrdreMemorise([]);
  };

  // Glisser-déposer : déplace le bloc et mémorise le nouvel ordre complet.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ancienIndex = ordre.indexOf(String(active.id));
    const nouveauIndex = ordre.indexOf(String(over.id));
    if (ancienIndex < 0 || nouveauIndex < 0) return;
    const copie = [...ordre];
    const [deplace] = copie.splice(ancienIndex, 1);
    copie.splice(nouveauIndex, 0, deplace);
    setOrdreMemorise(copie);
  };

  // Rouvre automatiquement le groupe de la page courante (navigation directe par URL, lien externe…).
  useEffect(() => {
    let groupeCourant: string | undefined;
    if (location.pathname === "/ressources/bibliotheque") {
      // « Ma bibliothèque » vit désormais dans le groupe « Suivi clients ».
      groupeCourant = GROUPE_SUIVI_CLIENTS;
    } else if (location.pathname.startsWith("/ressources")) {
      groupeCourant = GROUPE_RESSOURCES;
    } else {
      groupeCourant = itemsVisibles.find((i) => estActif(i, location.pathname))?.groupe;
    }
    if (groupeCourant && replies.includes(groupeCourant)) {
      setReplies(replies.filter((g) => g !== groupeCourant));
    }
  }, [location.pathname, replies, setReplies, itemsVisibles]);

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">
        Espace artisan
      </p>

      {/* Recherche du menu */}
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
      </div>

      {/* Replier / déplier tout + revenir au classement d'origine */}
      <div className="px-3 pb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={basculerTout}
          aria-label={tousReplies ? "Déplier tous les sous-thèmes" : "Replier tous les sous-thèmes"}
          title={tousReplies ? "Déplier tous les sous-thèmes" : "Replier tous les sous-thèmes"}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-foreground-900 transition-colors"
        >
          <i className={tousReplies ? "ri-expand-vertical-line" : "ri-collapse-vertical-line"}></i>
          {tousReplies ? "Tout déplier" : "Tout replier"}
        </button>
        <button
          type="button"
          onClick={retablirOrdre}
          disabled={ordreParDefaut}
          aria-label="Rétablir l'ordre du menu"
          title={
            ordreParDefaut
              ? "Le menu est déjà dans son ordre d'origine"
              : "Rétablir l'ordre d'origine du menu (annule votre classement personnalisé)"
          }
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-foreground-900 transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-background-200 disabled:hover:text-foreground-600"
        >
          <i className="ri-arrow-go-back-line"></i>
          Rétablir l&apos;ordre
        </button>
      </div>

      {/* Journal des nouveautés : même pastille que le compteur de l'en-tête, toujours accessible. */}
      {!masquerQuoiDeNeuf && (
        <div className="px-1 pb-1">
          <LienQuoiDeNeufNav />
        </div>
      )}

      {/* Sous-thèmes repliables, réordonnables par glisser-déposer */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={[...ordre]} strategy={verticalListSortingStrategy}>
          {groupesAffiches.map((groupe) => {
            const ouvert = ouvrir(groupe.titre);
            const estRessources = groupe.titre === GROUPE_RESSOURCES;
            return (
              <GroupeRepliable
                key={groupe.titre}
                titre={groupe.titre}
                ouvert={ouvert}
                compteur={compteursGroupes.get(groupe.titre)}
                badge={estRessources ? <CompteurNouvellesRessources count={nbNouvellesRessources} /> : undefined}
                reorderPossible={!rechercheActive}
                rechercheActive={rechercheActive}
                onBasculer={() => basculer(groupe.titre)}
                onOuvrirCompteur={
                  groupe.titre === GROUPE_AUJOURDHUI
                    ? () => navigate("/app/factures?encaisser=jour")
                    : undefined
                }
                onApercuCompteur={
                  groupe.titre === GROUPE_AUJOURDHUI && echeancesJour.factures.length > 0
                    ? () => setApercuEcheances(true)
                    : undefined
                }
              >
                {estRessources ? (
                  <>
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
                  </>
                ) : (
                  <>
                    {groupe.items.map((item) => {
                      // Le carnet de clients porte ses deux portes d'entrée (particuliers / entreprises).
                      if (item.to === "/app/clients") {
                        return (
                          <SousMenuClients
                            key={item.to}
                            item={item}
                            nbParticuliers={clientsParticuliers}
                            nbEntreprises={clientsPro}
                            replie={clientsReplie && !rechercheActive}
                            onBasculer={() => setClientsReplie(!clientsReplie)}
                          />
                        );
                      }
                      return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={item.hint}
                        className={({ isActive }) => classeLienNav(isActive)}
                      >
                        <i className={`${item.icon} text-lg`}></i>
                        {item.label}
                        {item.to === "/app/comptabilite" && moisManquants > 0 && (
                          <span
                            title={`${moisManquants} mois manquant${moisManquants > 1 ? "s" : ""} pour votre comptable`}
                            aria-label={`${moisManquants} mois manquant(s) — ouvrir la comptabilité`}
                            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums"
                          >
                            {moisManquants > 99 ? "99+" : moisManquants}
                          </span>
                        )}
                        {item.to === "/app/relances" && enRetard > 0 && (
                          <BadgeRelances
                            enRetard={enRetard}
                            critiques={critiques}
                            montantRetard={montantRetard}
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
                        {item.to === "/app/chantiers" && chantiersSansNouvelles > 0 && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate("/app/chantiers?sans-nouvelles=1");
                            }}
                            title={`${pluriel(chantiersSansNouvelles, "chantier")} sans nouvelles depuis 14 jours — ouvrir la liste filtrée`}
                            aria-label={`${chantiersSansNouvelles} chantier(s) sans nouvelles — ouvrir la liste filtrée`}
                            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                          >
                            {chantiersSansNouvelles > 99 ? "99+" : chantiersSansNouvelles}
                          </span>
                        )}
                        {item.to === "/app/facturation-electronique" && rejetsEfacture > 0 && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate("/app/facturation-electronique?statut=rejetee");
                            }}
                            title={`${rejetsEfacture} facture${rejetsEfacture > 1 ? "s" : ""} électronique${rejetsEfacture > 1 ? "s" : ""} rejetée${rejetsEfacture > 1 ? "s" : ""} à corriger — ouvrir le registre filtré`}
                            aria-label={`${rejetsEfacture} facture(s) électronique(s) rejetée(s) — ouvrir le registre filtré`}
                            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                          >
                            {rejetsEfacture > 99 ? "99+" : rejetsEfacture}
                          </span>
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
                      );
                    })}

                    {groupe.secondaires.map((sec) =>
                      sec.id === "bibliotheque" ? (
                        <NavLink
                          key={sec.id}
                          to="/ressources/bibliotheque"
                          title={sec.hint}
                          className={({ isActive }) => classeLienNav(isActive)}
                        >
                          <i className={`${sec.icon} text-lg`}></i>
                          {sec.label}
                          {biblio > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                              {biblio > 99 ? "99+" : biblio}
                            </span>
                          )}
                        </NavLink>
                      ) : (
                        <AccesVuesFavorites key={sec.id} />
                      ),
                    )}
                  </>
                )}
              </GroupeRepliable>
            );
          })}
        </SortableContext>
      </DndContext>

      {aucunResultat && (
        <p className="px-3 py-4 text-xs text-foreground-400 text-center">
          Aucune entrée ne correspond à « {recherche.trim()} ».
        </p>
      )}

      <p className="px-3 pt-3 text-[10px] text-foreground-300 leading-relaxed">
        Astuce : glissez les titres de bloc pour ranger votre menu à votre façon.
      </p>

      {apercuEcheances && (
        <ModaleEcheancesJour
          echeances={echeancesJour}
          onOuvrirListe={() => {
            setApercuEcheances(false);
            navigate("/app/factures?encaisser=jour");
          }}
          onClose={() => setApercuEcheances(false)}
        />
      )}
    </div>
  );
}