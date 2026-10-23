import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import ArticleCard from "@/components/feature/ArticleCard";
import { articles, articleFullText, parseDateFr, readingMinutes, sujetDateRecente } from "@/mocks/ressources";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import { metiers } from "@/mocks/metiers";
import { sujets } from "@/mocks/sujets";
import { ordonnerSujetsParFavoris } from "@/lib/themesFavoris";
import { useThemesFavoris } from "@/hooks/useThemesFavoris";
import { useDemoModal } from "@/hooks/useDemoModal";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useItemListSchema } from "@/hooks/useItemListSchema";
import SommaireSujets from "@/pages/ressources/components/SommaireSujets";
import SujetEpinglerButton from "@/pages/ressources/components/SujetEpinglerButton";
import { getPoidsLecture } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";
import {
  ecrireTemps,
  ecrireVueActive,
  lireTemps,
  matchTemps,
  passeTemps,
  type FiltreTemps,
} from "@/lib/ressourcesPrefs";
import { useScrollMemory } from "@/hooks/useScrollMemory";
import ExporterMenu from "@/pages/ressources/components/ExporterMenu";
import FiltreTempsChips from "@/pages/ressources/components/FiltreTempsChips";
import SuggestionsRecherche from "@/pages/ressources/components/SuggestionsRecherche";
import { isFavori } from "@/lib/bibliotheque";
import { useCompteurFavoris } from "@/hooks/useBibliotheque";

const MOTS_CLES_POPULAIRES = ["Devis", "Relance", "Chauffage", "Carrelage", "Façade", "Planning"];

/** Clé partagée avec la vue « Par métier » pour retrouver le métier choisi. */
const METIER_KEY = "artiflow:ressources:metier";

/** Relit le métier choisi (clé partagée avec la vue « Par métier »). */
function lireMetierFiltre(): string {
  try {
    const valeur = window.localStorage.getItem(METIER_KEY);
    if (valeur && metiers.some((m) => m.slug === valeur)) return valeur;
  } catch {
    // Stockage indisponible : on ignore silencieusement.
  }
  return "";
}

type TriSujet = "sujet" | "recent" | "lus" | "court" | "long";

const TRIS_SUJET: { id: TriSujet; label: string; icon: string }[] = [
  { id: "sujet", label: "Par thème", icon: "ri-layout-grid-line" },
  { id: "recent", label: "Plus récents", icon: "ri-time-line" },
  { id: "lus", label: "Plus lus", icon: "ri-fire-line" },
  { id: "court", label: "Plus courts", icon: "ri-sort-asc" },
  { id: "long", label: "Plus longs", icon: "ri-sort-desc" },
];

/** Description de l'en-tête pour chaque tri à plat. */
const TRIS_INFO: Record<Exclude<TriSujet, "sujet">, { icon: string; eyebrow: string; title: string; description: string }> = {
  recent: {
    icon: "ri-time-line",
    eyebrow: "Tri par nouveauté",
    title: "Les plus récents d'abord",
    description: "Tous les guides, du plus récent au plus ancien, pour mettre en avant les nouveaux parus.",
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
    description: "Tous les guides, classés selon leur durée de lecture pour choisir vite quoi lire.",
  },
  long: {
    icon: "ri-sort-desc",
    eyebrow: "Tri par temps de lecture",
    title: "Du plus long au plus court",
    description: "Tous les guides, classés selon leur durée de lecture pour choisir vite quoi lire.",
  },
};

/** Clé de mémorisation locale du tri de la vue « Par sujet ». */
const TRI_KEY = "artiflow:ressources:sujets:tri";
const TRIS_SUJET_IDS = TRIS_SUJET.map((t) => t.id);

/** Relit le tri mémorisé de la vue « Par sujet ». */
function lireTri(): TriSujet {
  try {
    const valeur = window.localStorage.getItem(TRI_KEY);
    if (valeur && TRIS_SUJET_IDS.includes(valeur as TriSujet)) return valeur as TriSujet;
  } catch {
    // Stockage indisponible : on ignore silencieusement.
  }
  return "sujet";
}

/** Clé de mémorisation locale de la recherche de la vue « Par sujet ». */
const RECHERCHE_KEY = "artiflow:ressources:sujets:recherche";

