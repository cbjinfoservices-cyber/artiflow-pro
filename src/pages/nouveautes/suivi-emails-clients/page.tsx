import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import FaqAccordion from "@/components/feature/FaqAccordion";
import FilAriane from "@/components/feature/FilAriane";
import ComparatifRelanceDifferee from "@/components/feature/ComparatifRelanceDifferee";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import CapturesSuiviEmails from "./components/CapturesSuiviEmails";

type Tone = "primary" | "accent" | "secondary";

const TONE: Record<Tone, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

const changements: { icon: string; title: string; desc: string; tone: Tone }[] = [
  {
    icon: "ri-mail-close-line",
    title: "Le refus s'explique",
    desc: "Date, adresse réellement tentée et raison renvoyée par le service d'envoi : plus de doute sur ce qui a bloqué.",
    tone: "accent",
  },
  {
    icon: "ri-shield-check-line",
    title: "L'adresse se vérifie",
    desc: "Format puis domaine : une faute de frappe est repérée avant l'envoi, avec l'adresse probable proposée en un clic.",
    tone: "primary",
  },
  {
    icon: "ri-mail-check-line",
    title: "Les envois se lisent",
    desc: "La liste datée des emails réellement partis (objet et destinataire), avec le compteur total juste à côté.",
    tone: "secondary",
  },
  {
    icon: "ri-time-line",
    title: "Le renvoi se programme",
    desc: "Un renvoi dans 24 h, avec décompte en direct, annulation ligne par ligne ou groupée, et coupure automatique si la fiche change.",
    tone: "accent",
  },
];

const etapes: { icon: string; title: string; desc: string }[] = [
  {
    icon: "ri-contacts-book-2-line",
    title: "Ouvrez la fiche client",
    desc: "Dans Clients, sélectionnez le client concerné. Le bloc « Dernier email refusé » affiche la date, l'adresse tentée et la raison.",
  },
  {
    icon: "ri-shield-check-line",
    title: "Contrôlez l'adresse",
    desc: "Le bouton « Vérifier l'adresse » contrôle le format puis le domaine. Si une faute est probable, utilisez l'adresse suggérée.",
  },
  {
    icon: "ri-send-plane-line",
    title: "Renvoyez, ou programmez",
    desc: "« Vérifier et renvoyer » relance immédiatement. Sinon, « Renvoyer dans 24 h » depuis la cloche programme le départ.",
  },
  {
    icon: "ri-notification-3-line",
    title: "Suivez dans la cloche",
    desc: "La section « Renvois prévus » affiche le décompte avant chaque départ. Vous pouvez annuler une ligne ou tout annuler.",
  },
];

const faqs = [
  {
    question: "Que se passe-t-il exactement quand un email est refusé ?",
    answer:
      "Le service d'envoi renvoie une raison (adresse inexistante, boîte pleine, domaine refusé…). ArtiFlow-pro la conserve et l'affiche sur la fiche client, avec la date et l'adresse réellement tentée, à côté de la liste des emails réellement partis.",
  },
  {
    question: "Le bouton « Vérifier l'adresse » garantit-il que l'email arrivera ?",
    answer:
      "Non, et c'est important de le dire : il contrôle le format et le domaine, et repère les fautes de frappe courantes. Une adresse peut rester valide tout en ayant une boîte pleine ou un filtre côté destinataire. En revanche, tant que le contrôle signale une adresse invalide, aucun renvoi n'est lancé.",
  },
  {
    question: "Que devient un renvoi programmé si je corrige la fiche entre-temps ?",
    answer:
      "Il s'annule de lui-même. La programmation est liée à l'adresse refusée : si la fiche change, la relance prévue n'a plus de raison d'être et disparaît des « Renvois prévus ». Un renvoi programmé ne part jamais deux fois.",
  },
  {
    question: "Puis-je annuler toutes les relances programmées d'un coup ?",
    answer:
      "Oui. La section « Renvois prévus » de la cloche propose une annulation groupée en deux temps (un clic, puis une confirmation), en plus de l'annulation ligne par ligne.",
  },
];

