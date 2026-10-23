import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { buildRecapEnvoisGroupeesPdf } from "@/lib/recapEnvoisGroupeesPdf";
import { libelleMoisRecap } from "@/lib/recapEnvoisGroupeesStats";
import {
  chargerRecapMois,
  chargerSerieRecapMois,
  cleCibleRecap,
  envoyerEssaiRecapMois,
  fetchRecapAutoSettings,
  libelleEcheanceRecap,
  marquerRecapTraite,
  recapAutoDu,
  updateRecapAutoSettings,
  type RecapAutoSettings,
} from "@/lib/recapEnvoisGroupeesAuto";
import { enregistrerPdfArchive } from "@/lib/archivesRecapPdf";
import { ajouterExportHistorique } from "@/lib/historiqueExportsDonnees";

type Mode = RecapAutoSettings["mode"];

/**
 * Récap mensuel automatique : choisit ce qu'il advient du PDF du mois écoulé —
 * envoyé au comptable par la tâche planifiée, ou archivé dans l'historique des exports
 * (préparé à la première ouverture de l'application après la date choisie).
 */
export default function RecapAutoMensuelBloc({
  chantiers,
  refreshKey,
}: {
  chantiers: ChantierItem[];
  refreshKey?: string;
}) {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<RecapAutoSettings | null>(null);
  const [actif, setActif] = useState(false);
  const [mode, setMode] = useState<Mode>("envoi");
  const [jour, setJour] = useState(1);
  const [heure, setHeure] = useState(8);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  // Essai immédiat : le même PDF part à l'adresse de l'artisan, sans attendre la date.
  const [testBusy, setTestBusy] = useState(false);
  // Empêche de relancer deux fois le même archivage dans une même visite.
  const jobRef = useRef<string | null>(null);

  const comptableEmail = (profile?.comptable_email ?? "").trim();

  useEffect(() => {
    if (!user) return;
    let actifCharge = true;
    fetchRecapAutoSettings(user.id)
      .then((s) => {
        if (!actifCharge) return;
        setSettings(s);
        setActif(s.actif);
        setMode(s.mode);
        setJour(s.jour);
        setHeure(s.heure);
      })
      .catch(() => {
        if (!actifCharge) return;
        setErreur("Les réglages du récap mensuel n'ont pas pu être chargés.");
      });
    return () => {
      actifCharge = false;
    };
  }, [user]);

  /** Construit le PDF d'un mois et l'enregistre dans l'archive locale + l'historique des exports. */
  const archiverMois = useCallback(
    async (cle: string, silencieux: boolean): Promise<boolean> => {
      if (!user) return false;
      const stats = await chargerRecapMois(user.id, cle);
      // Courbe de tendance : les douze derniers mois, pour lire la progression dans le PDF.
      const serie = await chargerSerieRecapMois(user.id, chantiers);
      const nom = `recap-envois-groupees-${cle}.pdf`;
      const doc = await buildRecapEnvoisGroupeesPdf({
        emetteur: {
          entreprise: profile?.entreprise?.trim() || "Mon entreprise",
          email: profile?.email ?? user.email ?? null,
        },
        moisLabel: libelleMoisRecap(cle),
        stats: {
          clientsRelances: new Set(
            stats.chantiersRelances.map((id) => chantiers.find((c) => c.id === id)?.client_id ?? -id),
          ).size,
          emailsGroupees: stats.emailsGroupees,
          chantiersRelances: stats.chantiersRelances.length,
          delaiMoyenJours: stats.delaiMoyenJours,
          enAttente: stats.enAttente,
          attenteMoyenneJours: stats.attenteMoyenneJours,
        },
        rows: stats.details.map((d) => {
          const chantier = chantiers.find((c) => c.id === d.chantierId);
          const date = new Date(d.at);
          return {
            dateLabel: Number.isNaN(date.getTime())
              ? "—"
              : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
            chantier: chantier?.libelle ?? "Chantier",
            client: chantier?.clientNom ?? "Client",
            destinataire: d.destinataire ?? "—",
          };
        }),
        serie,
      });
      const bytes = doc.output("arraybuffer") as ArrayBuffer;
      const date = new Date().toISOString();
      const enregistre = await enregistrerPdfArchive(nom, date, bytes);
      ajouterExportHistorique({
        date,
        format: "recap-pdf",
        tables: 0,
        lignes: stats.emailsGroupees,
        taille: bytes.byteLength,
        nom,
      });
      await marquerRecapTraite(user.id, cle);
      if (!silencieux) {
        setNotice(
          enregistre
            ? `Récap de ${libelleMoisRecap(cle)} archivé dans l'historique des exports.`
            : `Récap de ${libelleMoisRecap(cle)} enregistré dans l'historique des exports.`,
        );
      }
      return true;
    },
    [user, profile, chantiers],
  );

  // Archivage automatique : dès que l'application est ouverte après la date choisie,
  // le récap du mois écoulé est préparé une seule fois puis conservé localement.
  useEffect(() => {
    if (!user || !settings) return;
    if (!settings.actif || settings.mode !== "archive") return;
    const cle = cleCibleRecap();
    if (settings.dernierMois === cle) return;
    if (!recapAutoDu(settings)) return;
    if (jobRef.current === cle) return;
    jobRef.current = cle;
    setArchiveBusy(true);
    archiverMois(cle, true)
      .then((ok) => {
        if (ok) {
          setSettings((prev) => (prev ? { ...prev, dernierMois: cle } : prev));
          setNotice(`Récap de ${libelleMoisRecap(cle)} archivé automatiquement dans l'historique des exports.`);
        }
      })
      .catch(() => {
        jobRef.current = null;
        setErreur("L'archivage automatique du récap n'a pas pu être effectué.");
      })
      .finally(() => setArchiveBusy(false));
  }, [user, settings, archiverMois, refreshKey]);

  const dirty = Boolean(settings) && (
    actif !== settings?.actif ||
    mode !== settings?.mode ||
    jour !== settings?.jour ||
    heure !== settings?.heure
  );

  const enregistrer = async () => {
    if (!user || busy) return;
    setBusy(true);
    setErreur(null);
    setNotice(null);
    try {
      await updateRecapAutoSettings(user.id, { actif, mode, jour, heure });
      setSettings((prev) => ({
        actif,
        mode,
        jour,
        heure,
        dernierMois: prev?.dernierMois ?? null,
      }));
      setNotice(
        actif
          ? mode === "envoi"
            ? `Récap programmé : le PDF du mois écoulé partira ${libelleEcheanceRecap({ jour, heure })} au comptable.`
            : `Récap programmé : le PDF du mois écoulé sera archivé ${libelleEcheanceRecap({ jour, heure })}, à la première ouverture de l'application.`
          : "Récap mensuel automatique désactivé.",
      );
    } catch {
      setErreur("L'enregistrement des réglages a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  /** Reçoit tout de suite le récap du mois écoulé sur sa propre adresse, pour valider le rendu. */
  const testerMaintenant = async () => {
    if (testBusy || !user) return;
    setTestBusy(true);
    setErreur(null);
    setNotice(null);
    try {
      const resultat = await envoyerEssaiRecapMois();
      setNotice(
        `Récap de ${resultat.moisLabel} envoyé à ${resultat.destinataire ?? "votre adresse"} : ouvrez votre boîte mail pour vérifier la mise en forme du PDF.`,
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'essai n'a pas pu être envoyé. Réessayez.");
    } finally {
      setTestBusy(false);
    }
  };

  const moisLabel = useMemo(() => libelleMoisRecap(cleCibleRecap()), []);
  const dernierLabel = settings?.dernierMois ? libelleMoisRecap(settings.dernierMois) : null;

  return (
    <div id="recap-auto" className="mt-3 rounded-md bg-background-50 border border-background-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-calendar-schedule-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground-900">Récap mensuel automatique</p>
            <p className="text-[11px] text-foreground-500">
              Chaque mois, le PDF du récap ({moisLabel}) est envoyé au comptable ou conservé dans l&apos;historique des exports.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          onClick={() => setActif((v) => !v)}
          disabled={busy}
          title={actif ? "Désactiver le récap mensuel automatique" : "Activer le récap mensuel automatique"}
          className={`relative w-11 h-6 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            actif ? "bg-primary-500" : "bg-background-300"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-background-50 transition-transform ${
              actif ? "translate-x-5" : "translate-x-0"
            }`}
          ></span>
        </button>
      </div>

      <div className={`mt-2.5 flex flex-wrap items-end gap-2 ${actif ? "" : "opacity-60"}`}>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Destination</span>
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {([
              { cle: "envoi" as Mode, label: "Au comptable", icone: "ri-mail-send-line" },
              { cle: "archive" as Mode, label: "Historique", icone: "ri-archive-line" },
            ]).map((opt) => (
              <button
                key={opt.cle}
                type="button"
                onClick={() => setMode(opt.cle)}
                disabled={!actif || busy}
                aria-pressed={mode === opt.cle}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed ${
                  mode === opt.cle ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={opt.icone}></i>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Jour</span>
          <select
            value={jour}
            onChange={(e) => setJour(Number(e.target.value))}
            disabled={!actif || busy}
            className="h-8 pl-2.5 pr-7 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:cursor-not-allowed"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "1er" : d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Heure</span>
          <select
            value={heure}
            onChange={(e) => setHeure(Number(e.target.value))}
            disabled={!actif || busy}
            className="h-8 pl-2.5 pr-7 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:cursor-not-allowed"
          >
            {Array.from({ length: 24 }, (_, i) => i).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")} h
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
          Enregistrer
        </button>

        <button
          type="button"
          onClick={() => void testerMaintenant()}
          disabled={testBusy || !user}
          title="Recevoir tout de suite le récap PDF du mois écoulé sur votre adresse, pour vérifier la mise en forme avant la date programmée"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border border-accent-200 text-accent-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
          {testBusy ? "Envoi…" : "Tester maintenant"}
        </button>

        {mode === "archive" && (
          <button
            type="button"
            onClick={() => {
              setErreur(null);
              setNotice(null);
              setArchiveBusy(true);
              archiverMois(cleCibleRecap(), false)
                .then((ok) => {
                  if (!ok) setErreur("L'archivage du récap a échoué.");
                })
                .catch(() => setErreur("L'archivage du récap a échoué. Réessayez."))
                .finally(() => setArchiveBusy(false));
            }}
            disabled={archiveBusy || !user}
            title="Préparer maintenant le récap du mois écoulé et l'ajouter à l'historique des exports"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {archiveBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-archive-line"></i>}
            Archiver maintenant
          </button>
        )}
      </div>

      {actif && mode === "envoi" && !comptableEmail && (
        <p className="mt-2 text-[11px] text-secondary-800 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          <span>
            Ajoutez l&apos;email du comptable (Espace comptable) pour que l&apos;envoi automatique puisse partir. En attendant,
            choisissez « Historique » pour archiver le récap.
          </span>
        </p>
      )}
      {actif && mode === "archive" && (
        <p className="mt-2 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
          <i className="ri-archive-line mt-px"></i>
          <span>
            L&apos;archive est préparée {libelleEcheanceRecap({ jour, heure })} puis conservée dans ce navigateur ; vous pouvez la
            télécharger depuis l&apos;historique des exports.
          </span>
        </p>
      )}
      {!actif && (
        <p className="mt-2 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
          <i className="ri-mail-send-line mt-px"></i>
          <span>
            « Tester maintenant » vous envoie le récap du mois écoulé sur votre adresse, même quand l&apos;envoi automatique
            est coupé : idéal pour vérifier le rendu du PDF avant la première échéance.
          </span>
        </p>
      )}
      {settings && (
        <p className="mt-1.5 text-[10px] text-foreground-400">
          {dernierLabel ? `Dernier récap traité : ${dernierLabel}.` : "Aucun récap mensuel traité pour l'instant."}
        </p>
      )}
      {erreur && (
        <p className="mt-1.5 text-[11px] text-red-600 inline-flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {erreur}
        </p>
      )}
      {notice && !erreur && (
        <p className="mt-1.5 text-[11px] text-accent-700 inline-flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
    </div>
  );
}