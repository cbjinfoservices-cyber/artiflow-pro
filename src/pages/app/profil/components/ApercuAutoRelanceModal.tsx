import { useCallback, useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { apercuAutoRelanceEmail } from "@/lib/recontactSeuil";

interface Props {
  /** Identifiant du profil connecté : l'aperçu reprend son message d'auto-relance. */
  userId: string;
  /** Sujet en cours de saisie (brouillon), pour un aperçu fidèle avant enregistrement. */
  sujetDraft?: string;
  /** Corps en cours de saisie (brouillon), pour un aperçu fidèle avant enregistrement. */
  corpsDraft?: string;
  onClose: () => void;
}

/**
 * Aperçu de l'email d'auto-relance des oubliés : appelle la fonction Backend en mode « aperçu »
 * (aucun envoi réel) et affiche le rendu exact de l'email dans un cadre isolé. Le brouillon
 * éventuel (sujet / texte en cours de saisie) est utilisé pour que l'aperçu reflète les
 * modifications avant même leur enregistrement.
 */
export default function ApercuAutoRelanceModal({ userId, sujetDraft, corpsDraft, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apercuAutoRelanceEmail(userId, sujetDraft, corpsDraft);
      setHtml(res.html);
      setSujet(res.subject || "Votre abonnement ArtiFlow-pro — un point sur votre formule");
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'aperçu n'a pas pu être généré. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [userId, sujetDraft, corpsDraft]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <Modal
      title="Aperçu de l'email d'auto-relance"
      subtitle="Voici l'email reçu par un compte jamais relancé après un récap (aucun envoi réel n'est effectué)."
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
            Aperçu — exemple de compte
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
            title="Aperçu de l'email d'auto-relance"
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