/**
 * « Une journée avec ArtiFlow-pro » : les fonctions racontées au fil d'une journée de chantier,
 * chacune avec ce qu'elle remplace. Remplace l'ancien comparatif avant/après chiffré.
 */
const moments = [
  {
    heure: "7 h 30",
    icon: "ri-calendar-check-line",
    titre: "La journée est déjà prête",
    texte: "Chacun ouvre l'application et voit son chantier, l'adresse et le client à appeler.",
    avant: "Les appels et SMS pour dire à chacun où aller.",
  },
  {
    heure: "10 h",
    icon: "ri-mic-line",
    titre: "Le devis se dicte sur place",
    texte: "Vous décrivez les travaux à voix haute. L'IA rédige avec vos prix et vos unités.",
    avant: "Le devis tapé le soir, de mémoire.",
  },
  {
    heure: "12 h 45",
    icon: "ri-quill-pen-line",
    titre: "Le client signe sur son téléphone",
    texte: "Signature en ligne : le devis accepté devient un chantier, sans rien ressaisir.",
    avant: "Imprimer, attendre, scanner, relancer.",
  },
  {
    heure: "16 h",
    icon: "ri-camera-line",
    titre: "Le chantier se termine proprement",
    texte: "Heures pointées, photos et procès-verbal de réception signé sur place par le client.",
    avant: "La réception qui tourne à la parole contre parole.",
  },
  {
    heure: "18 h",
    icon: "ri-repeat-line",
    titre: "Les relances partent toutes seules",
    texte: "Devis sans réponse et factures en retard : relancés par email, SMS ou WhatsApp.",
    avant: "Les relances repoussées à demain, puis oubliées.",
  },
];

export default function JourneeType() {
  return (
    <section id="journee" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-sun-line"></i>
            Une journée avec ArtiFlow-pro
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-950 tracking-tight">
            Le bureau tourne pendant que vous êtes sur le chantier
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Pas de nouvelle méthode à apprendre : l'application suit votre journée, et fait le travail administratif au
            fil de l'eau.
          </p>
        </div>

        <ol className="relative mt-12 grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 max-w-6xl mx-auto">
          {/* Fil de la journée, derrière les pastilles horaires (grand écran). */}
          <span className="hidden lg:block absolute left-[10%] right-[10%] top-5 h-px bg-background-300" aria-hidden="true"></span>
          {moments.map((m) => (
            <li key={m.heure} className="relative flex lg:flex-col gap-4 lg:gap-0">
              <span className="relative z-10 shrink-0 w-[4.75rem] lg:w-auto lg:mx-auto inline-flex items-center justify-center h-10 px-3.5 rounded-full bg-foreground-950 text-background-50 text-sm font-bold whitespace-nowrap tabular-nums">
                {m.heure}
              </span>
              <article className="flex-1 lg:mt-5 p-5 rounded-lg bg-background-100 border border-background-200 flex flex-col">
                <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-500 text-background-50 text-xl">
                  <i className={m.icon}></i>
                </span>
                <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950 leading-snug">{m.titre}</h3>
                <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">{m.texte}</p>
                <p className="mt-4 pt-3 border-t border-background-200 text-xs text-foreground-500 leading-snug">
                  <span className="font-semibold text-foreground-700">Avant : </span>
                  <span className="line-through decoration-foreground-300">{m.avant}</span>
                </p>
              </article>
            </li>
          ))}
        </ol>

        <div className="mt-10 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 p-5 rounded-lg bg-foreground-950 text-center sm:text-left">
          <span className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-2xl">
            <i className="ri-moon-clear-line"></i>
          </span>
          <p className="text-background-50">
            <span className="block font-heading font-bold text-lg">20 h : votre soirée vous appartient.</span>
            <span className="block text-sm text-background-200/80">Plus de devis à taper ni de relances à envoyer.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
