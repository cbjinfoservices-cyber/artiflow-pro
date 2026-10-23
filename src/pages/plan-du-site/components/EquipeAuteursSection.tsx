import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { equipe } from "@/mocks/equipe";
import { articlesDuMembre } from "@/mocks/auteurs";
import { episodesDuMembre } from "@/mocks/podcasts";
import { estEnLigne } from "@/mocks/interventions";
import {
  type RoleFiltre,
  type TriGuidesMode,
  type TriMode,
  CLE_FAVORIS,
  CLE_FAVORIS_ORIGINE,
  CLE_RECHERCHE,
  CLE_ROLE,
  CLE_TRI_GUIDES,
  estRoleValide,
  estTriGuidesValide,
  estTriValide,
  lireFavoris,
  lireFavorisOrigine,
  lireProfilActif,
  lireProfils,
  lireRechercheMemorisee,
  lireRoleMemorise,
  lireTriGuidesMemorise,
  normaliser,
  rolesFiltre,
  trierGuides,
  triGuidesOptions,
  triOptions,
} from "@/pages/plan-du-site/components/equipePreferences";
import { useProfilsFavoris } from "@/pages/plan-du-site/components/useProfilsFavoris";
import { originePublique } from "@/lib/site";

/**
 * Section « Équipe & auteurs » du plan du site : chaque membre dispose d'une
 * carte résumant ses guides et ses épisodes podcast. On peut rechercher par
 * nom, filtrer par rôle, trier les membres (ordre, nombre de contenus, nom) et
 * trier les guides listés (par date ou par titre).
 */
