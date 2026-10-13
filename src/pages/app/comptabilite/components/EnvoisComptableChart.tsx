import { useEffect, useMemo, useRef, useState } from "react";
import type { ComptableEnvoi } from "@/lib/artisanApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { buildEnvoisChartImageDataUrl, exportEnvoisChartImage } from "@/lib/envoisChartImage";
import { buildManquantsGroupedRows } from "@/lib/comptableRegularite";

/** Une pièce jointe prête à être expédiée au comptable. */
export interface RapportPieceJointe {
  /** Nom de la pièce jointe. */
  filename: string;
  /** Contenu encodé en base64 (image PNG ou texte CSV). */
  base64: string;
  /** Type MIME de la pièce jointe. */
  contentType: string;
}

/** Contenu prêt à être expédié par email au comptable (graphe, CSV ou les deux). */
export interface RapportComptablePayload {
  /** Pièces jointes à joindre à l'email. */
  pieces: RapportPieceJointe[];
  /** Format archivé. */
  format: "image" | "csv" | "both";
  /** Nombre de mois couverts par l'export. */
  moisCount: number;
  /** Commentaire libre ajouté dans l'email. */
  commentaire: string;
}

interface EnvoisComptableChartProps {
  /** Historique complet des envois du journal au comptable. */
  historique: ComptableEnvoi[];
  /** Mois actuellement filtré (« AAAA-MM ») ou « tous ». */
  filtreMois: string;
  /** Applique ou retire le filtre mois au clic sur une barre. */
  onSelectMois: (cle: string) => void;
  /** Email du comptable, destinataire de l'envoi direct du graphe / CSV. */
  comptableEmail: string;
  /** Envoi en cours (désactive les boutons d'email). */
  envoiBusy: boolean;
  /** Expédie le graphe, le CSV ou le tout au comptable. */
  onEnvoyerRapport: (payload: RapportComptablePayload) => void;
  /** Commentaire libre mémorisé, prérempli dans le champ d'envoi. */
  defaultCommentaire: string;
  /** Mémorise le commentaire pour le réutiliser au prochain envoi. */
  onSaveCommentaire: (value: string) => void;
  /** Renvoie en un clic le journal d'un mois manquant au comptable. */
  onRenvoyerMois: (cle: string) => void;
  /** Mois (« AAAA-MM ») en cours de renvoi, ou null. */
  renvoyerMoisBusyCle: string | null;
  /** Renvoie en une seule action le journal de tous les mois manquants. */
  onRenvoyerTousMois?: (cles: string[]) => void;
  /** Un renvoi groupé des mois manquants est en cours. */
  renvoyerTousBusy?: boolean;
  /** Met en avant l'alerte des mois manquants (ouverture depuis l'email d'alerte). */
  focusManquants?: boolean;
  /** Période d'archive mémorisée dans le profil (« 6 » / « 12 » / « 24 »). */
  defaultPeriode: string;
  /** Format d'export par défaut mémorisé dans le profil (« image » / « csv » / « both »). */
  defaultFormat: "image" | "csv" | "both";
  /** Mémorise les préférences d'export pour les reproposer à la prochaine visite. */
  onSavePrefs: (prefs: { periode: string; format: "image" | "csv" | "both" }) => void;
}

/** Périodes d'archive proposées pour le graphe (en mois). */
type Periode = "6" | "12" | "24";

/** Ramène une période mémorisée quelconque vers une période valide (12 par défaut). */
function coercePeriode(value: string): Periode {
  return value === "6" || value === "24" ? value : "12";
}

