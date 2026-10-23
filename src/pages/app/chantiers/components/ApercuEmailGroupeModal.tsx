import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { previsualiserNouvellesGroupees, type ApercuNouvellesGroupees } from "@/lib/suiviChantier";

/**
 * Aperçu de l'email groupé envoyé aux clients silencieux.
 * Le Backend construit exactement le même HTML que l'envoi réel (mêmes couleurs, logo,
 * message et lien de suivi), puis le renvoie sans contacter personne ni passer par Resend.
 */
export default function ApercuEmailGroupeModal({
  message,
  onClose,
}: {
  /** Message en cours de rédaction, pour apercevoir les modifications avant d'enregistrer. */
  message?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [apercu, setApercu] = useState<ApercuNouvellesGroupees | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setErreur(null);
    try {
      const res = await previsualiserNouvellesGroupees(user.id, message);
      setApercu(res);
    } catch (e) {
      setApercu(null);
      setErreur(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, message]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground-950/50"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-lg text-foreground-950">Aperçu de l&apos;email groupé</h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              Exactement ce que voit le client. Rien n&apos;est envoyé et aucune date de contact ne bouge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-2xl"></i>
            <span className="text-sm">Construction de l&apos;aperçu…</span>
          </div>
        ) : erreur ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <i className="ri-error-warning-line mt-px"></i>
              <span>{erreur}</span>
            </div>
            <button
              type="button"
              onClick={() => void charger()}
              className="self-start inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réessayer
            </button>
          </div>
        ) : apercu ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-background-100 border border-background-200">
              <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 flex-wrap">
                <i className="ri-mail-open-line text-accent-600"></i>
                Exemple pour
                <span className="font-semibold text-foreground-800">
                  {apercu.client ?? "un client"}{apercu.destinataire ? ` · ${apercu.destinataire}` : ""}
                </span>
                <span className="text-foreground-400">·</span>
                <span>
                  {apercu.chantiers} chantier{apercu.chantiers > 1 ? "s" : ""} dans l&apos;email
                </span>
              </p>
              <p className="text-xs text-foreground-800 break-words">
                <span className="text-foreground-500">Objet : </span>
                <span className="font-semibold">{apercu.sujet}</span>
              </p>
            </div>

            <iframe
              title="Aperçu de l'email groupé"
              className="w-full rounded-lg border border-background-200 bg-background-50"
              style={{ height: "520px" }}
              srcDoc={apercu.html}
              sandbox=""
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
                <i className="ri-information-line mt-px"></i>
                <span>
                  Chaque client reçoit sa propre version : son nom, ses chantiers, son avancement et son lien de
                  suivi.
                </span>
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-check-line"></i>
                Fermer l&apos;aperçu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}