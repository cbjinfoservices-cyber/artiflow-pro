import { useEffect, useState } from "react";
import {
  PREFERENCES_RESTAUREES_EVENT,
  lireDerniereRestauration,
  oublierRestauration,
  type RestaurationPreferences,
} from "@/lib/preferencesRestauration";
import {
  ICONES_PREFERENCE,
  LIBELLES_PREFERENCE_COURT,
} from "@/lib/preferencesAffichageNotif";

/**
 * Petit résumé proposé après une connexion sur un appareil où les préférences locales ont été
 * reprises depuis le compte (typiquement un nouvel appareil). On y liste, en un coup d'œil, ce qui
 * a été restauré, puis on peut écarter le résumé d'un clic. Ne rend rien tant qu'aucune
 * restauration n'a eu lieu.
 */
export default function ResumeRestaurationPreferences() {
  const [rec, setRec] = useState<RestaurationPreferences | null>(null);

  useEffect(() => {
    const lire = () => {
      const r = lireDerniereRestauration();
      if (r) setRec(r);
    };
    lire();
    window.addEventListener(PREFERENCES_RESTAUREES_EVENT, lire);
    return () => window.removeEventListener(PREFERENCES_RESTAUREES_EVENT, lire);
  }, []);

  if (!rec) return null;

  const fermer = () => {
    setRec(null);
    oublierRestauration();
  };

  return (
    <div className="fixed z-[60] left-4 right-4 bottom-[92px] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[22rem] animate-fade-in">
      <div className="rounded-lg bg-background-50 border border-background-200 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-cloud-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-sm text-foreground-950">
              Préférences restaurées depuis votre compte
            </h3>
            <p className="text-[11px] text-foreground-500 mt-0.5 leading-relaxed">
              Retrouvées ici comme sur vos autres appareils. Rien à faire, tout est déjà en place.
            </p>
          </div>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer le résumé"
            title="Fermer"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-foreground-500 cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
        <ul className="px-4 pb-4 flex flex-wrap gap-1.5">
          {rec.familles.map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1.5 h-7 pl-1.5 pr-3 rounded-full bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-700 whitespace-nowrap"
            >
              <span className="w-4 h-4 flex items-center justify-center text-secondary-600">
                <i className={`${ICONES_PREFERENCE[t]} text-xs`}></i>
              </span>
              {LIBELLES_PREFERENCE_COURT[t]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}