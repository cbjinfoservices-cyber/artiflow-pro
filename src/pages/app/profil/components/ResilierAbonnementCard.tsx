import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { resilierAbonnement, type RemboursementProrata } from "@/lib/compte";
import type { MonAbonnement } from "@/hooks/useMonAbonnement";

/** Formate un montant renvoyé par le Backend (déjà en euros, pas en centimes). */
function montantLisible(remboursement: RemboursementProrata): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: remboursement.devise || "EUR",
    }).format(remboursement.montant);
  } catch {
    return `${remboursement.montant.toFixed(2)} €`;
  }
}

/**
 * Encart « Résilier mon abonnement » de l'onglet Abonnement.
 *
 * La résiliation est immédiate : l'accès à l'espace se ferme tout de suite et la
 * période déjà payée mais non consommée est remboursée au prorata. Les données
 * (devis, factures, clients) sont conservées, seul le compte reste intact.
 */
export default function ResilierAbonnementCard({
  abonnement,
  onResilie,
}: {
  abonnement: MonAbonnement;
  /** Recharge l'abonnement après une résiliation réussie. */
  onResilie: () => void | Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resultat, setResultat] = useState<RemboursementProrata | null>(null);

  const confirmer = async () => {
    setEtat("loading");
    setMessage("");
    try {
      const res = await resilierAbonnement();
      setResultat(res.remboursement);
      setMessage(res.message);
      setEtat("ok");
      await onResilie();
    } catch (e) {
      setEtat("error");
      setMessage(e instanceof Error ? e.message : "La résiliation n'a pas pu être effectuée.");
    }
  };

  const fermer = () => {
    if (etat === "loading") return;
    setOuvert(false);
    if (etat === "ok") {
      setEtat("idle");
      setMessage("");
    }
  };

  return (
    <>
      <section className="flex flex-col gap-3 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-200 text-foreground-600">
              <i className="ri-close-circle-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-900">Résilier mon abonnement</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                Arrêt immédiat, avec remboursement au prorata de la période non utilisée. Vos devis et factures sont
                conservés.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEtat("idle");
              setMessage("");
              setResultat(null);
              setOuvert(true);
            }}
            disabled={etat === "ok"}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          >
            <i className="ri-logout-box-r-line"></i>
            Résilier mon abonnement
          </button>
        </div>

        {etat === "ok" && message ? (
          <div className="flex items-start gap-3 p-3 rounded-md bg-accent-100 border border-accent-300">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
              <i className="ri-check-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">Abonnement résilié</p>
              <p className="text-xs text-foreground-600 mt-0.5">{message}</p>
              {resultat ? (
                <p className="text-[11px] text-foreground-500 mt-1.5 inline-flex items-center gap-1.5">
                  <i className="ri-refund-2-line"></i>
                  {resultat.effectue ? "Remboursement déclenché" : "Remboursement en cours de traitement"} ·{" "}
                  {montantLisible(resultat)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {abonnement.statut === "Impayé" ? (
          <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            Votre dernier paiement est en échec : la résiliation met fin à toute nouvelle tentative de prélèvement.
          </p>
        ) : null}
      </section>

      {ouvert ? (
        <Modal
          title="Résilier mon abonnement ?"
          subtitle={`ArtiFlow-pro ${abonnement.offre}`}
          onClose={fermer}
          footer={
            <>
              <button
                type="button"
                onClick={fermer}
                disabled={etat === "loading"}
                className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
              >
                Garder mon abonnement
              </button>
              <button
                type="button"
                onClick={() => { void confirmer(); }}
                disabled={etat === "loading" || etat === "ok"}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {etat === "loading" ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Résiliation…
                  </>
                ) : (
                  <>
                    <i className="ri-check-line"></i>
                    Confirmer la résiliation
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-background-100 border border-background-200">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                <i className="ri-flashlight-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-900">Arrêt immédiat de l'accès</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  Votre espace (devis, factures, relances, planning) se ferme dès la confirmation. Vous pourrez
                  reprendre une offre plus tard et retrouver vos données intactes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-background-100 border border-background-200">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <i className="ri-refund-2-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-900">Remboursement au prorata</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  La période déjà payée mais non utilisée vous est remboursée sur le moyen de paiement d'origine.
                  Le montant est calculé au jour près, au moment de la confirmation. Comptez 5 à 10 jours ouvrés
                  pour le voir apparaître.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-background-100 border border-background-200">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                <i className="ri-folder-shield-2-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-900">Vos données restent conservées</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  Résilier ne supprime rien. Si vous souhaitez aussi effacer définitivement votre compte, cela se
                  fait dans l'onglet <strong className="font-medium text-foreground-700">Sécurité</strong>.
                </p>
              </div>
            </div>

            {etat === "error" ? (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{message}</span>
              </p>
            ) : null}

            {etat === "ok" ? (
              <p className="text-xs text-accent-800 bg-accent-100 border border-accent-300 rounded-md px-3 py-2 flex items-start gap-2">
                <i className="ri-checkbox-circle-line mt-0.5"></i>
                <span>{message}</span>
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}