import { useEffect, useRef, useState } from "react";
import type { jsPDF } from "jspdf";
import { savePdf } from "@/lib/pdf";
import Modal from "@/pages/app/components/Modal";

/**
 * Fenêtre d'aperçu d'un PDF AVANT téléchargement.
 *
 * Deux sources possibles :
 *  — `docBuilder` : document construit sur place (devis, facture, archive locale) ;
 *  — `pdfUrl` : PDF déjà prêt (par exemple une archive renvoyée en base64 par le Backend,
 *    déjà convertie en URL blob par l'appelant).
 *
 * Dans les deux cas le document s'affiche dans une iframe, puis l'utilisateur télécharge
 * le fichier depuis l'aperçu. Rien n'est enregistré tant qu'il n'a pas cliqué.
 */
export default function ApercuPdfModal({
  title,
  subtitle,
  filename,
  docBuilder,
  pdfUrl,
  note,
  onClose,
}: {
  /** Titre de la fenêtre (ex. « Aperçu · F-2026-014 »). */
  title: string;
  /** Sous-titre explicatif sous le titre. */
  subtitle?: string;
  /** Nom du fichier proposé au téléchargement (ex. « Devis-D-2026-014.pdf »). */
  filename: string;
  /** Construit le document PDF à afficher (exécuté une seule fois à l'ouverture). */
  docBuilder?: () => Promise<jsPDF>;
  /** PDF déjà prêt à afficher (URL blob). Prend le pas sur `docBuilder`. */
  pdfUrl?: string;
  /** Petite mention informative sous l'aperçu. */
  note?: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(pdfUrl ?? null);
  const [doc, setDoc] = useState<jsPDF | null>(null);
  const [loading, setLoading] = useState(!pdfUrl);
  const [error, setError] = useState<string | null>(null);
  // Le constructeur ne doit s'exécuter qu'à l'ouverture : on le fige dans une référence.
  const builderRef = useRef(docBuilder);

  useEffect(() => {
    if (pdfUrl) {
      setUrl(pdfUrl);
      setDoc(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    const builder = builderRef.current;
    if (!builder) {
      setError("Impossible de préparer l'aperçu du document. Réessayez.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    builder()
      .then((built) => {
        if (!active) return;
        objectUrl = String(built.output("bloburl"));
        setDoc(built);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError("Impossible de préparer l'aperçu du document. Réessayez.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl]);

  const handleDownload = () => {
    if (doc) {
      savePdf(doc, filename);
      return;
    }
    if (!url) return;
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = filename;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle ?? "Vérifiez la mise en page (colonnes, libellés, totaux) avant de télécharger."}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !url}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-file-download-line"></i>
            Télécharger le PDF
          </button>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 overflow-hidden bg-background-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 h-[70vh] min-h-[520px] text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
            <p className="text-sm">Préparation de l'aperçu…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 h-[70vh] min-h-[520px] text-center px-6">
            <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
              <i className="ri-error-warning-line text-xl"></i>
            </span>
            <p className="text-sm text-foreground-600">{error}</p>
          </div>
        ) : (
          <iframe src={url ?? ""} title={title} className="w-full h-[70vh] min-h-[520px]" />
        )}
      </div>
      {note && (
        <p className="mt-3 text-[11px] text-foreground-400 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          {note}
        </p>
      )}
    </Modal>
  );
}