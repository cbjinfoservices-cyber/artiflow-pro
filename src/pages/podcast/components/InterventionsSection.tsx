import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Toast from "@/components/base/Toast";
import InterventionsCarte from "@/pages/podcast/components/InterventionsCarte";
import { useFiltreUrl } from "@/pages/podcast/components/useFiltreUrl";
import { cleArtiflow, v } from "@/lib/stockageLocal";
import {
  interventionsPubliques,
  formatsIntervention,
  compteParFormat,
  intervenantsIntervention,
  compteParIntervenant,
  lieuxIntervention,
  compteParLieu,
  estEnLigne,
  iconesFormat,
} from "@/mocks/interventions";
import type { InterventionPublique, FormatIntervention } from "@/mocks/interventions";
import { lienInterventionPartage } from "@/lib/interventions";
import { lienVueMedia } from "@/lib/media";
import { episodesPodcast } from "@/mocks/podcasts";

const toneBadge: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

// Filtres de la section : format, intervenant et tri sont pilotés par l'URL
// (`?format=…`, `?intervenant=…`, `?tri=…`) *et* mémorisés, pour transmettre une
// combinaison exacte. Le lieu, lui, est partagé au niveau de la page. Les
// validateurs restent stables (définis au niveau du module).
const CLE_FORMAT_INTERVENTION = cleArtiflow("podcast", "formatInterventions");
const CLE_INTERVENANT_INTERVENTION = cleArtiflow("podcast", "intervenantInterventions");
const CLE_TRI_INTERVENTION = cleArtiflow("podcast", "triInterventions");

const FORMATS_INTERVENTION_VALIDES: (FormatIntervention | "tous")[] = ["tous", ...formatsIntervention];
const formatInterventionValide = v.enumeration<FormatIntervention | "tous">(
  FORMATS_INTERVENTION_VALIDES,
  "tous"
);

const IDS_INTERVENANTS: string[] = intervenantsIntervention.map((intervenant) => intervenant.id);
const intervenantInterventionValide = v.enumeration<string>(["tous", ...IDS_INTERVENANTS], "tous");

const TRI_INTERVENTION_VALIDE = v.enumeration<"recent" | "ancien">(["recent", "ancien"], "recent");

