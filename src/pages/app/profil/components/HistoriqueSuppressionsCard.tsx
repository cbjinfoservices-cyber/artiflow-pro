import { useCallback, useEffect, useState } from "react";
import {
  chargerHistoriqueSuppressions,
  formaterDateFr,
  libelleMotifAnnulation,
  type DemandeSuppressionHistorique,
} from "@/lib/compte";

/** Icône et teinte selon le canal d'annulation enregistré. */
function styleMotif(motif: string | null): { icone: string; classe: string } {
  if (motif === "connexion") return { icone: "ri-login-circle-line", classe: "bg-secondary-100 text-secondary-800" };
  if (motif === "gestionnaire") return { icone: "ri-customer-service-2-line", classe: "bg-primary-100 text-primary-800" };
  return { icone: "ri-arrow-go-back-line", classe: "bg-accent-100 text-accent-900" };
}

/**
 * « Historique des demandes annulées » de l'onglet Sécurité.
 *
 * Traçabilité pour l'artisan : il voit quand une suppression a été demandée, quelle
 * échéance avait été fixée, et comment la demande a finalement été annulée (lui-même,
 * une simple reconnexion, ou l'équipe). Rien de sensible n'est exposé : uniquement les
 * dates et le canal d'annulation.
 */
export default function HistoriqueSuppressionsCard() {
  const [demandes, setDemandes] = useState<DemandeSuppressionHistorique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDemandes(await chargerHistoriqueSuppressions());
    } catch {
      setErreur("Impossible de charger l'historique pour l'instant.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
    // L'historique est rafraîchi au retour sur l'onglet : une annulation faite ailleurs
    // (reconnexion, équipe) apparaît sans avoir à recharger la page.
    const surFocus = () => {
      void charger();
    };
    window.addEventListener("focus", surFocus);
    return () => window.removeEventListener("focus", surFocus);
  }, [charger]);

  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-history-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Historique des demandes annulées
            </h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              La trace de ce qui s'est passé sur votre compte : demandes de fermeture enregistrées, puis annulées.
              Utile pour vérifier qu'aucune suppression n'a été lancée à votre insu.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void charger();
          }}
          disabled={chargement}
          title="Rafraîchir l'historique"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-600 cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-50"
        >
          <i className={chargement ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
        </button>
      </div>

      {erreur ? (
        <div className="mt-4 p-4 rounded-md bg-background-50 border border-background-200 text-center">
          <p className="text-xs text-foreground-600">{erreur}</p>
          <button
            type="button"
            onClick={() => {
              void charger();
            }}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : chargement ? (
        <div className="mt-4 flex items-center justify-center py-6">
          <div className="flex flex-col items-center gap-2">
            <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
            <p className="text-xs text-foreground-500">Chargement de l'historique…</p>
          </div>
        </div>
      ) : demandes.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 p-4 rounded-md bg-background-50 border border-background-200">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <i className="ri-shield-check-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Aucune demande annulée</p>
            <p className="text-[11px] text-foreground-500 mt-0.5 leading-relaxed">
              Vous n'avez jamais programmé puis annulé la fermeture de votre compte. Si cela change, chaque
              demande annulée apparaîtra ici avec sa date et son motif.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {demandes.map((d) => {
            const style = styleMotif(d.motif_annulation);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 p-3.5 rounded-md bg-background-50 border border-background-200"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${style.classe}`}
                    >
                      <i className={style.icone}></i>
                      {d.statut === "supprimee" ? "Compte supprimé" : "Demande annulée"}
                    </span>
                    <p className="text-xs font-semibold text-foreground-900">
                      {libelleMotifAnnulation(d.motif_annulation)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-foreground-600">
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      Demande du <strong className="font-semibold text-foreground-900">{formaterDateFr(d.demandee_le)}</strong>
                    </span>
                    {d.annulee_le && (
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-arrow-go-back-line"></i>
                        Annulée le <strong className="font-semibold text-foreground-900">{formaterDateFr(d.annulee_le)}</strong>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-calendar-event-line"></i>
                      Suppression qui était prévue le {formaterDateFr(d.prevue_le)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          Chaque annulation vous est aussi confirmée par email. Ces messages et cet historique constituent vos
          preuves en cas de contestation.
        </span>
      </p>
    </section>
  );
}