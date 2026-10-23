import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { nouveautesTriees } from "@/lib/quoiDeNeufVu";
import { imageAnnonce } from "@/lib/imagesAnnonces";
import { IMAGE_PARTAGE_RECAP_NOUVEAUTES } from "@/lib/imagesPartage";
import { categoriesNouveautes, niveauLabels, type NiveauNouveaute } from "@/mocks/nouveautes";
import BoutonPartagerAnnonce from "@/pages/nouveautes/recapitulatif/components/BoutonPartagerAnnonce";
import BoutonTelechargerImage from "@/pages/nouveautes/recapitulatif/components/BoutonTelechargerImage";
import { lireFiltresRecap, memoriserFiltresRecap } from "@/lib/recapNouveautesFiltresMemoire";

/** Libellé lisible d'une catégorie du journal. */
function libelleCategorie(key: string): string {
  return categoriesNouveautes.find((c) => c.key === key)?.label ?? key;
}

const categorieTone: Record<string, string> = {
  devis: "bg-primary-100 text-primary-700",
  clients: "bg-accent-100 text-accent-800",
  relances: "bg-accent-100 text-accent-800",
  planning: "bg-secondary-100 text-secondary-800",
  comptabilite: "bg-primary-100 text-primary-700",
  tarifs: "bg-accent-100 text-accent-800",
  site: "bg-secondary-100 text-secondary-800",
  espace: "bg-secondary-100 text-secondary-800",
};

const niveauTone: Record<NiveauNouveaute, string> = {
  majeur: "bg-accent-500 text-background-50",
  amelioration: "bg-primary-100 text-primary-700",
  correctif: "bg-secondary-100 text-secondary-800",
};

const TOUTES = "toutes";

/**
 * Récapitulatif du journal : toutes les annonces, chacune avec son visuel de partage.
 *
 * Utile pour retrouver d'un coup d'œil ce qui a été livré, comparer les versions et récupérer
 * une vignette prête à partager. Les annonces qui ont une page dédiée y renvoient directement ;
 * les autres renvoient au journal complet. Un double filtre (catégorie + année) permet de
 * retrouver une livraison précise sans parcourir toute la liste.
 */
