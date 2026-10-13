import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import ArticleCard from "@/components/feature/ArticleCard";
import EpisodeCard from "@/pages/podcast/components/EpisodeCard";
import NotFound from "@/pages/NotFound";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { useDemoModal } from "@/hooks/useDemoModal";
import { equipe, membreParId } from "@/mocks/equipe";
import { articlesDuMembre } from "@/mocks/auteurs";
import { episodesDuMembre } from "@/mocks/podcasts";
import { interventionsDuMembre } from "@/mocks/interventions";

const toneChip: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

/**
 * Mini page auteur : pour chaque membre de l'équipe, sa présentation, ses
 * guides écrits et les épisodes podcast auxquels il/elle a participé.
 */
export default function AuteurPage() {
  const { id = "" } = useParams();
  const membre = membreParId(id);
  const guides = membre ? articlesDuMembre(membre.id) : [];
  const episodes = membre ? episodesDuMembre(membre.id) : [];
  const interventions = membre ? interventionsDuMembre(membre.id) : [];
  const autresMembres = equipe.filter((m) => m.id !== id);
  const position = equipe.findIndex((m) => m.id === membre?.id);
  const precedent = position > 0 ? equipe[position - 1] : equipe[equipe.length - 1];
  const suivant = position < equipe.length - 1 ? equipe[position + 1] : equipe[0];
  const { openDemo } = useDemoModal();

  usePageMeta(
    membre ? `${membre.name} · ${membre.role} chez ArtiFlow-pro` : "Membre de l'équipe · ArtiFlow-pro",
    membre
      ? `Découvrez ${membre.name}, ${membre.role} chez ArtiFlow-pro, ainsi que ses guides, ses interventions publiques (conférences, webinaires) et ses épisodes podcast. ${membre.bio}`
      : undefined,
    { type: "profile", image: membre?.shareImage ?? membre?.photo }
  );

  useBreadcrumbSchema(
    membre
      ? [
          { name: "Accueil", path: "/" },
          { name: "À propos", path: "/a-propos#equipe" },
          { name: membre.name, path: `/auteurs/${membre.id}` },
        ]
      : [{ name: "Accueil", path: "/" }],
    `artiflow-auteur-breadcrumb-${id}`
  );

  useStructuredData(
    `artiflow-person-${id}`,
    membre
      ? {
          "@context": "https://schema.org",
          "@type": "Person",
          name: membre.name,
          jobTitle: membre.role,
          description: membre.bio,
          image: membre.photo,
          url: `${getSiteOrigin()}/auteurs/${membre.id}`,
          sameAs: [membre.linkedin],
          knowsAbout: membre.expertises,
          worksFor: { "@type": "Organization", name: "ArtiFlow-pro" },
        }
      : null
  );

  if (!membre) {
    return <NotFound />;
  }

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        {/* Héro */}
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/a-propos#equipe" className="hover:text-foreground-900 cursor-pointer">À propos</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">{membre.name}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8 lg:gap-14 items-center">
              <div className="w-full h-80 md:h-[440px] rounded-lg overflow-hidden border border-background-200 bg-background-100">
                <img
                  src={membre.photo}
                  alt={`Portrait de ${membre.name}, ${membre.role} chez ArtiFlow-pro`}
                  title={`${membre.name} · ${membre.role}`}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-user-star-line"></i>
                  Membre de l'équipe
                </span>
                <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                  {membre.name}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <span className={`inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${toneChip[membre.tone]}`}>
                    {membre.role}
                  </span>
                  <Link
                    to={`/plan-du-site?membre=${membre.id}&q=${encodeURIComponent(membre.name)}#equipe-auteurs`}
                    title="Retrouver cette page dans la section Équipe du plan du site"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-semibold hover:bg-secondary-200 transition-colors cursor-pointer"
                  >
                    <i className="ri-map-2-line"></i>
                    Dans le plan du site
                  </Link>
                  {interventions.length > 0 && (
                    <Link
                      to="/podcast#interventions-publiques"
                      title={`Voir les ${interventions.length} prises de parole de ${membre.name} sur la page Média`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold hover:bg-accent-200 transition-colors cursor-pointer"
                    >
                      <i className="ri-presentation-line"></i>
                      {interventions.length} prise{interventions.length > 1 ? "s" : ""} de parole
                    </Link>
                  )}
                </div>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  {membre.bio}
                </p>

                <blockquote className="mt-6 pl-4 border-l-2 border-accent-400 text-sm md:text-base italic text-foreground-700">
                  « {membre.citation} »
                </blockquote>

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground-600">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-map-pin-line text-secondary-600"></i>
                    {membre.ville}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-calendar-line text-secondary-600"></i>
                    Dans l'équipe depuis {membre.depuis}
                  </span>
                </div>

                <div className="mt-7 flex flex-col sm:flex-row flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openDemo(`auteur-${membre.id}`)}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Demander une démo
                  </button>
                  <a
                    href={membre.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-linkedin-box-line"></i>
                    LinkedIn
                  </a>
                  <Link
                    to="/a-propos#equipe"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-arrow-left-line"></i>
                    Retour à l'annuaire
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Parcours & expertises */}
        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-road-map-line"></i>
                  Son parcours
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Le chemin jusqu'à ArtiFlow-pro
                </h2>
                <ol className="mt-6 flex flex-col gap-5">
                  {membre.parcours.map((etape, index) => (
                    <li key={etape} className="flex gap-4">
                      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 font-heading font-bold text-xs">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-sm text-foreground-600 leading-relaxed">{etape}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
                  <i className="ri-lightbulb-line"></i>
                  Ses expertises
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Ce sur quoi {membre.name.split(" ")[0]} intervient
                </h2>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {membre.expertises.map((expertise) => (
                    <span
                      key={expertise}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary-100 text-secondary-900 text-sm font-medium"
                    >
                      <i className="ri-check-line text-secondary-700"></i>
                      {expertise}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ses guides */}
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-article-line"></i>
                  {guides.length} guide{guides.length > 1 ? "s" : ""} signé{guides.length > 1 ? "s" : ""}
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                  Ses guides pour le terrain
                </h2>
                <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Les conseils pratiques rédigés par {membre.name} pour chiffrer plus vite, relancer au bon
                  moment et organiser les chantiers.
                </p>
              </div>
              <Link
                to="/ressources"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
              >
                Tous les guides
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            {guides.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {guides.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-50">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                  <i className="ri-article-line"></i>
                </span>
                <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                  Pas encore de guide publié
                </h3>
                <p className="mt-2 text-sm text-foreground-600 max-w-md">
                  Ce membre n'a pas encore signé de guide. Revenez bientôt pour découvrir ses prochaines
                  publications.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Ses épisodes podcast */}
        {episodes.length > 0 && (
          <section className="w-full bg-background-50 border-b border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                    <i className="ri-mic-line"></i>
                    {episodes.length} intervention{episodes.length > 1 ? "s" : ""}
                  </span>
                  <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                    {membre.name.split(" ")[0]} sur les ondes
                  </h2>
                  <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                    Les épisodes où {membre.name} prend le micro, à écouter directement depuis cette page.
                  </p>
                </div>
                <Link
                  to="/podcast"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
                >
                  Tous les épisodes
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {episodes.map((episode) => (
                  <EpisodeCard key={episode.id} episode={episode} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Ses interventions publiques (conférences, webinaires…) */}
        {interventions.length > 0 && (
          <section className="w-full bg-secondary-50 border-b border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
                    <i className="ri-presentation-line"></i>
                    {interventions.length} prise{interventions.length > 1 ? "s" : ""} de parole
                  </span>
                  <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                    {membre.name.split(" ")[0]} sur scène & en ligne
                  </h2>
                  <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                    Les conférences, webinaires, tables rondes et interviews de {membre.name}, avec
                    un accès direct à la rediffusion depuis la page Média.
                  </p>
                </div>
                <Link
                  to="/podcast#interventions-publiques"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
                >
                  Voir sur la page Média
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {interventions.map((intervention) => (
                  <Link
                    key={intervention.id}
                    to={`/podcast#${intervention.id}`}
                    title={`${intervention.format} · ${intervention.title}`}
                    className="group flex flex-col rounded-lg bg-background-50 border border-background-200 hover:border-secondary-300 transition-colors overflow-hidden cursor-pointer"
                  >
                    <div className="flex flex-col flex-1 p-5">
                      <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${toneChip[intervention.tone]}`}>
                        <i className={intervention.icon}></i>
                        {intervention.format}
                      </span>
                      <h3 className="mt-3 font-heading font-semibold text-base text-foreground-950 leading-snug">
                        {intervention.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500 flex-1">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-700">
                          <i className="ri-broadcast-line"></i>
                          {intervention.event}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <i className="ri-calendar-line"></i>
                          {intervention.date}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <i className="ri-map-pin-line"></i>
                          {intervention.location}
                        </span>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 group-hover:gap-3 transition-all">
                        Voir l'ancre sur la page Média
                        <i className="ri-arrow-right-line"></i>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Autres membres */}
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="max-w-2xl mb-8">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
                <i className="ri-group-line"></i>
                Le reste de l'équipe
              </span>
              <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Découvrir les autres membres
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {autresMembres.map((autre) => (
                <Link
                  key={autre.id}
                  to={`/auteurs/${autre.id}`}
                  className="group flex items-center gap-4 p-4 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <span className="w-14 h-14 shrink-0 rounded-full overflow-hidden bg-background-100">
                    <img
                      src={autre.photo}
                      alt={`Portrait de ${autre.name}`}
                      title={`${autre.name} · ${autre.role}`}
                      className="w-full h-full object-cover object-top"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading font-semibold text-sm text-foreground-950 truncate">
                      {autre.name}
                    </span>
                    <span className="block mt-0.5 text-xs text-foreground-500 truncate">{autre.role}</span>
                  </span>
                  <i className="ri-arrow-right-line ml-auto text-foreground-400 group-hover:text-primary-700 transition-colors"></i>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Navigation auteur précédent / suivant */}
        {equipe.length > 1 && (
          <section className="w-full bg-background-50 border-b border-background-200">
            <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {precedent && (
                  <Link
                    to={`/auteurs/${precedent.id}`}
                    title={`Page de ${precedent.name}`}
                    className="group flex items-center gap-4 p-4 md:p-5 rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                  >
                    <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-background-50 text-foreground-600 group-hover:text-primary-700 transition-colors">
                      <i className="ri-arrow-left-line"></i>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-foreground-500">
                        Auteur précédent
                      </span>
                      <span className="block mt-0.5 font-heading font-semibold text-sm text-foreground-950 truncate">
                        {precedent.name}
                      </span>
                      <span className="block text-xs text-foreground-500 truncate">
                        {precedent.role}
                      </span>
                    </span>
                  </Link>
                )}
                {suivant && (
                  <Link
                    to={`/auteurs/${suivant.id}`}
                    title={`Page de ${suivant.name}`}
                    className="group flex items-center gap-4 p-4 md:p-5 rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer sm:flex-row-reverse sm:text-right"
                  >
                    <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-background-50 text-foreground-600 group-hover:text-primary-700 transition-colors">
                      <i className="ri-arrow-right-line"></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-foreground-500">
                        Auteur suivant
                      </span>
                      <span className="block mt-0.5 font-heading font-semibold text-sm text-foreground-950 truncate">
                        {suivant.name}
                      </span>
                      <span className="block text-xs text-foreground-500 truncate">
                        {suivant.role}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <Link
                  to="/plan-du-site#equipe-auteurs"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-map-2-line"></i>
                  Voir toute l'équipe dans le plan du site
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Envie d'échanger avec {membre.name.split(" ")[0]} ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Une question sur son domaine, un projet à chiffrer ou une envie de rejoindre l'équipe : on
                vous répond avec plaisir.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo(`auteur-cta-${membre.id}`)}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-mail-send-line"></i>
                  Nous écrire
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