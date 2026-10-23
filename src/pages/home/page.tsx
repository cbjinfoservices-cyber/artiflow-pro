import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import Hero from "./components/Hero";
import SommaireAccueil from "./components/SommaireAccueil";
import NouveautesAccueil from "./components/NouveautesAccueil";
import ProductPreview from "./components/ProductPreview";
import Features from "./components/Features";
import BeforeAfter from "./components/BeforeAfter";
import Workflow from "./components/Workflow";
import Pricing from "./components/Pricing";
import Simulateur from "./components/Simulateur";
import Preuves from "./components/Preuves";
import Faq from "./components/Faq";
import BlocTexteSeo from "@/components/feature/BlocTexteSeo";
import HubLinks from "./components/HubLinks";
import ContactCta from "./components/ContactCta";
import EncartBesoinAide from "@/components/feature/EncartBesoinAide";
import BandeauAppMobile from "@/components/feature/BandeauAppMobile";
import { faqs } from "@/mocks/landing";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { IMAGE_PARTAGE_SITE, usePageMeta } from "@/hooks/usePageMeta";

export default function Home() {
  usePageMeta(
    "ArtiFlow-pro — Assistant IA pour artisans du bâtiment",
    "ArtiFlow-pro, le SaaS IA des artisans du bâtiment : devis en 2 minutes, relances SMS et WhatsApp automatiques, planning et suivi de chantier.",
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
        <SommaireAccueil />
        {/* Les dernières livraisons : juste après le hero, pour montrer que le produit bouge. */}
        <NouveautesAccueil />
        <ProductPreview />
        <Features />
        <BeforeAfter />
        <Workflow />
        <Pricing />
        {/* Encart « Besoin d'aide ? » : posé juste après les offres, là où le visiteur hésite à choisir. */}
        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-customer-service-2-line"></i>
                  Une hésitation sur l'offre ?
                </span>
                <p className="mt-2 text-sm text-foreground-600">
                  Parlez-nous de votre activité : on vous aide à choisir la formule la plus juste, sans surpayer.
                </p>
              </div>
              <EncartBesoinAide variante="clair" />
            </div>
          </div>
        </section>
        <Simulateur />
        <Preuves />
        {/* Application mobile : bandeau discret, Android publié sur Google Play, iOS annoncé bientôt. */}
        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
            <div className="max-w-5xl mx-auto">
              <BandeauAppMobile />
            </div>
          </div>
        </section>
        <Faq />
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
                "ArtiFlow-pro est un logiciel en ligne conçu pour les artisans du bâtiment : plombiers, électriciens, maçons, peintres, carreleurs, menuisiers, couvreurs ou encore chauffagistes. Il réunit au même endroit tout ce qui tourne autour du devis : la rédaction, l'envoi, la signature, la facturation, le suivi des chantiers et les relances clients.",
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
                "Une fois l'accord obtenu, vous planifiez, cochez les étapes et générez la facture.",
              ],
            },
            {
              sousTitre: "Et quand un email n'arrive pas ?",
              paragraphes: [
                "C'est l'un des points les plus frustrants dans un logiciel de gestion : un devis envoyé, aucune réponse, et impossible de savoir si le client a simplement ignoré le message ou si l'adresse était mauvaise. ArtiFlow-pro lève cette ambiguïté : la fiche client affiche le dernier email refusé avec sa date, l'adresse réellement tentée et la raison renvoyée par le service d'envoi.",
                "Vous pouvez contrôler l'adresse (format et domaine) avant tout nouvel envoi, consulter la liste datée des emails réellement partis avec leur objet et leur destinataire, puis relancer en une seule action. Et si vous n'avez pas le temps tout de suite, programmez le renvoi dans 24 heures : il partira seul, une seule fois, et la programmation s'annule d'elle-même dès que vous corrigez l'adresse.",
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
              sousTitre: "Pourquoi les artisans l'adoptent",
              paragraphes: [
                "Le bénéfice le plus cité par les utilisateurs n'est pas technologique : c'est le temps. Du temps récupéré le soir, du temps gagné sur les trajets, et surtout l'argent des devis qui dormaient faute de relance.",
              ],
              liste: [
                "Environ six heures de tâches administratives économisées chaque semaine.",
                "Des devis envoyés en quelques minutes, chiffrés au juste prix.",
                "Des relances systématiques, qui font signer des affaires autrement perdues.",
                "Un planning mieux organisé, avec moins de kilomètres inutiles.",
                "Un suivi d'envoi transparent : on sait ce qui est parti, ce qui a été refusé et pourquoi.",
              ],
            },
          ]}
        />
        <HubLinks />
        <ContactCta />
      </main>
      <Footer />
    </div>
  );
}