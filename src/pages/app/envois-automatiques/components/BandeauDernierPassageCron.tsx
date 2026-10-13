import { useEffect, useState } from "react";
import { TACHES_PLANIFIEES } from "@/lib/tachesPlanifiees";
import { DETECTIONS_TACHE_EVENT, lireDetections, type DetectionTache } from "@/lib/tachesPlanifieesMemoire";

/** Date/heure courte (« 12/10 à 08:32 »). */
function formatHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Bandeau « Dernier passage cron » : s'allume en vert dès que la première fonction a répondu,
 * pour voir d'un coup d'œil que la chaîne de déclenchement est bien branchée. S'appuie sur les
 * détections déjà mémorisées (déclenchement manuel ou ping silencieux au chargement).
 */
export default function BandeauDernierPassageCron() {
  const [detections, setDetections] = useState<Record<string, DetectionTache>>(() => lireDetections());

  useEffect(() => {
    const relire = () => setDetections(lireDetections());
    window.addEventListener(DETECTIONS_TACHE_EVENT, relire);
    return () => window.removeEventListener(DETECTIONS_TACHE_EVENT, relire);
  }, []);

  const total = TACHES_PLANIFIEES.length;
  const okDetections = Object.values(detections).filter((d) => d.ok);
  const branchees = okDetections.length;
  const derniere = okDetections.reduce<DetectionTache | null>(
    (max, d) => (!max || (d.quand && d.quand > max.quand) ? d : max),
    null,
  );
  const complet = branchees >= total;
  const vert = branchees > 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border ${
        vert ? "bg-accent-50 border-accent-200" : "bg-background-100 border-background-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`relative w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-lg ${
            vert ? "bg-accent-500 text-background-50" : "bg-background-200 text-foreground-500"
          }`}
        >
          <i className={vert ? "ri-radar-line" : "ri-timer-flash-line"}></i>
          {vert && (
            <span className="absolute -top-0.5 -right-0.5 flex w-3 h-3">
              <span className="absolute inline-flex w-full h-full rounded-full bg-accent-500 opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-3 h-3 rounded-full bg-accent-500 border-2 border-background-50"></span>
            </span>
          )}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading font-semibold text-sm text-foreground-950">Déclenchement automatique</h3>
            <span
              className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                vert ? "bg-accent-500 text-background-50" : "bg-background-200 text-foreground-600"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${vert ? "bg-background-50" : "bg-background-400"}`}></span>
              {vert ? (complet ? "Tout fonctionne" : "Déjà déclenché") : "En attente"}
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground-600 leading-relaxed">
            {vert ? (
              <>
                {complet
                  ? `Les ${total} envois automatiques se sont déjà déclenchés : tout est bien branché.`
                  : `${branchees}/${total} envois se sont déjà déclenchés — le déclenchement fonctionne, les autres restent à confirmer.`}
              </>
            ) : (
              <>
                Aucun envoi ne s'est encore déclenché tout seul. Le déclenchement s'activera automatiquement à l'heure
                prévue, sans action de votre part.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {derniere && (
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-history-line text-accent-600"></i>
            {formatHeure(derniere.quand)}
          </span>
        )}
      </div>
    </div>
  );
}