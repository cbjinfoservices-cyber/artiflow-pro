import { useMemo, useState } from "react";
import { RESULTATS_APPEL, type AppelHistorique } from "@/lib/suppressionsAdmin";

/** Date + heure lisibles d'un appel consigné. */
function formaterDateHeure(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  const jour = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/** Libellé et icône d'un résultat d'appel (valeur par défaut si absent). */
function libelle(resultat: AppelHistorique["resultat"]): { texte: string; icone: string } {
  const trouve = RESULTATS_APPEL.find((r) => r.valeur === resultat);
  if (!trouve) return { texte: "Résultat non consigné", icone: "ri-question-line" };
  return { texte: trouve.court, icone: trouve.icone };
}

/**
 * Historique des appels téléphoniques consignés, dépliable sur la ligne.
 *
 * Le Backend conserve les 8 derniers appels (date + résultat + note interne).
 * Ce panneau les affiche du plus récent au plus ancien pour revoir ce qui a été dit
 * à l'artisan, sans quitter la liste.
 */
export default function HistoriqueAppels({ entrees }: { entrees: AppelHistorique[] }) {
  const [ouvert, setOuvert] = useState(false);
  const recentes = useMemo(() => [...entrees].reverse(), [entrees]);

  if (recentes.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        title="Afficher les 8 derniers appels consignés (résultat + note)"
        className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-primary-100 border border-primary-200 text-[10px] font-semibold text-primary-800 whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors"
      >
        <i className="ri-phone-line"></i>
        Historique des appels ({recentes.length})
        <i className={ouvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
      </button>

      {ouvert && (
        <div className="mt-2 rounded-md border border-background-200 bg-background-50 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400 bg-background-100 border-b border-background-200">
            Trace d&apos;audit · 8 derniers appels
          </p>
          <ol className="divide-y divide-background-200">
            {recentes.map((entree, index) => {
              const affichage = libelle(entree.resultat);
              return (
                <li key={`${entree.le}-${index}`} className="flex items-start gap-2 px-3 py-2">
                  <span className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold">
                    {recentes.length - index}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground-900 flex flex-wrap items-center gap-1.5">
                      {formaterDateHeure(entree.le)}
                      <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded-full bg-background-100 border border-background-200 text-[9px] font-bold uppercase tracking-wide text-foreground-600">
                        <i className={affichage.icone}></i>
                        {affichage.texte}
                      </span>
                    </p>
                    <p className="text-[11px] text-foreground-600 break-words">
                      {entree.note || (
                        <em className="text-foreground-400 not-italic">Aucune note consignée</em>
                      )}
                    </p>
                    {entree.par && (
                      <p className="text-[10px] text-foreground-400 mt-0.5">Consigné par {entree.par}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}