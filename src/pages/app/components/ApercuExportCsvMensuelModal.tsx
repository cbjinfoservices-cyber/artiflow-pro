import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { obtenirApercuExportCsvMensuel } from "@/lib/exportCsvMensuel";

interface Props {
  /** Identifiant du profil connecté : l'aperçu reprend son nom et ses destinataires en copie. */
  userId: string;
  onClose: () => void;
}

/**
 * Aperçu de l'email d'export CSV mensuel : appelle la fonction Backend en mode « preview »
 * (aucun envoi réel) et affiche le rendu exact de l'email dans un cadre isolé, pour vérifier
 * la mise en page et les destinataires en copie avant d'activer l'envoi.
 */
export default function ApercuExportCsvMensuelModal({ userId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await obtenirApercuExportCsvMensuel(userId);
      setHtml(res.html);
      setSujet(res.subject);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <Modal
      title="Aperçu de l'email mensuel"
      subtitle="Voici exactement l'email reçu chaque mois avec les deux CSV en pièces jointes (aucun envoi réel)."
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { void charger(); }}
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
          <span className="text-xs font-semibold text-foreground-900 truncate">{sujet || "Vos exports CSV mensuels"}</span>
          <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap">
            <i className="ri-attachment-2"></i>
            2 CSV en pièces jointes
          </span>
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
                onClick={() => { void charger(); }}
                className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-100 text-red-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors"
              >
                <i className="ri-refresh-line"></i>
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <iframe
            title="Aperçu de l'email mensuel"
            className="w-full rounded-lg border border-background-200 bg-background-50"
            style={{ height: "460px" }}
            srcDoc={html ?? ""}
            sandbox=""
          />
        )}
      </div>
    </Modal>
  );
}