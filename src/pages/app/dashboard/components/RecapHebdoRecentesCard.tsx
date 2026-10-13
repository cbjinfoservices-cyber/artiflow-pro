import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRecapRecontactHistorique } from "@/hooks/useRecapRecontactHistorique";
import { formatShortDate } from "@/lib/dates";
import ErreurChargementInline from "@/pages/app/components/ErreurChargementInline";

/**
 * Raccourci du tableau de bord : mini-résumé des 3 derniers récaps hebdomadaires de
 * recontact envoyés (date, origine, comptes concernés et taux de recontact après envoi).
 * Un clic ouvre l'historique complet sur la page Abonnements.
 */
export default function RecapHebdoRecentesCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, reload } = useRecapRecontactHistorique(user?.id, 3);

  const toneTaux = (taux: number | null): string => {
    if (taux === null) return "bg-background-200 text-foreground-500";
    if (taux >= 50) return "bg-accent-100 text-accent-800";
    if (taux >= 20) return "bg-secondary-100 text-secondary-800";
    return "bg-background-200 text-foreground-600";
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-mail-send-line"></i>
          </span>
          <div>
            <h2 className="font-heading font-semibold text-sm text-foreground-950">Récaps hebdomadaires</h2>
            <p className="text-[11px] text-foreground-500">3 derniers envois de recontact automatiques</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/app/abonnements")}
          title="Ouvrir l'historique complet des récaps hebdomadaires"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
        >
          <i className="ri-history-line"></i>
          Voir l'historique
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5 py-1">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement des derniers récaps…
        </p>
      ) : error ? (
        <ErreurChargementInline
          titre="Récaps hebdomadaires"
          message={error}
          onRetry={reload}
        />
      ) : items.length === 0 ? (
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-secondary-600">
            <i className="ri-information-line"></i>
          </span>
          <p className="text-xs text-foreground-600">
            Aucun récap hebdomadaire envoyé pour l'instant. Dès le premier envoi automatique, les derniers passages
            apparaîtront ici avec leur taux de recontact.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
            >
              <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg ${e.origine === "test" ? "bg-secondary-100 text-secondary-700" : "bg-accent-100 text-accent-700"}`}>
                <i className={e.origine === "test" ? "ri-flask-line" : "ri-mail-check-line"}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground-950">{formatShortDate(e.envoyeLe)}</p>
                <p className="text-[11px] text-foreground-500">
                  {e.origine === "test" ? "Test manuel" : "Envoi automatique"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-fire-line"></i>
                {e.nbComptes} compte{e.nbComptes > 1 ? "s" : ""}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${toneTaux(e.tauxApres)}`}
                title={
                  e.tauxApres === null
                    ? "Taux non calculable pour cet envoi"
                    : `${e.recontactesApres} compte(s) sur ${e.nbComptes} recontactés après cet envoi`
                }
              >
                <i className="ri-focus-3-line"></i>
                {e.tauxApres === null ? "— %" : `${e.tauxApres} %`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}