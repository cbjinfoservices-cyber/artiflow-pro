import type { Gestionnaire } from "@/hooks/useAuth";
import { GESTIONNAIRE_PRINCIPAL_EMAIL } from "@/lib/roles";

/** Deux pastilles indiquant si l'adresse a accès à chaque section du back-office. */
function Chips({ compta, abo }: { compta: boolean; abo: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      <span
        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
          compta ? "bg-accent-100 text-accent-800" : "bg-background-200 text-foreground-400"
        }`}
      >
        <i className="ri-file-chart-line text-[10px]"></i>
        Comptabilité
      </span>
      <span
        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
          abo ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-400"
        }`}
      >
        <i className="ri-vip-crown-line text-[10px]"></i>
        Mon abonnement
      </span>
    </div>
  );
}

/**
 * Récapitulatif des accès, affiché en tête de la page « Compte gestionnaire » : pour
 * chaque adresse, son libellé, sa note interne et les sections du back-office auxquelles
 * elle a accès (Comptabilité / Mon abonnement). Vue synthétique avant la liste détaillée.
 */
export default function AccesRecapCard({ gestionnaires }: { gestionnaires: Gestionnaire[] }) {
  const total = gestionnaires.length + 1;
  const nbCompta = gestionnaires.filter((g) => g.voir_comptabilite).length + 1;
  const nbAbo = gestionnaires.filter((g) => g.voir_mon_abonnement).length + 1;
  const pluriel = total > 1;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 bg-background-200/50">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-shield-check-line"></i>
        </span>
        <div>
          <h3 className="font-heading font-bold text-sm text-foreground-950">Récapitulatif des accès</h3>
          <p className="text-[11px] text-foreground-500">
            {total} adresse{pluriel ? "s" : ""} gestionnaire{pluriel ? "s" : ""} · {nbCompta} avec Comptabilité ·{" "}
            {nbAbo} avec Mon abonnement
          </p>
        </div>
      </div>

      {/* Gestionnaire principal — toujours présent, accès complet */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3 border-t border-background-200">
        <div className="flex items-center gap-2.5 min-w-0 sm:w-72">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-star-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950 truncate">{GESTIONNAIRE_PRINCIPAL_EMAIL}</p>
            <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
              Principal
            </span>
          </div>
        </div>
        <p className="flex-1 min-w-0 text-[11px] text-foreground-500 truncate">
          Gestionnaire principal — accès complet au back-office
        </p>
        <Chips compta abo />
      </div>

      {gestionnaires.length === 0 ? (
        <p className="px-5 py-4 text-xs text-foreground-500 border-t border-background-200">
          Aucune autre adresse gestionnaire pour l'instant.
        </p>
      ) : (
        gestionnaires.map((g) => (
          <div
            key={g.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3 border-t border-background-200"
          >
            <div className="flex items-center gap-2.5 min-w-0 sm:w-72">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <i className="ri-shield-user-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-950 truncate">{g.email}</p>
                {g.libelle ? (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                    <i className="ri-price-tag-3-line text-[10px]"></i>
                    {g.libelle}
                  </span>
                ) : (
                  <span className="text-[10px] text-foreground-400">Aucun libellé</span>
                )}
              </div>
            </div>
            <p className={`flex-1 min-w-0 text-[11px] truncate ${g.note ? "text-foreground-600" : "text-foreground-400"}`}>
              {g.note ? g.note : "Aucune note interne"}
            </p>
            <Chips compta={g.voir_comptabilite} abo={g.voir_mon_abonnement} />
          </div>
        ))
      )}
    </div>
  );
}