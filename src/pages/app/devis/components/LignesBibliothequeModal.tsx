import { useEffect, useMemo, useState } from "react";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import { useCategoriesLignes } from "@/hooks/useCategoriesLignes";
import { useOrdreLignes } from "@/hooks/useOrdreLignes";
import { useLignesFavoris } from "@/hooks/useLignesFavoris";
import { formatEuros } from "@/lib/format";
import {
  CATALOGUE_LIGNES,
  CATEGORIES_LIGNES,
  catalogueVersInsertion,
  createLigneBibliotheque,
  normaliserDesignation,
  persoVersInsertion,
  type LigneAInserer,
  type LigneBibliothequeInput,
  type LigneCatalogue,
} from "@/lib/bibliothequeLignes";
import { afficherCategorie, construireCategories } from "@/lib/categoriesLignesPrefs";
import { trierParOrdre } from "@/lib/lignesOrdrePrefs";
import { trierParFavoris, type FavoriCle } from "@/lib/lignesFavorisPrefs";
import Modal from "@/pages/app/components/Modal";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import { ecrireOngletBiblioDevis, lireOngletBiblioDevis } from "@/lib/devisBiblioOngletPrefs";
import LigneFormModal from "@/pages/app/bibliotheque-lignes/components/LigneFormModal";

type Onglet = "perso" | "catalogue";

/** Une entrée prête à cocher dans le sélecteur (clé unique + données d'insertion). */
interface Entree {
  cle: string;
  /** Clé d'épinglage correspondante (id numérique pour le perso, clé pour le catalogue). */
  favoriCle: FavoriCle;
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva: number;
  categorie: string;
  origine: "perso" | "catalogue";
}

/**
 * Sélecteur de lignes pré-formatées : on coche une ou plusieurs lignes de la
 * bibliothèque (perso + catalogue métier) et on les insère d'un coup dans le devis.
 */
