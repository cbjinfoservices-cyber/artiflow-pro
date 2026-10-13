import { useMemo, useState } from "react";
import { simulateurMetiers } from "@/mocks/simulateur";
import { useDemoModal } from "@/hooks/useDemoModal";

const TAUX_DEFAUT = 45;

function formatHeures(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function formatEuros(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

function formatDevis(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export default function Simulateur() {
  const [metierSlug, setMetierSlug] = useState(simulateurMetiers[0].slug);
  const [devis, setDevis] = useState(12);
  const [taux, setTaux] = useState(TAUX_DEFAUT);
  const { openDemo } = useDemoModal();

  const metier = simulateurMetiers.find((m) => m.slug === metierSlug) ?? simulateurMetiers[0];

  const result = useMemo(() => {
    const heuresAvant = (devis * metier.minutesAvant) / 60;
    const heuresApres = (devis * metier.minutesApres) / 60;
    const gagneesSemaine = Math.max(heuresAvant - heuresApres, 0);
    const joursAn = (gagneesSemaine * 52) / 8;
    const signesAvant = (devis * metier.tauxSignatureAvant) / 100;
    const signesApres = (devis * metier.tauxSignatureApres) / 100;
    const plusSemaine = Math.max(signesApres - signesAvant, 0);
    const plusAn = plusSemaine * 52;
    return {
      heuresAvant,
      heuresApres,
      gagneesSemaine,
      gagneesAn: gagneesSemaine * 52,
      joursAn,
      valeurAn: gagneesSemaine * 52 * taux,
      ratio: heuresAvant > 0 ? heuresApres / heuresAvant : 0,
      plusSemaine,
      plusAn,
      valeurPlusAn: plusAn * metier.panierMoyen,
    };
  }, [devis, taux, metier]);

  return (
    <section id="simulateur" className="w-full bg-background-100 border-y border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-calculator-line"></i>
            Simulateur
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-950 tracking-tight">
            Combien d'heures perdez-vous chaque semaine ?
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Choisissez votre métier et le volume de devis que vous traitez. On estime ensemble le temps
            que la paperasse vous coûte — et ce que vous pourriez récupérer.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
          <div className="lg:col-span-3 p-6 md:p-7 rounded-lg border border-background-200 bg-background-50">
            <div>
              <label htmlFor="sim-metier" className="block text-sm font-semibold text-foreground-900">
                Votre métier
              </label>
              <div className="relative mt-2">
                <select
                  id="sim-metier"
                  value={metierSlug}
                  onChange={(e) => setMetierSlug(e.target.value)}
                  className="w-full h-12 pl-4 pr-11 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {simulateurMetiers.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-lg text-foreground-500 pointer-events-none"></i>
              </div>
            </div>

            <div className="mt-7">
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="sim-devis" className="text-sm font-semibold text-foreground-900">
                  Devis traités par semaine
                </label>
                <span className="font-heading font-bold text-xl text-primary-700 whitespace-nowrap">
                  {devis}
                </span>
              </div>
              <input
                id="sim-devis"
                type="range"
                min={1}
                max={40}
                step={1}
                value={devis}
                onChange={(e) => setDevis(Number(e.target.value))}
                className="range-primary w-full mt-4 cursor-pointer"
              />
              <div className="mt-1.5 flex justify-between text-xs text-foreground-500">
                <span>1 devis</span>
                <span>40 devis</span>
              </div>
            </div>

            <div className="mt-7">
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="sim-taux" className="text-sm font-semibold text-foreground-900">
                  Votre taux horaire
                </label>
                <span className="font-heading font-bold text-xl text-primary-700 whitespace-nowrap">
                  {taux} €/h
                </span>
              </div>
              <input
                id="sim-taux"
                type="range"
                min={25}
                max={95}
                step={5}
                value={taux}
                onChange={(e) => setTaux(Number(e.target.value))}
                className="range-primary w-full mt-4 cursor-pointer"
              />
              <div className="mt-1.5 flex justify-between text-xs text-foreground-500">
                <span>25 €/h</span>
                <span>95 €/h</span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-lg bg-background-100 border border-background-200">
              <p className="text-xs text-foreground-600 leading-relaxed">
                Estimation basée sur le temps moyen passé par devis pour un {metier.name.toLowerCase()} :
                environ {metier.minutesAvant} minutes aujourd'hui, contre {metier.minutesApres} minutes avec ArtiFlow-pro.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 md:p-7 rounded-lg bg-foreground-950 text-background-50 flex flex-col">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-300">
              <i className="ri-time-line"></i>
              Votre semaine aujourd'hui
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-heading font-extrabold text-4xl md:text-5xl tracking-tight">
                {formatHeures(result.heuresAvant)}
              </span>
              <span className="mb-1.5 text-sm text-background-200/80">heures sur vos devis</span>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs text-background-200/80 mb-2">
                <span>Sans ArtiFlow-pro</span>
                <span>Avec ArtiFlow-pro</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-background-50/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${Math.round(result.ratio * 100)}%` }}
                ></div>
              </div>
              <p className="mt-2 text-xs text-background-200/80">
                Il ne vous resterait que {formatHeures(result.heuresApres)} h par semaine de saisie.
              </p>
            </div>

            <div className="mt-6 p-5 rounded-lg bg-background-50/10 border border-background-50/15">
              <p className="text-sm text-background-200/85">Temps récupéré</p>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-heading font-extrabold text-3xl md:text-4xl text-background-50">
                  {formatHeures(result.gagneesSemaine)} h
                </span>
                <span className="mb-1 text-sm text-background-200/80">par semaine</span>
              </div>
              <p className="mt-2 text-xs text-primary-300">
                soit près de {formatHeures(result.joursAn)} journées de travail sur l'année
              </p>
            </div>

            <div className="mt-4 p-5 rounded-lg bg-background-50/10 border border-background-50/15">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-300">
                <i className="ri-file-check-line"></i>
                Devis signés en plus
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-heading font-extrabold text-3xl md:text-4xl text-background-50">
                  +{formatDevis(result.plusSemaine)}
                </span>
                <span className="mb-1 text-sm text-background-200/80">par semaine</span>
              </div>
              <p className="mt-2 text-xs text-background-200/80">
                soit {Math.round(result.plusAn)} chantiers de plus signés sur l'année, avec un taux de
                signature qui passe de {metier.tauxSignatureAvant} % à {metier.tauxSignatureApres} %.
              </p>
              <p className="mt-3 text-sm font-semibold text-primary-300">
                ≈ {formatEuros(result.valeurPlusAn)} € de chiffre d'affaires en plus par an
              </p>
            </div>

            <div className="mt-4 flex-1 flex flex-col justify-end">
              <div className="p-5 rounded-lg bg-primary-500 text-background-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-background-50/85">
                  Valeur récupérée par an
                </p>
                <p className="mt-1 font-heading font-extrabold text-3xl md:text-4xl whitespace-nowrap">
                  ≈ {formatEuros(result.valeurAn)} €
                </p>
                <p className="mt-1.5 text-xs text-background-50/85">
                  au taux de {taux} €/h, sur {formatHeures(result.gagneesAn)} heures récupérées.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openDemo("simulateur")}
                className="mt-5 inline-flex items-center justify-center gap-2 h-12 rounded-md bg-background-50 text-foreground-950 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
              <p className="mt-3 text-center text-[11px] text-background-200/70">
                Estimation indicative, à affiner lors de la démo selon votre activité réelle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}