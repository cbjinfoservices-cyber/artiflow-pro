import { useEffect, useMemo, useState } from "react";
import { sendRapportComptableEmail, type ComptableEnvoi, type ComptableExportKind, type DernierBilan, type BilanArchive, type OverrideAdresse } from "@/lib/artisanApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import EnvoisComptableChart, { type RapportComptablePayload } from "@/pages/app/comptabilite/components/EnvoisComptableChart";
import ApercuRecapArtisanModal from "@/pages/app/comptabilite/components/ApercuRecapArtisanModal";
import { buildManquantsGroupedRows, computeMoisManquants, groupRowsByYear } from "@/lib/comptableRegularite";
import { buildEnvoisChartImageDataUrl, exportEnvoisChartImage, type EnvoisChartDatum } from "@/lib/envoisChartImage";
import { buildComptableHistoriquePdf } from "@/lib/comptabilitePdf";
import { savePdf, pdfToBase64 } from "@/lib/pdf";
import BilanArchivageBloc from "@/pages/app/comptabilite/components/BilanArchivageBloc";
import Infobulle from "@/components/base/Infobulle";

interface EnvoiAutoCarteProps {
  /** Envoi automatique activé (réglage actuel). */
  defaultActif: boolean;
  /** Joindre un récap de régularité (graphe + CSV) à chaque envoi automatique. */
  defaultRapportAuto: boolean;
  /** Recevoir aussi une copie du récap de régularité dans sa propre boîte. */
  defaultCopieArtisan: boolean;
  /** Jour du mois (1-28) du prochain envoi. */
  defaultJour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  defaultHeure: number;
  /** Email du comptable déjà mémorisé (destinataire de l'envoi). */
  comptableEmail: string;
  /** Identité de l'émetteur, reprise en tête du PDF d'historique des envois. */
  emetteur: {
    entreprise: string;
    metier?: string;
    telephone?: string;
    email?: string;
    siret?: string | null;
    tva?: string | null;
  };
  /** Email de l'artisan : sert à distinguer, dans l'historique, le récap reçu par l'artisan de celui du comptable. */
  artisanEmail: string;
  /** Dernier mois envoyé automatiquement (clé « AAAA-MM »), ou null. */
  dernierMois: string | null;
  /** Historique des envois du journal au comptable (le plus récent en premier). */
  historique: ComptableEnvoi[];
  /** Historique en cours de chargement. */
  historiqueLoading: boolean;
  /** Dernière adresse ponctuelle utilisée, proposée en suggestion au prochain renvoi. */
  overrideSuggestion: string;
  /** Adresses ponctuelles nommées (ex. « Comptable remplaçant A »), sélectionnables au moment d'un renvoi. */
  overrideAdresses: OverrideAdresse[];
  busy: boolean;
  notice: string | null;
  error: string | null;
  /** Enregistre les réglages d'envoi automatique. */
  onSave: (settings: { actif: boolean; jour: number; heure: number; rapportAuto: boolean; copieArtisan: boolean }) => void;
  /** Déclenche un envoi réel immédiat (mode forcé), pour vérifier le rendu. */
  onTest: () => void;
  /** Envoi de test en cours. */
  testBusy: boolean;
  testNotice: string | null;
  testError: string | null;
  /**
   * Renvoie le journal d'un mois de l'historique au comptable. `overrideTo`, s'il est
   * fourni, expédie le journal à une adresse ponctuelle (ex. expert-comptable remplaçant)
   * sans modifier l'email du comptable mémorisé.
   */
  onRenvoyer: (env: ComptableEnvoi, overrideTo?: string, overrideNom?: string) => void;
  /** Identifiant de la ligne d'historique en cours de renvoi, ou null. */
  renvoyerBusyId: number | null;
  /** Commentaire libre mémorisé, prérempli dans le champ d'envoi de régularité. */
  defaultCommentaire: string;
  /** Mémorise le commentaire pour le réutiliser au prochain envoi au comptable. */
  onSaveCommentaire: (value: string) => void;
  /** Renvoie en un clic le journal d'un mois manquant au comptable (alerte de régularité). */
  onRenvoyerMois: (cle: string) => void;
  /** Mois (« AAAA-MM ») en cours de renvoi depuis l'alerte, ou null. */
  renvoyerMoisBusyCle: string | null;
  /** Renvoie en une seule action le journal de tous les mois manquants. */
  onRenvoyerTousMois?: (cles: string[]) => void;
  /** Ouvre la carte avec l'alerte de régularité dépliée sur les mois manquants. */
  focusManquants?: boolean;
  /** Préférences d'export mémorisées du mini-graphe (période « 6 » / « 12 » / « 24 »). */
  exportPeriode: string;
  /** Format d'export par défaut mémorisé du mini-graphe. */
  exportFormat: "image" | "csv" | "both";
  /** Mémorise les préférences d'export du mini-graphe. */
  onSaveExportPrefs: (prefs: { periode: string; format: "image" | "csv" | "both" }) => void;
  /** Dernier type d'export de l'historique mémorisé, mis en avant et reproposé à la prochaine visite. */
  defaultExportDernier: string;
  /** Mémorise le dernier type d'export de l'historique utilisé, pour le reproposer plus tard. */
  onSaveDernierExport: (kind: ComptableExportKind) => void;
  /** Alerte à l'artisan activée quand un mois attendu reste sans envoi automatique. */
  defaultRelanceManquanteActif: boolean;
  /** Délai (jours) après le jour d'envoi avant de prévenir l'artisan. */
  defaultRelanceDelai: number;
  /** Enregistre le réglage de l'alerte à l'artisan. */
  onSaveRelanceManquante: (settings: { actif: boolean; delai: number }) => Promise<void>;
  /**
   * Envoie tout de suite l'email d'alerte à l'artisan (test), pour vérifier le rendu
   * sans attendre un vrai mois manquant.
   */
  onTestRelance: () => Promise<{ sent: number; configured: boolean; reason?: string }>;
  /** Envoi automatique du bilan d'archivage annuel activé. */
  defaultBilanActif: boolean;
  /** Jour du mois de janvier (1-28) où part le bilan d'archivage. */
  defaultBilanJour: number;
  /** Recevoir aussi une copie du bilan d'archivage dans sa propre boîte. */
  defaultBilanCopieArtisan: boolean;
  /** Enregistre le réglage du bilan d'archivage annuel. */
  onSaveBilan: (settings: { actif: boolean; jour: number; copieArtisan: boolean }) => Promise<void>;
  /**
   * Envoie tout de suite le bilan d'archivage au comptable, pour vérifier le rendu
   * sans attendre la fenêtre de fin d'année.
   */
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
  onEnvoyerBilan: (annee: string, overrideTo?: string) => Promise<{ sent: number; configured: boolean; reason?: string }>;
  /** Dernier bilan d'archivage envoyé (date + exercice), affiché dans le bloc bilan. */
  dernierBilan: DernierBilan | null;
  /** Liste des bilans d'archivage déjà envoyés (un par exercice), pour le téléchargement direct. */
  bilans: BilanArchive[];
  /** Chargement du dernier bilan en cours. */
  bilanLoading: boolean;
  /** Recharge la date du dernier bilan après un envoi de test. */
  onReloadDernierBilan: () => void;
  /**
   * Mois (« AAAA-MM ») pré-filtré à l'ouverture, transmis par le lien « Renvoyer ce mois »
   * d'un email d'alerte : l'historique s'ouvre déjà restreint à ce mois.
   */
  initialFiltreMois?: string;
}

/** Libellé d'une heure pleine (« 08 h »). */
function heureLabel(h: number): string {
  return `${String(h).padStart(2, "0")} h`;
}

