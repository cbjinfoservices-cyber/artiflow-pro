import { Link } from "react-router-dom";
import { useDureeEssai } from "@/hooks/useDureeEssai";

type ReassuranceItem = {
  icon: string;
  title: string;
  desc: string;
  tone: "primary" | "accent" | "secondary";
};

const TONE: Record<ReassuranceItem["tone"], { bubble: string; ring: string }> = {
  primary: { bubble: "bg-primary-100 text-primary-700", ring: "border-primary-200" },
  accent: { bubble: "bg-accent-100 text-accent-700", ring: "border-accent-300" },
  secondary: { bubble: "bg-secondary-100 text-secondary-700", ring: "border-secondary-200" },
};

/**
 * Bandeau de réassurance de la page Tarifs. La durée d'essai affichée suit le réglage
 * global du back-office (`parametres_app.essai_jours`) au lieu d'un texte figé : si
 * l'essai est désactivé (0 jour), l'encart d'essai est remplacé par un argument « sans
 * engagement » pour que le discours reste exact.
 */
export default function ReassurancePaiement() {
  const { jours: dureeEssai } = useDureeEssai();

  const items: ReassuranceItem[] = [
    {
      icon: "ri-shield-check-line",
      title: "Paiement 100 % sécurisé",
      desc: "Vos règlements passent par un prestataire bancaire de confiance, entièrement chiffrés. Aucune donnée de carte n'est stockée chez nous.",
      tone: "primary",
    },
    dureeEssai > 0
      ? {
          icon: "ri-timer-flash-line",
          title: `${dureeEssai} jours d'essai`,
          desc: `Testez l'offre Pro en entier pendant ${dureeEssai} jour${
            dureeEssai > 1 ? "s" : ""
          }. Aucun débit pendant l'essai : le premier prélèvement n'a lieu qu'à la fin de la période, et vous pouvez résilier avant.`,
          tone: "accent",
        }
      : {
          icon: "ri-hand-coin-line",
          title: "Sans engagement",
          desc: "Prélèvement mensuel ou annuel selon votre choix, résiliable à tout moment depuis votre espace. Aucun frais caché, aucune reconduction forcée.",
          tone: "accent",
        },
    {
      icon: "ri-close-circle-line",
      title: "Résiliation en 1 clic",
      desc: "Sans engagement ni justificatif. Vous changez d'offre ou vous arrêtez quand vous voulez, directement depuis votre espace.",
      tone: "secondary",
    },
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => {
          const tone = TONE[item.tone];
          return (
            <article
              key={item.title}
              className={`flex items-start gap-3.5 p-4 md:p-5 rounded-lg bg-background-50 border ${tone.ring}`}
            >
              <span className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full ${tone.bubble} text-xl`}>
                <i className={item.icon}></i>
              </span>
              <div>
                <h3 className="font-heading font-semibold text-sm md:text-base text-foreground-950">{item.title}</h3>
                <p className="mt-1 text-xs md:text-sm text-foreground-600 leading-relaxed">{item.desc}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center md:justify-between gap-3 p-4 md:p-5 rounded-lg bg-secondary-100/70 border border-secondary-200">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-200 text-secondary-800">
            <i className="ri-question-line text-lg"></i>
          </span>
          <div>
            <p className="font-heading font-semibold text-sm md:text-base text-secondary-900">
              Une question sur les offres ?
            </p>
            <p className="mt-0.5 text-xs md:text-sm text-secondary-800/85">
              Un doute sur l'offre adaptée à votre activité ? Écrivez-nous, on vous conseille sans engagement.
            </p>
          </div>
        </div>
        <Link
          to={`/contact?sujet=${encodeURIComponent("Question sur les offres et tarifs")}&origine=tarifs`}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 shrink-0 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
        >
          <i className="ri-chat-3-line"></i>
          Poser une question sur les offres
        </Link>
      </div>
    </div>
  );
}