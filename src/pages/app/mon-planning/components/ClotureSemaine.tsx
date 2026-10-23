import { useState } from "react";
import Modal from "@/pages/app/components/Modal";

/**
 * Bloc « Clôturer la semaine » de la page « Mon planning ».
 *
 * Permet de solder d'un seul geste toutes les interventions encore ouvertes de la
 * semaine affichée : elles passent en « faite ». Un petit bilan est ensuite envoyé
 * par email au responsable (nombre d'interventions faites / restantes).
 *
 * Deux contextes d'usage :
 * - « soi » : l'intervenant clôture sa propre semaine ;
 * - « tiers » : le responsable clôture la semaine de l'intervenant qu'il consulte.
 *
 * Le bouton disparaît quand la semaine est déjà entièrement soldée.
 */
export default function ClotureSemaine({
  nbTotal,
  nbRestantes,
  busy,
  error,
  okMessage,
  onConfirmer,
  mode = "soi",
}: {
  /** Nombre d'interventions de la semaine affichée. */
  nbTotal: number;
  /** Nombre d'interventions encore non terminées. */
  nbRestantes: number;
  /** Opération de clôture en cours. */
  busy: boolean;
  /** Message d'erreur éventuel. */
  error: string | null;
  /** Message de confirmation après une clôture réussie. */
  okMessage: string | null;
  /** Déclenche la clôture : marque les restantes comme faites et envoie le bilan. */
  onConfirmer: () => void;
  /** Contexte d'affichage : sa propre semaine, ou celle d'un intervenant consulté. */
  mode?: "soi" | "tiers";
}) {
  const [open, setOpen] = useState(false);

  if (nbTotal === 0) return null;

  const toutFait = nbRestantes === 0;
  const dejaTerminee = nbTotal - nbRestantes;
  const pourSoi = mode === "soi";

  return (
    <>
      <div className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full ${toutFait ? "bg-secondary-100 text-secondary-800" : "bg-primary-100 text-primary-700"}`}>
            <i className={toutFait ? "ri-check-double-line text-lg" : "ri-flag-2-line text-lg"}></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">
              {toutFait ? "Semaine clôturée" : pourSoi ? "Clôturer ma semaine" : "Clôturer la semaine"}
            </p>
            <p className="text-[11px] text-foreground-500">
              {toutFait
                ? pourSoi
                  ? "Toutes vos interventions de la semaine sont marquées comme faites."
                  : "Toutes ses interventions de la semaine sont marquées comme faites."
                : `${nbRestantes} intervention${nbRestantes > 1 ? "s" : ""} encore ouverte${nbRestantes > 1 ? "s" : ""} · ${dejaTerminee} déjà faite${dejaTerminee > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {!toutFait && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={busy}
            className="self-start sm:self-auto inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            <i className="ri-flag-2-line"></i>
            {pourSoi ? "Clôturer ma semaine" : "Clôturer sa semaine"}
          </button>
        )}
      </div>

      {(error || okMessage) && (
        <p className={`text-xs inline-flex items-center gap-1.5 ${error ? "text-red-600" : "text-secondary-700"}`}>
          <i className={error ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
          {error ?? okMessage}
        </p>
      )}

      {open && (
        <Modal title="Clôturer la semaine ?" onClose={() => setOpen(false)}>
          <p className="text-sm text-foreground-600">
            Les <strong className="text-foreground-900">{nbRestantes} intervention{nbRestantes > 1 ? "s" : ""}</strong> encore
            ouverte{nbRestantes > 1 ? "s" : ""} de cette semaine{" "}
            {pourSoi ? (
              "de votre planning"
            ) : (
              "de cet intervenant"
            )}{" "}
            seront marquées comme <strong className="text-foreground-900">faites</strong>.{" "}
            {pourSoi
              ? "Un petit bilan sera envoyé par email à votre responsable."
              : "Un petit bilan récapitulatif vous sera envoyé par email."}
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirmer();
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-double-line"></i>}
              Tout marquer comme fait
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}