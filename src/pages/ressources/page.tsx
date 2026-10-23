import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { articles, articlesRecents, articleFullText, isNouveauArticle, parseDateFr, readingMinutes, CATEGORIES_GUIDES_PRATIQUES } from "@/mocks/ressources";
import { getGuideMiseAJour } from "@/mocks/guidesMiseAJour";
import { metiers } from "@/mocks/metiers";
import ArticleCard from "@/components/feature/ArticleCard";
import { useDemoModal } from "@/hooks/useDemoModal";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSectionNav } from "@/hooks/useSectionNav";
import FilAriane from "@/components/feature/FilAriane";
import { useItemListSchema } from "@/hooks/useItemListSchema";
import SommaireRessources, { categoriesToSections } from "@/pages/ressources/components/SommaireRessources";
import ReprendreLecture from "@/pages/ressources/components/ReprendreLecture";
import ProgressionLecture from "@/pages/ressources/components/ProgressionLecture";
import StatsLecture from "@/pages/ressources/components/StatsLecture";
import ParcoursSection from "@/pages/ressources/components/ParcoursSection";
import FavorisBandeau from "@/pages/ressources/components/FavorisBandeau";
import ThemesFavorisBande from "@/components/feature/ThemesFavorisBande";
import SuggestionsRecherche from "@/pages/ressources/components/SuggestionsRecherche";
import { getStatut, getPoidsLecture } from "@/lib/lecture";
import { isFavori } from "@/lib/bibliotheque";
import { useLectureVersion } from "@/hooks/useLectureStatut";
import { useCompteurFavoris } from "@/hooks/useBibliotheque";
import {
  ecrireTemps,
  ecrireVueActive,
  lireTemps,
  lireVueActive,
  matchTemps,
  passeTemps,
  type FiltreTemps,
} from "@/lib/ressourcesPrefs";
import { useScrollMemory } from "@/hooks/useScrollMemory";
import ExporterMenu from "@/pages/ressources/components/ExporterMenu";
import FiltreTempsChips from "@/pages/ressources/components/FiltreTempsChips";

const MOTS_CLES_POPULAIRES = ["Devis", "Relance", "Chauffage", "Carrelage", "Façade", "Planning"];

type FiltreAvancement = "tous" | "nouveau" | "a-lire" | "en-cours" | "lu";

const FILTRES: { id: FiltreAvancement; label: string; icon: string }[] = [
  { id: "tous", label: "Tous", icon: "ri-list-check-2" },
  { id: "nouveau", label: "Nouveaux", icon: "ri-sparkling-2-line" },
  { id: "a-lire", label: "À lire", icon: "ri-bookmark-line" },
  { id: "en-cours", label: "En cours", icon: "ri-bookmark-3-line" },
  { id: "lu", label: "Lus", icon: "ri-check-double-line" },
];

type TriLecture = "metier" | "recent" | "lus" | "court" | "long";

const TRIS: { id: TriLecture; label: string; icon: string }[] = [
  { id: "metier", label: "Par métier", icon: "ri-layout-grid-line" },
  { id: "recent", label: "Plus récents", icon: "ri-time-line" },
  { id: "lus", label: "Plus lus", icon: "ri-fire-line" },
  { id: "court", label: "Plus courts", icon: "ri-sort-asc" },
  { id: "long", label: "Plus longs", icon: "ri-sort-desc" },
];

/** Description de l'en-tête pour chaque tri à plat. */
const TRIS_INFO: Record<Exclude<TriLecture, "metier">, { icon: string; eyebrow: string; title: string; description: string }> = {
  recent: {
    icon: "ri-time-line",
    eyebrow: "Tri par nouveauté",
    title: "Les plus récents d'abord",
    description: "Tous vos guides, du plus récent au plus ancien, pour mettre en avant les nouveaux parus.",
  },
  lus: {
    icon: "ri-fire-line",
    eyebrow: "Tri par lecture",
    title: "Ce que vous lisez le plus",
    description: "Vos guides les plus avancés remontent en tête, puis les plus récents, d'après votre suivi de lecture.",
  },
  court: {
    icon: "ri-sort-asc",
    eyebrow: "Tri par temps de lecture",
    title: "Du plus court au plus long",
    description: "Tous vos guides, classés selon leur durée de lecture pour choisir vite quoi lire.",
  },
  long: {
    icon: "ri-sort-desc",
    eyebrow: "Tri par temps de lecture",
    title: "Du plus long au plus court",
    description: "Tous vos guides, classés selon leur durée de lecture pour choisir vite quoi lire.",
  },
};

