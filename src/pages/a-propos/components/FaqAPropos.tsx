import FaqAccordion, { type FaqItem } from "@/components/feature/FaqAccordion";
import { useFaqSchema } from "@/hooks/useFaqSchema";

const FAQ_APROPOS: FaqItem[] = [
  {
    question: "Qui est derrière ArtiFlow-pro ?",
    answer:
      "ArtiFlow-pro est porté par une équipe à taille humaine composée d'anciens du bâtiment, d'ingénieurs et de spécialistes du produit. Léa Marchand et Karim Benali ont cofondé l'entreprise après un constat répété sur les chantiers : trop d'heures perdues dans l'administratif. Chaque membre reste proche du terrain.",
  },
  {
    question: "Depuis quand ArtiFlow-pro existe-t-il ?",
    answer:
      "Le projet démarre en 2023, la première version voit le jour en 2024, et l'outil équipe aujourd'hui plus de 2 400 artisans à travers la France. Nous grandissons en gardant la même boussole : rendre du temps aux artisans.",
  },
  {
    question: "ArtiFlow-pro convient-il à mon corps d'état ?",
    answer:
      "Oui : l'outil couvre déjà huit corps d'état, du plombier-chauffagiste au peintre, en passant par l'électricien, le maçon, le menuisier, le carreleur, le couvreur et le plâtrier. Les modèles et les estimations s'adaptent à votre métier et à votre façon de travailler.",
  },
  {
    question: "Où sont hébergées mes données et mes devis ?",
    answer:
      "Vos données restent les vôtres. Elles sont hébergées avec soin et l'entreprise applique une conformité RGPD stricte : aucune revente de données, aucun accès non autorisé, et une sécurité considérée comme un prérequis plutôt qu'un argument commercial.",
  },
  {
    question: "Comment échanger avec l'équipe ?",
    answer:
      "L'équipe reste joignable et répond volontiers aux professionnels du bâtiment. Vous pouvez demander une démo depuis n'importe quelle page du site, ou nous écrire via la page Contact : vous parlerez toujours à quelqu'un qui connaît réellement votre métier.",
  },
  {
    question: "Combien coûte ArtiFlow-pro et faut-il s'engager sur la durée ?",
    answer:
      "Les formules s'ajustent à la taille de votre entreprise, du seul artisan à l'équipe de plusieurs personnes. Le tarif annoncé est le tarif payé, sans frais cachés ni options surprises, et vous restez libre d'arrêter quand vous le souhaitez. Notre souhait n'est pas de vous enfermer, mais de vous rendre du temps assez vite pour que l'outil se rentabilise de lui-même.",
  },
  {
    question: "Peut-on essayer ArtiFlow-pro avant de s'abonner ?",
    answer:
      "Oui. La meilleure façon de se faire un avis reste de tester avec vos propres devis et votre façon de travailler. Vous pouvez demander une démonstration depuis n'importe quelle page du site ; l'équipe vous accompagne ensuite pour prendre l'outil en main selon votre métier et votre organisation, sans jargon inutile.",
  },
  {
    question: "ArtiFlow-pro s'utilise-t-il depuis un chantier, sur téléphone ?",
    answer:
      "Oui : l'interface est pensée pour être utilisée partout, y compris sur le terrain depuis un smartphone ou une tablette. Vous pouvez consulter un devis, le faire signer, relancer un client ou noter une information de chantier sans devoir revenir au bureau. C'est précisément sur ces moments-là que l'outil fait gagner le plus de temps.",
  },
  {
    question: "Les devis et factures générés sont-ils conformes à la réglementation ?",
    answer:
      "Les documents générés respectent les mentions légales attendues pour les artisans (identification de l'entreprise, numérotation, TVA) et restent entièrement personnalisables avec votre logo et vos coordonnées. Vous gardez la main sur le contenu : l'outil se charge de la mise en forme et de la cohérence d'un document à l'autre.",
  },
];

/**
 * FAQ de la page À propos : un contenu éditorial unique et réellement utile
 * (équipe, ancienneté, métiers couverts, données, contact), associé à un
 * balisage Schema.org FAQPage conforme au texte affiché.
 */
export default function FaqAPropos() {
  useFaqSchema(FAQ_APROPOS, "artiflow-apropos-faq");

  return (
    <section
      id="faq-a-propos"
      className="w-full bg-background-50 border-b border-background-200 scroll-mt-24"
    >
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl mb-8">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
            <i className="ri-question-answer-line"></i>
            Questions fréquentes
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Tout savoir sur ArtiFlow-pro et son équipe
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Les questions que l'on nous pose le plus souvent sur l'entreprise, les métiers couverts
            et la façon dont nous travaillons au quotidien avec les artisans.
          </p>
        </div>

        <FaqAccordion items={FAQ_APROPOS} idPrefix="faq-a-propos" />
      </div>
    </section>
  );
}