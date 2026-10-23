import FaqAccordion, { type FaqItem } from "@/components/feature/FaqAccordion";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import type { MembreEquipe } from "@/mocks/equipe";

type FaqAuteurProps = {
  membre: MembreEquipe;
  nombreGuides: number;
  nombreEpisodes: number;
  nombreInterventions: number;
};

/**
 * FAQ propre à un membre de l'équipe.
 *
 * Chaque question est construite à partir des données réelles du profil
 * (rôle, ancienneté, expertises, guides, prises de parole), ce qui donne un
 * contenu unique par page — utile pour le référencement et pour les visiteurs —
 * et alimente un balisage Schema.org FAQPage correspondant au texte affiché.
 */
export default function FaqAuteur({
  membre,
  nombreGuides,
  nombreEpisodes,
  nombreInterventions,
}: FaqAuteurProps) {
  const prenom = membre.name.split(" ")[0];
  const expertises = membre.expertises.slice(0, 4).join(", ");
  const prisesDeParole = nombreEpisodes + nombreInterventions;

  const items: FaqItem[] = [
    {
      question: `Quel est le rôle de ${membre.name} chez ArtiFlow-pro ?`,
      answer: `${membre.name} est ${membre.role.toLowerCase()} chez ArtiFlow-pro. ${membre.bio}`,
    },
    {
      question: `Depuis quand ${membre.name} fait partie de l'équipe ArtiFlow-pro ?`,
      answer: `${membre.name} a rejoint l'équipe en ${membre.depuis} et intervient depuis ${membre.ville}. En quelques mots : « ${membre.citation} »`,
    },
    {
      question: `Sur quels sujets l'équipe s'appuie-t-elle sur ${prenom} ?`,
      answer: `${prenom} intervient notamment sur plusieurs domaines clés pour les artisans : ${expertises}.`,
    },
  ];

  if (nombreGuides > 0) {
    items.push({
      question: `Où lire les guides signés ${membre.name} ?`,
      answer: `${membre.name} a signé ${nombreGuides} guide${nombreGuides > 1 ? "s" : ""} pratique${nombreGuides > 1 ? "s" : ""} pour les artisans, à retrouver plus haut dans la section « Ses guides pour le terrain ».`,
    });
  }

  if (prisesDeParole > 0) {
    items.push({
      question: `Peut-on écouter ${prenom} en podcast ou en conférence ?`,
      answer: `Oui : les épisodes et prises de parole de ${prenom} sont regroupés plus bas sur cette page, à écouter directement, ainsi que sur la page Média d'ArtiFlow-pro.`,
    });
  }

  items.push({
    question: `Que peut-on apprendre en lisant les contenus signés ${membre.name} ?`,
    answer: `Les contenus signés ${membre.name} cherchent à être directement applicables : chiffrer plus juste, relancer au bon moment et organiser les chantiers sans y passer ses soirées. Ce sont des conseils de terrain, éprouvés en conditions réelles plutôt que des principes théoriques.`,
  });

  items.push({
    question: `Comment contacter ${prenom} ?`,
    answer: `L'équipe ArtiFlow-pro reste joignable. Demandez une démo ou écrivez-nous depuis la page Contact : votre message sera transmis directement à ${prenom} et vous obtiendrez une réponse d'une personne qui connaît le métier.`,
  });

  items.push({
    question: `Comment proposer un sujet ${prenom} ou rejoindre l'équipe ?`,
    answer: `Une idée de guide, une question de métier ou une envie de rejoindre l'aventure : écrivez-nous depuis la page Contact ou via la page Rejoindre. Les suggestions des artisans nourrissent directement les prochains contenus et les prises de parole de l'équipe.`,
  });

  useFaqSchema(items, `artiflow-auteur-faq-${membre.id}`);

  return (
    <section
      id="faq-auteur"
      className="w-full bg-background-50 border-b border-background-200 scroll-mt-24"
    >
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl mb-8">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
            <i className="ri-question-answer-line"></i>
            Questions fréquentes
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            En savoir plus sur {membre.name}
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Les questions que l'on nous pose le plus souvent sur le rôle de {prenom} au sein
            d'ArtiFlow-pro et sur la façon d'échanger avec l'équipe.
          </p>
        </div>

        <FaqAccordion items={items} idPrefix={`faq-auteur-${membre.id}`} />
      </div>
    </section>
  );
}