/** Clé de mémorisation locale du tri et du filtre d'avancement du hub. */
const PREFS_KEY = "artiflow:ressources:prefs";

/** Clé partagée entre les vues « Par métier » et « Par sujet » pour retrouver le métier choisi. */
const METIER_KEY = "artiflow:ressources:metier";

/** Relit le métier choisi (clé partagée avec la vue « Par sujet »). */
function lireMetierFiltre(): string {
  try {
    const valeur = window.localStorage.getItem(METIER_KEY);
    if (valeur && metiers.some((m) => m.slug === valeur)) return valeur;
  } catch {
    // Stockage indisponible : on ignore silencieusement.
  }
  return "";
}

const FILTRES_IDS = FILTRES.map((f) => f.id);
const TRIS_IDS = TRIS.map((t) => t.id);

type RessourcesPrefs = {
  recherche: string;
  filtre: FiltreAvancement;
  tri: TriLecture;
  misAJourSeuls: boolean;
};

/** Relit les préférences mémorisées du hub (recherche, filtre d'avancement, tri et révisions). */
function lirePrefs(): RessourcesPrefs {
  const defaut: RessourcesPrefs = { recherche: "", filtre: "tous", tri: "metier", misAJourSeuls: false };
  try {
    const brut = window.localStorage.getItem(PREFS_KEY);
    if (!brut) return defaut;
    const parse = JSON.parse(brut) as Partial<RessourcesPrefs>;
    return {
      recherche: typeof parse.recherche === "string" ? parse.recherche : defaut.recherche,
      filtre: FILTRES_IDS.includes(parse.filtre as FiltreAvancement)
        ? (parse.filtre as FiltreAvancement)
        : defaut.filtre,
      tri: TRIS_IDS.includes(parse.tri as TriLecture) ? (parse.tri as TriLecture) : defaut.tri,
      misAJourSeuls: parse.misAJourSeuls === true,
    };
  } catch {
    return defaut;
  }
}

