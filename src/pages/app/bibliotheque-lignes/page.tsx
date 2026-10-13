import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import {
  CATALOGUE_LIGNES,
  CATEGORIES_LIGNES,
  copierCatalogueVersPerso,
  copierCatalogueVersPersoMultiple,
  createLigneBibliotheque,
  deleteLigneBibliotheque,
  designationDansBibliotheque,
  supprimerLignesBibliotheque,
  updateLigneBibliotheque,
  type LigneBibliotheque,
  type LigneBibliothequeInput,
  type LigneCatalogue,
} from "@/lib/bibliothequeLignes";
import { ErrorBlock, LoadingBlock } from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import LigneFormModal from "@/pages/app/bibliotheque-lignes/components/LigneFormModal";
import LigneItem from "@/pages/app/bibliotheque-lignes/components/LigneItem";
import LignesPersoListe from "@/pages/app/bibliotheque-lignes/components/LignesPersoListe";
import CategoriesModal from "@/pages/app/bibliotheque-lignes/components/CategoriesModal";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import { afficherCategorie, construireCategories } from "@/lib/categoriesLignesPrefs";
import { useCategoriesLignes } from "@/hooks/useCategoriesLignes";
import { useOrdreLignes } from "@/hooks/useOrdreLignes";
import { useLignesFavoris } from "@/hooks/useLignesFavoris";
import { deplacerDansOrdre, trierParOrdre } from "@/lib/lignesOrdrePrefs";
import { trierParFavoris, estFavori } from "@/lib/lignesFavorisPrefs";
import {
  CATEGORIE_TOUTES,
  ecrireCategorieLignes,
  ecrireDerniereConfigLignes,
  ecrireEpingleesLignes,
  ecrireOngletLignes,
  ecrireRechercheLignes,
  effacerDerniereConfigLignes,
  lireCategorieLignes,
  lireDerniereConfigLignes,
  lireEpingleesLignes,
  lireOngletLignes,
  lireRechercheLignes,
  type ConfigVueLignes,
} from "@/lib/lignesVuePrefs";
import {
  effacerDernierExportLignes,
  ecrireDernierExportLignes,
  libelleExportLignes,
  lireDernierExportLignes,
  type DernierExportLignes,
  type TypeExportLignes,
} from "@/lib/lignesExportPrefs";

type Onglet = "perso" | "catalogue";

/** Ensemble des noms de catégories issus du catalogue métier, pour distinguer perso / catalogue. */
const CATALOGUE_SET = new Set<string>(CATEGORIES_LIGNES);

