import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { previsualiserRecapChantiers } from "@/lib/suiviChantier";

interface Props {
  /** Identifiant du profil connecté : l'aperçu reprend ses vrais chantiers et ses couleurs. */
  userId: string;
  /** Envoi réel depuis l'aperçu (une fois le rendu validé). */
  onEnvoyer: () => Promise<void>;
  /** Vrai pendant l'envoi réel déclenché depuis la fenêtre. */
  envoiEnCours: boolean;
  onClose: () => void;
}

/**
 * Aperçu du récap hebdomadaire des chantiers : demande à la fonction Backend le rendu
 * exact de l'email (mode « preview », aucun envoi) puis l'affiche dans un cadre isolé.
 * On peut ensuite envoyer pour de vrai depuis cette fenêtre, une fois le rendu validé.
 */
export default function ApercuRecapChantiersModal({ userId, onEnvoyer, envoiEnCours, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");
  const [cc, setCc] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rendu = await previsualiserRecapChantiers(userId);
      setHtml(rendu.html);
      setSujet(rendu.sujet);
      setCc(rendu.cc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <Modal
      title="Aperçu de l'email de récap"
      subtitle="Voici exactement ce que vous recevrez. Rien n'est envoyé tant que vous ne cliquez pas sur « Envoyer maintenant »."
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={charger}
            disabled={loading || envoiEnCours}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-refresh-line"></i>
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => void onEnvoyer()}
            disabled={loading || Boolean(error) || envoiEnCours}
            className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={envoiEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            Envoyer maintenant
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
          <i className="ri-mail-line text-accent-600"></i>
          <span className="text-xs text-foreground-500 whitespace-nowrap">Objet :</span>
          <span className="text-xs font-semibold text-foreground-900 truncate">{sujet || "Chargement…"}</span>
          {cc ? (
            <span
              className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold whitespace-nowrap"
              title="Une copie de ce récap partira aussi à cette adresse"
            >
              <i className="ri-mail-add-line"></i>
              Copie à {cc}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-eye-line"></i>
            Aperçu, aucun envoi
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
            title="Aperçu de l'email de récap des chantiers"
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