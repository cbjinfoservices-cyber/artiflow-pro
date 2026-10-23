import { Link } from "react-router-dom";
import type { EcheancesDuJour } from "@/hooks/useEcheancesDuJour";
import { formatEuros } from "@/lib/format";

/**
 * Bandeau d'en-tête du tableau de bord : le montant à encaisser aujourd'hui
 * (factures échues ou arrivant à échéance), cliquable vers la page Factures
 * déjà filtrée sur « À encaisser aujourd'hui ».
 *
 * Il reste sobre quand tout est réglé, et passe en teinte accent dès qu'il
 * reste quelque chose à encaisser — rouge si une facture est déjà en retard.
 */
export default function EncaissementDuJourCard({ echeances }: { echeances: EcheancesDuJour }) {
  const nbFactures = echeances.facturesJour + echeances.facturesRetard;
  const enRetard = echeances.facturesRetard > 0;
  const rienAEncaisser = nbFactures === 0 || echeances.montant <= 0;

  return (
    <Link
      to="/app/factures?encaisser=jour"
      aria-label={`À encaisser aujourd'hui : ${formatEuros(echeances.montant)} — ouvrir la liste filtrée`}
      className={`group flex flex-wrap items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
        rienAEncaisser
          ? "bg-background-100 border-background-200 hover:border-primary-300"
          : enRetard
            ? "bg-red-50 border-red-200 hover:border-red-300"
            : "bg-accent-50 border-accent-200 hover:border-accent-300"
      }`}
    >
      <span
        className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full ${
          rienAEncaisser
            ? "bg-background-200 text-foreground-500"
            : enRetard
              ? "bg-red-500/10 text-red-600"
              : "bg-accent-100 text-accent-700"
        }`}
      >
        <i className={`text-xl ${enRetard ? "ri-alarm-warning-line" : "ri-money-euro-circle-line"}`}></i>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
          À encaisser aujourd&apos;hui
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-0.5 ${
            rienAEncaisser ? "text-foreground-700" : enRetard ? "text-red-700" : "text-accent-800"
          }`}
        >
          {formatEuros(echeances.montant)}
        </p>
        <p className="text-xs text-foreground-600 mt-1">
          {rienAEncaisser ? (
            "Aucune facture en attente sur les échéances du jour. Tout est réglé."
          ) : (
            <>
              {nbFactures} facture{nbFactures > 1 ? "s" : ""} à encaisser · {echeances.facturesJour} au titre
              d&apos;aujourd&apos;hui
              {echeances.facturesRetard > 0 ? ` · ${echeances.facturesRetard} déjà en retard` : ""}
              {echeances.relancesJour > 0
                ? ` · ${echeances.relancesJour} relance${echeances.relancesJour > 1 ? "s" : ""} au départ`
                : ""}
            </>
          )}
        </p>
      </div>

      <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap group-hover:border-primary-300 group-hover:text-primary-800 transition-colors">
        <i className="ri-filter-3-line"></i>
        Voir la liste filtrée
        <i className="ri-arrow-right-s-line"></i>
      </span>
    </Link>
  );
}