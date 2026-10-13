import { Link } from "react-router-dom";
import type { Gestionnaire } from "@/hooks/useAuth";
import { GESTIONNAIRE_PRINCIPAL_EMAIL } from "@/lib/roles";

/** Deux pastilles indiquant si l'adresse a accès à chaque section du back-office. */
function SectionChips({ compta, abo }: { compta: boolean; abo: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
 * Récapitulatif des accès au back-office par gestionnaire : libellé, note interne et
 * sections autorisées (Comptabilité / Mon abonnement). Le gestionnaire principal est
 * toujours listé en premier, avec un accès complet.
 */
export default function AccesGestionnairesCard({
  gestionnaires,
  isPrincipal,
}: {
  gestionnaires: Gestionnaire[];
  isPrincipal: boolean;
}) {
  const nb = gestionnaires.length + 1;

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-user-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Accès gestionnaires</h3>
            <p className="text-[11px] text-foreground-500">
              {nb} compte{nb > 1 ? "s" : ""} · sections autorisées par adresse
            </p>
          </div>
        </div>
        <Link
          to="/app/mon-compte-gestionnaire"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
        >
          <i className="ri-settings-3-line"></i>
          Gérer
        </Link>
      </div>

      <div className="flex-1">
        {/* Gestionnaire principal — toujours présent, accès complet */}
        <div className="flex items-start gap-3 px-5 py-3 border-t border-background-200">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-star-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground-950 truncate">{GESTIONNAIRE_PRINCIPAL_EMAIL}</p>
              <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
                Principal
              </span>
            </div>
            <p className="mt-1 text-[11px] text-foreground-500">Accès complet au back-office</p>
            <div className="mt-1.5">
              <SectionChips compta abo />
            </div>
          </div>
        </div>

        {gestionnaires.length === 0 ? (
          <p className="px-5 py-5 text-xs text-foreground-500 border-t border-background-200">
            Aucune autre adresse gestionnaire. Ajoutez-en depuis « Compte gestionnaire ».
          </p>
        ) : (
          gestionnaires.map((g) => (
            <div key={g.id} className="flex items-start gap-3 px-5 py-3 border-t border-background-200">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <i className="ri-shield-user-line"></i>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground-950 truncate">{g.email}</p>
                  {g.libelle && (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                      <i className="ri-price-tag-3-line text-[10px]"></i>
                      {g.libelle}
                    </span>
                  )}
                </div>
                {g.note && (
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-600 line-clamp-2">{g.note}</p>
                )}
                <div className="mt-1.5">
                  <SectionChips compta={g.voir_comptabilite} abo={g.voir_mon_abonnement} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!isPrincipal && (
        <p className="px-5 py-2.5 text-[10px] text-foreground-400 border-t border-background-200 inline-flex items-center gap-1.5">
          <i className="ri-lock-line"></i>
          Seul le gestionnaire principal peut modifier ces accès.
        </p>
      )}
    </div>
  );
}