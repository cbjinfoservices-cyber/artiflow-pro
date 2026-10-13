import Modal from "@/pages/app/components/Modal";

/** Une relance qui a échoué lors d'une re-tentative, avec sa cause. */
export interface RetryEchecItem {
  nom: string;
  motif: string;
  clientId: number;
}

/** Récapitulatif d'une re-tentative groupée : réussies et relances encore en échec. */
export interface RetryRecap {
  reussies: string[];
  echecs: RetryEchecItem[];
}

/** Le motif d'échec indique-t-il un client sans adresse email (cause à corriger dans la fiche) ? */
function motifSansEmail(motif: string): boolean {
  return /adresse email/i.test(motif) || /sans email/i.test(motif);
}

/**
 * Fenêtre de récapitulatif affichée à la fin d'une re-tentative groupée des relances en échec :
 * elle montre combien d'envois sont repartis, lesquels restent en échec et pourquoi, et propose
 * d'ouvrir directement la fiche du client concerné pour corriger la cause (ex. email manquant).
 */
export default function RetryRecapModal({
  recap,
  onClose,
  onEditClient,
}: {
  recap: RetryRecap;
  onClose: () => void;
  /** Ouvre la fiche du client pour corriger la cause d'un échec (ex. ajouter l'email). */
  onEditClient: (clientId: number) => void;
}) {
  const { reussies, echecs } = recap;

  return (
    <Modal
      title="Re-tentative terminée"
      subtitle="Voici le résultat de l'envoi groupé des relances en échec."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
        >
          Fermer
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Récap chiffré */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-accent-50 border border-accent-200">
            <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              Réussies
            </p>
            <p className="mt-0.5 font-heading font-bold text-2xl text-foreground-950">{reussies.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              Encore en échec
            </p>
            <p className="mt-0.5 font-heading font-bold text-2xl text-foreground-950">{echecs.length}</p>
          </div>
        </div>

        {reussies.length === 0 && echecs.length === 0 ? (
          <p className="p-6 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucune relance n'était à re-tenter.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Envois repartis */}
            {reussies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
                  Relances envoyées maintenant
                </p>
                <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {reussies.map((nom, i) => (
                    <li
                      key={`${nom}-${i}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-md bg-transparent border border-background-200"
                    >
                      <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-[11px] font-semibold">
                        {nom.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-foreground-900 truncate">{nom}</span>
                      <i className="ri-mail-check-line text-accent-600 ml-auto shrink-0"></i>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Échecs restants, avec leur cause et l'accès direct à la fiche client */}
            {echecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                  Clients toujours en échec
                </p>
                <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {echecs.map((e, i) => {
                    const sansEmail = motifSansEmail(e.motif);
                    return (
                      <li
                        key={`${e.clientId}-${i}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 rounded-md bg-red-50 border border-red-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                            {e.nom.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground-950 truncate">{e.nom}</p>
                            <p className="text-[11px] text-red-700 flex items-center gap-1" title={e.motif}>
                              <i className={sansEmail ? "ri-mail-close-line shrink-0" : "ri-information-line shrink-0"}></i>
                              <span className="truncate">{e.motif}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditClient(e.clientId)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors shrink-0"
                        >
                          <i className={sansEmail ? "ri-mail-add-line" : "ri-edit-line"}></i>
                          {sansEmail ? "Ajouter l'email" : "Modifier la fiche"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-foreground-500 leading-relaxed">
          Astuce : corrigez la cause d'un échec (le plus souvent une adresse email manquante) directement depuis la
          fiche du client, puis relancez la re-tentative.
        </p>
      </div>
    </Modal>
  );
}