import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { apercuRappelConges, envoyerRappelConges, type ApercuRappelConges } from "@/lib/rappelCongesApi";

/**
 * Aperçu du rappel hebdomadaire des congés, puis envoi réel si le responsable le décide.
 * L'aperçu est produit par le Backend lui-même : ce que l'on voit est exactement
 * l'email qui partira, avec les données réelles de la semaine prochaine.
 */
export default function ApercuRappelCongesModal({
  userId,
  onClose,
}: {
  /** Profil connecté : c'est lui qui recevra le rappel de test. */
  userId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apercu, setApercu] = useState<ApercuRappelConges | null>(null);
  const [envoiBusy, setEnvoiBusy] = useState(false);
  const [envoiInfo, setEnvoiInfo] = useState<string | null>(null);
  const [envoiErreur, setEnvoiErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!userId) {
      setError("Connectez-vous pour prévisualiser le rappel.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setApercu(await apercuRappelConges(userId));
    } catch (e) {
      setApercu(null);
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = async () => {
    setEnvoiBusy(true);
    setEnvoiErreur(null);
    setEnvoiInfo(null);
    try {
      const resultat = await envoyerRappelConges(userId);
      if (resultat.envoye) setEnvoiInfo(resultat.message);
      else setEnvoiErreur(resultat.message);
    } catch (e) {
      setEnvoiErreur(e instanceof Error ? e.message : "L'envoi a échoué.");
    } finally {
      setEnvoiBusy(false);
    }
  };

  const aucuneAbsence = (apercu?.conges ?? 0) === 0;

  return (
    <Modal
      title="Aperçu du rappel hebdomadaire des congés"
      subtitle="Voici l'email réel que le responsable recevra lundi matin. Rien n'est envoyé tant que vous ne validez pas."
      onClose={onClose}
      taille="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={charger}
            disabled={loading || envoiBusy}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-refresh-line"></i>
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={() => void envoyer()}
            disabled={loading || envoiBusy || aucuneAbsence}
            title={
              aucuneAbsence
                ? "Aucune absence ne démarre la semaine prochaine : il n'y a rien à envoyer."
                : "Envoyer ce rappel tout de suite au responsable"
            }
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={envoiBusy ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            Envoyer maintenant
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
          <i className="ri-mail-line text-accent-600"></i>
          <span className="text-xs text-foreground-500 whitespace-nowrap">Objet :</span>
          <span className="text-xs font-semibold text-foreground-900 truncate">
            {apercu?.subject ?? "Congés de la semaine prochaine"}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
            <i className="ri-calendar-event-line"></i>
            {apercu?.conges ?? 0} absence{(apercu?.conges ?? 0) > 1 ? "s" : ""} la semaine prochaine
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-foreground-500">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-user-line"></i>
            Destinataire : {apercu?.destinataire ?? "adresse du profil à compléter"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-time-line"></i>
            Envoi automatique : chaque lundi à 7 h
          </span>
        </div>

        {envoiInfo && (
          <div className="flex items-start gap-2 rounded-md bg-primary-100 border border-primary-200 px-3 py-2">
            <i className="ri-mail-check-line text-primary-700 mt-0.5"></i>
            <p className="flex-1 text-xs text-primary-900">{envoiInfo}</p>
          </div>
        )}
        {envoiErreur && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
            <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
            <p className="flex-1 text-xs text-red-700">{envoiErreur}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-2xl"></i>
            <span className="text-sm">Génération de l'aperçu…</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <i className="ri-error-warning-line mt-px"></i>
            <div className="flex flex-col gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={charger}
                className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-100 text-red-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors"
              >
                <i className="ri-refresh-line"></i>
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <>
            <iframe
              title="Aperçu du rappel des congés"
              className="w-full rounded-lg border border-background-200 bg-background-50"
              style={{ height: "440px" }}
              srcDoc={apercu?.html ?? ""}
              sandbox=""
            />
            {aucuneAbsence && (
              <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
                <i className="ri-information-line mt-0.5"></i>
                Aucune absence ne démarre la semaine prochaine : l'email est prêt mais il n'y a rien à signaler.
                Posez un congé à venir pour voir un rappel complet.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}