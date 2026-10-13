import { useState } from "react";
import { useDemoModal } from "@/hooks/useDemoModal";

const BASE_PRICE = 99;
const INCLUDED_USERS = 5;
const EXTRA_USER_PRICE = 12;
const MAX_USERS = 40;

const PRESETS = [5, 10, 20, 40];

export default function SimulateurEntreprise({ annual }: { annual: boolean }) {
  const [users, setUsers] = useState(INCLUDED_USERS);
  const { openDemo } = useDemoModal();

  const clamp = (value: number) => Math.min(MAX_USERS, Math.max(1, value));
  const extraUsers = Math.max(0, users - INCLUDED_USERS);
  const monthlyPrice = BASE_PRICE + extraUsers * EXTRA_USER_PRICE;
  const annualMonthlyPrice = Math.round(monthlyPrice * 0.8);
  const displayedPrice = annual ? annualMonthlyPrice : monthlyPrice;
  const yearlyPrice = displayedPrice * 12;
  const yearlySaving = (monthlyPrice - annualMonthlyPrice) * 12;

  return (
    <section id="simulateur" className="w-full bg-background-50 scroll-mt-32">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-team-line"></i>
            Offre Entreprise
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Combien êtes-vous à l'atelier ?
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Ajustez le nombre d'artisans et découvrez le prix de votre offre Entreprise. 5 utilisateurs inclus, puis 12 € par utilisateur supplémentaire.
          </p>
        </div>

        <div className="rounded-lg border border-background-200 bg-background-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 md:p-8">
              <span className="text-sm font-medium text-foreground-700">Nombre d'utilisateurs</span>

              <div className="mt-4 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setUsers((v) => clamp(v - 1))}
                  disabled={users <= 1}
                  aria-label="Retirer un utilisateur"
                  className="w-10 h-10 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-subtract-line"></i>
                </button>
                <div className="min-w-[92px] text-center">
                  <span className="font-heading font-extrabold text-3xl md:text-4xl text-foreground-950">{users}</span>
                  <p className="text-xs text-foreground-500">utilisateur{users > 1 ? "s" : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUsers((v) => clamp(v + 1))}
                  disabled={users >= MAX_USERS}
                  aria-label="Ajouter un utilisateur"
                  className="w-10 h-10 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-add-line"></i>
                </button>
              </div>

              <input
                type="range"
                min={1}
                max={MAX_USERS}
                value={users}
                onChange={(e) => setUsers(clamp(Number(e.target.value)))}
                aria-label="Nombre d'utilisateurs"
                className="mt-6 w-full accent-primary-500 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] text-foreground-400">
                <span>1</span>
                <span>{MAX_USERS} utilisateurs</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setUsers(n)}
                    className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                      users === n
                        ? "bg-secondary-500 text-background-50 border-secondary-500"
                        : "bg-background-50 text-foreground-700 border-background-200 hover:bg-background-200"
                    }`}
                  >
                    {n} artisans
                  </button>
                ))}
              </div>

              <p className="mt-6 text-xs text-foreground-500 leading-relaxed">
                {extraUsers > 0
                  ? `${BASE_PRICE} € (base, ${INCLUDED_USERS} inclus) + ${extraUsers} × ${EXTRA_USER_PRICE} € = ${monthlyPrice} €/mois`
                  : `${BASE_PRICE} €/mois — jusqu'à ${INCLUDED_USERS} utilisateurs inclus`}
              </p>

              <div className="mt-5 flex items-start gap-3.5 p-4 rounded-lg bg-accent-100/70 border border-accent-300/60">
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-lg">
                  <i className="ri-gift-line"></i>
                </span>
                <div>
                  <p className="font-heading font-semibold text-sm text-accent-900">
                    Économie annuelle pour {users} utilisateur{users > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs md:text-sm text-accent-800/85 leading-relaxed">
                    À l'année, l'offre tombe à <strong className="font-semibold">{annualMonthlyPrice} €/mois</strong> au lieu de {monthlyPrice} €, soit{" "}
                    <strong className="font-semibold">{yearlySaving} € économisés par an</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-foreground-950 text-background-50 flex flex-col justify-center">
              <p className="text-sm text-background-200/80">Votre offre Entreprise estimée</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-heading font-extrabold text-5xl">{displayedPrice} €</span>
                <span className="mb-2 text-sm text-background-200/70">
                  {annual ? "/ mois, à l'année" : "/ mois"}
                </span>
              </div>
              {annual && (
                <p className="mt-2 text-xs font-medium text-accent-400">
                  Soit {yearlyPrice} € par an — {yearlySaving} € économisés
                </p>
              )}

              <ul className="mt-6 flex flex-col gap-2 text-sm text-background-100/90">
                <li className="flex items-center gap-2">
                  <i className="ri-check-line text-primary-400"></i>
                  {users} utilisateur{users > 1 ? "s" : ""}, rôles & permissions
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line text-primary-400"></i>
                  Paiement en ligne des clients
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line text-primary-400"></i>
                  Export comptable automatique
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line text-primary-400"></i>
                  IA avancée & accompagnement dédié
                </li>
              </ul>

              <button
                type="button"
                onClick={() => openDemo("tarifs-simulateur-entreprise", { users })}
                className="mt-7 inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors hover:bg-primary-600"
              >
                <i className="ri-calendar-check-line"></i>
                Demander un devis pour mon équipe
              </button>
              <p className="mt-3 text-center text-[11px] text-background-200/70">
                Estimation indicative · tarif ajusté sur devis pour les grandes équipes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}