export default function NouveauteSuiviEmailsPage() {
  const { openDemo } = useDemoModal();

  usePageMeta(
    "Suivi des emails clients — ArtiFlow-pro",
    "Annonce : ArtiFlow-pro explique chaque email refusé, vérifie l'adresse avant l'envoi, liste les emails réellement partis et programme la relance à 24 h. Captures et mode d'emploi.",
    {
      type: "article",
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20editorial%20illustration%20of%20email%20delivery%20tracking%20for%20a%20construction%20business%2C%20a%20stylized%20envelope%20with%20a%20green%20check%20beside%20a%20red%20crossed%20envelope%2C%20a%20small%20countdown%20clock%20and%20a%20notification%20card%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20subtle%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-suivi-emails&orientation=landscape",
    }
  );

  useFaqSchema(faqs, "artiflow-annonce-suivi-emails-faq-schema");

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Nouveautés", path: "/nouveautes" },
                { name: "Suivi des emails clients", path: "/nouveautes/suivi-emails-clients" },
              ]}
              variante="clair"
              schemaId="artiflow-annonce-suivi-emails-breadcrumb-schema"
            />

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold uppercase tracking-wide">
                  <i className="ri-megaphone-line"></i>
                  Annonce produit
                </span>
                <h1 className="mt-4 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                  Savoir ce qui est vraiment parti
                </h1>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  Un devis envoyé, aucune réponse : est-ce que le client a ignoré le message, ou est-ce que
                  l'email n'est jamais arrivé ? ArtiFlow-pro lève le doute. Chaque refus est expliqué, chaque
                  adresse se contrôle, chaque envoi réussi se lit — et la relance du lendemain peut se
                  programmer à l'avance.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-git-commit-line"></i>
                    Versions 3.2 à 3.4
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-calendar-line"></i>
                    23 octobre 2026
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-award-line"></i>
                    Mise à jour majeure
                  </span>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/app/clients"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-contacts-book-2-line"></i>
                    Ouvrir mes clients
                  </Link>
                  <button
                    type="button"
                    onClick={() => openDemo("annonce-suivi-emails")}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Demander une démo
                  </button>
                </div>
              </div>

              <figure className="relative">
                <div className="w-full h-[260px] md:h-[360px] lg:h-[420px] rounded-lg overflow-hidden border border-background-200">
                  <img
                    src="https://readdy.ai/api/search-image?query=Stylized%20editorial%20illustration%20of%20email%20delivery%20tracking%20on%20a%20construction%20office%20desk%2C%20a%20stylized%20envelope%20with%20a%20green%20check%20beside%20a%20red%20crossed%20envelope%2C%20a%20small%20round%20clock%20and%20a%20notification%20card%2C%20warm%20amber%20accents%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20flat%20background%20with%20subtle%20blueprint%20grid%20lines%2C%20soft%20cinematic%20studio%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1080&height=1080&seq=artiflow-annonce-suivi-emails-hero&orientation=squarish"
                    alt="Illustration du suivi des emails clients : refus expliqué, adresse vérifiée et relance programmée"
                    title="Suivi des emails clients ArtiFlow-pro : refus, vérification d'adresse et renvoi différé"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
                  <i className="ri-mail-check-line text-accent-600"></i>
                  Refus expliqué, adresse contrôlée, relance programmée — au même endroit.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Ce qui change */}
        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-sparkling-2-line"></i>
                Ce qui change
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Fini les emails envoyés dans le vide
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Quatre briques qui se répondent : le refus est visible, l'adresse est contrôlée, les envois
                réussis sont listés, et le renvoi peut attendre 24 h sans être oublié.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {changements.map((c) => (
                <div key={c.title} className="p-6 rounded-lg bg-background-100 border border-background-200">
                  <span className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl ${TONE[c.tone]}`}>
                    <i className={c.icon}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">{c.title}</h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Captures */}
        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-camera-line"></i>
                Les captures
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Trois écrans, tout le suivi
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Voilà à quoi ça ressemble dans l'espace, sans avoir à chercher : le contrôle d'adresse dans la
                fiche, la liste des envois réellement partis, et les relances qui attendent leur heure.
              </p>
            </div>

            <CapturesSuiviEmails />
          </div>
        </section>

        {/* Avant / Après */}
        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-arrow-left-right-line"></i>
                Avant / Après
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                La relance de 24 h, concrètement
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Même email refusé, deux façons de réagir. Comparez ce qui se passe quand on renvoie à l'aveugle
                et quand l'adresse est vérifiée puis la relance programmée.
              </p>
            </div>

            <ComparatifRelanceDifferee />
          </div>
        </section>

        {/* Mode d'emploi */}
        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-book-open-line"></i>
                Mode d'emploi
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Quatre gestes, dans l'ordre
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Tout part de la fiche client, et tout se pilote ensuite depuis la cloche de l'en-tête. Comptez
                moins d'une minute pour repartir proprement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {etapes.map((e, i) => (
                <div key={e.title} className="p-6 rounded-lg bg-background-100 border border-background-200">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-500 text-background-50 font-heading font-bold text-sm">
                      {i + 1}
                    </span>
                    <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
                      <i className={e.icon}></i>
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">{e.title}</h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{e.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 md:p-6 rounded-lg bg-background-50 border border-background-200">
              <div className="max-w-2xl">
                <h3 className="font-heading font-semibold text-base text-foreground-950">
                  Le détail qui évite les doublons
                </h3>
                <p className="mt-1.5 text-sm text-foreground-600 leading-relaxed">
                  Un renvoi programmé ne part jamais deux fois. Si vous corrigez la fiche client avant
                  l'échéance, la programmation s'annule d'elle-même — et l'envoi part tout de suite si vous
                  utilisez « Vérifier et renvoyer ».
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  to="/app/clients"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-contacts-book-2-line"></i>
                  Voir mes fiches clients
                </Link>
                <Link
                  to="/nouveautes"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                >
                  <i className="ri-list-check-2"></i>
                  Toutes les nouveautés
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions fréquentes
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Tout sur le suivi des emails
                </h2>
              </div>

              <FaqAccordion items={faqs} idPrefix="faq-annonce-suivi-emails" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Un email refusé ? Vous saurez tout de suite pourquoi
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Ouvrez la fiche du client, contrôlez l'adresse, puis renvoyez ou programmez la relance à 24 h.
                Plus rien ne part dans le vide.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/app/clients"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-rocket-2-line"></i>
                  Ouvrir mes clients
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