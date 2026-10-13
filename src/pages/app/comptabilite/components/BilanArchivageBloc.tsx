import { useEffect, useState } from "react";
import type { BilanArchive, DernierBilan, OverrideAdresse } from "@/lib/artisanApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { buildBilansArchivagePdf } from "@/lib/comptabilitePdf";
import { savePdf } from "@/lib/pdf";
import Infobulle from "@/components/base/Infobulle";

interface BilanArchivageBlocProps {
  /** Vrai si l'email du comptable n'est pas encore renseigné. */
  emailManquant: boolean;
  /** Adresse email de l'artisan, rappelée à côté de l'option « copie ». */
  artisanEmail: string;
  /** Identité de l'émetteur, reprise en tête du PDF de la liste des bilans. */
  emetteur: {
    entreprise: string;
    metier?: string;
    telephone?: string;
    email?: string;
    siret?: string | null;
    tva?: string | null;
  };
  /** Dernière adresse ponctuelle utilisée, proposée en suggestion au renvoi d'un bilan. */
  overrideSuggestion: string;
  /** Adresses ponctuelles nommées (ex. « Cabinet externe »), sélectionnables au moment d'un renvoi. */
  overrideAdresses: OverrideAdresse[];
  /** Envoi automatique du bilan d'archivage annuel activé. */
  defaultBilanActif: boolean;
  /** Jour du mois de janvier (1-28) où part le bilan d'archivage. */
  defaultBilanJour: number;
  /** Recevoir aussi une copie du bilan d'archivage dans sa propre boîte. */
  defaultBilanCopieArtisan: boolean;
  /** Enregistre le réglage du bilan d'archivage annuel. */
  onSaveBilan: (settings: { actif: boolean; jour: number; copieArtisan: boolean }) => Promise<void>;
  /** Envoie tout de suite le bilan d'archivage au comptable (test de rendu). */
  onTestBilan: () => Promise<{
    sent: number;
    configured: boolean;
    annee: string;
    lignes?: number;
    reason?: string;
  }>;
  /**
   * Renvoie par email le bilan d'archivage d'un exercice donné au comptable
   * (relance de l'archive d'un exercice passé, sans re-téléchargement). `overrideTo`,
   * s'il est fourni, ajoute une copie à une adresse ponctuelle (ex. expert-comptable remplaçant).
   */
  onEnvoyerBilan: (
    annee: string,
    overrideTo?: string,
    overrideNom?: string,
  ) => Promise<{ sent: number; configured: boolean; reason?: string }>;
  /** Dernier bilan d'archivage envoyé (date + exercice), ou null. */
  dernierBilan: DernierBilan | null;
  /** Liste des bilans d'archivage déjà envoyés (un par exercice), le plus récent en premier. */
  bilans: BilanArchive[];
  /** Chargement des bilans en cours. */
  bilanLoading: boolean;
  /** Recharge la date du dernier bilan après un envoi de test. */
  onReloadDernierBilan: () => void;
  /** Télécharge le PDF du bilan d'archivage d'un exercice donné. */
  onDownloadBilan: (annee: string) => void;
}

/** Date et heure d'un envoi (« 12 janv. 2026 à 08:00 »). */
function dateHeureLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

/**
 * Bloc de réglage du bilan d'archivage annuel : chaque année en janvier, l'historique
 * complet des envois comptables de l'exercice écoulé part au comptable en PDF. Affiche
 * également la date du dernier bilan réellement envoyé, la liste des bilans déjà archivés
 * (un par exercice, avec téléchargement direct, renvoi par email et export CSV) et l'option
 * « m'envoyer une copie ».
 */
