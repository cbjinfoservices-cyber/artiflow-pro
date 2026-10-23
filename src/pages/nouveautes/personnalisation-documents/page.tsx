import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import FaqAccordion from "@/components/feature/FaqAccordion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import FilAriane from "@/components/feature/FilAriane";
import { useDemoModal } from "@/hooks/useDemoModal";
import MockupsIdentite from "./components/MockupsIdentite";
import AvantApresDocument from "./components/AvantApresDocument";

type Tone = "primary" | "accent" | "secondary";

const TONE: Record<Tone, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

const changements: { icon: string; title: string; desc: string; tone: Tone }[] = [
  {
    icon: "ri-palette-line",
    title: "Couleur d'accent au choix",
    desc: "Cuivre, terracotta, or vieilli, vert forêt, bordeaux, anthracite — ou une teinte sur mesure à la pipette.",
    tone: "accent",
  },
  {
    icon: "ri-image-line",
    title: "Votre logo, affiché ou masqué",
    desc: "Le logo de l'entreprise s'affiche en haut des devis et factures, activable ou masquable en un clic.",
    tone: "primary",
  },
  {
    icon: "ri-bank-card-line",
    title: "Coordonnées de paiement",
    desc: "IBAN, BIC et conditions de règlement repris en bas de vos factures, pour être payé plus vite.",
    tone: "secondary",
  },
  {
    icon: "ri-file-text-line",
    title: "Message de pied de page libre",
    desc: "Un mot de remerciement ou une mention utile, sur tous vos documents devis et factures.",
    tone: "accent",
  },
  {
    icon: "ri-mail-send-line",
    title: "La même identité dans vos emails",
    desc: "Devis, factures et relances envoyés à vos clients portent votre couleur et votre logo.",
    tone: "primary",
  },
  {
    icon: "ri-quill-pen-line",
    title: "Jusqu'à la signature du client",
    desc: "La page de signature en ligne du devis reprend elle aussi vos couleurs, jusqu'au dernier clic.",
    tone: "secondary",
  },
];

const etapes: { icon: string; title: string; desc: string }[] = [
  {
    icon: "ri-user-settings-line",
    title: "Ouvrez votre profil",
    desc: "Dans l'onglet « Apparence », réglez la couleur d'accent, votre logo, vos coordonnées de paiement et le message de pied de page.",
  },
  {
    icon: "ri-file-text-line",
    title: "Vos documents parlent pour vous",
    desc: "Chaque devis et chaque facture reprend automatiquement ces réglages, sans intervention de votre part.",
  },
  {
    icon: "ri-mail-send-line",
    title: "Jusqu'au client, sans exception",
    desc: "Les emails clients, les relances et la page de signature reprennent la même identité, du premier PDF au dernier clic.",
  },
];

const faqs = [
  {
    question: "Puis-je personnaliser mes devis, factures et emails à mon image ?",
    answer:
      "Oui. Vous réglez la couleur d'accent, votre logo, vos coordonnées de paiement et votre message de pied de page une seule fois dans votre profil. Ces éléments se retrouvent ensuite sur vos documents, dans les emails clients et sur la page de signature en ligne.",
  },
  {
    question: "La personnalisation est-elle incluse dans toutes les offres ?",
    answer:
      "Oui, la personnalisation des documents (couleur, logo, paiement, pied de page) est disponible sur toutes les offres, y compris Essentiel. L'identité de marque reprise jusque dans les emails et la signature est également incluse partout.",
  },
  {
    question: "Est-ce que mon client voit un logo ArtiFlow-pro dans ses emails ?",
    answer:
      "Non. Les emails que reçoit votre client portent votre logo et votre couleur. L'identité ArtiFlow-pro reste de votre côté, invisible pour lui.",
  },
  {
    question: "Puis-je masquer mon logo sur certains documents ?",
    answer:
      "Oui. L'affichage du logo est un réglage activable ou masquable en un clic depuis votre profil. Quand il est masqué, une pastille reprenant vos initiales s'affiche à la place.",
  },
];

