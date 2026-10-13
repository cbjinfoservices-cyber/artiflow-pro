import { useState } from "react";
import { plans } from "@/mocks/landing";

const ANNUAL_DISCOUNT = 0.8;
const BASE_ENTREPRISE = 99;
const INCLUDED_USERS = 5;
const EXTRA_USER_PRICE = 12;
const MAX_USERS = 40;
const PRESETS = [1, 5, 10, 20, 40];

/**
 * Mini-calculateur d'économies annuelles affiché en haut du récap « mensuel vs
 * annuel ». Le total est calculé toutes offres confondues et se recalcule en
 * direct selon le nombre d'utilisateurs (qui ne fait varier que l'offre
 * Entreprise, les autres restant à 1 utilisateur).
 */
export default function MiniCalculateurEconomies() {
  const [users, setUsers] = useState(INCLUDED_USERS);

  const clamp = (value: number) => Math.min(MAX_USERS, Math.max(1, value));

  const lignes = plans.map((plan) => {
    const base =
      plan.name === "Entreprise"
        ? BASE_ENTREPRISE + Math.max(0, users - INCLUDED_USERS) * EXTRA_USER_PRICE
        : Number(plan.price);
    const annualMonthly = Math.round(base * ANNUAL_DISCOUNT);
    const savings = base * 12 - annualMonthly * 12;
    return { name: plan.name, base, annualMonthly, savings };
  });

  const totalEconomie = lignes.reduce((sum, ligne) => sum + ligne.savings, 0);

  return (
    <div className="mt-8 rounded-lg border border-accent-300/60 bg-accent-100/60 p-5 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex-1">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-800">
            <i className="ri-calculator-line"></i>
            Mini-calculateur d'économies
          </span>
          <h3 className="mt-2 font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
            Toutes offres confondues, réglez votre équipe
          </h3>
          <p className="mt-2 text-sm text-foreground-600 leading-relaxed max-w-lg">
            Déplacez le curseur du nombre d'utilisateurs : le total des économies annuelles se recalcule en
            direct, offre par offre.
          </p>

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setUsers((v) => clamp(v - 1))}
              disabled={users <= 1}
              aria-label="Retirer un utilisateur"
              className="w-9 h-9 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-subtract-line"></i>
            </button>
            <div className="min-w-[84px] text-center">
              <span className="font-heading font-extrabold text-2xl text-foreground-950">{users}</span>
              <p className="text-[11px] text-foreground-500">utilisateur{users > 1 ? "s" : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => setUsers((v) => clamp(v + 1))}
              disabled={users >= MAX_USERS}
              aria-label="Ajouter un utilisateur"
              className="w-9 h-9 flex items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-800 text-lg cursor-pointer transition-colors hover:bg-background-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="mt-4 w-full max-w-md accent-accent-600 cursor-pointer"
          />

          <div className="mt-3 flex flex-wrap gap-2">
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
                {n} artisan{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[320px] shrink-0 rounded-lg bg-background-50 border border-accent-300/60 p-5">
          <p className="text-xs font-medium text-foreground-500">Total économisé par an</p>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-heading font-extrabold text-4xl text-foreground-950">{totalEconomie} €</span>
            <span className="mb-1 text-xs font-medium text-foreground-500">/ an</span>
          </div>
          <p className="mt-1 text-[11px] text-foreground-400">
            si vous passiez chaque offre à l'annuel (−20 %)
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {lignes.map((ligne) => (
              <li key={ligne.name} className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground-700">
                  {ligne.name}
                  {ligne.name === "Entreprise" && (
                    <span className="ml-1 text-foreground-400">({ligne.base} €)</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                  −{ligne.savings} €
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}