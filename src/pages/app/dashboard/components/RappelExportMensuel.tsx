import { useEffect, useState } from "react";
import Toast from "@/components/base/Toast";
import { STOCKAGE_LOCAL_EVENT } from "@/lib/stockageLocal";
import { useExportDonnees } from "@/hooks/useExportDonnees";
import { tailleLisible } from "@/lib/historiqueExportsDonnees";
import SauvegardeDonneesModal from "@/pages/app/components/SauvegardeDonneesModal";
import {
  joursDepuisDernierExport,
  masquerRappelExport,
  rappelExportVisible,
} from "@/lib/rappelExportMensuel";

/**
 * Rappel mensuel discret « Pensez à exporter vos données » affiché en tête du tableau de bord.
 *
 * Il n'apparaît qu'une fois par mois (et disparaît dès qu'un export est fait, y compris depuis le
 * menu du compte ou la page Préférences). Le bouton « Exporter maintenant » construit directement
 * l'archive complète (CSV + JSON) et la télécharge, et « Voir l'historique » ouvre le journal des
 * sauvegardes déjà réalisées.
 */
export default function RappelExportMensuel() {
  const [visible, setVisible] = useState<boolean>(() => rappelExportVisible());
  const [toast, setToast] = useState<string | null>(null);
  const [historiqueOpen, setHistoriqueOpen] = useState(false);
  const [jours, setJours] = useState<number | null>(() => joursDepuisDernierExport());
  const { enCours, erreur, exporter } = useExportDonnees();

  // Se resynchronise si un export est fait ailleurs (menu du compte, page Préférences) ou dans un autre onglet.
  useEffect(() => {
    const rafraichir = () => {
      setVisible(rappelExportVisible());
      setJours(joursDepuisDernierExport());
    };
    window.addEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
    window.addEventListener("storage", rafraichir);
    return () => {
      window.removeEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
      window.removeEventListener("storage", rafraichir);
    };
  }, []);

  if (!visible) return null;

  const lancerExport = async () => {
    const res = await exporter("complet");
    if (res) {
      setVisible(false);
      setJours(0);
      setToast(
        `Sauvegarde prête : ${res.nom} · ${res.tables} catégorie${res.tables > 1 ? "s" : ""} · ${res.lignes} ligne${res.lignes > 1 ? "s" : ""} · ${tailleLisible(res.taille)}`,
      );
    }
  };

  const texteDernier =
    jours === null
      ? "Vous n'avez encore jamais exporté vos données."
      : jours === 0
        ? "Vous venez de sauvegarder vos données."
        : `Dernière sauvegarde il y a ${jours} jour${jours > 1 ? "s" : ""}.`;

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 rounded-lg bg-secondary-50 border border-secondary-200">
      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
        <i className="ri-archive-drawer-line"></i>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground-950 flex items-center gap-2">
          Pensez à exporter vos données
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-700 text-[10px] font-semibold whitespace-nowrap">
            mensuel
          </span>
        </p>
        <p className="text-xs text-foreground-600 mt-0.5">{texteDernier} Une sauvegarde par mois vous protège en cas de pépin.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void lancerExport()}
          disabled={enCours}
          title="Construire et télécharger aussitôt la sauvegarde de vos données (CSV + JSON)"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={`${enCours ? "ri-loader-4-line animate-spin" : "ri-download-cloud-2-line"}`}></i>
          {enCours ? "Préparation…" : "Exporter maintenant"}
        </button>
        <button
          type="button"
          onClick={() => setHistoriqueOpen(true)}
          title="Voir l'historique des exports (date, format, lignes)"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-secondary-300 text-secondary-700 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
        >
          <i className="ri-history-line"></i>
          Historique
        </button>
        <button
          type="button"
          onClick={() => {
            masquerRappelExport();
            setVisible(false);
          }}
          title="Masquer ce rappel ; il reviendra le mois prochain"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-foreground-600 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-close-line"></i>
          Me rappeler le mois prochain
        </button>
      </div>

      {erreur && (
        <div className="w-full flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{erreur}</span>
        </div>
      )}

      {toast && <Toast message={toast} icon="ri-archive-drawer-line" onClose={() => setToast(null)} />}
      {historiqueOpen && (
        <SauvegardeDonneesModal ongletInitial="historique" onClose={() => setHistoriqueOpen(false)} />
      )}
    </section>
  );
}