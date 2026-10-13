import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import Toast from "@/components/base/Toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useFoundersSchema } from "@/hooks/useFoundersSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import { equipe, valeursEquipe, histoireEquipe, chiffresEquipe } from "@/mocks/equipe";
import { interventionsDuMembre } from "@/mocks/interventions";
import type { InterventionPublique } from "@/mocks/interventions";
import { lienInterventionPartage } from "@/lib/interventions";
import EquipeOndes from "@/pages/a-propos/components/EquipeOndes";

const toneChip: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

const toneIcon: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

export default function AProposPage() {
  const { openDemo } = useDemoModal();
  const [toast, setToast] = useState<string | null>(null);

  const copierLienIntervention = async (intervention: InterventionPublique) => {
    try {
      await navigator.clipboard.writeText(lienInterventionPartage(intervention.id));
      setToast(`Lien de « ${intervention.title} » copié`);
    } catch {
      setToast("Impossible de copier le lien pour le moment");
    }
  };

  usePageMeta(
    "À propos d'ArtiFlow-pro · L'équipe derrière l'assistant des artisans",
    "Découvrez l'équipe d'ArtiFlow-pro : des anciens du bâtiment et des passionnés de technologie qui rendent du temps aux artisans. Notre histoire, nos valeurs et nos chiffres.",
    {
      type: "website",
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20a%20collaborative%20team%20of%20builders%20and%20software%20makers%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20and%20tool%20silhouettes%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-apropos&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "À propos", path: "/a-propos" },
    ],
    "artiflow-apropos-breadcrumb-schema"
  );

  useFoundersSchema();

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
              <span className="text-foreground-800">À propos</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-14 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-team-line"></i>
                  L'équipe ArtiFlow-pro
                </span>
                <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                  Des gens du bâtiment et de la tech, réunis autour d'une idée simple
                </h1>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  Rendre aux artisans le temps que la paperasse leur vole. ArtiFlow-pro est né d'un constat de
                  chantier, pas d'une salle de réunion — et toute l'équipe travaille encore avec cette même
                  boussole.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => openDemo("a-propos")}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Rencontrer l'équipe
                  </button>
                  <Link
                    to="/metiers"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-hammer-line"></i>
                    Voir nos métiers
                  </Link>
                </div>
              </div>

              <div className="w-full h-56 md:h-72 rounded-lg overflow-hidden border border-background-200 bg-background-50">
                <img
                  src="https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20small%20collaborative%20team%20of%20builders%20and%20software%20makers%20gathered%20around%20a%20table%20with%20blueprints%20and%20a%20laptop%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=900&height=700&seq=artiflow-apropos-mission&orientation=landscape"
                  alt="L'équipe ArtiFlow-pro réunie autour des plans d'un chantier"
                  title="L'équipe ArtiFlow-pro au travail"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Chiffres clés */}
        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-14">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {chiffresEquipe.map((c) => (
                <div key={c.label} className="flex flex-col items-start p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
                  <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
                    <i className={c.icon}></i>
                  </span>
                  <span className="mt-4 font-heading font-extrabold text-2xl md:text-3xl text-foreground-950">{c.value}</span>
                  <span className="mt-1 text-xs md:text-sm text-foreground-600">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Histoire / timeline */}
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-road-map-line"></i>
                Notre histoire
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                D'un problème de chantier à un outil utilisé partout en France
              </h2>
            </div>

            <ol className="relative flex flex-col gap-8 lg:gap-0 lg:flex-row lg:items-start">
              {histoireEquipe.map((etape, index) => (
                <li key={etape.year} className="relative flex gap-4 lg:flex-col lg:flex-1 lg:gap-0 lg:pr-8">
                  <div className="flex flex-col items-center lg:items-start lg:w-full">
                    <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 font-heading font-bold text-sm">
                      {index + 1}
                    </span>
                    <span className="hidden lg:block w-full h-px bg-background-300/70 mt-5" />
                  </div>
                  <div className="lg:mt-4 pb-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent-700">
                      <i className="ri-calendar-line"></i>
                      {etape.year}
                    </span>
                    <h3 className="mt-2 font-heading font-semibold text-base md:text-lg text-foreground-950">{etape.title}</h3>
                    <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{etape.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Équipe — annuaire complet des membres (remplace l'ancienne page Équipe) */}
        <section id="equipe" className="w-full bg-background-50 border-b border-background-200 scroll-mt-24">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
                <i className="ri-group-line"></i>
                Les visages d'ArtiFlow-pro
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Une équipe à taille humaine, joignable et proche du terrain
              </h2>
              <p className="mt-4 text-base text-foreground-600 leading-relaxed">
                C'est ici que vous retrouvez toute l'équipe : l'annuaire complet des membres d'ArtiFlow-pro,
                avec leur rôle et leur parcours. Nous sommes une petite équipe pluridisciplinaire :
                d'anciens du bâtiment, des ingénieurs et des passionnés de produit. Vous parlez toujours à
                quelqu'un qui comprend votre métier.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {equipe.map((membre) => {
                const interventions = interventionsDuMembre(membre.id);
                return (
                <article id={membre.id} key={membre.id} className="group flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors scroll-mt-32">
                  <div className="block w-full h-64 overflow-hidden bg-background-100">
                    <img
                      src={membre.photo}
                      alt={`Portrait de ${membre.name}, ${membre.role} chez ArtiFlow-pro`}
                      title={`${membre.name} · ${membre.role}`}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="font-heading font-semibold text-base text-foreground-950">
                      {membre.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${toneChip[membre.tone]}`}>
                        {membre.role}
                      </span>
                      <Link
                        to={`/plan-du-site?membre=${membre.id}&q=${encodeURIComponent(membre.name)}#equipe-auteurs`}
                        title={`Retrouver ${membre.name} dans la section Équipe du plan du site`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 text-[11px] font-semibold hover:bg-secondary-200 transition-colors cursor-pointer"
                      >
                        <i className="ri-map-2-line"></i>
                        Dans le plan du site
                      </Link>
                    </div>
                    <p className="mt-3 text-sm text-foreground-600 leading-relaxed flex-1">{membre.bio}</p>
                    {interventions.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                          Ses interventions
                        </span>
                        {interventions.map((intervention) => (
                          <span
                            key={intervention.id}
                            className="inline-flex items-center rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold overflow-hidden"
                          >
                            <Link
                              to={`/podcast#${intervention.id}`}
                              title={`${intervention.format} · ${intervention.title}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 hover:bg-accent-200 transition-colors cursor-pointer"
                            >
                              <i className={intervention.icon}></i>
                              {intervention.format}
                            </Link>
                            <button
                              type="button"
                              onClick={() => copierLienIntervention(intervention)}
                              title={`Copier le lien de « ${intervention.title} »`}
                              aria-label={`Copier le lien de « ${intervention.title} »`}
                              className="inline-flex items-center justify-center w-6 h-6 border-l border-accent-200 hover:bg-accent-200 transition-colors cursor-pointer"
                            >
                              <i className="ri-link text-[10px]"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-background-200 flex items-center justify-between gap-3">
                      <Link
                        to={`/auteurs/${membre.id}`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
                      >
                        Ses guides & podcasts
                        <i className="ri-arrow-right-line"></i>
                      </Link>
                      <a
                        href={membre.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Profil LinkedIn de ${membre.name}`}
                        title={`LinkedIn de ${membre.name}`}
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 hover:bg-primary-100 hover:text-primary-700 transition-colors cursor-pointer"
                      >
                        <i className="ri-linkedin-box-line text-base"></i>
                      </a>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Valeurs */}
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-heart-3-line"></i>
                Ce qui nous guide
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Nos valeurs ne sont pas affichées, elles sont appliquées
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {valeursEquipe.map((v) => (
                <div key={v.title} className="flex flex-col p-6 rounded-lg bg-background-50 border border-background-200">
                  <span className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl ${toneIcon[v.tone]}`}>
                    <i className={v.icon}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">{v.title}</h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* L'équipe sur les ondes */}
        <EquipeOndes />

        {/* CTA */}
        <section className="w-full bg-background-100">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Envie de construire avec nous ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Vous êtes artisan et voulez tester l'outil, ou vous souhaitez rejoindre l'équipe : on sera
                ravis d'échanger avec vous.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("a-propos-cta")}
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

      {toast && <Toast message={toast} onClose={() => setToast(null)} icon="ri-link" />}
    </div>
  );
}