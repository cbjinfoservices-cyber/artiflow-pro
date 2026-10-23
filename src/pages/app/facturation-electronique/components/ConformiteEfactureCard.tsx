import { Link } from "react-router-dom";
import type { EfControle } from "@/lib/factureElectronique";

interface Props {
  controles: EfControle[];
}

/**
 * Liste de contrôle avant transmission : chaque ligne indique une information
 * indispensable à une facture électronique conforme et si elle est renseignée.
 */
export default function ConformiteEfactureCard({ controles }: Props) {
  const total = controles.length;
  const ok = controles.filter((c) => c.ok).length;
  const complet = total > 0 && ok === total;
  const pourcentage = total === 0 ? 0 : Math.round((ok / total) * 100);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-background-200">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-sm text-foreground-950">Conformité de vos factures</h3>
          <p className="text-xs text-foreground-500 mt-0.5">
            Les informations reprises automatiquement dans le fichier électronique et le PDF.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold whitespace-nowrap ${
            complet ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-800"
          }`}
        >
          <i className={complet ? "ri-checkbox-circle-line" : "ri-progress-4-line"}></i>
          {ok}/{total} renseigné{ok > 1 ? "s" : ""}
        </span>
      </div>

      <div className="px-5 pt-4">
        <div className="h-1.5 w-full rounded-full bg-background-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${complet ? "bg-accent-500" : "bg-primary-500"}`}
            style={{ width: `${pourcentage}%` }}
          ></div>
        </div>
      </div>

      <ul className="p-3 flex flex-col gap-1.5">
        {controles.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-3 p-2.5 rounded-md hover:bg-background-50 transition-colors"
          >
            <span
              className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full ${
                c.ok ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-500"
              }`}
            >
              <i className={c.ok ? "ri-check-line text-sm" : "ri-subtract-line text-sm"}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground-900">{c.label}</p>
              <p className="text-[11px] text-foreground-500 mt-0.5 break-words">{c.detail}</p>
            </div>
            {!c.ok && c.lien && (
              <Link
                to={c.lien}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap hover:bg-secondary-200 transition-colors shrink-0"
              >
                Compléter
                <i className="ri-arrow-right-line text-[11px]"></i>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}