/** Clé « AAAA-MM » à partir d'une date ISO d'envoi, ou null. */
function cleDepuisISO(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé court d'un mois (« sept. »). */
function moisCourt(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
}

/** Libellé long d'un mois (« Septembre 2026 »). */
function moisLong(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  const s = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Encode un texte UTF-8 en base64 (pour la pièce jointe CSV). */
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(`\uFEFF${text}`);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

interface MoisBucket {
  cle: string;
  auto: number;
  manuel: number;
  total: number;
  /** Envois automatiques du même mois l'année précédente (N-1), ou null. */
  n1Auto: number | null;
}

/**
 * Mini-graphe des envois du journal comptable par mois : chaque barre empile les
 * envois automatiques (planifiés) et manuels (tests / renvois). Un trait discret
 * rappelle, pour chaque mois, le nombre d'envois automatiques de l'année précédente
 * (même mois N-1) — on compare la régularité d'une année sur l'autre. Un mois sans
 * barre « auto » signale un envoi automatique manqué, et une alerte liste les mois
 * attendus restés sans envoi automatique. Cliquer une barre filtre l'historique sur
 * ce mois. On peut choisir la profondeur d'archive (6 / 12 / 24 mois), exporter le
 * graphe en PNG ou en CSV, et l'envoyer au comptable — graphe, CSV ou les deux, avec
 * un commentaire libre.
 */
export default function EnvoisComptableChart({
  historique,
  filtreMois,
  onSelectMois,
  comptableEmail,
  envoiBusy,
  onEnvoyerRapport,
  defaultCommentaire,
  onSaveCommentaire,
  onRenvoyerMois,
  renvoyerMoisBusyCle,
  onRenvoyerTousMois,
  renvoyerTousBusy,
  focusManquants,
  defaultPeriode,
  defaultFormat,
  onSavePrefs,
}: EnvoisComptableChartProps) {
  const [periode, setPeriode] = useState<Periode>(() => coercePeriode(defaultPeriode));
  const [formatDefaut, setFormatDefaut] = useState<"image" | "csv" | "both">(defaultFormat);
  const [emailMenu, setEmailMenu] = useState(false);
  // Filtre « Mois manquants » : n'éclaire que les barres des mois sans envoi automatique.
  const [manquantsSeul, setManquantsSeul] = useState(false);
  const [commentaire, setCommentaire] = useState(defaultCommentaire);
  // Ancre de l'alerte des mois manquants, pour l'amener au centre quand on arrive
  // depuis le lien « Renvoyer tous les mois manquants » de l'email d'alerte.
  const manquantsRef = useRef<HTMLDivElement | null>(null);
  const moisDispo = Number(periode);

  // On reprend le commentaire mémorisé dès qu'il est disponible (profil chargé plus tard).
  useEffect(() => {
    setCommentaire(defaultCommentaire);
  }, [defaultCommentaire]);

  // On reprend les préférences mémorisées dès que le profil est chargé.
  useEffect(() => {
    setPeriode(coercePeriode(defaultPeriode));
  }, [defaultPeriode]);
  useEffect(() => {
    setFormatDefaut(defaultFormat);
  }, [defaultFormat]);

  // Changement de période : on met à jour le graphe ET on mémorise le choix.
  const changerPeriode = (p: Periode) => {
    setPeriode(p);
    onSavePrefs({ periode: p, format: formatDefaut });
  };

  // Changement de format par défaut : mémorisé pour les prochains envois.
  const changerFormat = (f: "image" | "csv" | "both") => {
    setFormatDefaut(f);
    onSavePrefs({ periode, format: f });
  };

  // Comptage des envois par mois (auto / manuel), toutes périodes confondues. Les
  // récaps de régularité (second email) sont exclus : ils ne doivent pas gonfler le
  // graphe du journal mensuel.
  const compteParMois = useMemo(() => {
    const compte = new Map<string, { auto: number; manuel: number }>();
    historique.forEach((env) => {
      if (env.recap) return;
      const cle = cleDepuisISO(env.envoye_le);
      if (!cle) return;
      const b = compte.get(cle) ?? { auto: 0, manuel: 0 };
      if ((env.mode ?? "").toLowerCase() === "automatique") b.auto += 1;
      else b.manuel += 1;
      compte.set(cle, b);
    });
    return compte;
  }, [historique]);

  const mois: MoisBucket[] = useMemo(() => {
    const cles = Array.from(compteParMois.keys()).sort();
    if (!cles.length) return [];
    // On comble les mois vides entre le premier et le dernier mois observé,
    // afin de visualiser d'éventuels trous dans la régularité des envois.
    const [fy, fm] = cles[0].split("-").map(Number);
    const [ly, lm] = cles[cles.length - 1].split("-").map(Number);
    const out: MoisBucket[] = [];
    let y = fy;
    let m = fm;
    while (y < ly || (y === ly && m <= lm)) {
      const cle = `${y}-${String(m).padStart(2, "0")}`;
      const b = compteParMois.get(cle) ?? { auto: 0, manuel: 0 };
      const cleN1 = `${y - 1}-${String(m).padStart(2, "0")}`;
      const n1 = compteParMois.get(cleN1);
      out.push({
        cle,
        auto: b.auto,
        manuel: b.manuel,
        total: b.auto + b.manuel,
        n1Auto: n1 ? n1.auto : null,
      });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out.slice(-moisDispo);
  }, [compteParMois, moisDispo]);

  // Mois attendus (après le premier envoi automatique, hors mois en cours) restés
  // sans aucun envoi automatique : à signaler comme trou de régularité.
  const moisManquants = useMemo(() => {
    const premierAuto = mois.findIndex((x) => x.auto > 0);
    if (premierAuto === -1) return [];
    const maintenant = new Date();
    const cleCourante = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
    return mois.filter((x, i) => i > premierAuto && x.auto === 0 && x.cle < cleCourante);
  }, [mois]);

  // Ensemble des clés de mois manquants : au filtre actif, seules ces barres restent éclairées.
  const manquantsSet = useMemo(() => new Set(moisManquants.map((m) => m.cle)), [moisManquants]);

  // À l'ouverture depuis l'email (focusManquants), on amène l'alerte des mois manquants
  // au centre de l'écran dès qu'elle est disponible.
  useEffect(() => {
    if (focusManquants && manquantsRef.current) {
      manquantsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusManquants, moisManquants.length]);

  if (mois.length === 0) return null;

  const maxTotal = Math.max(...mois.map((x) => Math.max(x.total, x.n1Auto ?? 0)), 1);
  const totalAuto = mois.reduce((s, x) => s + x.auto, 0);
  const totalManuel = mois.reduce((s, x) => s + x.manuel, 0);
  const moisAvecAuto = mois.filter((x) => x.auto > 0).length;
  const taux = Math.round((moisAvecAuto / mois.length) * 100);
  const emailDispo = Boolean(comptableEmail.trim());
  const aComparaison = mois.some((x) => (x.n1Auto ?? 0) > 0);

  const csvHeaders = ["Mois", "Automatique", "Manuel", "N-1 (auto)", "Total"];
  const csvRows = () => mois.map((x) => [moisLong(x.cle), x.auto, x.manuel, x.n1Auto ?? "", x.total]);

  // Archive CSV des envois auto/manuel par mois (une ligne par mois), téléchargée localement.
  const handleExportCsv = () => {
    const csv = toCsv(csvHeaders, csvRows());
    downloadCsv(`envois-comptable-par-mois-${todayISO()}.csv`, csv);
  };

  // Envoi direct par email au comptable : graphe PNG, CSV, ou les deux, avec commentaire.
  const handleEnvoyer = (format: "image" | "csv" | "both") => {
    setEmailMenu(false);
    if (!emailDispo) return;
    const pieces: RapportPieceJointe[] = [];
    if (format === "image" || format === "both") {
      const dataUrl = buildEnvoisChartImageDataUrl(mois);
      if (!dataUrl) return;
      pieces.push({
        filename: `envois-comptable-par-mois-${todayISO()}.png`,
        base64: dataUrl.split(",")[1] ?? "",
        contentType: "image/png",
      });
    }
    if (format === "csv" || format === "both") {
      pieces.push({
        filename: `envois-comptable-par-mois-${todayISO()}.csv`,
        base64: textToBase64(toCsv(csvHeaders, csvRows())),
        contentType: "text/csv",
      });
    }
    if (!pieces.length) return;
    const commentaireFinal = commentaire.trim();
    // On mémorise le commentaire pour le reproposer tel quel au prochain envoi.
    onSaveCommentaire(commentaireFinal);
    onEnvoyerRapport({ pieces, format, moisCount: mois.length, commentaire: commentaireFinal });
  };

  // Export « mois manquants uniquement » : on ne transmet que les barres des mois
  // restés sans envoi automatique (les trous de régularité), en PNG, CSV, ou au comptable.
  const csvRowsManquants = () =>
    buildManquantsGroupedRows(moisManquants, moisLong, (x) => [x.auto, x.manuel, x.n1Auto ?? "", x.total]);

  const handleExportManquantsCsv = () => {
    const csv = toCsv(csvHeaders, csvRowsManquants());
    downloadCsv(`envois-comptable-mois-manquants-${todayISO()}.csv`, csv);
  };

  const handleEnvoyerManquants = (format: "image" | "csv" | "both") => {
    if (!emailDispo || moisManquants.length === 0) return;
    const pieces: RapportPieceJointe[] = [];
    if (format === "image" || format === "both") {
      const dataUrl = buildEnvoisChartImageDataUrl(moisManquants, { groupByYear: true });
      if (dataUrl) {
        pieces.push({
          filename: `envois-comptable-mois-manquants-${todayISO()}.png`,
          base64: dataUrl.split(",")[1] ?? "",
          contentType: "image/png",
        });
      }
    }
    if (format === "csv" || format === "both") {
      pieces.push({
        filename: `envois-comptable-mois-manquants-${todayISO()}.csv`,
        base64: textToBase64(toCsv(csvHeaders, csvRowsManquants())),
        contentType: "text/csv",
      });
    }
    if (!pieces.length) return;
    onEnvoyerRapport({ pieces, format, moisCount: moisManquants.length, commentaire: commentaire.trim() });
  };

  const periodes: { cle: Periode; label: string }[] = [
    { cle: "6", label: "6 mois" },
    { cle: "12", label: "12 mois" },
    { cle: "24", label: "24 mois" },
  ];

  const formatsDefaut: { cle: "image" | "csv" | "both"; label: string }[] = [
    { cle: "image", label: "Graphe" },
    { cle: "csv", label: "CSV" },
    { cle: "both", label: "Les deux" },
  ];

  return (
    <div className="rounded-md bg-background-50 border border-background-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-bar-chart-2-line"></i>
            Envois par mois
          </p>
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {periodes.map((p) => (
              <button
                key={p.cle}
                type="button"
                onClick={() => changerPeriode(p.cle)}
                aria-pressed={periode === p.cle}
                title={`Afficher les ${p.label} de régularité (choix mémorisé)`}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  periode === p.cle ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {moisManquants.length > 0 && (
            <button
              type="button"
              onClick={() => setManquantsSeul((v) => !v)}
              aria-pressed={manquantsSeul}
              title="N'éclairer que les barres des mois restés sans envoi automatique (trous de régularité)"
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                manquantsSeul ? "bg-accent-500 text-background-50" : "bg-accent-100 text-accent-800 hover:bg-accent-200"
              }`}
            >
              <i className="ri-alert-line"></i>
              Mois manquants ({moisManquants.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 text-foreground-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-500"></span>Auto
            </span>
            <span className="inline-flex items-center gap-1 text-foreground-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-secondary-500"></span>Manuel
            </span>
            {aComparaison && (
              <span className="inline-flex items-center gap-1 text-foreground-600" title="Même mois l'année précédente">
                <span className="w-2.5 h-0.5 rounded-full bg-accent-500"></span>N-1
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background-200 text-foreground-700 font-semibold whitespace-nowrap"
              title={`Taux de régularité : ${moisAvecAuto} mois avec envoi automatique sur ${mois.length}`}
            >
              <i className="ri-refresh-line text-primary-600"></i>
              {taux}% · {totalAuto} auto / {mois.length} mois
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportEnvoisChartImage(mois)}
              title="Archiver le graphe de régularité en image PNG"
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-image-line"></i>
              Image
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              title="Archiver les envois auto/manuel par mois en CSV"
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-file-text-line"></i>
              CSV
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmailMenu((v) => !v)}
                disabled={!emailDispo || envoiBusy}
                aria-haspopup="menu"
                aria-expanded={emailMenu}
                title={
                  emailDispo
                    ? "Envoyer le graphe, le CSV ou les deux au comptable par email"
                    : "Renseignez d'abord l'email du comptable pour envoyer par email"
                }
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-accent-100 border border-accent-200 text-[10px] font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {envoiBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
                Email
                <i className="ri-arrow-down-s-line"></i>
              </button>
              {emailMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-8 z-20 w-64 rounded-md bg-background-50 border border-background-200 shadow-sm overflow-hidden animate-fade-in"
                >
                  <div className="p-3 border-b border-background-200">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">
                        Commentaire (optionnel)
                      </span>
                      <textarea
                        value={commentaire}
                        onChange={(e) => setCommentaire(e.target.value.slice(0, 300))}
                        maxLength={300}
                        rows={2}
                        placeholder="Ex. Récap de régularité à archiver."
                        className="w-full resize-none rounded-md bg-background-100 border border-background-200 px-2 py-1.5 text-[11px] text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                      />
                      <span className="text-[10px] text-foreground-400 text-right">{commentaire.length}/300</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleEnvoyer("both")}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-accent-800 text-left cursor-pointer hover:bg-accent-100 border-b border-background-200"
                  >
                    <i className="ri-attachment-2 text-accent-600"></i>
                    Envoyer graphe + CSV
                    {formatDefaut === "both" && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-accent-700 bg-accent-100 rounded-full px-1.5 py-0.5">
                        défaut
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleEnvoyer("image")}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-foreground-700 text-left cursor-pointer hover:bg-background-100"
                  >
                    <i className="ri-image-line text-accent-600"></i>
                    Envoyer le graphe (PNG)
                    {formatDefaut === "image" && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-accent-700 bg-accent-100 rounded-full px-1.5 py-0.5">
                        défaut
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleEnvoyer("csv")}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-foreground-700 text-left cursor-pointer hover:bg-background-100 border-t border-background-200"
                  >
                    <i className="ri-file-text-line text-accent-600"></i>
                    Envoyer le CSV
                    {formatDefaut === "csv" && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-accent-700 bg-accent-100 rounded-full px-1.5 py-0.5">
                        défaut
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-2 h-28">
        {mois.map((x) => {
          const heightPct = Math.max((x.total / maxTotal) * 100, x.total > 0 ? 6 : 2);
          const autoH = x.total ? (x.auto / x.total) * 100 : 0;
          const manuelH = x.total ? (x.manuel / x.total) * 100 : 0;
          const n1Pct = (x.n1Auto ?? 0) > 0 ? Math.min(((x.n1Auto ?? 0) / maxTotal) * 100, 100) : null;
          const actif = filtreMois === x.cle;
          const estManquant = manquantsSet.has(x.cle);
          const attenue = manquantsSeul && !estManquant;
          return (
            <button
              key={x.cle}
              type="button"
              onClick={() => onSelectMois(x.cle)}
              aria-pressed={actif}
              title={`${moisLong(x.cle)} : ${x.auto} automatique${x.auto > 1 ? "s" : ""}, ${x.manuel} manuel${x.manuel > 1 ? "s" : ""}${
                x.n1Auto != null ? ` · N-1 : ${x.n1Auto} auto` : ""
              }${estManquant ? " · mois sans envoi automatique" : ""}`}
              className={`flex-1 flex flex-col items-center gap-1.5 min-w-0 cursor-pointer group transition-opacity ${
                attenue ? "opacity-25" : "opacity-100"
              }`}
            >
              <span
                className={`text-[10px] font-semibold ${
                  actif ? "text-foreground-950" : x.total > 0 ? "text-foreground-600" : "text-foreground-300"
                }`}
              >
                {x.total > 0 ? x.total : ""}
              </span>
              <div
                className={`relative w-full flex flex-col justify-end rounded-t-md overflow-hidden transition-all ${
                  actif
                    ? "ring-2 ring-secondary-400 bg-background-300/70"
                    : manquantsSeul && estManquant
                      ? "ring-2 ring-accent-500 bg-background-300/70"
                      : "bg-background-200/50 group-hover:bg-background-300/40"
                }`}
                style={{ height: `${heightPct}%` }}
              >
                {autoH > 0 && <div className="w-full bg-primary-500" style={{ height: `${autoH}%` }}></div>}
                {manuelH > 0 && <div className="w-full bg-secondary-500" style={{ height: `${manuelH}%` }}></div>}
                {n1Pct != null && (
                  <span
                    className="absolute left-0 right-0 h-0.5 bg-accent-500"
                    style={{ bottom: `${n1Pct}%` }}
                    aria-hidden="true"
                  ></span>
                )}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  actif ? "text-secondary-700 font-semibold" : "text-foreground-400"
                }`}
              >
                {moisCourt(x.cle)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Préférences d'export mémorisées : période d'archive + format par défaut. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-background-100 border border-background-200 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">
          <i className="ri-settings-3-line"></i>
          Préférences d'export
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-foreground-500">
          Période mémorisée : <strong className="text-foreground-700">{periode} mois</strong>
        </span>
        <span className="w-px h-3 bg-background-300"></span>
        <span className="text-[10px] text-foreground-500">Format par défaut :</span>
        <div className="flex flex-wrap gap-0.5 p-0.5 rounded-full bg-background-50 border border-background-200 w-fit">
          {formatsDefaut.map((f) => (
            <button
              key={f.cle}
              type="button"
              onClick={() => changerFormat(f.cle)}
              aria-pressed={formatDefaut === f.cle}
              title={`Définir « ${f.label} » comme format d'export par défaut (mémorisé)`}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                formatDefaut === f.cle ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
          <i className="ri-save-3-line"></i>
          Mémorisé dans votre profil
        </span>
      </div>

      {moisManquants.length > 0 ? (
        <div
          ref={manquantsRef}
          className={`mt-3 rounded-md border bg-accent-100 px-3 py-2 flex flex-col gap-2 transition-all ${
            focusManquants ? "border-accent-500 ring-2 ring-accent-300" : "border-accent-300"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-900">
              <i className="ri-alert-line"></i>
              {moisManquants.length} mois attendu{moisManquants.length > 1 ? "s" : ""} sans envoi automatique
            </span>
            {focusManquants && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-mail-open-line"></i>
                Ouvert depuis l'email d'alerte
              </span>
            )}
            {onRenvoyerTousMois && (
              <button
                type="button"
                onClick={() => onRenvoyerTousMois(moisManquants.map((x) => x.cle))}
                disabled={Boolean(renvoyerTousBusy) || envoiBusy || Boolean(renvoyerMoisBusyCle)}
                title="Renvoyer maintenant le journal de tous les mois manquants au comptable"
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renvoyerTousBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                Renvoyer tous les mois manquants
              </button>
            )}
            <span className="inline-flex flex-wrap items-center gap-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => exportEnvoisChartImage(moisManquants, { groupByYear: true })}
                title="Exporter en PNG le graphe des mois manquants uniquement (groupés par année)"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-50 border border-accent-300 text-[10px] font-semibold text-accent-900 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
              >
                <i className="ri-image-line"></i>
                PNG manquants
              </button>
              <button
                type="button"
                onClick={handleExportManquantsCsv}
                title="Exporter en CSV les mois manquants uniquement"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-50 border border-accent-300 text-[10px] font-semibold text-accent-900 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
              >
                <i className="ri-file-text-line"></i>
                CSV manquants
              </button>
              <button
                type="button"
                onClick={() => handleEnvoyerManquants(formatDefaut)}
                disabled={!emailDispo || envoiBusy}
                title={
                  emailDispo
                    ? "Envoyer au comptable le graphe/CSV des mois manquants uniquement"
                    : "Renseignez d'abord l'email du comptable pour envoyer par email"
                }
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-accent-500 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {envoiBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
                Envoyer au comptable
              </button>
            </span>
          </div>
          <span className="flex flex-wrap items-center gap-1.5">
            {moisManquants.map((x) => {
              const enRenvoi = renvoyerMoisBusyCle === x.cle;
              return (
                <span
                  key={x.cle}
                  className="inline-flex items-center rounded-full bg-background-50 border border-accent-300 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => onSelectMois(x.cle)}
                    title={`Aucun envoi automatique en ${moisLong(x.cle)} — cliquer pour filtrer l'historique`}
                    className="inline-flex items-center h-6 pl-2 pr-1.5 text-[10px] font-medium text-accent-900 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                  >
                    {moisLong(x.cle)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRenvoyerMois(x.cle)}
                    disabled={Boolean(renvoyerMoisBusyCle) || envoiBusy}
                    title={`Renvoyer maintenant le journal de ${moisLong(x.cle)} au comptable`}
                    className="inline-flex items-center gap-1 h-6 px-2 border-l border-accent-300 text-[10px] font-semibold text-accent-900 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enRenvoi ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                    Renvoyer ce mois
                  </button>
                </span>
              );
            })}
          </span>
          <span className="text-[10px] text-accent-800 inline-flex items-center gap-1">
            <i className="ri-lightbulb-line"></i>
            Cliquez le mois pour le filtrer, ou « Renvoyer ce mois » pour expédier son journal au comptable.
          </span>
        </div>
      ) : (
        <p className="text-[10px] text-foreground-400 mt-2 inline-flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line text-primary-600"></i>
          Aucun mois attendu sans envoi automatique{aComparaison ? " · le trait accent compare avec N-1" : ""}.
        </p>
      )}
    </div>
  );
}