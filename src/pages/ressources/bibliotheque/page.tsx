import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import ArticleCard from "@/components/feature/ArticleCard";
import ExporterMenu from "@/pages/ressources/components/ExporterMenu";
import NoteEditCard from "@/pages/ressources/components/NoteEditCard";
import NoteLibreCard from "@/pages/ressources/components/NoteLibreCard";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import { articles, articleFullText, readingMinutes, type Article } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import {
  dateFavori,
  getNoteLibre,
  getTitreNoteLibre,
  isFavori,
  listerNotes,
  listerNotesLibres,
  nouvelIdNoteLibre,
  toutEffacerBibliotheque,
} from "@/lib/bibliotheque";
import { ecrireOrdreFavoris, ecrireOrdreNotes, ecrirePageBiblio, ecrireTriBiblio, ecrireTriNotesBiblio, ecrireEpingleTriFav, ecrireEpingleTriNotes, ecrireVitesseFav, ecrireVitesseNotes, ecrireApercuFavPosition, ecrireApercuNotesPosition, ecrireApercuFavAuto, ecrireApercuNotesAuto, lireOrdreFavoris, lireOrdreNotes, lirePageBiblio, lireTriBiblio, lireTriNotesBiblio, lireEpingleTriFav, lireEpingleTriNotes, lireVitesseFav, lireVitesseNotes, lireApercuFavPosition, lireApercuNotesPosition, lireApercuFavAuto, lireApercuNotesAuto, reinitialiserPreferencesBiblio, type TriBiblio, type TriNotesBiblio, type VitesseApercu } from "@/lib/bibliothequePrefs";
import { useBibliothequeVersion } from "@/hooks/useBibliotheque";
import { useLectureVersion } from "@/hooks/useLectureStatut";
import { getStatut } from "@/lib/lecture";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";

type VueBiblio = "tout" | "favoris" | "notes";

const VUES: { id: VueBiblio; label: string; icon: string }[] = [
  { id: "tout", label: "Tout", icon: "ri-layout-grid-line" },
  { id: "favoris", label: "Favoris", icon: "ri-bookmark-3-line" },
  { id: "notes", label: "Notes", icon: "ri-sticky-note-line" },
];

const TRIS: { id: TriBiblio; label: string; icon: string }[] = [
  { id: "recents", label: "Plus récents", icon: "ri-time-line" },
  { id: "metier", label: "Par métier", icon: "ri-tools-line" },
  { id: "temps", label: "Temps de lecture", icon: "ri-timer-line" },
  { id: "titre", label: "Par titre (A→Z)", icon: "ri-sort-alphabet-asc" },
  { id: "manuel", label: "Personnalisé", icon: "ri-drag-move-2-line" },
];

const TRIS_NOTES: { id: TriNotesBiblio; label: string; icon: string }[] = [
  { id: "recents", label: "Plus récents", icon: "ri-time-line" },
  { id: "titre", label: "Par titre (A→Z)", icon: "ri-sort-alphabet-asc" },
  { id: "manuel", label: "Personnalisé", icon: "ri-drag-move-2-line" },
];

const PAR_PAGE = 6;

// Durée d'affichage par élément (en ms) pour le mode aperçu automatique.
const VITESSES_APERCU: { id: VitesseApercu; label: string; base: number }[] = [
  { id: "lent", label: "Lent", base: 2200 },
  { id: "normal", label: "Normal", base: 1400 },
  { id: "rapide", label: "Rapide", base: 850 },
];