/** Libellé « septembre 2026 » à partir d'une clé « AAAA-MM ». */
function moisLabel(key: string): string {
  const [y, m] = key.split("-").map((v) => Number(v));
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Clé « AAAA-MM » à partir d'une date ISO d'envoi, ou null. */
function cleDepuisISO(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Date et heure d'un envoi (« 12 oct. 2026 à 08:00 »). */
function dateHeureLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

type FiltreMode = "tous" | "automatique" | "manuel" | "recap" | "manquants";
type FiltreMois = "tous" | string;
/** Filtre destinataire des récaps de régularité : reçus par l'artisan ou envoyés au comptable. */
type FiltreDest = "tous" | "moi" | "comptable";

/**
 * Carte de réglage de l'envoi automatique mensuel : active/désactive l'envoi du
 * journal du mois écoulé au comptable, choisit le jour du mois et l'heure, permet
 * un envoi de test immédiat (pour vérifier le rendu avant de compter sur la tâche
 * planifiée) et affiche l'historique des envois déjà effectués — filtrable par
 * origine (automatique / manuel) et par mois/année, et exportable en CSV.
 */
export default function EnvoiAutoCarte({
  defaultActif,
  defaultRapportAuto,
  defaultCopieArtisan,
  defaultJour,
  defaultHeure,
  comptableEmail,
  emetteur,
  artisanEmail,
  dernierMois,
  historique,
  historiqueLoading,
  overrideSuggestion,
  overrideAdresses,
  busy,
  notice,
  error,
  onSave,
  onTest,
  testBusy,
  testNotice,
  testError,
  onRenvoyer,
  renvoyerBusyId,
  defaultCommentaire,
  onSaveCommentaire,
  onRenvoyerMois,
  renvoyerMoisBusyCle,
  onRenvoyerTousMois,
  focusManquants,
  exportPeriode,
  exportFormat,
  onSaveExportPrefs,
  defaultExportDernier,
  onSaveDernierExport,
  defaultRelanceManquanteActif,
  defaultRelanceDelai,
  onSaveRelanceManquante,
  onTestRelance,
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
  initialFiltreMois,
}: EnvoiAutoCarteProps) {
  const [actif, setActif] = useState(defaultActif);
  const [rapportAuto, setRapportAuto] = useState(defaultRapportAuto);
  const [copieArtisan, setCopieArtisan] = useState(defaultCopieArtisan);
  const [jour, setJour] = useState(defaultJour);
  const [heure, setHeure] = useState(defaultHeure);
  const [filtre, setFiltre] = useState<FiltreMode>("tous");
  const [filtreMois, setFiltreMois] = useState<FiltreMois>(
    initialFiltreMois && /^\d{4}-\d{2}$/.test(initialFiltreMois) ? initialFiltreMois : "tous",
  );
  // Filtre par exercice (« AAAA »), piloté par les puces du récap d'archivage.
  const [filtreAnnee, setFiltreAnnee] = useState<string>("tous");
  // Ligne dont le panneau « renvoyer à une autre adresse » est ouvert.
  const [overrideForId, setOverrideForId] = useState<number | null>(null);
  const [overrideEmail, setOverrideEmail] = useState("");
  // Libellé de l'adresse ponctuelle choisie (ex. « Cabinet externe »), pour tracer le remplacement.
  const [overrideNom, setOverrideNom] = useState("");
  // Récap « lignes transmises » déplié : liste des mois et leur total de lignes.
  const [lignesOuvert, setLignesOuvert] = useState(false);
  // Envoi direct du graphe / CSV de régularité au comptable par email.
  const [rapportBusy, setRapportBusy] = useState(false);
  const [rapportNotice, setRapportNotice] = useState<string | null>(null);
  const [rapportError, setRapportError] = useState<string | null>(null);
  // Choix du périmètre d'envoi de l'historique au comptable (PDF filtré / complet).
  const [envoiHistoOpen, setEnvoiHistoOpen] = useState(false);
  // Aperçu (sans envoi) de l'email de régularité, pour valider le texte avant tout envoi réel.
  // L'audience distingue l'email dédié à l'artisan de celui transmis au comptable.
  const [apercuRecapOpen, setApercuRecapOpen] = useState(false);
  const [apercuRecapAudience, setApercuRecapAudience] = useState<"artisan" | "comptable">("artisan");
  // Filtre destinataire : isoler les récaps reçus par l'artisan de ceux partis au comptable.
  const [filtreDest, setFiltreDest] = useState<FiltreDest>("tous");
  const suggestion = overrideSuggestion.trim();
  // Réglage de l'alerte à l'artisan quand un mois attendu reste sans envoi automatique.
  const [relanceActif, setRelanceActif] = useState(defaultRelanceManquanteActif);
  const [relanceDelai, setRelanceDelai] = useState(defaultRelanceDelai);
  const [relanceBusy, setRelanceBusy] = useState(false);
  const [relanceNotice, setRelanceNotice] = useState<string | null>(null);
  const [relanceError, setRelanceError] = useState<string | null>(null);
  // Test immédiat de l'email d'alerte artisan (vérifier le rendu sans attendre un mois manquant).
  const [relanceTestBusy, setRelanceTestBusy] = useState(false);
  const [relanceTestNotice, setRelanceTestNotice] = useState<string | null>(null);
  const [relanceTestError, setRelanceTestError] = useState<string | null>(null);
  // Bilan d'archivage annuel : historique complet transmis au comptable en fin d'année.

  useEffect(() => {
    setActif(defaultActif);
    setRapportAuto(defaultRapportAuto);
    setCopieArtisan(defaultCopieArtisan);
    setJour(defaultJour);
    setHeure(defaultHeure);
  }, [defaultActif, defaultRapportAuto, defaultCopieArtisan, defaultJour, defaultHeure]);

  useEffect(() => {
    setRelanceActif(defaultRelanceManquanteActif);
    setRelanceDelai(defaultRelanceDelai);
  }, [defaultRelanceManquanteActif, defaultRelanceDelai]);

  // Quand un exercice est filtré, on restreint la liste des mois à cet exercice :
  // un mois hors exercice ne peut pas rester sélectionné.
  useEffect(() => {
    if (filtreAnnee !== "tous" && filtreMois !== "tous" && !filtreMois.startsWith(filtreAnnee)) {
      setFiltreMois("tous");
    }
  }, [filtreAnnee, filtreMois]);

  const dirty =
    actif !== defaultActif ||
    rapportAuto !== defaultRapportAuto ||
    copieArtisan !== defaultCopieArtisan ||
    jour !== defaultJour ||
    heure !== defaultHeure;
  const relanceDirty = relanceActif !== defaultRelanceManquanteActif || relanceDelai !== defaultRelanceDelai;
  const emailManquant = !comptableEmail.trim();

  // Dernier type d'export mémorisé : mis en avant et reproposé à la prochaine visite.
  const dernierExport: ComptableExportKind | null = (
    ["csv-filtre", "csv-complet", "pdf-filtre", "pdf-complet", "bilan"] as ComptableExportKind[]
  ).includes(defaultExportDernier as ComptableExportKind)
    ? (defaultExportDernier as ComptableExportKind)
    : null;
  const exportKindLabel: Record<ComptableExportKind, string> = {
    "csv-filtre": "CSV filtré",
    "csv-complet": "CSV complet",
    "pdf-filtre": "PDF filtré",
    "pdf-complet": "PDF complet",
    bilan: "Bilan d'archivage",
  };

  // Distingue le journal mensuel (auto / manuel) des récaps de régularité (second email).
  const isRecap = (env: ComptableEnvoi) => env.recap;
  const isAuto = (env: ComptableEnvoi) => !env.recap && (env.mode ?? "").toLowerCase() === "automatique";
  const isManuel = (env: ComptableEnvoi) => !env.recap && (env.mode ?? "").toLowerCase() !== "automatique";
  // Ce récap a-t-il été adressé à l'artisan lui-même (email dédié) plutôt qu'au comptable ?
  const estVersMoi = (env: ComptableEnvoi) =>
    Boolean(artisanEmail.trim()) && (env.destinataire ?? "").trim().toLowerCase() === artisanEmail.trim().toLowerCase();
  // Destinataire lisible d'un envoi, pour la colonne « Vers (moi / comptable) » du CSV :
  // les récaps partent soit à l'artisan (email dédié), soit au comptable ; les journaux mensuels au comptable.
  const versLabel = (env: ComptableEnvoi): string =>
    env.recap ? (estVersMoi(env) ? "Moi" : "Comptable") : "Comptable";

  const nbAuto = useMemo(() => historique.filter(isAuto).length, [historique]);
  const nbManuel = useMemo(() => historique.filter(isManuel).length, [historique]);
  const nbRecap = useMemo(() => historique.filter(isRecap).length, [historique]);
  const nbRecapMoi = useMemo(() => historique.filter((e) => isRecap(e) && estVersMoi(e)).length, [historique, artisanEmail]);
  const nbRecapComptable = Math.max(0, nbRecap - nbRecapMoi);
  // Mois attendus restés sans envoi automatique (les « trous » de régularité), pour le
  // filtre « Mois manquants » de l'historique.
  const moisManquantsList = useMemo(() => computeMoisManquants(historique), [historique]);
  const nbManquants = moisManquantsList.length;

  // Mois/année disponibles dans l'historique (d'après la date d'envoi), regroupés par année.
  const moisOptions = useMemo(() => {
    const compte = new Map<string, number>();
    historique.forEach((env) => {
      const cle = cleDepuisISO(env.envoye_le);
      if (cle) compte.set(cle, (compte.get(cle) ?? 0) + 1);
    });
    const cles = Array.from(compte.keys()).sort((a, b) => b.localeCompare(a));
    const parAnnee: { annee: string; mois: { cle: string; label: string; compte: number }[] }[] = [];
    cles.forEach((cle) => {
      const annee = cle.slice(0, 4);
      let groupe = parAnnee.find((g) => g.annee === annee);
      if (!groupe) {
        groupe = { annee, mois: [] };
        parAnnee.push(groupe);
      }
      groupe.mois.push({ cle, label: moisLabel(cle), compte: compte.get(cle) ?? 0 });
    });
    return parAnnee;
  }, [historique]);

  // Historique restreint au filtre Automatique / Manuel, puis au mois/année choisi.
  const historiqueFiltre = useMemo(() => {
    // Le filtre « Mois manquants » ne correspond à aucune ligne d'envoi : les trous sont
    // listés à part (lignes synthétiques), donc rien à renvoyer ici.
    if (filtre === "manquants") return [];
    let base = historique;
    if (filtre === "automatique") base = base.filter(isAuto);
    else if (filtre === "manuel") base = base.filter(isManuel);
    else if (filtre === "recap") base = base.filter(isRecap);
    // Filtre destinataire : ne garde que les récaps et les restreint à ceux reçus par
    // l'artisan (« moi ») ou transmis au comptable.
    if (filtreDest !== "tous") {
      base = base.filter((e) => isRecap(e) && (filtreDest === "moi" ? estVersMoi(e) : !estVersMoi(e)));
    }
    if (filtreAnnee !== "tous") base = base.filter((e) => cleDepuisISO(e.envoye_le)?.slice(0, 4) === filtreAnnee);
    if (filtreMois !== "tous") base = base.filter((e) => cleDepuisISO(e.envoye_le) === filtreMois);
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historique, filtre, filtreMois, filtreAnnee, filtreDest, artisanEmail]);

  const filtreMoisActif = filtreMois !== "tous";
  const filtreAnneeActif = filtreAnnee !== "tous";
  const filtreActif = filtre !== "tous" || filtreMoisActif || filtreAnneeActif || filtreDest !== "tous";

  // Récap du périmètre sélectionné : nombre d'envois et total de lignes transmises.
  const recapSelection = useMemo(() => {
    let totalLignes = 0;
    let avecDetail = 0;
    historiqueFiltre.forEach((env) => {
      // Les récaps de régularité comptent des mois, pas des lignes de journal : on les exclut.
      if (isRecap(env)) return;
      if (env.lignes != null) {
        totalLignes += env.lignes;
        avecDetail += 1;
      }
    });
    return { nbEnvois: historiqueFiltre.length, totalLignes, avecDetail };
  }, [historiqueFiltre]);

  // Détail par mois du périmètre affiché : total de lignes transmises par mois.
  const recapParMois = useMemo(() => {
    const map = new Map<string, { cle: string; nbEnvois: number; totalLignes: number; sansDetail: number }>();
    historiqueFiltre.forEach((env) => {
      if (isRecap(env)) return;
      const cle = cleDepuisISO(env.envoye_le) ?? "inconnu";
      const b = map.get(cle) ?? { cle, nbEnvois: 0, totalLignes: 0, sansDetail: 0 };
      b.nbEnvois += 1;
      if (env.lignes != null) b.totalLignes += env.lignes;
      else b.sansDetail += 1;
      map.set(cle, b);
    });
    return Array.from(map.values()).sort((a, b) => b.cle.localeCompare(a.cle));
  }, [historiqueFiltre]);

  // Récap d'archivage par année (sur tout l'historique) : nombre d'envois et total de
  // lignes transmises par exercice, plus le total général — lisible sans ouvrir le CSV.
  const recapArchivage = useMemo(() => {
    const map = new Map<string, { annee: string; nbEnvois: number; totalLignes: number }>();
    historique.forEach((env) => {
      const an = cleDepuisISO(env.envoye_le)?.slice(0, 4) ?? "Inconnue";
      const b = map.get(an) ?? { annee: an, nbEnvois: 0, totalLignes: 0 };
      b.nbEnvois += 1;
      if (!env.recap && env.lignes != null) b.totalLignes += env.lignes;
      map.set(an, b);
    });
    const annees = Array.from(map.values()).sort((a, b) => b.annee.localeCompare(a.annee));
    const total = annees.reduce(
      (acc, a) => ({ nbEnvois: acc.nbEnvois + a.nbEnvois, totalLignes: acc.totalLignes + a.totalLignes }),
      { nbEnvois: 0, totalLignes: 0 },
    );
    return { annees, total };
  }, [historique]);

  // Ligne d'historique au format attendu par le PDF (colonnes identiques à l'export CSV).
  const historiqueEnLignePdf = (env: ComptableEnvoi) => ({
    mois: env.recap ? "Récap de régularité" : env.mois ?? "Journal comptable",
    date: env.envoye_le ? dateHeureLabel(env.envoye_le) : "",
    mode: (env.mode ?? "").toLowerCase() === "automatique" ? "Automatique" : "Manuel",
    lignes: env.lignes != null ? String(env.lignes) : "",
    destinataire: env.destinataire ?? "",
    type: env.recap ? "Récap régularité" : "Journal comptable",
    vers: versLabel(env),
  });

  // Cellules de l'historique (colonnes après le libellé), réutilisées par les deux exports CSV.
  const historiqueCells = (env: ComptableEnvoi, avecObjet: boolean): (string | number)[] => {
    const cells: (string | number)[] = [
      env.envoye_le ? dateHeureLabel(env.envoye_le) : "",
      (env.mode ?? "").toLowerCase() === "automatique" ? "Automatique" : "Manuel",
      env.lignes != null ? env.lignes : "",
      env.destinataire ?? "",
    ];
    if (avecObjet) cells.push(env.sujet ?? "");
    cells.push(env.recap ? "Récap régularité" : "Journal comptable", versLabel(env));
    return cells;
  };

  // Année d'un envoi pour le regroupement (« AAAA »), ou « Inconnue » si la date manque.
  const anneeEnvoi = (env: ComptableEnvoi): string => cleDepuisISO(env.envoye_le)?.slice(0, 4) ?? "Inconnue";

  // Export CSV de l'historique affiché, regroupé par année (année + sous-total + total),
  // comme l'export des mois manquants : lisible sur les longues séries d'archives.
  const handleExportCsv = () => {
    onSaveDernierExport("csv-filtre");
    const rows = groupRowsByYear(
      historiqueFiltre,
      anneeEnvoi,
      (env) => (env.recap ? "Récap de régularité" : env.mois ?? "Journal comptable"),
      (env) => historiqueCells(env, false),
    );
    const csv = toCsv(
      ["Mois / Année", "Date", "Mode", "Lignes", "Destinataire", "Type", "Vers (moi / comptable)"],
      rows,
    );
    const suffixe = filtre === "tous" ? "" : `-${filtre}`;
    const suffixeMois = filtreMoisActif ? `-${filtreMois}` : "";
    downloadCsv(`historique-envois-comptable-${todayISO()}${suffixe}${suffixeMois}.csv`, csv);
  };

  // Export CSV de l'historique COMPLET (tous mois, toutes origines, sans filtre) pour
  // l'archivage long terme : une ligne par envoi, avec l'objet de l'email en plus,
  // regroupé par année avec sous-total.
  const handleExportCsvComplet = () => {
    onSaveDernierExport("csv-complet");
    const rows = groupRowsByYear(
      historique,
      anneeEnvoi,
      (env) => (env.recap ? "Récap de régularité" : env.mois ?? "Journal comptable"),
      (env) => historiqueCells(env, true),
    );
    const csv = toCsv(
      ["Mois / Année", "Date", "Mode", "Lignes", "Destinataire", "Objet", "Type", "Vers (moi / comptable)"],
      rows,
    );
    downloadCsv(`historique-complet-envois-comptable-${todayISO()}.csv`, csv);
  };

  // Export PDF de l'historique affiché (périmètre filtré) : document cohérent avec l'export
  // CSV, avec la colonne « Vers (moi / comptable) » pour retrouver les récaps reçus.
  const handleExportPdf = () => {
    setRapportNotice(null);
    setRapportError(null);
    if (historiqueFiltre.length === 0) return;
    onSaveDernierExport("pdf-filtre");
    try {
      const lignes = historiqueFiltre.map(historiqueEnLignePdf);
      const pdfFiltreLabel = [
        filtre === "tous"
          ? "Tous les envois"
          : filtre === "automatique"
            ? "Automatiques"
            : filtre === "manuel"
              ? "Manuels"
              : filtre === "recap"
                ? "Récaps"
                : "Mois manquants",
        filtreMoisActif ? moisLabel(filtreMois) : null,
        filtreDest !== "tous" ? (filtreDest === "moi" ? "Récap : à moi" : "Récap : au comptable") : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const doc = buildComptableHistoriquePdf({ emetteur, filtreLabel: pdfFiltreLabel, lignes });
      const suffixe = filtre === "tous" ? "" : `-${filtre}`;
      const suffixeMois = filtreMoisActif ? `-${filtreMois}` : "";
      savePdf(doc, `historique-envois-comptable-${todayISO()}${suffixe}${suffixeMois}.pdf`);
      setRapportNotice(`Historique exporté en PDF (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}).`);
    } catch {
      setRapportError("L'export PDF de l'historique a échoué. Réessayez.");
    }
  };

  // Export PDF de l'historique COMPLET (tous mois, non filtré), en plus du PDF du périmètre
  // filtré : un document d'archivage global, avec la même colonne « Vers (moi / comptable) ».
  const handleExportPdfComplet = () => {
    setRapportNotice(null);
    setRapportError(null);
    if (historique.length === 0) return;
    onSaveDernierExport("pdf-complet");
    try {
      const lignes = historique.map(historiqueEnLignePdf);
      const doc = buildComptableHistoriquePdf({
        emetteur,
        filtreLabel: "Historique complet (tous les mois)",
        lignes,
      });
      savePdf(doc, `historique-complet-envois-comptable-${todayISO()}.pdf`);
      setRapportNotice(`Historique complet exporté en PDF (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}).`);
    } catch {
      setRapportError("L'export PDF complet de l'historique a échoué. Réessayez.");
    }
  };

  // Export PDF du bilan d'archivage : le même document que celui transmis automatiquement en
  // fin d'année (historique de l'exercice, récap par destinataire), pour l'exercice filtré —
  // ou le plus récent disponible à défaut de filtre.
  const handleExportBilan = () => {
    setRapportNotice(null);
    setRapportError(null);
    const annee = filtreAnneeActif ? filtreAnnee : recapArchivage.annees[0]?.annee ?? "";
    const source = annee
      ? historique.filter((e) => cleDepuisISO(e.envoye_le)?.slice(0, 4) === annee)
      : historique;
    if (source.length === 0) return;
    onSaveDernierExport("bilan");
    try {
      const lignes = source.map(historiqueEnLignePdf);
      const doc = buildComptableHistoriquePdf({
        emetteur,
        filtreLabel: annee ? `Exercice ${annee}` : "Historique complet (tous les mois)",
        lignes,
        titre: "BILAN D'ARCHIVAGE ANNUEL",
        sousTitre: "Historique des envois comptables de l'exercice",
        piedLabel: "Bilan d'archivage généré avec ArtiFlow-pro",
      });
      savePdf(doc, `bilan-archivage-envois-comptable-${annee || todayISO()}.pdf`);
      setRapportNotice(
        `Bilan d'archivage${annee ? ` de l'exercice ${annee}` : ""} exporté en PDF (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}).`,
      );
    } catch {
      setRapportError("L'export du bilan d'archivage a échoué. Réessayez.");
    }
  };

  // Télécharge le PDF du bilan d'archivage d'un exercice donné, depuis la liste des
  // bilans déjà envoyés : même document que l'envoi automatique de fin d'année.
  const handleDownloadBilan = (annee: string) => {
    setRapportNotice(null);
    setRapportError(null);
    const source = annee
      ? historique.filter((e) => cleDepuisISO(e.envoye_le)?.slice(0, 4) === annee)
      : historique;
    if (source.length === 0) {
      setRapportError(`Aucun envoi comptable à archiver pour l'exercice ${annee || "—"}.`);
      return;
    }
    onSaveDernierExport("bilan");
    try {
      const lignes = source.map(historiqueEnLignePdf);
      const doc = buildComptableHistoriquePdf({
        emetteur,
        filtreLabel: annee ? `Exercice ${annee}` : "Historique complet (tous les mois)",
        lignes,
        titre: "BILAN D'ARCHIVAGE ANNUEL",
        sousTitre: "Historique des envois comptables de l'exercice",
        piedLabel: "Bilan d'archivage généré avec ArtiFlow-pro",
      });
      savePdf(doc, `bilan-archivage-envois-comptable-${annee || todayISO()}.pdf`);
      setRapportNotice(
        `Bilan d'archivage${annee ? ` de l'exercice ${annee}` : ""} téléchargé (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}).`,
      );
    } catch {
      setRapportError("Le téléchargement du bilan d'archivage a échoué. Réessayez.");
    }
  };

  // Relance le dernier export mémorisé, pour le reproposer d'un clic à la prochaine visite.
  const runExport = (kind: ComptableExportKind) => {
    if (kind === "csv-filtre") handleExportCsv();
    else if (kind === "csv-complet") handleExportCsvComplet();
    else if (kind === "pdf-filtre") handleExportPdf();
    else if (kind === "bilan") handleExportBilan();
    else handleExportPdfComplet();
  };

  // Envoie l'historique des envois au comptable par email, avec le PDF en pièce jointe :
  // soit le périmètre filtré affiché, soit l'historique complet (archivage).
  const handleEnvoyerHistorique = async (scope: "filtre" | "complet") => {
    const to = comptableEmail.trim();
    if (!to) {
      setRapportError("Renseignez d'abord l'email du comptable ci-dessus pour envoyer par email.");
      return;
    }
    const source = scope === "complet" ? historique : historiqueFiltre;
    if (source.length === 0) return;
    setRapportBusy(true);
    setRapportNotice(null);
    setRapportError(null);
    try {
      const lignes = source.map(historiqueEnLignePdf);
      const filtreLabel =
        scope === "complet"
          ? "Historique complet (tous les mois)"
          : [
              filtre === "tous"
                ? "Tous les envois"
                : filtre === "automatique"
                  ? "Automatiques"
                  : filtre === "manuel"
                    ? "Manuels"
                    : filtre === "recap"
                      ? "Récaps"
                      : "Mois manquants",
              filtreMoisActif ? moisLabel(filtreMois) : null,
              filtreDest !== "tous" ? (filtreDest === "moi" ? "Récap : à moi" : "Récap : au comptable") : null,
            ]
              .filter(Boolean)
              .join(" · ");
      const doc = buildComptableHistoriquePdf({ emetteur, filtreLabel, lignes });
      const base64 = pdfToBase64(doc);
      const filename =
        scope === "complet"
          ? `historique-complet-envois-comptable-${todayISO()}.pdf`
          : `historique-envois-comptable-${todayISO()}.pdf`;
      await sendRapportComptableEmail({
        to,
        attachments: [{ filename, content: base64, contentType: "application/pdf" }],
        periodeLabel: scope === "complet" ? "Historique complet (tous les mois)" : filtreLabel,
        format: "pdf",
      });
      setRapportNotice(
        `${scope === "complet" ? "Historique complet" : "Historique"} (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}) envoyé à ${to}, avec le PDF en pièce jointe.`,
      );
      setEnvoiHistoOpen(false);
    } catch (e) {
      setRapportError(e instanceof Error ? e.message : "L'envoi de l'historique a échoué. Réessayez.");
    } finally {
      setRapportBusy(false);
    }
  };

  // Expédie le graphe de régularité (PNG), l'export CSV, ou les deux, directement au
  // comptable, en une seule action depuis le mini-graphe, avec un commentaire libre.
  const handleEnvoyerRapport = async (payload: RapportComptablePayload) => {
    const to = comptableEmail.trim();
    if (!to) {
      setRapportError("Renseignez d'abord l'email du comptable ci-dessus pour envoyer par email.");
      return;
    }
    setRapportBusy(true);
    setRapportNotice(null);
    setRapportError(null);
    try {
      await sendRapportComptableEmail({
        to,
        attachments: payload.pieces.map((p) => ({
          filename: p.filename,
          content: p.base64,
          contentType: p.contentType,
        })),
        periodeLabel: `${payload.moisCount} mois`,
        format: payload.format,
        moisCount: payload.moisCount,
        commentaire: payload.commentaire,
      });
      const libelle =
        payload.format === "both"
          ? `Graphe + CSV de régularité (${payload.moisCount} mois)`
          : payload.format === "image"
            ? `Graphe de régularité (${payload.moisCount} mois)`
            : `Export CSV de régularité (${payload.moisCount} mois)`;
      setRapportNotice(`${libelle} envoyé à ${to}.`);
    } catch (e) {
      setRapportError(e instanceof Error ? e.message : "L'envoi au comptable a échoué. Réessayez.");
    } finally {
      setRapportBusy(false);
    }
  };

  // Ouvre l'aperçu de l'email de régularité pour l'audience choisie (artisan ou comptable),
  // sans rien envoyer.
  const openApercu = (audience: "artisan" | "comptable") => {
    setApercuRecapAudience(audience);
    setApercuRecapOpen(true);
  };

  // Données du graphe restreintes aux mois manquants (aucun envoi automatique), reconstruites
  // depuis l'historique pour permettre leur export PNG / CSV / email directement depuis le
  // filtre « Mois manquants » de l'historique (en plus du mini-graphe).
  const manquantsChartData = useMemo<EnvoisChartDatum[]>(() => {
    return moisManquantsList.map((cle) => {
      const manuel = historique.filter(
        (e) => !isRecap(e) && cleDepuisISO(e.envoye_le) === cle && (e.mode ?? "").toLowerCase() !== "automatique",
      ).length;
      return { cle, auto: 0, manuel, total: manuel, n1Auto: null };
    });
  }, [moisManquantsList, historique]);

  const csvManquantsHeaders = ["Mois", "Automatique", "Manuel", "Total"];
  // Regroupement par année avec sous-total : utile pour les longues séries de mois manquants.
  const csvManquantsRows = () =>
    buildManquantsGroupedRows(manquantsChartData, moisLabel, (x) => [x.auto, x.manuel, x.total]);

  // Archive CSV des mois manquants uniquement (téléchargement local), groupée par année.
  const handleExportManquantsCsv = () => {
    const csv = toCsv(csvManquantsHeaders, csvManquantsRows());
    downloadCsv(`envois-comptable-mois-manquants-${todayISO()}.csv`, csv);
  };

  // Archive PNG du graphe des mois manquants uniquement (téléchargement local).
  const handleExportManquantsPng = () => {
    exportEnvoisChartImage(manquantsChartData, { groupByYear: true });
  };

  // Envoie au comptable le graphe des mois manquants uniquement (PNG), en une action.
  const handleEnvoyerManquants = () => {
    const to = comptableEmail.trim();
    if (!to || manquantsChartData.length === 0) return;
    const dataUrl = buildEnvoisChartImageDataUrl(manquantsChartData, { groupByYear: true });
    if (!dataUrl) return;
    void handleEnvoyerRapport({
      pieces: [
        {
          filename: `envois-comptable-mois-manquants-${todayISO()}.png`,
          base64: dataUrl.split(",")[1] ?? "",
          contentType: "image/png",
        },
      ],
      format: "image",
      moisCount: manquantsChartData.length,
      commentaire: "",
    });
  };

  // Enregistre le réglage de l'alerte à l'artisan (mois attendu resté sans envoi automatique).
  const handleSaveRelance = async () => {
    setRelanceNotice(null);
    setRelanceError(null);
    setRelanceBusy(true);
    try {
      await onSaveRelanceManquante({ actif: relanceActif, delai: relanceDelai });
      setRelanceNotice(
        relanceActif
          ? `Alerte activée : vous serez prévenu ${relanceDelai} jour${relanceDelai > 1 ? "s" : ""} après le jour d'envoi si un mois reste sans envoi automatique.`
          : "Alerte désactivée : vous ne serez plus prévenu en cas de mois manquant.",
      );
    } catch {
      setRelanceError("L'enregistrement du réglage d'alerte a échoué. Réessayez.");
    } finally {
      setRelanceBusy(false);
    }
  };

  // Envoie tout de suite l'email d'alerte à l'artisan, pour vérifier le rendu sans
  // attendre un vrai mois manquant.
  const handleTestRelance = async () => {
    setRelanceTestNotice(null);
    setRelanceTestError(null);
    setRelanceTestBusy(true);
    try {
      const res = await onTestRelance();
      if (res.sent > 0) {
        setRelanceTestNotice("Email d'alerte de test envoyé à votre adresse : vérifiez la réception et le rendu.");
      } else if (!res.configured) {
        setRelanceTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour tester l'alerte.");
      } else {
        setRelanceTestError(res.reason || "Le test de l'alerte n'a rien pu expédier. Vérifiez l'email de votre profil.");
      }
    } catch (e) {
      setRelanceTestError(e instanceof Error ? e.message : "Le test de l'alerte a échoué. Réessayez.");
    } finally {
      setRelanceTestBusy(false);
    }
  };

  const ouvrirOverride = (env: ComptableEnvoi) => {
    const suivant = overrideForId === env.id ? null : env.id;
    setOverrideForId(suivant);
    // À l'ouverture, on propose en suggestion la dernière adresse ponctuelle utilisée.
    setOverrideEmail(suivant === null ? "" : suggestion);
    // Si la suggestion correspond à une adresse nommée, on pré-sélectionne son libellé.
    const connue = overrideAdresses.find((a) => a.email.trim().toLowerCase() === suggestion.trim().toLowerCase());
    setOverrideNom(suivant === null ? "" : connue?.nom ?? "");
  };

  const historiqueVisible = historiqueFiltre.slice(0, 24);

  // Remet tous les filtres de la carte à zéro : origine (auto / manuel), mois, année et destinataire.
  const reinitialiserTousFiltres = () => {
    setFiltre("tous");
    setFiltreMois("tous");
    setFiltreAnnee("tous");
    setFiltreDest("tous");
  };

  const filtres: { cle: FiltreMode; label: string; compte: number }[] = [
    { cle: "tous", label: "Tous", compte: historique.length },
    { cle: "automatique", label: "Automatique", compte: nbAuto },
    { cle: "manuel", label: "Manuel", compte: nbManuel },
  ];
  if (nbRecap > 0) filtres.push({ cle: "recap", label: "Récap", compte: nbRecap });
  if (nbManquants > 0) filtres.push({ cle: "manquants", label: "Mois manquants", compte: nbManquants });

  return (
    <div
      className="rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
          <i className="ri-calendar-schedule-line text-xl"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-semibold text-base text-foreground-950">Envoi automatique mensuel</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Le journal comptable du <strong className="text-foreground-700">mois écoulé</strong> (devis, factures,
            paiements + TVA par taux) est envoyé tout seul à votre comptable, le jour et à l'heure que vous choisissez.
          </p>
        </div>
        <Infobulle
          contenu="Activez pour que le journal du mois écoulé part tout seul à votre comptable, le jour et à l'heure que vous choisissez."
          position="gauche"
          largeur={260}
        >
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            onClick={() => setActif((v) => !v)}
            disabled={busy || emailManquant}
            title={emailManquant ? "Renseignez d'abord l'email du comptable ci-dessus" : undefined}
            className={`relative w-12 h-7 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              actif ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-background-50 transition-transform ${
                actif ? "translate-x-5" : "translate-x-0"
              }`}
            ></span>
          </button>
        </Infobulle>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Jour du mois</span>
          <div className="relative">
            <select
              value={jour}
              onChange={(e) => setJour(Number(e.target.value))}
              disabled={!actif || busy}
              className="h-11 w-full pl-3 pr-9 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:opacity-60"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1er du mois" : `Le ${d}`}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Heure d'envoi</span>
          <div className="relative">
            <select
              value={heure}
              onChange={(e) => setHeure(Number(e.target.value))}
              disabled={!actif || busy}
              className="h-11 w-full pl-3 pr-9 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:opacity-60"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {heureLabel(h)}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Destinataire</span>
          <div className="h-11 flex items-center gap-2 px-3 rounded-md bg-background-50 border border-background-200">
            <i className="ri-mail-send-line text-foreground-400"></i>
            <span className="text-sm text-foreground-800 truncate">
              {comptableEmail.trim() || "Email du comptable à renseigner ci-dessus"}
            </span>
          </div>
        </div>
      </div>

      {/* Récap de régularité (graphe + CSV) joint automatiquement en plus du journal mensuel */}
      <div className="flex items-start gap-3 rounded-md bg-background-50 border border-background-200 p-3">
        <button
          type="button"
          role="switch"
          aria-checked={rapportAuto}
          onClick={() => setRapportAuto((v) => !v)}
          disabled={busy || !actif}
          title={
            !actif
              ? "Activez d'abord l'envoi automatique mensuel ci-dessus"
              : "Joindre en plus un récap de régularité (graphe + CSV) à chaque envoi automatique"
          }
          className={`relative w-12 h-7 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            rapportAuto && actif ? "bg-accent-500" : "bg-background-300"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-background-50 transition-transform ${
              rapportAuto && actif ? "translate-x-5" : "translate-x-0"
            }`}
          ></span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-800 inline-flex items-center gap-1.5">
            <i className="ri-line-chart-line text-accent-600"></i>
            Joindre un récap de régularité (graphe + CSV)
          </p>
          <p className="text-[11px] text-foreground-500 mt-0.5">
            En plus du journal mensuel, un second email récapitule la régularité des envois au comptable — graphe et CSV joints,
            selon vos préférences d'export.
          </p>
          {rapportAuto && actif && (
            <label className="mt-2 inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={copieArtisan}
                onChange={(e) => setCopieArtisan(e.target.checked)}
                disabled={busy}
                className="w-4 h-4 shrink-0 cursor-pointer rounded border-background-300 disabled:opacity-50"
              />
              <span className="text-[11px] text-foreground-600">
                M'envoyer aussi une copie de ce récap dans ma propre boîte
                <span className="text-foreground-400"> (pour garder le lien « Espace comptable » à portée de main)</span>
              </span>
            </label>
          )}
          {rapportAuto && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openApercu("artisan")}
                title="Afficher l'email dédié à l'artisan tel qu'il serait envoyé (rien ne part)"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
              >
                <i className="ri-eye-line text-accent-600"></i>
                Aperçu · mon email
              </button>
              <button
                type="button"
                onClick={() => openApercu("comptable")}
                title="Afficher l'email de régularité tel qu'il partira au comptable (rien ne part)"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
              >
                <i className="ri-eye-line text-secondary-600"></i>
                Aperçu · au comptable
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-history-line"></i>
          {dernierMois ? (
            <>
              Dernier envoi automatique : <strong className="text-foreground-700">{moisLabel(dernierMois)}</strong>
            </>
          ) : (
            "Aucun envoi automatique encore effectué."
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Envoyer tout de suite le journal du mois écoulé au comptable, pour vérifier le rendu sans attendre la date programmée."
            position="haut"
            largeur={280}
          >
            <button
              type="button"
              onClick={onTest}
              disabled={testBusy || busy || emailManquant}
              title={
                emailManquant
                  ? "Renseignez d'abord l'email du comptable ci-dessus"
                  : "Envoyer tout de suite le journal du mois écoulé au comptable pour vérifier le rendu"
              }
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-background-50 border border-background-200 text-sm font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
              Tester maintenant
            </button>
          </Infobulle>
          <Infobulle
            contenu="Enregistrer vos réglages : c'est ce qui met en route l'envoi automatique mensuel."
            position="haut"
            largeur={240}
          >
            <button
              type="button"
              onClick={() => onSave({ actif, jour, heure, rapportAuto, copieArtisan })}
              disabled={busy || !dirty}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
              Enregistrer
            </button>
          </Infobulle>
        </div>
      </div>

      {emailManquant && (
        <p className="text-xs text-secondary-700 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Renseignez l'email du comptable dans la carte « Envoyer le journal au comptable » pour activer l'envoi automatique.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}

      {testError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {testError}
        </p>
      )}
      {testNotice && !testError && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {testNotice}
        </p>
      )}

      {/* Alerte à l'artisan : un mois attendu reste sans envoi automatique passé un délai */}
      <div className="pt-3 border-t border-background-200 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-alarm-warning-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-sm text-foreground-950">
              Me prévenir si un mois reste sans envoi automatique
            </h3>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Passé un délai après le jour d'envoi, si le mois attendu n'a toujours pas reçu son envoi automatique, un email de
              relance vous est adressé pour que vous puissiez le renvoyer à temps.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={relanceActif}
            onClick={() => setRelanceActif((v) => !v)}
            disabled={relanceBusy || !actif}
            title={!actif ? "Activez d'abord l'envoi automatique mensuel ci-dessus" : undefined}
            className={`relative w-12 h-7 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              relanceActif && actif ? "bg-accent-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-background-50 transition-transform ${
                relanceActif && actif ? "translate-x-5" : "translate-x-0"
              }`}
            ></span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-12">
          {relanceActif && (
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Prévenir après</span>
              <div className="relative">
                <select
                  value={relanceDelai}
                  onChange={(e) => setRelanceDelai(Number(e.target.value))}
                  disabled={relanceBusy}
                  title="Délai après le jour d'envoi avant de vous prévenir"
                  className="h-9 pl-3 pr-8 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:opacity-60"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d} jour{d > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
              </div>
              <span className="text-[11px] text-foreground-500">après le jour d'envoi.</span>
            </label>
          )}
          <button
            type="button"
            onClick={handleSaveRelance}
            disabled={relanceBusy || !relanceDirty}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {relanceBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handleTestRelance}
            disabled={relanceTestBusy || relanceBusy}
            title="Envoyer tout de suite un email d'alerte de test à votre adresse, pour vérifier le rendu sans attendre un vrai mois manquant"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {relanceTestBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Tester maintenant
          </button>
        </div>

        {relanceError && (
          <p className="text-[11px] text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {relanceError}
          </p>
        )}
        {relanceNotice && !relanceError && (
          <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {relanceNotice}
          </p>
        )}
        {relanceTestError && (
          <p className="text-[11px] text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {relanceTestError}
          </p>
        )}
        {relanceTestNotice && !relanceTestError && (
          <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {relanceTestNotice}
          </p>
        )}
      </div>

      {/* Bilan d'archivage annuel : l'historique complet de l'exercice part au comptable en fin d'année */}
      <BilanArchivageBloc
        emailManquant={emailManquant}
        artisanEmail={artisanEmail}
        emetteur={emetteur}
        overrideSuggestion={suggestion}
        overrideAdresses={overrideAdresses}
        defaultBilanActif={defaultBilanActif}
        defaultBilanJour={defaultBilanJour}
        defaultBilanCopieArtisan={defaultBilanCopieArtisan}
        onSaveBilan={onSaveBilan}
        onTestBilan={onTestBilan}
        onEnvoyerBilan={onEnvoyerBilan}
        dernierBilan={dernierBilan}
        bilans={bilans}
        bilanLoading={bilanLoading}
        onReloadDernierBilan={onReloadDernierBilan}
        onDownloadBilan={handleDownloadBilan}
      />

      {/* Historique des envois (mois + date + mode + destinataire) */}
      <div className="pt-3 border-t border-background-200 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-mail-check-line"></i>
              Historique des envois au comptable
            </span>
            {historique.length > 0 && (
              <span className="inline-flex items-center gap-2 h-6 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] text-foreground-600 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-refresh-line text-primary-600"></i>
                  <strong className="text-foreground-800">{nbAuto}</strong> automatique{nbAuto > 1 ? "s" : ""}
                </span>
                <span className="w-px h-3 bg-background-300"></span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-user-line text-secondary-600"></i>
                  <strong className="text-foreground-800">{nbManuel}</strong> manuel{nbManuel > 1 ? "s" : ""}
                </span>
                {nbRecap > 0 && (
                  <>
                    <span className="w-px h-3 bg-background-300"></span>
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-line-chart-line text-accent-600"></i>
                      <strong className="text-foreground-800">{nbRecap}</strong> récap{nbRecap > 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dernierExport && (
              <button
                type="button"
                onClick={() => runExport(dernierExport)}
                title={`Reprendre votre dernier export : ${exportKindLabel[dernierExport]}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
              >
                <i className="ri-history-line"></i>
                Reprendre : {exportKindLabel[dernierExport]}
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsvComplet}
              disabled={historique.length === 0}
              title="Exporter l'historique COMPLET (tous mois, non filtré) en CSV, regroupé par année, pour l'archivage long terme"
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dernierExport === "csv-complet" ? "border-accent-400 ring-2 ring-accent-200" : "border-accent-200"
              }`}
            >
              <i className="ri-archive-drawer-line"></i>
              Export complet
            </button>
            <button
              type="button"
              onClick={handleExportPdfComplet}
              disabled={historique.length === 0}
              title="Exporter l'historique COMPLET (tous mois, non filtré) en PDF pour l'archivage global"
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dernierExport === "pdf-complet" ? "border-accent-400 ring-2 ring-accent-200" : "border-accent-200"
              }`}
            >
              <i className="ri-file-pdf-2-line"></i>
              Export PDF complet
            </button>
            <button
              type="button"
              onClick={handleExportBilan}
              disabled={historique.length === 0}
              title={
                filtreAnneeActif
                  ? `Télécharger le bilan d'archivage (PDF) de l'exercice ${filtreAnnee}`
                  : "Télécharger le bilan d'archivage (PDF) de l'exercice le plus récent"
              }
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 border text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dernierExport === "bilan" ? "border-accent-400 ring-2 ring-accent-200" : "border-secondary-200"
              }`}
            >
              <i className="ri-archive-drawer-line"></i>
              Bilan d'archivage{filtreAnneeActif ? ` ${filtreAnnee}` : ""}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={historiqueFiltre.length === 0}
              title="Exporter l'historique affiché en CSV, regroupé par année (mois, date, mode, lignes, destinataire)"
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dernierExport === "csv-filtre" ? "border-accent-400 ring-2 ring-accent-200" : "border-background-200"
              }`}
            >
              <i className="ri-download-2-line"></i>
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={historiqueFiltre.length === 0}
              title="Exporter l'historique affiché en PDF, avec la colonne « Vers (moi / comptable) » comme dans le CSV"
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dernierExport === "pdf-filtre" ? "border-accent-400 ring-2 ring-accent-200" : "border-background-200"
              }`}
            >
              <i className="ri-file-pdf-2-line"></i>
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => setEnvoiHistoOpen((v) => !v)}
              disabled={historique.length === 0 || !comptableEmail.trim() || rapportBusy}
              title={
                comptableEmail.trim()
                  ? "Envoyer l'historique des envois au comptable par email, avec le PDF en pièce jointe (filtré ou complet)"
                  : "Renseignez d'abord l'email du comptable ci-dessus"
              }
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 border border-accent-500 text-xs font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rapportBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
              Envoyer l'historique
            </button>
          </div>
        </div>

        {envoiHistoOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-background-50 border border-accent-300 p-2.5 animate-fade-in">
            <span className="text-[11px] text-foreground-600 inline-flex items-center gap-1.5">
              <i className="ri-mail-send-line text-accent-600"></i>
              Envoyer l'historique en PDF à <strong className="text-foreground-800">{comptableEmail.trim()}</strong> :
            </span>
            <button
              type="button"
              onClick={() => void handleEnvoyerHistorique("filtre")}
              disabled={historiqueFiltre.length === 0 || rapportBusy}
              title="Envoyer le PDF de l'historique affiché (filtres appliqués)"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-filter-3-line"></i>
              PDF filtré ({historiqueFiltre.length})
            </button>
            <button
              type="button"
              onClick={() => void handleEnvoyerHistorique("complet")}
              disabled={historique.length === 0 || rapportBusy}
              title="Envoyer le PDF de l'historique complet (tous les mois, non filtré)"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-archive-drawer-line"></i>
              PDF complet ({historique.length})
            </button>
            <button
              type="button"
              onClick={() => setEnvoiHistoOpen(false)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-close-line"></i>
              Annuler
            </button>
          </div>
        )}

        {/* Filtres : origine (Automatique / Manuel) + mois / année */}
        {historique.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
              {filtres.map((f) => (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => setFiltre(f.cle)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    filtre === f.cle ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {f.label}
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      filtre === f.cle ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {f.compte}
                  </span>
                </button>
              ))}
            </div>
            {nbRecap > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400 inline-flex items-center gap-1">
                  <i className="ri-line-chart-line"></i>
                  Récap
                </span>
                <div
                  className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit"
                  title="Isoler les récaps de régularité : reçus par vous ou transmis au comptable"
                >
                  <button
                    type="button"
                    onClick={() => setFiltreDest("tous")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      filtreDest === "tous" ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltreDest("moi")}
                    title="Ne montrer que les récaps de régularité qui vous ont été adressés"
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      filtreDest === "moi" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    <i className="ri-user-received-line"></i>
                    À moi
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        filtreDest === "moi" ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {nbRecapMoi}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltreDest("comptable")}
                    title="Ne montrer que les récaps de régularité transmis à votre comptable"
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      filtreDest === "comptable" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    <i className="ri-user-shared-line"></i>
                    Au comptable
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        filtreDest === "comptable" ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {nbRecapComptable}
                    </span>
                  </button>
                </div>
              </div>
            )}
            <div className="relative">
              <i className="ri-calendar-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                value={filtreMois}
                onChange={(e) => setFiltreMois(e.target.value)}
                aria-label="Filtrer l'historique par mois et année"
                title="Retrouver un envoi ancien par mois et année"
                className={`h-9 pl-9 pr-9 rounded-full border text-xs font-medium outline-none cursor-pointer appearance-none transition-colors ${
                  filtreMoisActif
                    ? "bg-secondary-100 border-secondary-300 text-secondary-800"
                    : "bg-background-50 border-background-200 text-foreground-700 hover:border-primary-300"
                }`}
              >
                <option value="tous">{filtreAnneeActif ? `Tous les mois ${filtreAnnee}` : "Tous les mois"}</option>
                {(filtreAnneeActif ? moisOptions.filter((g) => g.annee === filtreAnnee) : moisOptions).map((groupe) => (
                  <optgroup key={groupe.annee} label={groupe.annee}>
                    {groupe.mois.map((m) => (
                      <option key={m.cle} value={m.cle}>
                        {m.label} ({m.compte})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
            </div>
            <button
              type="button"
              onClick={reinitialiserTousFiltres}
              disabled={!filtreActif}
              title="Remettre l'origine (automatique / manuel), le mois, l'année et le destinataire des récaps à leurs valeurs par défaut"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-filter-off-line"></i>
              Réinitialiser tous les filtres
            </button>
          </div>
        )}

        {/* Mini-graphe de régularité des envois + récap du périmètre filtré */}
        {historique.length > 0 && (
          <>
            <EnvoisComptableChart
              historique={historique}
              filtreMois={filtreMois}
              onSelectMois={(cle) => setFiltreMois((prev) => (prev === cle ? "tous" : cle))}
              comptableEmail={comptableEmail}
              envoiBusy={rapportBusy}
              onEnvoyerRapport={handleEnvoyerRapport}
              defaultCommentaire={defaultCommentaire}
              onSaveCommentaire={onSaveCommentaire}
              onRenvoyerMois={onRenvoyerMois}
              renvoyerMoisBusyCle={renvoyerMoisBusyCle}
              onRenvoyerTousMois={onRenvoyerTousMois}
              renvoyerTousBusy={renvoyerMoisBusyCle === "__tous__"}
              focusManquants={focusManquants}
              defaultPeriode={exportPeriode}
              defaultFormat={exportFormat}
              onSavePrefs={onSaveExportPrefs}
            />
            {rapportError && (
              <p className="text-[11px] text-red-600 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {rapportError}
              </p>
            )}
            {rapportNotice && !rapportError && (
              <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                {rapportNotice}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {filtre === "manquants" ? (
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-alert-line"></i>
                    Trou de régularité : <strong>{nbManquants}</strong> mois manquant{nbManquants > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-filter-3-line"></i>
                    {filtreActif ? `Sélection${filtreAnneeActif ? ` · ${filtreAnnee}` : ""}${filtreMoisActif ? ` · ${moisLabel(filtreMois)}` : ""}` : "Tous les envois"} :
                    <strong>{recapSelection.nbEnvois}</strong> envoi{recapSelection.nbEnvois > 1 ? "s" : ""}
                  </span>
                )}
                {filtre !== "manquants" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setLignesOuvert((v) => !v)}
                      aria-expanded={lignesOuvert}
                      title="Voir le total de lignes transmises par mois"
                      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        lignesOuvert ? "bg-accent-200 text-accent-900" : "bg-accent-100 text-accent-800 hover:bg-accent-200"
                      }`}
                    >
                      <i className="ri-list-check-2"></i>
                      <strong>{recapSelection.totalLignes}</strong> ligne
                      {recapSelection.totalLignes > 1 ? "s" : ""} transmise{recapSelection.totalLignes > 1 ? "s" : ""}
                      <i className={lignesOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </button>
                    {recapSelection.avecDetail < recapSelection.nbEnvois && (
                      <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
                        <i className="ri-information-line"></i>
                        {recapSelection.nbEnvois - recapSelection.avecDetail} envoi
                        {recapSelection.nbEnvois - recapSelection.avecDetail > 1 ? "s" : ""} sans détail de lignes
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Détail déplié : total de lignes transmises par mois */}
              {lignesOuvert && recapParMois.length > 0 && (
                <div className="rounded-md bg-background-50 border border-background-200 p-2.5 max-w-lg animate-fade-in">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500 mb-1.5 inline-flex items-center gap-1.5">
                    <i className="ri-list-check-2"></i>
                    Lignes transmises par mois
                  </p>
                  <ul className="flex flex-col gap-1">
                    {recapParMois.map((m) => {
                      const actifMois = filtreMois === m.cle;
                      return (
                        <li key={m.cle}>
                          <button
                            type="button"
                            onClick={() => setFiltreMois((prev) => (prev === m.cle ? "tous" : m.cle))}
                            disabled={m.cle === "inconnu"}
                            title={m.cle === "inconnu" ? "Date indisponible" : `Filtrer l'historique sur ${moisLabel(m.cle)}`}
                            className={`w-full flex items-center justify-between gap-3 px-2 py-1 rounded-md text-[11px] cursor-pointer transition-colors disabled:cursor-default ${
                              actifMois ? "bg-secondary-100 text-secondary-800" : "hover:bg-background-200"
                            }`}
                          >
                            <span className="truncate text-foreground-700">
                              {m.cle === "inconnu" ? "Date inconnue" : moisLabel(m.cle)}
                            </span>
                            <span className="inline-flex items-center gap-2 shrink-0">
                              <span className="text-foreground-500">
                                {m.nbEnvois} envoi{m.nbEnvois > 1 ? "s" : ""}
                              </span>
                              <span className="font-semibold text-accent-800">
                                {m.totalLignes} ligne{m.totalLignes > 1 ? "s" : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[10px] text-foreground-400 mt-1.5 inline-flex items-center gap-1.5">
                    <i className="ri-lightbulb-line text-accent-500"></i>
                    Cliquez un mois pour filtrer l'historique.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {historique.length > 0 && recapArchivage.annees.length > 0 && (
          <div className="rounded-md bg-background-50 border border-background-200 p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500 inline-flex items-center gap-1.5">
                <i className="ri-bar-chart-box-line text-secondary-600"></i>
                Récap d'archivage · total par année
              </span>
              <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
                <i className="ri-information-line"></i>
                sur tout l'historique, tous filtres confondus
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {recapArchivage.annees.map((a) => {
                const actifAnnee = filtreAnnee === a.annee;
                return (
                  <button
                    key={a.annee}
                    type="button"
                    onClick={() => setFiltreAnnee((prev) => (prev === a.annee ? "tous" : a.annee))}
                    aria-pressed={actifAnnee}
                    title={
                      actifAnnee
                        ? `Retirer le filtre sur l'exercice ${a.annee}`
                        : `Filtrer l'historique sur l'exercice ${a.annee}`
                    }
                    className={`inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-full text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                      actifAnnee
                        ? "bg-secondary-500 text-background-50"
                        : "bg-secondary-100 text-secondary-900 hover:bg-secondary-200"
                    }`}
                  >
                    <i className={actifAnnee ? "ri-filter-3-line" : "ri-calendar-line"}></i>
                    <strong>{a.annee}</strong>
                    <span className={actifAnnee ? "text-background-50/80" : "text-secondary-700"}>
                      {a.nbEnvois} envoi{a.nbEnvois > 1 ? "s" : ""} · {a.totalLignes} ligne{a.totalLignes > 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
              <span className="inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-stack-line"></i>
                <strong>Total général</strong>
                <span>
                  {recapArchivage.total.nbEnvois} envoi{recapArchivage.total.nbEnvois > 1 ? "s" : ""} ·{" "}
                  {recapArchivage.total.totalLignes} ligne{recapArchivage.total.totalLignes > 1 ? "s" : ""}
                </span>
              </span>
            </div>
            <p className="text-[10px] text-foreground-400 inline-flex items-center gap-1.5">
              <i className="ri-lightbulb-line text-accent-500"></i>
              Cliquez une année pour filtrer l'historique sur cet exercice.
            </p>
          </div>
        )}

        {historiqueLoading && historique.length === 0 ? (
          <p className="text-xs text-foreground-400 inline-flex items-center gap-1.5 py-1">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de l'historique…
          </p>
        ) : historique.length === 0 ? (
          <p className="text-xs text-foreground-500 py-1">
            Aucun envoi au comptable pour l'instant. Lancez un « Tester maintenant » pour voir le rendu.
          </p>
        ) : filtre === "manquants" ? (
          <div className="flex flex-col gap-2">
            {nbManquants > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <i className="ri-download-2-line"></i>
                  Export mois manquants
                </span>
                <button
                  type="button"
                  onClick={handleExportManquantsPng}
                  title="Exporter en PNG le graphe des mois manquants uniquement (téléchargement local)"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                >
                  <i className="ri-image-line"></i>
                  PNG manquants
                </button>
                <button
                  type="button"
                  onClick={handleExportManquantsCsv}
                  title="Exporter en CSV les mois manquants uniquement (téléchargement local)"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors"
                >
                  <i className="ri-file-text-line"></i>
                  CSV manquants
                </button>
                <button
                  type="button"
                  onClick={handleEnvoyerManquants}
                  disabled={!comptableEmail.trim() || rapportBusy}
                  title={
                    comptableEmail.trim()
                      ? "Envoyer au comptable le graphe des mois manquants uniquement"
                      : "Renseignez d'abord l'email du comptable pour envoyer par email"
                  }
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rapportBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
                  Envoyer au comptable
                </button>
              </div>
            )}
            {nbManquants > 1 && onRenvoyerTousMois && (
              <button
                type="button"
                onClick={() => onRenvoyerTousMois(moisManquantsList)}
                disabled={Boolean(renvoyerMoisBusyCle) || testBusy}
                title="Renvoyer maintenant le journal de tous les mois manquants au comptable"
                className="self-start inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renvoyerMoisBusyCle === "__tous__" ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                Renvoyer tous les mois manquants ({nbManquants})
              </button>
            )}
            {nbManquants === 0 ? (
              <p className="text-xs text-foreground-500 py-1 inline-flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line text-primary-600"></i>
                Aucun trou de régularité : chaque mois attendu a bien reçu son envoi automatique.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {moisManquantsList.map((cle) => {
                  const enRenvoi = renvoyerMoisBusyCle === cle;
                  return (
                    <li
                      key={cle}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-background-50 border border-accent-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                          <i className="ri-alert-line"></i>
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground-950 truncate">{moisLabel(cle)}</p>
                            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold bg-accent-100 text-accent-800">
                              <i className="ri-alert-line"></i>
                              Manquant
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground-500 truncate">
                            Aucun envoi automatique ce mois — le journal n'a pas été transmis au comptable.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRenvoyerMois(cle)}
                        disabled={enRenvoi || testBusy}
                        title={`Renvoyer maintenant le journal de ${moisLabel(cle)} au comptable`}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enRenvoi ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                        Renvoyer ce mois
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : historiqueFiltre.length === 0 ? (
          <p className="text-xs text-foreground-500 py-1">
            Aucun envoi ne correspond à ce filtre
            {filtreMoisActif ? ` (${moisLabel(filtreMois)})` : ""}
            {filtre !== "tous" ? ` côté ${filtre === "automatique" ? "automatique" : "manuel"}` : ""}
            {filtreDest !== "tous" ? ` · récap ${filtreDest === "moi" ? "à moi" : "au comptable"}` : ""}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historiqueVisible.map((env) => {
              const auto = isAuto(env);
              const renvoiPossible = Boolean(env.moisCle);
              const enCours = renvoyerBusyId === env.id;
              const overrideOuvert = overrideForId === env.id;
              // Second email du récap de régularité : on le trace dans l'historique
              // (date + pièce jointe) sans proposer de renvoi de journal.
              if (env.recap) {
                const recapAuto = (env.mode ?? "").toLowerCase() === "automatique";
                // Ce récap a-t-il été adressé à l'artisan lui-même (email dédié) ou au comptable ?
                // On compare le destinataire tracé à l'adresse de l'artisan.
                const versMoi =
                  Boolean(artisanEmail.trim()) &&
                  (env.destinataire ?? "").trim().toLowerCase() === artisanEmail.trim().toLowerCase();
                return (
                  <li
                    key={env.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-background-50 border border-accent-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                        <i className="ri-line-chart-line"></i>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground-950 truncate">Récap de régularité</p>
                          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold bg-accent-100 text-accent-800">
                            <i className="ri-line-chart-line"></i>
                            Récap
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold ${
                              recapAuto ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"
                            }`}
                            title={recapAuto ? "Récap joint à l'envoi automatique" : "Récap envoyé manuellement (test)"}
                          >
                            <i className={recapAuto ? "ri-refresh-line" : "ri-user-line"}></i>
                            {recapAuto ? "Automatique" : "Manuel"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold ${
                              versMoi ? "bg-accent-500 text-background-50" : "bg-secondary-100 text-secondary-700"
                            }`}
                            title={
                              versMoi
                                ? "Ce récap vous a été adressé à vous (email dédié à l'artisan)"
                                : "Ce récap a été adressé à votre comptable"
                            }
                          >
                            <i className={versMoi ? "ri-user-received-line" : "ri-user-shared-line"}></i>
                            {versMoi ? "À moi" : "Au comptable"}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {dateHeureLabel(env.envoye_le)}
                          {env.destinataire ? ` · ${env.destinataire}` : ""}
                          {env.lignes != null ? ` · ${env.lignes} mois` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openApercu(versMoi ? "artisan" : "comptable")}
                        title={
                          versMoi
                            ? "Rouvrir l'aperçu de l'email dédié à l'artisan (rien ne part)"
                            : "Rouvrir l'aperçu de l'email de régularité envoyé au comptable (rien ne part)"
                        }
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
                      >
                        <i className="ri-eye-line text-accent-600"></i>
                        Aperçu
                      </button>
                      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold bg-background-100 border border-background-200 text-foreground-600">
                        <i className="ri-attachment-2"></i>
                        {env.pieces || "Pièce jointe"}
                      </span>
                    </div>
                  </li>
                );
              }
              return (
                <li
                  key={env.id}
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-md bg-background-50 border border-background-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                        <i className="ri-mail-send-line"></i>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground-950 truncate">
                            {env.mois ?? "Journal comptable"}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold ${
                              auto ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"
                            }`}
                            title={
                              auto
                                ? "Envoyé automatiquement par la tâche planifiée"
                                : "Envoyé manuellement (test ou renvoi)"
                            }
                          >
                            <i className={auto ? "ri-refresh-line" : "ri-user-line"}></i>
                            {auto ? "Automatique" : "Manuel"}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {dateHeureLabel(env.envoye_le)}
                          {env.destinataire ? ` · ${env.destinataire}` : ""}
                          {env.lignes != null
                            ? ` · ${env.lignes} ligne${env.lignes > 1 ? "s" : ""}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold bg-accent-100 text-accent-800">
                        <i className="ri-checkbox-circle-line"></i>
                        Envoyé
                      </span>
                      <button
                        type="button"
                        onClick={() => ouvrirOverride(env)}
                        disabled={!renvoiPossible || enCours || testBusy}
                        title={
                          renvoiPossible
                            ? "Renvoyer le journal de ce mois à une autre adresse ponctuelle"
                            : "Mois indisponible pour le renvoi"
                        }
                        className={`w-8 h-8 flex items-center justify-center rounded-md border text-foreground-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          overrideOuvert
                            ? "bg-secondary-100 border-secondary-300"
                            : "bg-background-100 border-background-200 hover:border-primary-300"
                        }`}
                        aria-label="Renvoyer à une autre adresse"
                      >
                        <i className="ri-mail-add-line"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRenvoyer(env)}
                        disabled={!renvoiPossible || enCours || testBusy}
                        title={
                          renvoiPossible
                            ? "Renvoyer d'un clic le journal de ce mois au comptable"
                            : "Mois indisponible pour le renvoi"
                        }
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
                        Renvoyer
                      </button>
                      {suggestion && renvoiPossible && (
                        <button
                          type="button"
                          onClick={() => onRenvoyer(env, suggestion)}
                          disabled={enCours || testBusy}
                          title={`Renvoyer d'un clic le journal de ce mois à l'adresse suggérée (${suggestion})`}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-check-line"></i>}
                          Adresse suggérée
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panneau « renvoyer à une autre adresse ponctuelle » */}
                  {overrideOuvert && renvoiPossible && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-background-200 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 shrink-0 sm:max-w-[220px]">
                          <i className="ri-information-line"></i>
                          Adresse ponctuelle (votre comptable habituel n'est pas modifié).
                        </p>
                        {overrideAdresses.length > 0 && (
                          <div className="relative shrink-0">
                            <i className="ri-bookmark-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                            <select
                              value={overrideEmail}
                              onChange={(e) => {
                                const choix = overrideAdresses.find((a) => a.email === e.target.value);
                                setOverrideEmail(e.target.value);
                                setOverrideNom(choix?.nom ?? "");
                              }}
                              title="Choisir une adresse ponctuelle nommée (le champ se remplit)"
                              className="h-9 pl-9 pr-8 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none max-w-[220px]"
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
                            value={overrideEmail}
                            onChange={(e) => {
                              setOverrideEmail(e.target.value);
                              setOverrideNom("");
                            }}
                            placeholder="expert-comptable-remplacant@cabinet.fr"
                            className="h-9 w-full pl-9 pr-3 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => onRenvoyer(env, overrideEmail.trim(), overrideNom || undefined)}
                          disabled={!overrideEmail.trim() || enCours || testBusy}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                          Envoyer à cette adresse
                        </button>
                      </div>
                      {suggestion && (
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
            {historiqueFiltre.length > historiqueVisible.length && (
              <li className="text-[11px] text-foreground-400 inline-flex items-center gap-1.5 px-1 py-1">
                <i className="ri-information-line"></i>
                {historiqueFiltre.length - historiqueVisible.length} envoi
                {historiqueFiltre.length - historiqueVisible.length > 1 ? "s" : ""} plus ancien
                {historiqueFiltre.length - historiqueVisible.length > 1 ? "s" : ""} — affinez le filtre mois ou exportez en CSV.
              </li>
            )}
          </ul>
        )}
      </div>

      <ApercuRecapArtisanModal open={apercuRecapOpen} onClose={() => setApercuRecapOpen(false)} audience={apercuRecapAudience} />
    </div>
  );
}