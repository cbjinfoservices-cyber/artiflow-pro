import { useEffect, useRef, useState } from "react";
import type { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { savePdf } from "@/lib/pdf";
import Modal from "@/pages/app/components/Modal";
import { telechargerUrl } from "@/lib/telechargement";

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
// La WebView de l'application mobile n'affiche pas les PDF dans une iframe : on propose
// d'ouvrir le document avec la visionneuse du téléphone (feuille de partage).
const APERCU_INTEGRE = !Capacitor.isNativePlatform();

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
    telechargerUrl(filename, url);
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
            <i className={APERCU_INTEGRE ? "ri-file-download-line" : "ri-share-forward-line"}></i>
            {APERCU_INTEGRE ? "Télécharger le PDF" : "Ouvrir ou partager le PDF"}
          </button>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 overflow-hidden bg-background-100">
        {loading ? (
          <div className={`flex flex-col items-center justify-center gap-2 text-foreground-500 ${APERCU_INTEGRE ? "h-[70vh] min-h-[520px]" : "py-12"}`}>
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
        ) : APERCU_INTEGRE ? (
          <iframe src={url ?? ""} title={title} className="w-full h-[70vh] min-h-[520px]" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
            <span className="w-12 h-12 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <i className="ri-file-pdf-2-line text-xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-900">Document prêt</p>
            <p className="text-xs text-foreground-500">
              Touchez « Ouvrir ou partager le PDF » pour l'afficher avec la visionneuse du téléphone, l'envoyer ou
              l'enregistrer.
            </p>
          </div>
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