/** Formate un intervalle d'aperçu en « 1,4 s / élément » (séparateur français). */
function libelleIntervalle(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s / élément`;
}

/**
 * Explique à l'utilisateur la formule d'adaptation de la vitesse au nombre
 * d'éléments : 9000 ms réparties sur la liste, bornées entre 600 ms et la
 * vitesse de base choisie.
 */
function formuleIntervalle(base: number, nb: number): string {
  const elements = Math.max(nb, 1);
  const brut = Math.round(9000 / elements);
  const applique = Math.max(600, Math.min(base, brut));
  return `Formule : 9 000 ÷ ${elements} élément${elements > 1 ? "s" : ""} = ${brut} ms, borné entre 600 ms et ${base} ms (vitesse choisie) → ${applique} ms.`;
}

/** Nom du métier (minuscule) associé au guide, pour le tri alphabétique. */
function nomMetier(article: Article): string {
  const m = metiers.find((x) => x.slug === article.category);
  return (m?.name ?? "").toLowerCase();
}

/** Vrai si un guide correspond au terme recherché (titre, résumé, métier ou texte complet). */
function matchArticle(article: Article, q: string): boolean {
  if (q === "") return true;
  const metier = metiers.find((m) => m.slug === article.category);
  const champs = [
    article.title,
    article.excerpt,
    articleFullText(article),
    metier?.name ?? "",
    metier?.shortName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return champs.includes(q);
}

/** Déplace un élément de la liste de la position « source » vers la position « cible ». */
function reordonner(liste: string[], source: string, cible: string): string[] {
  const depuis = liste.indexOf(source);
  const vers = liste.indexOf(cible);
  if (depuis === -1 || vers === -1 || depuis === vers) return liste;
  const copie = [...liste];
  const [element] = copie.splice(depuis, 1);
  copie.splice(vers, 0, element);
  return copie;
}

/**
 * Page dédiée « Ma bibliothèque » : regroupe en un seul endroit tous les guides
 * mis en favori et toutes les notes personnelles, avec recherche unifiée et
 * édition rapide des notes directement depuis la liste.
 */
export default function BibliothequePage() {
  const versionBiblio = useBibliothequeVersion();
  const versionLecture = useLectureVersion();
  const [recherche, setRecherche] = useState("");
  const [titreSeul, setTitreSeul] = useState(false);
  const [vue, setVue] = useState<VueBiblio>("tout");
  const [tri, setTri] = useState<TriBiblio>(() => lireTriBiblio());
  const [triNotes, setTriNotes] = useState<TriNotesBiblio>(() => lireTriNotesBiblio());
  const [page, setPage] = useState(() => lirePageBiblio());
  const [nouvellesNotes, setNouvellesNotes] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ordreFavoris, setOrdreFavoris] = useState<string[]>(() => lireOrdreFavoris());
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [survolSlug, setSurvolSlug] = useState<string | null>(null);
  const [ordreNotes, setOrdreNotes] = useState<string[]>(() => lireOrdreNotes());
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [survolNoteId, setSurvolNoteId] = useState<string | null>(null);
  const [epingleTriFav, setEpingleTriFav] = useState<boolean>(() => lireEpingleTriFav());
  const [epingleTriNotes, setEpingleTriNotes] = useState<boolean>(() => lireEpingleTriNotes());
  const [highlightFav, setHighlightFav] = useState<string[]>([]);
  const [highlightNotes, setHighlightNotes] = useState<string[]>([]);
  // Index de l'élément actuellement mis en avant dans l'aperçu « un par un »
  // des éléments déplacés (null = aperçu fermé). On reprend par défaut là où
  // l'aperçu avait été laissé lors de la dernière visite.
  const [apercuFav, setApercuFav] = useState<number | null>(() => lireApercuFavPosition());
  const [apercuNotes, setApercuNotes] = useState<number | null>(() => lireApercuNotesPosition());
  // Mode « défilement automatique » de l'aperçu (play/pause), mémorisé pour
  // reprendre automatiquement au retour sur la page.
  const [apercuFavAuto, setApercuFavAuto] = useState(() => lireApercuFavAuto());
  const [apercuNotesAuto, setApercuNotesAuto] = useState(() => lireApercuNotesAuto());
  const [vitesseFav, setVitesseFav] = useState<VitesseApercu>(() => lireVitesseFav());
  const [vitesseNotes, setVitesseNotes] = useState<VitesseApercu>(() => lireVitesseNotes());
  // Snapshot de l'ordre personnalisé juste avant une réinitialisation, pour
  // proposer un bouton « Annuler » éphémère.
  const [undoOrdre, setUndoOrdre] = useState<{
    favoris: string[];
    notes: string[];
    tri: TriBiblio;
    triNotes: TriNotesBiblio;
  } | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const premierRendu = useRef(true);

  // On remet la pagination à la page 1 dès qu'un critère change — mais pas au
  // premier affichage, pour restituer la page précédemment mémorisée.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    setPage(1);
  }, [recherche, tri, titreSeul, vue]);

  // Mémorisation des préférences d'affichage (tri + page) pour la prochaine visite.
  useEffect(() => {
    ecrireTriBiblio(tri);
  }, [tri]);

  useEffect(() => {
    ecrireTriNotesBiblio(triNotes);
  }, [triNotes]);

  useEffect(() => {
    ecrirePageBiblio(page);
  }, [page]);

  useEffect(() => {
    ecrireOrdreFavoris(ordreFavoris);
  }, [ordreFavoris]);

  useEffect(() => {
    ecrireOrdreNotes(ordreNotes);
  }, [ordreNotes]);

  useEffect(() => {
    ecrireEpingleTriFav(epingleTriFav);
  }, [epingleTriFav]);

  useEffect(() => {
    ecrireEpingleTriNotes(epingleTriNotes);
  }, [epingleTriNotes]);

  useEffect(() => {
    ecrireVitesseFav(vitesseFav);
  }, [vitesseFav]);

  useEffect(() => {
    ecrireVitesseNotes(vitesseNotes);
  }, [vitesseNotes]);

  // Position d'ouverture de l'aperçu mémorisée pour la prochaine visite.
  useEffect(() => {
    ecrireApercuFavPosition(apercuFav);
  }, [apercuFav]);

  useEffect(() => {
    ecrireApercuNotesPosition(apercuNotes);
  }, [apercuNotes]);

  // Mode lecture/pause mémorisé : on reprend l'aperçu là où on l'avait laissé.
  useEffect(() => {
    ecrireApercuFavAuto(apercuFavAuto);
  }, [apercuFavAuto]);

  useEffect(() => {
    ecrireApercuNotesAuto(apercuNotesAuto);
  }, [apercuNotesAuto]);

  // Nettoyage des minuteurs au démontage.
  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    },
    []
  );

  usePageMeta(
    "Ma bibliothèque : favoris et notes de vos guides | ArtiFlow-pro",
    "Retrouvez en un seul endroit tous vos guides mis en favori et vos notes personnelles, avec recherche unifiée et édition rapide des notes.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20representing%20a%20personal%20library%20of%20saved%20guides%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20bookmark%20and%20stacked%20notebook%20silhouettes%2C%20blueprint%20lines%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-bibliotheque-n1&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Ressources", path: "/ressources" },
      { name: "Ma bibliothèque", path: "/ressources/bibliotheque" },
    ],
    "artiflow-bibliotheque-breadcrumb-schema"
  );

  const favoris = useMemo(
    () => articles.filter((a) => isFavori(a.slug)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionBiblio]
  );

  const notes = useMemo(
    () =>
      listerNotes()
        .map(({ slug, texte }) => {
          const article = articles.find((a) => a.slug === slug);
          return article ? { article, texte } : null;
        })
        .filter((item): item is { article: Article; texte: string } => item !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionBiblio]
  );

  const notesLibres = useMemo(
    () => listerNotesLibres(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionBiblio]
  );

  const q = recherche.trim().toLowerCase();

  const favorisFiltres = useMemo(
    () => favoris.filter((a) => matchArticle(a, q)),
    [favoris, q]
  );

  const notesFiltrees = useMemo(
    () => notes.filter(({ article, texte }) => matchArticle(article, q) || texte.toLowerCase().includes(q)),
    [notes, q]
  );

  // Identifiants de notes libres (brouillons non encore enregistrés inclus, en tête),
  // sans doublon avec celles déjà persistées.
  const idsNotesLibres = useMemo(() => {
    const persistes = notesLibres.map((n) => n.id);
    return [...nouvellesNotes, ...persistes.filter((id) => !nouvellesNotes.includes(id))];
  }, [notesLibres, nouvellesNotes]);

  const notesLibresFiltrees = useMemo(
    () =>
      idsNotesLibres.filter((id) => {
        if (q === "") return true;
        // Mode « titre uniquement » : on ne regarde que le titre de la note libre.
        if (titreSeul) return getTitreNoteLibre(id).toLowerCase().includes(q);
        return `${getTitreNoteLibre(id)} ${getNoteLibre(id)}`.toLowerCase().includes(q);
      }),
    [idsNotesLibres, q, titreSeul]
  );

  // Liste unifiée des notes (libres + rattachées à un guide) pour pouvoir les
  // trier ensemble, notamment par titre A→Z.
  const notesUnifiees = useMemo(() => {
    const libres = notesLibresFiltrees.map((id) => ({
      cle: `libre-${id}`,
      type: "libre" as const,
      id,
      titre: getTitreNoteLibre(id) || "Note libre",
    }));
    const guides = notesFiltrees.map(({ article }) => ({
      cle: `guide-${article.slug}`,
      type: "guide" as const,
      id: article.slug,
      titre: article.title,
    }));
    return [...libres, ...guides];
  }, [notesLibresFiltrees, notesFiltrees]);

  const notesOrdonnees = useMemo(() => {
    if (triNotes === "titre") {
      return [...notesUnifiees].sort((a, b) =>
        a.titre.toLowerCase().localeCompare(b.titre.toLowerCase(), "fr")
      );
    }
    if (triNotes === "manuel") {
      // Ordre manuel : on ne réordonne que les notes libres (les notes liées à un
      // guide restent ensuite, comme dans l'ordre par défaut).
      const rang = new Map(ordreNotes.map((id, index) => [id, index] as const));
      const libres = notesUnifiees
        .filter((n) => n.type === "libre")
        .sort((a, b) => {
          const ra = rang.has(a.id) ? (rang.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
          const rb = rang.has(b.id) ? (rang.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
          return ra - rb;
        });
      const guides = notesUnifiees.filter((n) => n.type !== "libre");
      return [...libres, ...guides];
    }
    return notesUnifiees;
  }, [notesUnifiees, triNotes, ordreNotes]);

  // Nombre de notes libres dont la position a été modifiée manuellement par
  // rapport à l'ordre naturel (les autres restent à leur place).
  const notesReordonnees = useMemo(() => {
    if (ordreNotes.length === 0) return 0;
    return idsNotesLibres.filter((id, index) => {
      const rang = ordreNotes.indexOf(id);
      return rang !== -1 && rang !== index;
    }).length;
  }, [ordreNotes, idsNotesLibres]);

  // Idem pour les favoris : nombre de guides dont la position diffère de l'ordre
  // « Plus récents » naturel (référence affichée par défaut).
  const favorisReordonnees = useMemo(() => {
    if (ordreFavoris.length === 0) return 0;
    const naturel = [...favoris].sort((a, b) => dateFavori(b.slug) - dateFavori(a.slug));
    return naturel.filter((a, index) => {
      const rang = ordreFavoris.indexOf(a.slug);
      return rang !== -1 && rang !== index;
    }).length;
  }, [favoris, ordreFavoris]);

  // Listes des éléments réellement déplacés (identifiants), dans l'ordre
  // d'origine, pour pouvoir les prévisualiser un par un avant de réinitialiser.
  const favorisDeplaces = useMemo(() => {
    if (ordreFavoris.length === 0) return [];
    const naturel = [...favoris].sort((a, b) => dateFavori(b.slug) - dateFavori(a.slug));
    return naturel
      .filter((a, index) => {
        const rang = ordreFavoris.indexOf(a.slug);
        return rang !== -1 && rang !== index;
      })
      .map((a) => a.slug);
  }, [favoris, ordreFavoris]);

  const notesDeplacees = useMemo(() => {
    if (ordreNotes.length === 0) return [];
    return idsNotesLibres.filter((id, index) => {
      const rang = ordreNotes.indexOf(id);
      return rang !== -1 && rang !== index;
    });
  }, [ordreNotes, idsNotesLibres]);

  const totalReordonnes = favorisReordonnees + notesReordonnees;

  // Intervalles effectifs du défilement automatique : on part du preset choisi
  // pour chaque panneau, raccourci quand il y a beaucoup d'éléments à parcourir.
  const intervalleApercuFav = useMemo(() => {
    const base = VITESSES_APERCU.find((v) => v.id === vitesseFav)?.base ?? 1400;
    const nb = Math.max(favorisDeplaces.length, 1);
    return Math.max(600, Math.min(base, Math.round(9000 / nb)));
  }, [vitesseFav, favorisDeplaces.length]);

  const intervalleApercuNotes = useMemo(() => {
    const base = VITESSES_APERCU.find((v) => v.id === vitesseNotes)?.base ?? 1400;
    const nb = Math.max(notesDeplacees.length, 1);
    return Math.max(600, Math.min(base, Math.round(9000 / nb)));
  }, [vitesseNotes, notesDeplacees.length]);

  const libelleVitesseFav = VITESSES_APERCU.find((v) => v.id === vitesseFav)?.label ?? "Normal";
  const libelleVitesseNotes = VITESSES_APERCU.find((v) => v.id === vitesseNotes)?.label ?? "Normal";
  const baseVitesseFav = VITESSES_APERCU.find((v) => v.id === vitesseFav)?.base ?? 1400;
  const baseVitesseNotes = VITESSES_APERCU.find((v) => v.id === vitesseNotes)?.base ?? 1400;

  const cycleVitesseFav = () => {
    const index = VITESSES_APERCU.findIndex((v) => v.id === vitesseFav);
    setVitesseFav(VITESSES_APERCU[(index + 1) % VITESSES_APERCU.length].id);
  };

  const cycleVitesseNotes = () => {
    const index = VITESSES_APERCU.findIndex((v) => v.id === vitesseNotes);
    setVitesseNotes(VITESSES_APERCU[(index + 1) % VITESSES_APERCU.length].id);
  };

  // Tri des favoris : plus récents (date d'ajout), par métier (A→Z) ou temps de lecture.
  const favorisTries = useMemo(() => {
    const arr = [...favorisFiltres];
    if (tri === "metier") arr.sort((a, b) => nomMetier(a).localeCompare(nomMetier(b), "fr"));
    else if (tri === "temps") arr.sort((a, b) => readingMinutes(a) - readingMinutes(b));
    else if (tri === "titre")
      arr.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase(), "fr"));
    else if (tri === "manuel") {
      const rang = new Map(ordreFavoris.map((slug, index) => [slug, index] as const));
      arr.sort((a, b) => {
        const ra = rang.has(a.slug) ? (rang.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
        const rb = rang.has(b.slug) ? (rang.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return dateFavori(b.slug) - dateFavori(a.slug);
      });
    } else arr.sort((a, b) => dateFavori(b.slug) - dateFavori(a.slug));
    return arr;
  }, [favorisFiltres, tri, ordreFavoris]);

  const demarrerDrag = (slug: string) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", slug);
    setDragSlug(slug);
  };

  const finirDrag = () => {
    setDragSlug(null);
    setSurvolSlug(null);
  };

  const survolerCarte = (slug: string) => (event: DragEvent<HTMLElement>) => {
    if (!dragSlug || dragSlug === slug) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (survolSlug !== slug) setSurvolSlug(slug);
  };

  const deposerCarte = (slug: string) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const source = dragSlug || event.dataTransfer.getData("text/plain");
    setDragSlug(null);
    setSurvolSlug(null);
    if (!source || source === slug) return;
    // Un nouveau tri manuel démarre : on ferme tout de suite le halo vert éventuel.
    annulerHighlights();
    setApercuFav(null);
    setApercuFavAuto(false);
    const ordreCourant = favorisTries.map((a) => a.slug);
    setOrdreFavoris(reordonner(ordreCourant, source, slug));
    if (tri !== "manuel") setTri("manuel");
    setToast("Ordre des favoris enregistré.");
  };

  // Fait clignoter brièvement en vert les cartes qui reprennent leur position
  // d'origine après une réinitialisation de l'ordre.
  const flashHighlights = (slugFavoris: string[], idsNotes: string[]) => {
    setHighlightFav(slugFavoris);
    setHighlightNotes(idsNotes);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightFav([]);
      setHighlightNotes([]);
    }, 1700);
  };

  // Coupe immédiatement la surbrillance verte en cours (par ex. si l'utilisateur
  // relance un nouveau tri manuel avant la fin de l'animation).
  const annulerHighlights = () => {
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
      highlightTimer.current = null;
    }
    setHighlightFav([]);
    setHighlightNotes([]);
  };

  // Aperçu « un par un » des favoris déplacés : met en avant le premier élément
  // qui reprendra sa position d'origine, puis permet de passer au suivant.
  const demarrerApercuFavoris = () => {
    annulerHighlights();
    if (favorisDeplaces.length === 0) return;
    setApercuFav(0);
  };

  const naviguerApercuFavoris = (pas: number) => {
    if (apercuFav === null) return;
    const total = favorisDeplaces.length;
    setApercuFav((apercuFav + pas + total) % total);
  };

  const fermerApercuFavoris = () => {
    setApercuFav(null);
    setApercuFavAuto(false);
    annulerHighlights();
  };

  const basculerApercuFavorisAuto = () => setApercuFavAuto((v) => !v);

  // Idem pour les notes libres déplacées.
  const demarrerApercuNotes = () => {
    annulerHighlights();
    if (notesDeplacees.length === 0) return;
    setApercuNotes(0);
  };

  const naviguerApercuNotes = (pas: number) => {
    if (apercuNotes === null) return;
    const total = notesDeplacees.length;
    setApercuNotes((apercuNotes + pas + total) % total);
  };

  const fermerApercuNotes = () => {
    setApercuNotes(null);
    setApercuNotesAuto(false);
    annulerHighlights();
  };

  const basculerApercuNotesAuto = () => setApercuNotesAuto((v) => !v);

  // La surbrillance suit l'élément actuellement prévisualisé.
  useEffect(() => {
    if (apercuFav !== null && favorisDeplaces[apercuFav]) {
      setHighlightFav([favorisDeplaces[apercuFav]]);
    }
  }, [apercuFav, favorisDeplaces]);

  useEffect(() => {
    if (apercuNotes !== null && notesDeplacees[apercuNotes]) {
      setHighlightNotes([notesDeplacees[apercuNotes]]);
    }
  }, [apercuNotes, notesDeplacees]);

  // Position d'aperçu mémorisée : on la borne à la liste réelle (ou on la ferme
  // s'il n'y a plus d'éléments déplacés), pour reprendre là où on l'avait laissée.
  useEffect(() => {
    if (apercuFav === null) return;
    if (favorisDeplaces.length === 0) setApercuFav(null);
    else if (apercuFav >= favorisDeplaces.length) setApercuFav(favorisDeplaces.length - 1);
  }, [apercuFav, favorisDeplaces.length]);

  useEffect(() => {
    if (apercuNotes === null) return;
    if (notesDeplacees.length === 0) setApercuNotes(null);
    else if (apercuNotes >= notesDeplacees.length) setApercuNotes(notesDeplacees.length - 1);
  }, [apercuNotes, notesDeplacees.length]);

  // Mode aperçu automatique : fait défiler les éléments déplacés l'un après
  // l'autre tant qu'il est actif, pour les repérer sans cliquer. Chaque panneau
  // a sa propre vitesse.
  useEffect(() => {
    if (!apercuFavAuto) return;
    const id = window.setInterval(() => {
      setApercuFav((cur) => {
        if (cur === null || favorisDeplaces.length === 0) return cur;
        return (cur + 1) % favorisDeplaces.length;
      });
    }, intervalleApercuFav);
    return () => window.clearInterval(id);
  }, [apercuFavAuto, favorisDeplaces.length, intervalleApercuFav]);

  useEffect(() => {
    if (!apercuNotesAuto) return;
    const id = window.setInterval(() => {
      setApercuNotes((cur) => {
        if (cur === null || notesDeplacees.length === 0) return cur;
        return (cur + 1) % notesDeplacees.length;
      });
    }, intervalleApercuNotes);
    return () => window.clearInterval(id);
  }, [apercuNotesAuto, notesDeplacees.length, intervalleApercuNotes]);

  // Pilotage clavier de l'aperçu : ← / → pour naviguer, Espace pour
  // lecture/pause et Échap pour tout fermer d'un coup.
  useEffect(() => {
    if (apercuFav === null && apercuNotes === null) return;
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (
        cible &&
        (cible.tagName === "INPUT" ||
          cible.tagName === "TEXTAREA" ||
          cible.tagName === "SELECT" ||
          cible.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (apercuFav !== null) naviguerApercuFavoris(-1);
        if (apercuNotes !== null) naviguerApercuNotes(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (apercuFav !== null) naviguerApercuFavoris(1);
        if (apercuNotes !== null) naviguerApercuNotes(1);
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (apercuFav !== null) basculerApercuFavorisAuto();
        if (apercuNotes !== null) basculerApercuNotesAuto();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (apercuFav !== null) fermerApercuFavoris();
        if (apercuNotes !== null) fermerApercuNotes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apercuFav, apercuNotes, favorisDeplaces, notesDeplacees]);

  // Mémorise l'ordre personnalisé courant pour pouvoir l'annuler juste après
  // une réinitialisation (bouton « Annuler » éphémère).
  const memoriserOrdreActuel = () => {
    setUndoOrdre({ favoris: ordreFavoris, notes: ordreNotes, tri, triNotes });
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoOrdre(null), 15000);
  };

  // Restaure l'ordre personnalisé effacé par la dernière réinitialisation.
  const annulerReinitialisation = () => {
    if (!undoOrdre) return;
    if (undoTimer.current) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setOrdreFavoris(undoOrdre.favoris);
    setOrdreNotes(undoOrdre.notes);
    setTri(undoOrdre.tri);
    setTriNotes(undoOrdre.triNotes);
    flashHighlights(undoOrdre.favoris, undoOrdre.notes);
    setUndoOrdre(null);
    setToast("Ordre personnalisé restauré.");
  };

  // Rétablit le tri automatique « Plus récents » et efface l'ordre manuel.
  const reinitialiserOrdreFavoris = () => {
    memoriserOrdreActuel();
    setApercuFav(null);
    setApercuFavAuto(false);
    flashHighlights(ordreFavoris, []);
    setOrdreFavoris([]);
    setTri("recents");
    setToast("Ordre d'origine rétabli.");
  };

  // Idem pour les notes libres : on vide l'ordre personnalisé d'un clic.
  const reinitialiserOrdreNotes = () => {
    memoriserOrdreActuel();
    setApercuNotes(null);
    setApercuNotesAuto(false);
    flashHighlights([], ordreNotes);
    setOrdreNotes([]);
    setTriNotes("recents");
    setToast("Ordre d'origine rétabli.");
  };

  // Rétablit d'un seul clic l'ordre d'origine des favoris ET des notes libres.
  const reinitialiserTousLesOrdres = () => {
    memoriserOrdreActuel();
    setApercuFav(null);
    setApercuNotes(null);
    setApercuFavAuto(false);
    setApercuNotesAuto(false);
    flashHighlights(ordreFavoris, ordreNotes);
    setOrdreFavoris([]);
    setOrdreNotes([]);
    setTri("recents");
    setTriNotes("recents");
    setToast("Ordre d'origine rétabli (favoris et notes).");
  };

  // Même action, accessible directement depuis la fenêtre « Tout effacer ».
  const reinitialiserTrisDepuisModal = () => {
    reinitialiserTousLesOrdres();
    setConfirmOpen(false);
  };

  // Vrai dès qu'un ordre personnalisé (favoris ou notes) est actif.
  const ordrePersonnaliseActif = ordreFavoris.length > 0 || ordreNotes.length > 0;

  // Remet toutes les préférences d'affichage (tris, vitesses, épinglages et
  // position d'aperçu) à leurs valeurs par défaut.
  const reinitialiserPreferences = () => {
    reinitialiserPreferencesBiblio();
    setTri("recents");
    setTriNotes("recents");
    setEpingleTriFav(false);
    setEpingleTriNotes(false);
    setVitesseFav("normal");
    setVitesseNotes("normal");
    setApercuFav(null);
    setApercuNotes(null);
    setApercuFavAuto(false);
    setApercuNotesAuto(false);
    setToast("Préférences d'affichage réinitialisées.");
  };

  const demarrerDragNote = (id: string) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDragNoteId(id);
  };

  const finirDragNote = () => {
    setDragNoteId(null);
    setSurvolNoteId(null);
  };

  const survolerNote = (id: string) => (event: DragEvent<HTMLElement>) => {
    if (!dragNoteId || dragNoteId === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (survolNoteId !== id) setSurvolNoteId(id);
  };

  const deposerNote = (id: string) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const source = dragNoteId || event.dataTransfer.getData("text/plain");
    setDragNoteId(null);
    setSurvolNoteId(null);
    if (!source || source === id) return;
    // Un nouveau tri manuel démarre : on ferme tout de suite le halo vert éventuel.
    annulerHighlights();
    setApercuNotes(null);
    setApercuNotesAuto(false);
    // On part de l'ordre affiché des notes libres pour refléter ce que l'utilisateur voit.
    const ordreCourant = notesOrdonnees.filter((n) => n.type === "libre").map((n) => n.id);
    setOrdreNotes(reordonner(ordreCourant, source, id));
    if (triNotes !== "manuel") setTriNotes("manuel");
    setToast("Ordre des notes enregistré.");
  };

  // Pagination des favoris.
  const totalPages = Math.max(1, Math.ceil(favorisTries.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const favorisPage = favorisTries.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const totalLus = useMemo(
    () => articles.filter((a) => getStatut(a.slug) === "lu").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionLecture]
  );

  const aucuneDonnee =
    favoris.length === 0 && notes.length === 0 && notesLibres.length === 0 && nouvellesNotes.length === 0;
  const aucunResultat =
    favorisFiltres.length === 0 && notesFiltrees.length === 0 && notesLibresFiltrees.length === 0;

  const effacerTout = () => {
    toutEffacerBibliotheque();
    setNouvellesNotes([]);
    setConfirmOpen(false);
    setVue("tout");
    setToast("Favoris et notes effacés.");
  };

  const ajouterNoteLibre = () => {
    setNouvellesNotes((prev) => [nouvelIdNoteLibre(), ...prev]);
    setVue("notes");
  };

  const retirerNoteLibre = (id: string) => {
    setNouvellesNotes((prev) => prev.filter((x) => x !== id));
  };

  const afficherFavoris = vue === "tout" || vue === "favoris";
  const afficherNotes = vue === "tout" || vue === "notes";

  // Le glisser-déposer est proposé dans la vue Favoris, hors recherche.
  const dragActif = afficherFavoris && q === "" && favorisFiltres.length > 1;
  // Idem pour les notes libres : on ne réordonne que hors recherche.
  const dragNoteActif = afficherNotes && q === "" && notesLibresFiltrees.length > 1;

  const compteurs: Record<VueBiblio, number> = {
    tout: favoris.length + notes.length + idsNotesLibres.length,
    favoris: favoris.length,
    notes: notes.length + idsNotesLibres.length,
  };

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        {/* En-tête */}
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-12 md:pt-16 pb-11 md:pb-14">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/ressources" className="hover:text-foreground-900 cursor-pointer">
                Ressources
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Ma bibliothèque</span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-bookmark-3-line"></i>
                  Votre espace personnel
                </span>
                <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                  Ma bibliothèque
                </h1>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  Tous vos guides mis de côté et toutes vos notes réunis ici. Retrouvez une remarque de
                  terrain, relisez une astuce et gardez vos références sous la main.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={ajouterNoteLibre}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                >
                  <i className="ri-add-line"></i>
                  Nouvelle note
                </button>
                <ExporterMenu liste={favorisFiltres} fichier="favoris" />
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={aucuneDonnee}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-foreground-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Tout effacer
                </button>
                <button
                  type="button"
                  onClick={reinitialiserPreferences}
                  title="Remettre les tris, vitesses d'aperçu et épinglages aux valeurs par défaut"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-dashed border-background-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors"
                >
                  <i className="ri-restart-line"></i>
                  Réinitialiser les préférences
                </button>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-background-50 border border-background-200">
                <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-lg">
                  <i className="ri-bookmark-3-fill"></i>
                </span>
                <span>
                  <span className="block font-heading font-bold text-xl text-foreground-950 tabular-nums leading-none">
                    {favoris.length}
                  </span>
                  <span className="block text-xs text-foreground-500 mt-0.5">
                    favori{favoris.length > 1 ? "s" : ""}
                  </span>
                </span>
                {favorisReordonnees > 0 && (
                  <span
                    title={`Ordre personnalisé : ${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} réordonné${favorisReordonnees > 1 ? "s" : ""} à la main sur ${favoris.length}.`}
                    aria-label={`${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} réordonné${favorisReordonnees > 1 ? "s" : ""} à la main`}
                    className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-accent-100 border border-accent-200 text-accent-800 text-[11px] font-bold tabular-nums"
                  >
                    <i className="ri-drag-move-2-line"></i>
                    {favorisReordonnees}
                  </span>
                )}
              </span>
              <span
                title={
                  notesReordonnees > 0
                    ? `Ordre personnalisé : ${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnée${notesReordonnees > 1 ? "s" : ""} à la main sur ${idsNotesLibres.length}.`
                    : undefined
                }
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-background-50 border border-background-200"
              >
                <span className="w-9 h-9 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-lg">
                  <i className="ri-sticky-note-line"></i>
                </span>
                <span>
                  <span className="block font-heading font-bold text-xl text-foreground-950 tabular-nums leading-none">
                    {notes.length + idsNotesLibres.length}
                  </span>
                  <span className="block text-xs text-foreground-500 mt-0.5">
                    note{notes.length + idsNotesLibres.length > 1 ? "s" : ""}
                  </span>
                </span>
                {notesReordonnees > 0 && (
                  <span
                    aria-label={`${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnée${notesReordonnees > 1 ? "s" : ""} à la main`}
                    className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-secondary-100 border border-secondary-200 text-secondary-800 text-[11px] font-bold tabular-nums"
                  >
                    <i className="ri-drag-move-2-line"></i>
                    {notesReordonnees}
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-background-50 border border-background-200">
                <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-100 text-primary-700 text-lg">
                  <i className="ri-check-double-line"></i>
                </span>
                <span>
                  <span className="block font-heading font-bold text-xl text-foreground-950 tabular-nums leading-none">
                    {totalLus}
                  </span>
                  <span className="block text-xs text-foreground-500 mt-0.5">
                    guide{totalLus > 1 ? "s" : ""} lu{totalLus > 1 ? "s" : ""}
                  </span>
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* Barre recherche + vues */}
        <section className="group sticky top-16 md:top-18 z-40 w-full bg-background-50/95 backdrop-blur border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-3">
            <div className="flex flex-row flex-wrap items-center gap-2 lg:gap-3">
              <div className="relative flex-1 min-w-0 lg:max-w-2xl">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-foreground-500 text-base"></i>
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher dans mes favoris et mes notes…"
                  aria-label="Rechercher dans ma bibliothèque"
                  className="w-full h-11 pl-11 pr-11 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-500 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
                {recherche !== "" && (
                  <button
                    type="button"
                    onClick={() => setRecherche("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-foreground-500 hover:bg-background-200 hover:text-foreground-900 cursor-pointer transition-colors"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                )}
              </div>

              <label
                title="Ne chercher que dans le titre des notes libres"
                className={`hidden md:inline-flex items-center gap-2 h-11 px-3.5 rounded-md border shrink-0 cursor-pointer transition-colors ${
                  titreSeul
                    ? "bg-secondary-500 border-secondary-500 text-background-50"
                    : "bg-background-50 border-background-200 text-foreground-700 hover:border-secondary-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={titreSeul}
                  onChange={(e) => setTitreSeul(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-secondary-600"
                />
                <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
                  <i className="ri-text"></i>
                  Titre uniquement
                </span>
                {titreSeul && (
                  <span
                    title={`Résultats : ${notesLibresFiltrees.length} note${notesLibresFiltrees.length > 1 ? "s" : ""} libre${notesLibresFiltrees.length > 1 ? "s" : ""}`}
                    aria-label={`${notesLibresFiltrees.length} note${notesLibresFiltrees.length > 1 ? "s" : ""} libre${notesLibresFiltrees.length > 1 ? "s" : ""} correspondante${notesLibresFiltrees.length > 1 ? "s" : ""}`}
                    className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background-50 text-secondary-700 text-xs font-bold tabular-nums"
                  >
                    {notesLibresFiltrees.length}
                  </span>
                )}
              </label>

              <div className="inline-flex p-1 rounded-full bg-background-100 border border-background-200 shrink-0">
                {VUES.map((option) => {
                  const actif = vue === option.id;
                  // Petit compteur « réordonnés » propre à l'onglet, pour repérer
                  // d'un coup d'œil l'ordre personnalisé (Tout = favoris + notes).
                  const reordonnes =
                    option.id === "tout"
                      ? totalReordonnes
                      : option.id === "notes"
                        ? notesReordonnees
                        : option.id === "favoris"
                          ? favorisReordonnees
                          : 0;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setVue(option.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        actif
                          ? "bg-foreground-950 text-background-50 font-semibold"
                          : "text-foreground-600 hover:text-foreground-950"
                      }`}
                    >
                      <i className={option.icon}></i>
                      <span className="hidden sm:inline">{option.label}</span>
                      <span className={`hidden sm:inline ${actif ? "text-background-200" : "text-foreground-500"}`}>
                        {compteurs[option.id]}
                      </span>
                      {reordonnes > 0 && (
                        <span
                          title={`${reordonnes} élément${reordonnes > 1 ? "s" : ""} en ordre personnalisé`}
                          aria-label={`${reordonnes} élément${reordonnes > 1 ? "s" : ""} réordonné${reordonnes > 1 ? "s" : ""} à la main`}
                          className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${
                            actif
                              ? "bg-background-50/90 text-foreground-900"
                              : "bg-secondary-100 border border-secondary-200 text-secondary-800"
                          }`}
                        >
                          <i className="ri-drag-move-2-line"></i>
                          {reordonnes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {ordrePersonnaliseActif && (
                <button
                  type="button"
                  onClick={reinitialiserTousLesOrdres}
                  title={`Ordre personnalisé actif — ${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} et ${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnés à la main (${totalReordonnes} au total). Cliquez pour rétablir l'ordre d'origine.`}
                  aria-label={`Rétablir l'ordre d'origine : ${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} et ${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnés`}
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-3 sm:px-4 rounded-md border border-dashed border-foreground-300 bg-background-50 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-foreground-500 hover:text-foreground-950 transition-colors shrink-0"
                >
                  <i className="ri-arrow-go-back-line"></i>
                  <span className="hidden sm:inline">Rétablir l'ordre d'origine</span>
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-accent-100 border border-accent-200 text-accent-800 text-[11px] font-bold tabular-nums">
                    {totalReordonnes}
                  </span>
                </button>
              )}

              {undoOrdre !== null && (
                <button
                  type="button"
                  onClick={annulerReinitialisation}
                  title="Restaurer l'ordre personnalisé que vous venez d'effacer"
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-3 sm:px-4 rounded-md border border-dashed border-secondary-300 bg-secondary-100/70 text-secondary-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-secondary-500 hover:bg-secondary-100 transition-colors shrink-0"
                >
                  <i className="ri-arrow-go-forward-line"></i>
                  <span className="hidden sm:inline">Annuler la réinitialisation</span>
                  <span className="sm:hidden">Annuler</span>
                </button>
              )}

              {/* Raccourci discret : remet les préférences d'affichage par défaut
                  sans devoir remonter jusqu'au gros bouton de l'en-tête. Il se
                  révèle au survol sur grand écran, reste visible sur mobile et
                  apparaît au focus clavier. */}
              <button
                type="button"
                onClick={reinitialiserPreferences}
                title="Réinitialiser les préférences d'affichage : tris, vitesses d'aperçu, épinglages et mode lecture/pause"
                aria-label="Réinitialiser les préférences d'affichage"
                className="ml-auto inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md border border-dashed border-background-300 bg-background-50 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100 transition-opacity shrink-0"
              >
                <i className="ri-restart-line"></i>
                <span className="hidden lg:inline">Réinitialiser</span>
              </button>
            </div>
            {q !== "" && (
              <p className="hidden md:block mt-2.5 text-xs text-foreground-500">
                {favorisFiltres.length} favori{favorisFiltres.length > 1 ? "s" : ""} · {notesFiltrees.length} note
                {notesFiltrees.length > 1 ? "s" : ""} pour « {recherche.trim()} »
                {titreSeul && " · titres des notes libres uniquement"}
              </p>
            )}
          </div>
        </section>

        {aucuneDonnee ? (
          <section className="w-full bg-background-50">
            <div className="w-full px-4 md:px-8 lg:px-12 py-20">
              <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-lg border border-dashed border-background-300 bg-background-50 max-w-2xl mx-auto">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                  <i className="ri-bookmark-3-line"></i>
                </span>
                <h2 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                  Votre bibliothèque est vide
                </h2>
                <p className="mt-2 text-sm text-foreground-600 max-w-md">
                  Épinglez un guide avec le signet (🔖) ou laissez une note en bas d'un guide : tout
                  apparaîtra ici, prêt à être retrouvé.
                </p>
                <Link
                  to="/ressources"
                  className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-book-open-line"></i>
                  Parcourir les guides
                </Link>
              </div>
            </div>
          </section>
        ) : aucunResultat ? (
          <section className="w-full bg-background-50">
            <div className="w-full px-4 md:px-8 lg:px-12 py-20">
              <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-lg border border-dashed border-background-300 bg-background-50 max-w-2xl mx-auto">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                  <i className="ri-search-eye-line"></i>
                </span>
                <h2 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                  Aucun résultat
                </h2>
                <p className="mt-2 text-sm text-foreground-600 max-w-md">
                  Aucun favori ni note ne correspond à « {recherche.trim()} ». Essayez un autre mot-clé ou
                  effacez la recherche.
                </p>
                <button
                  type="button"
                  onClick={() => setRecherche("")}
                  className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Effacer la recherche
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {afficherFavoris && (
              <section className="w-full bg-background-50 border-b border-background-200">
                <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-14">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-7">
                    <div>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                        <i className="ri-bookmark-3-fill"></i>
                        Épinglés pour plus tard
                      </span>
                      <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                        Mes favoris
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-accent-100 border border-accent-200 text-xs font-semibold text-accent-900 whitespace-nowrap">
                      <i className="ri-bookmark-3-line"></i>
                      {favorisFiltres.length} guide{favorisFiltres.length > 1 ? "s" : ""}
                      {favorisReordonnees > 0 && (
                        <span
                          title={`Ordre personnalisé : ${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} réordonné${favorisReordonnees > 1 ? "s" : ""} à la main sur ${favoris.length}.`}
                          aria-label={`${favorisReordonnees} favori${favorisReordonnees > 1 ? "s" : ""} réordonné${favorisReordonnees > 1 ? "s" : ""} à la main`}
                          className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-background-50 border border-accent-200 text-accent-800 text-[11px] font-bold tabular-nums"
                        >
                          <i className="ri-drag-move-2-line"></i>
                          {favorisReordonnees}
                        </span>
                      )}
                    </span>
                  </div>

                  {favorisFiltres.length === 0 ? (
                    <p className="text-sm text-foreground-600">
                      Aucun favori{q !== "" ? " ne correspond à votre recherche" : " pour l'instant"}. Épinglez
                      un guide avec le signet pour le retrouver ici.
                    </p>
                  ) : (
                    <>
                      <div
                        className={`flex flex-wrap items-center gap-2 mb-6 ${
                          epingleTriFav
                            ? "sticky top-[8.25rem] md:top-[8.75rem] z-30 -mt-2.5 px-3 py-2.5 rounded-lg border border-background-200 bg-background-50/95 backdrop-blur"
                            : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">
                          <i className="ri-sort-desc"></i>
                          Trier
                        </span>
                        {epingleTriFav && (
                          <span
                            title="Barre de tri épinglée : elle reste visible pendant le défilement"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap"
                          >
                            <i className="ri-pushpin-2-fill"></i>
                            Épinglée
                          </span>
                        )}
                        {TRIS.map((option) => {
                          const actif = tri === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setTri(option.id)}
                              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                                actif
                                  ? "bg-accent-500 text-background-50 border-accent-500"
                                  : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
                              }`}
                            >
                              <i className={option.icon}></i>
                              {option.label}
                            </button>
                          );
                        })}
                        {tri === "manuel" && (
                          <button
                            type="button"
                            onClick={reinitialiserOrdreFavoris}
                            title="Revenir au tri « Plus récents » et effacer l'ordre personnalisé"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border border-dashed border-foreground-300 bg-background-50 text-foreground-700 hover:border-foreground-500 hover:text-foreground-950 transition-colors"
                          >
                            <i className="ri-arrow-go-back-line"></i>
                            Rétablir l'ordre d'origine
                          </button>
                        )}
                        {tri === "manuel" && favorisDeplaces.length > 0 && (
                          <button
                            type="button"
                            onClick={apercuFav === null ? demarrerApercuFavoris : fermerApercuFavoris}
                            title="Prévisualiser un par un les guides qui reprendront leur position d'origine"
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                              apercuFav === null
                                ? "border-dashed border-accent-300 bg-background-50 text-accent-800 hover:border-accent-500"
                                : "bg-accent-100 border-accent-300 text-accent-900"
                            }`}
                          >
                            <i className={apercuFav === null ? "ri-eye-line" : "ri-close-line"}></i>
                            {apercuFav === null ? "Aligner sur l'ordre d'origine" : "Fermer l'aperçu"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEpingleTriFav((v) => !v)}
                          title={
                            epingleTriFav
                              ? "Détacher la barre de tri des favoris"
                              : "Épingler la barre de tri pour la garder visible pendant le défilement"
                          }
                          aria-pressed={epingleTriFav}
                          className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                            epingleTriFav
                              ? "bg-accent-500 text-background-50 border-accent-500"
                              : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
                          }`}
                        >
                          <i className={epingleTriFav ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                          {epingleTriFav ? "Épinglée" : "Épingler"}
                        </button>
                      </div>

                      {apercuFav !== null && favorisDeplaces.length > 0 && (
                        <div className="mb-6 -mt-3 flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border border-accent-200 bg-accent-100/60">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-900 whitespace-nowrap">
                            <i className="ri-eye-line"></i>
                            Aperçu {apercuFav + 1} / {favorisDeplaces.length}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-800">
                            {articles.find((a) => a.slug === favorisDeplaces[apercuFav])?.title ?? "Guide"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={basculerApercuFavorisAuto}
                              aria-pressed={apercuFavAuto}
                              aria-label={apercuFavAuto ? "Arrêter le défilement automatique" : "Défiler automatiquement les éléments déplacés"}
                              title={apercuFavAuto ? "Arrêter le défilement automatique" : "Défiler automatiquement les éléments déplacés"}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full border cursor-pointer transition-colors ${
                                apercuFavAuto
                                  ? "bg-accent-500 border-accent-500 text-background-50"
                                  : "bg-background-50 border-accent-200 text-accent-800 hover:bg-accent-100"
                              }`}
                            >
                              <i className={apercuFavAuto ? "ri-pause-line" : "ri-play-line"}></i>
                            </button>
                            <button
                              type="button"
                              onClick={cycleVitesseFav}
                              title={`Vitesse du défilement automatique : ${libelleVitesseFav} (cliquez pour changer)`}
                              aria-label={`Vitesse du défilement automatique : ${libelleVitesseFav}. Cliquez pour changer.`}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors"
                            >
                              <i className="ri-speed-up-line"></i>
                              <span className="hidden sm:inline">{libelleVitesseFav}</span>
                            </button>
                            <span
                              title={`Vitesse adaptée au nombre d'éléments (${favorisDeplaces.length}). ${formuleIntervalle(baseVitesseFav, favorisDeplaces.length)}`}
                              aria-label={`Intervalle effectif du défilement automatique : ${libelleIntervalle(intervalleApercuFav)}. Formule d'adaptation : 9 000 ms divisées par le nombre d'éléments, bornées entre 600 ms et la vitesse choisie.`}
                              className="hidden md:inline text-[11px] text-foreground-500 tabular-nums whitespace-nowrap"
                            >
                              {libelleIntervalle(intervalleApercuFav)}
                            </span>
                            <button
                              type="button"
                              onClick={() => naviguerApercuFavoris(-1)}
                              aria-label="Élément déplacé précédent"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-accent-200 text-accent-800 cursor-pointer hover:bg-accent-100 transition-colors"
                            >
                              <i className="ri-arrow-left-s-line"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => naviguerApercuFavoris(1)}
                              aria-label="Élément déplacé suivant"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-accent-200 text-accent-800 cursor-pointer hover:bg-accent-100 transition-colors"
                            >
                              <i className="ri-arrow-right-s-line"></i>
                            </button>
                            <button
                              type="button"
                              onClick={reinitialiserOrdreFavoris}
                              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                            >
                              <i className="ri-arrow-go-back-line"></i>
                              Rétablir
                            </button>
                            <button
                              type="button"
                              onClick={fermerApercuFavoris}
                              aria-label="Fermer l'aperçu"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-accent-200 text-accent-800 cursor-pointer hover:bg-accent-100 transition-colors"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                          <span className="hidden lg:inline text-[11px] text-foreground-500 whitespace-nowrap">
                            ← → naviguer · Espace lecture/pause · Échap fermer
                          </span>
                        </div>
                      )}

                      {dragActif && (
                        <p className="mb-5 -mt-3 inline-flex items-center gap-2 text-xs text-foreground-500">
                          <i className="ri-drag-move-2-line text-primary-600"></i>
                          Glissez-déposez une carte pour réordonner vos favoris (mémorisé en tri « Personnalisé »).
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {favorisPage.map((article) => (
                          <ArticleCard
                            key={article.slug}
                            article={article}
                            showMarquerLu
                            highlight={recherche.trim()}
                            highlighted={highlightFav.includes(article.slug)}
                            draggable={dragActif}
                            dragging={dragSlug === article.slug}
                            dragOver={survolSlug === article.slug && dragSlug !== null && dragSlug !== article.slug}
                            onDragStart={demarrerDrag(article.slug)}
                            onDragEnd={finirDrag}
                            onDragOver={survolerCarte(article.slug)}
                            onDrop={deposerCarte(article.slug)}
                          />
                        ))}
                      </div>

                      {totalPages > 1 && (
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={pageCourante === 1}
                            aria-label="Page précédente"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-background-50 border border-background-200 text-foreground-700 cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <i className="ri-arrow-left-s-line"></i>
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPage(n)}
                              aria-label={`Page ${n}`}
                              aria-current={n === pageCourante ? "page" : undefined}
                              className={`inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                                n === pageCourante
                                  ? "bg-foreground-950 text-background-50 border-foreground-950"
                                  : "bg-background-50 text-foreground-700 border-background-200 hover:bg-background-200"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={pageCourante === totalPages}
                            aria-label="Page suivante"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-background-50 border border-background-200 text-foreground-700 cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <i className="ri-arrow-right-s-line"></i>
                          </button>
                          <span className="ml-1 text-xs text-foreground-500 tabular-nums">
                            Page {pageCourante} / {totalPages}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {afficherNotes && (
              <section className={`w-full ${afficherFavoris ? "bg-background-100" : "bg-background-50"}`}>
                <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-14">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-7">
                    <div>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700">
                        <i className="ri-sticky-note-line"></i>
                        Votre carnet de terrain
                      </span>
                      <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                        Mes notes
                      </h2>
                      <p className="mt-2 text-sm text-foreground-600 max-w-xl">
                        Chaque note reste attachée à son guide — ou créez une note libre pour un pense-bête
                        sans lien avec un guide. Modifiez tout ici, l'enregistrement est automatique.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-100 border border-secondary-200 text-xs font-semibold text-secondary-900 whitespace-nowrap">
                        <i className="ri-sticky-note-line"></i>
                        {notes.length + idsNotesLibres.length} note{notes.length + idsNotesLibres.length > 1 ? "s" : ""}
                        {notesReordonnees > 0 && (
                          <span
                            title={`Ordre personnalisé : ${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnée${notesReordonnees > 1 ? "s" : ""} à la main sur ${idsNotesLibres.length}.`}
                            aria-label={`${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnée${notesReordonnees > 1 ? "s" : ""} à la main`}
                            className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 text-[11px] font-bold tabular-nums"
                          >
                            <i className="ri-drag-move-2-line"></i>
                            {notesReordonnees}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={ajouterNoteLibre}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                      >
                        <i className="ri-add-line"></i>
                        Nouvelle note
                      </button>
                    </div>
                  </div>

                  <div
                    className={`flex flex-wrap items-center gap-2 mb-6 ${
                      epingleTriNotes
                        ? "sticky top-[8.25rem] md:top-[8.75rem] z-30 -mt-2.5 px-3 py-2.5 rounded-lg border border-background-200 bg-background-100/95 backdrop-blur"
                        : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">
                      <i className="ri-sort-desc"></i>
                      Trier
                    </span>
                    {epingleTriNotes && (
                      <span
                        title="Barre de tri épinglée : elle reste visible pendant le défilement"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-secondary-500 text-background-50 text-[11px] font-bold whitespace-nowrap"
                      >
                        <i className="ri-pushpin-2-fill"></i>
                        Épinglée
                      </span>
                    )}
                    {TRIS_NOTES.map((option) => {
                      const actif = triNotes === option.id;
                      const montrerCompteur = option.id === "manuel" && notesReordonnees > 0;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTriNotes(option.id)}
                          title={
                            montrerCompteur
                              ? `${notesReordonnees} note${notesReordonnees > 1 ? "s" : ""} libre${notesReordonnees > 1 ? "s" : ""} réordonnée${notesReordonnees > 1 ? "s" : ""} à la main`
                              : undefined
                          }
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                            actif
                              ? "bg-secondary-500 text-background-50 border-secondary-500"
                              : "bg-background-50 text-foreground-600 border-background-200 hover:border-secondary-300 hover:text-secondary-700"
                          }`}
                        >
                          <i className={option.icon}></i>
                          {option.label}
                          {montrerCompteur && (
                            <span
                              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${
                                actif
                                  ? "bg-background-50 text-secondary-700"
                                  : "bg-secondary-100 text-secondary-800"
                              }`}
                            >
                              {notesReordonnees}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {triNotes === "manuel" && (
                      <button
                        type="button"
                        onClick={reinitialiserOrdreNotes}
                        title="Revenir au tri « Plus récents » et effacer l'ordre personnalisé des notes libres"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border border-dashed border-foreground-300 bg-background-50 text-foreground-700 hover:border-foreground-500 hover:text-foreground-950 transition-colors"
                      >
                        <i className="ri-arrow-go-back-line"></i>
                        Rétablir l'ordre d'origine
                      </button>
                    )}
                    {triNotes === "manuel" && notesDeplacees.length > 0 && (
                      <button
                        type="button"
                        onClick={apercuNotes === null ? demarrerApercuNotes : fermerApercuNotes}
                        title="Prévisualiser une par une les notes qui reprendront leur position d'origine"
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                          apercuNotes === null
                            ? "border-dashed border-secondary-300 bg-background-50 text-secondary-800 hover:border-secondary-500"
                            : "bg-secondary-100 border-secondary-300 text-secondary-900"
                        }`}
                      >
                        <i className={apercuNotes === null ? "ri-eye-line" : "ri-close-line"}></i>
                        {apercuNotes === null ? "Aligner sur l'ordre d'origine" : "Fermer l'aperçu"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEpingleTriNotes((v) => !v)}
                      title={
                        epingleTriNotes
                          ? "Détacher la barre de tri des notes"
                          : "Épingler la barre de tri pour la garder visible pendant le défilement"
                      }
                      aria-pressed={epingleTriNotes}
                      className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                        epingleTriNotes
                          ? "bg-secondary-500 text-background-50 border-secondary-500"
                          : "bg-background-50 text-foreground-600 border-background-200 hover:border-secondary-300 hover:text-secondary-700"
                      }`}
                    >
                      <i className={epingleTriNotes ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                      {epingleTriNotes ? "Épinglée" : "Épingler"}
                    </button>
                  </div>

                  {apercuNotes !== null && notesDeplacees.length > 0 && (
                    <div className="mb-6 -mt-3 flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border border-secondary-200 bg-secondary-100/60">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-900 whitespace-nowrap">
                        <i className="ri-eye-line"></i>
                        Aperçu {apercuNotes + 1} / {notesDeplacees.length}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-800">
                        {getTitreNoteLibre(notesDeplacees[apercuNotes]) || "Note libre"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={basculerApercuNotesAuto}
                          aria-pressed={apercuNotesAuto}
                          aria-label={apercuNotesAuto ? "Arrêter le défilement automatique" : "Défiler automatiquement les éléments déplacés"}
                          title={apercuNotesAuto ? "Arrêter le défilement automatique" : "Défiler automatiquement les éléments déplacés"}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full border cursor-pointer transition-colors ${
                            apercuNotesAuto
                              ? "bg-secondary-500 border-secondary-500 text-background-50"
                              : "bg-background-50 border-secondary-200 text-secondary-800 hover:bg-secondary-100"
                          }`}
                        >
                          <i className={apercuNotesAuto ? "ri-pause-line" : "ri-play-line"}></i>
                        </button>
                        <button
                          type="button"
                          onClick={cycleVitesseNotes}
                          title={`Vitesse du défilement automatique : ${libelleVitesseNotes} (cliquez pour changer)`}
                          aria-label={`Vitesse du défilement automatique : ${libelleVitesseNotes}. Cliquez pour changer.`}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                        >
                          <i className="ri-speed-up-line"></i>
                          <span className="hidden sm:inline">{libelleVitesseNotes}</span>
                        </button>
                        <span
                          title={`Vitesse adaptée au nombre d'éléments (${notesDeplacees.length}). ${formuleIntervalle(baseVitesseNotes, notesDeplacees.length)}`}
                          aria-label={`Intervalle effectif du défilement automatique : ${libelleIntervalle(intervalleApercuNotes)}. Formule d'adaptation : 9 000 ms divisées par le nombre d'éléments, bornées entre 600 ms et la vitesse choisie.`}
                          className="hidden md:inline text-[11px] text-foreground-500 tabular-nums whitespace-nowrap"
                        >
                          {libelleIntervalle(intervalleApercuNotes)}
                        </span>
                        <button
                          type="button"
                          onClick={() => naviguerApercuNotes(-1)}
                          aria-label="Note déplacée précédente"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 cursor-pointer hover:bg-secondary-100 transition-colors"
                        >
                          <i className="ri-arrow-left-s-line"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => naviguerApercuNotes(1)}
                          aria-label="Note déplacée suivante"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 cursor-pointer hover:bg-secondary-100 transition-colors"
                        >
                          <i className="ri-arrow-right-s-line"></i>
                        </button>
                        <button
                          type="button"
                          onClick={reinitialiserOrdreNotes}
                          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                        >
                          <i className="ri-arrow-go-back-line"></i>
                          Rétablir
                        </button>
                        <button
                          type="button"
                          onClick={fermerApercuNotes}
                          aria-label="Fermer l'aperçu"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 cursor-pointer hover:bg-secondary-100 transition-colors"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                      <span className="hidden lg:inline text-[11px] text-foreground-500 whitespace-nowrap">
                        ← → naviguer · Espace lecture/pause · Échap fermer
                      </span>
                    </div>
                  )}

                  {dragNoteActif && (
                    <p className="mb-5 -mt-3 inline-flex items-center gap-2 text-xs text-foreground-500">
                      <i className="ri-drag-move-2-line text-secondary-600"></i>
                      Glissez une note libre par sa poignée pour la réordonner (mémorisé en tri
                      « Personnalisé »).
                    </p>
                  )}

                  {notesFiltrees.length === 0 && notesLibresFiltrees.length === 0 ? (
                    <p className="text-sm text-foreground-600">
                      Aucune note{q !== "" ? " ne correspond à votre recherche" : " pour l'instant"}. Ouvrez un
                      guide et laissez une note en bas de page, ou cliquez sur « Nouvelle note » ci-dessus.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {notesOrdonnees.map((note) =>
                        note.type === "libre" ? (
                          <NoteLibreCard
                            key={note.cle}
                            id={note.id}
                            onDelete={retirerNoteLibre}
                            highlighted={highlightNotes.includes(note.id)}
                            draggable={dragNoteActif}
                            dragging={dragNoteId === note.id}
                            dragOver={survolNoteId === note.id && dragNoteId !== null && dragNoteId !== note.id}
                            onDragStart={demarrerDragNote(note.id)}
                            onDragEnd={finirDragNote}
                            onDragOver={survolerNote(note.id)}
                            onDrop={deposerNote(note.id)}
                          />
                        ) : (
                          <NoteEditCard key={note.cle} slug={note.id} highlight={recherche.trim()} />
                        )
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-foreground-500">
            <i className="ri-arrow-left-line text-secondary-600"></i>
            <Link
              to="/ressources"
              className="inline-flex items-center gap-1 font-semibold text-secondary-700 hover:text-secondary-800 transition-colors cursor-pointer"
            >
              Retour aux ressources
            </Link>
          </div>
        </section>
      </main>

      {confirmOpen && (
        <Modal
          title="Tout effacer ?"
          subtitle="Favoris et notes personnelles"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={effacerTout}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-foreground-950 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-foreground-800 transition-colors"
              >
                <i className="ri-delete-bin-6-line"></i>
                Oui, tout effacer
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700 leading-relaxed">
            Vous allez supprimer <strong className="font-semibold">{favoris.length}</strong> favori
            {favoris.length > 1 ? "s" : ""} et{" "}
            <strong className="font-semibold">{notes.length + idsNotesLibres.length}</strong> note
            {notes.length + idsNotesLibres.length > 1 ? "s" : ""} personnelle
            {notes.length + idsNotesLibres.length > 1 ? "s" : ""}. Cette action est
            définitive et ne concerne que votre navigateur.
          </p>

          {ordrePersonnaliseActif && (
            <button
              type="button"
              onClick={reinitialiserTrisDepuisModal}
              className="mt-4 w-full flex items-center justify-between gap-3 p-3 rounded-md border border-background-200 bg-background-50 text-left cursor-pointer hover:border-secondary-300 hover:bg-background-100 transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-lg">
                  <i className="ri-arrow-go-back-line"></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground-950">
                    Réinitialiser les tris et ordres
                  </span>
                  <span className="block text-xs text-foreground-600">
                    Rétablit l'ordre d'origine des favoris et des notes libres, sans rien supprimer.
                  </span>
                </span>
              </span>
              <i className="ri-arrow-right-s-line shrink-0 text-foreground-400"></i>
            </button>
          )}

          {ordrePersonnaliseActif && (
            <div className="mt-3 rounded-md border border-background-200 bg-background-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground-600 uppercase tracking-wide">
                <i className="ri-list-check-2"></i>
                Reprendront leur position d'origine
              </p>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {favorisDeplaces.map((slug) => (
                  <li key={slug} className="flex items-center gap-2 text-xs text-foreground-700">
                    <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                      <i className="ri-bookmark-3-line"></i>
                    </span>
                    <span className="min-w-0 truncate">
                      {articles.find((a) => a.slug === slug)?.title ?? "Guide"}
                    </span>
                  </li>
                ))}
                {notesDeplacees.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-xs text-foreground-700">
                    <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                      <i className="ri-sticky-note-line"></i>
                    </span>
                    <span className="min-w-0 truncate">{getTitreNoteLibre(id) || "Note libre"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} icon="ri-delete-bin-6-line" />}

      <Footer />
    </div>
  );
}