/** Relit la recherche mémorisée de la vue « Par sujet ». */
function lireRecherche(): string {
  try {
    return window.localStorage.getItem(RECHERCHE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function RessourcesSujetsPage() {
  const { openDemo } = useDemoModal();
  const version = useLectureVersion();
  const [recherche, setRecherche] = useState<string>(lireRecherche);
  const [metierFiltre, setMetierFiltre] = useState<string>(lireMetierFiltre);
  const [tri, setTri] = useState<TriSujet>(lireTri);
  const [temps, setTemps] = useState<FiltreTemps>(lireTemps);
  const [favorisSeuls, setFavorisSeuls] = useState(false);
  const nbFavoris = useCompteurFavoris();
  const themesFavoris = useThemesFavoris();

  useEffect(() => {
    ecrireTemps(temps);
  }, [temps]);

  // Mémorise que la vue « Par sujet » est la dernière utilisée.
  useEffect(() => {
    ecrireVueActive("sujet");
  }, []);

  // Retrouve la position de défilement au retour sur la vue « Par sujet ».
  useScrollMemory("artiflow:ressources:scroll:sujet");

  useEffect(() => {
    try {
      if (recherche) window.localStorage.setItem(RECHERCHE_KEY, recherche);
      else window.localStorage.removeItem(RECHERCHE_KEY);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [recherche]);

  useEffect(() => {
    try {
      if (metierFiltre) window.localStorage.setItem(METIER_KEY, metierFiltre);
      else window.localStorage.removeItem(METIER_KEY);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [metierFiltre]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRI_KEY, tri);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [tri]);

  // Nombre de guides disponibles par métier : sert à afficher le compteur dans les puces.
  const comptesMetier = metiers
    .map((metier) => ({ ...metier, count: articles.filter((a) => a.category === metier.slug).length }))
    .filter((m) => m.count > 0);

  // Guides du métier courant, avant le filtre de temps de lecture.
  const articlesAvantTemps = articles.filter((a) => {
    if (metierFiltre && a.category !== metierFiltre) return false;
    if (favorisSeuls && !isFavori(a.slug)) return false;
    return true;
  });
  // Filtre par temps de lecture appliqué en dernier.
  const articlesFiltresMetier = articlesAvantTemps.filter((a) => passeTemps(a, temps));
  // Compteurs par tranche de temps pour les filtres déjà actifs.
  const compteTemps: Record<FiltreTemps, number> = {
    tous: articlesAvantTemps.length,
    courts: articlesAvantTemps.filter((a) => matchTemps(readingMinutes(a), "courts")).length,
    moyens: articlesAvantTemps.filter((a) => matchTemps(readingMinutes(a), "moyens")).length,
    longs: articlesAvantTemps.filter((a) => matchTemps(readingMinutes(a), "longs")).length,
  };

  // Nombre de guides masqués par le filtre métier (pour le bandeau d'information).
  const guidesMasquesMetier = articles.length - articlesAvantTemps.length;

  // Applique le tri courant à une liste d'articles.
  const trierListe = (list: typeof articles) =>
    [...list].sort((a, b) => {
      if (tri === "recent") return parseDateFr(b.date) - parseDateFr(a.date);
      if (tri === "court") return readingMinutes(a) - readingMinutes(b);
      if (tri === "long") return readingMinutes(b) - readingMinutes(a);
      if (tri === "lus") {
        const ecart = getPoidsLecture(b.slug) - getPoidsLecture(a.slug);
        return ecart !== 0 ? ecart : parseDateFr(b.date) - parseDateFr(a.date);
      }
      return 0;
    });

  const listeTriee = useMemo(
    () => (tri === "sujet" ? articlesFiltresMetier : trierListe(articlesFiltresMetier)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tri, articlesFiltresMetier, version]
  );

  // Les thèmes épinglés remontent en tête, comme dans la bande du déroulant Ressources.
  const sujetsAffiches = ordonnerSujetsParFavoris(sujets, themesFavoris)
    .map((sujet) => ({
      sujet,
      items: articlesFiltresMetier.filter((article) => sujet.articleSlugs.includes(article.slug)),
    }))
    .filter((entry) => entry.items.length > 0);

  const q = recherche.trim().toLowerCase();
  const resultats =
    q === ""
      ? []
      : articlesFiltresMetier.filter((article) => {
          const metierNom = metiers.find((m) => m.slug === article.category);
          const champs = [
            article.title,
            article.excerpt,
            articleFullText(article),
            metierNom?.name ?? "",
            metierNom?.shortName ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return champs.includes(q);
        });

  const resultatsAffiches = useMemo(
    () => (tri === "sujet" ? resultats : trierListe(resultats)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tri, resultats, version]
  );

  // Liste actuellement affichée : sert de base à l'export CSV.
  const listeExport = q === "" ? listeTriee : resultatsAffiches;

  const infoTri = tri === "sujet" ? null : TRIS_INFO[tri];

  usePageMeta(
    "Ressources par sujet : chiffrage & relances | ArtiFlow-pro",
    "Explorez les guides ArtiFlow-pro par thème : chiffrage, relances clients et planning, avec un article pour chaque question de métier.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20illustrating%20construction%20resources%20sorted%20by%20topic%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20geometric%20shapes%2C%20floating%20tag%20and%20folder%20silhouettes%2C%20blueprint%20grid%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-sujets-n1&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Ressources", path: "/ressources" },
      { name: "Par sujet", path: "/ressources/sujets" },
    ],
    "artiflow-ressources-sujets-breadcrumb-schema"
  );

  useItemListSchema(
    {
      name: "Guides ArtiFlow-pro par sujet",
      description:
        "Les guides ArtiFlow-pro regroupés par thème : chiffrage des devis, relances clients et organisation de chantier.",
      items: sujets.map((sujet) => ({
        name: sujet.name,
        path: `/ressources/sujets#sujet-${sujet.slug}`,
      })),
    },
    "artiflow-ressources-sujets-itemlist-schema"
  );

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/ressources" state={{ vue: "metier" }} onClick={() => ecrireVueActive("metier")} className="hover:text-foreground-900 cursor-pointer">
                Ressources
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Par sujet</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-book-open-line"></i>
                Ressources par sujet
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Les guides classés par thème, pas par corps d'état
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Relances, chiffrage, planning : les grandes familles de problèmes que tous les artisans
                partagent, plus un thème à part pour protéger votre compte. Retrouvez ici les guides qui
                répondent à une question précise, quel que soit votre métier.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="inline-flex p-1 rounded-full bg-background-50 border border-background-200">
                <Link
                  to="/ressources"
                  state={{ vue: "metier" }}
                  onClick={() => ecrireVueActive("metier")}
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-foreground-600 hover:text-foreground-950 cursor-pointer whitespace-nowrap"
                >
                  Par métier
                </Link>
                <span className="px-4 py-1.5 rounded-full bg-foreground-950 text-background-50 text-sm font-semibold whitespace-nowrap">
                  Par sujet
                </span>
              </div>
              <button
                type="button"
                onClick={() => openDemo("ressources-sujets")}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
            </div>

            <div className="mt-7 max-w-2xl">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-foreground-500 text-base"></i>
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un thème : relance, chiffrage, planning…"
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
                      onClick={() => setRecherche(actif ? "" : mot)}
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
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground-500 whitespace-nowrap">Temps de lecture :</span>
              <FiltreTempsChips value={temps} onChange={setTemps} counts={compteTemps} />
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
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground-500">Trier :</span>
              <div className="inline-flex flex-wrap p-1 rounded-full bg-background-100 border border-background-200">
                {TRIS_SUJET.map((option) => {
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
              <Link
                to="/ressources/bibliotheque"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
              >
                <i className="ri-book-marked-line"></i>
                Ma bibliothèque
              </Link>
              <ExporterMenu liste={listeExport} fichier="guides-sujet" />
            </div>

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

        {tri === "sujet" && q === "" && metierFiltre === "" && <SommaireSujets />}

        {tri === "sujet" && q === "" && sujetsAffiches.map(({ sujet, items }, index) => {
          const alternance = index % 2 === 0 ? "bg-background-50" : "bg-background-100 border-y border-background-200";
          return (
            <section
              key={sujet.slug}
              id={`sujet-${sujet.slug}`}
              className={`w-full scroll-mt-28 ${alternance}`}
            >
              <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
                <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-8 mb-9">
                  <span className="w-14 h-14 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-2xl">
                    <i className={sujet.icon}></i>
                  </span>
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                        {sujet.name}
                      </h2>
                      <span className="px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold">
                        {items.length} guides
                      </span>
                      <BadgeNouveau dateISO={sujetDateRecente(sujet.slug)} />
                      <SujetEpinglerButton slug={sujet.slug} name={sujet.name} />
                    </div>
                    <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                      {sujet.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((article) => (
                    <ArticleCard key={article.slug} article={article} showMarquerLu highlight={recherche.trim()} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {q !== "" && (
          <section className="w-full bg-background-50">
            <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight mb-8">
                {resultats.length} guide{resultats.length > 1 ? "s" : ""} pour « {recherche.trim()} »
              </h2>
              {resultats.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-lg border border-dashed border-background-300 bg-background-50">
                  <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                    <i className="ri-search-eye-line"></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                    Aucun guide trouvé
                  </h3>
                  <p className="mt-2 text-sm text-foreground-600 max-w-md">
                    Aucun guide ne correspond à ce mot-clé. Essayez un autre terme ou explorez les thèmes ci-dessus.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRecherche("")}
                    className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-refresh-line"></i>
                    Effacer la recherche
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {resultatsAffiches.map((article) => (
                    <ArticleCard key={article.slug} article={article} showMarquerLu highlight={recherche.trim()} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {q === "" && tri !== "sujet" && (
          <section className="w-full bg-background-50 border-t border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
              {infoTri && (
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
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
        )}

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-200">
                <i className="ri-tools-line"></i>
                Vous cherchez votre métier ?
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Retrouvez aussi tous les guides par corps d'état
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Chaque métier a sa page dédiée et ses conseils sur mesure : plombier, électricien, maçon,
                peintre, menuisier, carreleur, couvreur et plaquiste.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/metiers"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-hammer-line"></i>
                  Voir les métiers
                </Link>
                <Link
                  to="/ressources"
                  state={{ vue: "metier" }}
                  onClick={() => ecrireVueActive("metier")}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-book-open-line"></i>
                  Guides par métier
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}