export default function BilanArchivageBloc({
  emailManquant,
  artisanEmail,
  emetteur,
  overrideSuggestion,
  overrideAdresses,
  defaultBilanActif,
  defaultBilanJour,
  defaultBilanCopieArtisan,
  onSaveBilan,
  onTestBilan,
  onEnvoyerBilan,
  dernierBilan,
  bilans,
  bilanLoading,
  onReloadDernierBilan,
  onDownloadBilan,
}: BilanArchivageBlocProps) {
  const [bilanActif, setBilanActif] = useState(defaultBilanActif);
  const [bilanJour, setBilanJour] = useState(defaultBilanJour);
  const [bilanCopie, setBilanCopie] = useState(defaultBilanCopieArtisan);
  const [bilanBusy, setBilanBusy] = useState(false);
  const [bilanNotice, setBilanNotice] = useState<string | null>(null);
  const [bilanError, setBilanError] = useState<string | null>(null);
  const [bilanTestBusy, setBilanTestBusy] = useState(false);
  const [bilanTestNotice, setBilanTestNotice] = useState<string | null>(null);
  const [bilanTestError, setBilanTestError] = useState<string | null>(null);
  // Renvoi par email d'un bilan d'exercice depuis la liste (par année).
  const [envoiAnneeBusy, setEnvoiAnneeBusy] = useState<string | null>(null);
  const [envoiAnneeNotice, setEnvoiAnneeNotice] = useState<string | null>(null);
  const [envoiAnneeError, setEnvoiAnneeError] = useState<string | null>(null);
  // Confirmation du renvoi d'un bilan (évite un envoi involontaire au comptable).
  const [confirmAnnee, setConfirmAnnee] = useState<string | null>(null);
  // Renvoi d'un bilan à une adresse ponctuelle (ex. expert-comptable remplaçant) : panneau
  // ouvert depuis la ligne concernée, comme le renvoi de journal.
  const [overrideForId, setOverrideForId] = useState<number | null>(null);
  const [overrideEmailBilan, setOverrideEmailBilan] = useState("");
  // Libellé de l'adresse ponctuelle choisie (ex. « Comptable remplaçant A »), pour tracer le remplacement.
  const [overrideNomBilan, setOverrideNomBilan] = useState("");

  useEffect(() => {
    setBilanActif(defaultBilanActif);
    setBilanJour(defaultBilanJour);
    setBilanCopie(defaultBilanCopieArtisan);
  }, [defaultBilanActif, defaultBilanJour, defaultBilanCopieArtisan]);

  const bilanDirty =
    bilanActif !== defaultBilanActif ||
    bilanJour !== defaultBilanJour ||
    bilanCopie !== defaultBilanCopieArtisan;

  // Enregistre le réglage du bilan d'archivage annuel.
  const handleSaveBilan = async () => {
    setBilanNotice(null);
    setBilanError(null);
    setBilanBusy(true);
    try {
      await onSaveBilan({ actif: bilanActif, jour: bilanJour, copieArtisan: bilanCopie });
      const copie = bilanCopie ? ", avec une copie dans votre boîte" : "";
      setBilanNotice(
        bilanActif
          ? `Bilan d'archivage activé : chaque année en janvier, l'historique de l'exercice écoulé partira au comptable autour du ${bilanJour}${bilanJour === 1 ? "er" : ""}${copie}.`
          : "Bilan d'archivage désactivé : l'historique de l'exercice ne sera plus envoyé automatiquement.",
      );
    } catch {
      setBilanError("L'enregistrement du bilan d'archivage a échoué. Réessayez.");
    } finally {
      setBilanBusy(false);
    }
  };

  // Envoie tout de suite le bilan d'archivage au comptable, pour vérifier le rendu
  // sans attendre la fenêtre de fin d'année.
  const handleTestBilan = async () => {
    setBilanTestNotice(null);
    setBilanTestError(null);
    setBilanTestBusy(true);
    try {
      const res = await onTestBilan();
      if (res.sent > 0) {
        setBilanTestNotice(
          `Bilan d'archivage de l'exercice ${res.annee} envoyé à votre comptable${
            res.lignes != null
              ? ` (${res.lignes} ligne${res.lignes > 1 ? "s" : ""} archivée${res.lignes > 1 ? "s" : ""})`
              : ""
          }. Vérifiez la réception et le rendu.`,
        );
        // Rafraîchit la date du dernier bilan affichée juste après le test.
        onReloadDernierBilan();
      } else if (!res.configured) {
        setBilanTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour tester le bilan.");
      } else {
        setBilanTestError(res.reason || "Le test du bilan n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setBilanTestError(e instanceof Error ? e.message : "Le test du bilan a échoué. Réessayez.");
    } finally {
      setBilanTestBusy(false);
    }
  };

  // Renvoie par email le bilan d'archivage d'un exercice déjà archivé (d'un clic depuis
  // la liste), sur le même principe que l'envoi automatique de fin d'année. `overrideTo`,
  // s'il est fourni, ajoute une copie à une adresse ponctuelle (ex. expert-comptable remplaçant).
  const handleEnvoyerAnnee = async (annee: string, overrideTo?: string, overrideNom?: string) => {
    setEnvoiAnneeNotice(null);
    setEnvoiAnneeError(null);
    setConfirmAnnee(null);
    setOverrideForId(null);
    setEnvoiAnneeBusy(annee);
    try {
      const res = await onEnvoyerBilan(annee, overrideTo, overrideNom);
      if (res.sent > 0) {
        const adresse = overrideTo && overrideTo.trim();
        setEnvoiAnneeNotice(
          adresse
            ? `Bilan d'archivage de l'exercice ${annee} envoyé à ${adresse} (adresse ponctuelle, en plus de votre comptable).`
            : `Bilan d'archivage de l'exercice ${annee} renvoyé à votre comptable par email.`,
        );
        onReloadDernierBilan();
      } else if (!res.configured) {
        setEnvoiAnneeError("L'envoi d'emails n'est pas encore activé : configurez Resend pour renvoyer le bilan.");
      } else {
        setEnvoiAnneeError(res.reason || "Le renvoi du bilan n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setEnvoiAnneeError(e instanceof Error ? e.message : "Le renvoi du bilan a échoué. Réessayez.");
    } finally {
      setEnvoiAnneeBusy(null);
    }
  };

  // Export CSV de la liste des bilans d'archivage envoyés (exercice, date, destinataire,
  // nombre de lignes) — pour l'archivage et la traçabilité hors application.
  const handleExportBilansCsv = () => {
    const headers = ["Exercice", "Date d'envoi", "Mode", "Destinataire", "Nombre de lignes"];
    const rows = bilans.map((b) => [
      b.annee || "",
      dateHeureLabel(b.envoye_le),
      b.auto ? "Automatique" : "Manuel (test)",
      b.destinataire ?? "",
      b.nbLignes ?? "",
    ]);
    downloadCsv(`bilans-archivage-envois-${todayISO()}.csv`, toCsv(headers, rows));
  };

  // Export PDF de la liste des bilans d'archivage envoyés — en plus du CSV, pour
  // l'archivage : exercice, date, mode, destinataire et nombre de lignes.
  const handleExportBilansPdf = () => {
    if (bilans.length === 0) return;
    try {
      const doc = buildBilansArchivagePdf({
        emetteur,
        filtreLabel:
          bilans.length > 1 ? `${bilans.length} exercices archivés` : `${bilans.length} exercice archivé`,
        bilans: bilans.map((b) => ({
          annee: b.annee || "—",
          date: dateHeureLabel(b.envoye_le),
          mode: b.auto ? "Automatique" : "Manuel (test)",
          destinataire: b.destinataire ?? "—",
          lignes: b.nbLignes != null ? String(b.nbLignes) : "—",
        })),
      });
      savePdf(doc, `bilans-archivage-envois-${todayISO()}.pdf`);
    } catch {
      /* l'échec de l'export PDF est silencieux : l'export CSV reste disponible */
    }
  };

  return (
    <div className="pt-3 border-t border-background-200 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
          <i className="ri-archive-drawer-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-sm text-foreground-950">Bilan d'archivage annuel</h3>
          <p className="text-[11px] text-foreground-500 mt-0.5">
            Chaque année en janvier, l'<strong className="text-foreground-700">historique complet des envois comptables de l'exercice écoulé</strong> est
            transmis au comptable en PDF (bilan d'archivage), sur le même principe que l'envoi mensuel. Idéal pour la conservation et les archives.
          </p>
        </div>
        <Infobulle
          contenu="Activez pour que le bilan de l'année écoulée part tout seul à votre comptable, chaque janvier. Idéal pour garder une archive complète."
          position="gauche"
          largeur={260}
        >
          <button
            type="button"
            role="switch"
            aria-checked={bilanActif}
            onClick={() => setBilanActif((v) => !v)}
            disabled={bilanBusy || emailManquant}
            title={emailManquant ? "Renseignez d'abord l'email du comptable ci-dessus" : undefined}
            className={`relative w-12 h-7 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              bilanActif ? "bg-secondary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-background-50 transition-transform ${
                bilanActif ? "translate-x-5" : "translate-x-0"
              }`}
            ></span>
          </button>
        </Infobulle>
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-12">
        {bilanActif && (
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">En janvier, le</span>
            <div className="relative">
              <select
                value={bilanJour}
                onChange={(e) => setBilanJour(Number(e.target.value))}
                disabled={bilanBusy}
                title="Jour de janvier où part le bilan d'archivage"
                className="h-9 pl-3 pr-8 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:opacity-60"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1er" : d}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
            </div>
            <span className="text-[11px] text-foreground-500">de l'année.</span>
          </label>
        )}
        <Infobulle
          contenu="Enregistrer vos réglages : c'est ce qui met en route le bilan d'archivage annuel."
          position="haut"
          largeur={240}
        >
          <button
            type="button"
            onClick={handleSaveBilan}
            disabled={bilanBusy || !bilanDirty}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bilanBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
        </Infobulle>
        <Infobulle
          contenu="Envoyer tout de suite le bilan de l'année au comptable, pour vérifier le rendu sans attendre janvier."
          position="haut"
          largeur={280}
        >
          <button
            type="button"
            onClick={handleTestBilan}
            disabled={bilanTestBusy || bilanBusy || emailManquant}
            title={
              emailManquant
                ? "Renseignez d'abord l'email du comptable ci-dessus"
                : "Envoyer tout de suite le bilan d'archivage de l'exercice au comptable, pour vérifier le rendu"
            }
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bilanTestBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Tester maintenant
          </button>
        </Infobulle>
      </div>

      {/* Option « m'envoyer une copie du bilan », comme la copie du récap de régularité */}
      <label className="inline-flex items-start gap-2 cursor-pointer select-none pl-0 sm:pl-12">
        <input
          type="checkbox"
          checked={bilanCopie}
          onChange={(e) => setBilanCopie(e.target.checked)}
          disabled={bilanBusy || !bilanActif}
          title={!bilanActif ? "Activez d'abord le bilan d'archivage ci-dessus" : undefined}
          className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer rounded border-background-300 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-[11px] text-foreground-600">
          M'envoyer aussi une copie de ce bilan dans ma propre boîte
          {artisanEmail.trim() ? <span className="text-foreground-400"> ({artisanEmail.trim()})</span> : null}
          <span className="text-foreground-400"> — pour conserver l'archive du bilan d'archivage.</span>
        </span>
      </label>

      {/* Dernier bilan d'archivage envoyé : date + exercice archivé */}
      <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 pl-0 sm:pl-12">
        <i className="ri-history-line"></i>
        {bilanLoading ? (
          "Chargement du dernier bilan…"
        ) : dernierBilan ? (
          <>
            Dernier bilan d'archivage envoyé le{" "}
            <strong className="text-foreground-700">{dateHeureLabel(dernierBilan.envoye_le)}</strong>
            {dernierBilan.annee && (
              <>
                {" "}
                · exercice <strong className="text-foreground-700">{dernierBilan.annee}</strong>
              </>
            )}
            {dernierBilan.nbLignes != null && (
              <>
                {" "}
                · {dernierBilan.nbLignes} ligne{dernierBilan.nbLignes > 1 ? "s" : ""}
              </>
            )}
            {!dernierBilan.auto && <span className="text-foreground-400"> (test)</span>}
          </>
        ) : (
          "Aucun bilan d'archivage encore envoyé."
        )}
      </p>

      {/* Liste des bilans d'archivage déjà envoyés (un par exercice) : téléchargement direct,
          renvoi par email à la demande, et export CSV de la liste. */}
      {bilans.length > 0 && (
        <div className="rounded-md bg-background-50 border border-background-200 p-2.5 flex flex-col gap-2 sm:ml-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-archive-stack-line text-secondary-600"></i>
              Bilans d'archivage envoyés ({bilans.length})
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportBilansCsv}
                title="Exporter la liste des bilans d'archivage envoyés en CSV (exercice, date, destinataire, nombre de lignes)"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
              >
                <i className="ri-file-text-line"></i>
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportBilansPdf}
                title="Exporter la liste des bilans d'archivage envoyés en PDF (exercice, date, mode, destinataire, nombre de lignes)"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
              >
                <i className="ri-file-pdf-2-line"></i>
                Export PDF
              </button>
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {bilans.map((b) => {
              const enRenvoi = envoiAnneeBusy === b.annee;
              const aConfirmer = confirmAnnee === b.annee;
              const overrideOuvert = overrideForId === b.id;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-background-100 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-secondary-100 text-secondary-700">
                      <i className="ri-file-pdf-2-line text-xs"></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground-800 inline-flex items-center gap-1.5">
                        Exercice {b.annee || "—"}
                        {!b.auto && <span className="text-[10px] font-normal text-foreground-400">(test)</span>}
                      </p>
                      <p className="text-[10px] text-foreground-500 truncate">
                        {dateHeureLabel(b.envoye_le)}
                        {b.nbLignes != null ? ` · ${b.nbLignes} ligne${b.nbLignes > 1 ? "s" : ""}` : ""}
                        {b.destinataire ? ` · ${b.destinataire}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDownloadBilan(b.annee)}
                      title={`Télécharger le PDF du bilan d'archivage de l'exercice ${b.annee || "—"}`}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-secondary-100 border border-secondary-200 text-[11px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className="ri-download-2-line"></i>
                      Télécharger le PDF
                    </button>
                    {aConfirmer ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-foreground-500 whitespace-nowrap">Envoyer au comptable ?</span>
                        <button
                          type="button"
                          onClick={() => void handleEnvoyerAnnee(b.annee)}
                          disabled={enRenvoi || emailManquant}
                          title={emailManquant ? "Renseignez d'abord l'email du comptable" : undefined}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enRenvoi ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAnnee(null)}
                          disabled={enRenvoi}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEnvoiAnneeNotice(null);
                          setEnvoiAnneeError(null);
                          setConfirmAnnee(b.annee);
                        }}
                        disabled={enRenvoi || emailManquant}
                        title={
                          emailManquant
                            ? "Renseignez d'abord l'email du comptable ci-dessus"
                            : `Renvoyer par email le bilan d'archivage de l'exercice ${b.annee || "—"} au comptable`
                        }
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-accent-100 border border-accent-200 text-[11px] font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enRenvoi ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
                        Envoyer au comptable
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEnvoiAnneeError(null);
                        setOverrideForId((prev) => (prev === b.id ? null : b.id));
                        const suivant = overrideOuvert ? "" : overrideSuggestion;
                        setOverrideEmailBilan(suivant);
                        const connue = overrideAdresses.find(
                          (a) => a.email.trim().toLowerCase() === suivant.trim().toLowerCase(),
                        );
                        setOverrideNomBilan(overrideOuvert ? "" : connue?.nom ?? "");
                      }}
                      disabled={emailManquant}
                      title="Envoyer aussi une copie de ce bilan à une adresse ponctuelle (ex. expert-comptable remplaçant)"
                      className={`w-7 h-7 flex items-center justify-center rounded-md border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        overrideOuvert
                          ? "bg-secondary-100 border-secondary-300"
                          : "bg-background-100 border-background-200 hover:border-secondary-300"
                      }`}
                      aria-label="Envoyer à une autre adresse"
                    >
                      <i className="ri-mail-add-line"></i>
                    </button>
                  </div>

                  {/* Panneau « envoyer une copie à une adresse ponctuelle » */}
                  {overrideOuvert && (
                    <div className="w-full flex flex-col gap-2 pt-2 mt-1 border-t border-background-200 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 shrink-0 sm:max-w-[220px]">
                          <i className="ri-information-line"></i>
                          Adresse ponctuelle (votre comptable habituel reste destinataire).
                        </p>
                        {overrideAdresses.length > 0 && (
                          <div className="relative shrink-0">
                            <i className="ri-bookmark-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                            <select
                              value={overrideEmailBilan}
                              onChange={(e) => {
                                const choix = overrideAdresses.find((a) => a.email === e.target.value);
                                setOverrideEmailBilan(e.target.value);
                                setOverrideNomBilan(choix?.nom ?? "");
                              }}
                              title="Choisir une adresse ponctuelle nommée (le champ se remplit)"
                              className="h-8 pl-9 pr-8 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none max-w-[200px]"
                            >
                              <option value="">Mes adresses…</option>
                              {overrideAdresses.map((a) => (
                                <option key={a.email} value={a.email}>
                                  {a.nom}
                                </option>
                              ))}
                            </select>
                            <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                          </div>
                        )}
                        <div className="relative flex-1 min-w-0">
                          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                          <input
                            type="email"
                            value={overrideEmailBilan}
                            onChange={(e) => {
                              setOverrideEmailBilan(e.target.value);
                              setOverrideNomBilan("");
                            }}
                            placeholder="expert-comptable-remplacant@cabinet.fr"
                            className="h-8 w-full pl-9 pr-3 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleEnvoyerAnnee(b.annee, overrideEmailBilan.trim(), overrideNomBilan || undefined)}
                          disabled={!overrideEmailBilan.trim() || enRenvoi || emailManquant}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enRenvoi ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                          Envoyer la copie à cette adresse
                        </button>
                      </div>
                      {overrideSuggestion && (
                        <p className="text-[11px] text-foreground-400 inline-flex items-center gap-1.5">
                          <i className="ri-lightbulb-line text-accent-500"></i>
                          Adresse proposée d'après votre dernier renvoi ponctuel (modifiable).
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {envoiAnneeError && (
        <p className="text-[11px] text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {envoiAnneeError}
        </p>
      )}
      {envoiAnneeNotice && !envoiAnneeError && (
        <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {envoiAnneeNotice}
        </p>
      )}

      {bilanError && (
        <p className="text-[11px] text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {bilanError}
        </p>
      )}
      {bilanNotice && !bilanError && (
        <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {bilanNotice}
        </p>
      )}
      {bilanTestError && (
        <p className="text-[11px] text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {bilanTestError}
        </p>
      )}
      {bilanTestNotice && !bilanTestError && (
        <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {bilanTestNotice}
        </p>
      )}
    </div>
  );
}