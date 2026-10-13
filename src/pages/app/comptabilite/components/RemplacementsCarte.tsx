import { useEffect, useMemo, useRef, useState } from "react";
import type { ComptableRemplacement } from "@/lib/artisanApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { buildRemplacementsPdf } from "@/lib/comptabilitePdf";
import { savePdf } from "@/lib/pdf";
import {
  exportRemplacementsChartImage,
  exportRemplacementsHistoriqueImage,
  getRemplacementsChartDataUrl,
} from "@/lib/remplacementsChartImage";
import {
  lireMoisEpingles,
  basculerMoisEpingle,
  ajouterMoisEpingles,
  deplacerMoisEpingle,
  monterMoisEnTete,
  reordonnerMoisEpingles,
  reinitialiserPrioriteEpingles,
  lireRempFiltreSousSeuil,
  ecrireRempFiltreSousSeuil,
  lireRempFiltreEpingle,
  ecrireRempFiltreEpingle,
  viderMoisEpingles,
  lireDernierMoisFaible,
  ecrireDernierMoisFaible,
  lireDernierMoisClavier,
  ecrireDernierMoisClavier,
  lireHistoriqueMoisClavier,
  viderHistoriqueMoisClavier,
  lireHistoriqueMoisFaibles,
  ajouterMoisFaibleHistorique,
  viderHistoriqueMoisFaibles,
  REMPLACEMENTS_EPINGLE_EVENT,
  REMPLACEMENTS_SOUSSEUIL_EVENT,
  REMPLACEMENTS_EPINGLEUNIQUEMENT_EVENT,
  REMPLACEMENTS_DERNIER_FAIBLE_EVENT,
  REMPLACEMENTS_DERNIER_CLAVIER_EVENT,
  REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT,
  REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT,
  lireEpinglesReplie,
  ecrireEpinglesReplie,
  trierMoisEpingles,
  lireTriEpingles,
  basculerTriEpingles,
  lireMenuClavierOuvert,
  ecrireMenuClavierOuvert,
  REMPLACEMENTS_EPINGLES_REPLIE_EVENT,
  REMPLACEMENTS_TRI_EPINGLES_EVENT,
  libelleTriEpingles,
  texteRangementEpingles,
  copierTextePressePapiers,
  type MenuClavierAncre,
  type TriEpinglesMode,
} from "@/lib/remplacementsSurveillance";
import { lireSeuilRemp, ecrireSeuilRemp } from "@/lib/remplacementsSeuil";
import {
  CHART_MOIS_STORAGE_KEY,
  RECORD_STORAGE_KEY,
  SEL_ADRESSE_STORAGE_KEY,
  SEL_NATURE_STORAGE_KEY,
  TRI_STORAGE_KEY,
  cleAdresse,
  dateHeureLabel,
  exerciceLabel,
  lireChartMoisMemorise,
  lireRecordUniquementMemorise,
  lireSelAdresseMemorise,
  lireSelNatureMemorise,
  lireTriMemorise,
  moisCleDeDate,
  moisCleLabel,
  natureLabel,
  type ChartMois,
  type GroupeRemplacement,
  type TriKey,
} from "./remplacements/remplacementsUi";
import RemplacementsChart from "./remplacements/RemplacementsChart";
import RemplacementsSelection from "./remplacements/RemplacementsSelection";
import RemplacementsListe from "./remplacements/RemplacementsListe";
import RemplacementsRangementBar from "@/components/feature/RemplacementsRangementBar";
import Toast from "@/components/base/Toast";

/**
 * Vue « Remplacements » de l'Espace comptable : recense tous les destinataires ponctuels
 * réellement utilisés (adresse, libellé, date et exercice concerné), afin de retrouver ses
 * renvois de remplacement d'un coup d'œil. Regroupée par adresse, triable (date, nombre de
 * renvois ou adresse) et filtrable (par adresse ou par exercice), avec un export CSV / PDF.
 * L'adresse la plus utilisée (le « remplaçant habituel ») est mise en avant, et chaque
 * adresse permet de renvoyer en un clic la dernière pièce qui lui a été transmise.
 *
 * La vue est découpée en trois sous-composants (mini-graphe, sélection, liste) ; cette carte
 * ne conserve que l'état partagé, les effets de synchronisation des préférences et les exports.
 */
