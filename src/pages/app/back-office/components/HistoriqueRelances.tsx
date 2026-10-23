import { useMemo, useState } from "react";
import type { RelanceHistorique } from "@/lib/suppressionsAdmin";

/** Date + heure lisibles d'une relance consignée. */
function formaterDateHeure(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  const jour = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/**
 * Historique complet des motifs de relance, dépliable directement sur la ligne.
 *
 * Le Backend conserve les 8 dernières relances manuelles (date + motif). Ce panneau les
 * affiche de la plus récente à la plus ancienne, pour reconstituer le fil des échanges
 * avec un artisan sans quitter la liste.
 */
export default function HistoriqueRelances({ entrees }: { entrees: RelanceHistorique[] }) {
  const [ouvert, setOuvert] = useState(false);
  const recentes = useMemo(() => [...entrees].reverse(), [entrees]);

  if (recentes.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        title="Afficher les 8 dernières relances manuelles et leurs motifs"
        className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
      >
        <i className="ri-history-line"></i>
        Historique des relances ({recentes.length})
        <i className={ouvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
      </button>

      {ouvert && (
        <div className="mt-2 rounded-md border border-background-200 bg-background-50 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400 bg-background-100 border-b border-background-200">
            Trace d'audit · 8 dernières relances
          </p>
          <ol className="divide-y divide-background-200">
            {recentes.map((entree, index) => (
              <li key={`${entree.le}-${index}`} className="flex items-start gap-2 px-3 py-2">
                <span className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold">
                  {recentes.length - index}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground-900">
                    {formaterDateHeure(entree.le)}
                  </p>
                  <p className="text-[11px] text-foreground-600 break-words">
                    {entree.motif || (
                      <em className="text-foreground-400 not-italic">Aucun motif consigné</em>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}