export default function LignesBibliothequeModal({
  userId,
  onClose,
  onInsert,
  designationsUtilisees = [],
}: {
  userId: string | null;
  onClose: () => void;
  onInsert: (lignes: LigneAInserer[]) => void;
  /** Désignations déjà présentes dans le devis en cours, pour les signaler. */
  designationsUtilisees?: string[];
}) {
  const { lignes, loading, error, reload } = useLignesBibliotheque(userId);
  const { prefs } = useCategoriesLignes();
  const { ordre } = useOrdreLignes();
  const { favoris } = useLignesFavoris();
  const [onglet, setOnglet] = useState<Onglet>(() => lireOngletBiblioDevis());
  const [query, setQuery] = useState("");
  const [categorie, setCategorie] = useState("Toutes");
  // N'afficher que les lignes épinglées, dans l'onglet actif.
  const [epingleesUniquement, setEpingleesUniquement] = useState(false);
  const [selection, setSelection] = useState<Record<string, LigneAInserer>>({});
  // Création d'une nouvelle ligne de bibliothèque directement depuis le sélecteur.
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Valeurs pré-remplies de la fenêtre de création (reprises d'une ligne du catalogue métier).
  const [valeursInitiales, setValeursInitiales] = useState<Partial<LigneBibliothequeInput>>({});

  // Mémorise l'onglet actif (« Mes lignes » / « Catalogue ») pour le rouvrir tel quel la prochaine fois.
  useEffect(() => {
    ecrireOngletBiblioDevis(onglet);
  }, [onglet]);

  // Désignations du devis en cours, normalisées pour comparer sans se soucier de la casse.
  const dejaUtilisees = useMemo(
    () => new Set(designationsUtilisees.map((d) => normaliserDesignation(d))),
    [designationsUtilisees],
  );

  const entreesPerso: Entree[] = useMemo(() => {
    // Épinglées en tête, puis ordre personnalisé, pour retrouver vite les lignes favorites.
    const rangées = trierParFavoris(trierParOrdre(lignes, ordre), favoris, (l) => l.id);
    return rangées.map((l) => ({
      cle: `perso-${l.id}`,
      favoriCle: l.id,
      designation: l.designation,
      unite: l.unite,
      prix_unitaire: l.prix_unitaire,
      taux_tva: l.taux_tva,
      categorie: l.categorie,
      origine: "perso" as const,
    }));
  }, [lignes, ordre, favoris]);

  const entreesCatalogue: Entree[] = useMemo(
    () =>
      trierParFavoris(
        CATALOGUE_LIGNES.map((l) => ({
          cle: l.cle,
          favoriCle: l.cle,
          designation: l.designation,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
          taux_tva: l.taux_tva,
          categorie: l.categorie,
          origine: "catalogue" as const,
        })),
        favoris,
        (e) => e.cle,
      ),
    [favoris],
  );

  // Catégories proposées dans la fenêtre de création d'une nouvelle ligne.
  const optionsCategories = useMemo(() => {
    const noms = new Set<string>();
    entreesPerso.forEach((e) => noms.add(e.categorie));
    CATEGORIES_LIGNES.forEach((c) => noms.add(c));
    return construireCategories([...noms], prefs)
      .filter((c) => !c.masquee)
      .map((c) => ({ valeur: c.nom, label: c.affichage }));
  }, [entreesPerso, prefs]);

  const listes = onglet === "perso" ? entreesPerso : entreesCatalogue;
  // Nombre de lignes épinglées dans l'onglet actif (rappel cliquable).
  const nbEpingles = useMemo(
    () => listes.filter((e) => favoris.includes(e.favoriCle)).length,
    [listes, favoris],
  );
  const categoriesPersoOrdonnees = useMemo(
    () => construireCategories([...new Set(entreesPerso.map((e) => e.categorie))], prefs).filter((c) => !c.masquee),
    [entreesPerso, prefs],
  );
  const categoriesCatalogueOrdonnees = useMemo(
    () => construireCategories([...CATEGORIES_LIGNES], prefs).filter((c) => !c.masquee),
    [prefs],
  );
  const categoriesFiltre = onglet === "perso" ? categoriesPersoOrdonnees : categoriesCatalogueOrdonnees;

  // Lignes du catalogue proposées comme modèle de pré-remplissage (respecte le filtre catégorie).
  const cataloguePourModele: LigneCatalogue[] = useMemo(
    () => (categorie === "Toutes" ? CATALOGUE_LIGNES : CATALOGUE_LIGNES.filter((l) => l.categorie === categorie)),
    [categorie],
  );

  // Ouvre la fenêtre de création avec des valeurs pré-remplies (le cas échéant).
  const ouvrirCreation = (valeurs: Partial<LigneBibliothequeInput> = {}) => {
    setValeursInitiales(valeurs);
    setCreateError(null);
    setCreateOpen(true);
  };

  const filtrées = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listes.filter((e) => {
      const matchQ = !q || e.designation.toLowerCase().includes(q);
      const matchCat = categorie === "Toutes" || e.categorie === categorie;
      const matchFav = !epingleesUniquement || favoris.includes(e.favoriCle);
      return matchQ && matchCat && matchFav;
    });
  }, [listes, query, categorie, epingleesUniquement, favoris]);

  const toggle = (e: Entree) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (next[e.cle]) delete next[e.cle];
      else {
        next[e.cle] =
          e.origine === "catalogue"
            ? catalogueVersInsertion({
                cle: e.cle,
                designation: e.designation,
                unite: e.unite,
                prix_unitaire: e.prix_unitaire,
                taux_tva: e.taux_tva,
                categorie: e.categorie,
              })
            : persoVersInsertion({
                id: Number(e.cle.replace("perso-", "")),
                designation: e.designation,
                unite: e.unite,
                prix_unitaire: e.prix_unitaire,
                taux_tva: e.taux_tva,
                categorie: e.categorie,
                created_at: "",
              });
      }
      return next;
    });
  };

  const nbSelection = Object.keys(selection).length;

  const handleInsert = () => {
    if (nbSelection === 0) return;
    onInsert(Object.values(selection));
  };

  // Crée une nouvelle ligne dans la bibliothèque (pré-remplie par la recherche)
  // puis la coche directement pour pouvoir l'insérer tout de suite.
  const handleCreate = async (payload: LigneBibliothequeInput) => {
    if (!userId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const creee = await createLigneBibliotheque(userId, payload);
      await reload();
      setCreateOpen(false);
      if (creee) {
        setSelection((prev) => ({ ...prev, [`perso-${creee.id}`]: persoVersInsertion(creee) }));
      }
    } catch {
      setCreateError("La création de la ligne a échoué. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      title="Ajouter des lignes pré-formatées"
      subtitle="Cochez les lignes à insérer : désignation, unité, prix et TVA seront pré-remplis (modifiables ensuite)."
      onClose={onClose}
      wide
      footer={
        <>
          <span className="mr-auto text-xs text-foreground-500 self-center">
            {nbSelection > 0 ? `${nbSelection} ligne(s) sélectionnée(s)` : "Aucune ligne sélectionnée"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={nbSelection === 0}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-add-line"></i>
            Insérer {nbSelection > 0 ? `(${nbSelection})` : "les lignes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => {
                setOnglet("perso");
                setCategorie("Toutes");
                setEpingleesUniquement(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                onglet === "perso" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-user-line"></i> Mes lignes
            </button>
            <button
              type="button"
              onClick={() => {
                setOnglet("catalogue");
                setCategorie("Toutes");
                setEpingleesUniquement(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                onglet === "catalogue" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-book-2-line"></i> Catalogue
            </button>
          </div>
          <RechercheRepliable
            carteId="devis-biblio-lignes"
            carteLabel="Bibliothèque de lignes du devis"
            value={query}
            onChange={setQuery}
            placeholder="Rechercher…"
            ariaLabel="Rechercher une ligne de bibliothèque"
            conteneurClassName="flex-1 min-w-[180px]"
            compact
          />
          <div className="relative">
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-9 pl-3 pr-8 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
              aria-label="Filtrer par catégorie"
            >
              {categoriesFiltre.map((c) => (
                <option key={c.nom} value={c.nom}>
                  {c.affichage}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
          {nbEpingles > 0 && (
            <button
              type="button"
              onClick={() => setEpingleesUniquement((v) => !v)}
              aria-pressed={epingleesUniquement}
              title="N'afficher que les lignes épinglées"
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                epingleesUniquement
                  ? "bg-primary-500 text-background-50 border-primary-500 hover:bg-primary-600"
                  : "bg-background-100 text-foreground-700 border-background-200 hover:bg-background-200"
              }`}
            >
              <i className={epingleesUniquement ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
              {nbEpingles} ligne{nbEpingles > 1 ? "s" : ""} épinglée{nbEpingles > 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div className="max-h-[46vh] overflow-y-auto flex flex-col gap-2 pr-1">
          {onglet === "perso" && loading ? (
            <p className="py-10 text-center text-sm text-foreground-500">
              <i className="ri-loader-4-line animate-spin mr-2"></i>Chargement…
            </p>
          ) : onglet === "perso" && error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-foreground-600">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200"
              >
                <i className="ri-refresh-line"></i> Réessayer
              </button>
            </div>
          ) : filtrées.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-foreground-500">
                {epingleesUniquement
                  ? query.trim()
                    ? `Aucune ligne épinglée ne correspond à « ${query.trim()} ».`
                    : "Aucune ligne épinglée dans cette vue."
                  : onglet === "perso"
                    ? query.trim()
                      ? `Aucune de vos lignes ne correspond à « ${query.trim()} ».`
                      : "Votre bibliothèque de lignes est vide pour l'instant."
                    : "Aucune ligne du catalogue ne correspond à cette recherche."}
              </p>
              <div className="mt-3 flex flex-col items-center gap-3">
                {userId && (
                  <button
                    type="button"
                    onClick={() => ouvrirCreation({})}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600"
                  >
                    <i className="ri-add-line"></i>
                    {query.trim() ? `Créer « ${query.trim()} »` : "Créer une nouvelle ligne"}
                  </button>
                )}
                {userId && query.trim() && cataloguePourModele.length > 0 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] text-foreground-500">… ou pré-remplir depuis le catalogue métier :</span>
                    <div className="relative">
                      <i className="ri-book-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
                      <select
                        value=""
                        onChange={(e) => {
                          const ligne = cataloguePourModele.find((l) => l.cle === e.target.value);
                          if (ligne) {
                            ouvrirCreation({
                              unite: ligne.unite,
                              prix_unitaire: ligne.prix_unitaire,
                              taux_tva: ligne.taux_tva,
                              categorie: ligne.categorie,
                            });
                          }
                        }}
                        className="h-9 pl-9 pr-8 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none max-w-[16rem]"
                        aria-label="Pré-remplir depuis une ligne du catalogue métier"
                      >
                        <option value="">Choisir une ligne du catalogue…</option>
                        {cataloguePourModele.map((l) => (
                          <option key={l.cle} value={l.cle}>
                            {l.designation} — {formatEuros(l.prix_unitaire)}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            filtrées.map((e) => {
              const active = Boolean(selection[e.cle]);
              return (
                <button
                  key={e.cle}
                  type="button"
                  onClick={() => toggle(e)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    active ? "bg-primary-50 border-primary-300" : "bg-background-100 border-background-200 hover:border-primary-200"
                  }`}
                >
                  <span
                    className={`w-5 h-5 shrink-0 flex items-center justify-center rounded border ${
                      active ? "bg-primary-500 border-primary-500 text-background-50" : "border-background-300 bg-background-50"
                    }`}
                  >
                    {active && <i className="ri-check-line text-xs"></i>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground-950 leading-snug">{e.designation}</span>
                      {dejaUtilisees.has(normaliserDesignation(e.designation)) && (
                        <span
                          className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap"
                          title="Cette ligne figure déjà dans le devis en cours"
                        >
                          <i className="ri-repeat-line text-[10px]"></i> Déjà dans ce devis
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold">
                        {afficherCategorie(e.categorie, prefs)}
                      </span>
                      <span className="text-[11px] text-foreground-500">{e.unite}</span>
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold text-foreground-950 whitespace-nowrap">{formatEuros(e.prix_unitaire)}</span>
                    <span className="block text-[11px] text-foreground-500 whitespace-nowrap">
                      TVA {String(e.taux_tva).replace(".", ",")} %
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {createOpen && (
        <LigneFormModal
          initial={null}
          designationInitiale={query.trim()}
          valeursInitiales={valeursInitiales}
          categories={optionsCategories}
          busy={creating}
          error={createError}
          onClose={() => {
            setCreateOpen(false);
            setCreateError(null);
            setValeursInitiales({});
          }}
          onSubmit={handleCreate}
        />
      )}
    </Modal>
  );
}