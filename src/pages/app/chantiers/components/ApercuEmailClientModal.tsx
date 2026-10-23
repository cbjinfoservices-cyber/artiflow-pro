import { useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { fetchEmailClientArchive, type DernierEmailClient } from "@/lib/suiviChantier";

function formatDateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Aperçu du dernier email réellement parti au client pour un chantier.
 * Le contenu affiché est celui qui a été envoyé, tel quel (archivé au moment de l'envoi).
 */
export default function ApercuEmailClientModal({
  chantierLibelle,
  email,
  onClose,
}: {
  chantierLibelle: string;
  email: DernierEmailClient;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [sujet, setSujet] = useState<string | null>(email.sujet);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      setLoading(true);
      setErreur(null);
      try {
        const archive = await fetchEmailClientArchive(email.id);
        if (!actif) return;
        if (!archive) {
          setErreur("Cet envoi n'est plus disponible dans le journal.");
          return;
        }
        setHtml(archive.html);
        setSujet(archive.sujet ?? email.sujet);
      } catch {
        if (actif) setErreur("Le contenu de cet email n'a pas pu être chargé.");
      } finally {
        if (actif) setLoading(false);
      }
    };
    void charger();
    return () => {
      actif = false;
    };
  }, [email.id, email.sujet]);

  return (
    <Modal
      title="Dernier email envoyé au client"
      subtitle={chantierLibelle}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
            <i className="ri-archive-line"></i>
            Copie exacte de l'email expédié — aucun nouvel envoi.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            Fermer
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-background-100 border border-background-200">
          <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 flex-wrap">
            <i className="ri-mail-send-line text-accent-600"></i>
            Envoyé à <span className="font-semibold text-foreground-800">{email.destinataire || "adresse inconnue"}</span>
            <span className="text-foreground-400">·</span>
            <span>{formatDateHeure(email.created_at)}</span>
          </p>
          <p className="text-xs text-foreground-800 break-words">
            <span className="text-foreground-500">Objet : </span>
            <span className="font-semibold">{sujet || "Suivi de votre chantier"}</span>
          </p>
          {email.motif ? (
            <p className="text-[11px] text-foreground-500 break-words">
              <span>Message transmis : </span>
              <span className="text-foreground-700">{email.motif}</span>
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-2xl"></i>
            <span className="text-sm">Chargement de l'email envoyé…</span>
          </div>
        ) : erreur ? (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <i className="ri-error-warning-line mt-px"></i>
            <span>{erreur}</span>
          </div>
        ) : html ? (
          <iframe
            title={`Email envoyé au client — ${chantierLibelle}`}
            className="w-full rounded-lg border border-background-200 bg-background-50"
            style={{ height: "480px" }}
            srcDoc={html}
            sandbox=""
          />
        ) : (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-secondary-50 border border-secondary-100 text-sm text-secondary-900">
            <i className="ri-information-line mt-px"></i>
            <div className="flex flex-col gap-1">
              <span>Le contenu de cet email n'a pas été conservé.</span>
              <span className="text-[11px] text-secondary-800">
                Il a été envoyé avant la mise en place de l'archive. Les prochains envois s'afficheront ici
                intégralement.
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}