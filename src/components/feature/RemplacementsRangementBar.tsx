import { useEffect, useState } from "react";
import {
  ajouterReinitialisationHistorique,
  copierTextePressePapiers,
  libelleTriEpingles,
  lireHistoriqueReinitialisations,
  texteRangementEpingles,
  viderHistoriqueReinitialisations,
  REMPLACEMENTS_REINITIALISATIONS_EVENT,
  type ReinitialisationEpinglesEntry,
  type TriEpinglesMode,
} from "@/lib/remplacementsSurveillance";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import Toast from "@/components/base/Toast";
import Modal from "@/pages/app/components/Modal";

/** Horodatage lisible d'une entrée d'historique (« 12 oct. 2026 à 08:00 »). */
function horodatageLabel(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/**
 * Bandeau d'actions du rangement des mois épinglés, partagé par la vue « Remplacements » de
 * l'Espace comptable et le raccourci du tableau de bord :
 * - « Copier le rangement » : copie en presse-papiers le libellé du mode de rangement suivi de la
 *   liste priorisée des mois épinglés (1. Octobre 2026, 2. ...), pour la partager ou l'archiver ;
 * - « Réinitialiser la priorité » : bouton (avec confirmation) qui restaure l'ordre d'épinglage
 *   d'origine, et mémorise chaque réinitialisation dans un petit historique (date + nombre de mois) ;
 * - un menu « Historique » listant ces réinitialisations pour tracer les changements d'ordre de
 *   surveillance, avec un bouton pour le vider.
 */
export default function RemplacementsRangementBar({
  moisEpinglesTries,
  triEpingles,
  nbMoisEpingles,
  onResetPriorite,
  size = "md",
}: {
  /** Mois épinglés dans l'ordre affiché (priorité manuelle ou chronologique). */
  moisEpinglesTries: string[];
  /** Mode de rangement courant, repris en tête du texte copié. */
  triEpingles: TriEpinglesMode;
  /** Nombre de mois épinglés concernés au moment d'une réinitialisation. */
  nbMoisEpingles: number;
  /** Applique la réinitialisation de priorité (côté vue). */
  onResetPriorite: () => void;
  /** Hauteur des boutons : « sm » (comptabilité) ou « md » (tableau de bord). */
  size?: "sm" | "md";
}) {
  // Confirmation avant de réinitialiser (évite d'effacer un ordre manuel long par erreur).
  const [resetOuvert, setResetOuvert] = useState(false);
  // Menu de l'historique des réinitialisations, ouvert ou non.
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  // Historique mémorisé des réinitialisations (date + nombre de mois concernés).
  const [historique, setHistorique] = useState<ReinitialisationEpinglesEntry[]>(() =>
    lireHistoriqueReinitialisations(),
  );
  // Petit message de retour (copie effectuée, réinitialisation faite, etc.).
  const [toast, setToast] = useState<string | null>(null);

  // Suit l'historique des réinitialisations s'il change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setHistorique(lireHistoriqueReinitialisations());
    window.addEventListener(REMPLACEMENTS_REINITIALISATIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_REINITIALISATIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const hauteur = size === "sm" ? "h-8" : "h-9";

  // Copie en presse-papiers le mode de rangement + la liste priorisée des mois épinglés.
  const handleCopier = async () => {
    const texte = texteRangementEpingles(moisEpinglesTries, triEpingles);
    const ok = await copierTextePressePapiers(texte);
    setToast(ok ? "Rangement copié dans le presse-papiers" : "Copie indisponible dans ce navigateur");
  };

  // Exporte l'historique des réinitialisations en CSV (date + mode de rangement + nombre de mois
  // concernés), pour garder une trace des changements d'ordre de surveillance hors application.
  // Le mode mémorisé à chaque reset permet de tracer rétroactivement le tri appliqué à chaque fois.
  const handleExportHistoriqueCsv = () => {
    if (historique.length === 0) return;
    const headers = ["Date", "Mode de rangement", "Nombre de mois"];
    const rows: (string | number)[][] = historique.map((entree) => [
      horodatageLabel(entree.date),
      entree.mode ? libelleTriEpingles(entree.mode) : "Non tracé",
      entree.nbMois,
    ]);
    downloadCsv(
      `remplacements-reinitialisations-${todayISO()}.csv`,
      `Historique des réinitialisations de priorité\r\n${toCsv(headers, rows)}`,
    );
    setHistoriqueOuvert(false);
    setToast("Historique exporté en CSV");
  };

  // Réinitialise la priorité côté vue, puis trace l'opération dans l'historique (avec le mode de
  // rangement en vigueur, pour pouvoir retracer le tri de chaque reset dans l'export CSV).
  const handleConfirmerReset = () => {
    onResetPriorite();
    ajouterReinitialisationHistorique(nbMoisEpingles, triEpingles);
    setHistorique(lireHistoriqueReinitialisations());
    setResetOuvert(false);
    setToast("Priorité de surveillance réinitialisée");
  };

  return (
    <>
      {/* Copie en presse-papiers le libellé du mode + la liste priorisée des mois épinglés. */}
      <button
        type="button"
        onClick={handleCopier}
        title="Copier le mode de rangement et la liste priorisée des mois épinglés dans le presse-papiers"
        className={`inline-flex items-center gap-1.5 ${hauteur} px-3 rounded-md bg-background-50 border border-secondary-200 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors`}
      >
        <i className="ri-clipboard-line"></i>
        Copier le rangement
      </button>

      {nbMoisEpingles > 1 && (
        <button
          type="button"
          onClick={() => setResetOuvert(true)}
          title="Réinitialiser l'ordre manuel des mois épinglés à leur ordre d'épinglage d'origine (du plus récent au plus ancien)"
          className={`inline-flex items-center gap-1.5 ${hauteur} px-3 rounded-md bg-background-50 border border-secondary-200 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors`}
        >
          <i className="ri-restart-line"></i>
          Réinitialiser la priorité
        </button>
      )}

      {historique.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setHistoriqueOuvert((v) => !v)}
            aria-expanded={historiqueOuvert}
            title="Historique des réinitialisations de priorité (date + nombre de mois concernés)"
            className={`inline-flex items-center gap-1.5 ${hauteur} px-3 rounded-md bg-background-50 border border-secondary-200 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors`}
          >
            <i className="ri-history-line"></i>
            Historique
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-bold">
              {historique.length}
            </span>
            <i className={historiqueOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
          </button>
          {historiqueOuvert && (
            <>
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setHistoriqueOuvert(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-80 p-2 rounded-md bg-foreground-950 text-background-50 border border-foreground-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-background-50/60">
                  Historique des réinitialisations
                </p>
                <p className="mt-0.5 text-[10px] text-background-50/50 italic">
                  Trace des changements d'ordre de surveillance des mois épinglés.
                </p>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {historique.map((entree, idx) => (
                    <li
                      key={`${entree.date}-${idx}`}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-background-50/10 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold min-w-0">
                        <i className="ri-restart-line text-background-50/60"></i>
                        <span className="truncate">{horodatageLabel(entree.date)}</span>
                        {entree.mode && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-background-50/10 uppercase tracking-wide font-bold whitespace-nowrap">
                            {entree.mode === "chrono" ? "chrono" : "priorité"}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-background-50/15 font-bold whitespace-nowrap">
                        {entree.nbMois} mois
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopier}
                    title="Copier le mode de rangement et la liste priorisée des mois épinglés dans le presse-papiers"
                    className="w-full inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                  >
                    <i className="ri-clipboard-line"></i>
                    Copier le rangement
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportHistoriqueCsv}
                      title="Exporter l'historique des réinitialisations en CSV (date + nombre de mois concernés)"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                    >
                      <i className="ri-file-text-line"></i>
                      Exporter en CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        viderHistoriqueReinitialisations();
                        setHistorique([]);
                        setHistoriqueOuvert(false);
                      }}
                      title="Vider l'historique des réinitialisations"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                    >
                      <i className="ri-delete-bin-line"></i>
                      Vider l'historique
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {resetOuvert && (
        <Modal
          title="Réinitialiser la priorité ?"
          subtitle="L'ordre manuel de surveillance des mois épinglés sera remplacé par l'ordre d'épinglage d'origine."
          onClose={() => setResetOuvert(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setResetOuvert(false)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-foreground-300 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerReset}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
              >
                <i className="ri-restart-line"></i>
                Réinitialiser
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700">
            Vos réordonnancements manuels (flèches de priorité et glisser-déposer) vont être effacés. Les{" "}
            <strong className="text-foreground-900">{nbMoisEpingles} mois épinglés</strong> repasseront dans leur ordre
            d'épinglage d'origine, du plus récemment épinglé au plus ancien. Aucun mois ne sera détaché. Cette
            réinitialisation sera tracée dans l'historique.
          </p>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} icon="ri-clipboard-line" />}
    </>
  );
}