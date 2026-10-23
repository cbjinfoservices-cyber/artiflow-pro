import { useState } from "react";

type Props = {
  /** Lien Google Play. Tant qu'il est absent, le bouton reste inactif et affiche « Bientôt disponible ». */
  lienGooglePlay?: string;
  variante?: "discret" | "large";
};

export default function BandeauAppMobile({ lienGooglePlay, variante = "discret" }: Props) {
  const [noteOuverte, setNoteOuverte] = useState(false);
  const large = variante === "large";

  const carteBase =
    "inline-flex items-center gap-2.5 h-12 px-3.5 rounded-md border whitespace-nowrap transition-colors";

  return (
    <aside
      aria-label="Application mobile ArtiFlow-pro"
      className={`w-full rounded-lg border border-background-200 bg-background-100 ${
        large ? "p-5 md:p-6" : "px-4 py-3.5 md:px-5 md:py-4"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-xl">
            <i className="ri-smartphone-line"></i>
          </span>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-foreground-950 text-sm md:text-base">
              ArtiFlow-pro vous suit sur le chantier
            </p>
            <p className="mt-1 text-xs md:text-sm text-foreground-600 leading-relaxed">
              L'application Android est disponible sur Google Play. La version iOS est en cours de finalisation et
              arrivera sur l'App Store dès qu'elle sera validée par Apple.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {lienGooglePlay ? (
            <a
              href={lienGooglePlay}
              target="_blank"
              rel="noopener noreferrer"
              className={`${carteBase} border-accent-200 bg-background-50 text-foreground-900 cursor-pointer hover:border-accent-400 hover:bg-accent-100`}
            >
              <i className="ri-google-play-fill text-lg text-accent-600"></i>
              <span className="flex flex-col leading-tight text-left">
                <span className="text-[10px] uppercase tracking-wide text-foreground-500">Android</span>
                <span className="text-xs font-semibold">Google Play</span>
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOuverte((v) => !v)}
              aria-expanded={noteOuverte}
              className={`${carteBase} border-accent-200 bg-accent-100 text-foreground-900 cursor-pointer hover:border-accent-400`}
            >
              <i className="ri-google-play-fill text-lg text-accent-600"></i>
              <span className="flex flex-col leading-tight text-left">
                <span className="text-[10px] uppercase tracking-wide text-accent-800">Google Play</span>
                <span className="text-xs font-semibold">Bientôt disponible</span>
              </span>
            </button>
          )}

          <span className={`${carteBase} border-background-200 bg-background-50 text-foreground-500`}>
            <i className="ri-apple-fill text-lg text-foreground-400"></i>
            <span className="flex flex-col leading-tight text-left">
              <span className="text-[10px] uppercase tracking-wide text-foreground-400">App Store</span>
              <span className="text-xs font-semibold">Bientôt disponible</span>
            </span>
          </span>
        </div>
      </div>

      {noteOuverte && !lienGooglePlay && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-background-50 px-3 py-2.5 text-xs text-foreground-600 leading-relaxed">
          <i className="ri-information-line mt-0.5 text-primary-600"></i>
          <span>
            L'application Android est publiée sur Google Play, le lien de téléchargement direct sera ajouté ici très
            bientôt. En attendant, écrivez-nous depuis la page contact pour recevoir le lien par email.
          </span>
        </p>
      )}
    </aside>
  );
}