export default function AppBibliothequeLignes() {
  usePageMeta("Bibliothèque de lignes · ArtiFlow-pro", "Gérez vos lignes de désignation réutilisables pour composer vos devis plus vite.");
  const { user } = useAuth();
  const { lignes, loading, error, reload } = useLignesBibliotheque(user?.id ?? null);
  const { prefs, enregistrer } = useCategoriesLignes();
  const { ordre, enregistrer: enregistrerOrdre } = useOrdreLignes();
  const { favoris, basculer: basculerFavori, enregistrer: enregistrerFavoris } = useLignesFavoris();

  // L'onglet, le filtre catégorie, la recherche et le filtre « épinglées » sont restaurés
  // depuis la dernière visite.
  const [onglet, setOnglet] = useState<Onglet>(() => lireOngletLignes());
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [query, setQuery] = useState(() => lireRechercheLignes());
  const [categorie, setCategorie] = useState(() => lireCategorieLignes());
  // N'afficher que les lignes épinglées, dans l'onglet actif.
  const [epingleesUniquement, setEpingleesUniquement] = useState(() => lireEpingleesLignes());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LigneBibliotheque | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LigneBibliotheque | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [copieCle, setCopieCle] = useState<string | null>(null);
  const [copieTout, setCopieTout] = useState(false);
  // Copie ciblée des seules lignes épinglées du catalogue.
  const [copieEpinglees, setCopieEpinglees] = useState(false);
  // Dernière configuration de filtres mémorisée, restaurable d'un clic après une réinitialisation.
  const [derniereConfig, setDerniereConfig] = useState<ConfigVueLignes | null>(() => lireDerniereConfigLignes());
  // Identifiants des lignes créées par le dernier « Tout copier chez moi » (pour annuler).
  const [derniereImportation, setDerniereImportation] = useState<number[] | null>(null);
  const [annulation, setAnnulation] = useState(false);
  // Dernière copie unitaire « Copier chez moi », annulable d'un clic discret.
  const [derniereCopieUnitaire, setDerniereCopieUnitaire] = useState<{ id: number; designation: string } | null>(null);
  const [annulationUnitaire, setAnnulationUnitaire] = useState(false);
  // Dernier export groupé utilisé, proposé en « Reprendre » au retour sur la page.
  const [dernierExport, setDernierExport] = useState<DernierExportLignes | null>(() => lireDernierExportLignes());
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Catégories réellement présentes dans les lignes perso, pour alimenter le filtre.
  const categoriesPerso = useMemo(() => {
    const set = new Set<string>();
    lignes.forEach((l) => set.add(l.categorie));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [lignes]);

  // Tous les noms de catégories (perso + catalogue), puis la liste ordonnée selon les préférences.
  const nomsCanoniques = useMemo(() => {
    const set = new Set<string>();
    lignes.forEach((l) => set.add(l.categorie));
    CATEGORIES_LIGNES.forEach((c) => set.add(c));
    return [...set];
  }, [lignes]);

  const toutesCategories = useMemo(() => construireCategories(nomsCanoniques, prefs), [nomsCanoniques, prefs]);
  const categoriesPersoOrdonnees = useMemo(
    () => toutesCategories.filter((c) => !c.masquee && categoriesPerso.includes(c.nom)),
    [toutesCategories, categoriesPerso],
  );
  const categoriesCatalogueOrdonnees = useMemo(
    () => toutesCategories.filter((c) => !c.masquee && CATALOGUE_SET.has(c.nom)),
    [toutesCategories],
  );
  const optionsCategoriesForm = useMemo(
    () => toutesCategories.filter((c) => !c.masquee).map((c) => ({ valeur: c.nom, label: c.affichage })),
    [toutesCategories],
  );

  const filtresPerso = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lignes.filter((l) => {
      const matchQ = !q || l.designation.toLowerCase().includes(q);
      const matchCat = categorie === "Toutes" || l.categorie === categorie;
      const matchFav = !epingleesUniquement || favoris.includes(l.id);
      return matchQ && matchCat && matchFav;
    });
  }, [lignes, query, categorie, epingleesUniquement, favoris]);

  // Lignes filtrées rangées selon l'ordre mémorisé (glisser-déposer intra-catégorie),
  // puis les épinglées remontent en tête de leur catégorie.
  const filtresPersoOrdonnees = useMemo(
    () => trierParFavoris(trierParOrdre(filtresPerso, ordre), favoris, (l) => l.id),
    [filtresPerso, ordre, favoris],
  );

  const filtresCatalogue = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOGUE_LIGNES.filter((l) => {
      const matchQ = !q || l.designation.toLowerCase().includes(q);
      const matchCat = categorie === "Toutes" || l.categorie === categorie;
      const matchFav = !epingleesUniquement || estFavori(favoris, l.cle);
      return matchQ && matchCat && matchFav;
    });
  }, [query, categorie, epingleesUniquement, favoris]);

  // Les lignes du catalogue épinglées remontent en tête de la liste.
  const filtresCatalogueOrdonnees = useMemo(
    () => trierParFavoris(filtresCatalogue, favoris, (l) => l.cle),
    [filtresCatalogue, favoris],
  );

  // Nombre de catégories distinctes parmi les lignes affichées (répartition avant import).
  const nbCategoriesCatalogueAffichees = useMemo(
    () => new Set(filtresCatalogueOrdonnees.map((l) => l.categorie)).size,
    [filtresCatalogueOrdonnees],
  );

  // Nombre de lignes épinglées dans chaque onglet, pour les badges des onglets.
  const nbEpinglesPerso = useMemo(
    () => lignes.filter((l) => favoris.includes(l.id)).length,
    [lignes, favoris],
  );
  const nbEpinglesCatalogue = useMemo(
    () => CATALOGUE_LIGNES.filter((l) => estFavori(favoris, l.cle)).length,
    [favoris],
  );

  // Lignes du catalogue actuellement épinglées (pour la copie ciblée).
  const lignesEpingleesCatalogue = useMemo(
    () => CATALOGUE_LIGNES.filter((l) => estFavori(favoris, l.cle)),
    [favoris],
  );

  // Nombre de lignes du catalogue déjà présentes dans « Mes lignes » (repérage anti-doublon).
  const nbCatalogueImportees = useMemo(
    () => CATALOGUE_LIGNES.filter((l) => designationDansBibliotheque(lignes, l.designation)).length,
    [lignes],
  );

  // Lignes épinglées du catalogue pas encore importées (hors doublons déjà présents) :
  // sert à afficher le nombre réellement nouveau sur le bouton de copie ciblée.
  const nbEpinglesCatalogueNouvelles = useMemo(
    () => lignesEpingleesCatalogue.filter((l) => !designationDansBibliotheque(lignes, l.designation)).length,
    [lignesEpingleesCatalogue, lignes],
  );

  // Vrai si un filtre de vue est actif (recherche, catégorie ou épinglées) : permet d'afficher « Réinitialiser la vue ».
  const vueFiltree = query.trim() !== "" || categorie !== CATEGORIE_TOUTES || epingleesUniquement;

  // Vrai si la vue courante diffère de la dernière configuration mémorisée (rappel de restauration).
  const configDifferent =
    !!derniereConfig &&
    (derniereConfig.recherche !== query ||
      derniereConfig.categorie !== categorie ||
      derniereConfig.epinglees !== epingleesUniquement);

  /** Catégories disponibles pour le filtre selon l'onglet actif. */
  const categoriesFiltre = onglet === "perso" ? categoriesPersoOrdonnees : categoriesCatalogueOrdonnees;

  // Mémorise l'onglet actif pour le restaurer à la prochaine visite.
  useEffect(() => {
    ecrireOngletLignes(onglet);
  }, [onglet]);

  // Mémorise le filtre catégorie, et revient sur « Toutes » si la catégorie
  // mémorisée n'existe plus dans l'onglet courant.
  useEffect(() => {
    if (categoriesFiltre.length === 0) return;
    if (categorie !== CATEGORIE_TOUTES && !categoriesFiltre.some((c) => c.nom === categorie)) {
      setCategorie(CATEGORIE_TOUTES);
      return;
    }
    ecrireCategorieLignes(categorie);
  }, [categoriesFiltre, categorie]);

  // Mémorise la recherche texte en cours pour la restaurer à la prochaine visite.
  useEffect(() => {
    ecrireRechercheLignes(query);
  }, [query]);

  // Mémorise l'état du filtre « Épinglées uniquement ».
  useEffect(() => {
    ecrireEpingleesLignes(epingleesUniquement);
  }, [epingleesUniquement]);

  const handleSubmit = async (payload: LigneBibliothequeInput) => {
    if (!user) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await updateLigneBibliotheque(editing.id, payload);
      else await createLigneBibliotheque(user.id, payload);
      setFormOpen(false);
      setEditing(null);
      await reload();
      setToast(editing ? "Ligne mise à jour" : "Ligne ajoutée à votre bibliothèque");
    } catch {
      setFormError("L'enregistrement de la ligne a échoué. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteLigneBibliotheque(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
      setToast("Ligne supprimée");
    } catch {
      setActionError("La suppression a échoué.");
    } finally {
      setDeleting(false);
    }
  };

  // Mémorise le dernier export groupé utilisé (pour le raccourci « Reprendre »).
  const memoriserExport = (type: TypeExportLignes, nombre: number) => {
    const valeur: DernierExportLignes = { type, nombre, date: new Date().toISOString() };
    ecrireDernierExportLignes(valeur);
    setDernierExport(valeur);
  };

  // Copie ciblée : uniquement les lignes du catalogue épinglées, vers les lignes perso.
  const handleCopierEpingleesCatalogue = async () => {
    if (!user || lignesEpingleesCatalogue.length === 0) return;
    setCopieEpinglees(true);
    setActionError(null);
    try {
      const { copies, ignores, ids } = await copierCatalogueVersPersoMultiple(
        user.id,
        lignesEpingleesCatalogue,
        lignes.map((l) => l.designation),
      );
      await reload();
      setOnglet("perso");
      setCategorie(CATEGORIE_TOUTES);
      setDerniereCopieUnitaire(null);
      setDerniereImportation(ids.length > 0 ? ids : null);
      memoriserExport("epinglees", copies);
      if (copies === 0) {
        setToast(`Toutes vos lignes épinglées sont déjà dans votre bibliothèque (${ignores} ignorée(s))`);
      } else {
        setToast(
          `${copies} ligne(s) épinglée(s) copiée(s) dans vos lignes${ignores > 0 ? ` · ${ignores} déjà présente(s) ignorée(s)` : ""}`,
        );
      }
    } catch {
      setActionError("La copie des lignes épinglées a échoué.");
    } finally {
      setCopieEpinglees(false);
    }
  };

  // Copie d'un coup toutes les lignes visibles du catalogue dans les lignes perso.
  const handleCopierToutCatalogue = async () => {
    if (!user || filtresCatalogueOrdonnees.length === 0) return;
    setCopieTout(true);
    setActionError(null);
    try {
      const { copies, ignores, ids } = await copierCatalogueVersPersoMultiple(
        user.id,
        filtresCatalogueOrdonnees,
        lignes.map((l) => l.designation),
      );
      await reload();
      setOnglet("perso");
      setCategorie(CATEGORIE_TOUTES);
      setDerniereCopieUnitaire(null);
      setDerniereImportation(ids.length > 0 ? ids : null);
      memoriserExport("tout", copies);
      if (copies === 0) {
        setToast(`Toutes ces lignes sont déjà dans votre bibliothèque (${ignores} ignorée(s))`);
      } else {
        setToast(
          `${copies} ligne(s) copiée(s) dans vos lignes${ignores > 0 ? ` · ${ignores} déjà présente(s) ignorée(s)` : ""}`,
        );
      }
    } catch {
      setActionError("La copie des lignes du catalogue a échoué.");
    } finally {
      setCopieTout(false);
    }
  };

  // Relance d'un clic le dernier export groupé mémorisé.
  const handleReprendreExport = () => {
    if (!dernierExport) return;
    if (dernierExport.type === "epinglees") handleCopierEpingleesCatalogue();
    else handleCopierToutCatalogue();
  };

  // Oublie le rappel du dernier export.
  const handleOublierExport = () => {
    effacerDernierExportLignes();
    setDernierExport(null);
  };

  // Annule la dernière importation groupée : retire d'un coup les lignes tout juste copiées.
  const handleAnnulerImportation = async () => {
    if (!derniereImportation || derniereImportation.length === 0) return;
    const nb = derniereImportation.length;
    setAnnulation(true);
    setActionError(null);
    try {
      await supprimerLignesBibliotheque(derniereImportation);
      setDerniereImportation(null);
      await reload();
      setToast(`${nb} ligne(s) importée(s) retirée(s) de votre bibliothèque`);
    } catch {
      setActionError("L'annulation de l'importation a échoué.");
    } finally {
      setAnnulation(false);
    }
  };

  const handleCopier = async (ligne: LigneCatalogue) => {
    if (!user) return;
    setCopieCle(ligne.cle);
    setActionError(null);
    try {
      const creee = await copierCatalogueVersPerso(user.id, ligne);
      await reload();
      setOnglet("perso");
      setDerniereImportation(null);
      setDerniereCopieUnitaire(creee ? { id: creee.id, designation: ligne.designation } : null);
      setToast(`« ${ligne.designation} » copiée dans vos lignes`);
    } catch {
      setActionError("La copie de la ligne a échoué.");
    } finally {
      setCopieCle(null);
    }
  };

  // Annule la dernière copie unitaire : retire la seule ligne tout juste ajoutée.
  const handleAnnulerCopieUnitaire = async () => {
    if (!derniereCopieUnitaire) return;
    setAnnulationUnitaire(true);
    setActionError(null);
    try {
      await supprimerLignesBibliotheque([derniereCopieUnitaire.id]);
      setToast(`« ${derniereCopieUnitaire.designation} » retirée de vos lignes`);
      setDerniereCopieUnitaire(null);
      await reload();
    } catch {
      setActionError("L'annulation de la copie a échoué.");
    } finally {
      setAnnulationUnitaire(false);
    }
  };

  // Remet à zéro la vue : recherche, catégorie et filtre « Épinglées uniquement ».
  // On mémorise d'abord la configuration courante pour pouvoir y revenir d'un clic.
  const handleReinitialiserVue = () => {
    const config: ConfigVueLignes = {
      recherche: query,
      categorie,
      epinglees: epingleesUniquement,
    };
    ecrireDerniereConfigLignes(config);
    setDerniereConfig(config);
    setQuery("");
    setCategorie(CATEGORIE_TOUTES);
    setEpingleesUniquement(false);
    setToast("Vue réinitialisée");
  };

  // Revient d'un coup à la dernière configuration de filtres enregistrée.
  const handleRestaurerConfig = () => {
    if (!derniereConfig) return;
    setQuery(derniereConfig.recherche);
    setCategorie(derniereConfig.categorie);
    setEpingleesUniquement(derniereConfig.epinglees);
    effacerDerniereConfigLignes();
    setDerniereConfig(null);
    setToast("Configuration de filtres restaurée");
  };

  // Oublie le rappel de configuration mémorisée.
  const handleEffacerConfig = () => {
    effacerDerniereConfigLignes();
    setDerniereConfig(null);
  };

  /** Décrit une configuration de filtres en langage clair pour le rappel. */
  const decrireConfig = (c: ConfigVueLignes): string => {
    const parties: string[] = [];
    if (c.recherche.trim()) parties.push(`recherche « ${c.recherche.trim()} »`);
    if (c.categorie !== CATEGORIE_TOUTES) parties.push(`catégorie « ${afficherCategorie(c.categorie, prefs)} »`);
    if (c.epinglees) parties.push("épinglées uniquement");
    return parties.length > 0 ? parties.join(" · ") : "vue par défaut";
  };

  // Reclasse une ligne dans une autre catégorie (glisser-déposer).
  const handleMove = async (ligne: LigneBibliotheque, nouvelleCategorie: string) => {
    setActionError(null);
    try {
      await updateLigneBibliotheque(ligne.id, {
        designation: ligne.designation,
        unite: ligne.unite,
        prix_unitaire: ligne.prix_unitaire,
        taux_tva: ligne.taux_tva,
        categorie: nouvelleCategorie,
      });
      await reload();
      // La ligne déplacée passe à la fin de l'ordre mémorisé (elle rejoint sa nouvelle catégorie).
      enregistrerOrdre([...ordre.filter((x) => x !== ligne.id), ligne.id]);
      setToast(`« ${ligne.designation} » déplacée dans « ${afficherCategorie(nouvelleCategorie, prefs)} »`);
    } catch {
      setActionError("Le déplacement de la ligne a échoué. Réessayez.");
    }
  };

  // Réordonne une ligne à l'intérieur de sa catégorie (glisser-déposer).
  const handleReorder = (cat: string, id: number, avantId: number | null) => {
    const ordonne = trierParOrdre(
      lignes.filter((l) => l.categorie === cat),
      ordre,
    ).map((l) => l.id);
    const nouveaux = deplacerDansOrdre(ordonne, id, avantId);
    const autres = ordre.filter((x) => !ordonne.includes(x));
    enregistrerOrdre([...autres, ...nouveaux]);
  };

  // Épingle / désépingle une ligne (favori) : elle remonte en tête de sa catégorie.
  const handleToggleFavori = (ligne: LigneBibliotheque) => {
    const etait = favoris.includes(ligne.id);
    basculerFavori(ligne.id);
    setToast(
      etait
        ? `« ${ligne.designation} » n'est plus épinglée`
        : `« ${ligne.designation} » épinglée en haut de sa catégorie`,
    );
  };

  // Épingle / désépingle une ligne du catalogue métier pour la garder en tête.
  const handleToggleFavoriCatalogue = (ligne: LigneCatalogue) => {
    const etait = estFavori(favoris, ligne.cle);
    basculerFavori(ligne.cle);
    setToast(
      etait
        ? `« ${ligne.designation} » n'est plus épinglée`
        : `« ${ligne.designation} » épinglée en haut du catalogue`,
    );
  };

  // Retire d'un coup toutes les épingles (favoris), perso et catalogue confondus.
  const handleDeselectionnerTout = () => {
    if (favoris.length === 0) return;
    enregistrerFavoris([]);
    setToast("Toutes les épingles ont été retirées");
  };

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (ligne: LigneBibliotheque) => {
    setEditing(ligne);
    setFormError(null);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-950 flex items-center gap-2">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-list-check-2 text-lg"></i>
            </span>
            Bibliothèque de lignes
          </h1>
          <p className="text-sm text-foreground-500 mt-1.5 max-w-2xl">
            Enregistrez vos lignes de désignation types (désignation, unité, prix, TVA) et insérez-les en un clic dans
            vos devis. Partez du catalogue métier ou créez vos propres lignes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            title="Renommer, réorganiser ou masquer des catégories"
          >
            <i className="ri-settings-3-line"></i>
            Gérer les catégories
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-add-line"></i>
            Nouvelle ligne
          </button>
        </div>
      </div>

      {actionError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {actionError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
          <button
            type="button"
            onClick={() => {
              setOnglet("perso");
              setCategorie("Toutes");
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              onglet === "perso" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-user-line"></i>
            Mes lignes
            <span className={onglet === "perso" ? "text-background-50/80" : "text-foreground-400"}>{lignes.length}</span>
            {nbEpinglesPerso > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  onglet === "perso" ? "bg-background-50/25 text-background-50" : "bg-primary-100 text-primary-700"
                }`}
                title={`${nbEpinglesPerso} ligne(s) épinglée(s)`}
              >
                <i className="ri-pushpin-2-fill text-[10px]"></i>
                {nbEpinglesPerso}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setOnglet("catalogue");
              setCategorie("Toutes");
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              onglet === "catalogue" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-book-2-line"></i>
            Catalogue métier
            <span className={onglet === "catalogue" ? "text-background-50/80" : "text-foreground-400"}>
              {CATALOGUE_LIGNES.length}
            </span>
            {nbEpinglesCatalogue > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  onglet === "catalogue" ? "bg-background-50/25 text-background-50" : "bg-primary-100 text-primary-700"
                }`}
                title={`${nbEpinglesCatalogue} ligne(s) épinglée(s)`}
              >
                <i className="ri-pushpin-2-fill text-[10px]"></i>
                {nbEpinglesCatalogue}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3">
          <RechercheRepliable
            carteId="bibliotheque-lignes"
            carteLabel="Bibliothèque de lignes"
            value={query}
            onChange={setQuery}
            placeholder="Rechercher une désignation…"
            conteneurClassName="w-full sm:w-64"
          />
          <div className="relative">
            <i className="ri-price-tag-3-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
              aria-label="Filtrer par catégorie"
            >
              {categoriesFiltre.map((c) => (
                <option key={c.nom} value={c.nom}>
                  {c.affichage}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
          <button
            type="button"
            onClick={() => setEpingleesUniquement((v) => !v)}
            aria-pressed={epingleesUniquement}
            title="N'afficher que les lignes épinglées"
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
              epingleesUniquement
                ? "bg-primary-500 text-background-50 border-primary-500 hover:bg-primary-600"
                : "bg-background-100 text-foreground-700 border-background-200 hover:bg-background-200"
            }`}
          >
            <i className={epingleesUniquement ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
            Épinglées uniquement
            {favoris.length > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  epingleesUniquement ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                }`}
              >
                {favoris.length}
              </span>
            )}
          </button>
          {favoris.length > 0 && (
            <button
              type="button"
              onClick={handleDeselectionnerTout}
              title="Retirer toutes les épingles d'un clic"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border bg-background-100 text-foreground-700 border-background-200 hover:bg-background-200 hover:text-red-600"
            >
              <i className="ri-pushpin-2-line"></i>
              Tout désépingler
            </button>
          )}
          {vueFiltree && (
            <button
              type="button"
              onClick={handleReinitialiserVue}
              title="Remettre la recherche, la catégorie et le filtre épinglées à zéro"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border bg-background-100 text-foreground-700 border-background-200 hover:bg-background-200 hover:text-primary-700"
            >
              <i className="ri-refresh-line"></i>
              Réinitialiser la vue
            </button>
          )}
        </div>
      </div>

      {derniereConfig && configDifferent && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRestaurerConfig}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRestaurerConfig();
            }
          }}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 cursor-pointer hover:bg-primary-100 transition-colors"
          title="Revenir à la dernière configuration de filtres enregistrée"
        >
          <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-history-line text-sm"></i>
          </span>
          <p className="flex-1 min-w-0 text-xs text-foreground-600 truncate">
            <strong className="text-foreground-900">Vue réinitialisée.</strong> Revenir à la dernière configuration
            enregistrée : {decrireConfig(derniereConfig)}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 whitespace-nowrap shrink-0">
            <i className="ri-arrow-go-back-line"></i>
            Restaurer
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEffacerConfig();
            }}
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-50 hover:text-foreground-700 cursor-pointer"
            aria-label="Masquer ce rappel"
            title="Masquer ce rappel"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>
      )}

      {dernierExport && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
          <p className="text-xs text-secondary-900 flex items-center gap-2 min-w-0">
            <i className="ri-history-line text-secondary-600"></i>
            <span className="truncate">
              Dernier export utilisé : <strong>{libelleExportLignes(dernierExport.type)}</strong>
              {dernierExport.nombre > 0 ? ` · ${dernierExport.nombre} ligne(s) importée(s)` : ""}. Reprenez-le d'un clic.
            </span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReprendreExport}
              disabled={copieEpinglees || copieTout}
              className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60"
              title="Relancer ce même export depuis le catalogue"
            >
              {copieEpinglees || copieTout ? (
                <i className="ri-loader-4-line animate-spin"></i>
              ) : (
                <i className="ri-restart-line"></i>
              )}
              Reprendre
            </button>
            <button
              type="button"
              onClick={handleOublierExport}
              className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-100 hover:text-foreground-700 cursor-pointer"
              aria-label="Oublier ce dernier export"
              title="Oublier ce dernier export"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        </div>
      )}

      {derniereImportation && derniereImportation.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-accent-50 border border-accent-200">
          <p className="text-xs text-accent-900 flex items-center gap-2">
            <i className="ri-information-line text-accent-600"></i>
            Dernière importation : <strong>{derniereImportation.length}</strong> ligne(s) ajoutée(s) depuis le catalogue.
          </p>
          <button
            type="button"
            onClick={handleAnnulerImportation}
            disabled={annulation}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-background-50 text-accent-800 border border-accent-200 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-60 shrink-0"
            title="Retirer d'un coup toutes les lignes tout juste copiées"
          >
            {annulation ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-arrow-go-back-line"></i>}
            Annuler la dernière importation
          </button>
        </div>
      )}

      {derniereCopieUnitaire && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background-100 border border-background-200">
          <p className="text-xs text-foreground-500 flex items-center gap-1.5 min-w-0">
            <i className="ri-check-line text-accent-600"></i>
            <span className="truncate">
              « {derniereCopieUnitaire.designation} » copiée dans <strong className="text-foreground-700">Mes lignes</strong>
            </span>
          </p>
          <button
            type="button"
            onClick={handleAnnulerCopieUnitaire}
            disabled={annulationUnitaire}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-semibold text-foreground-500 hover:text-red-600 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60"
            title="Retirer cette ligne tout juste copiée"
          >
            {annulationUnitaire ? (
              <i className="ri-loader-4-line animate-spin"></i>
            ) : (
              <i className="ri-arrow-go-back-line"></i>
            )}
            Annuler
          </button>
        </div>
      )}

      {onglet === "perso" ? (
        loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : filtresPerso.length === 0 ? (
          <EmptyState
            icon={epingleesUniquement ? "ri-pushpin-2-line" : "ri-list-check-2"}
            title={
              epingleesUniquement
                ? "Aucune ligne épinglée"
                : lignes.length === 0
                  ? "Aucune ligne enregistrée"
                  : "Aucun résultat"
            }
            text={
              epingleesUniquement
                ? "Épinglez une ligne (icône punaise) pour la garder en tête : vous la retrouverez ici d'un seul coup d'œil."
                : lignes.length === 0
                  ? "Créez votre première ligne réutilisable, ou piochez dans le catalogue métier pour la copier et l'ajuster."
                  : "Aucune de vos lignes ne correspond à cette recherche ou à cette catégorie."
            }
          >
            {lignes.length === 0 && !epingleesUniquement && (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-add-line"></i> Nouvelle ligne
                </button>
                <button
                  type="button"
                  onClick={() => setOnglet("catalogue")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                >
                  <i className="ri-book-2-line"></i> Voir le catalogue
                </button>
              </div>
            )}
          </EmptyState>
        ) : (
          <LignesPersoListe
            lignesFiltrees={filtresPersoOrdonnees}
            prefs={prefs}
            vueComplete={!query.trim() && categorie === "Toutes" && !epingleesUniquement}
            favoris={favoris}
            onToggleFavori={handleToggleFavori}
            onEdit={openEdit}
            onDelete={(l) => setDeleteTarget(l)}
            onMove={handleMove}
            onReorder={handleReorder}
          />
        )
      ) : filtresCatalogueOrdonnees.length === 0 ? (
        <EmptyState
          icon={epingleesUniquement ? "ri-pushpin-2-line" : "ri-book-2-line"}
          title={epingleesUniquement ? "Aucune ligne épinglée" : "Aucune ligne dans le catalogue"}
          text={
            epingleesUniquement
              ? "Épinglez une ligne du catalogue (icône punaise) pour la garder en tête ici."
              : "Aucune ligne du catalogue métier ne correspond à cette recherche ou à cette catégorie."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-secondary-50 border border-secondary-200">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <i className="ri-checkbox-circle-line text-sm"></i>
            </span>
            <p className="text-xs text-secondary-900">
              <strong>{nbCatalogueImportees}</strong>
              {nbCatalogueImportees > 1 ? " lignes du catalogue sont déjà dans " : " ligne du catalogue est déjà dans "}
              <strong>Mes lignes</strong> sur {CATALOGUE_LIGNES.length}. Les cartes concernées portent la pastille de
              repérage.
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-primary-100 border border-primary-200 text-primary-800 text-[11px] font-semibold whitespace-nowrap"
                title="Lignes du catalogue épinglées qui ne sont pas encore dans vos propres lignes"
              >
                <i className="ri-pushpin-2-fill"></i>
                {nbEpinglesCatalogueNouvelles} ligne{nbEpinglesCatalogueNouvelles > 1 ? "s" : ""} épinglée
                {nbEpinglesCatalogueNouvelles > 1 ? "s" : ""} non importée{nbEpinglesCatalogueNouvelles > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-background-50 border border-secondary-200 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-layout-grid-line"></i>
                {nbCategoriesCatalogueAffichees} catégorie{nbCategoriesCatalogueAffichees > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
            <p className="text-xs text-foreground-500">
              <i className="ri-book-2-line mr-1.5 text-secondary-600"></i>
              {categorie === CATEGORIE_TOUTES
                ? `Toutes les lignes du catalogue affichées (${filtresCatalogueOrdonnees.length}).`
                : `Lignes « ${afficherCategorie(categorie, prefs)} » affichées (${filtresCatalogueOrdonnees.length}).`}{" "}
              Copiez-les d'un coup pour les ajuster dans vos propres lignes.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {nbEpinglesCatalogue > 0 && (
                <button
                  type="button"
                  onClick={handleCopierEpingleesCatalogue}
                  disabled={copieEpinglees}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
                  title="Importer d'un coup uniquement les lignes du catalogue épinglées pas encore dans vos propres lignes"
                >
                  {copieEpinglees ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-pushpin-2-fill"></i>
                  )}
                  Copier les épinglées ({nbEpinglesCatalogueNouvelles})
                </button>
              )}
              <button
                type="button"
                onClick={handleCopierToutCatalogue}
                disabled={copieTout}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                title="Importer d'un coup toutes les lignes visibles du catalogue dans vos propres lignes"
              >
                {copieTout ? (
                  <i className="ri-loader-4-line animate-spin"></i>
                ) : (
                  <i className="ri-download-2-line"></i>
                )}
                Tout copier chez moi ({filtresCatalogueOrdonnees.length})
              </button>
            </div>
          </div>
          {filtresCatalogueOrdonnees.map((l) => {
            const epingle = estFavori(favoris, l.cle);
            return (
              <LigneItem
                key={l.cle}
                designation={l.designation}
                unite={l.unite}
                prix={l.prix_unitaire}
                taux={l.taux_tva}
                categorie={afficherCategorie(l.categorie, prefs)}
                origine="catalogue"
                favori={epingle}
                dejaImportee={designationDansBibliotheque(lignes, l.designation)}
                actions={
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleFavoriCatalogue(l)}
                      className={`w-9 h-9 flex items-center justify-center rounded-md cursor-pointer ${
                        epingle
                          ? "text-primary-600 hover:bg-primary-100"
                          : "text-foreground-400 hover:bg-background-200 hover:text-primary-700"
                      }`}
                      aria-label={epingle ? "Retirer des épinglées" : "Épingler en haut du catalogue"}
                      title={epingle ? "Retirer des épinglées" : "Épingler en haut du catalogue"}
                    >
                      <i className={epingle ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopier(l)}
                      disabled={copieCle === l.cle}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
                      title="Copier cette ligne dans vos lignes pour l'ajuster"
                    >
                      {copieCle === l.cle ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-add-line"></i>
                      )}
                      Copier chez moi
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {formOpen && (
        <LigneFormModal
          initial={editing}
          categories={optionsCategoriesForm}
          busy={saving}
          error={formError}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {categoriesOpen && (
        <CategoriesModal
          prefs={prefs}
          nomsCanoniques={nomsCanoniques}
          catalogue={[...CATEGORIES_LIGNES]}
          onChange={enregistrer}
          onClose={() => setCategoriesOpen(false)}
        />
      )}

      {deleteTarget && (
        <Modal title="Supprimer cette ligne ?" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-foreground-600">
            La ligne <strong className="text-foreground-900">{deleteTarget.designation}</strong> sera retirée de votre
            bibliothèque. Les devis déjà créés ne sont pas modifiés.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
            >
              {deleting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}