export default function RessourcesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [prefs] = useState<RessourcesPrefs>(lirePrefs);
  const [recherche, setRecherche] = useState(prefs.recherche);
  const [filtre, setFiltre] = useState<FiltreAvancement>(prefs.filtre);
  const [tri, setTri] = useState<TriLecture>(prefs.tri);
  const [metierFiltre, setMetierFiltre] = useState<string>(lireMetierFiltre);
  const [temps, setTemps] = useState<FiltreTemps>(lireTemps);
  const [favorisSeuls, setFavorisSeuls] = useState(false);
  const [misAJourSeuls, setMisAJourSeuls] = useState(prefs.misAJourSeuls);
  const nbFavoris = useCompteurFavoris();
  const { openDemo } = useDemoModal();
  const goSection = useSectionNav();

  // Rouvre la dernière vue utilisée : si « Par sujet » était actif, on y retourne —
  // sauf quand on arrive par un clic explicite sur l'onglet « Par métier ».
  const intentionMetier = (location.state as { vue?: string } | null)?.vue === "metier";
  const [redirigerSujet] = useState<boolean>(() => !intentionMetier && lireVueActive() === "sujet");
  useEffect(() => {
    if (redirigerSujet) navigate("/ressources/sujets", { replace: true });
  }, [redirigerSujet, navigate]);

  // Retrouve la position de défilement au retour (désactivé si on redirige).
  useScrollMemory("artiflow:ressources:scroll:metier", !redirigerSujet);

  useEffect(() => {
    ecrireTemps(temps);
  }, [temps]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ recherche, filtre, tri, misAJourSeuls }));
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [recherche, filtre, tri, misAJourSeuls]);

  useEffect(() => {
    try {
      if (metierFiltre) window.localStorage.setItem(METIER_KEY, metierFiltre);
      else window.localStorage.removeItem(METIER_KEY);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [metierFiltre]);

  usePageMeta(
    "Ressources artisans : devis, relances | ArtiFlow-pro",
    "Guides courts et concrets pour les artisans du bâtiment : chiffrage des devis, relances clients et organisation de chantier, par corps d'état.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20stacked%20open%20notebooks%20and%20rolled%20blueprints%20with%20artisan%20tool%20silhouettes%2C%20warm%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ressources&orientation=landscape",
    }
  );

  useItemListSchema(
    {
      name: "Guides ArtiFlow-pro pour artisans du bâtiment",
      description:
        "Liste des guides pratiques par corps d'état : chiffrage des devis, relances clients et organisation de chantier.",
      items: articles.map((article) => ({
        name: article.title,
        path: article.href ?? `/ressources/${article.slug}`,
      })),
    },
    "artiflow-ressources-itemlist-schema"
  );

  const version = useLectureVersion();
  const compteStatut = useMemo(() => {
    let lu = 0;
    let enCours = 0;
    articles.forEach((a) => {
      const statut = getStatut(a.slug);
      if (statut === "lu") lu += 1;
      else if (statut === "en-cours") enCours += 1;
    });
    return { tous: articles.length, lu, enCours, aLire: articles.length - lu - enCours };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  const compteParFiltre: Record<FiltreAvancement, number> = {
    tous: compteStatut.tous,
    nouveau: articlesRecents.length,
    "a-lire": compteStatut.aLire,
    "en-cours": compteStatut.enCours,
    lu: compteStatut.lu,
  };

  const progressionParMetier = useMemo(() => {
    const map: Record<string, { lus: number; total: number }> = {};
    articles.forEach((a) => {
      const entry = map[a.category] ?? { lus: 0, total: 0 };
      entry.total += 1;
      if (getStatut(a.slug) === "lu") entry.lus += 1;
      map[a.category] = entry;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Nombre de guides disponibles par métier : sert à afficher le compteur dans les puces de filtre.
  const comptesMetier = useMemo(
    () =>
      metiers
        .map((metier) => ({ ...metier, count: articles.filter((a) => a.category === metier.slug).length }))
        .filter((m) => m.count > 0),
    []
  );

  // Guides ayant reçu une révision éditoriale (date de mise à jour renseignée).
  const nbMisAJour = articles.filter((a) => getGuideMiseAJour(a.slug)).length;

  const q = recherche.trim().toLowerCase();
  // Nombre de guides masqués par le filtre métier (pour le bandeau d'information).
  const guidesMasquesMetier =
    metierFiltre === "" ? 0 : articles.filter((a) => a.category !== metierFiltre).length;
  // Liste filtrée par métier, avancement et recherche (avant le filtre de temps).
  const listeSansTemps = articles.filter((a) => {
    if (metierFiltre && a.category !== metierFiltre) return false;
    if (favorisSeuls && !isFavori(a.slug)) return false;
    if (misAJourSeuls && !getGuideMiseAJour(a.slug)) return false;
    if (filtre === "nouveau" ? !isNouveauArticle(a) : filtre !== "tous" && getStatut(a.slug) !== filtre) {
      return false;
    }
    if (q === "") return true;
    const metierNom = metiers.find((m) => m.slug === a.category);
    const catPratique = CATEGORIES_GUIDES_PRATIQUES[a.category];
    const champs = [
      a.title,
      a.excerpt,
      articleFullText(a),
      metierNom?.name ?? "",
      metierNom?.shortName ?? "",
      catPratique?.name ?? "",
      catPratique?.shortName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return champs.includes(q);
  });
  // Filtre par temps de lecture appliqué en dernier.
  const liste = listeSansTemps.filter((a) => passeTemps(a, temps));
  // Compteurs par tranche de temps pour les filtres déjà actifs.
  const compteTemps: Record<FiltreTemps, number> = {
    tous: listeSansTemps.length,
    courts: listeSansTemps.filter((a) => matchTemps(readingMinutes(a), "courts")).length,
    moyens: listeSansTemps.filter((a) => matchTemps(readingMinutes(a), "moyens")).length,
    longs: listeSansTemps.filter((a) => matchTemps(readingMinutes(a), "longs")).length,
  };

  const groupes = Array.from(new Set(liste.map((a) => a.category)))
    .map((cat) => {
      const metier = metiers.find((m) => m.slug === cat);
      const pratique = CATEGORIES_GUIDES_PRATIQUES[cat];
      return {
        slug: cat,
        metier,
        name: metier?.name ?? pratique?.name ?? cat,
        shortName: metier?.shortName ?? pratique?.shortName ?? cat,
        items: liste.filter((a) => a.category === cat),
      };
    })
    .filter((g) => g.items.length > 0);

  const listeTriee =
    tri === "metier"
      ? liste
      : [...liste].sort((a, b) => {
          if (tri === "recent") return parseDateFr(b.date) - parseDateFr(a.date);
          if (tri === "court") return readingMinutes(a) - readingMinutes(b);
          if (tri === "long") return readingMinutes(b) - readingMinutes(a);
          if (tri === "lus") {
            const ecart = getPoidsLecture(b.slug) - getPoidsLecture(a.slug);
            return ecart !== 0 ? ecart : parseDateFr(b.date) - parseDateFr(a.date);
          }
          return 0;
        });

  const sections = tri === "metier" ? categoriesToSections(groupes.map((g) => g.slug)) : [];
  const sectionsAvecCompteur = sections.map((s) => {
    const prog = progressionParMetier[s.id];
    return { ...s, count: prog ? prog.total - prog.lus : 0 };
  });
  const sommaireSticky = sections.length > 0;
  const iconBySlug: Record<string, string> = {};
  sections.forEach((s) => {
    iconBySlug[s.id] = s.icon;
  });

  const reinitialiser = () => {
    setRecherche("");
    setFiltre("tous");
    setMetierFiltre("");
    setTemps("tous");
    setFavorisSeuls(false);
    setMisAJourSeuls(false);
  };

  const voirNouveautes = () => {
    setFiltre("nouveau");
    window.setTimeout(() => {
      document.getElementById("guides")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const infoTri = tri === "metier" ? null : TRIS_INFO[tri];

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Ressources", path: "/ressources" },
              ]}
              variante="clair"
              schemaId="artiflow-ressources-breadcrumb-schema"
            />

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-book-open-line"></i>
                Ressources artisans
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Des conseils courts, pensés pour le terrain
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Comment chiffrer plus vite, relancer au bon moment et organiser vos chantiers. Des guides
                par corps d'état, écrits pour être lus entre deux interventions.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openDemo("ressources")}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
              <Link
                to="/metiers"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-tools-line"></i>
                Voir les métiers
              </Link>
              <button
                type="button"
                onClick={voirNouveautes}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-accent-100 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
              >
                <i className="ri-sparkling-2-line"></i>
                Voir les nouveautés
              </button>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6 md:py-7">
            <div className="flex items-start gap-2.5 mb-3">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-base">
                <i className="ri-star-line"></i>
              </span>
              <div className="min-w-0">
                <h2 className="font-heading font-semibold text-base text-foreground-950">
                  Vos thèmes en avant
                </h2>
                <p className="text-xs text-foreground-600">
                  Épinglés depuis le menu ou une page thème, ils s'affichent en premier — la même logique que
                  le déroulant Ressources et la vue « Par sujet ». Le thème « Sécurité du compte » y figure en
                  permanence.
                </p>
              </div>
            </div>
            <ThemesFavorisBande showLabel={false} themesSupplementaires={["securite-du-compte"]} />
          </div>
        </section>

        <ProgressionLecture />

        <StatsLecture />

        <SommaireRessources sections={sectionsAvecCompteur} />

        <ReprendreLecture />

        <FavorisBandeau />

        <ParcoursSection />

        {q === "" && filtre === "tous" && metierFiltre === "" && !misAJourSeuls && (
          <section className="w-full bg-background-100 border-y border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
                <div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                    <i className="ri-sparkling-2-line"></i>
                    Fraîchement publié
                  </span>
                  <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                    Nouveautés
                  </h2>
                  <p className="mt-2 text-sm text-foreground-600 max-w-xl">
                    Les trois derniers guides parus, pour garder une longueur d'avance sur le terrain.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-600 whitespace-nowrap">
                  <i className="ri-calendar-line"></i>
                  Dernière parution : {articlesRecents[0]?.date}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {articlesRecents.map((article) => (
                  <ArticleCard key={article.slug} article={article} showMarquerLu highlight={recherche.trim()} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-16 pb-5">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  {liste.length} guide{liste.length > 1 ? "s" : ""} à lire
                </h2>
                <p className="mt-2 text-sm text-foreground-600">
                  Cherchez par mot-clé, puis parcourez les guides classés par corps d'état.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <Link
                  to="/ressources/bibliotheque"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                >
                  <i className="ri-book-marked-line"></i>
                  Ma bibliothèque
                </Link>
                <ExporterMenu liste={listeTriee} fichier="guides-metier" />
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-foreground-500 text-base"></i>
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un guide : devis, relance, carrelage…"
                  aria-label="Rechercher un guide par mot-clé"
                  className="w-full h-12 pl-11 pr-11 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-500 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                {recherche !== "" && (
                  <button
                    type="button"
                    onClick={() => setRecherche("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-foreground-500 hover:bg-background-200 hover:text-foreground-900 cursor-pointer transition-colors"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                )}
                <SuggestionsRecherche recherche={recherche} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground-500">Populaires :</span>
                {MOTS_CLES_POPULAIRES.map((mot) => {
                  const actif = q === mot.toLowerCase();
                  return (
                    <button
                      key={mot}
                      type="button"
                      onClick={() => setRecherche(mot)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                        actif
                          ? "bg-secondary-500 text-background-50 border-secondary-500"
                          : "bg-background-100 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-foreground-950"
                      }`}
                    >
                      {mot}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground-500">Métier :</span>
                <button
                  type="button"
                  onClick={() => setMetierFiltre("")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                    metierFiltre === ""
                      ? "bg-secondary-500 text-background-50 border-secondary-500"
                      : "bg-background-100 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-foreground-950"
                  }`}
                >
                  Tous les métiers
                  <span className={metierFiltre === "" ? "text-background-50/80" : "text-foreground-400"}>
                    {articles.length}
                  </span>
                </button>
                {comptesMetier.map((m) => {
                  const actif = metierFiltre === m.slug;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => setMetierFiltre(actif ? "" : m.slug)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                        actif
                          ? "bg-secondary-500 text-background-50 border-secondary-500"
                          : "bg-background-100 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-foreground-950"
                      }`}
                    >
                      <i className="ri-tools-line"></i>
                      {m.name}
                      <span className={actif ? "text-background-50/80" : "text-foreground-400"}>{m.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground-500 whitespace-nowrap">Temps de lecture :</span>
                <FiltreTempsChips value={temps} onChange={setTemps} counts={compteTemps} />
              </div>
              {q !== "" && (
                <p className="mt-3 text-xs text-foreground-500">
                  {liste.length} résultat{liste.length > 1 ? "s" : ""} pour « {recherche.trim()} »
                </p>
              )}
            </div>

            {misAJourSeuls && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary-100 border border-secondary-200">
                <span className="inline-flex items-center gap-2 text-sm text-secondary-900">
                  <i className="ri-history-line"></i>
                  <span>
                    Vous ne voyez que les <strong className="font-semibold">{liste.length}</strong> guide
                    {liste.length > 1 ? "s" : ""} révisé{liste.length > 1 ? "s" : ""} — le badge « Mis à jour le… »
                    indique la date de la dernière révision.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setMisAJourSeuls(false)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                >
                  <i className="ri-eye-line"></i>
                  Tout réafficher
                </button>
              </div>
            )}

            {metierFiltre !== "" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary-100 border border-secondary-200">
                <span className="inline-flex items-center gap-2 text-sm text-secondary-900">
                  <i className="ri-filter-3-line"></i>
                  <span>
                    <strong className="font-semibold">{guidesMasquesMetier}</strong> guide
                    {guidesMasquesMetier > 1 ? "s" : ""} masqué{guidesMasquesMetier > 1 ? "s" : ""} par le
                    filtre métier
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setMetierFiltre("")}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                >
                  <i className="ri-eye-line"></i>
                  Tout réafficher
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Barre collante : filtres, tri et bascule de vue */}
        <section
          id="guides"
          className={`sticky z-40 w-full bg-background-50/95 backdrop-blur border-y border-background-200 scroll-mt-32 ${
            sommaireSticky ? "top-[122px] md:top-[130px]" : "top-16 md:top-18"
          }`}
        >
          <div className="w-full px-4 md:px-8 lg:px-12 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="inline-flex p-1 rounded-full bg-background-100 border border-background-200 shrink-0">
                <span className="px-4 py-1.5 rounded-full bg-foreground-950 text-background-50 text-sm font-semibold whitespace-nowrap">
                  Par métier
                </span>
                <Link
                  to="/ressources/sujets"
                  onClick={() => ecrireVueActive("sujet")}
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-foreground-600 hover:text-foreground-950 cursor-pointer whitespace-nowrap"
                >
                  Par sujet
                </Link>
              </div>

              <div className="inline-flex items-center gap-1.5 shrink-0">
                <i className="ri-sort-desc text-foreground-500 text-base"></i>
                <div className="inline-flex flex-wrap p-1 rounded-full bg-background-100 border border-background-200">
                  {TRIS.map((option) => {
                    const actif = tri === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTri(option.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          actif
                            ? "bg-foreground-950 text-background-50 font-semibold"
                            : "text-foreground-600 hover:text-foreground-950"
                        }`}
                      >
                        <i className={option.icon}></i>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <span className="hidden xl:block w-px h-6 bg-background-300"></span>

              <div className="inline-flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground-500 whitespace-nowrap">
                  Avancement :
                </span>
                <div className="inline-flex flex-wrap p-1 rounded-full bg-background-100 border border-background-200">
                  {FILTRES.map((option) => {
                    const actif = filtre === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFiltre(option.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          actif
                            ? "bg-foreground-950 text-background-50 font-semibold"
                            : "text-foreground-600 hover:text-foreground-950"
                        }`}
                      >
                        <i className={option.icon}></i>
                        {option.label}
                        <span className={actif ? "text-background-200" : "text-foreground-500"}>
                          {compteParFiltre[option.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setFavorisSeuls((v) => !v)}
                  aria-pressed={favorisSeuls}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                    favorisSeuls
                      ? "bg-accent-500 text-background-50 border-accent-500 font-semibold"
                      : "bg-background-100 text-foreground-700 border-background-200 hover:border-accent-300 hover:text-accent-700"
                  }`}
                >
                  <i className={favorisSeuls ? "ri-bookmark-3-fill" : "ri-bookmark-3-line"}></i>
                  Favoris
                  <span className={favorisSeuls ? "text-background-50/80" : "text-foreground-400"}>{nbFavoris}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMisAJourSeuls((v) => !v)}
                  aria-pressed={misAJourSeuls}
                  title="N'afficher que les guides dont le contenu a été révisé récemment"
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                    misAJourSeuls
                      ? "bg-secondary-500 text-background-50 border-secondary-500 font-semibold"
                      : "bg-background-100 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-secondary-800"
                  }`}
                >
                  <i className="ri-history-line"></i>
                  Mis à jour récemment
                  <span className={misAJourSeuls ? "text-background-50/80" : "text-foreground-400"}>
                    {nbMisAJour}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {liste.length === 0 ? (
          <section className="w-full bg-background-50 border-t border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-16">
              <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-50 max-w-2xl mx-auto">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                  <i className="ri-search-eye-line"></i>
                </span>
                <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                  Aucun guide trouvé
                </h3>
                <p className="mt-2 text-sm text-foreground-600 max-w-md">
                  Aucun guide ne correspond à votre recherche ou à ce filtre d'avancement. Essayez un
                  autre mot-clé ou réinitialisez les filtres.
                </p>
                <button
                  type="button"
                  onClick={reinitialiser}
                  className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          </section>
        ) : tri !== "metier" ? (
          <section className="w-full bg-background-50 border-t border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
              {infoTri && (
                <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                      <i className={infoTri.icon}></i>
                      {infoTri.eyebrow}
                    </span>
                    <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                      {infoTri.title}
                    </h2>
                    <p className="mt-2 text-sm text-foreground-600">
                      {infoTri.description}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-secondary-100 border border-secondary-200 text-xs font-semibold text-secondary-900 whitespace-nowrap">
                    <i className="ri-book-open-line"></i>
                    {listeTriee.length} guide{listeTriee.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {listeTriee.map((article) => (
                  <ArticleCard key={article.slug} article={article} showMarquerLu highlight={recherche.trim()} />
                ))}
              </div>
            </div>
          </section>
        ) : (
          groupes.map((g, index) => {
            const prog = progressionParMetier[g.slug] ?? { lus: 0, total: 0 };
            const complet = prog.total > 0 && prog.lus === prog.total;
            return (
            <section
              key={g.slug}
              id={g.slug}
              className={`w-full border-t border-background-200 scroll-mt-[188px] ${
                index % 2 === 1 ? "bg-background-100" : "bg-background-50"
              }`}
            >
              <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
                  <div>
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-accent-700">
                      <span className="inline-flex items-center gap-2">
                        <i className={iconBySlug[g.slug] ?? "ri-book-2-line"}></i>
                        {g.items.length} guide{g.items.length > 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground-500">
                        <i className="ri-time-line"></i>
                        {g.items.reduce((acc, a) => acc + readingMinutes(a), 0)} min de lecture
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          complet
                            ? "bg-secondary-500 text-background-50"
                            : "bg-secondary-100 text-secondary-900"
                        }`}
                        title={`${prog.lus} guide${prog.lus > 1 ? "s" : ""} lu${prog.lus > 1 ? "s" : ""} sur ${prog.total}`}
                      >
                        <i className={complet ? "ri-check-double-line" : "ri-bookmark-line"}></i>
                        {prog.lus}/{prog.total} lus
                      </span>
                    </span>
                    <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                      {g.name}
                    </h2>
                  </div>
                  {g.metier && (
                    <Link
                      to={`/metiers/${g.metier.slug}`}
                      className="inline-flex items-center gap-2 self-start sm:self-auto text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Voir la fiche {g.shortName}
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {g.items.map((article) => (
                    <ArticleCard key={article.slug} article={article} showMarquerLu highlight={recherche.trim()} />
                  ))}
                </div>
              </div>
            </section>
            );
          })
        )}

        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-200">
                <i className="ri-lightbulb-flash-line"></i>
                Passer à la pratique
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Et si ces heures, on les récupérait vraiment ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                ArtiFlow-pro applique tout ça pour vous : devis dictés, relances automatiques et planning par
                zone. 20 minutes de démo suffisent pour le voir tourner.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("ressources-cta")}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    goSection("simulateur");
                  }}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-calculator-line"></i>
                  Estimer mon temps perdu
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-foreground-500">
            <i className="ri-map-2-line text-secondary-600"></i>
            <span>Vous cherchez une page précise ?</span>
            <Link
              to="/plan-du-site"
              className="inline-flex items-center gap-1 font-semibold text-secondary-700 hover:text-secondary-800 transition-colors cursor-pointer"
            >
              Consulter le plan du site
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}