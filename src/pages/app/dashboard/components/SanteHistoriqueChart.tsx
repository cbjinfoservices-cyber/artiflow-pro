import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SanteHistoriquePoint } from "@/hooks/useSanteHistorique";
import { toCsv, downloadCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { SEUILS_SANTE, lireSeuilSante, ecrireSeuilSante } from "@/lib/santeSeuil";
import {
  lireDerniereSemaineConsultee,
  ecrireDerniereSemaineConsultee,
  type DerniereSemaineConsultee,
} from "@/lib/santeSemaine";
import {
  lireSemaineEpinglee,
  basculerSemaineEpinglee,
  lireFiltreSousSeuil,
  ecrireFiltreSousSeuil,
  SANTE_EPINGLE_EVENT,
  SANTE_SOUSSEUIL_EVENT,
} from "@/lib/santeSurveillance";

interface Props {
  /** Les 12 derniers points de score, du plus ancien au plus récent. */
  points: SanteHistoriquePoint[];
  /** Écart de score (en points) entre la semaine la plus ancienne et la semaine en cours. */
  tendance: number | null;
}

/** Libellé court d'une semaine (« 8 sept. »). */
function semaineLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Mini-graphe de la tendance du score de « Santé du compte » sur les 12 dernières semaines :
 * une barre par semaine, la semaine en cours mise en avant, avec l'écart global rappelé en tête.
 * Chaque barre est cliquable et ouvre, au choix, les relances ou la comptabilité de la semaine
 * concernée. Le seuil d'alerte du score se règle ici (partagé avec le bandeau d'alerte), et
 * l'historique complet s'exporte en CSV pour archivage.
 */