export default function EquipeAuteursSection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState(() => searchParams.get("q") ?? "");
  // Dernière recherche mémorisée, reproposée comme suggestion quand le champ est vide.
  const [rechercheMemoire, setRechercheMemoire] = useState(() => lireRechercheMemorisee());
  const [tri, setTri] = useState<TriMode>(() => estTriValide(searchParams.get("tri")));
  const [roleFiltre, setRoleFiltre] = useState<RoleFiltre>(() => {
    const depuisUrl = searchParams.get("role");
    return depuisUrl ? estRoleValide(depuisUrl) : lireRoleMemorise();
  });
  const [triGuides, setTriGuides] = useState<TriGuidesMode>(() => {
    const depuisUrl = searchParams.get("guides");
    return depuisUrl ? estTriGuidesValide(depuisUrl) : lireTriGuidesMemorise();
  });
  // Indique que le tri des guides affiché provient de la préférence mémorisée
  // (et non de l'URL), pour expliquer à l'utilisateur pourquoi l'ordre est imposé.
  const [triGuidesMemorise, setTriGuidesMemorise] = useState(() => {
    if (searchParams.get("guides")) return false;
    return lireTriGuidesMemorise() !== "catalogue";
  });
  // Indique que le filtre par rôle affiché provient de la préférence mémorisée
  // (et non de l'URL), pour signaler pourquoi il est appliqué automatiquement.
  const [roleMemorise, setRoleMemorise] = useState(() => {
    if (searchParams.get("role")) return false;
    return lireRoleMemorise() !== "tous";
  });
  const [membreCible, setMembreCible] = useState<string | null>(() =>
    searchParams.get("membre")
  );
  const [flashCible, setFlashCible] = useState(() => Boolean(searchParams.get("membre")));
  const [lienCopie, setLienCopie] = useState(false);
  const [partageDisponible, setPartageDisponible] = useState(false);
  // Membres épinglés en favoris, remontés en tête de grille à chaque visite.
  // Si un profil de favoris était actif au dernier passage, on repart de sa
  // sélection : le profil est ainsi retrouvé appliqué automatiquement.
  const [favoris, setFavoris] = useState<string[]>(() => {
    const idActif = lireProfilActif();
    if (idActif) {
      const profil = lireProfils().find((p) => p.id === idActif);
      if (profil) return [...profil.favoris];
    }
    return lireFavoris();
  });
  // Ordre d'épinglage d'origine, conservé pour pouvoir revenir en arrière d'un clic.
  const [favorisOrigine, setFavorisOrigine] = useState<string[]>(() => {
    const ordre = lireFavorisOrigine();
    return ordre.length > 0 ? ordre : lireFavoris();
  });
  // Suivi du glisser-déposer pour réordonner les favoris à la souris.
  const [dragFavoriId, setDragFavoriId] = useState<string | null>(null);
  const [dragSurId, setDragSurId] = useState<string | null>(null);
  // Surligne la zone « déposer ici pour épingler » quand une carte la survole.
  const [surZoneDrop, setSurZoneDrop] = useState(false);
  // Favori actuellement sélectionné (pour le réordonnancement au clavier).
  const [favoriSelectionne, setFavoriSelectionne] = useState<string | null>(null);
  // Filtre rapide : n'afficher que les membres épinglés en favoris.
  const [favorisSeuls, setFavorisSeuls] = useState(
    () => searchParams.get("favoris") === "1"
  );
  // Ouvre le popover de préférences au clic (le survol ne suffit pas sur tablette).
  const [popoverPreferences, setPopoverPreferences] = useState(false);
  // Cible de l'animation d'épinglage/dépinglage : surligne brièvement la carte concernée.
  const [animationFavori, setAnimationFavori] = useState<{
    id: string;
    type: "pin" | "unpin";
  } | null>(null);
  // Profils de favoris nommés : toute la logique (état, actions, persistance du
  // profil actif, renommage, duplication, réordonnancement, import/export) est
  // regroupée dans ce hook dédié, pour alléger la section.
  const {
    profils,
    profilActif,
    profilActifObj,
    popoverProfils,
    setPopoverProfils,
    popoverProfilsRef,
    inputFichierRef,
    nomProfil,
    setNomProfil,
    profilEnRenommage,
    nomRenommage,
    setNomRenommage,
    profilApercu,
    setProfilApercu,
    messageProfils,
    dragProfilId,
    dragProfilSurId,
    setDragProfilId,
    setDragProfilSurId,
    enregistrerProfil,
    appliquerProfil,
    dupliquerProfil,
    supprimerProfil,
    deplacerProfil,
    deplacerProfilVers,
    demarrerRenommage,
    annulerRenommage,
    validerRenommage,
    exporterProfils,
    importerProfils,
    reinitialiserProfils,
  } = useProfilsFavoris({ favoris, setFavoris, favorisOrigine, setFavorisOrigine });
  // Toast de confirmation affiché après une remise à zéro complète.
  const [toastReinit, setToastReinit] = useState(false);
  // Demande de confirmation discrète avant d'effacer définitivement favoris,
  // profils et préférences (évite la remise à zéro accidentelle).
  const [confirmReinit, setConfirmReinit] = useState(false);
  const timerCopie = useRef<number | null>(null);
  const timerAnimation = useRef<number | null>(null);
  const timerReinit = useRef<number | null>(null);
  const carteCibleRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const confirmReinitRef = useRef<HTMLSpanElement | null>(null);

  // Nettoie les minuteurs de confirmation et d'animation si le composant est démonté.
  useEffect(
    () => () => {
      if (timerCopie.current) window.clearTimeout(timerCopie.current);
      if (timerAnimation.current) window.clearTimeout(timerAnimation.current);
      if (timerReinit.current) window.clearTimeout(timerReinit.current);
    },
    []
  );

  // Coupe le clignotement de la carte ciblée une fois l'animation terminée.
  useEffect(() => {
    if (!flashCible) return;
    const t = window.setTimeout(() => setFlashCible(false), 2700);
    return () => window.clearTimeout(t);
  }, [flashCible]);

  // Fait défiler jusqu'au membre ciblé uniquement si sa carte est hors de l'écran
  // (grille plus longue que la fenêtre), pour ne pas casser l'arrivée sur la section.
  useEffect(() => {
    if (!membreCible) return;
    const carte = carteCibleRef.current;
    if (!carte) return;
    const t = window.setTimeout(() => {
      const rect = carte.getBoundingClientRect();
      const horsEcran = rect.top < 90 || rect.bottom > window.innerHeight;
      if (!horsEcran) return;
      carte.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 380);
    return () => window.clearTimeout(t);
  }, [membreCible]);

  // Détecte la disponibilité du partage natif (Web Share API, surtout sur mobile).
  useEffect(() => {
    setPartageDisponible(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  // Mémorise le dernier tri des guides choisi pour le réappliquer à la prochaine visite.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_TRI_GUIDES, triGuides);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [triGuides]);

  // Mémorise le dernier filtre par rôle choisi pour le réappliquer à la prochaine visite.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_ROLE, roleFiltre);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [roleFiltre]);

  // Mémorise la dernière recherche saisie pour la reproposer au prochain passage.
  useEffect(() => {
    const terme = recherche.trim();
    if (!terme) return;
    try {
      window.localStorage.setItem(CLE_RECHERCHE, terme);
      setRechercheMemoire(terme);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [recherche]);

  // Mémorise les membres épinglés pour les retrouver en tête de grille à la prochaine visite.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_FAVORIS, JSON.stringify(favoris));
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [favoris]);

  // Mémorise l'ordre d'épinglage d'origine (utile pour le bouton de réinitialisation).
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CLE_FAVORIS_ORIGINE,
        JSON.stringify(favorisOrigine)
      );
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [favorisOrigine]);

  // Ferme le popover de préférences au clic à l'extérieur ou avec Échap.
  useEffect(() => {
    if (!popoverPreferences) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverPreferences(false);
      }
    };
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverPreferences(false);
    };
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [popoverPreferences]);

  // Ferme la demande de confirmation de remise à zéro au clic à l'extérieur ou avec Échap.
  useEffect(() => {
    if (!confirmReinit) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (confirmReinitRef.current && !confirmReinitRef.current.contains(e.target as Node)) {
        setConfirmReinit(false);
      }
    };
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmReinit(false);
    };
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [confirmReinit]);

  // Mémorise les filtres actifs dans l'URL pour pouvoir partager une vue précise.
  useEffect(() => {
    const next = new URLSearchParams();
    const terme = recherche.trim();
    if (terme) next.set("q", terme);
    if (roleFiltre !== "tous") next.set("role", roleFiltre);
    if (tri !== "equipe") next.set("tri", tri);
    if (triGuides !== "catalogue") next.set("guides", triGuides);
    if (favorisSeuls) next.set("favoris", "1");
    if (membreCible) next.set("membre", membreCible);

    // On ne compare que les clés que l'on gère, pour ne pas re-naviguer inutilement
    // au montage et conserver l'ancre #equipe-auteurs du lien entrant.
    const actuels = new URLSearchParams();
    ["q", "role", "tri", "guides", "favoris", "membre"].forEach((cle) => {
      const valeur = searchParams.get(cle);
      if (valeur) actuels.set(cle, valeur);
    });

    if (next.toString() !== actuels.toString()) {
      navigate({ search: next.toString(), hash: "#equipe-auteurs" }, { replace: true });
    }
  }, [recherche, roleFiltre, tri, triGuides, favorisSeuls, membreCible, searchParams, navigate]);

  const membres = useMemo(
    () =>
      equipe.map((membre) => ({
        membre,
        guides: articlesDuMembre(membre.id),
        episodes: episodesDuMembre(membre.id),
      })),
    []
  );

  const visibles = useMemo(() => {
    const terme = normaliser(recherche.trim());
    let filtres = membres;

    if (roleFiltre !== "tous") {
      filtres = filtres.filter(({ membre }) => membre.categorie === roleFiltre);
    }
    if (terme) {
      filtres = filtres.filter(
        ({ membre }) =>
          normaliser(membre.name).includes(terme) ||
          normaliser(membre.role).includes(terme)
      );
    }
    if (favorisSeuls) {
      filtres = filtres.filter(({ membre }) => favoris.includes(membre.id));
    }

    const tries = [...filtres];
    if (tri === "contenus-desc") {
      tries.sort(
        (a, b) =>
          b.guides.length + b.episodes.length - (a.guides.length + a.episodes.length)
      );
    } else if (tri === "contenus-asc") {
      tries.sort(
        (a, b) =>
          a.guides.length + a.episodes.length - (b.guides.length + b.episodes.length)
      );
    } else if (tri === "nom") {
      tries.sort((a, b) => a.membre.name.localeCompare(b.membre.name, "fr"));
    }

    // Remonte les membres épinglés en tête. À l'intérieur du groupe des favoris,
    // on respecte l'ordre manuel défini par l'utilisateur (priorité d'affichage).
    // Le tri par défaut de JS est stable, donc les non-favoris gardent leur tri.
    if (favoris.length > 0) {
      tries.sort((a, b) => {
        const aIdx = favoris.indexOf(a.membre.id);
        const bIdx = favoris.indexOf(b.membre.id);
        const aFav = aIdx !== -1 ? 1 : 0;
        const bFav = bIdx !== -1 ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        if (aFav && bFav) return aIdx - bIdx;
        return 0;
      });
    }
    return tries;
  }, [membres, recherche, tri, roleFiltre, favoris, favorisSeuls]);

  const reinitialiser = () => {
    setRecherche("");
    setRoleFiltre("tous");
    setTri("equipe");
    setTriGuides("catalogue");
    setTriGuidesMemorise(false);
    setFavorisSeuls(false);
  };

  // Réinitialise tous les filtres et retire aussi le membre mis en avant.
  const reinitialiserVue = () => {
    reinitialiser();
    setMembreCible(null);
  };

  // Oublie d'un seul geste toutes les préférences mémorisées (tri des guides,
  // filtre par rôle, dernière recherche) et remet la vue sur les réglages par défaut.
  const oublierPreferences = () => {
    try {
      window.localStorage.removeItem(CLE_TRI_GUIDES);
      window.localStorage.removeItem(CLE_ROLE);
      window.localStorage.removeItem(CLE_RECHERCHE);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
    setTriGuidesMemorise(false);
    setRoleMemorise(false);
    setRechercheMemoire("");
    setTriGuides("catalogue");
    setRoleFiltre("tous");
  };

  // Remet tout à zéro d'un seul clic : favoris épinglés, profils mémorisés et
  // préférences (tri des guides, filtre par rôle, dernière recherche), puis
  // efface les clés de stockage correspondantes.
  const toutReinitialiser = () => {
    try {
      window.localStorage.removeItem(CLE_FAVORIS);
      window.localStorage.removeItem(CLE_FAVORIS_ORIGINE);
      window.localStorage.removeItem(CLE_TRI_GUIDES);
      window.localStorage.removeItem(CLE_ROLE);
      window.localStorage.removeItem(CLE_RECHERCHE);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
    setFavoris([]);
    setFavorisOrigine([]);
    reinitialiserProfils();
    setFavorisSeuls(false);
    setFavoriSelectionne(null);
    setTri("equipe");
    setTriGuides("catalogue");
    setRoleFiltre("tous");
    setRecherche("");
    setRechercheMemoire("");
    setTriGuidesMemorise(false);
    setRoleMemorise(false);
    setMembreCible(null);
    setPopoverPreferences(false);
    setPopoverProfils(false);
    setConfirmReinit(false);
    setToastReinit(true);
    if (timerReinit.current) window.clearTimeout(timerReinit.current);
    timerReinit.current = window.setTimeout(() => setToastReinit(false), 3200);
  };

  // Suggestion de recherche : la dernière recherche mémorisée, seulement quand le
  // champ est vide (on ne l'impose jamais au chargement).
  const suggestionRecherche = recherche.trim() ? "" : rechercheMemoire;

  // Liste des préférences mémorisées actives, résumées à côté du titre et
  // détaillées d'un survol.
  const preferencesActives: { key: string; icon: string; label: string }[] = [];
  if (triGuidesMemorise && triGuides !== "catalogue") {
    const option = triGuidesOptions.find((o) => o.value === triGuides);
    preferencesActives.push({
      key: "guides",
      icon: "ri-file-list-3-line",
      label: `Tri des guides : ${option?.label ?? ""}`,
    });
  }
  if (roleMemorise && roleFiltre !== "tous") {
    const role = rolesFiltre.find((r) => r.value === roleFiltre);
    preferencesActives.push({
      key: "role",
      icon: "ri-user-settings-line",
      label: `Rôle : ${role?.label ?? ""}`,
    });
  }
  if (rechercheMemoire) {
    preferencesActives.push({
      key: "recherche",
      icon: "ri-history-line",
      label: `Dernière recherche : « ${rechercheMemoire} »`,
    });
  }
  if (favoris.length > 0) {
    preferencesActives.push({
      key: "favoris",
      icon: "ri-pushpin-2-fill",
      label: `${favoris.length} membre${favoris.length > 1 ? "s" : ""} épinglé${favoris.length > 1 ? "s" : ""} en favori`,
    });
  }

  // Épingle ou retire un membre des favoris (remonté en tête de grille).
  // Déclenche au passage la petite animation de confirmation sur la carte.
  const basculerFavori = (id: string) => {
    const dejaFavori = favoris.includes(id);
    setFavoris((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // On garde trace de l'ordre chronologique d'épinglage pour pouvoir y revenir.
    setFavorisOrigine((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // Un favori retiré ne peut plus rester sélectionné.
    if (dejaFavori && favoriSelectionne === id) setFavoriSelectionne(null);
    setAnimationFavori({ id, type: dejaFavori ? "unpin" : "pin" });
    if (timerAnimation.current) window.clearTimeout(timerAnimation.current);
    timerAnimation.current = window.setTimeout(() => setAnimationFavori(null), 1000);
  };

  // Épingle un membre en le déposant sur la zone « déposer ici pour épingler ».
  const epinglerParDepot = (id: string) => {
    if (favoris.includes(id)) return;
    setFavoris((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setFavorisOrigine((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAnimationFavori({ id, type: "pin" });
    if (timerAnimation.current) window.clearTimeout(timerAnimation.current);
    timerAnimation.current = window.setTimeout(() => setAnimationFavori(null), 1000);
  };

  // Déplace un membre épinglé vers le haut ou le bas dans l'ordre des favoris,
  // ce qui définit sa priorité d'affichage en tête de grille.
  const deplacerFavori = (id: string, direction: -1 | 1) => {
    setFavoris((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const cible = index + direction;
      if (cible < 0 || cible >= prev.length) return prev;
      const suivant = [...prev];
      [suivant[index], suivant[cible]] = [suivant[cible], suivant[index]];
      return suivant;
    });
  };

  // Réordonne un favori en le déposant sur un autre (glisser-déposer souris).
  const deplacerFavoriVers = (id: string, cibleId: string) => {
    if (id === cibleId) return;
    setFavoris((prev) => {
      const depuis = prev.indexOf(id);
      const vers = prev.indexOf(cibleId);
      if (depuis === -1 || vers === -1) return prev;
      const suivant = [...prev];
      suivant.splice(depuis, 1);
      suivant.splice(vers, 0, id);
      return suivant;
    });
  };

  // Indique si l'ordre des favoris a été modifié manuellement par rapport à
  // l'ordre d'épinglage d'origine (active le bouton de réinitialisation).
  const ordreFavorisModifie = useMemo(() => {
    const attendu = favorisOrigine.filter((id) => favoris.includes(id));
    const manquants = favoris.filter((id) => !attendu.includes(id));
    const reference = [...attendu, ...manquants];
    return reference.join(",") !== favoris.join(",");
  }, [favoris, favorisOrigine]);

  // Rétablit l'ordre des favoris tel qu'il était au moment de l'épinglage.
  const reinitialiserOrdreFavoris = () => {
    setFavoris((prev) => {
      const ordreOrigine = favorisOrigine.filter((id) => prev.includes(id));
      const manquants = prev.filter((id) => !ordreOrigine.includes(id));
      return [...ordreOrigine, ...manquants];
    });
  };

  // Retire d'un seul geste tous les membres épinglés en favoris.
  const toutDepingler = () => {
    setFavoris([]);
    setFavorisOrigine([]);
    setFavorisSeuls(false);
    setFavoriSelectionne(null);
  };

  // Inverse l'ordre des favoris : le dernier devient premier et inversement.
  const inverserOrdreFavoris = () => {
    setFavoris((prev) => [...prev].reverse());
  };

  // Raccourci clavier : Alt + ↑ / ↓ réordonne le favori sélectionné sans la souris.
  // Si aucun favori n'est sélectionné, le raccourci cible le premier favori.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const cible =
        favoriSelectionne && favoris.includes(favoriSelectionne)
          ? favoriSelectionne
          : favoris[0] ?? null;
      if (!cible) return;
      e.preventDefault();
      deplacerFavori(cible, e.key === "ArrowUp" ? -1 : 1);
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [favoriSelectionne, favoris]);

  // Récap des filtres actifs (chips retirables) affiché au-dessus de la grille.
  const filtresActifs: {
    key: string;
    icon: string;
    label: string;
    badge?: string;
    onRemove: () => void;
  }[] = [];
  const termeRecherche = recherche.trim();
  if (termeRecherche) {
    filtresActifs.push({
      key: "q",
      icon: "ri-search-line",
      label: `Recherche : « ${termeRecherche} »`,
      onRemove: () => setRecherche(""),
    });
  }
  if (roleFiltre !== "tous") {
    const role = rolesFiltre.find((r) => r.value === roleFiltre);
    filtresActifs.push({
      key: "role",
      icon: role?.icon ?? "ri-group-line",
      label: `Rôle : ${role?.label ?? ""}`,
      badge: roleMemorise ? "préférence" : undefined,
      onRemove: () => {
        setRoleFiltre("tous");
        setRoleMemorise(false);
      },
    });
  }
  if (favorisSeuls) {
    filtresActifs.push({
      key: "favoris",
      icon: "ri-pushpin-2-fill",
      label: `Favoris : ${favoris.length} membre${favoris.length > 1 ? "s" : ""} épinglé${favoris.length > 1 ? "s" : ""}`,
      onRemove: () => setFavorisSeuls(false),
    });
  }
  if (tri !== "equipe") {
    const option = triOptions.find((o) => o.value === tri);
    filtresActifs.push({
      key: "tri",
      icon: "ri-sort-desc",
      label: `Tri : ${option?.label ?? ""}`,
      onRemove: () => setTri("equipe"),
    });
  }
  if (triGuides !== "catalogue") {
    const option = triGuidesOptions.find((o) => o.value === triGuides);
    filtresActifs.push({
      key: "guides",
      icon: "ri-file-list-3-line",
      label: `Guides : ${option?.label ?? ""}`,
      badge: triGuidesMemorise ? "préférence" : undefined,
      onRemove: () => {
        setTriGuides("catalogue");
        setTriGuidesMemorise(false);
      },
    });
  }

  // Construit l'URL complète de la vue courante (filtres + membre ciblé).
  const construireUrlPartageable = () => {
    const params = new URLSearchParams();
    const terme = recherche.trim();
    if (terme) params.set("q", terme);
    if (roleFiltre !== "tous") params.set("role", roleFiltre);
    if (tri !== "equipe") params.set("tri", tri);
    if (triGuides !== "catalogue") params.set("guides", triGuides);
    if (favorisSeuls) params.set("favoris", "1");
    if (membreCible) params.set("membre", membreCible);
    const query = params.toString();
    return `${originePublique()}${window.location.pathname}${
      query ? `?${query}` : ""
    }#equipe-auteurs`;
  };

  // Copie l'URL complète (filtres + membre ciblé) pour partager la vue courante.
  const copierLien = async () => {
    const url = construireUrlPartageable();

    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const zone = document.createElement("textarea");
        zone.value = url;
        zone.setAttribute("readonly", "");
        zone.style.position = "fixed";
        zone.style.top = "-1000px";
        document.body.appendChild(zone);
        zone.select();
        ok = document.execCommand("copy");
        document.body.removeChild(zone);
      } catch {
        ok = false;
      }
    }
    if (!ok) return;

    setLienCopie(true);
    if (timerCopie.current) window.clearTimeout(timerCopie.current);
    timerCopie.current = window.setTimeout(() => setLienCopie(false), 2200);
  };

  // Partage la vue via la feuille de partage native (Web Share API),
  // ou replie sur la copie du lien si l'appareil ne la propose pas.
  const partagerLien = async () => {
    const url = construireUrlPartageable();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Équipe & auteurs — ArtiFlow-pro",
          text: "Une sélection de l'équipe ArtiFlow-pro à découvrir.",
          url,
        });
        return;
      } catch {
        // Partage annulé ou non abouti : on retombe sur la copie du lien.
      }
    }
    await copierLien();
  };

  return (
    <section
      id="equipe-auteurs"
      className="relative w-full bg-background-100 border-t border-background-200 scroll-mt-32"
    >
      {/* Toast de confirmation affiché en haut de la section après copie du lien. */}
      {lienCopie && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4 flex justify-center pointer-events-none"
        >
          <div className="animate-fade-in pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-background-50 border border-background-200 shadow-sm text-sm font-medium text-foreground-900">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <i className="ri-check-line text-sm"></i>
            </span>
            <span>Lien copié dans le presse-papiers</span>
          </div>
        </div>
      )}

      {/* Toast de confirmation affiché en haut de la section après remise à zéro. */}
      {toastReinit && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4 flex justify-center pointer-events-none ${
            lienCopie ? "top-16" : "top-4"
          }`}
        >
          <div className="animate-fade-in pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-background-50 border border-background-200 text-sm font-medium text-foreground-900">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-restart-line text-sm"></i>
            </span>
            <span>Favoris, profils et préférences réinitialisés</span>
          </div>
        </div>
      )}

      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Équipe &amp; auteurs
              </h2>
              {preferencesActives.length > 0 && (
                <span ref={popoverRef} className="group relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setPopoverPreferences((v) => !v)}
                    aria-expanded={popoverPreferences}
                    aria-haspopup="true"
                    title="Voir les préférences mémorisées"
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  >
                    <i className="ri-bookmark-3-line"></i>
                    {preferencesActives.length} préférence
                    {preferencesActives.length > 1 ? "s" : ""} active
                    {preferencesActives.length > 1 ? "s" : ""}
                    <i
                      className={`text-sm transition-transform ${
                        popoverPreferences ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"
                      }`}
                    ></i>
                  </button>
                  <span
                    role="tooltip"
                    className={`absolute left-0 top-full mt-2 z-30 w-72 transition-opacity rounded-lg border border-background-200 bg-background-50 p-3 ${
                      popoverPreferences
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500 mb-2">
                      Préférences mémorisées
                    </span>
                    <span className="flex flex-col gap-2">
                      {preferencesActives.map((pref) => (
                        <span
                          key={pref.key}
                          className="flex items-start gap-2 text-xs text-foreground-700"
                        >
                          <i className={`${pref.icon} mt-0.5 text-secondary-600`}></i>
                          <span>{pref.label}</span>
                        </span>
                      ))}
                    </span>
                    {favoris.length > 0 && (
                      <span className="mt-3 block border-t border-background-200 pt-2.5">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500 mb-2">
                          Ordre des favoris
                        </span>
                        <span className="flex flex-col gap-1.5">
                          {favoris.map((id, index) => (
                            <span
                              key={id}
                              className="flex items-center gap-2 text-xs text-foreground-700"
                            >
                              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold">
                                {index + 1}
                              </span>
                              <span className="truncate">
                                {equipe.find((m) => m.id === id)?.name ?? id}
                              </span>
                            </span>
                          ))}
                        </span>
                        {ordreFavorisModifie && (
                          <button
                            type="button"
                            onClick={reinitialiserOrdreFavoris}
                            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-900 whitespace-nowrap cursor-pointer underline underline-offset-2"
                          >
                            <i className="ri-history-line"></i>
                            Rétablir l'ordre d'origine
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </span>
              )}
              {profilActifObj && (
                <span className="inline-flex items-stretch h-7 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-xs font-semibold whitespace-nowrap overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPopoverProfils(true)}
                    aria-haspopup="true"
                    title="Profil de favoris actif — cliquer pour en changer"
                    className="inline-flex items-center gap-1.5 h-full pl-3 pr-2 cursor-pointer hover:bg-accent-200 transition-colors"
                  >
                    <i className="ri-folder-shield-2-fill"></i>
                    Profil : {profilActifObj.nom}
                    <span className="text-[10px] font-bold text-accent-700">
                      · {profilActifObj.favoris.length}
                    </span>
                  </button>
                  <span className="w-px my-1 bg-accent-300" aria-hidden="true"></span>
                  <button
                    type="button"
                    onClick={() => dupliquerProfil(profilActifObj.id)}
                    aria-label={`Dupliquer le profil actif ${profilActifObj.nom}`}
                    title={`Dupliquer le profil actif « ${profilActifObj.nom} »`}
                    className="inline-flex items-center justify-center w-7 h-full cursor-pointer hover:bg-accent-200 transition-colors"
                  >
                    <i className="ri-file-copy-line text-sm"></i>
                  </button>
                </span>
              )}
              {favoris.length > 0 && (
                <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-xs font-semibold whitespace-nowrap">
                  <i className="ri-pushpin-2-fill"></i>
                  {favoris.length} favori{favoris.length > 1 ? "s" : ""} épinglé
                  {favoris.length > 1 ? "s" : ""}
                </span>
              )}
              {favoris.length > 0 && (
                <button
                  type="button"
                  onClick={toutDepingler}
                  title="Retirer tous les membres épinglés"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-500 hover:text-foreground-950 whitespace-nowrap cursor-pointer underline underline-offset-2"
                >
                  <i className="ri-pushpin-line"></i>
                  Tout dépingler
                </button>
              )}
              {favoris.length > 1 && ordreFavorisModifie && (
                <button
                  type="button"
                  onClick={reinitialiserOrdreFavoris}
                  title="Revenir à l'ordre d'épinglage d'origine"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-900 whitespace-nowrap cursor-pointer underline underline-offset-2"
                >
                  <i className="ri-history-line"></i>
                  Rétablir l'ordre d'origine
                </button>
              )}
              {favoris.length > 1 && (
                <button
                  type="button"
                  onClick={inverserOrdreFavoris}
                  title="Inverser la priorité de toute la liste des favoris"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-500 hover:text-foreground-950 whitespace-nowrap cursor-pointer underline underline-offset-2"
                >
                  <i className="ri-swap-line"></i>
                  Inverser l'ordre
                </button>
              )}
              <span ref={popoverProfilsRef} className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setPopoverProfils((v) => !v)}
                    aria-expanded={popoverProfils}
                    aria-haspopup="true"
                    title="Enregistrer ou charger un profil de favoris"
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  >
                    <i className="ri-folder-shield-2-line"></i>
                    Profils
                    {profils.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold">
                        {profils.length}
                      </span>
                    )}
                    <i
                      className={`text-sm transition-transform ${
                        popoverProfils ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"
                      }`}
                    ></i>
                  </button>
                  {popoverProfils && (
                    <span className="absolute left-0 top-full mt-2 z-30 w-80 rounded-lg border border-background-200 bg-background-50 p-3 shadow-sm">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500 mb-2">
                        Enregistrer la sélection actuelle
                      </span>
                      <span className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nomProfil}
                          onChange={(e) => setNomProfil(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") enregistrerProfil();
                          }}
                          placeholder="Ex. vue technique"
                          aria-label="Nom du profil de favoris"
                          className="flex-1 h-8 px-2.5 text-xs rounded-md bg-background-50 border border-background-200 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300"
                        />
                        <button
                          type="button"
                          onClick={enregistrerProfil}
                          disabled={!nomProfil.trim() || favoris.length === 0}
                          title={
                            favoris.length === 0
                              ? "Épinglez d'abord des membres"
                              : "Enregistrer cette sélection sous un profil"
                          }
                          className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                            !nomProfil.trim() || favoris.length === 0
                              ? "bg-background-100 text-foreground-400 cursor-not-allowed"
                              : "bg-primary-500 text-background-50 cursor-pointer hover:bg-primary-600"
                          }`}
                        >
                          <i className="ri-save-3-line"></i>
                          Enregistrer
                        </button>
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-2 border-t border-background-200 pt-2.5">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                          Profils mémorisés
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={exporterProfils}
                            disabled={profils.length === 0 && favoris.length === 0}
                            title={
                              profils.length === 0 && favoris.length === 0
                                ? "Rien à exporter pour le moment"
                                : "Exporter les profils, les favoris épinglés et leur ordre"
                            }
                            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                              profils.length === 0 && favoris.length === 0
                                ? "bg-background-100 text-foreground-400 cursor-not-allowed"
                                : "bg-background-50 border border-background-200 text-foreground-700 cursor-pointer hover:border-primary-300"
                            }`}
                          >
                            <i className="ri-download-2-line"></i>
                            Exporter
                          </button>
                          <button
                            type="button"
                            onClick={() => inputFichierRef.current?.click()}
                            title="Importer des profils depuis un fichier JSON"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                          >
                            <i className="ri-upload-2-line"></i>
                            Importer
                          </button>
                        </span>
                      </span>
                      <input
                        ref={inputFichierRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => {
                          const fichier = e.target.files?.[0];
                          if (fichier) importerProfils(fichier);
                          e.target.value = "";
                        }}
                      />
                      {messageProfils && (
                        <span
                          role="status"
                          aria-live="polite"
                          className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${
                            messageProfils.type === "ok"
                              ? "text-primary-700"
                              : "text-accent-700"
                          }`}
                        >
                          <i
                            className={
                              messageProfils.type === "ok"
                                ? "ri-check-line"
                                : "ri-error-warning-line"
                            }
                          ></i>
                          {messageProfils.texte}
                        </span>
                      )}
                      {profils.length > 1 && (
                        <span className="mt-2 flex items-center gap-1.5 text-[10px] text-foreground-500">
                          <i className="ri-drag-move-2-line"></i>
                          Glissez-déposez les profils (ou les flèches) pour définir leur ordre.
                        </span>
                      )}
                      {profils.length > 1 && (
                        <span className="mt-2 flex items-center gap-1.5 text-[10px] text-foreground-500">
                          <i className="ri-drag-move-2-line"></i>
                          Glissez-déposez les profils (ou les flèches) pour définir leur ordre.
                        </span>
                      )}
                      {profils.length > 0 ? (
                        <span className="mt-2 flex flex-col gap-1.5">
                          {profils.map((profil, profilIndex) => (
                            <span
                              key={profil.id}
                              className={`relative flex items-center gap-2 rounded-md ${
                                dragProfilSurId === profil.id ? "ring-2 ring-primary-400" : ""
                              } ${dragProfilId === profil.id ? "opacity-60" : ""}`}
                              onMouseEnter={() => setProfilApercu(profil.id)}
                              onMouseLeave={() =>
                                setProfilApercu((prev) => (prev === profil.id ? null : prev))
                              }
                              onDragOver={(e) => {
                                if (!dragProfilId || dragProfilId === profil.id) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragProfilSurId !== profil.id) setDragProfilSurId(profil.id);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (dragProfilId && dragProfilId !== profil.id) {
                                  deplacerProfilVers(dragProfilId, profil.id);
                                }
                                setDragProfilId(null);
                                setDragProfilSurId(null);
                              }}
                            >
                              {profilEnRenommage === profil.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={nomRenommage}
                                    onChange={(e) => setNomRenommage(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") validerRenommage();
                                      if (e.key === "Escape") annulerRenommage();
                                    }}
                                    aria-label="Nouveau nom du profil"
                                    className="flex-1 h-8 px-2.5 text-xs rounded-md bg-background-50 border border-accent-300 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={validerRenommage}
                                    disabled={!nomRenommage.trim()}
                                    aria-label={`Valider le nouveau nom du profil ${profil.nom}`}
                                    title="Valider le nouveau nom"
                                    className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md transition-colors ${
                                      !nomRenommage.trim()
                                        ? "bg-background-100 text-foreground-400 cursor-not-allowed"
                                        : "bg-primary-500 text-background-50 cursor-pointer hover:bg-primary-600"
                                    }`}
                                  >
                                    <i className="ri-check-line text-sm"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={annulerRenommage}
                                    aria-label="Annuler le renommage"
                                    title="Annuler"
                                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:text-foreground-950 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-close-line text-sm"></i>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span
                                    draggable
                                    role="button"
                                    tabIndex={0}
                                    onDragStart={(e) => {
                                      setDragProfilId(profil.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/plain", profil.id);
                                    }}
                                    onDragEnd={() => {
                                      setDragProfilId(null);
                                      setDragProfilSurId(null);
                                    }}
                                    aria-label={`Glisser le profil ${profil.nom}`}
                                    title={`Glisser pour réordonner « ${profil.nom} »`}
                                    className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-primary-700 hover:border-primary-300 cursor-grab active:cursor-grabbing"
                                  >
                                    <i className="ri-drag-move-2-line text-sm pointer-events-none"></i>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => appliquerProfil(profil.id)}
                                    title={`Charger le profil « ${profil.nom} »`}
                                    className={`flex-1 inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs font-medium text-left whitespace-nowrap cursor-pointer transition-colors ${
                                      profilActif === profil.id
                                        ? "bg-accent-100 border border-accent-300 text-accent-900"
                                        : "bg-background-50 border border-background-200 text-foreground-700 hover:border-accent-300"
                                    }`}
                                  >
                                    <i
                                      className={
                                        profilActif === profil.id
                                          ? "ri-checkbox-circle-line text-accent-700"
                                          : "ri-folder-3-line"
                                      }
                                    ></i>
                                    <span className="truncate flex-1">{profil.nom}</span>
                                    <span className="shrink-0 text-[10px] text-foreground-400">
                                      {profil.favoris.length}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => demarrerRenommage(profil)}
                                    aria-label={`Renommer le profil ${profil.nom}`}
                                    title={`Renommer le profil « ${profil.nom} »`}
                                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:text-accent-700 hover:border-accent-300 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-pencil-line text-sm"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => dupliquerProfil(profil.id)}
                                    aria-label={`Dupliquer le profil ${profil.nom}`}
                                    title={`Dupliquer le profil « ${profil.nom} »`}
                                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:text-primary-700 hover:border-primary-300 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-file-copy-line text-sm"></i>
                                  </button>
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-md bg-background-50 border border-background-200 p-0.5"
                                    title="Réordonner les profils"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => deplacerProfil(profil.id, -1)}
                                      disabled={profilIndex <= 0}
                                      aria-label={`Monter le profil ${profil.nom}`}
                                      title={`Monter le profil « ${profil.nom} »`}
                                      className={`w-6 h-6 flex items-center justify-center rounded-md text-sm transition-colors ${
                                        profilIndex <= 0
                                          ? "text-foreground-300 cursor-not-allowed"
                                          : "text-foreground-600 hover:bg-primary-100 hover:text-primary-700 cursor-pointer"
                                      }`}
                                    >
                                      <i className="ri-arrow-up-line"></i>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deplacerProfil(profil.id, 1)}
                                      disabled={profilIndex >= profils.length - 1}
                                      aria-label={`Descendre le profil ${profil.nom}`}
                                      title={`Descendre le profil « ${profil.nom} »`}
                                      className={`w-6 h-6 flex items-center justify-center rounded-md text-sm transition-colors ${
                                        profilIndex >= profils.length - 1
                                          ? "text-foreground-300 cursor-not-allowed"
                                          : "text-foreground-600 hover:bg-primary-100 hover:text-primary-700 cursor-pointer"
                                      }`}
                                    >
                                      <i className="ri-arrow-down-line"></i>
                                    </button>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => supprimerProfil(profil.id)}
                                    aria-label={`Supprimer le profil ${profil.nom}`}
                                    title={`Supprimer le profil « ${profil.nom} »`}
                                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:text-primary-700 hover:border-primary-300 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-delete-bin-6-line text-sm"></i>
                                  </button>
                                </>
                              )}
                              {profilApercu === profil.id &&
                                profilEnRenommage !== profil.id && (
                                  <span className="absolute left-full top-0 ml-2 z-40 w-56 rounded-lg border border-background-200 bg-background-50 p-2.5">
                                    <span className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                                      <span className="inline-flex items-center gap-1.5">
                                        <i className="ri-folder-3-line"></i>
                                        Membres du profil
                                      </span>
                                      <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold">
                                        {profil.favoris.length}
                                      </span>
                                    </span>
                                    {profil.favoris.length > 0 ? (
                                      <span className="flex flex-col gap-1">
                                        {profil.favoris.map((id, index) => (
                                          <span
                                            key={id}
                                            className="flex items-center gap-2 text-xs text-foreground-700"
                                          >
                                            <span className="inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-full bg-accent-100 text-accent-900 text-[9px] font-bold">
                                              {index + 1}
                                            </span>
                                            <span className="truncate">
                                              {equipe.find((m) => m.id === id)?.name ?? id}
                                            </span>
                                          </span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className="block text-xs text-foreground-500">
                                        Ce profil ne contient aucun membre.
                                      </span>
                                    )}
                                  </span>
                                )}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="mt-2 block text-xs text-foreground-500">
                          Aucun profil enregistré pour le moment.
                        </span>
                      )}
                    </span>
                  )}
                </span>
            </div>
            <p className="mt-2 text-sm text-foreground-600">
              Chaque membre de l'équipe dispose de sa page : bio, guides écrits et prises de parole.
            </p>
            {favoris.length > 1 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-drag-move-2-line"></i>
                  Glissez-déposez les cartes (ou les flèches) pour définir leur ordre d'affichage.
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-keyboard-line"></i>
                  Sélectionnez un favori puis Alt + ↑ / ↓ pour le déplacer au clavier.
                </span>
              </p>
            )}
          </div>
          <Link
            to="/a-propos#equipe"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700 hover:gap-3 transition-all cursor-pointer"
          >
            Voir l'équipe complète
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        {/* Recherche, filtre par rôle & tri */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 sm:max-w-sm">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un membre ou un rôle…"
                  aria-label="Rechercher un membre de l'équipe"
                  className="w-full h-11 pl-10 pr-3 text-sm rounded-md bg-background-50 border border-background-200 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300"
                />
              </div>
              {suggestionRecherche && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-foreground-500">
                  <i className="ri-history-line"></i>
                  <span>Dernière recherche :</span>
                  <button
                    type="button"
                    onClick={() => setRecherche(suggestionRecherche)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 font-medium whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  >
                    « {suggestionRecherche} »
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <i className="ri-sort-desc absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as TriMode)}
                aria-label="Trier les membres"
                className="h-11 pl-10 pr-8 text-sm rounded-md bg-background-50 border border-background-200 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 cursor-pointer appearance-none"
              >
                {triOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
            </div>
            <span className="text-xs text-foreground-500 sm:ml-auto">
              {visibles.length} membre{visibles.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFavorisSeuls((v) => !v)}
                disabled={favoris.length === 0}
                aria-pressed={favorisSeuls}
                title={
                  favoris.length === 0
                    ? "Épinglez des membres pour activer ce filtre"
                    : "N'afficher que les membres épinglés"
                }
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  favoris.length === 0
                    ? "bg-background-50 border border-background-200 text-foreground-400 cursor-not-allowed"
                    : favorisSeuls
                      ? "bg-primary-500 text-background-50 cursor-pointer"
                      : "bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300 cursor-pointer"
                }`}
              >
                <i className="ri-pushpin-2-fill"></i>
                Favoris
                {favoris.length > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      favorisSeuls
                        ? "bg-background-50 text-primary-700"
                        : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    {favoris.length}
                  </span>
                )}
              </button>
              {rolesFiltre.map((role) => {
                const actif = roleFiltre === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => {
                      setRoleFiltre(role.value);
                      setRoleMemorise(false);
                    }}
                    aria-pressed={actif}
                    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif
                        ? "bg-primary-500 text-background-50"
                        : "bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
                    }`}
                  >
                    <i className={role.icon}></i>
                    {role.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-500 pointer-events-none">
                  Guides
                </span>
                <select
                  value={triGuides}
                  onChange={(e) => {
                    setTriGuides(e.target.value as TriGuidesMode);
                    setTriGuidesMemorise(false);
                  }}
                  aria-label="Trier les guides listés sous chaque membre"
                  className="h-9 pl-16 pr-8 text-xs font-medium rounded-md bg-background-50 border border-background-200 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 cursor-pointer appearance-none"
                >
                  {triGuidesOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
              </div>
              {triGuidesMemorise && triGuides !== "catalogue" && (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                  <i className="ri-bookmark-3-line"></i>
                  préférence enregistrée
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {filtresActifs.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500">
                <i className="ri-filter-3-line"></i>
                Filtres actifs :
              </span>
              {filtresActifs.map((filtre) => (
                <button
                  key={filtre.key}
                  type="button"
                  onClick={filtre.onRemove}
                  aria-label={`Retirer le filtre ${filtre.label}`}
                  className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                >
                  <i className={filtre.icon}></i>
                  <span>{filtre.label}</span>
                  {filtre.badge && (
                    <span className="inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-accent-300 text-[10px] font-semibold text-accent-700 whitespace-nowrap">
                      <i className="ri-bookmark-3-line"></i>
                      {filtre.badge}
                    </span>
                  )}
                  <i className="ri-close-line text-sm"></i>
                </button>
              ))}
              <button
                type="button"
                onClick={reinitialiser}
                className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 hover:text-foreground-950 underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-close-circle-line"></i>
                Tout effacer ({filtresActifs.length})
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
              <i className="ri-list-check"></i>
              Aucun filtre actif — toute l'équipe est affichée.
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(triGuidesMemorise || roleMemorise || rechercheMemoire) && (
              <button
                type="button"
                onClick={oublierPreferences}
                title="Efface le tri des guides, le filtre par rôle et la dernière recherche mémorisés"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-500 hover:text-foreground-950 whitespace-nowrap cursor-pointer underline underline-offset-2"
              >
                <i className="ri-delete-back-2-line"></i>
                Oublier mes préférences
              </button>
            )}
            {(filtresActifs.length > 0 || membreCible) && (
              <button
                type="button"
                onClick={reinitialiserVue}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-refresh-line"></i>
                Réinitialiser la vue
              </button>
            )}
            {(favoris.length > 0 ||
              profils.length > 0 ||
              triGuidesMemorise ||
              roleMemorise ||
              rechercheMemoire) && (
              <span ref={confirmReinitRef} className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setConfirmReinit((v) => !v)}
                  aria-expanded={confirmReinit}
                  aria-haspopup="true"
                  title="Remet à zéro les favoris épinglés, les profils et toutes les préférences"
                  className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                    confirmReinit
                      ? "bg-accent-100 border-accent-300 text-accent-900"
                      : "bg-background-50 border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <i className="ri-restart-line"></i>
                  Tout réinitialiser
                </button>
                {confirmReinit && (
                  <span
                    role="dialog"
                    aria-label="Confirmer la remise à zéro"
                    className="absolute right-0 top-full mt-2 z-40 w-64 rounded-lg border border-background-200 bg-background-50 p-3 shadow-sm text-left"
                  >
                    <span className="flex items-start gap-2">
                      <i className="ri-error-warning-line mt-0.5 text-accent-700"></i>
                      <span className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground-950">
                          Tout remettre à zéro ?
                        </span>
                        <span className="mt-1 text-[11px] text-foreground-600">
                          Les favoris épinglés, les profils mémorisés et toutes les préférences seront effacés.
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-end gap-2 border-t border-background-200 pt-2.5">
                      <button
                        type="button"
                        onClick={() => setConfirmReinit(false)}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={toutReinitialiser}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                      >
                        <i className="ri-restart-line"></i>
                        Confirmer
                      </button>
                    </span>
                  </span>
                )}
              </span>
            )}
            {partageDisponible && (
              <button
                type="button"
                onClick={partagerLien}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-share-forward-line"></i>
                Partager
              </button>
            )}
            <button
              type="button"
              onClick={copierLien}
              aria-live="polite"
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                lienCopie
                  ? "bg-secondary-500 text-background-50"
                  : "bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              }`}
            >
              <i className={lienCopie ? "ri-check-line" : "ri-link"}></i>
              {lienCopie ? "Lien copié !" : "Copier le lien"}
            </button>
          </div>
        </div>

        {/* Zone d'épinglage par glisser-déposer, visible pendant un glissement. */}
        {dragFavoriId && !favoris.includes(dragFavoriId) && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              if (!surZoneDrop) setSurZoneDrop(true);
            }}
            onDragLeave={() => setSurZoneDrop(false)}
            onDrop={(e) => {
              e.preventDefault();
              epinglerParDepot(dragFavoriId);
              setDragFavoriId(null);
              setDragSurId(null);
              setSurZoneDrop(false);
            }}
            className={`mb-5 flex flex-wrap items-center justify-center gap-2 min-h-16 px-4 py-3 rounded-lg border-2 border-dashed text-sm font-semibold transition-colors ${
              surZoneDrop
                ? "border-primary-500 bg-primary-100 text-primary-700"
                : "border-background-300 bg-background-50 text-foreground-500"
            }`}
          >
            <i className="ri-pushpin-2-fill text-lg"></i>
            <span>Déposer ici pour épingler en favori</span>
          </div>
        )}

        {visibles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibles.map(({ membre, guides, episodes }) => {
              const estCible = membreCible === membre.id;
              const estFavori = favoris.includes(membre.id);
              const indexFavori = favoris.indexOf(membre.id);
              const enAnimation = animationFavori?.id === membre.id;
              const glissable = true;
              const enCoursDeGlisse = dragFavoriId === membre.id;
              const cibleDeGlisse = dragSurId === membre.id && dragFavoriId !== membre.id;
              // Membre appartenant au profil de favoris actuellement chargé : mis en surbrillance.
              const dansProfilActif = Boolean(
                profilActifObj && profilActifObj.favoris.includes(membre.id)
              );
              return (
              <div
                key={membre.id}
                ref={estCible ? carteCibleRef : undefined}
                onDragOver={(e) => {
                  if (!dragFavoriId || !estFavori) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragSurId !== membre.id) setDragSurId(membre.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFavoriId && estFavori) {
                    deplacerFavoriVers(dragFavoriId, membre.id);
                  }
                  setDragFavoriId(null);
                  setDragSurId(null);
                }}
                className={`flex flex-col rounded-lg bg-background-50 border transition-colors overflow-hidden ${
                  estCible
                    ? "border-accent-400 ring-2 ring-accent-400"
                    : cibleDeGlisse
                      ? "border-primary-500 ring-2 ring-primary-400"
                      : dansProfilActif
                        ? "border-accent-300 ring-2 ring-accent-200 bg-accent-100/40 hover:border-accent-400"
                        : estFavori
                          ? "border-primary-300 hover:border-primary-400"
                          : "border-background-200 hover:border-accent-300"
                } ${estCible && flashCible ? "animate-carte-cible" : ""} ${
                  enAnimation ? "animate-card-pin" : ""
                } ${enCoursDeGlisse ? "opacity-60" : ""} ${
                  favoriSelectionne === membre.id ? "ring-2 ring-accent-400" : ""
                }`}
              >
                {estCible && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-accent-100 text-accent-900 text-[11px] font-semibold border-b border-accent-200">
                    <i className="ri-map-pin-user-line"></i>
                    <span>Retrouvé depuis sa page auteur</span>
                    <span
                      className="inline-flex items-center gap-1 text-accent-700 font-medium whitespace-nowrap"
                      title={`${guides.length} guide${guides.length > 1 ? "s" : ""} et ${episodes.length} épisode${episodes.length > 1 ? "s" : ""}`}
                    >
                      <span className="text-accent-300">·</span>
                      {guides.length + episodes.length} contenu
                      {guides.length + episodes.length > 1 ? "s" : ""}
                    </span>
                    <Link
                      to={`/auteurs/${membre.id}`}
                      title={`Voir le profil de ${membre.name}`}
                      className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                    >
                      <i className="ri-user-line"></i>
                      Voir le profil
                    </Link>
                  </div>
                )}
                <Link
                  to={`/auteurs/${membre.id}`}
                  title={`Voir la page de ${membre.name}`}
                  className="group flex items-center gap-4 p-4 cursor-pointer"
                >
                  <span className="relative w-14 h-14 shrink-0 rounded-full bg-background-200">
                    <span className="block w-full h-full rounded-full overflow-hidden">
                      <img
                        src={membre.photo}
                        alt={`Portrait de ${membre.name}, ${membre.role} chez ArtiFlow-pro`}
                        title={`${membre.name} · ArtiFlow-pro`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-top"
                      />
                    </span>
                    {estFavori && (
                      <span
                        title="Membre épinglé en favori"
                        aria-label="Membre épinglé en favori"
                        className={`absolute -top-0.5 -right-0.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-[11px] border-2 border-background-50 ${
                          enAnimation ? "animate-pin-pop" : ""
                        }`}
                      >
                        <i className="ri-pushpin-2-fill"></i>
                      </span>
                    )}
                    {estFavori && (
                      <span
                        title={`Priorité d'affichage : ${indexFavori + 1}`}
                        aria-label={`Priorité d'affichage ${indexFavori + 1}`}
                        className={`absolute -bottom-0.5 -left-0.5 z-10 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold border-2 border-background-50 ${
                          enAnimation ? "animate-pin-pop" : ""
                        }`}
                      >
                        {indexFavori + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-heading font-semibold text-sm text-foreground-950">
                      {membre.name}
                    </span>
                    <span className="text-xs text-foreground-600">{membre.role}</span>
                    {dansProfilActif && profilActifObj && (
                      <span
                        title={`Membre du profil actif « ${profilActifObj.nom} »`}
                        className="mt-1 inline-flex items-center gap-1 self-start max-w-full px-1.5 py-0.5 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-[10px] font-semibold"
                      >
                        <i className="ri-folder-shield-2-fill"></i>
                        <span className="truncate">Profil : {profilActifObj.nom}</span>
                      </span>
                    )}
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-foreground-500">
                      <i className="ri-article-line"></i>
                      <span>
                        {guides.length} guide{guides.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-foreground-300">·</span>
                      <i className="ri-mic-line"></i>
                      <span>
                        {episodes.length} épisode{episodes.length > 1 ? "s" : ""}
                      </span>
                    </span>
                  </span>
                  <i className="ri-arrow-right-line ml-auto shrink-0 text-foreground-400 group-hover:text-accent-600 transition-colors"></i>
                </Link>

                <div className="flex flex-col flex-1 p-4 pt-0">
                  <div className="pt-3 border-t border-background-200 mb-2.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                      Ses guides &amp; épisodes
                    </p>
                    <span className="inline-flex items-center gap-1.5">
                      {estFavori && (
                        <button
                          type="button"
                          onClick={() =>
                            setFavoriSelectionne((prev) =>
                              prev === membre.id ? null : membre.id
                            )
                          }
                          aria-pressed={favoriSelectionne === membre.id}
                          title={
                            favoriSelectionne === membre.id
                              ? `Priorité ${indexFavori + 1} — sélectionné (Alt + ↑ / ↓ pour déplacer)`
                              : `Priorité ${indexFavori + 1} — cliquer pour sélectionner et réordonner au clavier`
                          }
                          className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            favoriSelectionne === membre.id
                              ? "bg-accent-500 border border-accent-500 text-background-50"
                              : "bg-accent-100 border border-accent-200 text-accent-900 hover:border-accent-400"
                          }`}
                        >
                          <i
                            className={`text-[11px] ${
                              favoriSelectionne === membre.id
                                ? "ri-checkbox-circle-line"
                                : "ri-sort-asc"
                            }`}
                          ></i>
                          Priorité {indexFavori + 1}
                        </button>
                      )}
                      {glissable && (
                        <span
                          draggable
                          role="button"
                          tabIndex={0}
                          onMouseDown={() => {
                            if (estFavori) setFavoriSelectionne(membre.id);
                          }}
                          onDragStart={(e) => {
                            setDragFavoriId(membre.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", membre.id);
                          }}
                          onDragEnd={() => {
                            setDragFavoriId(null);
                            setDragSurId(null);
                            setSurZoneDrop(false);
                          }}
                          title={
                            estFavori
                              ? `Glisser pour réordonner ${membre.name}`
                              : `Glisser ${membre.name} sur « Déposer ici pour épingler »`
                          }
                          aria-label={`Glisser ${membre.name}`}
                          className={`w-6 h-6 flex items-center justify-center rounded-full bg-background-50 border text-foreground-500 hover:text-primary-700 hover:border-primary-300 cursor-grab active:cursor-grabbing ${
                            favoriSelectionne === membre.id
                              ? "border-accent-400"
                              : "border-background-200"
                          }`}
                        >
                          <i className="ri-drag-move-2-line text-sm pointer-events-none"></i>
                        </span>
                      )}
                      {estFavori && favoris.length > 1 && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-background-50 border border-background-200 p-0.5"
                          title="Définir la priorité d'affichage des favoris"
                        >
                          <button
                            type="button"
                            onClick={() => deplacerFavori(membre.id, -1)}
                            disabled={indexFavori <= 0}
                            aria-label={`Monter ${membre.name} dans les favoris`}
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-sm transition-colors ${
                              indexFavori <= 0
                                ? "text-foreground-300 cursor-not-allowed"
                                : "text-foreground-600 hover:bg-primary-100 hover:text-primary-700 cursor-pointer"
                            }`}
                          >
                            <i className="ri-arrow-up-line"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => deplacerFavori(membre.id, 1)}
                            disabled={indexFavori >= favoris.length - 1}
                            aria-label={`Descendre ${membre.name} dans les favoris`}
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-sm transition-colors ${
                              indexFavori >= favoris.length - 1
                                ? "text-foreground-300 cursor-not-allowed"
                                : "text-foreground-600 hover:bg-primary-100 hover:text-primary-700 cursor-pointer"
                            }`}
                          >
                            <i className="ri-arrow-down-line"></i>
                          </button>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => basculerFavori(membre.id)}
                        aria-pressed={estFavori}
                        title={
                          estFavori
                            ? `Retirer ${membre.name} des favoris`
                            : `Épingler ${membre.name} en favori`
                        }
                        className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          estFavori
                            ? "bg-primary-100 border border-primary-200 text-primary-700"
                            : "bg-background-50 border border-background-200 text-foreground-600 hover:border-primary-300"
                        }`}
                      >
                        <i className={estFavori ? "ri-pushpin-2-fill" : "ri-pushpin-line"}></i>
                        {estFavori ? "Épinglé" : "Épingler"}
                      </button>
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {trierGuides(guides, triGuides).map((guide) => (
                      <li key={guide.slug}>
                        <Link
                          to={`/ressources/${guide.slug}`}
                          className="group flex items-start gap-2 text-xs text-foreground-700 hover:text-foreground-950 cursor-pointer"
                        >
                          <i className="ri-article-line mt-0.5 text-secondary-600"></i>
                          <span className="leading-snug flex-1">{guide.title}</span>
                          <span className="shrink-0 text-[10px] text-foreground-400">
                            {guide.date}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {episodes.map((episode) => (
                      <li key={episode.id}>
                        <Link
                          to={`/podcast#${episode.id}`}
                          title={
                            estEnLigne(episode.location)
                              ? `Épisode enregistré en ligne`
                              : `Épisode enregistré à ${episode.location}`
                          }
                          className="group flex items-start gap-2 text-xs text-foreground-700 hover:text-foreground-950 cursor-pointer"
                        >
                          <i className="ri-mic-line mt-0.5 text-primary-600"></i>
                          <span className="leading-snug flex-1">{episode.title}</span>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-foreground-400">
                            <i
                              className={
                                estEnLigne(episode.location)
                                  ? "ri-global-line"
                                  : "ri-map-pin-line"
                              }
                            ></i>
                            {episode.location}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {guides.length === 0 && episodes.length === 0 && (
                      <li className="text-xs text-foreground-500">Ses contenus arrivent bientôt.</li>
                    )}
                  </ul>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-50">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
              <i className="ri-search-line"></i>
            </span>
            <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
              Aucun membre ne correspond
            </h3>
            <p className="mt-2 text-sm text-foreground-600 max-w-md">
              Essayez un autre nom, un autre rôle, ou réinitialisez les filtres pour voir toute l'équipe.
            </p>
            <button
              type="button"
              onClick={reinitialiser}
              className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </section>
  );
}