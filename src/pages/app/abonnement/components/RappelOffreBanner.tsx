import { useEffect, useState } from "react";
import {
  lireRappelOffre,
  effacerRappelOffre,
  type RappelOffre,
} from "@/lib/rappelOffre";

export default function RappelOffreBanner({ offreActuelle }: { offreActuelle?: string }) {
  const [rappel, setRappel] = useState<RappelOffre | null>(null);

  useEffect(() => {
    setRappel(lireRappelOffre());
  }, []);

  if (!rappel) return null;

  const dejaSurOffre = offreActuelle && offreActuelle === rappel.offre;
  const facturationLabel = rappel.facturation === "annuel" ? "à l'annuelle (−20 %)" : "au mensuel";

  const fermer = () => {
    effacerRappelOffre();
    setRappel(null);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 md:p-5 rounded-lg bg-accent-100 border border-accent-300/70 animate-fade-in">
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
        <i className="ri-notification-3-line text-lg"></i>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm md:text-base text-accent-900">
          {dejaSurOffre
            ? `Vous avez demandé à être prévenu pour l'offre ${rappel.offre}`
            : `Vous êtes intéressé par l'offre ${rappel.offre}`}
        </p>
        <p className="mt-0.5 text-xs md:text-sm text-accent-800/90">
          Vous avez choisi la facturation {facturationLabel}. On vous prévient par email dès l'ouverture du
          paiement en ligne — et on vous réserve le tarif de lancement.
          {dejaSurOffre
            ? ""
            : ` Tant que c'est le cas, vous restez sur l'offre ${offreActuelle ?? "actuelle"}.`}
        </p>
      </div>
      <button
        type="button"
        onClick={fermer}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-50 transition-colors"
      >
        <i className="ri-check-line"></i>
        J'ai compris
      </button>
    </div>
  );
}