export default function SanteHistoriqueChart({ points, tendance }: Props) {
  const navigate = useNavigate();
  const ameliore = tendance !== null && tendance > 0;
  const recule = tendance !== null && tendance < 0;
  const premier = points[0];
  const dernier = points[points.length - 1];
  const aEstime = points.some((p) => !p.reel);

  // -- États (déclarés avant les calculs dérivés qui les lisent) --
  // Semaine dont le menu d'actions est ouvert (null = aucun menu).
  const [semaineOuverte, setSemaineOuverte] = useState<string | null>(null);
  // Seuil d'alerte du score, réglable ici et partagé avec le bandeau d'alerte.
  const [seuil, setSeuil] = useState<number>(() => lireSeuilSante());
  // Dernière semaine consultée (mémorisée) : reproposée en raccourci « Reprendre » à la prochaine visite.
  const [derniereConsult, setDerniereConsult] = useState<DerniereSemaineConsultee | null>(() =>
    lireDerniereSemaineConsultee(),
  );
  // Navigation clavier des barres : index de la barre focus (roving tabindex type « toolbar »).
  const [barFocus, setBarFocus] = useState(0);
  const barRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Semaine épinglée « à surveiller » : repère visuel permanent sur sa barre (préférence locale).
  const [epinglee, setEpinglee] = useState<string | null>(() => lireSemaineEpinglee());
  // Filtre « semaines sous le seuil » : n'éclairer que les semaines problématiques.
  const [filtreSousSeuil, setFiltreSousSeuil] = useState<boolean>(() => lireFiltreSousSeuil());
  // Survol du mini-graphe : affiche l'infobulle « barre au clavier » rappelant le raccourci Entrée.
  const [survolGraphe, setSurvolGraphe] = useState(false);

  // Meilleure semaine du score (le « record ») : score le plus élevé de la fenêtre affichée.
  // Marquée d'un trophée sur sa barre, comme sur le mini-graphe des remplacements.
  const record = useMemo(() => {
    let max = 0;
    points.forEach((p) => {
      if (p.score > max) max = p.score;
    });
    return max;
  }, [points]);

  // Rang de chaque semaine (1 = meilleure) : les semaines à score égal partagent le même rang.
  const rangs = useMemo(() => {
    const tries = points.map((p) => p.score).slice().sort((a, b) => b - a);
    const map = new Map<string, number>();
    points.forEach((p) => map.set(p.semaine, tries.indexOf(p.score) + 1));
    return map;
  }, [points]);

  // Nombre de semaines de la fenêtre dont le score est sous le seuil d'alerte (pour le filtre).
  const nbSousSeuil = useMemo(() => points.filter((p) => p.score < seuil).length, [points, seuil]);

  // Raccourci « Reprendre la semaine du X » : seulement si la semaine mémorisée est encore
  // dans la fenêtre affichée (sinon le raccourci n'a plus de barre à laquelle se rattacher).
  const resume =
    derniereConsult && points.some((p) => p.semaine === derniereConsult.semaine) ? derniereConsult : null;

  // Suit les préférences de surveillance si elles changent (même page ou autre onglet).
  useEffect(() => {
    const syncEpingle = () => setEpinglee(lireSemaineEpinglee());
    const syncFiltre = () => setFiltreSousSeuil(lireFiltreSousSeuil());
    window.addEventListener(SANTE_EPINGLE_EVENT, syncEpingle);
    window.addEventListener(SANTE_SOUSSEUIL_EVENT, syncFiltre);
    window.addEventListener("storage", syncEpingle);
    window.addEventListener("storage", syncFiltre);
    return () => {
      window.removeEventListener(SANTE_EPINGLE_EVENT, syncEpingle);
      window.removeEventListener(SANTE_SOUSSEUIL_EVENT, syncFiltre);
      window.removeEventListener("storage", syncEpingle);
      window.removeEventListener("storage", syncFiltre);
    };
  }, []);

  /** Déplace le focus clavier vers la barre voulue (bornée à la fenêtre affichée). */
  const focusBar = (index: number) => {
    const cible = Math.max(0, Math.min(points.length - 1, index));
    setBarFocus(cible);
    barRefs.current[cible]?.focus();
  };

  /** Navigation clavier : flèches pour changer de semaine, Entrée/Espace pour ouvrir, Échap pour fermer. */
  const onBarKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number, semaine: string) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusBar(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusBar(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusBar(0);
        break;
      case "End":
        e.preventDefault();
        focusBar(points.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setSemaineOuverte(semaineOuverte === semaine ? null : semaine);
        break;
      case "Escape":
        setSemaineOuverte(null);
        break;
      default:
        break;
    }
  };

  /** Ouvre la page demandée pour la semaine concernée (relances ou comptabilité). */
  const ouvrir = (semaine: string, cible: "relances" | "comptabilite") => {
    setSemaineOuverte(null);
    // Retient la semaine et la vue choisies pour reproposer un raccourci à la prochaine visite.
    const consult: DerniereSemaineConsultee = { semaine, cible };
    setDerniereConsult(consult);
    ecrireDerniereSemaineConsultee(consult);
    if (cible === "relances") {
      // Réutilise la vue « Déjà traitées » filtrée sur la semaine (paramètre déjà pris en charge).
      navigate(`/app/relances-programmees?statut=all&semaine=${semaine}`);
    } else {
      // Espace comptable pré-filtré sur la plage lundi → dimanche de la semaine concernée.
      navigate(`/app/comptabilite?semaine=${semaine}`);
    }
  };

  /** Change le seuil d'alerte du score et le mémorise pour la prochaine visite. */
  const changerSeuil = (value: number) => {
    setSeuil(value);
    ecrireSeuilSante(value);
  };

  /** Épingle une semaine à surveiller (ou la détache) : pose un repère permanent sur sa barre. */
  const basculerEpinglage = (semaine: string) => {
    setEpinglee(basculerSemaineEpinglee(semaine));
    setSemaineOuverte(null);
  };

  /** Active ou désactive le filtre « semaines sous le seuil ». */
  const basculerFiltre = () => {
    const suivant = !filtreSousSeuil;
    setFiltreSousSeuil(suivant);
    ecrireFiltreSousSeuil(suivant);
  };

  /** Exporte l'historique du score (12 semaines) en CSV pour archivage. */
  const exporterCsv = () => {
    const headers = [
      "Semaine (lundi)",
      "Semaine",
      "Score (/100)",
      "Source",
      "Record",
      "Rang (1 = meilleure)",
      "Épinglée",
      "Sous le seuil",
    ];
    const rows = points.map((p) => [
      p.semaine,
      semaineLabel(p.semaine),
      p.score,
      p.reel ? "Enregistré" : "Estimé",
      record > 0 && p.score === record ? "Record" : "",
      rangs.get(p.semaine) ?? "",
      epinglee === p.semaine ? "Oui" : "",
      p.score < seuil ? "Oui" : "",
    ]);
    downloadCsv(`sante-score-12-semaines-${todayISO()}.csv`, toCsv(headers, rows));
  };

  return (
    <div className="rounded-md bg-background-50 border border-background-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className="ri-line-chart-line"></i>
          Tendance du score · 12 semaines
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {resume && (
            <button
              type="button"
              onClick={() => ouvrir(resume.semaine, resume.cible)}
              title={`Rouvrir ${resume.cible === "relances" ? "les relances" : "la comptabilité"} de la semaine du ${semaineLabel(resume.semaine)} (dernière consultée)`}
              className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-accent-100 border border-accent-300 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
            >
              <i className="ri-history-line"></i>
              Reprendre : {semaineLabel(resume.semaine)}
              <span className="text-accent-600">· {resume.cible === "relances" ? "Relances" : "Comptabilité"}</span>
            </button>
          )}
          {tendance !== null && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                ameliore
                  ? "bg-accent-100 text-accent-800"
                  : recule
                    ? "bg-secondary-100 text-secondary-800"
                    : "bg-background-200 text-foreground-600"
              }`}
              title="Évolution du score entre la semaine la plus ancienne et la semaine en cours"
            >
              <i className={ameliore ? "ri-arrow-up-line" : recule ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
              {tendance > 0 ? "+" : ""}
              {tendance} pts
            </span>
          )}
          <label
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap"
            title="Alerte si le score reste sous ce seuil deux semaines de suite"
          >
            <i className="ri-alarm-warning-line"></i>
            <span className="text-foreground-400">Seuil</span>
            <select
              value={seuil}
              onChange={(e) => changerSeuil(Number(e.target.value))}
              className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
            >
              {SEUILS_SANTE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {/* Compteur : nombre de semaines de la fenêtre sous le seuil réglé (rappelé ici,
                dans le panneau Santé du compte, sans devoir activer le filtre). */}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                nbSousSeuil > 0 ? "bg-secondary-500 text-background-50" : "bg-background-200 text-foreground-500"
              }`}
              title={
                nbSousSeuil > 0
                  ? `${nbSousSeuil} semaine${nbSousSeuil > 1 ? "s" : ""} sous le seuil de ${seuil}/100`
                  : `Aucune semaine sous le seuil de ${seuil}/100`
              }
              aria-label={
                nbSousSeuil > 0
                  ? `${nbSousSeuil} semaines sous le seuil de ${seuil} sur 100`
                  : `Aucune semaine sous le seuil de ${seuil} sur 100`
              }
            >
              {nbSousSeuil}
            </span>
          </label>
          <button
            type="button"
            onClick={basculerFiltre}
            aria-pressed={filtreSousSeuil}
            title={
              filtreSousSeuil
                ? `Filtre actif : n'affiche que les ${nbSousSeuil} semaine(s) sous ${seuil}/100`
                : `N'éclairer que les semaines dont le score est sous le seuil (${nbSousSeuil})`
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filtreSousSeuil
                ? "bg-secondary-500 border-secondary-500 text-background-50 hover:bg-secondary-600"
                : "bg-background-100 border-background-200 text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-filter-3-line"></i>
            Sous le seuil
          </button>
          <button
            type="button"
            onClick={exporterCsv}
            title="Télécharger l'historique du score (12 semaines) en CSV"
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-download-2-line"></i>
            CSV
          </button>
        </div>
      </div>

      <div
        className="relative flex items-end gap-1 h-24"
        role="toolbar"
        onMouseEnter={() => setSurvolGraphe(true)}
        onMouseLeave={() => setSurvolGraphe(false)}
        aria-label="Tendance du score sur 12 semaines : utilisez les flèches pour changer de semaine, puis Entrée pour l'ouvrir"
      >
        {/* Infobulle « barre au clavier » : rappelle le raccourci Entrée au survol du mini-graphe. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-950/90 text-background-50 text-[10px] font-semibold whitespace-nowrap transition-opacity duration-150 ${
            survolGraphe ? "opacity-100" : "opacity-0"
          }`}
        >
          <i className="ri-keyboard-line"></i>
          Au clavier : flèches puis Entrée pour ouvrir
        </span>
        {points.map((p, i) => {
          const hauteur = Math.max((p.score / 100) * 82, 4);
          const enCours = i === points.length - 1;
          const ouvert = semaineOuverte === p.semaine;
          const estRecord = record > 0 && p.score === record;
          const estEpinglee = epinglee === p.semaine;
          // Filtre « sous le seuil » : on estompe les semaines qui ne sont pas problématiques.
          const estompe = filtreSousSeuil && p.score >= seuil;
          // Menu ancré à droite sur la moitié droite du graphe, pour ne pas déborder de la carte.
          const aDroite = i >= points.length / 2;
          const libelle = semaineLabel(p.semaine);
          return (
            <div
              key={p.semaine}
              className="relative flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              {/* Repère « à surveiller » : épingle permanente sur la semaine épinglée par l'artisan */}
              {estEpinglee && (
                <span
                  className="absolute top-0 left-0 z-20 w-4 h-4 flex items-center justify-center rounded-full bg-secondary-500 text-background-50 ring-1 ring-background-50"
                  title={`Semaine épinglée à surveiller : ${p.score}/100. Ouvrez son menu puis « Détacher la semaine » pour retirer le repère.`}
                >
                  <i className="ri-pushpin-2-fill text-[9px]"></i>
                </span>
              )}
              {/* Badge « record » : marque la meilleure semaine du score (trophée au-dessus de la barre) */}
              {estRecord && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 z-20 w-4 h-4 flex items-center justify-center rounded-full bg-accent-500 text-background-50 ring-1 ring-background-50"
                  style={{ bottom: `calc(${hauteur}% + 2px)` }}
                  title={`Semaine record : ${p.score}/100 (meilleure semaine des 12 dernières)`}
                >
                  <i className="ri-award-line text-[9px]"></i>
                </span>
              )}
              <button
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                type="button"
                tabIndex={i === barFocus ? 0 : -1}
                onClick={() => setSemaineOuverte(ouvert ? null : p.semaine)}
                onKeyDown={(e) => onBarKeyDown(e, i, p.semaine)}
                onFocus={() => setBarFocus(i)}
                aria-haspopup="true"
                aria-expanded={ouvert}
                className={`w-full flex flex-col justify-end h-full cursor-pointer group focus-visible:outline-none transition-opacity ${
                  estompe ? "opacity-25" : ""
                }`}
                title={`${libelle} · score ${p.score}/100${p.reel ? "" : " (estimé d'après vos échecs d'envoi)"}${estEpinglee ? " · épinglée à surveiller" : ""} · cliquer pour ouvrir la semaine`}
                aria-label={`Semaine du ${libelle}, score ${p.score} sur 100, rang ${rangs.get(p.semaine)} sur ${points.length}${estEpinglee ? ", épinglée à surveiller" : ""}. Ouvrir les relances ou la comptabilité de cette semaine.`}
              >
                <span
                  className={`w-full rounded-t-sm transition-all group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-primary-400 group-focus-visible:ring-offset-1 ${
                    enCours ? "bg-accent-500" : p.reel ? "bg-primary-500" : "bg-primary-300"
                  } ${ouvert ? "ring-2 ring-primary-400" : estEpinglee ? "ring-2 ring-secondary-400" : ""}`}
                  style={{ height: `${hauteur}%` }}
                ></span>
              </button>

              {ouvert && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Fermer le menu de la semaine"
                    onClick={() => setSemaineOuverte(null)}
                    className="fixed inset-0 z-40 cursor-default"
                  ></button>
                  <div
                    role="menu"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setSemaineOuverte(null);
                      }
                    }}
                    className={`absolute z-50 top-full mt-1.5 w-52 p-2 rounded-md bg-background-50 border border-background-200 flex flex-col gap-1 ${
                      aDroite ? "right-0" : "left-0"
                    }`}
                  >
                    <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Semaine du {libelle} · {p.score}/100
                    </p>
                    <button
                      type="button"
                      onClick={() => ouvrir(p.semaine, "relances")}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                    >
                      <i className="ri-notification-3-line"></i>
                      Relances de la semaine
                    </button>
                    <button
                      type="button"
                      onClick={() => ouvrir(p.semaine, "comptabilite")}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    >
                      <i className="ri-file-chart-line"></i>
                      Comptabilité de la semaine
                    </button>
                    <button
                      type="button"
                      onClick={() => basculerEpinglage(p.semaine)}
                      title={
                        estEpinglee
                          ? "Retirer le repère « à surveiller » de cette semaine"
                          : "Épingler cette semaine à surveiller (repère permanent sur sa barre)"
                      }
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        estEpinglee
                          ? "bg-secondary-500 text-background-50 hover:bg-secondary-600"
                          : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className={estEpinglee ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                      {estEpinglee ? "Détacher la semaine" : "Épingler à surveiller"}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] text-foreground-400">
        <span>{premier ? semaineLabel(premier.semaine) : ""}</span>
        {aEstime ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-primary-500"></span>
              Enregistré
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-primary-300"></span>
              Estimé
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-accent-500"></span>
            Cette semaine
          </span>
        )}
        <span>Cette semaine{dernier ? ` · ${semaineLabel(dernier.semaine)}` : ""}</span>
      </div>

      <p className="mt-1.5 text-[10px] text-foreground-400 flex items-center gap-1">
        <i className="ri-cursor-line"></i>
        Cliquez une barre — ou au clavier, déplacez-vous avec les flèches puis Entrée — pour ouvrir les relances ou
        la comptabilité de cette semaine.
      </p>
      {record > 0 && (
        <p className="mt-0.5 text-[10px] text-foreground-400 flex items-center gap-1">
          <i className="ri-award-line text-accent-600"></i>
          Barre au trophée = votre semaine record (score le plus haut sur 12 semaines : {record}/100).
        </p>
      )}
      {epinglee && (
        <p className="mt-0.5 text-[10px] text-foreground-400 flex items-center gap-1">
          <i className="ri-pushpin-2-fill text-secondary-600"></i>
          Barre au repère = semaine épinglée à surveiller. Ouvrez son menu puis « Détacher la semaine » pour retirer le
          repère.
        </p>
      )}
      {filtreSousSeuil && (
        <p className="mt-0.5 text-[10px] text-foreground-400 flex items-center gap-1">
          <i className="ri-filter-3-line text-secondary-600"></i>
          Filtre « sous le seuil » actif : les {nbSousSeuil} semaine{nbSousSeuil > 1 ? "s" : ""} sous {seuil}/100
          restent éclairées, les autres sont estompées.
        </p>
      )}
    </div>
  );
}