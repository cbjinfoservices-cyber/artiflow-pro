import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import Toast from "@/components/base/Toast";
import BlocTexteSeo from "@/components/feature/BlocTexteSeo";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useFoundersSchema } from "@/hooks/useFoundersSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import { equipe, valeursEquipe, histoireEquipe, chiffresEquipe } from "@/mocks/equipe";
import { interventionsDuMembre } from "@/mocks/interventions";
import type { InterventionPublique } from "@/mocks/interventions";
import { lienInterventionPartage } from "@/lib/interventions";
import EquipeOndes from "@/pages/a-propos/components/EquipeOndes";
import FaqAPropos from "@/pages/a-propos/components/FaqAPropos";

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
    "À propos d'ArtiFlow-pro : l'équipe des artisans",
    "Découvrez l'équipe d'ArtiFlow-pro : des anciens du bâtiment et des passionnés de technologie qui rendent du temps aux artisans, chaque jour.",
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
                  width={900}
                  height={700}
                  decoding="async"
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

        <BlocTexteSeo
          id="notre-mission"
          eyebrow="Notre mission"
          eyebrowIcon="ri-flag-2-line"
          ton="accent"
          fond="bg-background-50"
          titre="Rendre aux artisans le temps que l'administratif leur prend"
          intro="ArtiFlow-pro n'est pas né dans un bureau. L'idée est venue d'un constat répété sur les chantiers : les artisans passent trop d'heures sur des tâches qui n'ont rien à voir avec leur métier. Notre mission tient en une phrase : leur rendre ce temps."
          blocs={[
            {
              sousTitre: "Pourquoi ArtiFlow-pro existe",
              paragraphes: [
                "Un artisan est un professionnel du geste : il connaît les matériaux, les normes, les délais et le terrain. Pourtant, une part grandissante de sa journée se passe loin du chantier, devant un écran ou un carnet, à rédiger des devis, à recopier des informations d'un document à un autre, à relancer des clients qui n'ont pas répondu.",
                "Cette charge invisible pèse sur la rentabilité et sur la vie personnelle. Les devis se font le soir, les relances se perdent, les impayés s'accumulent. Nous avons construit ArtiFlow-pro pour reprendre cette part de travail répétitif et la confier à des outils qui ne se fatiguent jamais.",
              ],
            },
            {
              sousTitre: "Comment nous travaillons",
              paragraphes: [
                "Nous sommes une équipe à taille humaine, composée d'anciens du bâtiment, d'ingénieurs et de spécialistes du produit. Chaque fonctionnalité part d'une situation réelle observée sur le terrain, jamais d'une idée abstraite.",
              ],
              liste: [
                "Nous échangeons régulièrement avec des artisans pilotes pour confronter nos choix au réel.",
                "Nous privilégions la simplicité : si un écran demande une explication, il est à revoir.",
                "Nous mesurons notre réussite au temps que nos utilisateurs récupèrent, pas au nombre de fonctions.",
                "Nous restons joignables : derrière chaque message, une personne qui connaît le métier.",
              ],
            },
            {
              sousTitre: "Ce que nous nous refusons à faire",
              paragraphes: [
                "Nous ne promettons pas que l'intelligence artificielle remplacera le jugement d'un artisan : elle propose, vous décidez. Nous refusons les tarifs cachés, les engagements forcés et les données revendues. Et nous considérons la sécurité comme un prérequis, pas comme un argument commercial.",
                "Grandir ne veut pas dire perdre cette boussole. Nous gardons le cap : un outil utile, honnête et respectueux du travail de celles et ceux qui construisent et réparent au quotidien.",
              ],
            },
            {
              sousTitre: "Comment nous décidons de ce que nous construisons ensuite",
              paragraphes: [
                "Chaque semaine, l'équipe passe en revue les demandes reçues par téléphone, par email et pendant les démonstrations. Elles ne sont pas classées par popularité mais par fréquence du blocage : combien d'artisans butent sur le même point, et combien de temps cela leur coûte chaque mois. Une gêne répétée mille fois pèse plus lourd qu'une demande spectaculaire formulée une seule fois.",
                "Vient ensuite le test de la simplicité. Une fonctionnalité qui ajoute un écran, un onglet ou un choix supplémentaire doit compenser ce coût par un gain évident, mesurable dès la première utilisation. Nous avons déjà renoncé à des options qui auraient fait bonne figure sur une plaquette commerciale mais auraient alourdi le quotidien de nos utilisateurs. Ce renoncement est une décision de produit à part entière, pas un échec.",
                "Enfin, nous livrons petit. Une première version volontairement limitée, testée avec des artisans pilotes, puis ajustée à partir de ce qu'ils en font réellement — et non de ce qu'ils imaginaient en faire. Cette méthode est plus lente qu'annoncer une grande nouveauté, mais elle évite de construire pendant six mois quelque chose que personne n'utilisera. C'est aussi pourquoi nos évolutions apparaissent d'abord discrètement dans le journal des nouveautés, avant d'être documentées pas à pas dans les guides.",
              ],
            },
          ]}
        />

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
                      loading="lazy"
                      decoding="async"
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

        {/* Concrètement, dans une semaine d'artisan */}
        <BlocTexteSeo
          id="au-quotidien"
          eyebrow="Concrètement, sur le terrain"
          eyebrowIcon="ri-tools-line"
          ton="primary"
          fond="bg-background-50"
          titre="Ce que change ArtiFlow-pro dans une semaine d'artisan"
          intro="Derrière les fonctionnalités, il y a des soirées récupérées, des devis envoyés le jour même et des chantiers qui s'enchaînent sans friction. Voici à quoi ressemble concrètement le quotidien d'un artisan qui s'appuie sur ArtiFlow-pro, du lundi matin à la clôture de la semaine."
          blocs={[
            {
              sousTitre: "Le devis, du chantier au client en quelques minutes",
              paragraphes: [
                "Tout commence sur place. L'artisan prend ses mesures, ouvre ArtiFlow-pro sur son téléphone et décrit le chantier en quelques phrases. L'outil propose une structure de devis adaptée à son corps d'état, avec les postes qu'on oublie le plus souvent : préparation du support, protection des existants, évacuation des gravats, consommables.",
                "Le devis se construit ensuite à partir de ses propres lignes, de ses modèles et de ses prix. Il peut ajuster un poste, ajouter une variante de matériau, puis envoyer le document au client avant même d'avoir quitté le chantier. Le client signe en ligne : plus d'impression, plus de scan, plus de relance pour récupérer un document signé.",
              ],
              liste: [
                "Un devis prêt à envoyer depuis un smartphone, sans repasser au bureau.",
                "Des postes oubliés signalés au bon moment, avant l'envoi au client.",
                "Une signature électronique qui supprime les allers-retours par email.",
              ],
            },
            {
              sousTitre: "Des relances qui ne dépendent plus de la mémoire",
              paragraphes: [
                "Un devis sans réponse n'est pas un devis perdu — c'est souvent un devis oublié. Le plus dur, pour un artisan seul, n'est pas de relancer : c'est d'y penser au bon moment, entre deux chantiers, sans avoir l'impression de harceler un client de bonne foi.",
                "ArtiFlow-pro programme les relances au moment de l'envoi, puis les déclenche par email, SMS ou WhatsApp selon le canal choisi. Les messages restent sobre et professionnels, et l'artisan garde la main : il peut suspendre une relance, en modifier le ton, ou reprendre la conversation lui-même quand le client répond.",
              ],
            },
            {
              sousTitre: "Une semaine lisible, une comptabilité qui se tient",
              paragraphes: [
                "Le planning regroupe les chantiers, les rendez-vous et les créneaux personnels, avec une vue claire des chevauchements. À la fin de la journée, l'artisan sait ce qui a été fait, ce qui reste à facturer et quels clients attendent une réponse.",
                "Côté comptabilité, les factures, les encaissements et les relances de retard se retrouvent au même endroit. Le pack mensuel peut être transmis au comptable sans reconstituer un classeur à la dernière minute : le travail administratif de fin de mois redevient une formalité, et non plus une soirée entière.",
              ],
            },
          ]}
        />

        {/* L'équipe sur les ondes */}
        <EquipeOndes />

        <FaqAPropos />

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