function InterventionCard({
  intervention,
  onCopier,
}: {
  intervention: InterventionPublique;
  onCopier: (intervention: InterventionPublique) => void;
}) {
  return (
    <article
      id={intervention.id}
      className="group flex flex-col rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors overflow-hidden scroll-mt-32"
    >
      <div className="relative w-full h-48 overflow-hidden bg-background-100">
        <img
          src={intervention.thumbnailUrl}
          alt={`${intervention.format} · ${intervention.title} - prise de parole de l'équipe ArtiFlow-pro`}
          title={`${intervention.title} · ArtiFlow-pro`}
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${toneBadge[intervention.tone]}`}>
          <i className={intervention.icon}></i>
          {intervention.format}
        </span>
        <button
          type="button"
          onClick={() => onCopier(intervention)}
          title="Copier le lien de cette intervention"
          aria-label={`Copier le lien de « ${intervention.title} »`}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-background-50/90 text-foreground-700 border border-background-200 hover:bg-background-50 hover:text-primary-700 transition-colors cursor-pointer"
        >
          <i className="ri-link"></i>
        </button>
      </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-700">
            <i className="ri-broadcast-line"></i>
            {intervention.event}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-calendar-line"></i>
            {intervention.date}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className={estEnLigne(intervention.location) ? "ri-global-line" : "ri-map-pin-line"}></i>
            {intervention.location}
          </span>
        </div>

        <h3 className="mt-3 font-heading font-semibold text-base md:text-lg text-foreground-950 leading-snug">
          {intervention.title}
        </h3>
        <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">
          {intervention.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <Link
            to={`/auteurs/${intervention.speakerId}`}
            title={`Voir la page de ${intervention.speaker}`}
            className="inline-flex items-center gap-1.5 text-foreground-700 hover:text-primary-700 transition-colors cursor-pointer"
          >
            <i className="ri-user-voice-line"></i>
            {intervention.speaker}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-foreground-500">
            <i className="ri-time-line"></i>
            {intervention.duration}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <a
            href={intervention.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Voir la rediffusion
            <i className="ri-play-circle-line"></i>
          </a>
          <button
            type="button"
            onClick={() => onCopier(intervention)}
            title="Copier le lien de cette intervention"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors"
          >
            <i className="ri-link"></i>
            Copier le lien
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Section « Interventions publiques » de la page Média : les conférences,
 * webinaires, tables rondes, masterclasses et interviews de l'équipe, avec la
 * rediffusion vidéo reliée à chaque prise de parole.
 *
 * Trois filtres, placés en tête de section, permettent de croiser la recherche :
 * par format (conférence, webinaire, table ronde…), par intervenant (membre de
 * l'équipe) et par lieu (ville en présentiel ou « En ligne »). Le lieu est partagé
 * avec le reste de la page Média : pilotable depuis la carte, retrouvé tel quel à
 * la prochaine visite et transmissible par URL (`?lieu=Lyon`). Format, intervenant
 * et tri sont eux aussi portés par l'URL (`?format=…&intervenant=…&tri=…`) *et*
 * mémorisés, ce qui permet de partager une combinaison exacte via le bouton
 * « Copier le lien de cette ville ». Un récap « N interventions · M épisodes »
 * coiffe la carte pour résumer la ville choisie. Chaque carte garde son ancre dédiée
 * (`#id-intervention`) pour être ciblable depuis le plan du site, les fiches
 * intervenants ou le sitemap, et propose un bouton « copier le lien » pour partager
 * une prise de parole précise.
 */
type InterventionsSectionProps = {
  /** Lieu actif, partagé avec les épisodes, la carte et l'URL (`?lieu=…`). */
  lieuActif: string;
  /** Change le lieu actif : met à jour l'URL et la mémoire de la page. */
  onLieuChange: (lieu: string) => void;
};

export default function InterventionsSection({ lieuActif, onLieuChange }: InterventionsSectionProps) {
  const [formatActif, setFormatActif] = useFiltreUrl({
    cle: CLE_FORMAT_INTERVENTION,
    parametre: "format",
    valider: formatInterventionValide,
    defaut: "tous",
    estValide: (valeur) => (FORMATS_INTERVENTION_VALIDES as string[]).includes(valeur),
  });
  const [intervenantActif, setIntervenantActif] = useFiltreUrl({
    cle: CLE_INTERVENANT_INTERVENTION,
    parametre: "intervenant",
    valider: intervenantInterventionValide,
    defaut: "tous",
    estValide: (valeur) => (IDS_INTERVENANTS as string[]).includes(valeur),
  });
  const [tri, setTri] = useFiltreUrl({
    cle: CLE_TRI_INTERVENTION,
    parametre: "tri",
    valider: TRI_INTERVENTION_VALIDE,
    defaut: "recent",
    estValide: (valeur) => valeur === "recent" || valeur === "ancien",
  });
  const [toast, setToast] = useState<string | null>(null);

  const interventionsFiltrees = useMemo(() => {
    const filtrees = interventionsPubliques.filter(
      (intervention) =>
        (formatActif === "tous" || intervention.format === formatActif) &&
        (intervenantActif === "tous" || intervention.speakerId === intervenantActif) &&
        (lieuActif === "tous" || intervention.location === lieuActif)
    );
    return [...filtrees].sort((a, b) =>
      tri === "recent"
        ? b.dateISO.localeCompare(a.dateISO)
        : a.dateISO.localeCompare(b.dateISO)
    );
  }, [formatActif, intervenantActif, lieuActif, tri]);

  const intervenantNom =
    intervenantActif === "tous"
      ? null
      : intervenantsIntervention.find((i) => i.id === intervenantActif)?.name ?? null;

  // Récap de la ville choisie : interventions et épisodes associés à ce lieu
  // (toutes villes confondues lorsque le filtre est sur « tous »).
  const statsLieu = useMemo(() => {
    const interventions = interventionsPubliques.filter(
      (intervention) => lieuActif === "tous" || intervention.location === lieuActif
    ).length;
    const episodes = episodesPodcast.filter(
      (episode) => lieuActif === "tous" || episode.location === lieuActif
    ).length;
    return { interventions, episodes };
  }, [lieuActif]);

  const copierLien = async (intervention: InterventionPublique) => {
    try {
      await navigator.clipboard.writeText(lienInterventionPartage(intervention.id));
      setToast(`Lien de « ${intervention.title} » copié`);
    } catch {
      setToast("Impossible de copier le lien pour le moment");
    }
  };

  // Copie le lien de la vue filtrée : lieu + format + intervenant + tri, pour
  // transmettre en un clic la combinaison exacte affichée à l'écran.
  const copierLienVille = async () => {
    try {
      await navigator.clipboard.writeText(
        lienVueMedia({ lieu: lieuActif, format: formatActif, intervenant: intervenantActif, tri })
      );
      setToast(lieuActif === "tous" ? "Lien de la vue copié" : `Lien de « ${lieuActif} » copié`);
    } catch {
      setToast("Impossible de copier le lien pour le moment");
    }
  };

  const reinitialiserFiltres = () => {
    setFormatActif("tous");
    setIntervenantActif("tous");
    onLieuChange("tous");
  };

  return (
    <section
      id="interventions-publiques"
      className="w-full bg-secondary-50 border-b border-background-200 scroll-mt-32"
    >
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
              <i className="ri-presentation-line"></i>
              Interventions publiques
            </span>
            <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
              Conférences & webinaires
            </h2>
            <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
              En dehors du micro, l'équipe intervient aussi sur scène et en ligne : keynotes, tables
              rondes, masterclasses et webinaires filmés, disponibles en rediffusion.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Nous inviter sur un événement
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        {/* Récap de la ville choisie : interventions et épisodes associés */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 rounded-lg bg-background-50 border border-background-200 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-900">
            <i
              className={
                lieuActif === "tous"
                  ? "ri-map-2-line text-accent-700"
                  : estEnLigne(lieuActif)
                    ? "ri-global-line text-accent-700"
                    : "ri-map-pin-line text-accent-700"
              }
            ></i>
            {lieuActif === "tous" ? "Toute la France" : lieuActif}
          </span>
          <span className="hidden sm:block w-px h-5 bg-background-200"></span>
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
            <i className="ri-presentation-line text-secondary-700"></i>
            <strong className="font-semibold text-foreground-900">{statsLieu.interventions}</strong>
            intervention{statsLieu.interventions > 1 ? "s" : ""}
          </span>
          <span className="text-foreground-300">·</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
            <i className="ri-mic-line text-primary-700"></i>
            <strong className="font-semibold text-foreground-900">{statsLieu.episodes}</strong>
            épisode{statsLieu.episodes > 1 ? "s" : ""}
          </span>
        </div>

        <InterventionsCarte lieuActif={lieuActif} onLieuChange={onLieuChange} />

        {/* Filtres : par format, puis par intervenant */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Filtre par format */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 mr-1">
              <i className="ri-filter-3-line"></i>
              Filtrer par format :
            </span>
            <button
              type="button"
              onClick={() => setFormatActif("tous")}
              aria-pressed={formatActif === "tous"}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                formatActif === "tous"
                  ? "bg-secondary-500 text-background-50"
                  : "bg-background-50 border border-background-200 text-foreground-700 hover:border-secondary-300"
              }`}
            >
              <i className="ri-stack-line"></i>
              Toutes
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  formatActif === "tous"
                    ? "bg-background-50/25 text-background-50"
                    : "bg-secondary-100 text-secondary-900"
                }`}
              >
                {interventionsPubliques.length}
              </span>
            </button>
            {formatsIntervention.map((format) => {
              const actif = formatActif === format;
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => setFormatActif(format)}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-secondary-500 text-background-50"
                      : "bg-background-50 border border-background-200 text-foreground-700 hover:border-secondary-300"
                  }`}
                >
                  <i className={iconesFormat[format]}></i>
                  {format}
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      actif
                        ? "bg-background-50/25 text-background-50"
                        : "bg-secondary-100 text-secondary-900"
                    }`}
                  >
                    {compteParFormat(format)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtre par intervenant */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 mr-1">
              <i className="ri-user-voice-line"></i>
              Filtrer par intervenant :
            </span>
            <button
              type="button"
              onClick={() => setIntervenantActif("tous")}
              aria-pressed={intervenantActif === "tous"}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                intervenantActif === "tous"
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              }`}
            >
              <i className="ri-group-line"></i>
              Tous
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  intervenantActif === "tous"
                    ? "bg-background-50/25 text-background-50"
                    : "bg-primary-100 text-primary-700"
                }`}
              >
                {intervenantsIntervention.length}
              </span>
            </button>
            {intervenantsIntervention.map((intervenant) => {
              const actif = intervenantActif === intervenant.id;
              return (
                <button
                  key={intervenant.id}
                  type="button"
                  onClick={() => setIntervenantActif(intervenant.id)}
                  aria-pressed={actif}
                  title={`Interventions de ${intervenant.name}`}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <i className="ri-user-line"></i>
                  {intervenant.name}
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      actif
                        ? "bg-background-50/25 text-background-50"
                        : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    {compteParIntervenant(intervenant.id)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtre par lieu */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 mr-1">
              <i className="ri-map-pin-2-line"></i>
              Filtrer par lieu :
            </span>
            <button
              type="button"
              onClick={() => onLieuChange("tous")}
              aria-pressed={lieuActif === "tous"}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                lieuActif === "tous"
                  ? "bg-accent-500 text-background-50"
                  : "bg-background-50 border border-background-200 text-foreground-700 hover:border-accent-300"
              }`}
            >
              <i className="ri-earth-line"></i>
              Tous les lieux
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  lieuActif === "tous"
                    ? "bg-background-50/25 text-background-50"
                    : "bg-accent-100 text-accent-900"
                }`}
              >
                {interventionsPubliques.length}
              </span>
            </button>
            {lieuxIntervention.map((lieu) => {
              const actif = lieuActif === lieu;
              const enLigne = estEnLigne(lieu);
              return (
                <button
                  key={lieu}
                  type="button"
                  onClick={() => onLieuChange(lieu)}
                  aria-pressed={actif}
                  title={enLigne ? "Interventions en ligne" : `Interventions à ${lieu}`}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-accent-500 text-background-50"
                      : "bg-background-50 border border-background-200 text-foreground-700 hover:border-accent-300"
                  }`}
                >
                  <i className={enLigne ? "ri-global-line" : "ri-map-pin-line"}></i>
                  {lieu}
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      actif
                        ? "bg-background-50/25 text-background-50"
                        : "bg-accent-100 text-accent-900"
                    }`}
                  >
                    {compteParLieu(lieu)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={copierLienVille}
              title="Copier le lien de cette ville"
              aria-label="Copier le lien de cette ville"
              className="ml-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
            >
              <i className="ri-link"></i>
              Copier le lien de cette ville
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-list-check"></i>
              {interventionsFiltrees.length} prise{interventionsFiltrees.length > 1 ? "s" : ""} de parole
            </span>
            {formatActif !== "tous" && <span>· format « {formatActif} »</span>}
            {intervenantNom && <span>· avec {intervenantNom}</span>}
            {lieuActif !== "tous" && <span>· à {lieuActif}</span>}
            {(formatActif !== "tous" || intervenantActif !== "tous" || lieuActif !== "tous") && (
              <button
                type="button"
                onClick={reinitialiserFiltres}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 font-semibold cursor-pointer hover:border-secondary-300 transition-colors"
              >
                <i className="ri-close-line"></i>
                Réinitialiser les filtres
              </button>
            )}
          </div>

          {/* Tri par date */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 whitespace-nowrap">
              <i className="ri-sort-desc"></i>
              Trier :
            </span>
            <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => setTri("recent")}
                aria-pressed={tri === "recent"}
                className={`inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  tri === "recent"
                    ? "bg-secondary-500 text-background-50"
                    : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-arrow-down-line"></i>
                Plus récentes
              </button>
              <button
                type="button"
                onClick={() => setTri("ancien")}
                aria-pressed={tri === "ancien"}
                className={`inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  tri === "ancien"
                    ? "bg-secondary-500 text-background-50"
                    : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-arrow-up-line"></i>
                Plus anciennes
              </button>
            </div>
          </div>
        </div>

        {interventionsFiltrees.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {interventionsFiltrees.map((intervention) => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                onCopier={copierLien}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-50">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
              <i className="ri-presentation-line"></i>
            </span>
            <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
              Aucune intervention pour cette combinaison
            </h3>
            <p className="mt-2 text-sm text-foreground-600 max-w-md">
              Essayez un autre format ou un autre intervenant, ou affichez de nouveau toutes les prises
              de parole.
            </p>
            <button
              type="button"
              onClick={reinitialiserFiltres}
              className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Voir toutes les interventions
            </button>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} icon="ri-link" />
      )}
    </section>
  );
}