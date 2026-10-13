import { useCallback, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import Toast from "@/components/base/Toast";
import {
  compterRecherchesRepliables,
  reinitialiserRecherchesRepliables,
} from "@/lib/rechercheRepliablePrefs";
import { ecrireSonActif, lireSonActif } from "@/lib/sonPrefsMemoire";
import { jouerSonEpingle } from "@/lib/sonInterface";
import {
  compterOrdresPersonnalises,
  reinitialiserOrdresPersonnalises,
} from "@/lib/ordresPersonnalisesPrefs";
import {
  reinitialiserToutPreferencesAffichage,
  restaurerEtatPreference,
  tempsRelatifPreference,
} from "@/lib/preferencesAffichage";
import { compterPreferencesBiblio, reinitialiserPreferencesBiblio } from "@/lib/bibliothequePrefs";
import { compterPreferencesLignes, reinitialiserPreferencesLignes } from "@/lib/preferencesLignes";
import {
  compterFiltresActifs,
  reinitialiserPreferencesFiltres,
  type FiltresActifs,
} from "@/lib/preferencesFiltres";
import {
  lireHistoriqueRemises,
  lireMajPreferences,
  type HistoriqueRemises,
  type MajPreferences,
  type TypePreference,
} from "@/lib/preferencesAffichageNotif";
import { usePreferencesAffichageSync } from "@/hooks/usePreferencesAffichageSync";
import ExportDonneesCard from "@/pages/app/components/ExportDonneesCard";
import StatutEnvoiEmailsCard from "@/pages/app/components/StatutEnvoiEmailsCard";

/** Petit indicateur chiffré du récapitulatif d'en-tête. */
interface Stat {
  id: string;
  icone: string;
  ton: string;
  valeur: string;
  libelle: string;
  detail: string;
  /** Type de préférence associé, pour retrouver la date de dernière modification. */
  type?: TypePreference;
  /** Identifiant de la section à atteindre au clic (la tuile devient un raccourci). */
  cible?: string;
}

/** Libellés lisibles par famille de préférence (historique des modifications). */
const LIBELLES_TYPE: Record<TypePreference, string> = {
  son: "Son de confirmation",
  barres: "Barres de recherche",
  ordres: "Ordre personnalisé",
  biblio: "Bibliothèque (tri, aperçu, épinglage)",
  lignes: "Bibliothèque de lignes (catégories, vue, devis)",
  filtres: "Filtres des listes (clients, devis, factures…)",
};

/** Icônes par famille de préférence (historique des modifications). */
const ICONES_TYPE: Record<TypePreference, string> = {
  son: "ri-volume-up-line",
  barres: "ri-search-line",
  ordres: "ri-drag-move-2-line",
  biblio: "ri-bookmark-3-line",
  lignes: "ri-list-check-2",
  filtres: "ri-filter-3-line",
};

const ORDRE_TYPES: TypePreference[] = ["son", "barres", "ordres", "biblio", "lignes", "filtres"];

/** Date lisible (jour, mois, année, heure) d'une remise à zéro, pour l'historique. */
function dateRemise(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Page « Préférences d'affichage » : regroupe les réglages d'interface de l'espace.
 * Ils ne concernent que l'affichage, sur le poste et le navigateur en cours — aucune donnée
 * métier n'est touchée. Un récapitulatif des préférences actives ouvre la page (avec la date de
 * dernière modification par famille), puis on y règle le son de confirmation, l'état des barres de
 * recherche et l'ordre personnalisé des lignes et des favoris.
 * Les préférences sont sauvegardées sur le compte (Backend) pour être retrouvées sur tout appareil.
 */
export default function AppPreferences() {
  usePageMeta(
    "Préférences d'affichage · ArtiFlow-pro",
    "Réglez l'affichage de votre espace ArtiFlow-pro : son de confirmation, état des barres de recherche et ordre personnalisé des lignes et des favoris. Retrouvez vos préférences sur tous vos appareils.",
  );

  const sync = usePreferencesAffichageSync();

  const [toast, setToast] = useState<string | null>(null);
  // Nombre de barres de recherche dont l'état est actuellement mémorisé.
  const [nbBarres, setNbBarres] = useState(() => compterRecherchesRepliables());
  // Nombre de listes à l'ordre personnalisé actif (lignes et/ou favoris).
  const [nbOrdres, setNbOrdres] = useState(() => compterOrdresPersonnalises());
  // Préférence de son de confirmation (activé par défaut), mémorisée entre deux visites.
  const [sonActif, setSonActif] = useState(() => lireSonActif());
  // Dates de dernière modification par famille de préférence.
  const [maj, setMaj] = useState<MajPreferences>(() => lireMajPreferences());
  // Nombre de réglages de la bibliothèque qui s'écartent des valeurs par défaut.
  const [nbBiblio, setNbBiblio] = useState(() => compterPreferencesBiblio());
  // Nombre de réglages de la bibliothèque de lignes qui s'écartent des valeurs par défaut.
  const [nbLignes, setNbLignes] = useState(() => compterPreferencesLignes());
  // Nombre de filtres actifs par liste et au total (compteur « Filtres actifs » du récapitulatif).
  const [filtresActifs, setFiltresActifs] = useState<FiltresActifs>(() => compterFiltresActifs());
  // Historique des dernières remises à zéro, par famille.
  const [raz, setRaz] = useState<HistoriqueRemises>(() => lireHistoriqueRemises());

  // Relit tous les compteurs et horodatages après une action.
  const rafraichir = useCallback(() => {
    setNbBarres(compterRecherchesRepliables());
    setNbOrdres(compterOrdresPersonnalises());
    setNbBiblio(compterPreferencesBiblio());
    setNbLignes(compterPreferencesLignes());
    setFiltresActifs(compterFiltresActifs());
    setSonActif(lireSonActif());
    setMaj(lireMajPreferences());
    setRaz(lireHistoriqueRemises());
  }, []);

  const reinitialiserBarres = () => {
    const n = reinitialiserRecherchesRepliables();
    rafraichir();
    setToast(
      n > 0
        ? `État des barres de recherche réinitialisé (${n} barre${n > 1 ? "s" : ""}). Elles repartiront repliées dès la prochaine visite.`
        : "Toutes les barres de recherche étaient déjà à l'état par défaut (repliées).",
    );
  };

  const basculerSon = () => {
    const suivant = !sonActif;
    setSonActif(suivant);
    ecrireSonActif(suivant);
    if (suivant) jouerSonEpingle();
    setMaj(lireMajPreferences());
    setToast(suivant ? "Son de confirmation activé." : "Son de confirmation coupé.");
  };

  const reinitialiserOrdres = () => {
    const n = reinitialiserOrdresPersonnalises();
    rafraichir();
    setToast(
      n > 0
        ? `Ordre personnalisé réinitialisé (${n} liste${n > 1 ? "s" : ""}). Lignes et favoris repassent à l'ordre d'origine.`
        : "Aucun ordre personnalisé à réinitialiser : tout est déjà à l'ordre d'origine.",
    );
  };

  // Amène en douceur à la section correspondant à une tuile du récapitulatif.
  const sauterSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reinitBiblio = () => {
    reinitialiserPreferencesBiblio();
    rafraichir();
    setToast("Réglages de la bibliothèque (tri, aperçu, épinglage) remis aux valeurs par défaut.");
  };

  const reinitLignes = () => {
    const n = reinitialiserPreferencesLignes();
    rafraichir();
    setToast(
      n > 0
        ? "Réglages de la bibliothèque de lignes (catégories, vue, devis) remis par défaut."
        : "Les réglages de la bibliothèque de lignes étaient déjà par défaut.",
    );
  };

  const reinitFiltres = () => {
    const n = reinitialiserPreferencesFiltres();
    rafraichir();
    setToast(
      n > 0
        ? "Filtres mémorisés des listes remis par défaut."
        : "Les filtres des listes étaient déjà par défaut.",
    );
  };

  // Remet d'un seul geste toutes les préférences à leurs valeurs par défaut.
  const toutReinitialiser = () => {
    const res = reinitialiserToutPreferencesAffichage();
    rafraichir();
    const parties: string[] = [];
    if (res.sonEtaitCoupe) parties.push("son réactivé");
    if (res.barres > 0) parties.push(`${res.barres} barre${res.barres > 1 ? "s" : ""} repliée${res.barres > 1 ? "s" : ""}`);
    if (res.ordres > 0) parties.push(`${res.ordres} ordre${res.ordres > 1 ? "s" : ""} remis à l'origine`);
    if (res.biblio > 0) parties.push("réglages de la bibliothèque remis à zéro");
    if (res.lignes > 0) parties.push("réglages de la bibliothèque de lignes remis à zéro");
    if (res.filtres > 0) parties.push("filtres des listes remis par défaut");
    setToast(
      parties.length > 0
        ? `Tout remis par défaut : ${parties.join(", ")}.`
        : "Toutes vos préférences étaient déjà aux valeurs par défaut.",
    );
  };

  // Rétablit l'état d'avant une remise à zéro précise (à partir de la photographie mémorisée).
  const retablirRemise = (type: TypePreference, quand: string, avant: unknown) => {
    if (avant == null) return;
    const ok = restaurerEtatPreference(type, avant);
    rafraichir();
    setToast(
      ok
        ? `État d'avant la remise à zéro (${dateRemise(quand)}) rétabli pour « ${LIBELLES_TYPE[type]} ».`
        : "Impossible de rétablir cet état pour le moment.",
    );
  };

  // Raccourci de section : rétablit l'état d'avant LA DERNIÈRE remise à zéro d'une famille, sans
  // passer par l'historique. Affiché uniquement quand une remise à zéro restaurable existe.
  const boutonDerniereRaz = (type: TypePreference) => {
    const entree = raz[type]?.[0];
    if (!entree || entree.avant == null) return null;
    return (
      <button
        type="button"
        onClick={() => retablirRemise(type, entree.quand, entree.avant)}
        title={`Rétablir l'état d'avant la remise à zéro du ${dateRemise(entree.quand)}`}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-foreground-950 transition-colors"
      >
        <i className="ri-arrow-go-back-line"></i>
        Rétablir la dernière remise à zéro
      </button>
    );
  };

  // Détail du compteur « Filtres actifs » : seulement les listes réellement filtrées.
  const detailFiltresActifs = ([
    ["Clients", filtresActifs.clients],
    ["Devis", filtresActifs.devis],
    ["Factures", filtresActifs.factures],
    ["Relances", filtresActifs.relances],
  ] as [string, number][])
    .filter(([, n]) => n > 0)
    .map(([nom, n]) => `${nom} ${n}`)
    .join(" · ");

  const stats: Stat[] = [
    {
      id: "barres",
      icone: "ri-search-line",
      ton: "bg-primary-100 text-primary-700",
      valeur: String(nbBarres),
      libelle: "Barre(s) mémorisée(s)",
      detail: nbBarres > 0 ? "État ouvert/replié conservé" : "repartent repliées",
      type: "barres",
      cible: "section-barres",
    },
    {
      id: "son",
      icone: sonActif ? "ri-volume-up-line" : "ri-volume-mute-line",
      ton: "bg-secondary-100 text-secondary-700",
      valeur: sonActif ? "Activé" : "Coupé",
      libelle: "Son de confirmation",
      detail: "feedback lors d'un partage",
      type: "son",
      cible: "section-son",
    },
    {
      id: "ordres",
      icone: "ri-drag-move-2-line",
      ton: "bg-primary-100 text-primary-700",
      valeur: String(nbOrdres),
      libelle: "Ordre(s) personnalisé(s)",
      detail: nbOrdres > 0 ? "lignes et/ou favoris" : "tout est à l'ordre d'origine",
      type: "ordres",
      cible: "section-ordres",
    },
    {
      id: "biblio",
      icone: "ri-bookmark-3-line",
      ton: "bg-secondary-100 text-secondary-700",
      valeur: String(nbBiblio),
      libelle: "Réglage(s) bibliothèque",
      detail: nbBiblio > 0 ? "tri, aperçu, épinglage" : "valeurs par défaut",
      type: "biblio",
      cible: "section-avances",
    },
    {
      id: "lignes",
      icone: "ri-list-check-2",
      ton: "bg-accent-100 text-accent-700",
      valeur: String(nbLignes),
      libelle: "Réglage(s) lignes",
      detail: nbLignes > 0 ? "catégories, vue, devis" : "valeurs par défaut",
      type: "lignes",
      cible: "section-avances",
    },
    {
      id: "filtres",
      icone: "ri-filter-3-line",
      ton: "bg-secondary-100 text-secondary-700",
      valeur: String(filtresActifs.total),
      libelle: "Filtre(s) actif(s)",
      detail: filtresActifs.total > 0 ? detailFiltresActifs : "aucun filtre actif",
      type: "filtres",
      cible: "section-avances",
    },
  ];

  // Historique : familles réellement modifiées, de la plus récente à la plus ancienne.
  const historique = ORDRE_TYPES.filter((t) => maj[t]).sort(
    (a, b) => new Date(maj[b] as string).getTime() - new Date(maj[a] as string).getTime(),
  );

  // Familles ayant au moins une remise à zéro, de la plus récente à la plus ancienne.
  const famillesRaz = ORDRE_TYPES.filter((t) => (raz[t]?.length ?? 0) > 0).sort((a, b) => {
    const da = raz[a]?.[0] ? new Date(raz[a]![0].quand).getTime() : 0;
    const db = raz[b]?.[0] ? new Date(raz[b]![0].quand).getTime() : 0;
    return db - da;
  });

  // Résumé de l'état de synchronisation, affiché dans l'en-tête.
  const syncResume = !sync.connecte
    ? { icone: "ri-cloud-off-line", ton: "bg-background-200 text-foreground-600", texte: "Synchronisation inactive (non connecté)" }
    : sync.erreur
      ? { icone: "ri-error-warning-line", ton: "bg-red-100 text-red-700", texte: sync.erreur }
      : sync.enCours
        ? { icone: "ri-loader-4-line", ton: "bg-accent-100 text-accent-700", texte: "Synchronisation en cours…" }
        : {
            icone: "ri-cloud-line",
            ton: "bg-primary-100 text-primary-700",
            texte: sync.derniereSynchro
              ? `Synchronisé sur votre compte · ${tempsRelatifPreference(sync.derniereSynchro)}`
              : "Synchronisé sur votre compte",
          };

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-lg text-foreground-950">Préférences d'affichage</h2>
          <p className="text-sm text-foreground-500 mt-0.5 max-w-2xl">
            Ces réglages ne concernent que l'affichage de votre espace. Ils n'ont aucune incidence sur vos
            données métier, et sont retrouvés automatiquement sur vos autres appareils.
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <span
            title={syncResume.texte}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${syncResume.ton}`}
          >
            <i className={`${syncResume.icone}${sync.enCours ? " animate-spin" : ""}`}></i>
            {sync.connecte ? (sync.erreur ? "Synchronisation à reprendre" : "Synchronisé") : "Local uniquement"}
          </span>
          {sync.connecte && sync.erreur && (
            <button
              type="button"
              onClick={() => void sync.synchroniser()}
              disabled={sync.enCours}
              title="Relancer l'enregistrement de vos préférences sur votre compte"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={`ri-refresh-line${sync.enCours ? " animate-spin" : ""}`}></i>
              Synchroniser maintenant
            </button>
          )}
        </div>
      </div>

      {/* Récapitulatif des préférences actives */}
      <section className="p-5 md:p-6 rounded-lg bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-foreground-950 text-background-50">
              <i className="ri-dashboard-3-line"></i>
            </span>
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-base text-foreground-950">Vos préférences actives</h3>
              <p className="text-xs text-foreground-500 mt-0.5">Un coup d'œil sur ce qui est mémorisé pour votre compte.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toutReinitialiser}
            title="Remettre le son, les barres de recherche, l'aide des raccourcis, les ordres et les réglages des bibliothèques à leurs valeurs par défaut"
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-foreground-950 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-foreground-800 transition-colors"
          >
            <i className="ri-restart-line"></i>
            Tout réinitialiser
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => {
            const contenu = (
              <>
                {s.cible && (
                  <i
                    aria-hidden="true"
                    className="ri-arrow-down-line absolute top-3 right-3 text-sm text-foreground-300"
                  ></i>
                )}
                <span className={`w-8 h-8 flex items-center justify-center rounded-md ${s.ton}`}>
                  <i className={s.icone}></i>
                </span>
                <span className="font-heading font-bold text-xl text-foreground-950 leading-none tabular-nums">
                  {s.valeur}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground-800 leading-tight">{s.libelle}</span>
                  <span className="block text-[11px] text-foreground-500 mt-0.5">{s.detail}</span>
                </span>
                {s.type && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-foreground-400 border-t border-background-200 pt-1.5">
                    <i className="ri-history-line"></i>
                    Modifié {tempsRelatifPreference(maj[s.type])}
                  </span>
                )}
              </>
            );
            const classe = "relative flex flex-col gap-2 p-3.5 rounded-lg bg-background-100 border border-background-200 text-left";
            return s.cible ? (
              <button
                key={s.id}
                type="button"
                onClick={() => sauterSection(s.cible as string)}
                title={`Aller à la section : ${s.libelle}`}
                className={`${classe} cursor-pointer hover:border-primary-300 hover:bg-background-50 transition-colors`}
              >
                {contenu}
              </button>
            ) : (
              <div key={s.id} className={classe}>
                {contenu}
              </div>
            );
          })}
        </div>

        {/* Historique des dernières modifications par famille */}
        <div className="mt-4 pt-4 border-t border-background-200">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 mb-2">
            Dernières modifications
          </p>
          {historique.length === 0 ? (
            <p className="text-xs text-foreground-500 flex items-center gap-1.5">
              <i className="ri-hourglass-line"></i>
              Aucune modification enregistrée pour l'instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {historique.map((t) => (
                <li key={t} className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-background-100 text-foreground-600">
                    <i className={ICONES_TYPE[t]}></i>
                  </span>
                  <span className="font-medium text-foreground-800">{LIBELLES_TYPE[t]}</span>
                  <span className="text-foreground-400">·</span>
                  <span className="text-foreground-500">{tempsRelatifPreference(maj[t])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historique des remises à zéro par famille (les dernières, pas seulement une) */}
        <div className="mt-4 pt-4 border-t border-background-200">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 mb-2">
            Remises à zéro récentes
          </p>
          {famillesRaz.length === 0 ? (
            <p className="text-xs text-foreground-500 flex items-center gap-1.5">
              <i className="ri-history-line"></i>
              Aucune remise à zéro enregistrée pour l'instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {famillesRaz.map((t) => (
                <li key={t} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-background-100 text-foreground-600">
                    <i className={ICONES_TYPE[t]}></i>
                  </span>
                  <span className="font-medium text-foreground-800">{LIBELLES_TYPE[t]}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(raz[t] ?? []).map((entree, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="inline-flex items-center gap-1 pl-1.5 pr-1 h-6 rounded-full bg-background-100 border border-background-200 text-[10px] font-medium text-foreground-600 whitespace-nowrap"
                      >
                        <i className="ri-restart-line"></i>
                        <span title={`Remise à zéro ${tempsRelatifPreference(entree.quand)}`} className="tabular-nums">
                          {dateRemise(entree.quand)}
                        </span>
                        {entree.avant != null && (
                          <button
                            type="button"
                            onClick={() => retablirRemise(t, entree.quand, entree.avant)}
                            title="Rétablir l'état d'avant cette remise à zéro"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-semibold cursor-pointer hover:bg-primary-200 transition-colors"
                          >
                            <i className="ri-arrow-go-back-line text-[10px]"></i>
                            Rétablir
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Son de confirmation */}
      <section id="section-son" className="scroll-mt-28 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className={sonActif ? "ri-volume-up-line" : "ri-volume-mute-line"}></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Son de confirmation</h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              Le petit « ding » discret joué lors d'un partage ou d'une copie. Coupez-le si vous préférez travailler
              en silence ; le réglage est mémorisé pour vos prochaines visites.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={basculerSon}
            role="switch"
            aria-checked={sonActif}
            title={sonActif ? "Couper le son de confirmation" : "Activer le son de confirmation"}
            className={`inline-flex items-center gap-2.5 h-10 px-4 rounded-md border text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              sonActif
                ? "bg-secondary-500 border-secondary-500 text-background-50 hover:bg-secondary-600"
                : "bg-background-50 border-background-200 text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className={sonActif ? "ri-volume-up-line" : "ri-volume-mute-line"}></i>
            {sonActif ? "Son activé" : "Son coupé"}
          </button>
          {boutonDerniereRaz("son")}
          <span className="text-[11px] text-foreground-500">
            {sonActif ? "Vous entendrez un repère sonore discret." : "Aucun son ne sera joué."}
          </span>
        </div>
      </section>

      {/* Barres de recherche repliables */}
      <section id="section-barres" className="scroll-mt-28 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-search-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Barres de recherche</h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              Chaque carte garde sa barre de recherche telle que vous l'avez laissée (ouverte ou repliée) d'une
              visite à l'autre. Réinitialisez pour repartir sur des barres repliées partout.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reinitialiserBarres}
            title="Effacer l'état mémorisé des barres de recherche (elles repartiront repliées)"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
          >
            <i className="ri-restart-line"></i>
            Réinitialiser l'état des barres de recherche
          </button>
          {boutonDerniereRaz("barres")}
          <span className="text-[11px] text-foreground-500">
            {nbBarres > 0
              ? `${nbBarres} barre${nbBarres > 1 ? "s" : ""} mémorisée${nbBarres > 1 ? "s" : ""}.`
              : "Aucune préférence mémorisée pour l'instant."}
          </span>
        </div>
      </section>

      {/* Ordres personnalisés (lignes + favoris) */}
      <section id="section-ordres" className="scroll-mt-28 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-drag-move-2-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Ordre personnalisé des lignes et des favoris</h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              Vous avez rangé des lignes de la bibliothèque de lignes et/ou des favoris de vos ressources à la main.
              Réinitialisez d'un bloc pour repartir sur l'ordre d'origine — sans rien supprimer (les épingles et les
              favoris restent en place).
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reinitialiserOrdres}
            title="Remettre les lignes et les favoris dans leur ordre d'origine"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
          >
            <i className="ri-arrow-go-back-line"></i>
            Réinitialiser l'ordre des lignes et des favoris
          </button>
          {boutonDerniereRaz("ordres")}
          <span className="text-[11px] text-foreground-500">
            {nbOrdres > 0
              ? `${nbOrdres} liste${nbOrdres > 1 ? "s" : ""} en ordre personnalisé.`
              : "Aucun ordre personnalisé actif."}
          </span>
        </div>
      </section>

      {/* Réglages avancés : bibliothèque de ressources, bibliothèque de lignes et filtres des listes */}
      <section
        id="section-avances"
        className="scroll-mt-28 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200"
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-equalizer-2-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Réglages de la bibliothèque et des listes
            </h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              Le tri et l'aperçu de la bibliothèque de ressources, les catégories et la vue de la bibliothèque de
              lignes, ainsi que les filtres de vos listes. Eux aussi sont retrouvés sur vos autres appareils.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
              <i className="ri-bookmark-3-line"></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-900">Bibliothèque de ressources</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                {nbBiblio > 0
                  ? `${nbBiblio} réglage${nbBiblio > 1 ? "s" : ""} modifié${nbBiblio > 1 ? "s" : ""} — tri, aperçu, épinglage.`
                  : "Tri, aperçu et épinglage aux valeurs par défaut."}
              </p>
            </div>
            <button
              type="button"
              onClick={reinitBiblio}
              title="Remettre le tri, l'aperçu et l'épinglage de la bibliothèque aux valeurs par défaut"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
            >
              <i className="ri-restart-line"></i>
              Réinitialiser
            </button>
            {boutonDerniereRaz("biblio")}
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <i className="ri-list-check-2"></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-900">Bibliothèque de lignes</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                {nbLignes > 0
                  ? `${nbLignes} réglage${nbLignes > 1 ? "s" : ""} modifié${nbLignes > 1 ? "s" : ""} — catégories, vue, onglet du devis.`
                  : "Catégories, vue et onglet du devis aux valeurs par défaut."}
              </p>
            </div>
            <button
              type="button"
              onClick={reinitLignes}
              title="Remettre les catégories, la vue et l'onglet du devis aux valeurs par défaut"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
            >
              <i className="ri-restart-line"></i>
              Réinitialiser
            </button>
            {boutonDerniereRaz("lignes")}
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
              <i className="ri-filter-3-line"></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-900">Filtres des listes</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                {filtresActifs.total > 0
                  ? `${filtresActifs.total} filtre${filtresActifs.total > 1 ? "s" : ""} actif${filtresActifs.total > 1 ? "s" : ""} — ${detailFiltresActifs}.`
                  : "Aucun filtre actif : clients, devis, factures et relances sont par défaut."}
              </p>
            </div>
            <button
              type="button"
              onClick={reinitFiltres}
              title="Remettre les filtres mémorisés des listes aux valeurs par défaut"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
            >
              <i className="ri-restart-line"></i>
              Réinitialiser
            </button>
            {boutonDerniereRaz("filtres")}
          </div>
        </div>
      </section>

      {/* Envoi des emails : repère de configuration (clé + domaine vérifiés) */}
      <StatutEnvoiEmailsCard />

      {/* Sauvegarde des données personnelles (droit à la portabilité RGPD) */}
      <ExportDonneesCard />

      {toast && (
        <Toast message={toast} icon="ri-equalizer-2-line" onClose={() => setToast(null)} />
      )}
    </div>
  );
}