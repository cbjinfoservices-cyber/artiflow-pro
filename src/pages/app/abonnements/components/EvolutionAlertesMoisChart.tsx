import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  RECAP_ALERTES_GRAPHE_MOIS_OPTIONS,
  lireRecapAlertesPngNomPlage,
  ecrireRecapAlertesPngNomPlage,
  type AlerteAutoRelance,
} from "@/lib/recontactSeuil";
import { exportAlertesChartImage, nomFichierPngAlertes } from "@/lib/alertesChartImage";
import { pointsAlertesParMois, type PointMois } from "@/lib/alertesParMois";
import { ID_RACCOURCI, estRaccourciActif } from "@/lib/raccourcisEspacePrefs";

/** Liste des gestes clavier disponibles sur le graphe, pour le panneau d'aide dépliable. */
const GESTES_CLAVIER: { touches: string[]; desc: string }[] = [
  { touches: ["←", "→"], desc: "Naviguer d'un mois (et le sélectionner)" },
  { touches: ["Maj", "← →"], desc: "Étendre la plage depuis le mois d'ancrage" },
  { touches: ["Origine"], desc: "Sauter au premier mois du graphe" },
  { touches: ["Fin"], desc: "Sauter au dernier mois du graphe" },
  { touches: ["T"], desc: "« Aujourd'hui » — sélectionner le mois en cours" },
  { touches: ["Page ↑"], desc: "Début de mois — caler le début sur le mois courant" },
  { touches: ["Page ↓"], desc: "Fin de mois — caler la fin sur le mois courant" },
  { touches: ["Z"], desc: "Décaler la plage d'un mois en arrière" },
  { touches: ["X"], desc: "Décaler la plage d'un mois en avant" },
  { touches: ["Maj", "Z X"], desc: "Étendre la plage d'un mois (arrière / avant)" },
  { touches: ["Ctrl", "clic"], desc: "Ajouter ou retirer un mois de la plage" },
  { touches: ["Suppr"], desc: "Vider entièrement la sélection de mois d'un coup" },
  { touches: ["Échap"], desc: "Retirer le filtre de mois" },
];

interface Props {
  /** Alertes envoyées, du plus récent au plus ancien (ordre de l'historique). */
  items: AlerteAutoRelance[];
  /** Nombre de mois affichés (mois courant inclus). */
  moisAffiches?: number;
  /** Change la fenêtre (en mois) affichée ; mémorisé par le parent. */
  onMoisAffichesChange?: (mois: number) => void;
  /** Mois sélectionnés (« AAAA-MM ») pour filtrer la liste. */
  moisSelectionnes?: string[];
  /** Change les mois sélectionnés (multi-sélection : clic + Ctrl, ou clavier Maj + flèches). */
  onSelectMonths?: (cles: string[]) => void;
  /** Résumé texte de la sélection (copiable), repris dans l'image PNG exportée. */
  resumeTexte?: string;
}

/**
 * Mini-graphe du nombre d'alertes email envoyées à l'artisan chaque mois (période glissante).
 * Rendu 100 % CSS (barres proportionnelles), sans dépendance graphique, dans le style de
 * l'historique des récaps.
 *
 * La fenêtre est réglable (3 / 6 / 12 mois) et le total « toutes fenêtres » est affiché à côté du
 * sélecteur pour comparer la période choisie au cumul complet. Chaque barre est cliquable : un clic
 * filtre la liste sur un mois, un clic + Ctrl compose une plage de plusieurs mois. Le graphe est
 * aussi pilotable au clavier : les flèches ← / → déplacent le curseur (et sélectionnent le mois),
 * Maj + flèches étend une plage de mois contigus, pour filtrer sans souris. Un export PNG permet
 * d'archiver la tendance mensuelle.
 */
