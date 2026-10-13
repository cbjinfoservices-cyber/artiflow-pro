import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { apercuAlerteArtisanEmail } from "@/lib/recontactSeuil";

interface Props {
  /** Identifiant du profil connecté : l'aperçu reprend son objet/message d'alerte. */
  userId: string;
  /** Alerte dont on veut revoir le rendu (réutilise ses comptes) ; sans id, un exemple illustre. */
  alertId?: number;
  onClose: () => void;
}

/**
 * Aperçu de l'email d'alerte envoyé à l'artisan quand l'auto-relance des oubliés a expédié des
 * relances : appelle la fonction Backend en mode « aperçu » (aucun envoi réel) et affiche le rendu
 * exact de l'email dans un cadre isolé. Les comptes de l'alerte concernée sont repris pour que
 * l'aperçu soit fidèle ; en leur absence, des comptes d'exemple illustrent le rendu.
 */
export default function ApercuAlerteArtisanModal({ userId, alertId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apercuAlerteArtisanEmail(userId, alertId);
      setHtml(res.html);
      setSujet(res.subject || "Auto-relance : des comptes recontactés aujourd'hui");
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [userId, alertId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <Modal
      title="Aperçu de l'email d'alerte artisan"
      subtitle="Voici l'email qui vous est envoyé quand l'auto-relance des oubliés a réellement expédié des relances (aucun envoi réel n'est effectué)."
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
          <span className="text-xs font-semibold text-foreground-900 truncate">{sujet}</span>
          <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
            <i className="ri-flask-line"></i>
            Aperçu — aucun envoi
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
            title="Aperçu de l'email d'alerte artisan"
            className="w-full rounded-lg border border-background-200 bg-background-50"
            style={{ height: "440px" }}
            srcDoc={html ?? ""}
            sandbox=""
          />
        )}
      </div>
    </Modal>
  );
}