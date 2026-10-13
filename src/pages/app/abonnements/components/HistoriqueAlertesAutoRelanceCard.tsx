import { useEffect, useMemo, useState } from "react";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { creerZip, telechargerBlob, type ZipEntry } from "@/lib/zip";
import { creerAlertesChartBlob, nomFichierPngAlertes } from "@/lib/alertesChartImage";
import { pointsAlertesParMois } from "@/lib/alertesParMois";
import { rejouerAlerteArtisan, lireRecapAlertesMoisSelectionnes, ecrireRecapAlertesMoisSelectionnes, oublierRecapAlertesMoisSelectionnes, lireRecapAlertesZipParts, ecrireRecapAlertesZipParts, lireRecapAlertesZipHistorique, ajouterRecapAlertesZipHistorique, renommerRecapAlertesZipHistorique, epinglerRecapAlertesZipHistorique, epinglerPlusieursRecapAlertesZipHistorique, desepinglerPlusieursRecapAlertesZipHistorique, toutDesepinglerRecapAlertesZipHistorique, viderRecapAlertesZipHistorique, lireRecapAlertesZipFiltre, ecrireRecapAlertesZipFiltre, RECAP_ALERTES_ZIP_HISTO_MAX, type AlerteAutoRelance, type RecapAlertesZipParts, type RecapAlertesZipHistoItem, type RecapAlertesZipDate, type RecapAlertesZipType } from "@/lib/recontactSeuil";
import EvolutionAlertesMoisChart from "@/pages/app/abonnements/components/EvolutionAlertesMoisChart";
import ApercuAlerteArtisanModal from "@/pages/app/abonnements/components/ApercuAlerteArtisanModal";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