export default function EvolutionAlertesMoisChart({
  items,
  moisAffiches = 6,
  onMoisAffichesChange,
  moisSelectionnes = [],
  onSelectMonths,
  resumeTexte = "",
}: Props) {
  // Points par mois (répartition partagée avec l'export CSV/ZIP de la carte d'historique).
  const points = useMemo<PointMois[]>(() => pointsAlertesParMois(items, moisAffiches), [items, moisAffiches]);

  // Index du mois en cours (aujourd'hui) dans la fenêtre affichée : cible des raccourcis
  // « Début de mois » / « Fin de mois ». Retombe sur le dernier mois si introuvable.
  const indexMoisCourant = useMemo(() => {
    const d = new Date();
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = points.findIndex((p) => p.cle === cle);
    return i >= 0 ? i : points.length - 1;
  }, [points]);

  const totalPeriode = points.reduce((s, p) => s + p.count, 0);
  // Cumul complet : toutes les alertes chargées, toutes fenêtres confondues.
  const totalToutesFenetres = items.length;
  const max = Math.max(1, ...points.map((p) => p.count));
  const moisAvecActivite = points.filter((p) => p.count > 0).length;
  const cliquable = typeof onSelectMonths === "function";
  const selectionSet = useMemo(() => new Set(moisSelectionnes), [moisSelectionnes]);

  // Curseur clavier : index du mois focus et ancre de la plage (pour Maj + flèches).
  const boutonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [curseur, setCurseur] = useState<number | null>(null);
  const [ancre, setAncre] = useState<number | null>(null);
  // Format du nom du fichier PNG exporté : inclure ou non la plage de mois filtrée (préférence locale).
  const [pngNomAvecPlage, setPngNomAvecPlage] = useState<boolean>(() => lireRecapAlertesPngNomPlage());
  // Panneau « gestes clavier » dépliable listant tous les raccourcis du graphe.
  const [gestesOuvert, setGestesOuvert] = useState(false);
  // Aperçu du nom de fichier PNG qui sera téléchargé (affiché au survol du bouton d'export).
  const nomPngPrevu = useMemo(
    () => nomFichierPngAlertes(moisSelectionnes, pngNomAvecPlage),
    [moisSelectionnes, pngNomAvecPlage],
  );

  // Sélectionne tous les mois entre deux index (inclus) comme une plage contiguë.
  const appliquerPlage = (a: number, b: number) => {
    if (!cliquable) return;
    const [debut, fin] = a <= b ? [a, b] : [b, a];
    onSelectMonths(points.slice(debut, fin + 1).map((p) => p.cle));
  };

  const handleClicMois = (cle: string, avecModificateur: boolean, index: number) => {
    if (!cliquable) return;
    setCurseur(index);
    setAncre(index);
    const set = new Set(moisSelectionnes);
    if (avecModificateur) {
      if (set.has(cle)) set.delete(cle);
      else set.add(cle);
    } else if (set.size === 1 && set.has(cle)) {
      set.clear();
    } else {
      set.clear();
      set.add(cle);
    }
    onSelectMonths(Array.from(set).sort());
  };

  // Décale une clé « AAAA-MM » de `delta` mois (négatif = arrière, positif = avant).
  const decalerCleMois = (cle: string, delta: number): string => {
    const [an, mois] = cle.split("-").map((v) => Number(v));
    if (!an || !mois) return cle;
    const d = new Date(an, mois - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Raccourcis « Z » (un mois en arrière) / « X » (un mois en avant) : décale toute la plage
  // sélectionnée d'un mois. Sans sélection, on décale à partir du mois courant du curseur.
  const handleDecalerPlage = (delta: number) => {
    if (!cliquable || points.length === 0) return;
    const iCurseur = Math.min(points.length - 1, Math.max(0, curseur ?? indexMoisCourant));
    const base = moisSelectionnes.length > 0 ? moisSelectionnes : [points[iCurseur].cle];
    const decalees = Array.from(new Set(base.map((k) => decalerCleMois(k, delta)))).sort();
    onSelectMonths(decalees);
    const borne = (i: number) => Math.min(points.length - 1, Math.max(0, i));
    const cible = borne(iCurseur + delta);
    setCurseur(cible);
    boutonsRef.current[cible]?.focus();
    setAncre((a) => (a === null ? cible : borne(a + delta)));
  };

  // Raccourcis « Maj + Z » / « Maj + X » : ÉTEND la plage d'un mois de plus en arrière / en avant
  // (par opposition au simple décalage de Z / X). On ajoute le mois immédiatement avant le plus
  // ancien mois sélectionné (Maj + Z) ou juste après le plus récent (Maj + X), dans la limite de la
  // fenêtre affichée. Sans sélection, on part du mois courant du curseur.
  const handleEtendrePlage = (delta: number) => {
    if (!cliquable || points.length === 0) return;
    const clesDispo = new Set(points.map((p) => p.cle));
    const iCurseur = Math.min(points.length - 1, Math.max(0, curseur ?? indexMoisCourant));
    const base =
      moisSelectionnes.length > 0 ? [...moisSelectionnes].sort() : [points[iCurseur].cle];
    const debut = base[0];
    const fin = base[base.length - 1];
    // Vers l'arrière on déborde avant le plus ancien mois, vers l'avant après le plus récent.
    const cible = decalerCleMois(delta < 0 ? debut : fin, delta);
    if (!clesDispo.has(cible)) return; // rien à étendre au-delà de la fenêtre affichée
    const etendues = Array.from(new Set([...base, cible])).sort();
    onSelectMonths(etendues);
    const iAjout = points.findIndex((p) => p.cle === cible);
    if (iAjout >= 0) {
      setCurseur(iAjout);
      setAncre(iAjout);
      boutonsRef.current[iAjout]?.focus();
    }
  };

  // Navigation / sélection au clavier : ← → déplacent le curseur, Maj + ← → étendent la plage,
  const handleKeyDownMois = (index: number, e: KeyboardEvent<HTMLButtonElement>) => {
    if (!cliquable) return;
    if (e.key === "Escape" || e.key === "Delete") {
      // Chaque geste peut être coupé depuis « Réglages des raccourcis ».
      const okEffacer =
        e.key === "Escape"
          ? estRaccourciActif(ID_RACCOURCI.grapheEchap)
          : estRaccourciActif(ID_RACCOURCI.grapheSuppr);
      if (!okEffacer) return;
      e.preventDefault();
      // « Échap » comme « Suppr » vident entièrement la sélection de mois d'un coup
      // (« Suppr » est le raccourci dédié, plus explicite qu'Échap qui sert aussi à fermer).
      onSelectMonths([]);
      setCurseur(null);
      setAncre(null);
      return;
    }
    if (e.key === "Home") {
      if (!estRaccourciActif(ID_RACCOURCI.grapheOrigine)) return;
      e.preventDefault();
      // Saut direct au tout premier mois affiché (raccourci « Origine »).
      const cible = 0;
      setCurseur(cible);
      boutonsRef.current[cible]?.focus();
      if (e.shiftKey && estRaccourciActif(ID_RACCOURCI.grapheFlechesMaj)) {
        const base = ancre ?? index;
        setAncre(base);
        appliquerPlage(base, cible);
      } else {
        setAncre(cible);
        onSelectMonths([points[cible].cle]);
      }
      return;
    }
    if (e.key === "End") {
      if (!estRaccourciActif(ID_RACCOURCI.grapheFin)) return;
      e.preventDefault();
      // Saut direct au tout dernier mois affiché (raccourci « Fin », symétrique d'« Origine »).
      const cible = points.length - 1;
      setCurseur(cible);
      boutonsRef.current[cible]?.focus();
      if (e.shiftKey && estRaccourciActif(ID_RACCOURCI.grapheFlechesMaj)) {
        const base = ancre ?? index;
        setAncre(base);
        appliquerPlage(base, cible);
      } else {
        setAncre(cible);
        onSelectMonths([points[cible].cle]);
      }
      return;
    }
    if (e.key === "t" || e.key === "T") {
      if (!estRaccourciActif(ID_RACCOURCI.grapheT)) return;
      e.preventDefault();
      // Raccourci dédié « Aujourd'hui » : ramène directement la sélection sur le mois en cours.
      const cible = indexMoisCourant;
      setCurseur(cible);
      boutonsRef.current[cible]?.focus();
      if (e.shiftKey && estRaccourciActif(ID_RACCOURCI.grapheFlechesMaj)) {
        const base = ancre ?? index;
        setAncre(base);
        appliquerPlage(base, cible);
      } else {
        setAncre(cible);
        onSelectMonths([points[cible].cle]);
      }
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      const idPage = e.key === "PageUp" ? ID_RACCOURCI.graphePageHaut : ID_RACCOURCI.graphePageBas;
      if (!estRaccourciActif(idPage)) return;
      e.preventDefault();
      // « Début de mois » (Page précédente) / « Fin de mois » (Page suivante) : ramènent la plage
      // sur le mois en cours (aujourd'hui). L'un cale le début de la plage, l'autre la fin.
      const cible = indexMoisCourant;
      boutonsRef.current[cible]?.focus();
      if (e.key === "PageUp") {
        const fin = curseur ?? cible;
        setAncre(cible);
        setCurseur(fin);
        appliquerPlage(cible, fin);
      } else {
        const debut = ancre ?? cible;
        setAncre(debut);
        setCurseur(cible);
        appliquerPlage(debut, cible);
      }
      return;
    }
    // Raccourcis « Z » (décaler d'un mois en arrière) / « X » (d'un mois en avant) sur la plage,
    // et « Maj + Z / Maj + X » pour ÉTENDRE la plage d'un mois (au lieu de la décaler).
    if ((e.key === "z" || e.key === "Z" || e.key === "x" || e.key === "X") && !e.ctrlKey && !e.metaKey) {
      const estZ = e.key === "z" || e.key === "Z";
      const idGest = e.shiftKey
        ? ID_RACCOURCI.grapheZXMaj
        : estZ
          ? ID_RACCOURCI.grapheZ
          : ID_RACCOURCI.grapheX;
      if (!estRaccourciActif(idGest)) return;
      e.preventDefault();
      const delta = estZ ? -1 : 1;
      if (e.shiftKey) handleEtendrePlage(delta);
      else handleDecalerPlage(delta);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!estRaccourciActif(ID_RACCOURCI.grapheFleches)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const prochain = Math.min(points.length - 1, Math.max(0, index + delta));
    if (prochain === index) return;

    setCurseur(prochain);
    boutonsRef.current[prochain]?.focus();

    if (e.shiftKey && estRaccourciActif(ID_RACCOURCI.grapheFlechesMaj)) {
      const base = ancre ?? index;
      setAncre(base);
      appliquerPlage(base, prochain);
    } else {
      setAncre(prochain);
      onSelectMonths([points[prochain].cle]);
    }
  };

  const handleFocusMois = (index: number) => {
    setCurseur(index);
    setAncre((a) => (a === null ? index : a));
  };

  const handleExportPng = () => {
    exportAlertesChartImage(
      points.map((p) => ({ cle: p.cle, label: p.label, count: p.count })),
      {
        highlightCles: moisSelectionnes,
        moisAffiches,
        totalToutesFenetres,
        resume: resumeTexte,
        plageDansNom: pngNomAvecPlage,
      },
    );
  };

  // Bascule le format du nom du fichier PNG (avec ou sans la plage de mois) et le mémorise localement.
  const handleToggleNomPng = () => {
    const valeur = !pngNomAvecPlage;
    setPngNomAvecPlage(valeur);
    ecrireRecapAlertesPngNomPlage(valeur);
  };

  return (
    <div className="px-5 py-4 border-b border-background-200 bg-background-50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className="ri-bar-chart-2-line text-accent-600"></i>
          Alertes envoyées par mois
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-foreground-500">
              <strong className="text-foreground-900">{totalPeriode}</strong> alerte{totalPeriode > 1 ? "s" : ""} sur la période
            </span>
            <span
              className="inline-flex items-center gap-1 text-foreground-500"
              title="Cumul de toutes les alertes chargées, toutes fenêtres confondues"
            >
              <i className="ri-stack-line text-accent-500"></i>
              <strong className="text-foreground-900">{totalToutesFenetres}</strong> au total (toutes fenêtres)
            </span>
            <span className="text-foreground-500">
              {moisAvecActivite} mois actif{moisAvecActivite > 1 ? "s" : ""}
            </span>
          </span>
          <span className="relative inline-flex group/png">
            <button
              type="button"
              onClick={handleExportPng}
              aria-label={`Exporter le graphe des alertes par mois au format PNG — fichier : ${nomPngPrevu}`}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            >
              <i className="ri-download-2-line"></i>
              Exporter PNG
            </button>
            <span className="pointer-events-none absolute right-0 top-full mt-1.5 z-20 hidden group-hover/png:block whitespace-nowrap rounded-md border border-background-300 bg-foreground-950 text-background-50 text-[10px] font-medium px-2 py-1">
              <i className="ri-image-line mr-1"></i>
              {nomPngPrevu}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={pngNomAvecPlage}
            onClick={handleToggleNomPng}
            title={
              pngNomAvecPlage
                ? "Le nom du fichier PNG inclut la plage de mois filtrée — cliquez pour l'enlever"
                : "Le nom du fichier PNG n'inclut pas la plage de mois — cliquez pour l'ajouter"
            }
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className={pngNomAvecPlage ? "ri-bookmark-2-fill text-accent-600" : "ri-bookmark-line text-foreground-400"}></i>
            Nom PNG&nbsp;: {pngNomAvecPlage ? "avec plage" : "sans plage"}
          </button>
          {typeof onMoisAffichesChange === "function" && (
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {RECAP_ALERTES_GRAPHE_MOIS_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMoisAffichesChange(m)}
                  aria-pressed={moisAffiches === m}
                  title={`Afficher les ${m} derniers mois sur le graphe`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    moisAffiches === m ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {m} mois
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-end gap-2 h-20"
        role="group"
        aria-label="Nombre d'alertes artisan envoyées par mois — utilisez les flèches pour naviguer, Maj + flèches pour une plage, Origine / Fin pour le premier / dernier mois, Page précédente / suivante pour ramener la plage sur le mois en cours, touche T pour aujourd'hui, touches Z / X pour décaler la plage d'un mois, Maj + Z / Maj + X pour étendre la plage d'un mois, touche Suppr pour vider la sélection"
      >
        {points.map((p, index) => {
          const hauteur = p.count <= 0 ? 3 : Math.max(8, Math.round((p.count / max) * 72));
          const selectionne = selectionSet.has(p.cle);
          const estAncre = ancre === index;
          const estCurseur = curseur === index;
          // Surlignage : ancrage (bordure foncée) et curseur (bordure médiane) distincts des
          // autres mois de la plage (halo clair) pour se repérer pendant la navigation au clavier.
          const ringCls =
            estCurseur && !estAncre
              ? "ring-2 ring-accent-500 ring-offset-1 ring-offset-background-50"
              : estAncre
                ? "ring-2 ring-accent-900 ring-offset-1 ring-offset-background-50"
                : selectionne
                  ? "ring-2 ring-accent-300 ring-offset-1 ring-offset-background-50"
                  : "";
          const barColorCls =
            p.count > 0
              ? estAncre && estCurseur
                ? "bg-accent-700"
                : estAncre
                  ? "bg-accent-700 group-hover/mois:bg-accent-700"
                  : estCurseur
                    ? "bg-accent-600 group-hover/mois:bg-accent-600"
                    : selectionne
                      ? "bg-accent-500 group-hover/mois:bg-accent-600"
                      : "bg-accent-400 group-hover/mois:bg-accent-600"
              : selectionne || estAncre || estCurseur
                ? "bg-background-500"
                : "bg-background-300 group-hover/mois:bg-background-400";
          return (
            <button
              key={p.cle}
              type="button"
              ref={(el) => {
                boutonsRef.current[index] = el;
              }}
              onClick={(e) =>
                handleClicMois(
                  p.cle,
                  (e.ctrlKey || e.metaKey) && estRaccourciActif(ID_RACCOURCI.grapheCtrlClic),
                  index,
                )
              }
              onKeyDown={(e) => handleKeyDownMois(index, e)}
              onFocus={() => handleFocusMois(index)}
              disabled={!cliquable}
              aria-pressed={cliquable ? selectionne : undefined}
              title={
                cliquable
                  ? `${p.label} · ${p.count} alerte${p.count > 1 ? "s" : ""} — cliquer pour filtrer ce mois, Ctrl + clic ou Maj + flèches pour une plage`
                  : `${p.label} · ${p.count} alerte${p.count > 1 ? "s" : ""}`
              }
              className={`group/mois relative flex-1 min-w-0 flex flex-col items-center justify-end h-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-background-50 ${
                cliquable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`flex items-center justify-center gap-0.5 text-[9px] font-bold mb-1 tabular-nums ${
                  selectionne || estAncre || estCurseur ? "text-accent-700" : "text-foreground-500"
                }`}
              >
                {estAncre && !estCurseur && (
                  <i className="ri-map-pin-2-fill text-accent-900" title="Mois d'ancrage de la plage" aria-hidden="true"></i>
                )}
                {estCurseur && (
                  <i className="ri-focus-3-line text-accent-600" title="Curseur clavier" aria-hidden="true"></i>
                )}
                <span>{p.count}</span>
              </span>
              <span
                className={`w-full max-w-[34px] rounded-t-sm rounded-b-sm transition-colors ${barColorCls} ${ringCls}`}
                style={{ height: `${hauteur}px` }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-foreground-400">
        {points.map((p) => (
          <span
            key={`l-${p.cle}`}
            className={`flex-1 min-w-0 text-center capitalize truncate ${
              selectionSet.has(p.cle) ? "text-accent-700 font-semibold" : ""
            }`}
          >
            {p.label}
          </span>
        ))}
      </div>

      {cliquable && (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-foreground-400">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-keyboard-line"></i>
              Flèches ← → pour naviguer, Origine / Fin pour le 1ᵉʳ / dernier mois, T pour aujourd'hui, Z / X pour décaler la plage d'un mois, Maj + Z / X pour l'étendre, Suppr (ou Échap) pour vider la sélection
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-map-pin-2-fill text-accent-900"></i>
              mois d'ancrage
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-focus-3-line text-accent-600"></i>
              curseur
            </span>
            <button
              type="button"
              onClick={() => setGestesOuvert((o) => !o)}
              aria-expanded={gestesOuvert}
              title="Afficher la liste complète des raccourcis clavier du graphe"
              className="inline-flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-full bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
            >
              <i className="ri-question-line text-accent-600"></i>
              Gestes clavier
              <i className={gestesOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
            </button>
          </div>
          {gestesOuvert && (
            <div className="mt-2 rounded-lg border border-background-200 bg-background-100 px-3 py-2.5 animate-fade-in">
              <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide mb-2">
                Tous les raccourcis du graphe
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
                {GESTES_CLAVIER.map((g) => (
                  <div key={g.desc} className="flex items-center gap-2 text-[11px] text-foreground-600">
                    <span className="flex items-center gap-1 shrink-0">
                      {g.touches.map((t, i) => (
                        <span key={`${g.desc}-${i}`} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-foreground-300 text-[9px]">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-background-300 bg-background-50 text-[10px] font-semibold text-foreground-700">
                            {t}
                          </kbd>
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0">{g.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}