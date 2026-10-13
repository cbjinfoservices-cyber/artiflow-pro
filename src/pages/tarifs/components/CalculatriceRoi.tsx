import { useEffect, useState } from "react";

const WEEKS_PER_YEAR = 46;
const PRO_MONTHLY = 59;
const PRO_ANNUAL_COST = Math.round(PRO_MONTHLY * 0.8) * 12;
const PRESETS = [3, 6, 10, 15];

const HOURS_KEY = "artiflow.roi.hours";
const RATE_KEY = "artiflow.roi.rate";

const DEFAULT_HOURS = 6;
const DEFAULT_RATE = 45;

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  } catch {
    return fallback;
  }
}

function readStoredValue(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatEuro(value: number): string {
  return `${Math.round(value).toLocaleString("fr-FR")} €`;
}

export default function CalculatriceRoi() {
  const [hoursPerWeek, setHoursPerWeek] = useState(() =>
    readStoredNumber(HOURS_KEY, DEFAULT_HOURS, 1, 20)
  );
  const [rate, setRate] = useState(() => readStoredNumber(RATE_KEY, DEFAULT_RATE, 10, 200));
  const [storedEstimate, setStoredEstimate] = useState<{ hours: number; rate: number } | null>(() => {
    const storedHours = readStoredValue(HOURS_KEY);
    const storedRate = readStoredValue(RATE_KEY);
    if (storedHours === null && storedRate === null) return null;
    return { hours: storedHours ?? DEFAULT_HOURS, rate: storedRate ?? DEFAULT_RATE };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(HOURS_KEY, String(hoursPerWeek));
    } catch {
      /* stockage indisponible */
    }
  }, [hoursPerWeek]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      /* stockage indisponible */
    }
  }, [rate]);

  const resetEstimation = () => {
    setHoursPerWeek(DEFAULT_HOURS);
    setRate(DEFAULT_RATE);
  };

  const annualHours = hoursPerWeek * WEEKS_PER_YEAR;
  const annualGain = annualHours * rate;
  const netGain = annualGain - PRO_ANNUAL_COST;
  const roiMultiple = PRO_ANNUAL_COST > 0 ? annualGain / PRO_ANNUAL_COST : 0;
  const paybackDays =
    annualGain > 0 ? Math.max(1, Math.round((PRO_ANNUAL_COST / annualGain) * 365)) : 0;

  const clampRate = (value: number) => Math.min(200, Math.max(10, value));
  const isCustomized = hoursPerWeek !== DEFAULT_HOURS || rate !== DEFAULT_RATE;

  return (
    <section id="calculatrice-roi" className="w-full bg-background-50 scroll-mt-32">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-line-chart-line"></i>
            Votre retour sur investissement
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Combien vous rapporte le temps gagné ?
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Les artisans gagnent en moyenne 6 h de rédaction de devis par semaine. Mettez votre propre
            tarif horaire pour voir ce que ce temps vaut sur une année.
          </p>
        </div>

        {storedEstimate && (
          <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-accent-100/80 border border-accent-300/60">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
              <i className="ri-history-line"></i>
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-accent-900">Rebonjour, on a retrouvé votre estimation</p>
              <p className="mt-0.5 text-xs text-accent-800/85 leading-relaxed">
                Vous étiez à {storedEstimate.hours} h/semaine à {storedEstimate.rate} €/h — vos réglages sont déjà repris ci-dessous.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStoredEstimate(null)}
              aria-label="Masquer le rappel"
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-accent-800/70 hover:bg-accent-200/60 hover:text-accent-900 cursor-pointer transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        <div className="mt-10 rounded-lg border border-background-200 bg-background-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 md:p-8">
              <span className="text-sm font-medium text-foreground-700">
                Heures de devis économisées par semaine
              </span>

              <div className="mt-4 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setHoursPerWeek((v) => Math.max(1, v - 1))}
                  disabled={hoursPerWeek <= 1}
                  aria-label="Moins d'heures"
                  className="w-10 h-10 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-subtract-line"></i>
                </button>
                <div className="min-w-[92px] text-center">
                  <span className="font-heading font-extrabold text-3xl md:text-4xl text-foreground-950">
                    {hoursPerWeek}
                  </span>
                  <p className="text-xs text-foreground-500">h / semaine</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHoursPerWeek((v) => Math.min(20, v + 1))}
                  disabled={hoursPerWeek >= 20}
                  aria-label="Plus d'heures"
                  className="w-10 h-10 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-add-line"></i>
                </button>
              </div>

              <input
                type="range"
                min={1}
                max={20}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Math.min(20, Math.max(1, Number(e.target.value))))}
                aria-label="Heures économisées par semaine"
                className="mt-6 w-full accent-primary-500 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] text-foreground-400">
                <span>1 h</span>
                <span>20 h</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setHoursPerWeek(n)}
                    className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                      hoursPerWeek === n
                        ? "bg-secondary-500 text-background-50 border-secondary-500"
                        : "bg-background-50 text-foreground-700 border-background-200 hover:bg-background-200"
                    }`}
                  >
                    {n} h / semaine
                  </button>
                ))}
              </div>

              <div className="mt-7 pt-6 border-t border-background-200">
                <label htmlFor="roi-rate" className="text-sm font-medium text-foreground-700">
                  Votre tarif horaire
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRate((v) => clampRate(v - 5))}
                    aria-label="Baisser le tarif horaire"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200"
                  >
                    <i className="ri-subtract-line"></i>
                  </button>
                  <div className="relative flex-1">
                    <input
                      id="roi-rate"
                      type="number"
                      min={10}
                      max={200}
                      value={rate}
                      onChange={(e) => setRate(clampRate(Number(e.target.value) || 0))}
                      className="w-full h-11 pl-3.5 pr-10 rounded-md bg-background-50 border border-background-200 text-sm font-semibold text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground-400">
                      €/h
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRate((v) => clampRate(v + 5))}
                    aria-label="Augmenter le tarif horaire"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200"
                  >
                    <i className="ri-add-line"></i>
                  </button>
                </div>
                <p className="mt-3 text-xs text-foreground-500 leading-relaxed">
                  {hoursPerWeek} h × {WEEKS_PER_YEAR} semaines travaillées = {annualHours} h économisées par an.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-foreground-400">
                    <i className="ri-save-3-line"></i>
                    Votre estimation est mémorisée sur cet appareil.
                  </p>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={resetEstimation}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-restart-line"></i>
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-foreground-950 text-background-50 flex flex-col justify-center">
              <p className="text-sm text-background-200/80">Votre gain estimé sur un an</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-heading font-extrabold text-5xl">{formatEuro(annualGain)}</span>
              </div>
              <p className="mt-2 text-xs text-background-200/70">
                de temps productif récupéré à {rate} €/h sur {annualHours} h
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-md bg-background-50/10 px-4 py-3">
                  <span className="text-sm text-background-200/85">Abonnement Pro à l'année</span>
                  <span className="font-heading font-bold text-sm">−{formatEuro(PRO_ANNUAL_COST)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-accent-500 px-4 py-3">
                  <span className="text-sm font-medium">Bénéfice net annuel</span>
                  <span className="font-heading font-bold text-lg">{formatEuro(netGain)}</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-background-50/15 px-4 py-3 text-center">
                  <p className="font-heading font-bold text-2xl text-accent-400">×{roiMultiple.toFixed(1)}</p>
                  <p className="mt-0.5 text-[11px] text-background-200/70">de retour sur investissement</p>
                </div>
                <div className="rounded-md border border-background-50/15 px-4 py-3 text-center">
                  <p className="font-heading font-bold text-2xl text-accent-400">
                    {paybackDays} j
                  </p>
                  <p className="mt-0.5 text-[11px] text-background-200/70">pour rentabiliser l'abonnement</p>
                </div>
              </div>

              <p className="mt-5 text-[11px] text-background-200/60 leading-relaxed">
                Estimation indicative basée sur {WEEKS_PER_YEAR} semaines d'activité. À ajuster selon votre
                métier et votre volume de devis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}