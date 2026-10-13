import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { chargerApercuEnvoiAuto, type ApercuEnvoiEmail } from "@/lib/envoisAutomatiquesActions";

interface Props {
  /** Identifiant de l'automatisation dont on veut l'aperçu. */
  itemId: string;
  /** Nom affiché de l'automatisation (titre du modal). */
  nom: string;
  /** Identifiant du profil connecté (certains aperçus reprennent son contenu). */
  userId: string;
  onClose: () => void;
}

/**
 * Aperçu de l'email d'une automatisation d'envoi : appelle la fonction Backend en mode
 * « aperçu » (aucun envoi réel) et affiche le rendu exact dans un cadre isolé.
 */
export default function ApercuEnvoiModal({ itemId, nom, userId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apercu, setApercu] = useState<ApercuEnvoiEmail | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApercu(await chargerApercuEnvoiAuto(itemId, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [itemId, userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <Modal
      title={`Aperçu · ${nom}`}
      subtitle="Voici l'email tel qu'il sera envoyé (aucun envoi réel n'est effectué)."
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={charger}
            disabled={loading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-refresh-line"></i>
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            Fermer
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
          <i className="ri-mail-line text-accent-600"></i>
          <span className="text-xs text-foreground-500 whitespace-nowrap">Objet :</span>
          <span className="text-xs font-semibold text-foreground-900 truncate">{apercu?.sujet ?? "—"}</span>
          {apercu?.destinataires !== undefined && (
            <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
              <i className="ri-mail-send-line"></i>
              {apercu.destinataires} destinataire{apercu.destinataires > 1 ? "s" : ""}
            </span>
          )}
        </div>

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
          <iframe
            title={`Aperçu · ${nom}`}
            className="w-full rounded-lg border border-background-200 bg-background-50"
            style={{ height: "460px" }}
            srcDoc={apercu?.html ?? ""}
            sandbox=""
          />
        )}
      </div>
    </Modal>
  );
}