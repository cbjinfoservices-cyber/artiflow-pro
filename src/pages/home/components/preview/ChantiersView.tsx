import { chantierSteps } from "@/mocks/dashboard";

const photos = [
  "https://readdy.ai/api/search-image?query=Documentary%20photograph%20of%20a%20bathroom%20renovation%20in%20progress%2C%20newly%20installed%20plumbing%20pipes%20and%20tiles%20partially%20laid%2C%20natural%20window%20light%2C%20warm%20neutral%20tones%2C%20clean%20organised%20construction%20site%2C%20high%20detail&width=400&height=400&seq=artiflow-chantier-a&orientation=squarish",
  "https://readdy.ai/api/search-image?query=Documentary%20photograph%20of%20a%20plumber%20installing%20a%20white%20sink%20in%20a%20modern%20bathroom%20under%20renovation%2C%20tools%20nearby%2C%20natural%20light%2C%20warm%20neutral%20tones%2C%20tidy%20work%20area%2C%20high%20detail&width=400&height=400&seq=artiflow-chantier-b&orientation=squarish",
  "https://readdy.ai/api/search-image?query=Documentary%20photograph%20of%20a%20finished%20renovated%20bathroom%20with%20beige%20tiles%20and%20chrome%20fixtures%2C%20soft%20natural%20light%2C%20warm%20neutral%20tones%2C%20clean%20minimal%20styling%2C%20high%20detail&width=400&height=400&seq=artiflow-chantier-c&orientation=squarish",
];

export default function ChantiersView() {
  const done = chantierSteps.filter((s) => s.done).length;
  const progress = Math.round((done / chantierSteps.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-lg bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-heading font-semibold text-sm text-foreground-950">Rénovation salle de bain · Mme Dupont</h4>
            <p className="text-[11px] text-foreground-500">
              <i className="ri-map-pin-line"></i> Lyon 6e · démarré le 2 octobre
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-[11px] font-semibold">{progress}% terminé</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-background-200 overflow-hidden">
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg bg-background-50 border border-background-200">
          <h4 className="font-heading font-semibold text-sm text-foreground-950 mb-3">Étapes du chantier</h4>
          <ul className="flex flex-col gap-2.5">
            {chantierSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-2.5">
                <span
                  className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-xs ${
                    step.done ? "bg-accent-500 text-background-50" : "border border-background-300 text-transparent"
                  }`}
                >
                  <i className="ri-check-line"></i>
                </span>
                <span className={`text-xs ${step.done ? "text-foreground-500 line-through" : "text-foreground-800"}`}>{step.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-background-50 border border-background-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-heading font-semibold text-sm text-foreground-950">Photos du chantier</h4>
            <span className="text-[10px] text-foreground-400">horodatées</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <div key={src} className="relative w-full h-20 md:h-24 rounded-md overflow-hidden border border-background-200">
                <img src={src} alt={`Photo chantier ${i + 1}`} title="Photo de suivi de chantier" className="w-full h-full object-cover object-top" />
              </div>
            ))}
          </div>
          <div className="mt-3 p-2.5 rounded-md bg-accent-50 border border-accent-200 flex items-center gap-2">
            <i className="ri-checkbox-circle-line text-accent-600"></i>
            <span className="text-[11px] text-foreground-600">PV de réception prêt à faire signer au client.</span>
          </div>
        </div>
      </div>
    </div>
  );
}