import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import CandidatureForm from "@/pages/rejoindre/components/CandidatureForm";
import {
  postesOuverts,
  avantagesRejoindre,
  etapesRecrutement,
  chiffresCulture,
} from "@/mocks/rejoindre";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useJobPostingsSchema } from "@/hooks/useJobPostingsSchema";

const toneClasses: Record<string, { bubble: string; icon: string }> = {
  primary: { bubble: "bg-primary-100", icon: "text-primary-700" },
  accent: { bubble: "bg-accent-100", icon: "text-accent-700" },
  secondary: { bubble: "bg-secondary-100", icon: "text-secondary-700" },
};

export default function RejoindrePage() {
  const [selectedPoste, setSelectedPoste] = useState("");

  usePageMeta(
    "Nous rejoindre · Carrières ArtiFlow-pro",
    "Rejoignez l'équipe ArtiFlow-pro : postes ouverts en tech, data, support et croissance. Impact concret, équipe à taille humaine, candidature en 5 minutes.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20about%20joining%20a%20small%20tech%20team%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20people%20and%20handshake%20silhouettes%2C%20blueprint%20line%20patterns%2C%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20premium%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-rejoindre&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Nous rejoindre", path: "/nous-rejoindre" },
    ],
    "artiflow-rejoindre-breadcrumb-schema"
  );

  useJobPostingsSchema();

  const scrollToCandidature = (poste?: string) => {
    if (poste) setSelectedPoste(poste);
    const el = document.getElementById("candidature");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full min-h-screen bg-background-50">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/a-propos" className="hover:text-foreground-900 cursor-pointer">
                À propos
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Nous rejoindre</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-user-add-line"></i>
                  Nous rejoindre
                </span>
                <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight leading-tight">
                  Donnez du temps aux artisans qui construisent
                </h1>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  ArtiFlow-pro est une petite équipe qui aide plus de 2 400 artisans à ne plus perdre
                  leurs soirées sur les devis et les relances. On cherche des personnes qui aiment que
                  leur travail serve à quelque chose de concret.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToCandidature()}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-send-plane-line"></i>
                    Déposer ma candidature
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("postes");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-300 text-sm font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-briefcase-line"></i>
                    Voir les {postesOuverts.length} postes ouverts
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {chiffresCulture.map((item) => (
                  <div
                    key={item.label}
                    className="p-5 rounded-lg bg-background-50 border border-background-200"
                  >
                    <div className="font-heading font-bold text-3xl text-foreground-950">
                      {item.value}
                    </div>
                    <div className="mt-1 text-sm text-foreground-600">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pourquoi" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
            <div className="max-w-2xl">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Pourquoi nous rejoindre
              </h2>
              <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                Pas de baby-foot ni de promesses floues : voilà ce qui change vraiment le quotidien chez
                ArtiFlow-pro.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {avantagesRejoindre.map((avantage) => {
                const tone = toneClasses[avantage.tone] ?? toneClasses.primary;
                return (
                  <div
                    key={avantage.title}
                    className="flex flex-col p-6 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors"
                  >
                    <span
                      className={`w-11 h-11 flex items-center justify-center rounded-lg text-lg ${tone.bubble} ${tone.icon}`}
                    >
                      <i className={avantage.icon}></i>
                    </span>
                    <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                      {avantage.title}
                    </h3>
                    <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                      {avantage.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="postes" className="w-full bg-background-100 border-y border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Postes ouverts
                </h2>
                <p className="mt-3 text-sm text-foreground-600">
                  Cliquez sur « Postuler » : le formulaire se remplit avec le poste choisi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToCandidature("Candidature spontanée")}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
              >
                Candidature spontanée
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {postesOuverts.map((poste) => (
                <article
                  key={poste.id}
                  id={poste.id}
                  className="group grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start lg:items-center p-5 md:p-6 rounded-lg bg-background-50 border border-background-200 hover:border-accent-300 transition-colors scroll-mt-32"
                >
                  <div className="lg:col-span-8">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-semibold">
                        <i className="ri-briefcase-4-line"></i>
                        {poste.contrat}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold">
                        <i className="ri-map-pin-line"></i>
                        {poste.lieu}
                      </span>
                      <span className="text-xs font-medium text-foreground-500">{poste.equipe}</span>
                    </div>
                    <h3 className="font-heading font-semibold text-lg md:text-xl text-foreground-950">
                      {poste.title}
                    </h3>
                    <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                      {poste.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {poste.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex lg:justify-end">
                    <button
                      type="button"
                      onClick={() => scrollToCandidature(poste.title)}
                      className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors w-full lg:w-auto"
                    >
                      Postuler
                      <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
            <div className="max-w-2xl">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Comment ça se passe
              </h2>
              <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                Un process court, transparent et respectueux de votre temps — en 4 étapes.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {etapesRecrutement.map((etape, index) => (
                <div
                  key={etape.title}
                  className="flex flex-col p-6 rounded-lg bg-background-100 border border-background-200"
                >
                  <span className="w-10 h-10 flex items-center justify-center rounded-full bg-accent-500 text-background-50 font-heading font-bold text-sm">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">
                    {etape.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                    {etape.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="candidature" className="w-full bg-background-100 border-t border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start max-w-6xl mx-auto">
              <div className="lg:sticky lg:top-24">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-file-user-line"></i>
                  Votre candidature
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Cinq minutes, pas plus
                </h2>
                <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Pas besoin de lettre de motivation interminable. Racontez-nous qui vous êtes et ce
                  qui vous donne envie de rejoindre l'aventure : on lit vraiment chaque message.
                </p>

                <ul className="mt-6 flex flex-col gap-3">
                  {[
                    "Réponse sous 24 heures ouvrées, toujours",
                    "Poste pré-rempli quand vous postulez depuis une offre",
                    "Vos données utilisées uniquement pour le recrutement",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-foreground-700">
                      <i className="ri-check-line mt-0.5 text-accent-600"></i>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 p-5 rounded-lg bg-background-50 border border-background-200">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                      <i className="ri-mail-line"></i>
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-foreground-950">Une question ?</div>
                      <div className="text-xs text-foreground-600">
                        Écrivez-nous, on répond vite.
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/contact"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
                  >
                    Contacter l'équipe
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
              </div>

              <div className="p-6 md:p-8 rounded-lg bg-background-50 border border-background-200">
                <CandidatureForm role={selectedPoste} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}