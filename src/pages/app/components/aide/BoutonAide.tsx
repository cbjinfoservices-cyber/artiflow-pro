import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LEXIQUE } from "@/lib/lexique";
import {
  aidePriseEnMainDejaVue,
  marquerAidePriseEnMainVue,
  reinitialiserAidePriseEnMain,
} from "@/lib/aidePriseEnMainMemoire";
import { reinitialiserTousLesGuidesPremiereVisite } from "@/lib/guidePremiereVisite";

/** Une étape du guide de prise en main. */
interface Etape {
  icon: string;
  titre: string;
  texte: string;
  /** Route proposée à l'étape (optionnel). */
  lien?: string;
  lienLabel?: string;
}

/**
 * Guide « premiers pas » : quelques étapes courtes, sans jargon, qui montrent l'essentiel à
 * quelqu'un qui découvre l'outil pour la première fois.
 */
const ETAPES: Etape[] = [
  {
    icon: "ri-hand-heart-line",
    titre: "Bienvenue, on y va doucement",
    texte:
      "Pas besoin d'être à l'aise avec l'informatique : ArtiFlow-pro fait le gros du travail, vous n'avez qu'à valider.",
  },
  {
    icon: "ri-menu-2-line",
    titre: "Le menu de gauche, c'est votre sommaire",
    texte:
      "Tout est rangé par activité : Devis, Factures, Clients, Relances… Survolez une entrée du menu pour savoir à quoi elle sert.",
    lien: "/app/devis",
    lienLabel: "Voir mes devis",
  },
  {
    icon: "ri-user-add-line",
    titre: "On commence par un client",
    texte:
      "Enregistrez vos clients une fois, et vous les retrouverez partout ensuite. Le nom suffit pour débuter, vous compléterez plus tard.",
    lien: "/app/clients",
    lienLabel: "Ajouter un client",
  },
  {
    icon: "ri-magic-line",
    titre: "Créer un devis en un clic",
    texte:
      "Le bouton « Nouveau devis IA » en haut à droite rédige le devis pour vous. Vous choisissez le client, vous ajustez, c'est prêt à envoyer.",
    lien: "/app/devis",
    lienLabel: "Créer un devis",
  },
  {
    icon: "ri-notification-3-line",
    titre: "Relancer, sans y penser",
    texte:
      "L'outil repère les impayés et prépare les rappels à votre place. Vous pouvez même laisser les messages partir tout seuls.",
    lien: "/app/relances",
    lienLabel: "Voir les relances",
  },
  {
    icon: "ri-shield-check-line",
    titre: "Vous ne pouvez rien casser",
    texte:
      "Rien n'est envoyé sans votre accord (sauf si vous l'avez programmé). Et en cas de doute, ce bouton « Aide » restera toujours là, en bas à droite.",
  },
];

/** Raccourcis essentiels affichés en haut du panneau. */
const RACCOURCIS: { icon: string; label: string; to: string }[] = [
  { icon: "ri-file-add-line", label: "Créer un devis", to: "/app/devis" },
  { icon: "ri-user-add-line", label: "Ajouter un client", to: "/app/clients" },
  { icon: "ri-notification-3-line", label: "Mes relances", to: "/app/relances" },
];

/**
 * Bouton d'aide flottant, présent sur tout l'espace artisan. Il ouvre un panneau qui regroupe :
 * un guide « premiers pas » (pour les débutants), un lexique en français simple (le jargon traduit),
 * et quelques raccourcis vers les actions les plus courantes.
 *
 * Au tout premier passage, le panneau s'ouvre une fois de lui-même pour accueillir la personne ;
 * ensuite il reste discret et n'apparaît que si on le demande.
 */