export default function NouveautesRecapitulatifPage() {
  const derniere = nouveautesTriees[0];

  /** Années présentes dans le journal, de la plus récente à la plus ancienne. */
  const annees = useMemo(() => {
    const uniques = Array.from(new Set(nouveautesTriees.map((n) => n.dateIso.slice(0, 4))));
    return uniques.sort((a, b) => Number(b) - Number(a));
  }, []);

  /** Sélection relue de la dernière visite, ignorée si elle n'a plus de sens. */
  const memoire = useMemo(() => lireFiltresRecap(), []);
  const categorieInitiale = categoriesNouveautes.some((c) => c.key === memoire.categorie)
    ? memoire.categorie
    : TOUTES;
  const anneeInitiale = annees.includes(memoire.annee) ? memoire.annee : TOUTES;
  const [categorie, setCategorie] = useState<string>(categorieInitiale);
  const [annee, setAnnee] = useState<string>(anneeInitiale);

  /** Mémorise la sélection à chaque changement, pour la retrouver à la prochaine visite. */
  useEffect(() => {
    memoriserFiltresRecap({ categorie, annee });
  }, [categorie, annee]);

  /** Nombre d'annonces par catégorie, en tenant compte de l'année sélectionnée. */
  const compteParCategorie = useMemo(() => {
    const base: Record<string, number> = {};
    nouveautesTriees.forEach((n) => {
      if (annee !== TOUTES && !n.dateIso.startsWith(annee)) return;
      base[n.categorie] = (base[n.categorie] ?? 0) + 1;
    });
    return base;
  }, [annee]);

  const totalAnnee = useMemo(
    () => Object.values(compteParCategorie).reduce((somme, n) => somme + n, 0),
    [compteParCategorie]
  );

  const listeFiltree = useMemo(
    () =>
      nouveautesTriees.filter((n) => {
        const okCategorie = categorie === TOUTES || n.categorie === categorie;
        const okAnnee = annee === TOUTES || n.dateIso.startsWith(annee);
        return okCategorie && okAnnee;
      }),
    [categorie, annee]
  );

  const filtreActif = categorie !== TOUTES || annee !== TOUTES;
  const reinitialiser = () => {
    setCategorie(TOUTES);
    setAnnee(TOUTES);
  };

  usePageMeta(
    "Toutes les annonces ArtiFlow-pro · Récapitulatif en images",
    "Toutes les annonces du journal ArtiFlow-pro réunies : version, date, résumé et visuel de partage. Filtrez par catégorie et par année pour retrouver une livraison précise.",
    {
      image: IMAGE_PARTAGE_RECAP_NOUVEAUTES,
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Nouveautés", path: "/nouveautes" },
      { name: "Récapitulatif", path: "/nouveautes/recapitulatif" },
    ],
    "artiflow-nouveautes-recap-breadcrumb-schema"
  );

  useStructuredData("artiflow-nouveautes-recap-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Toutes les annonces ArtiFlow-pro",
    itemListElement: nouveautesTriees.map((n, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${n.version} — ${n.title}`,
      description: n.summary,
    })),
  });

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-14">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/nouveautes" className="hover:text-foreground-900 cursor-pointer">
                Nouveautés
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Récapitulatif</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-gallery-line"></i>
                Récapitulatif du journal
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Toutes les annonces, en images
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Chaque livraison avec sa version, sa date, son résumé et son visuel de partage. Un seul
                endroit pour retrouver ce qui a changé, de la plus récente à la plus ancienne.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-rocket-2-line"></i>
                {nouveautesTriees.length} annonces
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-history-line"></i>
                Dernière livraison : {derniere.dateLabel}
              </span>
              <Link
                to="/nouveautes"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-background-300 bg-background-50 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                <i className="ri-article-line"></i>
                Revenir au journal
              </Link>
              <a
                href="/nouveautes/rss.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-background-300 bg-background-50 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                <i className="ri-rss-line"></i>
                Flux RSS
              </a>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="rounded-lg border border-background-200 bg-background-100 p-4 md:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-500 md:mt-1.5 md:w-24 shrink-0">
                    <i className="ri-price-tag-3-line"></i>
                    Catégorie
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {categoriesNouveautes.map((c) => {
                      const actif = categorie === c.key;
                      const nombre = c.key === TOUTES ? totalAnnee : (compteParCategorie[c.key] ?? 0);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setCategorie(c.key)}
                          aria-pressed={actif}
                          title={`${nombre} annonce${nombre > 1 ? "s" : ""} · ${c.label}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                            actif
                              ? "bg-primary-500 border-primary-500 text-background-50"
                              : nombre === 0
                                ? "bg-background-50 border-background-200 text-foreground-400 hover:border-primary-300 hover:text-primary-700"
                                : "bg-background-50 border-background-200 text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                          }`}
                        >
                          <i className={c.icon}></i>
                          {c.label}
                          <span
                            className={`inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                              actif
                                ? "bg-background-50/25 text-background-50"
                                : "bg-background-200 text-foreground-600"
                            }`}
                          >
                            {nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-500 md:mt-1.5 md:w-24 shrink-0">
                    <i className="ri-calendar-line"></i>
                    Année
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAnnee(TOUTES)}
                      aria-pressed={annee === TOUTES}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                        annee === TOUTES
                          ? "bg-secondary-500 border-secondary-500 text-background-50"
                          : "bg-background-50 border-background-200 text-foreground-700 hover:border-secondary-300 hover:text-secondary-800"
                      }`}
                    >
                      <i className="ri-calendar-event-line"></i>
                      Toutes années
                    </button>
                    {annees.map((a) => {
                      const actif = annee === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAnnee(a)}
                          aria-pressed={actif}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                            actif
                              ? "bg-secondary-500 border-secondary-500 text-background-50"
                              : "bg-background-50 border-background-200 text-foreground-700 hover:border-secondary-300 hover:text-secondary-800"
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-background-200 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-foreground-600">
                  <strong className="text-foreground-900">{listeFiltree.length}</strong> annonce
                  {listeFiltree.length > 1 ? "s" : ""}
                  {filtreActif ? (
                    <>
                      {" "}sur {nouveautesTriees.length}
                      {categorie !== TOUTES && <> · {libelleCategorie(categorie)}</>}
                      {annee !== TOUTES && <> · {annee}</>}
                    </>
                  ) : (
                    <> dans le journal</>
                  )}
                </p>
                {filtreActif && (
                  <button
                    type="button"
                    onClick={reinitialiser}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors"
                  >
                    <i className="ri-refresh-line"></i>
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            </div>

            {listeFiltree.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-background-300 bg-background-50 p-10 text-center">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-background-100 text-foreground-500 text-xl">
                  <i className="ri-filter-off-line"></i>
                </span>
                <p className="mt-4 font-heading font-semibold text-base text-foreground-950">
                  Aucune annonce pour ce filtre
                </p>
                <p className="mt-1 text-sm text-foreground-600">
                  Essayez une autre catégorie ou revenez à toutes les années.
                </p>
                <button
                  type="button"
                  onClick={reinitialiser}
                  className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Tout afficher
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {listeFiltree.map((n, index) => {
                  const visuel = imageAnnonce(n.id);
                  return (
                    <article
                      key={n.id}
                      id={`annonce-${n.id}`}
                      className="flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden transition-colors hover:border-primary-300 scroll-mt-32"
                    >
                      <div className="relative w-full aspect-[1200/630] bg-background-200 overflow-hidden">
                        {visuel ? (
                          <img
                            src={visuel}
                            alt={`Visuel de partage — ${n.title}`}
                            title={`${n.title} · ArtiFlow-pro v${n.version}`}
                            width={1200}
                            height={630}
                            loading={index < 3 ? "eager" : "lazy"}
                            fetchPriority={index < 2 ? "high" : "low"}
                            decoding="async"
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-foreground-400">
                            <i className="ri-image-2-line text-3xl"></i>
                          </div>
                        )}
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground-950/85 text-background-50 text-[11px] font-bold whitespace-nowrap">
                          <i className="ri-git-commit-line"></i>
                          v{n.version}
                        </span>
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background-50/90 text-foreground-700 text-[10px] font-semibold whitespace-nowrap">
                          <i className="ri-image-line"></i>
                          1200 × 630
                        </span>
                      </div>

                      <div className="flex flex-col flex-1 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${niveauTone[n.niveau]}`}>
                            <i className="ri-award-line"></i>
                            {niveauLabels[n.niveau]}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${categorieTone[n.categorie] ?? "bg-background-100 text-foreground-700"}`}>
                            <i className={n.icon}></i>
                            {libelleCategorie(n.categorie)}
                          </span>
                        </div>

                        <h2 className="mt-3 font-heading font-bold text-base md:text-lg text-foreground-950 tracking-tight leading-snug">
                          {n.title}
                        </h2>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-foreground-500">
                          <i className="ri-calendar-line"></i>
                          <time dateTime={n.dateIso}>{n.dateLabel}</time>
                        </p>
                        <p className="mt-2 text-sm text-foreground-600 leading-relaxed line-clamp-3">{n.summary}</p>

                        <div className="mt-auto pt-4 border-t border-background-200 flex items-center justify-between gap-2">
                          {n.lien ? (
                            <Link
                              to={n.lien}
                              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
                            >
                              {n.lienLabel ?? "Lire l'annonce"}
                              <i className="ri-arrow-right-line"></i>
                            </Link>
                          ) : (
                            <Link
                              to="/nouveautes"
                              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-700 hover:gap-3 transition-all cursor-pointer"
                            >
                              Voir dans le journal
                              <i className="ri-arrow-right-line"></i>
                            </Link>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <BoutonTelechargerImage
                              image={visuel}
                              nomFichier={`artiflow-annonce-v${n.version}-${n.id}`}
                            />
                            <BoutonPartagerAnnonce
                              titre={`${n.title} · ArtiFlow-pro v${n.version}`}
                              chemin={n.lien ?? `/nouveautes/recapitulatif#annonce-${n.id}`}
                              image={visuel}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                Une annonce vous intéresse ?
              </h2>
              <p className="mt-3 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Le journal détaillé reprend chaque livraison avec ses points clés, filtrable par thème.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/nouveautes"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-article-line"></i>
                  Ouvrir le journal
                </Link>
                <Link
                  to="/tarifs"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-price-tag-3-line"></i>
                  Voir les offres
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