import { useEffect, useMemo, useState } from "react";
import {
  chargerHistoriqueTests,
  chargerStatsTests,
  chargerAutomatisationsTestees,
  chargerToutHistoriqueTests,
  chargerEmetteurHistorique,
  tronquerHistoriqueTests,
  viderHistoriqueTests,
  formatDateHeure,
  type TestHistoriqueRow,
  type TestHistoriqueStats,
  type AutomatisationTestee,
  type PeriodeHistorique,
} from "@/lib/envoisAutomatiquesHistorique";
import { buildHistoriqueTestsPdf } from "@/lib/envoisAutomatiquesHistoriquePdf";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import { savePdf } from "@/lib/pdf";
import { toCsv, downloadCsv } from "@/lib/csv";
import { envoyerCsvParEmail } from "@/lib/diagnosticEmail";

interface Props {
  /** Identifiant du profil connecté, dont on affiche les tests. */
  userId: string;
  /** Change à chaque nouveau test pour relancer le chargement de l'historique. */
  refreshKey: number;
  /** Nombre maximal de lignes conservées à l'affichage. */
  limite?: number;
}

const RESULTAT_META: Record<string, { label: string; icon: string; tone: string }> = {
  succes: { label: "Succès", icon: "ri-checkbox-circle-line", tone: "bg-accent-100 text-accent-800" },
  echec: { label: "Échec", icon: "ri-close-circle-line", tone: "bg-red-100 text-red-700" },
};

const OPTIONS_GARDER = [10, 25, 50, 100];

/** Plages de dates proposées pour filtrer l'historique (0 = toute la période, -1 = plage personnalisée). */
const OPTIONS_PERIODE: { value: number; label: string }[] = [
  { value: 0, label: "Toute la période" },
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
  { value: -1, label: "Plage personnalisée" },
];

/** Suffixe de nom de fichier pour une période (jours glissants ou plage Du/au), vide si aucune. */
function slugPeriode(jours: number, debut: string, fin: string): string {
  if (jours === -1) {
    if (!debut && !fin) return "";
    return `-${debut || "debut"}_${fin || "fin"}`;
  }
  return jours > 0 ? `-${jours}j` : "";
}

