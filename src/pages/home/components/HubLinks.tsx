import { Link } from "react-router-dom";

const hubs = [
  {
    to: "/metiers",
    icon: "ri-hammer-line",
    kicker: "8 corps d'état",
    title: "Les métiers du bâtiment",
    description:
      "Plombier, électricien, maçon, peintre, carreleur… Chaque métier a sa page dédiée, ses conseils sur mesure et ses exemples de devis.",
    bubble: "bg-primary-100 text-primary-700",
    link: "text-primary-700",
  },
  {
    to: "/tarifs",
    icon: "ri-price-tag-3-line",
    kicker: "Dès 29 € / mois",
    title: "Les offres et tarifs",
    description:
      "Comparez les offres Essentiel, Pro et Entreprise et trouvez celle qui colle à votre activité, sans engagement et résiliable en un clic.",
    bubble: "bg-accent-100 text-accent-700",
    link: "text-accent-700",
  },
  {
    to: "/ressources/sujets",
    icon: "ri-book-open-line",
    kicker: "3 thèmes, 16 guides",
    title: "Les guides par sujet",
    description:
      "Chiffrage, relances clients, planning : retrouvez nos conseils courts classés par thème, quel que soit votre corps d'état.",
    bubble: "bg-secondary-100 text-secondary-700",
    link: "text-secondary-700",
  },
];

export default function HubLinks() {
  return (
    <section className="w-full bg-background-100 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-compass-3-line"></i>
            Explorer ArtiFlow-pro
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Tout ce dont vous avez besoin, bien rangé
          </h2>
          <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
            Que vous cherchiez les conseils de votre métier, le bon tarif ou une réponse précise, voici
            les trois portes d'entrée du site.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {hubs.map((hub) => (
            <Link
              key={hub.to}
              to={hub.to}
              className="group flex flex-col p-6 md:p-7 rounded-lg bg-background-50 border border-background-200 hover:border-foreground-300 transition-colors cursor-pointer"
            >
              <span className={`w-12 h-12 flex items-center justify-center rounded-lg text-xl ${hub.bubble}`}>
                <i className={hub.icon}></i>
              </span>
              <span className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground-500">
                {hub.kicker}
              </span>
              <h3 className="mt-1.5 font-heading font-bold text-xl text-foreground-950">
                {hub.title}
              </h3>
              <p className="mt-3 text-sm text-foreground-600 leading-relaxed flex-1">
                {hub.description}
              </p>
              <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${hub.link} group-hover:gap-3 transition-all`}>
                Découvrir
                <i className="ri-arrow-right-line"></i>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}