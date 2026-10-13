import { Link } from "react-router-dom";

const points = [
  {
    icon: "ri-file-text-line",
    title: "Devis en 2 minutes",
    text: "Vous dictez le chantier, l'IA rédige le devis avec les bons postes et prix.",
  },
  {
    icon: "ri-notification-3-line",
    title: "Zéro relance oubliée",
    text: "Les rappels partent tout seuls jusqu'au paiement du client.",
  },
  {
    icon: "ri-calendar-2-line",
    title: "Planning intelligent",
    text: "Votre semaine rangée par zone et par urgence.",
  },
];

export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between w-[44%] max-w-[540px] shrink-0 bg-accent-950 p-10 xl:p-12">
      <Link to="/" className="flex items-center gap-2.5 cursor-pointer w-fit">
        <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
          <i className="ri-tools-fill text-lg"></i>
        </span>
        <span className="font-heading font-bold text-lg text-background-50">ArtiFlow-pro</span>
      </Link>

      <div>
        <h2 className="font-heading font-extrabold text-3xl xl:text-4xl text-background-50 leading-tight">
          Votre espace artisan.
          <span className="block text-primary-400 mt-1">Tout au même endroit.</span>
        </h2>
        <p className="mt-4 text-background-200/80 text-sm leading-relaxed max-w-md">
          Devis, relances, planning et chantiers — pilotés depuis votre téléphone, sans paperasse.
        </p>

        <ul className="mt-8 flex flex-col gap-5">
          {points.map((p) => (
            <li key={p.title} className="flex items-start gap-3.5">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-background-50/10 text-primary-400">
                <i className={`${p.icon} text-lg`}></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-background-50">{p.title}</p>
                <p className="text-xs text-background-200/70 mt-0.5 leading-relaxed">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-background-200/60">Conçu en France, pour les artisans de France.</p>
    </div>
  );
}