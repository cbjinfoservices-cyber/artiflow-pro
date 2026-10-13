import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { articles, readingMinutes } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { isFavori, listerNotesLibres, togglerFavori, toutEffacerBibliotheque } from "@/lib/bibliotheque";
import { useBibliothequeVersion, useCompteurNotesTotal } from "@/hooks/useBibliotheque";
import { useLectureStatut } from "@/hooks/useLectureStatut";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import NoteLibreChip from "@/pages/ressources/components/NoteLibreChip";

/**
 * Bandeau « Ma bibliothèque » : rassemble les guides mis en signet et rappelle
 * le nombre de notes personnelles. Offre un bouton « Tout effacer » pour
 * réinitialiser d'un coup favoris et notes. Se masque quand tout est vide.
 */
export default function FavorisBandeau() {
  const version = useBibliothequeVersion();
  const nbNotes = useCompteurNotesTotal();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const favoris = useMemo(
    () => articles.filter((article) => isFavori(article.slug)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const notesLibres = useMemo(
    () => listerNotesLibres(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  if (favoris.length === 0 && nbNotes === 0) return null;

  const effacerTout = () => {
    toutEffacerBibliotheque();
    setConfirmOpen(false);
    setToast("Favoris et notes effacés.");
  };

  return (
    <section className="w-full bg-background-50 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-lg">
              <i className="ri-bookmark-3-fill"></i>
            </span>
            <div>
              <h2 className="font-heading font-semibold text-lg text-foreground-950">Ma bibliothèque</h2>
              <p className="text-sm text-foreground-600">
                {favoris.length} favori{favoris.length > 1 ? "s" : ""} · {nbNotes} note
                {nbNotes > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Link
              to="/ressources/bibliotheque"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
            >
              <i className="ri-book-marked-line"></i>
              Ouvrir ma bibliothèque
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-background-200 bg-background-50 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-foreground-950 transition-colors"
            >
              <i className="ri-delete-bin-6-line"></i>
              Tout effacer
            </button>
          </div>
        </div>

        {favoris.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoris.map((article) => (
              <FavoriItem key={article.slug} slug={article.slug} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground-600">
            Aucun favori pour l'instant — vos {nbNotes} note{nbNotes > 1 ? "s" : ""} restent
            enregistrées et exportables via le bouton « Exporter ».
          </p>
        )}

        {notesLibres.length > 0 && (
          <div className="mt-5 pt-5 border-t border-background-200">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-base">
                <i className="ri-sticky-note-line"></i>
              </span>
              <h3 className="font-heading font-semibold text-sm text-foreground-950">Notes libres</h3>
              <span
                title={`${notesLibres.length} note${notesLibres.length > 1 ? "s" : ""} libre${notesLibres.length > 1 ? "s" : ""}`}
                aria-label={`${notesLibres.length} note${notesLibres.length > 1 ? "s" : ""} libre${notesLibres.length > 1 ? "s" : ""} au total`}
                className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-secondary-500 text-background-50 text-xs font-bold tabular-nums"
              >
                {notesLibres.length}
              </span>
              <span className="text-xs text-foreground-500">
                note{notesLibres.length > 1 ? "s" : ""} libre{notesLibres.length > 1 ? "s" : ""} sans guide
              </span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {notesLibres.map((note) => (
                <li key={note.id} className="max-w-full">
                  <NoteLibreChip id={note.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmOpen && (
        <Modal
          title="Tout effacer ?"
          subtitle="Favoris et notes personnelles"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={effacerTout}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-foreground-950 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-foreground-800 transition-colors"
              >
                <i className="ri-delete-bin-6-line"></i>
                Oui, tout effacer
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700 leading-relaxed">
            Vous allez supprimer <strong className="font-semibold">{favoris.length}</strong> favori
            {favoris.length > 1 ? "s" : ""} et <strong className="font-semibold">{nbNotes}</strong> note
            {nbNotes > 1 ? "s" : ""} personnelle{nbNotes > 1 ? "s" : ""}. Cette action est définitive et ne
            concerne que votre navigateur.
          </p>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} icon="ri-delete-bin-6-line" />}
    </section>
  );
}

function FavoriItem({ slug }: { slug: string }) {
  const article = articles.find((a) => a.slug === slug);
  const metier = metiers.find((m) => m.slug === article?.category);
  const statut = useLectureStatut(slug);
  if (!article) return null;

  return (
    <li className="flex items-center gap-3 p-3.5 rounded-lg border border-background-200 bg-background-100">
      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-base">
        <i className="ri-bookmark-3-fill"></i>
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/ressources/${article.slug}`}
          className="block font-heading font-semibold text-sm text-foreground-950 hover:text-primary-700 leading-snug truncate cursor-pointer"
        >
          {article.title}
        </Link>
        <span className="text-xs text-foreground-500">
          {metier ? metier.name : "Artisan"} · {readingMinutes(article)} min
          {statut === "lu" ? " · lu" : statut === "en-cours" ? " · en cours" : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={() => togglerFavori(article.slug)}
        aria-label={`Retirer « ${article.title} » des favoris`}
        title="Retirer des favoris"
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md border border-background-200 text-foreground-600 hover:border-accent-300 hover:text-accent-700 hover:bg-accent-50 cursor-pointer transition-colors"
      >
        <i className="ri-bookmark-3-line"></i>
      </button>
    </li>
  );
}