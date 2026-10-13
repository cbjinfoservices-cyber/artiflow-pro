import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COOKIE_CONSENT_OPEN_EVENT,
  getStoredConsent,
  openCookieConsent,
  setStoredConsent,
  type ConsentValue,
} from "@/lib/consent";

// Ré-export pour préserver les imports existants (footer, page cookies, etc.).
export { openCookieConsent };
export const COOKIE_CONSENT_EVENT = COOKIE_CONSENT_OPEN_EVENT;

/**
 * Bannière de consentement aux cookies, cohérente avec la page RGPD :
 * les cookies strictement nécessaires ne demandent pas d'accord,
 * les cookies de mesure d'audience ne sont activés qu'après acceptation.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getStoredConsent()) {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const handleOpen = () => setVisible(true);
    window.addEventListener(COOKIE_CONSENT_EVENT, handleOpen);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleOpen);
  }, []);

  const save = (value: ConsentValue) => {
    setStoredConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] w-full px-4 pb-4 md:px-6 md:pb-6 animate-fade-up">
      <div className="mx-auto w-full max-w-5xl rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
              <i className="ri-shield-user-line"></i>
            </span>
            <div>
              <h2 className="font-heading font-semibold text-base text-foreground-950">
                On respecte votre vie privée
              </h2>
              <p className="mt-1.5 text-sm text-foreground-600 leading-relaxed max-w-2xl">
                Nous utilisons des cookies <strong>strictement nécessaires</strong> au fonctionnement du site
                et, avec votre accord, des cookies de <strong>mesure d'audience</strong> pour l'améliorer. Vous
                pouvez accepter, refuser, ou en savoir plus dans notre{" "}
                <Link
                  to="/rgpd#cookies"
                  className="font-semibold text-primary-700 hover:underline cursor-pointer"
                >
                  politique de confidentialité
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:shrink-0">
            <button
              type="button"
              onClick={() => save("essential")}
              className="inline-flex items-center justify-center h-11 px-5 rounded-md border border-background-300 bg-background-50 text-sm font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => save("all")}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-check-line"></i>
              Tout accepter
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-background-200">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-equalizer-line"></i>
            Cookies utilisés
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-start gap-3 rounded-md bg-background-100 border border-background-200 px-3.5 py-3">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                <i className="ri-lock-line"></i>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground-900">Strictement nécessaires</span>
                  <span className="px-2 py-0.5 rounded-full bg-background-200 text-[11px] font-medium text-foreground-700">
                    6 mois
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-600 leading-snug">Toujours actifs : sécurité, session et mémorisation de votre choix.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md bg-background-100 border border-background-200 px-3.5 py-3">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                <i className="ri-line-chart-line"></i>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground-900">Mesure d'audience</span>
                  <span className="px-2 py-0.5 rounded-full bg-background-200 text-[11px] font-medium text-foreground-700">
                    13 mois
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-600 leading-snug">Avec votre accord : statistiques anonymisées pour améliorer le site.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}