export default function BoutonAide() {
  const [ouvert, setOuvert] = useState(false);
  const [onglet, setOnglet] = useState<"demarrer" | "lexique">("demarrer");
  const [etape, setEtape] = useState(0);
  const [recherche, setRecherche] = useState("");
  // Confirmation discrète après la remise à zéro des guides de première visite des pages.
  const [guidesReinitialises, setGuidesReinitialises] = useState(false);

  // Ouverture automatique au tout premier passage (une seule fois).
  useEffect(() => {
    if (aidePriseEnMainDejaVue()) return undefined;
    const timer = setTimeout(() => setOuvert(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const fermer = () => {
    setOuvert(false);
    marquerAidePriseEnMainVue();
  };

  const ouvrir = () => {
    setOuvert(true);
    setEtape(0);
  };

  const lexiqueFiltre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return LEXIQUE;
    return LEXIQUE.filter(
      (e) => e.terme.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
    );
  }, [recherche]);

  const derniere = etape === ETAPES.length - 1;
  const courante = ETAPES[etape];

  return (
    <>
      {/* Bouton flottant */}
      <button
        type="button"
        onClick={ouvert ? fermer : ouvrir}
        aria-label={ouvert ? "Fermer l'aide" : "Ouvrir l'aide"}
        aria-expanded={ouvert}
        className={`fixed right-4 lg:right-6 bottom-24 lg:bottom-6 z-40 inline-flex items-center gap-2 h-11 px-4 rounded-full whitespace-nowrap cursor-pointer transition-colors ${
          ouvert
            ? "bg-foreground-950 text-background-50"
            : "bg-primary-500 text-background-50 hover:bg-primary-600"
        }`}
      >
        <i className={ouvert ? "ri-close-line text-lg" : "ri-question-line text-lg"}></i>
        <span className="text-sm font-semibold">{ouvert ? "Fermer" : "Aide"}</span>
      </button>

      {/* Panneau d'aide */}
      {ouvert && (
        <div
          role="dialog"
          aria-label="Aide et prise en main"
          className="fixed right-4 lg:right-6 bottom-40 lg:bottom-20 z-40 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] flex flex-col rounded-lg bg-background-50 border border-background-200 overflow-hidden animate-fade-in"
        >
          {/* En-tête */}
          <div className="shrink-0 flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-background-200">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                <i className="ri-lightbulb-flash-line text-lg"></i>
              </span>
              <div>
                <p className="font-heading font-bold text-sm text-foreground-950">Besoin d'un coup de main ?</p>
                <p className="text-[11px] text-foreground-500">Expliqué simplement, sans jargon.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer l'aide"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>

          {/* Onglets */}
          <div className="shrink-0 px-3 pt-3">
            <div className="flex items-center p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => setOnglet("demarrer")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  onglet === "demarrer"
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-route-line"></i>
                Premiers pas
              </button>
              <button
                type="button"
                onClick={() => setOnglet("lexique")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  onglet === "lexique"
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-book-2-line"></i>
                Lexique
              </button>
            </div>
          </div>

          {/* Contenu défilant */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {onglet === "demarrer" ? (
              <div className="flex flex-col gap-4">
                {/* Raccourcis essentiels */}
                <div className="grid grid-cols-2 gap-2">
                  {RACCOURCIS.map((r) => (
                    <Link
                      key={r.to}
                      to={r.to}
                      onClick={fermer}
                      className="flex items-center gap-2 h-11 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-800 hover:border-primary-300 cursor-pointer transition-colors"
                    >
                      <i className={`${r.icon} text-base text-primary-600`}></i>
                      <span className="truncate">{r.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Étape courante */}
                <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
                      <i className={courante.icon}></i>
                    </span>
                    <div>
                      <p className="font-heading font-semibold text-sm text-foreground-950">{courante.titre}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                        Étape {etape + 1} sur {ETAPES.length}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-foreground-600 leading-relaxed">{courante.texte}</p>
                  {courante.lien && courante.lienLabel && (
                    <Link
                      to={courante.lien}
                      onClick={fermer}
                      className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-secondary-300 text-xs font-semibold text-secondary-700 hover:bg-secondary-100 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      {courante.lienLabel}
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  )}
                </div>

                {/* Navigation du guide */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEtape((e) => Math.max(0, e - 1))}
                    disabled={etape === 0}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ri-arrow-left-line"></i>
                    Précédent
                  </button>

                  {/* Points de progression */}
                  <div className="flex items-center gap-1.5">
                    {ETAPES.map((e, i) => (
                      <button
                        key={e.titre}
                        type="button"
                        onClick={() => setEtape(i)}
                        aria-label={`Aller à l'étape ${i + 1}`}
                        className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-colors ${
                          i === etape ? "bg-primary-500" : "bg-background-300 hover:bg-background-400"
                        }`}
                      ></button>
                    ))}
                  </div>

                  {derniere ? (
                    <button
                      type="button"
                      onClick={fermer}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold hover:bg-accent-600 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      C'est parti !
                      <i className="ri-check-line"></i>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEtape((e) => Math.min(ETAPES.length - 1, e + 1))}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Suivant
                      <i className="ri-arrow-right-line"></i>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Recherche dans le lexique */}
                <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-background-50 border border-background-200 focus-within:border-primary-400 transition-colors">
                  <i className="ri-search-line text-foreground-400 text-sm"></i>
                  <input
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Chercher un mot (ex. relance…)"
                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 outline-none"
                  />
                  {recherche && (
                    <button
                      type="button"
                      onClick={() => setRecherche("")}
                      aria-label="Effacer la recherche"
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  )}
                </div>

                {lexiqueFiltre.length === 0 ? (
                  <p className="text-center text-xs text-foreground-500 py-8">
                    Aucun mot ne correspond à « {recherche} ».
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lexiqueFiltre.map((e) => (
                      <div key={e.terme} className="p-3 rounded-lg bg-background-100 border border-background-200">
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground-950">
                          <i className="ri-bookmark-line text-primary-600"></i>
                          {e.terme}
                        </p>
                        <p className="mt-1 text-xs text-foreground-600 leading-relaxed">{e.definition}</p>
                        {e.page && e.pageLabel && (
                          <Link
                            to={e.page}
                            onClick={fermer}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
                          >
                            {e.pageLabel}
                            <i className="ri-arrow-right-line"></i>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pied : réinitialiser le guide global et/ou les guides de page */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-background-200 bg-background-100">
            {guidesReinitialises ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-700">
                <i className="ri-checkbox-circle-line"></i>
                Guides de page réinitialisés
              </span>
            ) : (
              <span className="text-[10px] text-foreground-400">Astuce : survolez les boutons pour une explication.</span>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  reinitialiserTousLesGuidesPremiereVisite();
                  setGuidesReinitialises(true);
                  window.setTimeout(() => setGuidesReinitialises(false), 3000);
                }}
                title="Réafficher, à la prochaine visite, les petits guides de chaque page (Tableau de bord, Clients, Devis, Factures, Relances, Comptabilité)"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium text-foreground-500 hover:bg-background-200 hover:text-foreground-800 cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-history-line"></i>
                Revoir tous les guides
              </button>
              <button
                type="button"
                onClick={() => {
                  reinitialiserAidePriseEnMain();
                  setOnglet("demarrer");
                  setEtape(0);
                }}
                title="Réafficher ce guide d'accueil au prochain démarrage"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium text-foreground-500 hover:bg-background-200 hover:text-foreground-800 cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-refresh-line"></i>
                Revoir au démarrage
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}