/** Historique des tests manuels lancés depuis la page « Envois automatiques ». */
export default function HistoriqueTestsCard({ userId, refreshKey, limite = 20 }: Props) {
  const [rows, setRows] = useState<TestHistoriqueRow[]>([]);
  const [stats, setStats] = useState<TestHistoriqueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtre par automatisation.
  const [automatisations, setAutomatisations] = useState<AutomatisationTestee[]>([]);
  const [filtreAuto, setFiltreAuto] = useState<string>("");
  // Filtre par résultat (« " » = tous, « succes » / « echec »).
  const [filtreResultat, setFiltreResultat] = useState<"" | "succes" | "echec">("");
  // Filtre par plage de dates (0 = toute la période, -1 = plage personnalisée).
  const [filtreJours, setFiltreJours] = useState(0);
  // Bornes de la plage personnalisée (dates « AAAA-MM-JJ »), utilisées quand filtreJours = -1.
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  // Export CSV / PDF.
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportPdfEnCours, setExportPdfEnCours] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Envoi de l'export CSV par email (trace datée hors du navigateur), sur la période choisie.
  const [emailEnCours, setEmailEnCours] = useState(false);
  const [emailEtat, setEmailEtat] = useState<{ etat: "envoi" | "ok" | "erreur"; message: string } | null>(
    null,
  );

  // Nettoyage de l'historique.
  const [localKey, setLocalKey] = useState(0);
  const [garderN, setGarderN] = useState(25);
  const [confirmVider, setConfirmVider] = useState(false);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Période effective dérivée du filtre : jours glissants OU plage personnalisée (bornes ISO).
  const periode = useMemo<PeriodeHistorique | null>(() => {
    if (filtreJours === -1) {
      if (!dateDebut && !dateFin) return null;
      return {
        debutISO: dateDebut ? new Date(`${dateDebut}T00:00:00`).toISOString() : null,
        finISO: dateFin ? new Date(`${dateFin}T23:59:59.999`).toISOString() : null,
      };
    }
    return filtreJours > 0 ? { depuisJours: filtreJours } : null;
  }, [filtreJours, dateDebut, dateFin]);

  // Liste des automatisations testées, pour alimenter le filtre.
  useEffect(() => {
    let actif = true;
    (async () => {
      if (!userId) {
        setAutomatisations([]);
        return;
      }
      try {
        const liste = await chargerAutomatisationsTestees(userId);
        if (actif) setAutomatisations(liste);
      } catch (e) {
        journaliserDepuisErreur({
          ecran: "Envois automatiques · Historique des tests",
          source: "automatisations testées",
          error: e,
          gravite: "avertissement",
        });
        if (actif) setAutomatisations([]);
      }
    })();
    return () => {
      actif = false;
    };
  }, [userId, refreshKey, localKey]);

  useEffect(() => {
    let actif = true;
    (async () => {
      if (!userId) {
        setRows([]);
        setStats(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [liste, statsRes] = await Promise.all([
          chargerHistoriqueTests(userId, limite, filtreAuto || null, filtreResultat || null, periode),
          chargerStatsTests(userId, filtreAuto || null, filtreResultat || null, periode),
        ]);
        if (actif) {
          setRows(liste);
          setStats(statsRes);
        }
      } catch (e) {
        if (actif) {
          journaliserDepuisErreur({
            ecran: "Envois automatiques · Historique des tests",
            source: "historique des tests",
            error: e,
          });
          setError("L'historique des tests n'a pas pu être chargé.");
        }
      } finally {
        if (actif) setLoading(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, [userId, refreshKey, limite, localKey, filtreAuto, filtreResultat, periode]);

  // Libellé du filtre actif (sert au nom du fichier exporté et au titre du PDF).
  const autoFiltreLabel = useMemo(
    () => automatisations.find((a) => a.id === filtreAuto)?.nom ?? null,
    [automatisations, filtreAuto],
  );

  /** Suffixe commun aux fichiers exportés, reflétant les filtres actifs. */
  const slugFiltres = () => {
    const slugAuto = autoFiltreLabel
      ? `-${autoFiltreLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
      : "";
    const slugResultat = filtreResultat ? `-${filtreResultat === "succes" ? "succes" : "echecs"}` : "";
    return `${slugAuto}${slugResultat}${slugPeriode(filtreJours, dateDebut, dateFin)}`;
  };

  /** Libellé lisible des filtres actifs, pour l'en-tête du PDF. */
  const libelleFiltres = (): string => {
    const parties: string[] = [];
    if (autoFiltreLabel) parties.push(autoFiltreLabel);
    if (filtreResultat) parties.push(filtreResultat === "succes" ? "succès uniquement" : "échecs uniquement");
    if (filtreJours === -1) {
      if (dateDebut || dateFin) {
        parties.push(`du ${dateDebut || "…"} au ${dateFin || "…"}`);
      } else {
        parties.push("plage personnalisée");
      }
    } else if (filtreJours > 0) {
      parties.push(`${filtreJours} derniers jours`);
    }
    return parties.length ? parties.join(" · ") : "Tous les tests";
  };

  const handleExport = async () => {
    if (!userId || exportEnCours) return;
    setExportEnCours(true);
    setExportError(null);
    try {
      const toutes = await chargerToutHistoriqueTests(userId, filtreAuto || null, filtreResultat || null, periode);
      if (toutes.length === 0) {
        setExportError("Rien à exporter pour ce filtre.");
        return;
      }
      const contenu = toCsv(
        ["Date", "Automatisation", "Résultat", "Message"],
        toutes.map((r) => [
          formatDateHeure(r.created_at),
          r.automatisation_nom,
          r.resultat === "succes" ? "Succès" : "Échec",
          r.message ?? "",
        ]),
      );
      downloadCsv(`historique-tests${slugFiltres()}-${new Date().toISOString().slice(0, 10)}.csv`, contenu);
    } catch {
      setExportError("L'export de l'historique a échoué.");
    } finally {
      setExportEnCours(false);
    }
  };

  // Envoie le même CSV par email à l'adresse de l'artisan, sur la période et les filtres choisis.
  const handleExportEmail = async () => {
    if (!userId || emailEnCours) return;
    setEmailEnCours(true);
    setEmailEtat(null);
    setExportError(null);
    try {
      const toutes = await chargerToutHistoriqueTests(userId, filtreAuto || null, filtreResultat || null, periode);
      if (toutes.length === 0) {
        setExportError("Rien à envoyer pour ce filtre.");
        return;
      }
      const contenu = toCsv(
        ["Date", "Automatisation", "Résultat", "Message"],
        toutes.map((r) => [
          formatDateHeure(r.created_at),
          r.automatisation_nom,
          r.resultat === "succes" ? "Succès" : "Échec",
          r.message ?? "",
        ]),
      );
      const filename = `historique-tests${slugFiltres()}-${new Date().toISOString().slice(0, 10)}.csv`;
      setEmailEtat({ etat: "envoi", message: "Envoi de l'export en cours…" });
      const res = await envoyerCsvParEmail({
        csv: contenu,
        filename,
        subject: `Historique des tests — ${libelleFiltres()}`,
      });
      setEmailEtat({ etat: "ok", message: `Export CSV envoyé par email à ${res.to || "votre adresse"}.` });
    } catch (e) {
      setEmailEtat({
        etat: "erreur",
        message: e instanceof Error ? e.message : "L'envoi de l'export par email a échoué.",
      });
    } finally {
      setEmailEnCours(false);
    }
  };

  const handleExportPdf = async () => {
    if (!userId || exportPdfEnCours) return;
    setExportPdfEnCours(true);
    setExportError(null);
    try {
      const [toutes, emetteur, statsPdf] = await Promise.all([
        chargerToutHistoriqueTests(userId, filtreAuto || null, filtreResultat || null, periode),
        chargerEmetteurHistorique(userId),
        chargerStatsTests(userId, filtreAuto || null, filtreResultat || null, periode),
      ]);
      if (toutes.length === 0) {
        setExportError("Rien à exporter pour ce filtre.");
        return;
      }
      const doc = await buildHistoriqueTestsPdf({
        emetteur,
        rows: toutes.map((r) => ({
          dateLabel: formatDateHeure(r.created_at),
          automatisationNom: r.automatisation_nom,
          resultat: r.resultat,
          message: r.message,
        })),
        stats: {
          total: statsPdf.total,
          succes: statsPdf.succes,
          tauxSucces: statsPdf.tauxSucces,
          dernierLabel: formatDateHeure(statsPdf.dernier),
        },
        filtreLabel: libelleFiltres(),
      });
      savePdf(doc, `historique-tests${slugFiltres()}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setExportError("L'export PDF de l'historique a échoué.");
    } finally {
      setExportPdfEnCours(false);
    }
  };

  const handleGarderN = async () => {
    if (!userId || actionEnCours) return;
    setActionEnCours(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await tronquerHistoriqueTests(userId, garderN);
      setActionMessage(`Historique nettoyé : seuls les ${garderN} derniers tests sont conservés.`);
      setLocalKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Le nettoyage a échoué.");
    } finally {
      setActionEnCours(false);
    }
  };

  const handleVider = async () => {
    if (!userId || actionEnCours) return;
    setActionEnCours(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await viderHistoriqueTests(userId);
      setConfirmVider(false);
      setActionMessage("Historique vidé.");
      setLocalKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setActionEnCours(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
          <i className="ri-history-line"></i>
        </span>
        <div>
          <h3 className="font-heading font-semibold text-base text-foreground-950">Historique des tests</h3>
          <p className="text-xs text-foreground-500">Les tests lancés depuis cette page, du plus récent au plus ancien.</p>
        </div>
      </div>

      {/* Filtre par automatisation + export CSV */}
      {!loading && !error && automatisations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-background-50 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-filter-3-line"></i>
            Filtrer
          </span>
          <label className="inline-flex items-center gap-2 text-xs text-foreground-600">
            <span>Automatisation</span>
            <select
              value={filtreAuto}
              onChange={(e) => setFiltreAuto(e.target.value)}
              className="h-8 px-2 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Toutes les automatisations</option>
              {automatisations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-foreground-600">
            <span>Résultat</span>
            <select
              value={filtreResultat}
              onChange={(e) => setFiltreResultat(e.target.value as "" | "succes" | "echec")}
              className="h-8 px-2 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Tous les résultats</option>
              <option value="succes">Succès uniquement</option>
              <option value="echec">Échecs uniquement</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-foreground-600">
            <span>Période</span>
            <select
              value={filtreJours}
              onChange={(e) => setFiltreJours(Number(e.target.value))}
              className="h-8 px-2 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {OPTIONS_PERIODE.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {filtreJours === -1 && (
            <div className="inline-flex items-center gap-1.5 h-8 pl-2 pr-1 rounded-md bg-background-100 border border-secondary-300">
              <span className="text-[10px] font-semibold text-foreground-500">Du</span>
              <input
                type="date"
                value={dateDebut}
                max={dateFin || undefined}
                onChange={(e) => setDateDebut(e.target.value)}
                aria-label="Date de début de la plage"
                className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
              />
              <span className="text-[10px] font-semibold text-foreground-500">au</span>
              <input
                type="date"
                value={dateFin}
                min={dateDebut || undefined}
                onChange={(e) => setDateFin(e.target.value)}
                aria-label="Date de fin de la plage"
                className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
              />
              {(dateDebut || dateFin) && (
                <button
                  type="button"
                  onClick={() => { setDateDebut(""); setDateFin(""); }}
                  title="Effacer les dates"
                  className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 cursor-pointer hover:bg-background-200 hover:text-foreground-700 transition-colors"
                >
                  <i className="ri-close-line text-xs"></i>
                </button>
              )}
            </div>
          )}

          {(filtreAuto || filtreResultat || filtreJours !== 0 || dateDebut || dateFin) && (
            <button
              type="button"
              onClick={() => { setFiltreAuto(""); setFiltreResultat(""); setFiltreJours(0); setDateDebut(""); setDateFin(""); }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-foreground-500 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:text-foreground-800 hover:bg-background-100 transition-colors"
            >
              <i className="ri-close-line"></i>
              Réinitialiser
            </button>
          )}

          <span className="hidden sm:block flex-1"></span>

          <button
            type="button"
            onClick={() => { void handleExport(); }}
            disabled={exportEnCours || rows.length === 0}
            title={rows.length === 0 ? "Rien à exporter pour ce filtre" : "Télécharger l'historique au format CSV"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-download-2-line"></i>}
            Exporter en CSV
          </button>
          <button
            type="button"
            onClick={() => { void handleExportPdf(); }}
            disabled={exportPdfEnCours || rows.length === 0}
            title={rows.length === 0 ? "Rien à exporter pour ce filtre" : "Télécharger l'historique au format PDF"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportPdfEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
            Exporter en PDF
          </button>
          <button
            type="button"
            onClick={() => { void handleExportEmail(); }}
            disabled={emailEnCours || rows.length === 0}
            title={
              rows.length === 0
                ? "Rien à envoyer pour ce filtre"
                : "Envoyer l'export CSV par email à votre adresse, sur la période choisie"
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            Envoyer par email
          </button>
        </div>
      )}

      {emailEtat && (
        <p
          className={`flex items-start gap-2 text-[11px] leading-relaxed ${
            emailEtat.etat === "erreur"
              ? "text-red-600"
              : emailEtat.etat === "ok"
                ? "text-accent-700"
                : "text-foreground-500"
          }`}
        >
          <i
            className={`mt-px shrink-0 ${
              emailEtat.etat === "erreur"
                ? "ri-error-warning-line"
                : emailEtat.etat === "ok"
                  ? "ri-checkbox-circle-line"
                  : "ri-loader-4-line animate-spin"
            }`}
          ></i>
          <span>{emailEtat.message}</span>
        </p>
      )}

      {exportError && (
        <p className="flex items-start gap-2 text-[11px] text-red-600 leading-relaxed">
          <i className="ri-error-warning-line mt-px shrink-0"></i>
          <span>{exportError}</span>
        </p>
      )}

      {!loading && !error && stats && stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Tests journalisés</p>
            <p className="mt-1 font-heading font-bold text-lg text-foreground-950">{stats.total}</p>
          </div>
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Taux de réussite</p>
            <p className="mt-1 font-heading font-bold text-lg text-foreground-950">
              {stats.tauxSucces}%
              <span className="ml-1 text-[11px] font-semibold text-foreground-500">{stats.succes}/{stats.total}</span>
            </p>
          </div>
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Dernière exécution</p>
            <p className="mt-1 text-sm font-semibold text-foreground-950">{formatDateHeure(stats.dernier)}</p>
          </div>
        </div>
      )}

      {/* Nettoyage : garder les N derniers / tout vider */}
      {!loading && !error && stats && stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-background-50 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-brush-line"></i>
            Nettoyer
          </span>
          <label className="inline-flex items-center gap-2 text-xs text-foreground-600">
            Ne garder que les
            <select
              value={garderN}
              onChange={(e) => setGarderN(Number(e.target.value))}
              className="h-8 px-2 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {OPTIONS_GARDER.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            derniers
          </label>
          <button
            type="button"
            onClick={() => { void handleGarderN(); }}
            disabled={actionEnCours}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-filter-3-line"></i>}
            Nettoyer
          </button>

          <span className="hidden sm:block flex-1"></span>

          {confirmVider ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-foreground-600">Tout supprimer ?</span>
              <button
                type="button"
                onClick={() => { void handleVider(); }}
                disabled={actionEnCours}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
                Oui, vider
              </button>
              <button
                type="button"
                onClick={() => setConfirmVider(false)}
                disabled={actionEnCours}
                className="inline-flex items-center h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmVider(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-red-200 text-red-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-50 transition-colors"
            >
              <i className="ri-delete-bin-6-line"></i>
              Vider l'historique
            </button>
          )}
        </div>
      )}

      {actionMessage && (
        <p className="flex items-start gap-2 text-[11px] text-accent-700 leading-relaxed">
          <i className="ri-checkbox-circle-line mt-px shrink-0"></i>
          <span>{actionMessage}</span>
        </p>
      )}
      {actionError && (
        <p className="flex items-start gap-2 text-[11px] text-red-600 leading-relaxed">
          <i className="ri-error-warning-line mt-px shrink-0"></i>
          <span>{actionError}</span>
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-foreground-500 py-3">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de l'historique…
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="flex items-center gap-2 text-xs text-red-600">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
          <button
            type="button"
            onClick={() => setLocalKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="flex items-start gap-2 text-xs text-foreground-500 leading-relaxed py-3">
          <i className="ri-information-line mt-px shrink-0"></i>
          {filtreResultat === "echec" ? (
            <span>Aucun test en échec pour ce filtre. Tout va bien de ce côté.</span>
          ) : filtreResultat === "succes" ? (
            <span>Aucun test réussi pour ce filtre. Consultez les échecs pour comprendre ce qui bloque.</span>
          ) : filtreAuto ? (
            <span>Aucun test pour cette automatisation. Changez de filtre ou lancez un test depuis sa carte.</span>
          ) : filtreJours === -1 ? (
            <span>Aucun test sur cette plage de dates. Élargissez la période ou changez de filtre.</span>
          ) : filtreJours > 0 ? (
            <span>Aucun test sur les {filtreJours} derniers jours pour ce filtre. Élargissez la période ou changez de filtre.</span>
          ) : (
            <span>Aucun test lancé pour l'instant. Cliquez sur « Tester maintenant » sur une carte pour voir le résultat apparaître ici.</span>
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-background-200">
          {rows.map((row) => {
            const res = RESULTAT_META[row.resultat] ?? RESULTAT_META.succes;
            return (
              <li key={row.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${res.tone}`}>
                  <i className={res.icon}></i>
                  {res.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950">{row.automatisation_nom}</p>
                  {row.message && <p className="mt-0.5 text-[11px] text-foreground-500 leading-relaxed">{row.message}</p>}
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500 whitespace-nowrap">
                  <i className="ri-time-line"></i>
                  {formatDateHeure(row.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
        {stats && stats.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-background-200">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-700">
              <i className="ri-file-list-3-line text-foreground-500"></i>
              {stats.total} test{stats.total > 1 ? "s" : ""}
              {filtreAuto || filtreResultat || filtreJours > 0 ? " (filtré)" : " au total"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-checkbox-circle-line"></i>
                {stats.succes} succès
              </span>
              <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-close-circle-line"></i>
                {stats.total - stats.succes} échec{stats.total - stats.succes > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
        </div>
      )}
    </section>
  );
}