export default function NouveautePersonnalisationPage() {
  const { openDemo } = useDemoModal();

  usePageMeta(
    "Documents à votre image & identité unifiée | ArtiFlow-pro",
    "Annonce : ArtiFlow-pro personnalise vos devis, factures, emails clients et pages de signature avec votre couleur d'accent, votre logo et vos informations de paiement. Une identité unifiée, du premier document jusqu'à la signature.",
    {
      type: "article",
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20unified%20brand%20identity%20for%20construction%20documents%2C%20overlapping%20quote%20and%20invoice%20cards%20with%20a%20color%20swatch%20palette%20and%20an%20envelope%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-personnalisation-documents&orientation=landscape",
    }
  );

  useFaqSchema(faqs, "artiflow-annonce-personnalisation-faq-schema");

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Nouveautés", path: "/nouveautes" },
                { name: "Personnalisation des documents", path: "/nouveautes/personnalisation-documents" },
              ]}
              variante="clair"
              schemaId="artiflow-annonce-personnalisation-breadcrumb-schema"
            />

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div>
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold uppercase tracking-wide">
                <i className="ri-megaphone-line"></i>
                Annonce produit
              </span>
              <h1 className="mt-4 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Des documents à votre image, partout
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Devis, factures, emails clients et pages de signature portent maintenant la même identité : votre
                couleur d'accent, votre logo, vos coordonnées de paiement et votre message de pied de page. Une
                seule chose à régler, et vos documents en profitent du premier PDF jusqu'à la signature du client.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-git-commit-line"></i>
                Version 3.1
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-calendar-line"></i>
                16 octobre 2026
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-award-line"></i>
                Mise à jour majeure
              </span>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/tarifs"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-price-tag-3-line"></i>
                Voir les offres
              </Link>
              <button
                type="button"
                onClick={() => openDemo("annonce-personnalisation")}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
            </div>
              </div>

              <figure className="relative">
                <div className="w-full h-[280px] md:h-[380px] lg:h-[440px] rounded-lg overflow-hidden border border-background-200">
                  <img
                    src="https://readdy.ai/api/search-image?query=Stylized%20editorial%20illustration%20of%20personalized%20construction%20trade%20paperwork%2C%20stacked%20quote%20and%20invoice%20cards%20with%20a%20warm%20amber%20accent%20stripe%20and%20a%20round%20monogram%20logo%2C%20a%20color%20swatch%20fan%20and%20paint%20swatches%20beside%20them%2C%20deep%20teal%20and%20charcoal%20flat%20background%20with%20subtle%20blueprint%20grid%20lines%2C%20soft%20cinematic%20studio%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail%2C%20harmonious%20warm%20palette&width=1080&height=1080&seq=artiflow-annonce-perso-hero&orientation=squarish"
                    alt="Illustration de devis et factures personnalisés aux couleurs d'une entreprise artisanale"
                    title="Documents personnalisés ArtiFlow-pro : devis, factures et emails à votre image"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
                  <i className="ri-palette-line text-accent-600"></i>
                  Votre couleur, votre logo, votre pied de page — sur chaque document.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-sparkling-2-line"></i>
                Ce qui change
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Votre marque, sur chaque document
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                ArtiFlow-pro ne ressemble plus à « un outil générique » : il ressemble à vous. Voici tout ce que
                vous pouvez régler une fois pour toutes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-arrow-left-right-line"></i>
                Avant / Après
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Le même devis, métamorphosé
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Basculez entre le devis neutre que produisent tous les outils génériques et le vôtre : votre
                couleur d'accent, votre logo, vos coordonnées de paiement et votre message de pied de page. Même
                contenu, mais l'image d'un professionnel soigné.
              </p>
            </div>

            <AvantApresDocument />
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-shield-check-line"></i>
                Une identité, partout
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Du premier PDF jusqu'au dernier clic du client
              </h2>
              <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
                Votre client reçoit un email à vos couleurs et signe votre devis sur une page qui reprend votre logo
                et votre teinte. Il ne voit jamais que vous — pas de logo ArtiFlow de son côté.
              </p>
            </div>

            <MockupsIdentite />
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-settings-3-line"></i>
                Comment l'activer
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Réglé une fois, appliqué partout
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/app/profil"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-user-settings-line"></i>
                Régler mon identité
              </Link>
              <Link
                to="/tarifs#documents"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-background-100 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
              >
                <i className="ri-palette-line"></i>
                Voir la section personnalisation
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions fréquentes
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Tout sur la personnalisation
                </h2>
              </div>

              <FaqAccordion items={faqs} idPrefix="faq-annonce-personnalisation" />
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Prêt à faire signer des devis à votre image ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                Réglez votre couleur, votre logo et votre pied de page, et laissez vos documents parler pour vous —
                du premier devis jusqu'à la signature du client.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/app/profil"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-rocket-2-line"></i>
                  Personnaliser mes documents
                </Link>
                <Link
                  to="/nouveautes"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-list-check-2"></i>
                  Toutes les nouveautés
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