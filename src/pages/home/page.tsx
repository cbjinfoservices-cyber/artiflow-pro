import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import Hero from "./components/Hero";
import JourneeType from "./components/JourneeType";
import Features from "./components/Features";
import ProductPreview from "./components/ProductPreview";
import Simulateur from "./components/Simulateur";
import NouveautesAccueil from "./components/NouveautesAccueil";
import Pricing from "./components/Pricing";
import Faq from "./components/Faq";
import ContactCta from "./components/ContactCta";
import BlocTexteSeo from "@/components/feature/BlocTexteSeo";
import BandeauAppMobile from "@/components/feature/BandeauAppMobile";
import { faqs } from "@/mocks/landing";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { IMAGE_PARTAGE_SITE, usePageMeta } from "@/hooks/usePageMeta";

/**
 * Page d'accueil, organisée autour de ce que l'artisan y gagne :
 * promesse → journée type → bénéfices → l'application en vrai → gain de temps chiffré par le
 * visiteur → nouveautés → tarifs → questions → démo. Le texte de fond (référencement) est replié.
 */
export default function Home() {
  usePageMeta(
    "ArtiFlow-pro — Assistant IA pour artisans du bâtiment",
    "ArtiFlow-pro, le logiciel IA des artisans du bâtiment : devis dicté en quelques minutes, relances automatiques, équipe pilotée sur mobile et facture électronique prête.",
    {
      // Accueil : on utilise volontairement l'image de marque choisie dans les
      // Réglages SEO, et non plus une bannière dédiée. C'est exactement le
      // fichier que la plateforme sert aux robots sociaux : l'aperçu réel des
      // liens et le code du site ne peuvent donc plus diverger.
      image: IMAGE_PARTAGE_SITE,
    }
  );
  useFaqSchema(faqs, "artiflow-home-faq-schema");
  useBreadcrumbSchema([{ name: "Accueil", path: "/" }], "artiflow-home-breadcrumb-schema");

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />
      <main>
        <Hero />
        <JourneeType />
        <Features />
        {/* Application mobile : bandeau discret, Android publié sur Google Play, iOS annoncé bientôt. */}
        <section className="w-full bg-background-100">
          <div className="w-full px-4 md:px-8 lg:px-12 pb-12 md:pb-16">
            <div className="max-w-5xl mx-auto">
              <BandeauAppMobile />
            </div>
          </div>
        </section>
        <ProductPreview />
        <Simulateur />
        <NouveautesAccueil />
        <Pricing />
        <Faq />

        {/* Présentation détaillée : utile au référencement et aux curieux, repliée pour ne pas alourdir la page. */}
        <section className="w-full bg-background-50 border-t border-background-200">
          <details className="group">
            <summary className="list-none [&::-webkit-details-marker]:hidden w-full px-4 md:px-8 lg:px-12 py-6 cursor-pointer">
              <span className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm font-semibold text-foreground-700 hover:text-primary-700 transition-colors">
                <i className="ri-article-line"></i>
                Tout savoir sur ArtiFlow-pro, en détail
                <i className="ri-arrow-down-s-line text-lg transition-transform group-open:rotate-180"></i>
              </span>
            </summary>
            <BlocTexteSeo
              id="artiflow-en-detail"
              eyebrow="En détail"
              eyebrowIcon="ri-article-line"
              ton="primary"
              fond="bg-background-100"
              titre="ArtiFlow-pro, l'assistant IA qui rend du temps aux artisans du bâtiment"
              intro="Derrière l'application, il y a une idée simple : un artisan ne devrait pas passer ses soirées à rédiger des devis et à relancer des clients. Voici, sans jargon, ce que fait ArtiFlow-pro, à qui l'outil s'adresse et comment il s'intègre à votre quotidien de chantier."
              blocs={[
                {
                  sousTitre: "Qu'est-ce qu'ArtiFlow-pro, concrètement ?",
                  paragraphes: [
                    "ArtiFlow-pro est un logiciel en ligne conçu pour les artisans du bâtiment : plombiers, électriciens, maçons, peintres, carreleurs, menuisiers, couvreurs ou encore chauffagistes. Il réunit au même endroit tout ce qui tourne autour du chantier : le devis, la signature, la facture, le planning de l'équipe, le suivi pour le client et les relances.",
                    "Sa particularité tient à l'intelligence artificielle. Plutôt que de remplir un formulaire ligne par ligne, vous dictez vos travaux à voix haute ou vous prenez une photo. L'IA comprend votre métier, propose les bonnes unités (m², ml, forfait, heure), réutilise vos tarifs habituels et rédige un devis prêt à envoyer en quelques minutes. Vous gardez toujours la main : vous relisez, vous ajustez les prix, vous validez.",
                  ],
                },
                {
                  sousTitre: "À qui s'adresse l'outil ?",
                  paragraphes: [
                    "ArtiFlow-pro s'adresse d'abord aux artisans indépendants et aux petites entreprises de moins de vingt personnes, celles qui n'ont ni service administratif ni assistante pour gérer la paperasse. Les corps d'état couverts sont nombreux et les modèles de devis sont adaptés à chaque spécialité :",
                  ],
                  liste: [
                    "Plomberie et chauffage : dépannages, remplacements de chaudière, mises aux normes.",
                    "Électricité : tableaux, prises, mises en conformité, éclairage.",
                    "Maçonnerie et gros œuvre : fondations, extensions, dalles, ouvertures.",
                    "Peinture et finitions : mètres carrés, préparation des supports, enduits.",
                    "Carrelage, menuiserie, couverture et façades, avec leurs unités propres.",
                  ],
                },
                {
                  sousTitre: "Comment ça marche, étape par étape ?",
                  paragraphes: [
                    "L'outil suit le déroulé naturel d'une affaire, du premier appel au dernier règlement. Le principe est de ne rien vous demander deux fois : une information saisie une fois resservira pour le devis, la facture et le suivi.",
                  ],
                  liste: [
                    "Vous décrivez le chantier à l'oral ou par photo, depuis le lieu d'intervention.",
                    "L'IA génère un devis structuré avec vos lignes, quantités et tarifs.",
                    "Vous envoyez le devis au client, qui peut le signer en ligne.",
                    "Si le client ne répond pas, les relances partent automatiquement par email, SMS ou WhatsApp.",
                    "Une fois l'accord obtenu, votre équipe voit le chantier sur son téléphone, pointe ses heures et fait signer le procès-verbal de réception.",
                    "La facture est générée au format électronique, et votre comptable reçoit le journal des ventes chaque mois.",
                  ],
                },
                {
                  sousTitre: "Prêt pour la facture électronique",
                  paragraphes: [
                    "La réforme de la facturation électronique s'applique à toutes les entreprises entre 2026 et 2027 : il faudra d'abord savoir recevoir des factures électroniques, puis en émettre. ArtiFlow-pro prépare vos factures au format Factur-X, ajoute les mentions obligatoires et vous permet de suivre chaque transmission, du dépôt à l'accusé de réception.",
                  ],
                },
                {
                  sousTitre: "Vos données et votre tranquillité",
                  paragraphes: [
                    "Vos prix, vos clients et vos documents restent les vôtres. La conformité au RGPD est prise au sérieux : vos données sont hébergées avec soin, protégées par des accès restreints, et vous pouvez exporter l'ensemble de votre activité à tout moment, sans être enfermé dans l'outil.",
                    "ArtiFlow-pro est une équipe française, proche du terrain, qui garde un contact direct avec les artisans. L'intelligence artificielle est là pour absorber les tâches répétitives, jamais pour remplacer votre savoir-faire ni votre relation client.",
                  ],
                },
                {
                  sousTitre: "Ce que vous y gagnez",
                  paragraphes: [
                    "Le premier bénéfice n'est pas technologique : c'est le temps. Du temps récupéré le soir, et surtout l'argent des devis qui dormaient faute de relance. Le simulateur plus haut vous donne une estimation pour votre métier et votre volume de devis.",
                  ],
                  liste: [
                    "Des devis envoyés depuis le chantier, en quelques minutes.",
                    "Des relances systématiques, qui ne dépendent plus de votre mémoire.",
                    "Une équipe qui sait où aller, et des heures pointées sans papier.",
                    "Des clients informés de l'avancement sans avoir à vous appeler.",
                    "Un suivi d'envoi transparent : on sait ce qui est parti, ce qui a été refusé et pourquoi.",
                  ],
                },
              ]}
            />
          </details>
        </section>

        <ContactCta />
      </main>
      <Footer />
    </div>
  );
}