export default function RemplacementsCarte({
  remplacements,
  loading,
  error,
  onReload,
  emetteur,
  filtreAdresseInitial,
  filtreTriInitial,
  filtreRecordInitial,
  filtreEpingleInitial,
  filtreMoisInitial,
  filtreFaibleInitial,
  onRenvoyerDerniere,
}: {
  /** Renvois de remplacement déjà effectués, du plus récent au plus ancien. */
  remplacements: ComptableRemplacement[];
  /** Chargement en cours. */
  loading: boolean;
  /** Message d'erreur éventuel. */
  error: string | null;
  /** Recharge la liste des remplacements. */
  onReload: () => void;
  /** Identité de l'émetteur, reprise en tête du PDF de la liste des remplacements. */
  emetteur: {
    entreprise: string;
    metier?: string;
    telephone?: string;
    email?: string;
    siret?: string | null;
    tva?: string | null;
  };
  /** Adresse (clé normalisée) à filtrer à l'ouverture, transmise par le tableau de bord. */
  filtreAdresseInitial?: string;
  /** Tri à appliquer à l'ouverture, transmis par le sélecteur du tableau de bord. */
  filtreTriInitial?: TriKey;
  /** Active à l'ouverture le filtre rapide « Mois record uniquement », transmis par le raccourci du tableau de bord. */
  filtreRecordInitial?: boolean;
  /** Active à l'ouverture le filtre « mois épinglé uniquement », transmis par le jeton « Épinglé » du tableau de bord. */
  filtreEpingleInitial?: boolean;
  /** Mois (« AAAA-MM ») sur lequel filtrer la liste à l'ouverture, transmis par le clic d'un mois épinglé du tableau de bord. */
  filtreMoisInitial?: string;
  /** Ouverture via le raccourci « mois le plus faible » du tableau de bord : surligne brièvement sa barre du mini-graphe. */
  filtreFaibleInitial?: boolean;
  /** Renvoie en un clic la dernière pièce transmise à une adresse (journal ou bilan). */
  onRenvoyerDerniere?: (r: ComptableRemplacement) => Promise<{ ok: boolean; message: string }>;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [filtreAdresse, setFiltreAdresse] = useState("");
  const [filtreExercice, setFiltreExercice] = useState("");
  const [tri, setTri] = useState<TriKey>(lireTriMemorise);
  // Filtre rapide « Mois record uniquement » : ne garder que les pièces du mois le plus actif.
  const [recordUniquement, setRecordUniquement] = useState<boolean>(lireRecordUniquementMemorise);
  // Période du mini-graphe (3 / 6 / 12 mois), mémorisée comme le tri.
  const [chartMois, setChartMois] = useState<ChartMois>(lireChartMoisMemorise);
  // Mois (« AAAA-MM ») sur lequel la liste est filtrée par un clic sur une barre du graphe.
  const [filtreMois, setFiltreMois] = useState("");
  const [renvoyerCle, setRenvoyerCle] = useState<string | null>(null);
  const [renvoyerMsg, setRenvoyerMsg] = useState<{ cle: string; ok: boolean; text: string } | null>(null);
  const [renvoyerTousBusy, setRenvoyerTousBusy] = useState(false);
  const [renvoyerTousMsg, setRenvoyerTousMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Sélection de pièces du mois (cases à cocher) : ne renvoyer que celles cochées.
  const [selectionOuverte, setSelectionOuverte] = useState(false);
  const [selectionMois, setSelectionMois] = useState<Set<number>>(() => new Set());
  // Filtres du panneau de sélection : par nature (journal / bilan) ou par adresse, pour cocher plus vite.
  // Mémorisés comme le tri, pour les retrouver à la prochaine visite.
  const [selFiltreNature, setSelFiltreNature] = useState<"tous" | "journal" | "bilan">(lireSelNatureMemorise);
  const [selFiltreAdresse, setSelFiltreAdresse] = useState(lireSelAdresseMemorise);
  const [renvoyerSelBusy, setRenvoyerSelBusy] = useState(false);
  const [renvoyerSelMsg, setRenvoyerSelMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Barre du mini-graphe survolée (infobulle rappelant les mois « record »).
  const [survolMois, setSurvolMois] = useState<string | null>(null);
  // Mois dont la barre est brièvement mise en évidence à l'arrivée depuis le tableau de bord
  // (clic d'un mois épinglé), pour bien montrer quel mois vient d'être ouvert.
  const [pulseMois, setPulseMois] = useState<string | null>(null);
  // Mois le plus faible dont la barre du mini-graphe est brièvement surlignée (halo secondary) à
  // l'arrivée depuis le raccourci « Ouvrir le mois le plus faible » du tableau de bord.
  const [pulseFaible, setPulseFaible] = useState<string | null>(null);
  // Dernier mois le plus faible consulté (mémorisé), pour le reprendre d'un clic depuis l'en-tête.
  const [dernierMoisFaible, setDernierMoisFaible] = useState<string>(() => lireDernierMoisFaible());
  // Dernier mois ouvert au clavier (Entrée sur une barre du mini-graphe), reproposé en « Reprendre ».
  const [dernierMoisClavier, setDernierMoisClavier] = useState<string>(() => lireDernierMoisClavier());
  // Historique local des « mois ouverts au clavier » (liste, du plus récent au plus ancien),
  // proposé dans un petit menu de l'en-tête pour en reprendre un d'un clic.
  const [historiqueMoisClavier, setHistoriqueMoisClavier] = useState<string[]>(() => lireHistoriqueMoisClavier());
  // Ancrage du petit menu déroulant de l'historique des mois clavier (null = fermé) : il peut
  // s'ouvrir depuis le compteur « N mois au clavier » comme depuis le bouton « Reprendre ».
  // Son état ouvert / fermé est mémorisé, pour le retrouver tel quel à la prochaine visite.
  const [menuClavierOuvert, setMenuClavierOuvert] = useState<MenuClavierAncre | null>(lireMenuClavierOuvert);
  // Historique local des « mois faibles consultés » (liste, du plus récent au plus ancien),
  // proposé dans un petit menu de l'en-tête pour en reprendre un d'un clic.
  const [historiqueMoisFaibles, setHistoriqueMoisFaibles] = useState<string[]>(() => lireHistoriqueMoisFaibles());
  // Petit menu déroulant de l'historique des mois faibles, ouvert ou non (ancrage : compteur ou bouton).
  const [menuFaibleOuvert, setMenuFaibleOuvert] = useState<"compteur" | "bouton" | null>(null);
  // Mois en cours de glisser-déposer dans la pastille « Épinglé » (réordonnancement de priorité).
  const [dragMois, setDragMois] = useState<string | null>(null);
  // Mois épinglés « à surveiller » : repères visuels permanents sur leurs barres (préférence
  // locale), comme la semaine épinglée du mini-graphe de tendance de « Santé du compte ».
  // Plusieurs mois peuvent être épinglés et mis en évidence ensemble.
  const [moisEpingles, setMoisEpingles] = useState<string[]>(() => lireMoisEpingles());
  // Filtre « mois sous le seuil » : n'éclairer que les mois à faible activité (renvois < seuil).
  const [filtreSousSeuil, setFiltreSousSeuil] = useState<boolean>(() => lireRempFiltreSousSeuil());
  // Filtre « mois épinglé uniquement » : ne garder que les pièces des mois mis à surveiller.
  const [filtreEpingle, setFiltreEpingle] = useState<boolean>(() => lireRempFiltreEpingle());
  // Seuil de renvois par mois : sous ce seuil, un mois est considéré « sous le seuil ».
  const [seuilRemp, setSeuilRemp] = useState<number>(() => lireSeuilRemp());
  // État replié / déplié de la pastille « Épinglé » : préférence partagée avec le tableau de bord,
  // pour présenter les mois surveillés de la même façon dans les deux vues.
  const [epinglesReplie, setEpinglesReplie] = useState<boolean>(() => lireEpinglesReplie());
  // Mode de rangement des mois épinglés (priorité manuelle ou chronologique), préférence partagée
  // avec le tableau de bord, choisie via le bouton « Trier d'un clic ».
  const [triEpingles, setTriEpingles] = useState<TriEpinglesMode>(() => lireTriEpingles());
  // Petit message de retour (copie du rangement depuis un menu de reprise, etc.).
  const [copieMsg, setCopieMsg] = useState<string | null>(null);
  // Infobulle de survol des puces de mois épinglés : affiche le détail journaux / bilans (comme
  // la bulle du tableau de bord), placée hors du conteneur arrondi pour ne pas être rognée.
  const [survolPucesEpingles, setSurvolPucesEpingles] = useState(false);
  const survolPucesEpinglesTimer = useRef<number | null>(null);
  const ouvrirSurvolPucesEpingles = () => {
    if (survolPucesEpinglesTimer.current) window.clearTimeout(survolPucesEpinglesTimer.current);
    setSurvolPucesEpingles(true);
  };
  const fermerSurvolPucesEpingles = () => {
    if (survolPucesEpinglesTimer.current) window.clearTimeout(survolPucesEpinglesTimer.current);
    survolPucesEpinglesTimer.current = window.setTimeout(() => setSurvolPucesEpingles(false), 140);
  };

  // Mois épinglés dans l'ordre affiché sur la pastille « Épinglé » de l'en-tête : soit l'ordre de
  // priorité manuel mémorisé (les premiers mois sont les plus prioritaires), soit l'ordre
  // chronologique des mois selon le mode de rangement choisi (« Trier d'un clic »).
  const moisEpinglesTries = useMemo(() => trierMoisEpingles(moisEpingles), [moisEpingles, triEpingles]);

  // Ancre vers la liste filtrée : cliquer une barre du mini-graphe (en particulier une barre en
  // dégradé secondary = mois à faible activité) amène directement sur la comptabilité filtrée.
  const listeRef = useRef<HTMLDivElement | null>(null);

  // Applique le tri et le mémorise pour le retrouver à la prochaine visite.
  const handleTri = (key: TriKey) => {
    setTri(key);
    try {
      localStorage.setItem(TRI_STORAGE_KEY, key);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Bascule le filtre rapide « Mois record uniquement » et le mémorise.
  const handleRecordUniquement = () => {
    setRecordUniquement((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(RECORD_STORAGE_KEY, "true");
        else localStorage.removeItem(RECORD_STORAGE_KEY);
      } catch {
        /* préférence de confort : ignorée si le stockage est indisponible */
      }
      return next;
    });
  };

  // Applique la période du mini-graphe et la mémorise pour le retrouver à la prochaine visite.
  const handleChartMois = (n: ChartMois) => {
    setChartMois(n);
    try {
      localStorage.setItem(CHART_MOIS_STORAGE_KEY, String(n));
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Épingle un mois « à surveiller » (ou le détache) : pose un repère permanent sur sa barre.
  // Plusieurs mois peuvent être épinglés simultanément.
  const basculerEpinglageMois = (cle: string) => {
    setMoisEpingles(basculerMoisEpingle(cle));
  };

  // Détache d'un coup tous les mois épinglés « à surveiller » du mini-graphe.
  const handleToutDetacher = () => {
    viderMoisEpingles();
    setMoisEpingles([]);
  };

  // Déplace un mois épinglé dans l'ordre de priorité de la surveillance (flèches haut / bas de la
  // bulle des puces « Épinglé »). L'ordre est partagé avec le tableau de bord.
  const handleDeplacerMois = (cle: string, direction: -1 | 1) => {
    setMoisEpingles(deplacerMoisEpingle(cle, direction));
  };

  // Remonte un mois épinglé directement en tête de la surveillance d'un seul clic (flèche « monter en
  // tête » des puces de la pastille et des barres du mini-graphe). L'ordre est partagé avec le tableau de bord.
  const handleMonterMoisEnTete = (cle: string) => {
    setMoisEpingles(monterMoisEnTete(cle));
  };

  // Réinitialise la priorité de surveillance : restaure l'ordre d'épinglage d'origine des mois
  // surveillés (du plus récemment épinglé au plus ancien), en effaçant les réordonnancements manuels.
  const handleReinitialiserPriorite = () => {
    setMoisEpingles(reinitialiserPrioriteEpingles());
  };

  // Copie en presse-papiers le mode de rangement + la liste priorisée des mois épinglés : le même
  // contenu que le bandeau « Copier le rangement », accessible directement depuis les menus de
  // reprise (mois clavier / mois faibles).
  const handleCopierRangement = async () => {
    const ok = await copierTextePressePapiers(texteRangementEpingles(moisEpinglesTries, triEpingles));
    setCopieMsg(ok ? "Rangement copié dans le presse-papiers" : "Copie indisponible dans ce navigateur");
  };

  // Réordonne les mois épinglés par glisser-déposer d'une puce sur une autre (la puce déposée prend
  // la place de la puce cible), pour prioriser la surveillance d'un geste.
  const handleDropMois = (cle: string) => {
    if (!dragMois || dragMois === cle) {
      setDragMois(null);
      return;
    }
    const ordre = [...moisEpingles];
    const from = ordre.indexOf(dragMois);
    const to = ordre.indexOf(cle);
    if (from < 0 || to < 0) {
      setDragMois(null);
      return;
    }
    ordre.splice(from, 1);
    ordre.splice(to, 0, dragMois);
    setMoisEpingles(reordonnerMoisEpingles(ordre));
    setDragMois(null);
  };

  // Replie ou déplie la pastille « Épinglé » de l'en-tête (préférence partagée avec le tableau de
  // bord, mémorisée, pour présenter les mois surveillés de la même façon dans les deux vues).
  const basculerEpinglesReplie = () => {
    setEpinglesReplie((prev) => {
      const next = !prev;
      ecrireEpinglesReplie(next);
      return next;
    });
  };

  // Bascule d'un clic le rangement des mois épinglés : priorité manuelle ↔ ordre chronologique des
  // mois. La préférence est partagée avec le tableau de bord (même affichage dans les deux vues).
  const basculerTriEpinglesMois = () => {
    setTriEpingles(basculerTriEpingles());
  };

  // Ouvre / ferme le menu de l'historique des mois clavier (depuis le compteur ou le bouton
  // « Reprendre ») et mémorise son état, pour le retrouver tel quel à la prochaine visite.
  const basculerMenuClavier = (ancre: MenuClavierAncre) => {
    setMenuClavierOuvert((prev) => {
      const next = prev === ancre ? null : ancre;
      ecrireMenuClavierOuvert(next);
      return next;
    });
  };

  // Ferme le menu de l'historique des mois clavier (et oublie l'état mémorisé).
  const fermerMenuClavier = () => {
    setMenuClavierOuvert(null);
    ecrireMenuClavierOuvert(null);
  };

  // Ouvre / ferme le menu de l'historique des mois faibles consultés, depuis le compteur
  // « N mois faibles consultés » ou depuis le bouton « Reprendre un mois faible ».
  const basculerMenuFaible = (ancre: "compteur" | "bouton") => {
    setMenuFaibleOuvert((prev) => (prev === ancre ? null : ancre));
  };

  // Ouvre la comptabilité filtrée sur un mois épinglé (clic d'une puce de la pastille « Épinglé »),
  // avec un surlignage brièvement de sa barre du mini-graphe.
  const handleOuvrirMoisEpingle = (cle: string) => {
    setFiltreMois(cle);
    setPulseMois(cle);
    window.setTimeout(() => setPulseMois(null), 2400);
    window.setTimeout(() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
  };

  // Ouvre la comptabilité filtrée sur un mois en cliquant sa barre du mini-graphe : applique le
  // filtre de mois et fait défiler jusqu'à la liste filtrée. Sert surtout aux barres en dégradé
  // secondary (mois à faible activité), pour sauter directement sur les pièces du mois faible.
  const handleBarClick = (cle: string) => {
    const activer = filtreMois !== cle;
    setFiltreMois(activer ? cle : "");
    if (activer) {
      window.setTimeout(() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
    }
  };

  // Épingle d'un clic tous les mois sous le seuil (faible activité) affichés sur le mini-graphe,
  // en les cumulant avec les mois déjà surveillés (repères permanents sur leurs barres).
  const handleEpinglerSousSeuil = () => {
    const cles = chartMoisData.filter((m) => m.total > 0 && m.total < seuilRemp).map((m) => m.cle);
    if (cles.length === 0) return;
    setMoisEpingles(ajouterMoisEpingles(cles));
  };

  // Épingle d'un clic le(s) mois « record » de la période affichée (le pic d'activité), en les
  // cumulant avec les mois déjà surveillés. Calqué sur « Épingler sous le seuil ».
  const handleEpinglerRecord = () => {
    const cles = recordMois.cles;
    if (cles.length === 0) return;
    setMoisEpingles(ajouterMoisEpingles(cles));
  };

  // Épingle d'un clic le mois le plus faible de la période (le creux d'activité), pour le
  // surveiller d'un seul geste — à côté du raccourci « Épingler le mois record ».
  const handleEpinglerFaible = () => {
    if (!moisPlusFaible) return;
    setMoisEpingles(ajouterMoisEpingles([moisPlusFaible.cle]));
  };

  // Ouvre la comptabilité filtrée sur le mois le plus faible de la période (le creux
  // d'activité) : applique le filtre de mois et fait défiler jusqu'à la liste filtrée.
  const handleOuvrirPlusFaible = () => {
    if (!moisPlusFaible) return;
    ecrireDernierMoisFaible(moisPlusFaible.cle);
    setDernierMoisFaible(moisPlusFaible.cle);
    setFiltreMois(moisPlusFaible.cle);
    setPulseFaible(moisPlusFaible.cle);
    window.setTimeout(() => setPulseFaible(null), 2400);
    window.setTimeout(() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
  };

  // Reprend un mois faible consulté (mémorisé) : réapplique le filtre de mois et surligne
  // brièvement sa barre du mini-graphe, d'un clic depuis l'historique de l'en-tête.
  const handleReprendreFaible = (cle: string) => {
    if (!cle) return;
    ajouterMoisFaibleHistorique(cle);
    setDernierMoisFaible(cle);
    setFiltreMois(cle);
    setPulseFaible(cle);
    setMenuFaibleOuvert(null);
    window.setTimeout(() => setPulseFaible(null), 2400);
    window.setTimeout(() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
  };

  // Reprend le dernier mois le plus faible consulté (tête de l'historique).
  const handleReprendreDernierFaible = () => handleReprendreFaible(dernierMoisFaible);

  // Mémorise un mois ouvert au clavier (Entrée sur une barre du mini-graphe) et surligne brièvement
  // sa barre, pour pouvoir le reprendre d'un clic depuis l'en-tête.
  const handleConsultClavier = (cle: string) => {
    if (!cle) return;
    ecrireDernierMoisClavier(cle);
    setDernierMoisClavier(cle);
    setPulseMois(cle);
    window.setTimeout(() => setPulseMois(null), 2400);
  };

  // Reprend le dernier mois ouvert au clavier : réapplique le filtre de mois et surligne sa barre.
  const handleReprendreClavier = () => handleReprendreClavierMois(dernierMoisClavier);

  // Reprend un mois précis ouvert au clavier (choisi dans le menu de l'historique) : réapplique le
  // filtre de mois, fait défiler jusqu'à la liste filtrée et surligne brièvement sa barre du graphe.
  const handleReprendreClavierMois = (cle: string) => {
    if (!cle) return;
    ecrireDernierMoisClavier(cle);
    setDernierMoisClavier(cle);
    setFiltreMois(cle);
    setPulseMois(cle);
    fermerMenuClavier();
    window.setTimeout(() => setPulseMois(null), 2400);
    window.setTimeout(() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
  };

  // Active ou désactive le filtre « mois sous le seuil » et le mémorise.
  const basculerFiltreSousSeuil = () => {
    const suivant = !filtreSousSeuil;
    setFiltreSousSeuil(suivant);
    ecrireRempFiltreSousSeuil(suivant);
  };

  // Active ou désactive le filtre « mois épinglé uniquement » et le mémorise.
  const basculerFiltreEpingle = () => {
    const suivant = !filtreEpingle;
    setFiltreEpingle(suivant);
    ecrireRempFiltreEpingle(suivant);
  };

  // Change le seuil de renvois par mois et le mémorise.
  const changerSeuilRemp = (value: number) => {
    setSeuilRemp(value);
    ecrireSeuilRemp(value);
  };

  // Applique le filtre nature du panneau de sélection et le mémorise comme le tri.
  const handleSelNature = (key: "tous" | "journal" | "bilan") => {
    setSelFiltreNature(key);
    try {
      localStorage.setItem(SEL_NATURE_STORAGE_KEY, key);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Applique le filtre adresse du panneau de sélection et le mémorise comme le tri.
  const handleSelAdresse = (value: string) => {
    setSelFiltreAdresse(value);
    try {
      if (value) localStorage.setItem(SEL_ADRESSE_STORAGE_KEY, value);
      else localStorage.removeItem(SEL_ADRESSE_STORAGE_KEY);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Remet à zéro les filtres du panneau de sélection (et oublie la préférence mémorisée).
  const handleEffacerSelFiltres = () => {
    setSelFiltreNature("tous");
    setSelFiltreAdresse("");
    try {
      localStorage.removeItem(SEL_NATURE_STORAGE_KEY);
      localStorage.removeItem(SEL_ADRESSE_STORAGE_KEY);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Récap du mois en cours : nombre de pièces renvoyées, séparées journal / bilan.
  const recapMois = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let journal = 0;
    let bilan = 0;
    remplacements.forEach((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== y || d.getMonth() !== m) return;
      if (r.type === "bilan") bilan += 1;
      else if (r.type === "journal") journal += 1;
    });
    return {
      journal,
      bilan,
      total: journal + bilan,
      moisLabel: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    };
  }, [remplacements]);

  // Renvois du mois en cours (adresse ponctuelle), ciblés par le bouton de renvoi groupé.
  const remplacementsDuMois = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return remplacements.filter((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return false;
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [remplacements]);

  // Pièces du mois en cours sélectionnées par leur case à cocher (renvoi ciblé).
  const remplacementsMoisSelectionnes = useMemo(
    () => remplacementsDuMois.filter((r) => selectionMois.has(r.id)),
    [remplacementsDuMois, selectionMois],
  );

  // Mini-graphe : nombre de renvois par mois sur la période choisie (3 / 6 / 12 mois, journal vs bilan).
  const chartMoisData = useMemo(() => {
    const now = new Date();
    const months: { cle: string; label: string; court: string; journal: number; bilan: number; total: number }[] = [];
    for (let i = chartMois - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        cle,
        label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        court: d.toLocaleDateString("fr-FR", { month: "short" }),
        journal: 0,
        bilan: 0,
        total: 0,
      });
    }
    const byCle = new Map(months.map((m) => [m.cle, m]));
    remplacements.forEach((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return;
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byCle.get(cle);
      if (!bucket) return;
      if (r.type === "bilan") bucket.bilan += 1;
      else if (r.type === "journal") bucket.journal += 1;
      bucket.total += 1;
    });
    return months;
  }, [remplacements, chartMois]);

  const maxChart = useMemo(() => Math.max(...chartMoisData.map((m) => m.total), 1), [chartMoisData]);
  const chartTotal = useMemo(() => chartMoisData.reduce((s, m) => s + m.total, 0), [chartMoisData]);

  // Nombre de mois de la fenêtre « sous le seuil » (activité faible) : rappelé près du seuil réglé.
  const nbSousSeuil = useMemo(
    () => chartMoisData.filter((m) => m.total > 0 && m.total < seuilRemp).length,
    [chartMoisData, seuilRemp],
  );

  // Mois de la fenêtre jugés « sous le seuil » (faible activité) : la liste des remplacements peut
  // ainsi se restreindre aux mêmes mois que ceux éclairés sur le mini-graphe.
  const moisSousSeuilCles = useMemo(
    () => new Set(chartMoisData.filter((m) => m.total > 0 && m.total < seuilRemp).map((m) => m.cle)),
    [chartMoisData, seuilRemp],
  );

  // Données du mini-graphe limitées aux mois des pièces cochées, pour intégrer au PDF de la
  // sélection une image du graphe filtrée sur ces seuls mois.
  const chartDataSelection = useMemo(() => {
    const cles = new Set(
      remplacementsMoisSelectionnes.map((r) => moisCleDeDate(r.envoye_le)).filter((c) => c.length > 0),
    );
    return chartMoisData.filter((m) => cles.has(m.cle));
  }, [remplacementsMoisSelectionnes, chartMoisData]);

  // Mois « record » de la période : total le plus élevé de renvois (toutes natures confondues),
  // rappelé au survol des barres du mini-graphe.
  const recordMois = useMemo(() => {
    let max = 0;
    chartMoisData.forEach((m) => {
      if (m.total > max) max = m.total;
    });
    const cles = max > 0 ? chartMoisData.filter((m) => m.total === max).map((m) => m.cle) : [];
    return { max, cles };
  }, [chartMoisData]);

  const recordMoisLabel = useMemo(() => recordMois.cles.map((c) => moisCleLabel(c)).join(", "), [recordMois]);

  // Mois le plus faible de la période : le mois actif ayant le moins de renvois (le creux
  // d'activité), pour l'ouvrir d'un clic dans la liste filtrée.
  const moisPlusFaible = useMemo(() => {
    const actifs = chartMoisData.filter((m) => m.total > 0);
    if (actifs.length === 0) return null;
    return actifs.reduce((min, m) => (m.total < min.total ? m : min), actifs[0]);
  }, [chartMoisData]);

  // Mois « record » sur tout l'historique (le mois qui a cumulé le plus de renvois, toutes
  // périodes confondues). Alimente la pastille du bandeau « Ce mois » et le tri « Mois record ».
  const recordGlobal = useMemo(() => {
    const map = new Map<string, number>();
    remplacements.forEach((r) => {
      const cle = moisCleDeDate(r.envoye_le);
      if (!cle) return;
      map.set(cle, (map.get(cle) ?? 0) + 1);
    });
    let max = 0;
    map.forEach((n) => {
      if (n > max) max = n;
    });
    const cles = max > 0 ? Array.from(map.entries()).filter(([, n]) => n === max).map(([c]) => c) : [];
    return { max, cles };
  }, [remplacements]);

  const recordGlobalLabel = useMemo(
    () => recordGlobal.cles.map((c) => moisCleLabel(c)).join(", "),
    [recordGlobal],
  );

  // Adresses présentes dans les pièces du mois (filtre du panneau de sélection).
  const adressesMoisDispo = useMemo(() => {
    const map = new Map<string, string>();
    remplacementsDuMois.forEach((r) => {
      const cle = cleAdresse(r.adresse);
      if (!cle || map.has(cle)) return;
      map.set(cle, r.nom ? `${r.nom} · ${r.adresse}` : r.adresse);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [remplacementsDuMois]);

  // Pièces du mois affichées dans le panneau de sélection, selon le filtre nature / adresse.
  const piecesMoisFiltrees = useMemo(
    () =>
      remplacementsDuMois.filter((r) => {
        if (selFiltreNature === "journal" && r.type !== "journal") return false;
        if (selFiltreNature === "bilan" && r.type !== "bilan") return false;
        if (selFiltreAdresse && cleAdresse(r.adresse) !== selFiltreAdresse) return false;
        return true;
      }),
    [remplacementsDuMois, selFiltreNature, selFiltreAdresse],
  );

  // Toutes les pièces affichées (filtrées) sont déjà cochées ?
  const toutesPiecesFiltreesCochees =
    piecesMoisFiltrees.length > 0 && piecesMoisFiltrees.every((p) => selectionMois.has(p.id));

  // Adresses ponctuelles distinctes proposées dans le filtre (libellé si connu).
  const adressesDispo = useMemo(() => {
    const map = new Map<string, string>();
    remplacements.forEach((r) => {
      const cle = cleAdresse(r.adresse);
      if (!cle || map.has(cle)) return;
      map.set(cle, r.nom ? `${r.nom} · ${r.adresse}` : r.adresse);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [remplacements]);

  // Exercices distincts proposés dans le filtre, du plus récent au plus ancien.
  const exercicesDispo = useMemo(() => {
    const map = new Map<string, string>();
    remplacements.forEach((r) => {
      const cle = r.exercice ?? "";
      if (!cle || map.has(cle)) return;
      map.set(cle, exerciceLabel(r.exercice, r.type));
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [remplacements]);

  // Liste filtrée (le filtre s'applique à l'affichage, au CSV et au PDF).
  const remplacementsFiltres = useMemo(
    () =>
      remplacements.filter((r) => {
        if (recordUniquement && !recordGlobal.cles.includes(moisCleDeDate(r.envoye_le))) return false;
        if (filtreEpingle && !moisEpingles.includes(moisCleDeDate(r.envoye_le))) return false;
        // Filtre « sous le seuil » reporté dans la liste : ne garder que les pièces des mois à
        // faible activité (mêmes mois que ceux éclairés sur le mini-graphe).
        if (filtreSousSeuil && !moisSousSeuilCles.has(moisCleDeDate(r.envoye_le))) return false;
        if (filtreAdresse && cleAdresse(r.adresse) !== filtreAdresse) return false;
        if (filtreExercice && (r.exercice ?? "") !== filtreExercice) return false;
        if (filtreMois && moisCleDeDate(r.envoye_le) !== filtreMois) return false;
        return true;
      }),
    [
      remplacements,
      filtreAdresse,
      filtreExercice,
      filtreMois,
      recordUniquement,
      recordGlobal,
      filtreEpingle,
      moisEpingles,
      filtreSousSeuil,
      moisSousSeuilCles,
    ],
  );

  const filtreActif = Boolean(
    filtreAdresse || filtreExercice || filtreMois || recordUniquement || filtreEpingle || filtreSousSeuil,
  );

  const nbAdresses = useMemo(
    () => new Set(remplacementsFiltres.map((r) => cleAdresse(r.adresse))).size,
    [remplacementsFiltres],
  );

  // Libellé du périmètre (repris sous le titre du PDF et dans le nom du fichier).
  const filtreLabel = useMemo(() => {
    const parts: string[] = [];
    if (filtreAdresse) {
      const a = adressesDispo.find((x) => x.value === filtreAdresse);
      parts.push(`Adresse : ${a?.label ?? filtreAdresse}`);
    }
    if (filtreExercice) {
      const e = exercicesDispo.find((x) => x.value === filtreExercice);
      parts.push(`Exercice : ${e?.label ?? filtreExercice}`);
    }
    if (filtreMois) {
      parts.push(`Mois : ${moisCleLabel(filtreMois)}`);
    }
    if (recordUniquement) {
      parts.push(recordGlobalLabel ? `Mois record : ${recordGlobalLabel}` : "Mois record");
    }
    if (filtreEpingle) {
      const labels = moisEpingles.map((c) => moisCleLabel(c));
      parts.push(labels.length ? `Mois épinglé : ${labels.join(", ")}` : "Mois épinglé");
    }
    if (filtreSousSeuil) {
      parts.push(`Mois sous le seuil (< ${seuilRemp})`);
    }
    return parts.length ? parts.join(" · ") : "Tous les remplacements";
  }, [
    filtreAdresse,
    filtreExercice,
    filtreMois,
    recordUniquement,
    filtreEpingle,
    moisEpingles,
    filtreSousSeuil,
    seuilRemp,
    recordGlobalLabel,
    adressesDispo,
    exercicesDispo,
  ]);

  // Regroupement par adresse ponctuelle (les items de chaque groupe restent du plus récent au plus ancien).
  const groupes = useMemo(() => {
    const map = new Map<string, { adresse: string; nom: string | null; items: ComptableRemplacement[] }>();
    remplacementsFiltres.forEach((r) => {
      const cle = cleAdresse(r.adresse);
      const g = map.get(cle) ?? { adresse: r.adresse, nom: r.nom, items: [] };
      if (!g.nom && r.nom) g.nom = r.nom;
      g.items.push(r);
      map.set(cle, g);
    });
    return Array.from(map.entries()).map(([cle, g]) => ({ cle, ...g }));
  }, [remplacementsFiltres]);

  // Adresse la plus utilisée (le « remplaçant habituel ») : on la met en avant si elle a
  // réellement servi plusieurs fois, pour distinguer un usage récurrent d'un renvoi isolé.
  const clePlusUtilisee = useMemo(() => {
    let best: { cle: string; count: number } | null = null;
    groupes.forEach((g) => {
      if (!best || g.items.length > best.count) best = { cle: g.cle, count: g.items.length };
    });
    return best && best.count >= 2 ? best.cle : null;
  }, [groupes]);

  // Application du tri choisi sur les groupes d'adresses.
  const groupesTries = useMemo<GroupeRemplacement[]>(() => {
    // Tri « Mois record d'abord » : les pièces du mois le plus actif remontent en tête
    // (les adresses concernées en premier, puis au sein de chaque adresse).
    if (tri === "record") {
      const isRecord = (r: ComptableRemplacement) => recordGlobal.cles.includes(moisCleDeDate(r.envoye_le));
      return [...groupes]
        .map((g) => ({
          ...g,
          items: [...g.items].sort((a, b) => {
            const ra = isRecord(a) ? 1 : 0;
            const rb = isRecord(b) ? 1 : 0;
            if (rb !== ra) return rb - ra;
            return new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime();
          }),
        }))
        .sort((a, b) => {
          const ra = a.items.filter(isRecord).length;
          const rb = b.items.filter(isRecord).length;
          if (rb !== ra) return rb - ra;
          return (
            new Date(b.items[0]?.envoye_le ?? 0).getTime() - new Date(a.items[0]?.envoye_le ?? 0).getTime()
          );
        });
    }
    const list = [...groupes];
    if (tri === "renvois") {
      list.sort((a, b) => b.items.length - a.items.length);
    } else if (tri === "adresse") {
      list.sort((a, b) =>
        `${a.nom ?? ""} ${a.adresse}`.toLowerCase().localeCompare(`${b.nom ?? ""} ${b.adresse}`.toLowerCase(), "fr"),
      );
    } else {
      list.sort(
        (a, b) => new Date(b.items[0]?.envoye_le ?? 0).getTime() - new Date(a.items[0]?.envoye_le ?? 0).getTime(),
      );
    }
    return list;
  }, [groupes, tri, recordGlobal]);

  // Détail des renvois par mois (« AAAA-MM ») : journaux / bilans séparés, pour le mini-récap
  // des mois épinglés intégré au PDF de la liste des remplacements.
  const renvoisDetailParMois = useMemo(() => {
    const map = new Map<string, { journal: number; bilan: number; total: number }>();
    remplacements.forEach((r) => {
      const cle = moisCleDeDate(r.envoye_le);
      if (!cle) return;
      const cur = map.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      if (r.type === "bilan") cur.bilan += 1;
      else if (r.type === "journal") cur.journal += 1;
      cur.total += 1;
      map.set(cle, cur);
    });
    return map;
  }, [remplacements]);

  // Efface d'un coup tous les filtres actifs de la liste.
  const handleEffacerFiltres = () => {
    setFiltreAdresse("");
    setFiltreExercice("");
    setFiltreMois("");
    setRecordUniquement(false);
    setFiltreEpingle(false);
    ecrireRempFiltreEpingle(false);
    setFiltreSousSeuil(false);
    ecrireRempFiltreSousSeuil(false);
    try {
      localStorage.removeItem(RECORD_STORAGE_KEY);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Export CSV de la liste des remplacements (adresse, libellé, date, nature, exercice).
  const handleExportCsv = () => {
    const headers = ["Adresse", "Libellé", "Date", "Nature", "Exercice concerné"];
    const rows = remplacementsFiltres.map((r) => [
      r.adresse,
      r.nom ?? "",
      dateHeureLabel(r.envoye_le),
      natureLabel(r.type),
      exerciceLabel(r.exercice, r.type),
    ]);
    downloadCsv(`remplacements-comptables-${todayISO()}.csv`, toCsv(headers, rows));
  };

  // Export PDF de la liste des remplacements (mêmes colonnes que le CSV), pour l'archivage
  // de la traçabilité des renvois de remplacement hors application.
  const handleExportPdf = () => {
    try {
      const doc = buildRemplacementsPdf({
        emetteur,
        filtreLabel,
        // Mention « Mois épinglé » en tête du document quand le filtre « mois épinglé uniquement » est actif.
        mentionEpingle:
          filtreEpingle && moisEpingles.length > 0
            ? `Mois épinglé : ${moisEpingles.map((c) => moisCleLabel(c)).join(", ")}`
            : undefined,
        recapMois: recapMois.total > 0 ? recapMois : undefined,
        // Mini-récap des mois épinglés « à surveiller » (journaux / bilans par mois), repris dans
        // le tableau du document pour retrouver la répartition de ces mois surveillés.
        // Mois épinglés dans l'ordre de priorité mémorisé, avec un petit numéro de priorité (1 = le
        // plus prioritaire) affiché devant chaque mois dans le document.
        recapEpingles:
          moisEpingles.length > 0
            ? moisEpinglesTries.map((cle, idx) => {
                const d = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
                return {
                  mois: moisCleLabel(cle),
                  priorite: idx + 1,
                  prioriteTotal: moisEpinglesTries.length,
                  journal: d.journal,
                  bilan: d.bilan,
                  total: d.total,
                };
              })
            : undefined,
        // Petit libellé d'en-tête rappelant le mode de rangement utilisé, pour tracer le rangement
        // des mois épinglés dans l'archive PDF (mode « priorité » ou « chrono »).
        triEpinglesLabel: moisEpingles.length > 0 ? libelleTriEpingles(triEpingles) : undefined,
        // Image du mini-graphe des renvois par mois (période choisie), intégrée directement au PDF
        // en plus des exports CSV / PNG séparés.
        chartImage: chartTotal > 0 ? getRemplacementsChartDataUrl(chartMoisData, { epinglesTries: moisEpinglesTries }) : null,
        chartPeriodeLabel: `${chartMois} derniers mois`,
        remplacements: remplacementsFiltres.map((r) => ({
          adresse: r.adresse,
          nom: r.nom ?? "—",
          date: dateHeureLabel(r.envoye_le),
          nature: natureLabel(r.type),
          exercice: exerciceLabel(r.exercice, r.type),
        })),
      });
      savePdf(
        doc,
        moisPlusFaible
          ? `remplacements-comptables-mois-faible-${moisPlusFaible.cle}-${todayISO()}.pdf`
          : `remplacements-comptables-${todayISO()}.pdf`,
      );
    } catch {
      /* l'échec de l'export PDF est silencieux : la liste reste consultable à l'écran */
    }
  };

  // Export CSV du mini-graphe (période choisie) : un mois par ligne + ligne de total,
  // à archiver avec le PDF des remplacements. La colonne « Rang » (N/total) marque les mois
  // épinglés selon le rangement en cours, pour aligner le graphe sur le CSV du tableau de bord.
  const handleExportChartCsv = () => {
    const headers = ["Mois", "Journaux", "Bilans", "Total", "Épinglé", "Rang", "Mois le plus faible"];
    const rows: (string | number)[][] = chartMoisData.map((m) => {
      const idxRang = moisEpinglesTries.indexOf(m.cle);
      return [
        moisCleLabel(m.cle),
        m.journal,
        m.bilan,
        m.total,
        moisEpingles.includes(m.cle) ? "Oui" : "",
        // Rang « N/total » du mois épinglé selon le rangement en cours (vide si non épinglé),
        // exactement comme la colonne « Rang » de l'export du tableau de bord.
        idxRang >= 0 ? `${idxRang + 1}/${moisEpinglesTries.length}` : "",
        // Colonne « Mois le plus faible » : seul le creux d'activité de la période passe à « Oui ».
        moisPlusFaible && m.cle === moisPlusFaible.cle ? "Oui" : "Non",
      ];
    });
    const totalJournal = chartMoisData.reduce((s, m) => s + m.journal, 0);
    const totalBilan = chartMoisData.reduce((s, m) => s + m.bilan, 0);
    rows.push(["Total", totalJournal, totalBilan, chartTotal, "", "", ""]);
    downloadCsv(`remplacements-renvois-par-mois-${todayISO()}.csv`, toCsv(headers, rows));
  };

  // Export PNG du mini-graphe (période choisie), à archiver avec le PDF des remplacements.
  const handleExportChartPng = () => {
    exportRemplacementsChartImage(chartMoisData, { epinglesTries: moisEpinglesTries });
  };

  // Export PNG dédié du mini-graphe, avec la barre du mois le plus faible mise en évidence
  // (dégradé secondary + anneau) et son nom rappelé sous le graphe, pour l'archiver d'un coup d'œil.
  const handleExportChartPngFaible = () => {
    if (!moisPlusFaible) return;
    exportRemplacementsChartImage(chartMoisData, {
      highlightCle: moisPlusFaible.cle,
      highlightLabel: `Mois le plus faible : ${moisCleLabel(moisPlusFaible.cle)} · ${moisPlusFaible.total} renvoi${moisPlusFaible.total > 1 ? "s" : ""}`,
      epinglesTries: moisEpinglesTries,
    });
  };

  // Export PNG « historique » : empile les trois derniers mois faibles consultés (du plus récent
  // au plus ancien) dans une seule image, à archiver avec le reste des exports.
  const handleExportHistoriquePng = () => {
    const derniers = historiqueMoisFaibles.slice(0, 3);
    if (derniers.length === 0) return;
    const entries = derniers.map((cle) => {
      const d = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      return { cle, label: moisCleLabel(cle), journal: d.journal, bilan: d.bilan, total: d.total };
    });
    exportRemplacementsHistoriqueImage(entries);
  };

  // Export CSV de l'historique des mois ouverts au clavier (mois, journaux, bilans, total),
  // à archiver avec le reste des exports de la vue : chaque mois mémorisé se retrouve avec le
  // détail de ses renvois (journaux / bilans), du plus récent au plus ancien, plus une ligne de total.
  const handleExportHistoriqueClavierCsv = () => {
    if (historiqueMoisClavier.length === 0) return;
    const headers = ["Mois", "Journaux", "Bilans", "Total"];
    let totalJournal = 0;
    let totalBilan = 0;
    let totalGeneral = 0;
    const rows: (string | number)[][] = historiqueMoisClavier.map((cle) => {
      const d = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      totalJournal += d.journal;
      totalBilan += d.bilan;
      totalGeneral += d.total;
      return [moisCleLabel(cle), d.journal, d.bilan, d.total];
    });
    rows.push(["Total", totalJournal, totalBilan, totalGeneral]);
    downloadCsv(`mois-ouverts-clavier-${todayISO()}.csv`, toCsv(headers, rows));
  };

  // Export CSV de l'historique des mois faibles consultés (mois, journaux, bilans, total),
  // symétrique de celui des mois ouverts au clavier : chaque mois mémorisé avec le détail de ses
  // renvois (journaux / bilans), suivi d'une ligne de total.
  const handleExportHistoriqueFaibleCsv = () => {
    if (historiqueMoisFaibles.length === 0) return;
    const headers = ["Mois", "Journaux", "Bilans", "Total"];
    let totalJournal = 0;
    let totalBilan = 0;
    let totalGeneral = 0;
    const rows: (string | number)[][] = historiqueMoisFaibles.map((cle) => {
      const d = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      totalJournal += d.journal;
      totalBilan += d.bilan;
      totalGeneral += d.total;
      return [moisCleLabel(cle), d.journal, d.bilan, d.total];
    });
    rows.push(["Total", totalJournal, totalBilan, totalGeneral]);
    downloadCsv(`mois-faibles-consultes-${todayISO()}.csv`, toCsv(headers, rows));
  };

  // Export PDF des seules pièces cochées dans la sélection du mois (liste ciblée, à archiver
  // avec le PDF complet des remplacements ou à transmettre seule).
  const handleExportSelectionPdf = () => {
    if (remplacementsMoisSelectionnes.length === 0) return;
    try {
      // Mois réellement représentés par les pièces cochées, pour titrer le mini-graphe.
      const moisSel = Array.from(
        new Set(
          remplacementsMoisSelectionnes
            .map((r) => moisCleLabel(moisCleDeDate(r.envoye_le)))
            .filter((l) => Boolean(l)),
        ),
      );
      // Clés de mois des pièces cochées : si elles portent toutes sur des mois épinglés, on ajoute
      // la mention « Mois épinglé » en tête du document (comme le PDF complet filtré).
      const moisSelCles = Array.from(
        new Set(
          remplacementsMoisSelectionnes
            .map((r) => moisCleDeDate(r.envoye_le))
            .filter((c) => c.length > 0),
        ),
      );
      const selectionToutEpinglee =
        moisSelCles.length > 0 && moisSelCles.every((c) => moisEpingles.includes(c));
      const doc = buildRemplacementsPdf({
        emetteur,
        filtreLabel: `Sélection · ${recapMois.moisLabel} · ${remplacementsMoisSelectionnes.length} pièce${remplacementsMoisSelectionnes.length > 1 ? "s" : ""}`,
        // Mention « Mois épinglé » : uniquement quand la sélection ne concerne que des mois surveillés.
        mentionEpingle: selectionToutEpinglee ? `Mois épinglé : ${moisSel.join(", ")}` : undefined,
        // Mini-graphe filtré sur les seuls mois des pièces cochées (en plus de la liste).
        chartImage:
          chartDataSelection.some((m) => m.total > 0)
            ? getRemplacementsChartDataUrl(chartDataSelection, { epinglesTries: moisEpinglesTries })
            : null,
        chartPeriodeLabel: moisSel.length ? `Mois de la sélection : ${moisSel.join(", ")}` : undefined,
        remplacements: remplacementsMoisSelectionnes.map((r) => ({
          adresse: r.adresse,
          nom: r.nom ?? "—",
          date: dateHeureLabel(r.envoye_le),
          nature: natureLabel(r.type),
          exercice: exerciceLabel(r.exercice, r.type),
        })),
      });
      const suffixeFaible = moisPlusFaible ? `-mois-faible-${moisPlusFaible.cle}` : "";
      savePdf(doc, `remplacements-selection${suffixeFaible}-${todayISO()}.pdf`);
    } catch {
      /* l'échec de l'export PDF est silencieux : la sélection reste consultable à l'écran */
    }
  };

  // Coche / décoche une pièce du mois dans le panneau de sélection.
  const togglePieceMois = (id: number) => {
    setSelectionMois((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Coche toutes les pièces affichées (filtrées), ou les décoche toutes si elles le sont déjà.
  const toggleToutesPiecesMois = () => {
    setSelectionMois((prev) => {
      const next = new Set(prev);
      if (toutesPiecesFiltreesCochees) {
        piecesMoisFiltrees.forEach((p) => next.delete(p.id));
      } else {
        piecesMoisFiltrees.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  // Renvoie uniquement les pièces du mois cochées, chacune vers son adresse d'origine.
  const handleRenvoyerSelection = async () => {
    if (!onRenvoyerDerniere || remplacementsMoisSelectionnes.length === 0) return;
    setRenvoyerSelBusy(true);
    setRenvoyerSelMsg(null);
    let ok = 0;
    let ko = 0;
    for (const r of remplacementsMoisSelectionnes) {
      try {
        const res = await onRenvoyerDerniere(r);
        if (res.ok) ok += 1;
        else ko += 1;
      } catch {
        ko += 1;
      }
    }
    setRenvoyerSelBusy(false);
    setSelectionMois(new Set());
    if (ok === 0) {
      setRenvoyerSelMsg({
        ok: false,
        text: "Aucune pièce sélectionnée n'a pu être renvoyée. Vérifiez la configuration des envois.",
      });
    } else if (ko > 0) {
      setRenvoyerSelMsg({
        ok: true,
        text: `${ok} pièce${ok > 1 ? "s" : ""} renvoyée${ok > 1 ? "s" : ""}, ${ko} en échec.`,
      });
    } else {
      setRenvoyerSelMsg({
        ok: true,
        text: `${ok} pièce${ok > 1 ? "s" : ""} sélectionnée${ok > 1 ? "s" : ""} renvoyée${ok > 1 ? "s" : ""}.`,
      });
    }
  };

  // Renvoie en un clic la dernière pièce transmise à cette adresse (journal ou bilan),
  // sans modifier le comptable habituel, puis rafraîchit la liste.
  const handleRenvoyerDerniere = async (r: ComptableRemplacement, cle: string) => {
    if (!onRenvoyerDerniere) return;
    setRenvoyerCle(cle);
    setRenvoyerMsg(null);
    try {
      const res = await onRenvoyerDerniere(r);
      setRenvoyerMsg({ cle, ok: res.ok, text: res.message });
    } catch {
      setRenvoyerMsg({ cle, ok: false, text: "Le renvoi a échoué. Réessayez." });
    } finally {
      setRenvoyerCle(null);
    }
  };

  // Réexpédie d'un coup toutes les pièces renvoyées ce mois-ci (journal ou bilan),
  // chacune vers son adresse d'origine, sans modifier le comptable habituel.
  const handleRenvoyerTousMois = async () => {
    if (!onRenvoyerDerniere || remplacementsDuMois.length === 0) return;
    setRenvoyerTousBusy(true);
    setRenvoyerTousMsg(null);
    let ok = 0;
    let ko = 0;
    for (const r of remplacementsDuMois) {
      try {
        const res = await onRenvoyerDerniere(r);
        if (res.ok) ok += 1;
        else ko += 1;
      } catch {
        ko += 1;
      }
    }
    setRenvoyerTousBusy(false);
    if (ok === 0) {
      setRenvoyerTousMsg({
        ok: false,
        text: "Aucune pièce du mois n'a pu être renvoyée. Vérifiez la configuration des envois.",
      });
    } else if (ko > 0) {
      setRenvoyerTousMsg({
        ok: true,
        text: `${ok} pièce${ok > 1 ? "s" : ""} du mois renvoyée${ok > 1 ? "s" : ""}, ${ko} en échec.`,
      });
    } else {
      setRenvoyerTousMsg({
        ok: true,
        text: `${ok} pièce${ok > 1 ? "s" : ""} du mois renvoyée${ok > 1 ? "s" : ""}.`,
      });
    }
  };

  // Le tableau de bord peut ouvrir la vue « Remplacements » déjà filtrée sur le remplaçant habituel.
  useEffect(() => {
    if (filtreAdresseInitial && filtreAdresseInitial.trim()) {
      setFiltreAdresse(filtreAdresseInitial.trim().toLowerCase());
    }
  }, [filtreAdresseInitial]);

  // Le sélecteur de tri du tableau de bord peut imposer le tri à l'ouverture de la vue
  // (et le mémoriser comme préférence d'affichage).
  useEffect(() => {
    if (filtreTriInitial) {
      setTri(filtreTriInitial);
      try {
        localStorage.setItem(TRI_STORAGE_KEY, filtreTriInitial);
      } catch {
        /* préférence de confort : ignorée si le stockage est indisponible */
      }
    }
  }, [filtreTriInitial]);

  // Le raccourci du tableau de bord peut ouvrir la vue avec le filtre « Mois record uniquement »
  // déjà actif, pour ne montrer que les pièces du mois le plus actif de l'historique.
  useEffect(() => {
    if (filtreRecordInitial) {
      setRecordUniquement(true);
      try {
        localStorage.setItem(RECORD_STORAGE_KEY, "true");
      } catch {
        /* préférence de confort : ignorée si le stockage est indisponible */
      }
    }
  }, [filtreRecordInitial]);

  // Suit les mois épinglés « à surveiller » si la préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setMoisEpingles(lireMoisEpingles());
    window.addEventListener(REMPLACEMENTS_EPINGLE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_EPINGLE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le filtre « mois sous le seuil » si la préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setFiltreSousSeuil(lireRempFiltreSousSeuil());
    window.addEventListener(REMPLACEMENTS_SOUSSEUIL_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_SOUSSEUIL_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le filtre « mois épinglé uniquement » si la préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setFiltreEpingle(lireRempFiltreEpingle());
    window.addEventListener(REMPLACEMENTS_EPINGLEUNIQUEMENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_EPINGLEUNIQUEMENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le dernier mois le plus faible consulté (et l'historique des mois faibles) si la
  // préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => {
      setDernierMoisFaible(lireDernierMoisFaible());
      setDernierMoisClavier(lireDernierMoisClavier());
      setHistoriqueMoisFaibles(lireHistoriqueMoisFaibles());
      setHistoriqueMoisClavier(lireHistoriqueMoisClavier());
    };
    window.addEventListener(REMPLACEMENTS_DERNIER_FAIBLE_EVENT, sync);
    window.addEventListener(REMPLACEMENTS_DERNIER_CLAVIER_EVENT, sync);
    window.addEventListener(REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT, sync);
    window.addEventListener(REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_DERNIER_FAIBLE_EVENT, sync);
      window.removeEventListener(REMPLACEMENTS_DERNIER_CLAVIER_EVENT, sync);
      window.removeEventListener(REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT, sync);
      window.removeEventListener(REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit l'état replié / déplié de la pastille « Épinglé » (préférence partagée avec le tableau de
  // bord) si elle change (même page ou autre onglet), pour garder les deux vues cohérentes.
  useEffect(() => {
    const sync = () => setEpinglesReplie(lireEpinglesReplie());
    window.addEventListener(REMPLACEMENTS_EPINGLES_REPLIE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_EPINGLES_REPLIE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le mode de rangement des mois épinglés (préférence partagée avec le tableau de bord) si
  // elle change (même page ou autre onglet), pour garder les deux vues cohérentes.
  useEffect(() => {
    const sync = () => setTriEpingles(lireTriEpingles());
    window.addEventListener(REMPLACEMENTS_TRI_EPINGLES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_TRI_EPINGLES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Le jeton « Épinglé » du tableau de bord peut ouvrir la vue avec le filtre « mois épinglé
  // uniquement » déjà actif, pour ne montrer que les pièces des mois mis à surveiller.
  useEffect(() => {
    if (filtreEpingleInitial) {
      setFiltreEpingle(true);
      ecrireRempFiltreEpingle(true);
    }
  }, [filtreEpingleInitial]);

  // Le tableau de bord peut ouvrir la vue « Remplacements » déjà filtrée sur un seul mois
  // (clic sur un mois épinglé de la pastille « Épinglé »), pour sauter directement à ses pièces.
  // La barre de ce mois est brièvement mise en évidence à l'arrivée, pour situer le mois ouvert.
  useEffect(() => {
    if (filtreMoisInitial && /^\d{4}-\d{2}$/.test(filtreMoisInitial)) {
      setFiltreMois(filtreMoisInitial);
      setPulseMois(filtreMoisInitial);
      const t = window.setTimeout(() => setPulseMois(null), 2300);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [filtreMoisInitial]);

  // Arrivée depuis le raccourci « Ouvrir le mois le plus faible » du tableau de bord : on mémorise
  // ce mois comme « dernier mois le plus faible consulté » et sa barre du mini-graphe est surlignée
  // brièvement d'un halo secondary, pour bien repérer le creux d'activité.
  useEffect(() => {
    if (filtreFaibleInitial && filtreMoisInitial && /^\d{4}-\d{2}$/.test(filtreMoisInitial)) {
      ecrireDernierMoisFaible(filtreMoisInitial);
      setDernierMoisFaible(filtreMoisInitial);
      setPulseFaible(filtreMoisInitial);
      const t = window.setTimeout(() => setPulseFaible(null), 2400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [filtreFaibleInitial, filtreMoisInitial]);

  // Contenu du menu déroulant de l'historique des mois ouverts au clavier, partagé par le compteur
  // « N mois au clavier » et par le bouton « Reprendre ». Chaque ligne offre un bouton « Reprendre »
  // explicite (au lieu du seul clic sur la ligne).
  const menuClavierContenu = (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={fermerMenuClavier}
        className="fixed inset-0 z-30 cursor-default"
      />
      <div className="absolute right-0 top-full z-40 mt-1 w-72 p-2 rounded-md bg-foreground-950 text-background-50 border border-foreground-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-background-50/60">
            Mois ouverts au clavier
          </p>
          <button
            type="button"
            onClick={() => {
              if (moisEpingles.length === 0) return;
              basculerFiltreEpingle();
              fermerMenuClavier();
            }}
            disabled={moisEpingles.length === 0}
            aria-pressed={filtreEpingle && moisEpingles.length > 0}
            title={
              moisEpingles.length === 0
                ? "Aucun mois épinglé à surveiller pour l'instant"
                : filtreEpingle
                  ? "Ne plus filtrer sur les mois épinglés"
                  : `Ne montrer que les pièces des ${moisEpingles.length} mois épinglés`
            }
            className={`inline-flex items-center gap-1 h-5 pl-1.5 pr-2 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-colors ${
              moisEpingles.length === 0
                ? "bg-background-50/5 border-background-50/15 text-background-50/40 cursor-not-allowed"
                : filtreEpingle
                  ? "bg-secondary-500 border-secondary-400 text-background-50 cursor-pointer hover:bg-secondary-600"
                  : "bg-background-50/10 border-background-50/25 text-background-50 cursor-pointer hover:bg-background-50/20"
            }`}
          >
            <i className="ri-pushpin-2-fill text-[10px]"></i>
            <strong>{moisEpingles.length}</strong> mois épinglé{moisEpingles.length > 1 ? "s" : ""}
          </button>
        </div>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {historiqueMoisClavier.map((cle) => (
            <li key={cle}>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-background-50/10 transition-colors">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold min-w-0">
                  <i className="ri-keyboard-line text-background-50/60"></i>
                  <span className="truncate">{moisCleLabel(cle)}</span>
                  {cle === filtreMois && (
                    <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-background-50/20 text-[9px] font-bold whitespace-nowrap">
                      affiché
                    </span>
                  )}
                  {cle === dernierMoisClavier && (
                    <span className="text-[9px] uppercase tracking-wide text-background-50/50">dernier</span>
                  )}
                </span>
                <span className="shrink-0 inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMoisEpingles(basculerMoisEpingle(cle))}
                    aria-pressed={moisEpingles.includes(cle)}
                    title={
                      moisEpingles.includes(cle)
                        ? `Détacher ${moisCleLabel(cle)} de la surveillance`
                        : `Épingler ${moisCleLabel(cle)} à surveiller (sans fermer le menu)`
                    }
                    aria-label={moisEpingles.includes(cle) ? "Détacher ce mois" : "Épingler ce mois"}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md border text-[11px] cursor-pointer transition-colors ${
                      moisEpingles.includes(cle)
                        ? "bg-secondary-500 border-secondary-400 text-background-50 hover:bg-secondary-600"
                        : "bg-background-50/10 border-background-50/25 text-background-50 hover:bg-background-50/20"
                    }`}
                  >
                    <i className={moisEpingles.includes(cle) ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReprendreClavierMois(cle)}
                    title={`Reprendre ${moisCleLabel(cle)}`}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                  >
                    <i className="ri-arrow-go-forward-line"></i>
                    Reprendre
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopierRangement}
            title="Copier le mode de rangement et la liste priorisée des mois épinglés dans le presse-papiers"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
          >
            <i className="ri-clipboard-line"></i>
            Copier le rangement
          </button>
          <button
            type="button"
            onClick={() => {
              viderHistoriqueMoisClavier();
              fermerMenuClavier();
            }}
            title="Vider l'historique des mois ouverts au clavier"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
          >
            <i className="ri-delete-bin-line"></i>
            Vider l'historique
          </button>
        </div>
      </div>
    </>
  );

  // Contenu du menu déroulant de l'historique des mois faibles consultés, partagé par le compteur
  // « N mois faibles consultés » et par le bouton « Reprendre un mois faible ». Structure symétrique
  // du menu clavier : badge « N mois épinglés » en tête et bouton « Reprendre » explicite par ligne.
  const menuFaibleContenu = (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setMenuFaibleOuvert(null)}
        className="fixed inset-0 z-30 cursor-default"
      />
      <div className="absolute right-0 top-full z-40 mt-1 w-72 p-2 rounded-md bg-foreground-950 text-background-50 border border-foreground-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-background-50/60">
            Mois faibles consultés
          </p>
          <button
            type="button"
            onClick={() => {
              if (moisEpingles.length === 0) return;
              basculerFiltreEpingle();
              setMenuFaibleOuvert(null);
            }}
            disabled={moisEpingles.length === 0}
            aria-pressed={filtreEpingle && moisEpingles.length > 0}
            title={
              moisEpingles.length === 0
                ? "Aucun mois épinglé à surveiller pour l'instant"
                : filtreEpingle
                  ? "Ne plus filtrer sur les mois épinglés"
                  : `Ne montrer que les pièces des ${moisEpingles.length} mois épinglés`
            }
            className={`inline-flex items-center gap-1 h-5 pl-1.5 pr-2 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-colors ${
              moisEpingles.length === 0
                ? "bg-background-50/5 border-background-50/15 text-background-50/40 cursor-not-allowed"
                : filtreEpingle
                  ? "bg-secondary-500 border-secondary-400 text-background-50 cursor-pointer hover:bg-secondary-600"
                  : "bg-background-50/10 border-background-50/25 text-background-50 cursor-pointer hover:bg-background-50/20"
            }`}
          >
            <i className="ri-pushpin-2-fill text-[10px]"></i>
            <strong>{moisEpingles.length}</strong> mois épinglé{moisEpingles.length > 1 ? "s" : ""}
          </button>
        </div>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {historiqueMoisFaibles.map((cle) => (
            <li key={cle}>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-background-50/10 transition-colors">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold min-w-0">
                  <i className="ri-arrow-down-circle-line text-background-50/60"></i>
                  <span className="truncate">{moisCleLabel(cle)}</span>
                  {cle === filtreMois && (
                    <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-background-50/20 text-[9px] font-bold whitespace-nowrap">
                      affiché
                    </span>
                  )}
                  {cle === dernierMoisFaible && (
                    <span className="text-[9px] uppercase tracking-wide text-background-50/50">dernier</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleReprendreFaible(cle)}
                  title={`Reprendre ${moisCleLabel(cle)}`}
                  className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-arrow-go-forward-line"></i>
                  Reprendre
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopierRangement}
            title="Copier le mode de rangement et la liste priorisée des mois épinglés dans le presse-papiers"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
          >
            <i className="ri-clipboard-line"></i>
            Copier le rangement
          </button>
          <button
            type="button"
            onClick={() => {
              viderHistoriqueMoisFaibles();
              setMenuFaibleOuvert(null);
            }}
            title="Vider l'historique des mois faibles consultés"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-6 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
          >
            <i className="ri-delete-bin-line"></i>
            Vider l'historique
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      id="remplacements"
      className="scroll-mt-24 rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-user-shared-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-base text-foreground-950">Remplacements</h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              Tous les <strong className="text-foreground-700">destinataires ponctuels</strong> utilisés pour renvoyer un
              journal ou un bilan d'archivage (ex. comptable remplaçant), avec la date et l'exercice concerné.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {remplacements.length > 0 && (
            <>
              <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-background-50 border border-background-200 text-[11px] text-foreground-600 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-send-plane-line text-accent-600"></i>
                  <strong className="text-foreground-800">{remplacementsFiltres.length}</strong> renvoi
                  {remplacementsFiltres.length > 1 ? "s" : ""}
                </span>
                <span className="w-px h-3 bg-background-300"></span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-user-3-line text-secondary-600"></i>
                  <strong className="text-foreground-800">{nbAdresses}</strong> adresse{nbAdresses > 1 ? "s" : ""}
                </span>
              </span>
              {/* Compteur de l'historique « mois ouverts au clavier » : il ouvre d'un clic le menu
                  de l'historique pour reprendre un mois, et propose l'export CSV juste à côté. */}
              {historiqueMoisClavier.length > 0 && (
                <div className="relative">
                  <span className="inline-flex items-stretch rounded-full overflow-hidden bg-accent-100 border border-accent-200 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => basculerMenuClavier("compteur")}
                      aria-expanded={menuClavierOuvert === "compteur"}
                      title="Ouvrir l'historique des mois ouverts au clavier pour en reprendre un d'un clic"
                      className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 text-[11px] font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                    >
                      <i className="ri-keyboard-line"></i>
                      <strong className="text-accent-900">{historiqueMoisClavier.length}</strong> mois au clavier
                      <i className={menuClavierOuvert === "compteur" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportHistoriqueClavierCsv}
                      title="Exporter l'historique des mois ouverts au clavier en CSV (mois, journaux, bilans, total)"
                      aria-label="Exporter l'historique des mois ouverts au clavier en CSV"
                      className="inline-flex items-center justify-center w-7 h-7 border-l border-accent-200 text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                    >
                      <i className="ri-file-text-line"></i>
                    </button>
                  </span>
                  {menuClavierOuvert === "compteur" && menuClavierContenu}
                </div>
              )}
              {/* Compteur de l'historique « mois faibles consultés », symétrique du compteur des mois
                  ouverts au clavier : il ouvre d'un clic le menu de l'historique pour reprendre un
                  mois faible, et propose l'export CSV juste à côté. */}
              {historiqueMoisFaibles.length > 0 && (
                <div className="relative">
                  <span className="inline-flex items-stretch rounded-full overflow-hidden bg-secondary-100 border border-secondary-200 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => basculerMenuFaible("compteur")}
                      aria-expanded={menuFaibleOuvert === "compteur"}
                      title="Ouvrir l'historique des mois faibles consultés pour en reprendre un d'un clic"
                      className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 text-[11px] font-semibold text-secondary-900 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className="ri-arrow-down-circle-line"></i>
                      <strong className="text-secondary-900">{historiqueMoisFaibles.length}</strong> mois faibles
                      consultés
                      <i className={menuFaibleOuvert === "compteur" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportHistoriqueFaibleCsv}
                      title="Exporter l'historique des mois faibles consultés en CSV (mois, journaux, bilans, total)"
                      aria-label="Exporter l'historique des mois faibles consultés en CSV"
                      className="inline-flex items-center justify-center w-7 h-7 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className="ri-file-text-line"></i>
                    </button>
                  </span>
                  {menuFaibleOuvert === "compteur" && menuFaibleContenu}
                </div>
              )}
              {/* Pastille « Épinglé » : liste repliable des mois surveillés (même préférence de repli
                  que le tableau de bord), chaque mois cliquable pour ouvrir sa liste filtrée. */}
              {moisEpingles.length > 0 && (
                <div className="relative">
                <span className="inline-flex items-stretch rounded-full overflow-hidden bg-secondary-100 border border-secondary-200 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={basculerFiltreEpingle}
                    aria-pressed={filtreEpingle}
                    title={
                      filtreEpingle
                        ? "Ne montrer que les pièces des mois épinglés (cliquer pour tout réafficher)"
                        : `Ne montrer que les pièces des ${moisEpingles.length} mois épinglés`
                    }
                    className={`inline-flex items-center gap-1.5 h-7 pl-3 pr-2 text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      filtreEpingle ? "bg-secondary-500 text-background-50" : "text-secondary-900 hover:bg-secondary-200"
                    }`}
                  >
                    <i className="ri-pushpin-2-fill"></i>
                    Épinglé
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        filtreEpingle ? "bg-background-50/30" : "bg-secondary-500 text-background-50"
                      }`}
                      title={`${moisEpingles.length} mois épinglé${moisEpingles.length > 1 ? "s" : ""}`}
                    >
                      {moisEpingles.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={basculerEpinglesReplie}
                    aria-expanded={!epinglesReplie}
                    title={epinglesReplie ? "Déplier la liste des mois épinglés" : "Replier la liste des mois épinglés"}
                    aria-label={epinglesReplie ? "Déplier les mois épinglés" : "Replier les mois épinglés"}
                    className="inline-flex items-center justify-center w-6 h-7 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  >
                    <i className={epinglesReplie ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}></i>
                  </button>
                  {!epinglesReplie && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5"
                      onMouseEnter={ouvrirSurvolPucesEpingles}
                      onMouseLeave={fermerSurvolPucesEpingles}
                    >
                      {moisEpinglesTries.slice(0, 3).map((cle, idx) => (
                        <span
                          key={cle}
                          draggable
                          onDragStart={() => setDragMois(cle)}
                          onDragEnd={() => setDragMois(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropMois(cle)}
                          title="Glissez pour réordonner la priorité · cliquez le mois pour l'ouvrir"
                          className={`inline-flex items-stretch rounded-full border overflow-hidden transition-colors cursor-grab active:cursor-grabbing ${
                            filtreMois === cle
                              ? "bg-secondary-500 border-secondary-500 text-background-50"
                              : "bg-background-50/80 border-secondary-200 text-secondary-900 hover:bg-background-50"
                          }${pulseMois === cle ? " animate-mois-highlight" : ""}${dragMois === cle ? " opacity-60" : ""}`}
                        >
                          <span
                            className="inline-flex items-center justify-center h-6 min-w-[24px] pl-1.5 pr-0.5 text-[9px] font-bold opacity-85 whitespace-nowrap"
                            title={`Rang de surveillance ${idx + 1}/${moisEpinglesTries.length}`}
                          >
                            {idx + 1}/{moisEpinglesTries.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOuvrirMoisEpingle(cle)}
                            title={`Ouvrir la comptabilité filtrée sur ${moisCleLabel(cle)}`}
                            className="inline-flex items-center gap-1 h-6 pl-2 pr-1 text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
                          >
                            <i className="ri-drag-move-2-line opacity-70"></i>
                            {moisCleLabel(cle)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMonterMoisEnTete(cle)}
                            disabled={idx === 0}
                            title={idx === 0 ? "Déjà en tête de surveillance" : `Monter ${moisCleLabel(cle)} en tête de surveillance`}
                            aria-label={`Monter ${moisCleLabel(cle)} en tête`}
                            className="inline-flex items-center justify-center w-5 h-6 border-l border-foreground-900/10 whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <i className="ri-arrow-up-double-line text-[11px]"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => basculerEpinglageMois(cle)}
                            title={`Détacher ${moisCleLabel(cle)} de la surveillance`}
                            aria-label={`Détacher ${moisCleLabel(cle)}`}
                            className="inline-flex items-center justify-center w-5 h-6 border-l border-foreground-900/10 whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors"
                          >
                            <i className="ri-close-line text-[11px]"></i>
                          </button>
                        </span>
                      ))}
                      {moisEpinglesTries.length > 3 && (
                        <span className="text-[10px] font-semibold text-foreground-500 whitespace-nowrap">
                          +{moisEpinglesTries.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {!epinglesReplie && survolPucesEpingles && (
                  <div
                    className="absolute right-0 top-full z-40 pt-2 w-72"
                    onMouseEnter={ouvrirSurvolPucesEpingles}
                    onMouseLeave={fermerSurvolPucesEpingles}
                  >
                    <div className="p-3 rounded-md bg-foreground-950 text-background-50 border border-foreground-800">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-background-50/60">
                        Mois épinglés · journaux / bilans
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {moisEpinglesTries.map((cle, idx) => {
                          const d = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
                          const dernierIdx = moisEpinglesTries.length - 1;
                          return (
                            <li key={cle}>
                              <div className="flex items-center gap-1">
                                {/* Récap « rang de surveillance » cliquable (au lieu du seul numéro) : équivalent
                                    à l'écran de la colonne « Priorité » du CSV, il remonte le mois en tête au clic. */}
                                <button
                                  type="button"
                                  onClick={() => handleMonterMoisEnTete(cle)}
                                  disabled={idx === 0}
                                  title={
                                    idx === 0
                                      ? `Rang de surveillance ${idx + 1}/${moisEpinglesTries.length} — déjà en tête`
                                      : `Rang de surveillance ${idx + 1}/${moisEpinglesTries.length} — cliquer pour remonter ${moisCleLabel(cle)} en tête`
                                  }
                                  aria-label={`Rang de surveillance ${idx + 1} sur ${moisEpinglesTries.length}`}
                                  className="shrink-0 inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded-full bg-background-50/20 text-[9px] font-bold whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <i className="ri-arrow-up-double-line text-[10px]"></i>
                                  {idx + 1}/{moisEpinglesTries.length}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOuvrirMoisEpingle(cle)}
                                  title={`Ouvrir la comptabilité filtrée sur ${moisCleLabel(cle)}`}
                                  className="flex-1 flex items-center justify-between gap-2 px-2 py-1 rounded-md text-left cursor-pointer hover:bg-background-50/10 transition-colors"
                                >
                                  <span className="text-[11px] font-semibold">{moisCleLabel(cle)}</span>
                                  <span className="inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1" title={`${d.journal} journal${d.journal > 1 ? "x" : ""}`}>
                                      <i className="ri-calendar-schedule-line text-primary-300"></i>
                                      {d.journal}
                                    </span>
                                    <span className="text-background-50/40">·</span>
                                    <span className="inline-flex items-center gap-1" title={`${d.bilan} bilan${d.bilan > 1 ? "s" : ""}`}>
                                      <i className="ri-archive-drawer-line text-secondary-300"></i>
                                      {d.bilan}
                                    </span>
                                    <span className="text-background-50/40">·</span>
                                    <span className="font-bold">{d.total}</span>
                                  </span>
                                </button>
                                <span className="shrink-0 inline-flex items-center rounded-md border border-background-50/20 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => handleDeplacerMois(cle, -1)}
                                    disabled={idx === 0}
                                    title={idx === 0 ? "Déjà en tête de surveillance" : `Rendre ${moisCleLabel(cle)} plus prioritaire`}
                                    aria-label={`Rendre ${moisCleLabel(cle)} plus prioritaire`}
                                    className="inline-flex items-center justify-center w-5 h-5 border-l border-background-50/20 text-background-50/70 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <i className="ri-arrow-up-s-line text-[12px]"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeplacerMois(cle, 1)}
                                    disabled={idx === dernierIdx}
                                    title={idx === dernierIdx ? "Déjà en bas de la surveillance" : `Rendre ${moisCleLabel(cle)} moins prioritaire`}
                                    aria-label={`Rendre ${moisCleLabel(cle)} moins prioritaire`}
                                    className="inline-flex items-center justify-center w-5 h-5 border-l border-background-50/20 text-background-50/70 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <i className="ri-arrow-down-s-line text-[12px]"></i>
                                  </button>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setMoisEpingles(basculerMoisEpingle(cle))}
                                  title={`Détacher ${moisCleLabel(cle)} de la surveillance (sans fermer la bulle)`}
                                  aria-label={`Détacher ${moisCleLabel(cle)}`}
                                  className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-background-50/50 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors"
                                >
                                  <i className="ri-pushpin-2-fill text-[11px]"></i>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-2 pt-2 border-t border-background-50/20 text-[10px] text-background-50/60 italic">
                        Cliquez un mois pour ouvrir la comptabilité filtrée sur ce mois.
                      </p>
                    </div>
                  </div>
                )}
            </div>
              )}
              {moisEpingles.length > 1 && (
                <button
                  type="button"
                  onClick={basculerTriEpinglesMois}
                  aria-pressed={triEpingles === "chrono"}
                  title={
                    triEpingles === "chrono"
                      ? "Ranger les mois épinglés par priorité manuelle"
                      : "Ranger les mois épinglés dans l'ordre chronologique des mois"
                  }
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 border border-secondary-200 text-xs font-semibold text-secondary-900 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                >
                  <i className={triEpingles === "chrono" ? "ri-sort-asc" : "ri-sort-desc"}></i>
                  Trier d'un clic
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-background-50 text-[10px] font-bold text-secondary-900 uppercase tracking-wide">
                    {triEpingles === "chrono" ? "chrono" : "priorité"}
                  </span>
                </button>
              )}
              {moisEpingles.length > 0 && (
                <RemplacementsRangementBar
                  size="sm"
                  moisEpinglesTries={moisEpinglesTries}
                  triEpingles={triEpingles}
                  nbMoisEpingles={moisEpingles.length}
                  onResetPriorite={handleReinitialiserPriorite}
                />
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                title="Exporter la liste des remplacements en CSV (adresse, date, nature, exercice)"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
              >
                <i className="ri-file-text-line"></i>
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                title="Exporter la liste des remplacements en PDF (adresse, libellé, date, nature, exercice)"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
              >
                <i className="ri-file-pdf-2-line"></i>
                Export PDF
              </button>
              {/* Raccourci « Reprendre le dernier mois faible consulté » : réapplique le filtre de
                  mois sur le dernier creux d'activité consulté et surligne sa barre du mini-graphe. */}
              {historiqueMoisFaibles.length > 0 && (
                <div className="relative">
                  <span className="inline-flex items-stretch rounded-md overflow-hidden border border-secondary-200 bg-secondary-100 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={handleReprendreDernierFaible}
                      disabled={!dernierMoisFaible || dernierMoisFaible === filtreMois}
                      title={
                        dernierMoisFaible
                          ? `Reprendre le dernier mois faible consulté (${moisCleLabel(dernierMoisFaible)})`
                          : "Reprendre le dernier mois faible consulté"
                      }
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-down-circle-line"></i>
                      Reprendre un mois faible
                    </button>
                    <button
                      type="button"
                      onClick={() => basculerMenuFaible("bouton")}
                      aria-expanded={menuFaibleOuvert === "bouton"}
                      title="Choisir un mois faible consulté à reprendre"
                      aria-label="Ouvrir l'historique des mois faibles consultés"
                      className="inline-flex items-center justify-center w-7 h-8 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className={menuFaibleOuvert === "bouton" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </button>
                  </span>
                  {menuFaibleOuvert === "bouton" && menuFaibleContenu}
                </div>
              )}
              {/* Reprendre le dernier mois ouvert au clavier (Entrée sur une barre du mini-graphe),
                  avec un petit menu listant les derniers mois clavier pour en reprendre un d'un clic. */}
              {historiqueMoisClavier.length > 0 && (
                <div className="relative">
                  <span className="inline-flex items-stretch rounded-md overflow-hidden border border-accent-300 bg-accent-100 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={handleReprendreClavier}
                      disabled={!dernierMoisClavier || dernierMoisClavier === filtreMois}
                      title={
                        dernierMoisClavier
                          ? `Reprendre le dernier mois ouvert au clavier (${moisCleLabel(dernierMoisClavier)})`
                          : "Reprendre le dernier mois ouvert au clavier"
                      }
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-keyboard-line"></i>
                      Reprendre : {dernierMoisClavier ? moisCleLabel(dernierMoisClavier) : "—"}
                    </button>
                    <button
                      type="button"
                      onClick={() => basculerMenuClavier("bouton")}
                      aria-expanded={menuClavierOuvert === "bouton"}
                      title="Choisir un mois ouvert au clavier à reprendre"
                      aria-label="Ouvrir l'historique des mois ouverts au clavier"
                      className="inline-flex items-center justify-center w-7 h-8 border-l border-accent-300 text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                    >
                      <i className={menuClavierOuvert === "bouton" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </button>
                    {/* Export CSV de l'historique des mois ouverts au clavier (mois, journaux, bilans, total). */}
                    <button
                      type="button"
                      onClick={handleExportHistoriqueClavierCsv}
                      title="Exporter l'historique des mois ouverts au clavier en CSV (mois, journaux, bilans, total)"
                      aria-label="Exporter l'historique des mois ouverts au clavier en CSV"
                      className="inline-flex items-center justify-center w-7 h-8 border-l border-accent-300 text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                    >
                      <i className="ri-file-text-line"></i>
                    </button>
                  </span>
                  {menuClavierOuvert === "bouton" && menuClavierContenu}
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => onReload()}
            disabled={loading}
            title="Recharger la liste des remplacements"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-600 cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50"
            aria-label="Recharger les remplacements"
          >
            <i className={loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
          </button>
        </div>
      </div>

      {/* Récap du mois en cours + sélection des pièces à renvoyer */}
      {remplacements.length > 0 && (
        <RemplacementsSelection
          recapMois={recapMois}
          recordGlobal={recordGlobal}
          recordGlobalLabel={recordGlobalLabel}
          canRenvoyer={Boolean(onRenvoyerDerniere)}
          selectionOuverte={selectionOuverte}
          onToggleSelectionOuverte={() => setSelectionOuverte((v) => !v)}
          selectionMois={selectionMois}
          remplacementsDuMois={remplacementsDuMois}
          renvoyerTousBusy={renvoyerTousBusy}
          renvoyerTousMsg={renvoyerTousMsg}
          onRenvoyerTousMois={handleRenvoyerTousMois}
          selFiltreNature={selFiltreNature}
          onSelNature={handleSelNature}
          selFiltreAdresse={selFiltreAdresse}
          onSelAdresse={handleSelAdresse}
          adressesMoisDispo={adressesMoisDispo}
          piecesMoisFiltrees={piecesMoisFiltrees}
          toutesPiecesFiltreesCochees={toutesPiecesFiltreesCochees}
          onToggleToutes={toggleToutesPiecesMois}
          onEffacerSelFiltres={handleEffacerSelFiltres}
          onTogglePiece={togglePieceMois}
          onExportSelectionPdf={handleExportSelectionPdf}
          renvoyerSelBusy={renvoyerSelBusy}
          renvoyerSelMsg={renvoyerSelMsg}
          onRenvoyerSelection={handleRenvoyerSelection}
        />
      )}

      {/* Mini-graphe : nombre de renvois par mois sur la période choisie (journal vs bilan) */}
      {chartTotal > 0 && (
        <RemplacementsChart
          chartMoisData={chartMoisData}
          maxChart={maxChart}
          chartTotal={chartTotal}
          chartMois={chartMois}
          onChartMois={handleChartMois}
          seuilRemp={seuilRemp}
          onChangeSeuil={changerSeuilRemp}
          nbSousSeuil={nbSousSeuil}
          filtreSousSeuil={filtreSousSeuil}
          onBasculerFiltreSousSeuil={basculerFiltreSousSeuil}
          moisEpingles={moisEpingles}
          moisEpinglesRang={moisEpinglesTries}
          onBasculerEpinglageMois={basculerEpinglageMois}
          dragMois={dragMois}
          onDragMoisStart={setDragMois}
          onDragMoisEnd={() => setDragMois(null)}
          onDropMois={handleDropMois}
          onDeplacerMois={handleDeplacerMois}
          onMonterMoisEnTete={handleMonterMoisEnTete}
          onToutDetacher={handleToutDetacher}
          onEpinglerSousSeuil={handleEpinglerSousSeuil}
          recordMois={recordMois}
          recordMoisLabel={recordMoisLabel}
          onEpinglerRecord={handleEpinglerRecord}
          onEpinglerFaible={handleEpinglerFaible}
          moisPlusFaible={moisPlusFaible}
          onOuvrirPlusFaible={handleOuvrirPlusFaible}
          onOuvrirMoisFaible={handleReprendreFaible}
          onConsultClavier={handleConsultClavier}
          onExportCsv={handleExportChartCsv}
          onExportPng={handleExportChartPng}
          onExportPngFaible={handleExportChartPngFaible}
          onExportHistorique={handleExportHistoriquePng}
          nbHistoriqueFaible={historiqueMoisFaibles.length}
          filtreMois={filtreMois}
          onBarClick={handleBarClick}
          pulseFaible={pulseFaible}
          pulseMois={pulseMois}
          survolMois={survolMois}
          onSurvolMois={setSurvolMois}
        />
      )}

      {/* Filtres + liste regroupée par adresse ponctuelle */}
      <RemplacementsListe
        remplacementsCount={remplacements.length}
        remplacementsFiltres={remplacementsFiltres}
        loading={loading}
        error={error}
        groupesTries={groupesTries}
        clePlusUtilisee={clePlusUtilisee}
        filtreAdresse={filtreAdresse}
        onFiltreAdresse={setFiltreAdresse}
        adressesDispo={adressesDispo}
        filtreExercice={filtreExercice}
        onFiltreExercice={setFiltreExercice}
        exercicesDispo={exercicesDispo}
        filtreMois={filtreMois}
        onFiltreMois={setFiltreMois}
        recordUniquement={recordUniquement}
        onRecordUniquement={handleRecordUniquement}
        recordGlobalLabel={recordGlobalLabel}
        filtreEpingle={filtreEpingle}
        onFiltreEpingle={basculerFiltreEpingle}
        moisEpingles={moisEpingles}
        filtreSousSeuil={filtreSousSeuil}
        onFiltreSousSeuil={basculerFiltreSousSeuil}
        nbSousSeuil={nbSousSeuil}
        seuilRemp={seuilRemp}
        filtreActif={filtreActif}
        onEffacerFiltres={handleEffacerFiltres}
        tri={tri}
        onTri={handleTri}
        ouvert={ouvert}
        onToggleGroupe={(cle) => setOuvert((prev) => (prev === cle ? null : cle))}
        canRenvoyer={Boolean(onRenvoyerDerniere)}
        renvoyerCle={renvoyerCle}
        renvoyerMsg={renvoyerMsg}
        onRenvoyerDerniere={handleRenvoyerDerniere}
        listeRef={listeRef}
      />

      {copieMsg && <Toast message={copieMsg} onClose={() => setCopieMsg(null)} icon="ri-clipboard-line" />}
    </div>
  );
}