interface Props {
  items: AlerteAutoRelance[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** Identifiant de l'utilisateur connecté (nécessaire pour rejouer une alerte). */
  userId: string | null;
  /** L'artisan a réglé un objet/message d'alerte personnalisé (sinon c'est le modèle par défaut). */
  alertePersonnalisee?: boolean;
  /** Fenêtre (en mois) affichée par le mini-graphe des alertes. */
  moisAffiches: number;
  /** Change la fenêtre (en mois) du mini-graphe (mémorisée par le parent). */
  onMoisAffichesChange: (mois: number) => void;
}

/** Plages de dates proposées pour filtrer l'historique des alertes. */
const PERIODES: { key: "tout" | "30j" | "90j"; label: string; jours: number | null }[] = [
  { key: "tout", label: "Tout", jours: null },
  { key: "30j", label: "30 jours", jours: 30 },
  { key: "90j", label: "90 jours", jours: 90 },
];

/** Filtres par type de contenu proposés dans le panneau des exports ZIP. */
const FILTRES_TYPE_ZIP: {
  key: "tous" | "csv" | "png" | "lesdeux";
  label: string;
  icon: string;
  titre: string;
}[] = [
  { key: "tous", label: "Tous", icon: "ri-list-check", titre: "Afficher tous les exports, quel que soit leur contenu" },
  {
    key: "csv",
    label: "CSV seul",
    icon: "ri-file-excel-2-line",
    titre: "N'afficher que les archives contenant uniquement le CSV",
  },
  {
    key: "png",
    label: "PNG seul",
    icon: "ri-image-line",
    titre: "N'afficher que les archives contenant uniquement le PNG",
  },
  {
    key: "lesdeux",
    label: "Les deux",
    icon: "ri-stack-line",
    titre: "N'afficher que les archives contenant le CSV et le PNG",
  },
];

/** Filtres par plage de dates proposés dans le panneau des exports ZIP. */
const FILTRES_DATE_ZIP: {
  key: "tout" | "aujourdhui" | "7j";
  label: string;
  icon: string;
  titre: string;
}[] = [
  {
    key: "tout",
    label: "Toute date",
    icon: "ri-calendar-line",
    titre: "Afficher les exports quelle que soit leur date",
  },
  {
    key: "aujourdhui",
    label: "Aujourd'hui",
    icon: "ri-calendar-check-line",
    titre: "N'afficher que les exports générés aujourd'hui",
  },
  {
    key: "7j",
    label: "7 jours",
    icon: "ri-history-line",
    titre: "N'afficher que les exports des 7 derniers jours",
  },
];

/** Clé « AAAA-MM » d'une date ISO (ou null si la date est invalide). */
function cleMois(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé humain d'une clé « AAAA-MM » (ex. « oct. 2025 »). */
function libelleMoisCle(cle: string): string {
  const [an, mois] = cle.split("-").map((v) => Number(v));
  if (!an || !mois) return cle;
  const d = new Date(an, mois - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
}

/** Libellé d'un ensemble de mois : un mois seul, ou une plage « du … au … ». */
function libelleMoisCles(cles: string[]): string {
  if (cles.length === 0) return "";
  const tries = [...cles].sort();
  if (tries.length === 1) return libelleMoisCle(tries[0]);
  return `du ${libelleMoisCle(tries[0])} au ${libelleMoisCle(tries[tries.length - 1])}`;
}

/** Message local affiché après un rejeu d'alerte (par ligne). */
interface ReplayMessage {
  id: number;
  ton: "ok" | "info" | "err";
  texte: string;
}

/** Formate une taille en octets en libellé court (ex. « 24,3 Ko »). */
function formaterOctets(octets: number): string {
  if (!Number.isFinite(octets) || octets < 1024) return `${Math.max(0, Math.round(octets))} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1).replace(".", ",")} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Libellé de l'archive selon son contenu : CSV seul, PNG seul, les deux, ou non mémorisé. */
function typeContenuZip(h: RecapAlertesZipHistoItem): { label: string; icon: string; cls: string } | null {
  if (h.csv === true && h.png === true) {
    return { label: "CSV + PNG", icon: "ri-stack-line", cls: "bg-accent-100 text-accent-800" };
  }
  if (h.csv === true) {
    return { label: "CSV seul", icon: "ri-file-excel-2-line", cls: "bg-secondary-100 text-secondary-900" };
  }
  if (h.png === true) {
    return { label: "PNG seul", icon: "ri-image-line", cls: "bg-secondary-100 text-secondary-900" };
  }
  return null;
}

/** Libellé du filtre utilisé pour un export mémorisé (mois sélectionnés ou plage de dates). */
function libelleFiltreZip(h: RecapAlertesZipHistoItem): string {
  if (h.cles.length > 0) return `${h.cles.length} mois (${libelleMoisCles(h.cles)})`;
  if (h.periode === "30j") return "Plage : 30 jours";
  if (h.periode === "90j") return "Plage : 90 jours";
  if (h.periode === "tout") return "Plage : tout";
  return "Filtre non mémorisé";
}

/** Libellé du contenu d'un export mémorisé (CSV / PNG et détails), pour l'infobulle et le CSV. */
function libelleContenuZip(h: RecapAlertesZipHistoItem): string {
  const parties: string[] = [];
  if (typeof h.csv === "boolean") {
    parties.push(h.csv ? `CSV${h.lignes != null ? ` (${h.lignes} ligne${h.lignes > 1 ? "s" : ""})` : ""}` : "CSV non inclus");
  }
  if (typeof h.png === "boolean") {
    parties.push(h.png ? `PNG${h.mois ? ` (${h.mois})` : ""}` : "PNG non inclus");
  }
  return parties.length > 0 ? parties.join(" + ") : "Contenu non mémorisé";
}

/**
 * Historique des alertes email réellement envoyées à l'artisan quand l'auto-relance des oubliés
 * a expédié des relances : une ligne par alerte (date + comptes concernés). Chaque ligne se déplie
 * pour montrer précisément les comptes recontactés ce jour-là, et l'ensemble peut être exporté en CSV.
 * Sert de trace durable de ce que la machine a fait en son nom.
 *
 * Un filtre de période (30 / 90 jours) restreint l'affichage aux alertes récentes, et chaque ligne
 * propose un bouton « Rejouer » pour se renvoyer l'alerte d'un jour précis (mêmes comptes).
 */
export default function HistoriqueAlertesAutoRelanceCard({
  items,
  loading,
  error,
  onReload,
  userId,
  alertePersonnalisee = false,
  moisAffiches,
  onMoisAffichesChange,
}: Props) {
  // Alerte dépliée (liste des comptes concernés).
  const [ouvert, setOuvert] = useState<number | null>(null);
  // Plage de dates sélectionnée.
  const [periode, setPeriode] = useState<"tout" | "30j" | "90j">("tout");
  // Mois (« AAAA-MM ») sélectionnés depuis le mini-graphe (multi-sélection) ; vide = filtre désactivé.
  // La dernière plage est mémorisée localement pour la retrouver à la réouverture de la page.
  const [moisSelectionnes, setMoisSelectionnes] = useState<string[]>(() => lireRecapAlertesMoisSelectionnes());
  // Nombre de mois actuellement mémorisés localement (pastille « N mois mémorisés »).
  const [plageMemorisee, setPlageMemorisee] = useState<number>(() => lireRecapAlertesMoisSelectionnes().length);
  // Confirmation temporaire après copie du résumé texte du filtre.
  const [resumeCopie, setResumeCopie] = useState(false);
  // Export ZIP (CSV + PNG) en cours : désactive le bouton pendant la génération de l'archive.
  const [exportPlageBusy, setExportPlageBusy] = useState(false);
  // Confirmation éphémère : message détaillé (nom + taille + nb de fichiers) du dernier export ZIP.
  const [zipToast, setZipToast] = useState<string | null>(null);
  // Fichiers inclus dans l'archive ZIP combinée (CSV / PNG), mémorisé localement entre les visites.
  const [zipParts, setZipParts] = useState<RecapAlertesZipParts>(() => lireRecapAlertesZipParts());
  // Mémoire des derniers exports ZIP (nom + taille), rappelable depuis le petit historique.
  const [zipHistorique, setZipHistorique] = useState<RecapAlertesZipHistoItem[]>(() => lireRecapAlertesZipHistorique());
  // Panneau dépliable listant les derniers exports ZIP (repli/dépli mémorisé localement, restauré à la prochaine visite).
  const [histoOuvert, setHistoOuvert] = useState(() => lireRecapAlertesZipFiltre().panneauOuvert);
  // Archive ZIP du dernier export combiné, conservée pour permettre son renommage (re-téléchargement).
  const [zipFichier, setZipFichier] = useState<{ blob: Blob; nom: string; entries: number; size: number } | null>(null);
  // Fenêtre de renommage ouverte (dernier ZIP exporté ou n'importe quelle entrée de l'historique).
  const [renommerOuvert, setRenommerOuvert] = useState(false);
  // Nom de l'entrée d'historique en cours de renommage (ciblée par la fenêtre de renommage).
  const [renommerCible, setRenommerCible] = useState<string | null>(null);
  // Nom saisi dans la fenêtre de renommage.
  const [nomEdite, setNomEdite] = useState("");
  // Entrée d'historique dont on affiche l'infobulle détaillée du contenu (CSV/PNG).
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  // Demande de vidage de l'historique en attente de confirmation (bouton à deux temps).
  const [viderEnCours, setViderEnCours] = useState(false);
  // Nom de l'entrée tout juste renommée depuis l'historique (retour visuel éphémère).
  const [renommeConfirme, setRenommeConfirme] = useState<string | null>(null);
  // Archives ZIP récentes conservées en mémoire (nom → blob), pour les re-télécharger d'un clic
  // depuis le petit historique sans repasser par une nouvelle génération.
  const [zipBlobs, setZipBlobs] = useState<Record<string, Blob>>({});
  // Nom de l'archive tout juste re-téléchargée depuis l'historique (retour visuel éphémère).
  const [redlConfirme, setRedlConfirme] = useState<string | null>(null);
  // Sélection multiple d'archives mémorisées (noms), pour les re-télécharger d'un seul clic.
  const [zipSelection, setZipSelection] = useState<string[]>([]);
  // Nombre d'archives téléchargées lors du dernier lot (confirmation éphémère), 0 = aucune.
  const [selectionConfirme, setSelectionConfirme] = useState(0);
  // Nombre d'épingles retirées par le dernier « Réinitialiser les épingles de la recherche » (confirmation éphémère).
  const [epinglesResetConfirme, setEpinglesResetConfirme] = useState(0);
  // Recherche texte dans le panneau des exports ZIP (filtre par nom), restaurée depuis la dernière visite.
  const [rechercheZip, setRechercheZip] = useState(() => lireRecapAlertesZipFiltre().recherche);
  // Filtre par type de contenu dans le panneau des exports ZIP (tous / CSV seul / PNG seul / les deux),
  // restauré depuis la dernière visite comme la recherche et les dates.
  const [filtreTypeZip, setFiltreTypeZip] = useState<RecapAlertesZipType>(() => lireRecapAlertesZipFiltre().type);
  // Filtre par plage de dates du panneau des exports ZIP, restauré depuis la dernière visite.
  const [filtreDateZip, setFiltreDateZip] = useState<RecapAlertesZipDate>(() => lireRecapAlertesZipFiltre().date);
  // Raccourci « favoris uniquement » : n'afficher que les archives épinglées, restauré depuis la dernière visite.
  const [favorisUniquement, setFavorisUniquement] = useState(() => lireRecapAlertesZipFiltre().favorisUniquement);

  // Mémorise la recherche, le filtre de type, le filtre de dates, le raccourci « favoris uniquement »
  // et l'état ouvert/fermé du panneau, pour les retrouver tels quels à la prochaine visite.
  useEffect(() => {
    ecrireRecapAlertesZipFiltre({
      recherche: rechercheZip,
      date: filtreDateZip,
      type: filtreTypeZip,
      favorisUniquement,
      panneauOuvert: histoOuvert,
    });
  }, [rechercheZip, filtreDateZip, filtreTypeZip, favorisUniquement, histoOuvert]);

  // Bascule l'inclusion du CSV ou du PNG dans l'archive ZIP combinée, en gardant au moins un fichier.
  const handleToggleZipPart = (part: "csv" | "png") => {
    const suivant = { ...zipParts, [part]: !zipParts[part] };
    if (!suivant.csv && !suivant.png) return;
    setZipParts(suivant);
    ecrireRecapAlertesZipParts(suivant);
  };

  // Libellé du contenu de l'archive combinée, repris sur le bouton d'export.
  const zipContenuLabel = zipParts.csv && zipParts.png ? "CSV + PNG" : zipParts.csv ? "CSV" : "PNG";

  // Met à jour la sélection de mois et la mémorise localement (pour la prochaine visite).
  const handleSelectMonths = (cles: string[]) => {
    setMoisSelectionnes(cles);
    setPlageMemorisee(cles.length);
    ecrireRecapAlertesMoisSelectionnes(cles);
  };

  // « Oublie » la plage retenue : efface la mémorisation locale et remet le filtre à zéro.
  const handleOublierPlage = () => {
    oublierRecapAlertesMoisSelectionnes();
    setMoisSelectionnes([]);
    setPlageMemorisee(0);
    setResumeCopie(false);
  };
  // Ligne en cours de rejeu (désactive le bouton pendant l'envoi).
  const [replayBusy, setReplayBusy] = useState<number | null>(null);
  // Message de retour du dernier rejeu (rattaché à une ligne précise).
  const [replayMsg, setReplayMsg] = useState<ReplayMessage | null>(null);
  // Alerte dont on affiche l'aperçu de l'email (sans envoi), ou null.
  const [apercuId, setApercuId] = useState<number | null>(null);

  // Alertes visibles : des mois cliqués depuis le graphe priment sur la plage de dates,
  // sinon on applique la plage choisie.
  const visibles = useMemo(() => {
    if (moisSelectionnes.length > 0) {
      const set = new Set(moisSelectionnes);
      return items.filter((a) => {
        const cle = cleMois(a.envoyeLe);
        return cle !== null && set.has(cle);
      });
    }
    const p = PERIODES.find((x) => x.key === periode);
    if (!p || p.jours === null) return items;
    const seuil = Date.now() - p.jours * 86400000;
    return items.filter((a) => {
      const t = new Date(a.envoyeLe).getTime();
      return !Number.isNaN(t) && t >= seuil;
    });
  }, [items, periode, moisSelectionnes]);

  const totalComptes = visibles.reduce((s, a) => s + a.nbComptes, 0);

  // Résumé texte de la sélection courante, copiable pour partager ou archiver l'état du filtre.
  const resumeTexte = useMemo(() => {
    if (moisSelectionnes.length === 0) return "";
    const plage = libelleMoisCles(moisSelectionnes);
    if (visibles.length === 0) return `Alertes auto-relance — Mois : ${plage} — aucune alerte sur cette plage`;
    return `Alertes auto-relance — Mois : ${plage} — ${visibles.length} alerte${visibles.length > 1 ? "s" : ""}, ${totalComptes} compte${totalComptes > 1 ? "s" : ""} signalé${totalComptes > 1 ? "s" : ""}`;
  }, [moisSelectionnes, visibles, totalComptes]);

  // Nombre de lignes écrites dans le CSV exporté (en-tête de colonnes + lignes de données +
  // éventuelles lignes de métadonnées du filtre), pour l'aperçu du contenu dans l'infobulle.
  const nbLignesCsv = useMemo(() => {
    const donnees = visibles.reduce((s, a) => s + (a.comptes.length === 0 ? 1 : a.comptes.length), 0);
    const enteteColonnes = 1;
    const lignesFiltre = moisSelectionnes.length > 0 ? 1 + (resumeTexte ? 1 : 0) : 0;
    return donnees + enteteColonnes + lignesFiltre;
  }, [visibles, moisSelectionnes, resumeTexte]);

  // Mini-récap du contenu de l'archive combinée (nombre de lignes du CSV, mois couverts par le PNG),
  // repris dans l'infobulle des boutons d'export pour voir le contenu avant de télécharger.
  const zipRecap = useMemo(() => {
    const parties: string[] = [];
    if (zipParts.csv) {
      parties.push(`CSV : ${nbLignesCsv} ligne${nbLignesCsv > 1 ? "s" : ""}`);
    }
    if (zipParts.png) {
      const couverture =
        moisSelectionnes.length > 0
          ? `${moisSelectionnes.length} mois (${libelleMoisCles(moisSelectionnes)})`
          : `les ${moisAffiches} mois affichés`;
      parties.push(`PNG : ${couverture}`);
    }
    return parties.join(" · ");
  }, [zipParts, nbLignesCsv, moisSelectionnes, moisAffiches]);

  // Copie le résumé dans le presse-papier (avec retour visuel éphémère).
  const handleCopyResume = async () => {
    try {
      await navigator.clipboard.writeText(resumeTexte);
      setResumeCopie(true);
      window.setTimeout(() => setResumeCopie(false), 1800);
    } catch {
      setResumeCopie(false);
    }
  };

  // Compteur par période, pour afficher le nombre d'alertes de chaque plage dans les pastilles.
  const countPeriode = (jours: number | null): number => {
    if (jours === null) return items.length;
    const seuil = Date.now() - jours * 86400000;
    return items.filter((a) => {
      const t = new Date(a.envoyeLe).getTime();
      return !Number.isNaN(t) && t >= seuil;
    }).length;
  };

  // Rejoue l'alerte : demande au Backend de renvoyer l'email d'alerte du jour concerné.
  const handleReplay = async (a: AlerteAutoRelance) => {
    if (!userId) {
      setReplayMsg({ id: a.id, ton: "err", texte: "Connectez-vous pour rejouer une alerte." });
      return;
    }
    setReplayBusy(a.id);
    setReplayMsg(null);
    try {
      const res = await rejouerAlerteArtisan(userId, a.id);
      if (res.envoye) {
        setReplayMsg({
          id: a.id,
          ton: "ok",
          texte: `Alerte renvoyée (${res.nbComptes} compte${res.nbComptes > 1 ? "s" : ""}).`,
        });
      } else if (!res.configure) {
        setReplayMsg({ id: a.id, ton: "err", texte: "Resend n'est pas configuré : aucun email n'a pu partir." });
      } else {
        setReplayMsg({ id: a.id, ton: "info", texte: "Le renvoi n'a pas abouti. Réessayez dans un instant." });
      }
    } catch {
      setReplayMsg({ id: a.id, ton: "err", texte: "Le renvoi a échoué. Réessayez dans un instant." });
    } finally {
      setReplayBusy(null);
    }
  };

  // Construit le contenu CSV et le nom de fichier correspondant à la sélection courante (filtre de
  // mois ou plage de dates). Réutilisé par l'export CSV seul et par l'archive ZIP combinée.
  const construireCsv = (): { contenu: string; nomFichier: string } => {
    const rows: string[][] = [];
    [...visibles].reverse().forEach((a) => {
      const date = formatShortDate(a.envoyeLe);
      if (a.comptes.length === 0) {
        rows.push([date, `${a.nbComptes} compte(s)`, "", ""]);
        return;
      }
      a.comptes.forEach((c) => rows.push([date, "", c.entreprise, c.email]));
    });
    let contenu = toCsv(["Date de l'alerte", "Comptes", "Entreprise recontactée", "Email"], rows);
    if (moisSelectionnes.length > 0) {
      // En-têtes de métadonnées (échappés comme des cellules) : la ligne « Mois : … » puis le
      // résumé complet du filtre (le même que la pastille copiable), pour tracer le filtre
      // directement à l'intérieur du fichier CSV, en plus du nom de fichier.
      const entetes: string[] = [`Mois : ${libelleMoisCles(moisSelectionnes)}`];
      if (resumeTexte) entetes.push(resumeTexte);
      const blocEntetes = entetes.map((l) => `"${l.replace(/"/g, '""')}"`).join("\r\n");
      contenu = `${blocEntetes}\r\n${contenu}`;
    }
    const clesTriees = [...moisSelectionnes].sort();
    const suffixeMois =
      clesTriees.length === 0
        ? ""
        : clesTriees.length === 1
          ? `-${clesTriees[0]}`
          : `-${clesTriees[0]}_${clesTriees[clesTriees.length - 1]}`;
    return { contenu, nomFichier: `alertes-auto-relance-artisan${suffixeMois}-${todayISO()}.csv` };
  };

  // Export d'archivage : une ligne par compte recontacté (date + entreprise + email), avec le
  // filtre tracé en tête de fichier et rappelé dans le nom (plage « AAAA-MM »).
  const handleExportCsv = () => {
    const { contenu, nomFichier } = construireCsv();
    downloadCsv(nomFichier, contenu);
  };

  // Regroupe en un seul ZIP l'archive CSV et l'image PNG de la période affichée : soit la sélection
  // de mois courante, soit — sans filtre de mois — l'intégralité de la plage visible (Tout / 30 / 90 j),
  // pour récupérer d'un coup la donnée brute et la tendance visuelle d'une même période. À la fin,
  // un toast confirme la génération en rappelant le nom du fichier produit.
  const handleExportPlageZip = async () => {
    if (exportPlageBusy) return;
    setExportPlageBusy(true);
    try {
      const { contenu, nomFichier } = construireCsv();
      const filtreMois = moisSelectionnes.length > 0;
      const entries: ZipEntry[] = [];
      if (zipParts.csv) entries.push({ name: nomFichier, content: contenu });
      if (zipParts.png) {
        const points = pointsAlertesParMois(items, moisAffiches);
        const png = await creerAlertesChartBlob(points, {
          highlightCles: moisSelectionnes,
          moisAffiches,
          totalToutesFenetres: items.length,
          resume: resumeTexte,
          plageDansNom: filtreMois,
        });
        if (png) entries.push({ name: nomFichierPngAlertes(moisSelectionnes, filtreMois), blob: png });
      }
      if (entries.length === 0) return;
      const clesTriees = [...moisSelectionnes].sort();
      const suffixe =
        clesTriees.length === 0
          ? periode
          : clesTriees.length === 1
            ? clesTriees[0]
            : `${clesTriees[0]}_${clesTriees[clesTriees.length - 1]}`;
      const zipNom = `alertes-auto-relance-plage-${suffixe}-${todayISO()}.zip`;
      // On construit l'archive en mémoire (sans l'imposer encore) puis on la télécharge : le blob est
      // conservé pour permettre un renommage prudent juste après (re-téléchargement sous un autre nom).
      const build = await creerZip(entries);
      telechargerBlob(zipNom, build.blob);
      setZipFichier({ blob: build.blob, nom: zipNom, entries: build.entries, size: build.size });
      // On mémorise l'export dans l'historique local (3 derniers) pour le retrouver ensuite, en
      // conservant le filtre utilisé (mois sélectionnés ou plage de dates) et l'archive en mémoire
      // pour pouvoir la re-télécharger ou réappliquer son filtre d'un clic.
      setZipHistorique(
        ajouterRecapAlertesZipHistorique({
          nom: zipNom,
          taille: build.size,
          date: new Date().toISOString(),
          cles: [...moisSelectionnes].sort(),
          periode: filtreMois ? "" : periode,
          csv: zipParts.csv,
          png: zipParts.png,
          lignes: zipParts.csv ? nbLignesCsv : undefined,
          mois: zipParts.png
            ? moisSelectionnes.length > 0
              ? `${moisSelectionnes.length} mois (${libelleMoisCles(moisSelectionnes)})`
              : `les ${moisAffiches} mois affichés`
            : undefined,
        }),
      );
      setZipBlobs((prev) => ({ ...prev, [zipNom]: build.blob }));
      // Le toast rappelle le nom du fichier produit, son nombre d'éléments et sa taille.
      setZipToast(`${zipNom} · ${build.entries} fichier${build.entries > 1 ? "s" : ""} · ${formaterOctets(build.size)}`);
    } finally {
      setExportPlageBusy(false);
    }
  };

  // Ouvre la fenêtre de renommage du dernier ZIP exporté, pré-remplie avec son nom actuel.
  const handleOuvrirRenommer = () => {
    if (!zipFichier) return;
    setNomEdite(zipFichier.nom);
    setRenommerCible(zipFichier.nom);
    setRenommerOuvert(true);
  };

  // Ouvre la fenêtre de renommage d'une entrée précise de l'historique des exports ZIP.
  const handleOuvrirRenommerEntry = (item: RecapAlertesZipHistoItem) => {
    setDetailOuvert(null);
    setNomEdite(item.nom);
    setRenommerCible(item.nom);
    setRenommerOuvert(true);
  };

  // Renomme l'archive ciblée (dernier export ou entrée d'historique) : extension .zip garantie,
  // séparateurs de chemin neutralisés. Le contenu en mémoire suit le nouveau nom pour rester
  // re-téléchargeable, et le dernier export (toast) est re-téléchargé sous le nouveau nom.
  const handleConfirmerRenommer = () => {
    const ancien = renommerCible;
    if (!ancien) return;
    let nom = nomEdite.trim().replace(/[\\/]+/g, "-");
    if (!nom) nom = ancien;
    if (!/\.zip$/i.test(nom)) nom = `${nom}.zip`;
    if (nom === ancien) {
      setRenommerOuvert(false);
      setRenommerCible(null);
      return;
    }
    // On déplace l'archive en mémoire sous le nouveau nom (si elle est encore disponible).
    setZipBlobs((prev) => {
      if (!prev[ancien]) return prev;
      const suivant = { ...prev };
      delete suivant[ancien];
      suivant[nom] = prev[ancien];
      return suivant;
    });
    setZipHistorique(renommerRecapAlertesZipHistorique(nom, ancien));
    // La sélection multiple suit le nouveau nom si l'archive y figurait.
    setZipSelection((prev) => prev.map((n) => (n === ancien ? nom : n)));
    // Le dernier export (toast « Renommer ») est re-téléchargé sous le nouveau nom, comme avant.
    if (zipFichier && zipFichier.nom === ancien) {
      telechargerBlob(nom, zipFichier.blob);
      setZipFichier({ ...zipFichier, nom });
      setZipToast(`${nom} · ${zipFichier.entries} fichier${zipFichier.entries > 1 ? "s" : ""} · ${formaterOctets(zipFichier.size)}`);
    }
    setRenommeConfirme(nom);
    window.setTimeout(() => setRenommeConfirme((n) => (n === nom ? null : n)), 2200);
    setRenommerOuvert(false);
    setRenommerCible(null);
  };

  // Vide entièrement la mémoire des exports ZIP (historique local + archives conservées en session).
  const handleViderHistorique = () => {
    viderRecapAlertesZipHistorique();
    setZipHistorique([]);
    setZipBlobs({});
    setZipSelection([]);
    setSelectionConfirme(0);
    setDetailOuvert(null);
    setRedlConfirme(null);
    setRenommeConfirme(null);
    setViderEnCours(false);
    setHistoOuvert(false);
  };

  // Re-télécharge d'un clic une archive mémorisée, tant qu'elle est encore conservée en mémoire
  // (les archives générées lors d'une session précédente ne sont plus disponibles).
  const handleRedownloadZipHistorique = (item: RecapAlertesZipHistoItem) => {
    const blob = zipBlobs[item.nom];
    if (!blob) return;
    telechargerBlob(item.nom, blob);
    // Petit retour visuel éphémère (coche) sur la ligne concernée.
    setRedlConfirme(item.nom);
    window.setTimeout(() => setRedlConfirme((n) => (n === item.nom ? null : n)), 1800);
  };

  // Épingle / dé-épingle une archive en favori (conservée en tête de l'historique).
  const handleToggleEpingle = (nom: string) => {
    const item = zipHistorique.find((h) => h.nom === nom);
    setZipHistorique(epinglerRecapAlertesZipHistorique(nom, !item?.epingle));
  };

  // Épingle d'un clic toutes les archives actuellement affichées (correspondant au filtre actif).
  const handleEpinglerFiltre = () => {
    if (zipAFigerFiltreNoms.length === 0) return;
    setZipHistorique(epinglerPlusieursRecapAlertesZipHistorique(zipAFigerFiltreNoms));
  };

  // Épingle d'un clic uniquement les archives filtrées de type CSV ou PNG plus légères que le poids
  // moyen (donc « sous le seuil »), tandis que les ZIP des autres types ou au-dessus de la moyenne
  // restent inchangés. Complète « Épingler cette recherche » en ciblant les archives légères.
  const handleEpinglerSousSeuil = () => {
    if (zipSousSeuilNoms.length === 0) return;
    setZipHistorique(epinglerPlusieursRecapAlertesZipHistorique(zipSousSeuilNoms));
  };

  // Retire d'un clic les favoris des SEULES archives correspondant au filtre actif (l'inverse de
  // « Épingler cette recherche »). Les épingles hors filtre restent intactes.
  const handleDesepinglerFiltre = () => {
    const noms = zipHistoriqueAffiche.filter((h) => Boolean(h.epingle)).map((h) => h.nom);
    if (noms.length === 0) return;
    setZipHistorique(desepinglerPlusieursRecapAlertesZipHistorique(noms));
  };

  // Retire d'un coup toutes les épingles : l'historique repart sans favoris.
  const handleToutDesepingler = () => {
    setZipHistorique(toutDesepinglerRecapAlertesZipHistorique());
  };

  // Réinitialise d'un clic les épingles de la SEULE recherche courante (filtre actif) : on retire
  // les favoris des archives filtrées, et on lève au besoin le raccourci « favoris uniquement »
  // pour que la liste reste exploitable. Se distingue ainsi d'un simple dé-épinglage unitaire
  // et d'un nettoyage total de toutes les épingles.
  const handleReinitialiserEpinglesRecherche = () => {
    const noms = zipHistoriqueAffiche.filter((h) => Boolean(h.epingle)).map((h) => h.nom);
    if (noms.length === 0) return;
    setZipHistorique(desepinglerPlusieursRecapAlertesZipHistorique(noms));
    if (favorisUniquement) setFavorisUniquement(false);
    setEpinglesResetConfirme(noms.length);
    window.setTimeout(() => setEpinglesResetConfirme(0), 2200);
  };

  // Nombre d'archives actuellement épinglées en favori (affiché sur le bouton « Exports ZIP »).
  const nbEpinglees = useMemo(() => zipHistorique.filter((h) => Boolean(h.epingle)).length, [zipHistorique]);

  // Historique affiché dans le panneau : recherche par nom + filtres par type, par plage de
  // dates et raccourci « favoris uniquement », épinglés en tête.
  const zipHistoriqueAffiche = useMemo(() => {
    const q = rechercheZip.trim().toLowerCase();
    const seuil7j = Date.now() - 7 * 86400000;
    const maintenant = new Date();
    const estMemeJour = (iso: string): boolean => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return false;
      return (
        d.getFullYear() === maintenant.getFullYear() &&
        d.getMonth() === maintenant.getMonth() &&
        d.getDate() === maintenant.getDate()
      );
    };
    const filtres = zipHistorique.filter((h) => {
      if (favorisUniquement && !h.epingle) return false;
      if (q && !h.nom.toLowerCase().includes(q)) return false;
      if (filtreDateZip === "aujourdhui" && !estMemeJour(h.date)) return false;
      if (filtreDateZip === "7j") {
        const t = new Date(h.date).getTime();
        if (Number.isNaN(t) || t < seuil7j) return false;
      }
      if (filtreTypeZip === "csv") return h.csv === true && h.png !== true;
      if (filtreTypeZip === "png") return h.png === true && h.csv !== true;
      if (filtreTypeZip === "lesdeux") return h.csv === true && h.png === true;
      return true;
    });
    return [...filtres].sort((a, b) => Number(Boolean(b.epingle)) - Number(Boolean(a.epingle)));
  }, [zipHistorique, rechercheZip, filtreTypeZip, filtreDateZip, favorisUniquement]);

  // Noms des archives encore disponibles en mémoire (donc re-téléchargeables).
  const zipDispoNoms = zipHistorique.filter((h) => zipBlobs[h.nom]).map((h) => h.nom);
  // Noms des archives AFFICHÉES (filtre actif : recherche, type, dates, favoris) et encore en mémoire.
  const zipDispoFiltreNoms = zipHistoriqueAffiche.filter((h) => zipBlobs[h.nom]).map((h) => h.nom);
  // Poids total des archives encore disponibles en mémoire (pour le récapitulatif du panneau).
  const poidsDispoZip = zipHistorique.filter((h) => zipBlobs[h.nom]).reduce((s, h) => s + h.taille, 0);
  // Poids moyen par archive encore disponible en mémoire (repère pour repérer les ZIP anormalement lourds).
  const poidsMoyenDispoZip = zipDispoNoms.length > 0 ? poidsDispoZip / zipDispoNoms.length : 0;
  // Nombre d'archives épinglées parmi celles affichées (filtre actif).
  const nbEpingleesFiltre = zipHistoriqueAffiche.filter((h) => Boolean(h.epingle)).length;
  // Noms des archives affichées qui ne sont PAS encore épinglées (cibles du bouton « Épingler cette recherche »).
  const zipAFigerFiltreNoms = zipHistoriqueAffiche.filter((h) => !h.epingle).map((h) => h.nom);
  // Noms des archives affichées (filtre actif) de type CSV seul ou PNG seul, et plus légères que le
  // poids moyen disponible : cibles du bouton « Épingler uniquement les filtres sous le seuil ».
  const zipSousSeuilNoms = zipHistoriqueAffiche
    .filter(
      (h) =>
        Boolean(zipBlobs[h.nom]) &&
        !h.epingle &&
        (h.csv === true || h.png === true) &&
        !(h.csv === true && h.png === true) &&
        poidsMoyenDispoZip > 0 &&
        h.taille < poidsMoyenDispoZip,
    )
    .map((h) => h.nom);
  // Date du plus ancien export encore disponible en mémoire (ou null si aucun), pour le récapitulatif.
  const plusAncienDispoZip = useMemo(() => {
    const dates = zipHistorique
      .filter((h) => zipBlobs[h.nom] && h.date)
      .map((h) => new Date(h.date).getTime())
      .filter((t) => !Number.isNaN(t));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates)).toISOString();
  }, [zipHistorique, zipBlobs]);
  // Répartition par contenu des archives encore disponibles en mémoire (CSV seul / PNG seul / les deux),
  // avec le poids total propre à chaque type pour comparer les volumes d'un coup d'œil.
  const repartitionDispoZip = useMemo(() => {
    let csvSeul = 0;
    let pngSeul = 0;
    let lesDeux = 0;
    let poidsCsvSeul = 0;
    let poidsPngSeul = 0;
    let poidsLesDeux = 0;
    zipHistorique.forEach((h) => {
      if (!zipBlobs[h.nom]) return;
      if (h.csv === true && h.png === true) {
        lesDeux += 1;
        poidsLesDeux += h.taille;
      } else if (h.csv === true) {
        csvSeul += 1;
        poidsCsvSeul += h.taille;
      } else if (h.png === true) {
        pngSeul += 1;
        poidsPngSeul += h.taille;
      }
    });
    return {
      csvSeul,
      pngSeul,
      lesDeux,
      poidsCsvSeul,
      poidsPngSeul,
      poidsLesDeux,
      total: csvSeul + pngSeul + lesDeux,
    };
  }, [zipHistorique, zipBlobs]);
  // Vrai si au moins un filtre du panneau est actif (active le bouton « Réinitialiser »).
  const filtresActifs =
    rechercheZip.trim().length > 0 || filtreTypeZip !== "tous" || filtreDateZip !== "tout" || favorisUniquement;
  // Réinitialise d'un clic tous les filtres du panneau (recherche, type, dates, favoris uniquement).
  const handleReinitialiserFiltres = () => {
    setRechercheZip("");
    setFiltreTypeZip("tous");
    setFiltreDateZip("tout");
    setFavorisUniquement(false);
  };
  // Rappel « double-cliquez » affiché après un simple clic sur « Tout télécharger (filtré) ».
  const [toutDlHint, setToutDlHint] = useState(false);
  // Vrai si toutes les archives disponibles sont actuellement sélectionnées.
  const tousSelectionnes = zipDispoNoms.length > 0 && zipDispoNoms.every((n) => zipSelection.includes(n));

  // Bascule la sélection d'une archive mémorisée (pour un téléchargement groupé).
  const toggleSelectZip = (nom: string) => {
    setZipSelection((prev) => (prev.includes(nom) ? prev.filter((n) => n !== nom) : [...prev, nom]));
  };

  // Sélectionne / désélectionne d'un clic toutes les archives encore disponibles.
  const handleToggleSelectAll = () => {
    setZipSelection(tousSelectionnes ? [] : zipDispoNoms);
  };

  // Re-télécharge d'un seul clic toutes les archives sélectionnées (léger décalage entre chaque
  // téléchargement pour laisser le navigateur les traiter sans en bloquer).
  const handleTelechargerSelection = () => {
    const noms = zipSelection.filter((n) => zipBlobs[n]);
    if (noms.length === 0) return;
    noms.forEach((nom, i) => {
      window.setTimeout(() => {
        telechargerBlob(nom, zipBlobs[nom]);
        if (i === noms.length - 1) {
          setSelectionConfirme(noms.length);
          window.setTimeout(() => setSelectionConfirme(0), 2200);
        }
      }, i * 350);
    });
  };

  // Sélectionne puis télécharge d'un seul clic TOUTES les archives correspondant au filtre actif
  // (recherche, type, dates, favoris uniquement), parmi celles encore disponibles en mémoire.
  const handleTelechargerFiltre = () => {
    const noms = zipDispoFiltreNoms;
    if (noms.length === 0) return;
    setZipSelection(noms);
    noms.forEach((nom, i) => {
      window.setTimeout(() => {
        telechargerBlob(nom, zipBlobs[nom]);
        if (i === noms.length - 1) {
          setSelectionConfirme(noms.length);
          window.setTimeout(() => setSelectionConfirme(0), 2200);
        }
      }, i * 350);
    });
  };

  // Simple clic sur « Tout télécharger (filtré) » : rappel visuel invitant à double-cliquer.
  const handleToutDlClic = () => {
    setToutDlHint(true);
    window.setTimeout(() => setToutDlHint(false), 2000);
  };

  // Double-clic sur « Tout télécharger (filtré) » : relance DIRECTEMENT le téléchargement de toutes
  // les archives correspondant au filtre actif (recherche, type, dates, favoris) encore disponibles,
  // sans passer par la sélection manuelle.
  const handleToutDlDouble = () => {
    setToutDlHint(false);
    const noms = zipDispoFiltreNoms;
    if (noms.length === 0) return;
    noms.forEach((nom, i) => {
      window.setTimeout(() => {
        telechargerBlob(nom, zipBlobs[nom]);
        if (i === noms.length - 1) {
          setSelectionConfirme(noms.length);
          window.setTimeout(() => setSelectionConfirme(0), 2200);
        }
      }, i * 350);
    });
  };

  // Exporte l'historique des exports ZIP en CSV (nom, taille, date, contenu, filtre utilisé).
  const handleExportHistoriqueZipCsv = () => {
    if (zipHistorique.length === 0) return;
    const rows = zipHistorique.map((h) => [
      h.nom,
      formaterOctets(h.taille),
      h.date ? formatShortDate(h.date) : "",
      libelleContenuZip(h),
      libelleFiltreZip(h),
    ]);
    const contenu = toCsv(["Nom", "Taille", "Date", "Contenu", "Filtre utilisé"], rows);
    downloadCsv(`historique-exports-zip-${todayISO()}.csv`, contenu);
  };

  // Réapplique le filtre (mois sélectionnés, ou plage de dates) utilisé pour un export mémorisé.
  const handleReprendreFiltre = (item: RecapAlertesZipHistoItem) => {
    setHistoOuvert(false);
    if (item.cles.length > 0) {
      handleSelectMonths(item.cles);
      return;
    }
    handleSelectMonths([]);
    if (item.periode === "tout" || item.periode === "30j" || item.periode === "90j") {
      setPeriode(item.periode);
    }
  };

  return (
    <div id="graphe-alertes" className="rounded-lg bg-background-100 border border-background-200 overflow-hidden scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-background-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
          <i className="ri-notification-3-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950">Alertes email à l'artisan</h3>
          <p className="text-xs text-foreground-500">
            Trace des alertes réellement envoyées quand l'auto-relance des oubliés a expédié des relances (date + comptes concernés).
          </p>
        </div>
        {!loading && !error && visibles.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
            title="Nombre total de comptes recontactés signalés par ces alertes"
          >
            <i className="ri-user-received-2-line"></i>
            {totalComptes} compte{totalComptes > 1 ? "s" : ""} signalé{totalComptes > 1 ? "s" : ""}
          </span>
        )}
        <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                handleSelectMonths([]);
                setPeriode(p.key);
              }}
              aria-pressed={periode === p.key && moisSelectionnes.length === 0}
              title={`Afficher uniquement les alertes des ${p.jours ? `${p.jours} derniers jours` : "derniers envois"}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                periode === p.key && moisSelectionnes.length === 0
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {p.label}
              <span className={periode === p.key && moisSelectionnes.length === 0 ? "text-background-50/80" : "text-foreground-400"}>
                {countPeriode(p.jours)}
              </span>
            </button>
          ))}
        </div>
        <div
          className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-background-50 border border-background-200"
          title="Choisir les fichiers inclus dans l'archive ZIP combinée (CSV, PNG ou les deux)"
        >
          <span className="text-[11px] font-semibold text-foreground-500 inline-flex items-center gap-1 whitespace-nowrap">
            <i className="ri-file-zip-line text-accent-600"></i>
            ZIP
          </span>
          <label className="inline-flex items-center gap-1 text-[11px] text-foreground-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={zipParts.csv}
              onChange={() => handleToggleZipPart("csv")}
              className="w-3.5 h-3.5 accent-accent-600 cursor-pointer"
            />
            CSV
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-foreground-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={zipParts.png}
              onChange={() => handleToggleZipPart("png")}
              className="w-3.5 h-3.5 accent-accent-600 cursor-pointer"
            />
            PNG
          </label>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setHistoOuvert((o) => !o)}
            aria-expanded={histoOuvert}
            disabled={zipHistorique.length === 0}
            title={
              zipHistorique.length === 0
                ? "Aucun export ZIP encore généré"
                : `Voir les ${zipHistorique.length} derniers exports ZIP (nom + taille)`
            }
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-history-line"></i>
            Exports ZIP
            {zipHistorique.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-secondary-200 text-secondary-900 text-[10px] font-bold">
                {zipHistorique.length}
              </span>
            )}
            {nbEpinglees > 0 && (
              <span
                className="inline-flex items-center gap-0.5 h-4 px-1 rounded-full bg-accent-100 text-accent-700 text-[10px] font-bold"
                title={`${nbEpinglees} archive${nbEpinglees > 1 ? "s" : ""} épinglée${nbEpinglees > 1 ? "s" : ""} en favori`}
              >
                <i className="ri-pushpin-2-fill text-[9px]"></i>
                {nbEpinglees}
              </span>
            )}
            <i className={histoOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
          </button>
          {histoOuvert && zipHistorique.length > 0 && (
            <>
              <button
                type="button"
                aria-label="Fermer l'historique des exports"
                onClick={() => setHistoOuvert(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <div className="absolute right-0 top-full mt-1.5 z-30 w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg border border-background-200 bg-background-50 animate-fade-in">
                <div className="px-3 pt-2.5 pb-2 border-b border-background-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                      {RECAP_ALERTES_ZIP_HISTO_MAX} derniers exports ZIP
                    </p>
                    {viderEnCours ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleViderHistorique}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-red-100 text-red-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors"
                        >
                          <i className="ri-delete-bin-2-line"></i>
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setViderEnCours(false)}
                          className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViderEnCours(true)}
                        title="Vider l'historique des exports ZIP pour repartir de zéro"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-foreground-500 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-red-600 transition-colors"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                        Vider l'historique
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] text-foreground-500">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Nombre d'archives épinglées en favori">
                      <i className="ri-pushpin-2-fill text-accent-600"></i>
                      <span className="font-semibold text-foreground-700">{nbEpinglees}</span>
                      épinglée{nbEpinglees > 1 ? "s" : ""}
                    </span>
                    <span className="text-foreground-300">·</span>
                    <span
                      className="inline-flex items-center gap-1 whitespace-nowrap"
                      title="Poids total des archives encore disponibles en mémoire (re-téléchargeables)"
                    >
                      <i className="ri-hard-drive-2-line text-secondary-600"></i>
                      {formaterOctets(poidsDispoZip)} disponible{poidsDispoZip > 1024 ? "s" : ""}
                      <span className="text-foreground-400">
                        ({zipDispoNoms.length} archive{zipDispoNoms.length > 1 ? "s" : ""})
                      </span>
                    </span>
                    {poidsMoyenDispoZip > 0 && (
                      <>
                        <span className="text-foreground-300">·</span>
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap"
                          title="Poids moyen par archive encore disponible en mémoire : repère pour repérer les ZIP anormalement lourds"
                        >
                          <i className="ri-scales-3-line text-secondary-600"></i>
                          moyenne : {formaterOctets(poidsMoyenDispoZip)} / archive
                        </span>
                      </>
                    )}
                    {plusAncienDispoZip && (
                      <>
                        <span className="text-foreground-300">·</span>
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap"
                          title="Date du plus ancien export encore disponible en mémoire"
                        >
                          <i className="ri-calendar-2-line text-secondary-600"></i>
                          plus ancien : {formatShortDate(plusAncienDispoZip)}
                        </span>
                      </>
                    )}
                    {repartitionDispoZip.total > 0 && (
                      <>
                        <span className="text-foreground-300">·</span>
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap"
                          title="Répartition par contenu des archives encore disponibles en mémoire : CSV seul, PNG seul, ou les deux, avec le poids total de chaque type"
                        >
                          <i className="ri-pie-chart-2-line text-secondary-600"></i>
                          <span className="inline-flex items-center gap-0.5">
                            <i className="ri-file-excel-2-line text-accent-600"></i>
                            <span className="font-semibold text-foreground-700">{repartitionDispoZip.csvSeul}</span>
                            CSV
                            <span className="text-foreground-400">· {formaterOctets(repartitionDispoZip.poidsCsvSeul)}</span>
                          </span>
                          <span className="text-foreground-300">/</span>
                          <span className="inline-flex items-center gap-0.5">
                            <i className="ri-image-line text-accent-600"></i>
                            <span className="font-semibold text-foreground-700">{repartitionDispoZip.pngSeul}</span>
                            PNG
                            <span className="text-foreground-400">· {formaterOctets(repartitionDispoZip.poidsPngSeul)}</span>
                          </span>
                          <span className="text-foreground-300">/</span>
                          <span className="inline-flex items-center gap-0.5">
                            <i className="ri-stack-line text-accent-600"></i>
                            <span className="font-semibold text-foreground-700">{repartitionDispoZip.lesDeux}</span>
                            les deux
                            <span className="text-foreground-400">· {formaterOctets(repartitionDispoZip.poidsLesDeux)}</span>
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setFavorisUniquement((v) => !v)}
                      aria-pressed={favorisUniquement}
                      title="N'afficher que les archives épinglées en favori"
                      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        favorisUniquement
                          ? "bg-accent-500 text-background-50"
                          : "bg-accent-100 text-accent-700 hover:bg-accent-200"
                      }`}
                    >
                      <i className={favorisUniquement ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                      Favoris uniquement
                      {nbEpinglees > 0 && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full text-[9px] font-bold ${
                            favorisUniquement ? "bg-background-50/25" : "bg-background-50/70"
                          }`}
                        >
                          {nbEpinglees}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportHistoriqueZipCsv}
                      title="Exporter cet historique en CSV (nom, taille, date, contenu, filtre utilisé)"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className="ri-file-excel-2-line"></i>
                      Exporter en CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleEpinglerFiltre}
                      disabled={zipAFigerFiltreNoms.length === 0}
                      title="Épingler en favori, d'un clic, toutes les archives correspondant au filtre actif (recherche, type, dates, favoris)"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-100 text-accent-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-pushpin-2-line"></i>
                      Épingler cette recherche
                      {zipAFigerFiltreNoms.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/70 text-[9px] font-bold">
                          {zipAFigerFiltreNoms.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleEpinglerSousSeuil}
                      disabled={zipSousSeuilNoms.length === 0}
                      title="Épingler en favori, d'un clic, les archives filtrées de type CSV ou PNG plus légères que le poids moyen (sous le seuil), sans toucher aux autres"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-100 text-accent-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-pushpin-2-line"></i>
                      Épingler uniquement les filtres sous le seuil
                      {zipSousSeuilNoms.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/70 text-[9px] font-bold">
                          {zipSousSeuilNoms.length}
                        </span>
                      )}
                    </button>
                    {nbEpingleesFiltre > 0 && (
                      <button
                        type="button"
                        onClick={handleDesepinglerFiltre}
                        title="Retirer des favoris, d'un clic, uniquement les archives correspondant au filtre actif"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
                      >
                        <i className="ri-pushpin-2-line"></i>
                        Désépingler cette recherche
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-accent-100 text-accent-700 text-[9px] font-bold">
                          {nbEpingleesFiltre}
                        </span>
                      </button>
                    )}
                    {nbEpingleesFiltre > 0 && (
                      <button
                        type="button"
                        onClick={handleReinitialiserEpinglesRecherche}
                        title="Réinitialiser d'un clic les épingles de la recherche courante (archives filtrées) : se distingue d'un dé-épinglage unitaire comme d'un nettoyage total de toutes les épingles"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
                      >
                        <i className="ri-eraser-line"></i>
                        Réinitialiser les épingles de la recherche
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-accent-100 text-accent-700 text-[9px] font-bold">
                          {nbEpingleesFiltre}
                        </span>
                      </button>
                    )}
                    {nbEpinglees > 0 && (
                      <button
                        type="button"
                        onClick={handleToutDesepingler}
                        title="Retirer d'un coup toutes les archives mises en favori"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-100 text-accent-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                      >
                        <i className="ri-pushpin-2-fill"></i>
                        Tout désépingler
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/70 text-[9px] font-bold">
                          {nbEpinglees}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={zipDispoNoms.length === 0}
                      title="Sélectionner toutes les archives encore disponibles en mémoire"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className={tousSelectionnes ? "ri-checkbox-multiple-blank-line" : "ri-checkbox-multiple-line"}></i>
                      {tousSelectionnes ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    <button
                      type="button"
                      onClick={handleTelechargerFiltre}
                      disabled={zipDispoFiltreNoms.length === 0}
                      title="Sélectionner et télécharger d'un seul clic toutes les archives correspondant au filtre actif"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-500 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-checkbox-multiple-line"></i>
                      Tout sélectionner (filtré)
                      {zipDispoFiltreNoms.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/25 text-[9px] font-bold">
                          {zipDispoFiltreNoms.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={zipDispoFiltreNoms.length > 0 ? handleToutDlClic : undefined}
                      onDoubleClick={handleToutDlDouble}
                      disabled={zipDispoFiltreNoms.length === 0}
                      title="Double-cliquez pour télécharger d'un coup toutes les archives correspondant au filtre actif, sans passer par la sélection manuelle"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-primary-500 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-download-2-line"></i>
                      Tout télécharger (filtré)
                      <span className="inline-flex items-center rounded-full bg-background-50/20 px-1 text-[8px] font-bold uppercase tracking-wide">
                        2×
                      </span>
                      {zipDispoFiltreNoms.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/25 text-[9px] font-bold">
                          {zipDispoFiltreNoms.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleTelechargerSelection}
                      disabled={zipSelection.filter((n) => zipBlobs[n]).length === 0}
                      title="Re-télécharger d'un seul clic toutes les archives sélectionnées"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-500 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-download-2-line"></i>
                      Télécharger la sélection
                      {zipSelection.filter((n) => zipBlobs[n]).length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[14px] h-4 px-1 rounded-full bg-background-50/25 text-[9px] font-bold">
                          {zipSelection.filter((n) => zipBlobs[n]).length}
                        </span>
                      )}
                    </button>
                    {selectionConfirme > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-700 whitespace-nowrap">
                        <i className="ri-checkbox-circle-line"></i>
                        {selectionConfirme} archive{selectionConfirme > 1 ? "s" : ""} téléchargée{selectionConfirme > 1 ? "s" : ""}
                      </span>
                    )}
                    {epinglesResetConfirme > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-700 whitespace-nowrap">
                        <i className="ri-pushpin-2-line"></i>
                        {epinglesResetConfirme} épingle{epinglesResetConfirme > 1 ? "s" : ""} de la recherche retirée{epinglesResetConfirme > 1 ? "s" : ""}
                      </span>
                    )}
                    {toutDlHint && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-700 whitespace-nowrap">
                        <i className="ri-mouse-line"></i>
                        Double-cliquez pour tout lancer
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <RechercheRepliable
                      carteId="historique-alertes-auto"
                      carteLabel="Historique des récaps d'alerte"
                      value={rechercheZip}
                      onChange={setRechercheZip}
                      placeholder="Rechercher une archive…"
                      compact
                      conteneurClassName="flex-1 min-w-[150px]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {FILTRES_TYPE_ZIP.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFiltreTypeZip(f.key)}
                        aria-pressed={filtreTypeZip === f.key}
                        title={f.titre}
                        className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          filtreTypeZip === f.key
                            ? "bg-accent-500 text-background-50"
                            : "bg-background-100 border border-background-200 text-foreground-600 hover:border-accent-300"
                        }`}
                      >
                        <i className={f.icon}></i>
                        {f.label}
                      </button>
                    ))}
                    <span className="text-[10px] text-foreground-400 whitespace-nowrap">
                      {zipHistoriqueAffiche.length}/{zipHistorique.length} affichée{zipHistoriqueAffiche.length > 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={handleReinitialiserFiltres}
                      disabled={!filtresActifs}
                      title="Réinitialiser d'un clic tous les filtres : recherche, type, dates et favoris uniquement"
                      className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="ri-filter-off-line"></i>
                      Réinitialiser
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-foreground-400 whitespace-nowrap mr-0.5">
                      <i className="ri-calendar-2-line"></i>
                      Date
                    </span>
                    {FILTRES_DATE_ZIP.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFiltreDateZip(f.key)}
                        aria-pressed={filtreDateZip === f.key}
                        title={f.titre}
                        className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          filtreDateZip === f.key
                            ? "bg-secondary-500 text-background-50"
                            : "bg-background-100 border border-background-200 text-foreground-600 hover:border-accent-300"
                        }`}
                      >
                        <i className={f.icon}></i>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {zipHistoriqueAffiche.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[10px] text-foreground-400">
                    Aucune archive ne correspond à la recherche ou aux filtres de type et de date.
                  </p>
                ) : (
                <ul className="pb-1.5">
                  {zipHistoriqueAffiche.map((h, i) => {
                    const dispo = Boolean(zipBlobs[h.nom]);
                    const estRecent = zipHistorique.length > 0 && zipHistorique[0].nom === h.nom;
                    const epingle = Boolean(h.epingle);
                    const aFiltre =
                      h.cles.length > 0 || h.periode === "tout" || h.periode === "30j" || h.periode === "90j";
                    const aDetail = typeof h.csv === "boolean" || typeof h.png === "boolean";
                    const detailIci = detailOuvert === h.nom;
                    const typeContenu = typeContenuZip(h);
                    const selectionne = zipSelection.includes(h.nom);
                    return (
                      <li key={`${h.nom}-${i}`} className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          <label
                            className={`shrink-0 mt-1 flex items-center justify-center w-5 h-5 rounded ${
                              dispo ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                            }`}
                            title={
                              dispo
                                ? "Sélectionner cette archive pour la télécharger avec les autres"
                                : "Archive d'une session précédente : plus disponible en mémoire"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={selectionne}
                              disabled={!dispo}
                              onChange={() => toggleSelectZip(h.nom)}
                              className="w-3.5 h-3.5 accent-accent-600 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </label>
                          <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 mt-0.5">
                            <i className="ri-file-zip-line text-xs"></i>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-foreground-900 flex items-center gap-1 max-w-full" title={h.nom}>
                              {epingle && <i className="ri-pushpin-2-fill text-accent-600 shrink-0"></i>}
                              <span className="truncate">{h.nom}</span>
                            </p>
                            {renommeConfirme === h.nom && (
                              <p className="text-[10px] text-accent-700 inline-flex items-center gap-1">
                                <i className="ri-checkbox-circle-line"></i>
                                Nom mis à jour
                              </p>
                            )}
                            <p className="text-[10px] text-foreground-500 truncate">
                              {formaterOctets(h.taille)}
                              {h.date ? ` · ${formatShortDate(h.date)}` : ""}
                              {estRecent ? " · le plus récent" : ""}
                            </p>
                            {!dispo && (
                              <span
                                className="inline-flex items-center gap-1 h-4 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold whitespace-nowrap"
                                title="Cette archive a été générée lors d'une session précédente : son contenu n'est plus conservé en mémoire et ne peut plus être re-téléchargé."
                              >
                                <i className="ri-error-warning-line"></i>
                                Session précédente · non re-téléchargeable
                              </span>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1 truncate">
                                <i
                                  className={
                                    h.cles.length > 0
                                      ? "ri-filter-3-line text-accent-600"
                                      : "ri-calendar-line text-secondary-600"
                                  }
                                ></i>
                                {libelleFiltreZip(h)}
                              </span>
                              {typeContenu && (
                                <span
                                  className={`inline-flex items-center gap-1 h-4 px-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${typeContenu.cls}`}
                                  title={`Contenu de l'archive : ${typeContenu.label}`}
                                >
                                  <i className={typeContenu.icon}></i>
                                  {typeContenu.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleEpingle(h.nom)}
                              aria-pressed={epingle}
                              title={
                                epingle
                                  ? "Retirer des favoris (ne plus garder en tête de l'historique)"
                                  : "Épingler en favori (garder en tête de l'historique)"
                              }
                              aria-label={epingle ? "Retirer des favoris" : "Épingler en favori"}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md border cursor-pointer transition-colors ${
                                epingle
                                  ? "bg-accent-100 border-accent-300 text-accent-700"
                                  : "bg-background-100 border-background-200 text-foreground-600 hover:border-accent-300"
                              }`}
                            >
                              <i className={epingle ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOuvrirRenommerEntry(h)}
                              title="Renommer cette archive dans l'historique"
                              aria-label="Renommer cette archive ZIP"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background-100 border border-background-200 text-foreground-600 cursor-pointer hover:border-accent-300 transition-colors"
                            >
                              <i className="ri-edit-2-line"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailOuvert((n) => (n === h.nom ? null : h.nom))}
                              aria-expanded={detailIci}
                              title={
                                aDetail
                                  ? "Voir le contenu détaillé de cette archive (CSV/PNG)"
                                  : "Contenu non mémorisé pour cet export ancien"
                              }
                              aria-label="Voir le contenu détaillé de l'export"
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md border cursor-pointer transition-colors ${
                                detailIci
                                  ? "bg-accent-100 border-accent-300 text-accent-700"
                                  : "bg-background-100 border-background-200 text-foreground-600 hover:border-accent-300"
                              }`}
                            >
                              <i className="ri-information-line"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRedownloadZipHistorique(h)}
                              disabled={!dispo}
                              title={
                                dispo
                                  ? "Re-télécharger cette archive d'un clic"
                                  : "Archive générée lors d'une session précédente : plus disponible en mémoire"
                              }
                              aria-label="Re-télécharger cette archive ZIP"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background-100 border border-background-200 text-foreground-600 cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <i
                                className={
                                  redlConfirme === h.nom ? "ri-check-line text-accent-700" : "ri-download-2-line"
                                }
                              ></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReprendreFiltre(h)}
                              disabled={!aFiltre}
                              title={
                                aFiltre
                                  ? "Reprendre le filtre de cet export (réafficher sa plage de mois)"
                                  : "Aucun filtre mémorisé pour cet export"
                              }
                              aria-label="Reprendre le filtre de cet export"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background-100 border border-background-200 text-foreground-600 cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <i className="ri-history-line"></i>
                            </button>
                          </div>
                        </div>
                        {detailIci && (
                          <div className="mt-1.5 ml-8 rounded-md border border-background-200 bg-background-100 px-2.5 py-2">
                            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide mb-1">
                              Contenu de l'archive
                            </p>
                            {aDetail ? (
                              <ul className="flex flex-col gap-1">
                                <li className="flex items-center gap-1.5 text-[10px] text-foreground-700">
                                  <i
                                    className={
                                      h.csv
                                        ? "ri-checkbox-circle-line text-accent-600"
                                        : "ri-close-circle-line text-foreground-400"
                                    }
                                  ></i>
                                  <span className="font-semibold">CSV</span>
                                  <span className="text-foreground-500">
                                    {h.csv
                                      ? h.lignes != null
                                        ? `· ${h.lignes} ligne${h.lignes > 1 ? "s" : ""}`
                                        : "· inclus"
                                      : "· non inclus"}
                                  </span>
                                </li>
                                <li className="flex items-center gap-1.5 text-[10px] text-foreground-700">
                                  <i
                                    className={
                                      h.png
                                        ? "ri-checkbox-circle-line text-accent-600"
                                        : "ri-close-circle-line text-foreground-400"
                                    }
                                  ></i>
                                  <span className="font-semibold">PNG</span>
                                  <span className="text-foreground-500">
                                    {h.png ? `· ${h.mois ?? "courbe des alertes"}` : "· non inclus"}
                                  </span>
                                </li>
                              </ul>
                            ) : (
                              <p className="text-[10px] text-foreground-400">
                                Contenu non mémorisé pour cet export plus ancien.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loading || visibles.length === 0}
          title="Exporter les alertes affichées (date, comptes concernés) au format CSV"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ri-file-excel-2-line"></i>
          Exporter CSV
        </button>
        {moisSelectionnes.length === 0 && !loading && !error && visibles.length > 0 && (
          <button
            type="button"
            onClick={() => void handleExportPlageZip()}
            disabled={exportPlageBusy}
            title={`Télécharger en un seul ZIP les fichiers sélectionnés (${zipContenuLabel}) de la période affichée — ${zipRecap}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={exportPlageBusy ? "ri-loader-4-line animate-spin" : "ri-file-zip-line"}></i>
            Exporter ({zipContenuLabel})
          </button>
        )}
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          title="Rafraîchir l'historique des alertes"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`ri-refresh-line ${loading ? "animate-spin" : ""}`}></i>
          Rafraîchir
        </button>
      </div>

      {!loading && !error && items.length > 0 && (
        <EvolutionAlertesMoisChart
          items={items}
          moisAffiches={moisAffiches}
          onMoisAffichesChange={onMoisAffichesChange}
          moisSelectionnes={moisSelectionnes}
          onSelectMonths={handleSelectMonths}
          resumeTexte={resumeTexte}
        />
      )}

      {moisSelectionnes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-background-200 bg-accent-50">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap">
            <i className="ri-filter-3-line"></i>
            {moisSelectionnes.length === 1
              ? `Mois : ${libelleMoisCle(moisSelectionnes[0])}`
              : `${moisSelectionnes.length} mois : ${libelleMoisCles(moisSelectionnes)}`}
          </span>
          <span className="text-[11px] text-foreground-600">
            Liste filtrée sur {moisSelectionnes.length === 1 ? "ce mois" : "ces mois"} ({visibles.length} alerte
            {visibles.length > 1 ? "s" : ""})
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground-400 whitespace-nowrap">
            <i className="ri-information-line"></i>
            Ctrl + clic ou Maj + flèches sur le graphe pour étendre la plage
          </span>
          {plageMemorisee > 0 && (
            <span
              className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-background-50 border border-secondary-200 text-[11px] text-foreground-700 whitespace-nowrap"
              title="Cette plage de mois est conservée localement et restaurée à la réouverture de la page"
            >
              <i className="ri-bookmark-2-line text-secondary-600"></i>
              {plageMemorisee} mois mémorisé{plageMemorisee > 1 ? "s" : ""}
              <button
                type="button"
                onClick={handleOublierPlage}
                title="Oublier la plage retenue (ne plus la restaurer à la prochaine visite)"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-foreground-500 cursor-pointer hover:bg-background-200 hover:text-foreground-800 transition-colors"
              >
                <i className="ri-delete-bin-6-line text-xs"></i>
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyResume}
            title="Copier ce résumé (plage de mois et volume d'alertes)"
            className="inline-flex items-center gap-1.5 min-w-0 h-7 pl-2.5 pr-2 rounded-full bg-background-50 border border-accent-200 text-[11px] text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className="ri-file-text-line text-accent-600"></i>
            <span className="max-w-[280px] truncate" title={resumeTexte}>
              {resumeTexte}
            </span>
            <i className={resumeCopie ? "ri-check-line text-accent-700" : "ri-file-copy-line text-accent-700"}></i>
          </button>
          <button
            type="button"
            onClick={() => void handleExportPlageZip()}
            disabled={exportPlageBusy}
            title={`Télécharger en un seul ZIP les fichiers sélectionnés (${zipContenuLabel}) de la sélection de mois courante — ${zipRecap}`}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={exportPlageBusy ? "ri-loader-4-line animate-spin" : "ri-file-zip-line"}></i>
            Exporter la plage ({zipContenuLabel})
          </button>
          <button
            type="button"
            onClick={() => handleSelectMonths([])}
            title="Retirer le filtre de mois et revenir à la plage de dates"
            className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className="ri-close-line"></i>
            Retirer le filtre
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Chargement des alertes…</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 m-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          <i className="ri-error-warning-line mt-px"></i>
          <div className="flex flex-col gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={onReload}
              className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-100 text-red-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réessayer
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-10 px-4 text-center">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
            <i className="ri-notification-off-line text-xl"></i>
          </span>
          <p className="text-sm font-medium text-foreground-700">Aucune alerte envoyée pour l'instant</p>
          <p className="text-xs text-foreground-500 max-w-md">
            Dès qu'une auto-relance expédiera des relances et que l'alerte est activée, la date et les comptes concernés apparaîtront ici.
          </p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-10 px-4 text-center">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
            <i className="ri-filter-off-line text-xl"></i>
          </span>
          <p className="text-sm font-medium text-foreground-700">
            {moisSelectionnes.length > 0 ? "Aucune alerte sur ces mois" : "Aucune alerte sur cette période"}
          </p>
          <p className="text-xs text-foreground-500 max-w-md">
            {moisSelectionnes.length > 0
              ? "Aucune alerte n'a été envoyée sur les mois sélectionnés. Retirez le filtre de mois pour revenir à la plage de dates."
              : "Aucune alerte envoyée sur la plage sélectionnée. Élargissez le filtre à « Tout » pour voir l'historique complet."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (moisSelectionnes.length > 0) {
                handleSelectMonths([]);
              } else {
                setPeriode("tout");
              }
            }}
            className="mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
          >
            <i className="ri-history-line"></i>
            {moisSelectionnes.length > 0 ? "Retirer le filtre de mois" : "Voir tout l'historique"}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((a) => {
            const deplie = ouvert === a.id;
            return (
              <li key={a.id} className="border-t border-background-200 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOuvert(deplie ? null : a.id)}
                  aria-expanded={deplie}
                  title="Voir les comptes concernés par cette alerte"
                  className="w-full flex flex-wrap items-center gap-3 px-5 py-3 text-left cursor-pointer transition-colors hover:bg-background-50"
                >
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                    <i className="ri-mail-check-line"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground-950">{formatShortDate(a.envoyeLe)}</p>
                      <span
                        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          alertePersonnalisee ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-600"
                        }`}
                        title={
                          alertePersonnalisee
                            ? "Cet email d'alerte utilise votre objet/message personnalisé (réglé dans le profil)"
                            : "Cet email d'alerte utilise l'objet et le message par défaut"
                        }
                      >
                        <i className={alertePersonnalisee ? "ri-edit-2-line" : "ri-file-text-line"}></i>
                        {alertePersonnalisee ? "Objet personnalisé" : "Par défaut"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-500">Alerte « auto-relance expédiée » envoyée à l'artisan</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
                    <i className="ri-user-received-2-line"></i>
                    {a.nbComptes} compte{a.nbComptes > 1 ? "s" : ""} recontacté{a.nbComptes > 1 ? "s" : ""}
                  </span>
                  <i className={`${deplie ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-foreground-400`}></i>
                </button>
                {deplie && (
                  <div className="px-5 pb-4 animate-fade-in">
                    {a.comptes.length === 0 ? (
                      <p className="text-[11px] text-foreground-500">
                        Le détail des comptes n'est pas disponible pour cette alerte.
                      </p>
                    ) : (
                      <ul className="rounded-lg border border-background-200 divide-y divide-background-200 bg-background-50">
                        {a.comptes.map((c, i) => (
                          <li key={`${a.id}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                                <i className="ri-store-2-line"></i>
                              </span>
                              <span className="text-xs font-semibold text-foreground-900 truncate">{c.entreprise || "—"}</span>
                            </div>
                            <span className="text-[11px] text-foreground-500 truncate">{c.email || "Email non renseigné"}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReplay(a)}
                        disabled={replayBusy === a.id}
                        title="Renvoyer cet email d'alerte à l'artisan (mêmes comptes concernés)"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {replayBusy === a.id ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className="ri-mail-send-line"></i>
                        )}
                        Rejouer l'alerte
                      </button>
                      <button
                        type="button"
                        onClick={() => setApercuId(a.id)}
                        title="Voir le rendu exact de cet email d'alerte (aucun envoi n'est effectué)"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                      >
                        <i className="ri-eye-line"></i>
                        Aperçu
                      </button>
                      {replayMsg?.id === a.id && (
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                            replayMsg.ton === "ok"
                              ? "text-accent-700"
                              : replayMsg.ton === "err"
                                ? "text-red-600"
                                : "text-foreground-500"
                          }`}
                        >
                          <i
                            className={`mt-px ${
                              replayMsg.ton === "ok"
                                ? "ri-checkbox-circle-line"
                                : replayMsg.ton === "err"
                                  ? "ri-error-warning-line"
                                  : "ri-information-line"
                            }`}
                          ></i>
                          {replayMsg.texte}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {zipToast && (
        <Toast
          message={`Archive ZIP prête : ${zipToast}`}
          icon="ri-file-zip-line"
          duration={zipFichier ? 0 : 2800}
          actionLabel={zipFichier ? "Renommer" : undefined}
          onAction={zipFichier ? handleOuvrirRenommer : undefined}
          onClose={() => {
            setZipToast(null);
            setZipFichier(null);
          }}
        />
      )}

      {renommerOuvert && renommerCible && (
        <Modal
          title="Renommer l'archive ZIP"
          subtitle={
            zipFichier && zipFichier.nom === renommerCible
              ? "Le fichier sera re-téléchargé sous le nouveau nom. L'extension .zip est conservée."
              : "L'entrée de l'historique sera renommée. L'extension .zip est conservée."
          }
          onClose={() => {
            setRenommerOuvert(false);
            setRenommerCible(null);
          }}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setRenommerOuvert(false);
                  setRenommerCible(null);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerRenommer}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className={zipFichier && zipFichier.nom === renommerCible ? "ri-download-2-line" : "ri-edit-2-line"}></i>
                {zipFichier && zipFichier.nom === renommerCible ? "Renommer et télécharger" : "Renommer"}
              </button>
            </>
          }
        >
          <label className="block text-xs font-semibold text-foreground-600 mb-1" htmlFor="renommer-zip-input">
            Nom du fichier
          </label>
          <input
            id="renommer-zip-input"
            type="text"
            value={nomEdite}
            onChange={(e) => setNomEdite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmerRenommer();
            }}
            autoFocus
            className="w-full h-10 px-3 rounded-md border border-background-200 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:border-accent-400"
          />
          <p className="text-[11px] text-foreground-400 mt-1.5">
            Le nom de fichier actuel est <span className="font-medium text-foreground-600">{renommerCible}</span>.
          </p>
        </Modal>
      )}

      {apercuId !== null && userId && (
        <ApercuAlerteArtisanModal userId={userId} alertId={apercuId} onClose={() => setApercuId(null)} />
      )}
    </div>
  );
}