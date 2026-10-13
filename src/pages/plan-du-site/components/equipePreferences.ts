import { type CategorieMembre } from "@/mocks/equipe";
import { parseDateFr, type Article } from "@/mocks/ressources";

export type TriMode = "equipe" | "contenus-desc" | "contenus-asc" | "nom";
export type TriGuidesMode = "catalogue" | "date-recent" | "date-ancien" | "titre";
export type RoleFiltre = CategorieMembre | "tous";

export const triOptions: { value: TriMode; label: string }[] = [
  { value: "equipe", label: "Ordre de l'équipe" },
  { value: "contenus-desc", label: "Plus de contenus d'abord" },
  { value: "contenus-asc", label: "Moins de contenus d'abord" },
  { value: "nom", label: "Nom (A → Z)" },
];

export const triGuidesOptions: { value: TriGuidesMode; label: string }[] = [
  { value: "catalogue", label: "Ordre du catalogue" },
  { value: "date-recent", label: "Plus récents" },
  { value: "date-ancien", label: "Plus anciens" },
  { value: "titre", label: "Titre (A → Z)" },
];

export const rolesFiltre: { value: RoleFiltre; label: string; icon: string }[] = [
  { value: "tous", label: "Tous", icon: "ri-group-line" },
  { value: "direction", label: "Direction", icon: "ri-flag-2-line" },
  { value: "technique", label: "Technique", icon: "ri-code-s-slash-line" },
  { value: "produit", label: "Produit", icon: "ri-layout-4-line" },
  { value: "data", label: "Data & IA", icon: "ri-brain-line" },
  { value: "relation", label: "Relation artisans", icon: "ri-customer-service-2-line" },
  { value: "croissance", label: "Croissance", icon: "ri-line-chart-line" },
];

/** Valide la valeur de tri lue dans l'URL (retombe sur l'ordre de l'équipe si invalide). */
export function estTriValide(value: string | null): TriMode {
  return triOptions.some((option) => option.value === value) ? (value as TriMode) : "equipe";
}

/** Valide le rôle lu dans l'URL (retombe sur « tous » si invalide). */
export function estRoleValide(value: string | null): RoleFiltre {
  return rolesFiltre.some((option) => option.value === value) ? (value as RoleFiltre) : "tous";
}

/** Valide le tri des guides lu dans l'URL (retombe sur l'ordre du catalogue si invalide). */
export function estTriGuidesValide(value: string | null): TriGuidesMode {
  return triGuidesOptions.some((option) => option.value === value)
    ? (value as TriGuidesMode)
    : "catalogue";
}

/** Clé de mémorisation du dernier tri des guides choisi. */
export const CLE_TRI_GUIDES = "artiflow:plan-du-site:tri-guides";

/** Relit le dernier tri des guides mémorisé (retombe sur l'ordre du catalogue). */
export function lireTriGuidesMemorise(): TriGuidesMode {
  if (typeof window === "undefined") return "catalogue";
  try {
    return estTriGuidesValide(window.localStorage.getItem(CLE_TRI_GUIDES));
  } catch {
    return "catalogue";
  }
}

/** Clé de mémorisation du dernier filtre par rôle choisi. */
export const CLE_ROLE = "artiflow:plan-du-site:role";

/** Relit le dernier filtre par rôle mémorisé (retombe sur « tous »). */
export function lireRoleMemorise(): RoleFiltre {
  if (typeof window === "undefined") return "tous";
  try {
    return estRoleValide(window.localStorage.getItem(CLE_ROLE));
  } catch {
    return "tous";
  }
}

/** Clé de mémorisation de la dernière recherche saisie. */
export const CLE_RECHERCHE = "artiflow:plan-du-site:recherche";

/** Relit la dernière recherche mémorisée. */
export function lireRechercheMemorisee(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CLE_RECHERCHE) ?? "";
  } catch {
    return "";
  }
}

/** Clé de mémorisation des membres épinglés en favoris. */
export const CLE_FAVORIS = "artiflow:plan-du-site:favoris";

/** Relit la liste des membres épinglés (retombe sur une liste vide). */
export function lireFavoris(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_FAVORIS);
    if (!brut) return [];
    const parsed = JSON.parse(brut);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Clé de mémorisation de l'ordre d'épinglage d'origine des favoris. */
export const CLE_FAVORIS_ORIGINE = "artiflow:plan-du-site:favoris-origine";

/** Relit l'ordre d'épinglage d'origine des favoris (retombe sur une liste vide). */
export function lireFavorisOrigine(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_FAVORIS_ORIGINE);
    if (!brut) return [];
    const parsed = JSON.parse(brut);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Profil de favoris nommé (ex. « vue technique », « vue direction »). */
export type ProfilFavoris = { id: string; nom: string; favoris: string[] };

/** Clé de mémorisation des profils de favoris nommés. */
export const CLE_PROFILS = "artiflow:plan-du-site:profils-favoris";

/** Clé de mémorisation du profil de favoris actif, retrouvé appliqué au rechargement. */
export const CLE_PROFIL_ACTIF = "artiflow:plan-du-site:profil-actif";

/** Relit l'identifiant du profil de favoris actif (null si aucun). */
export function lireProfilActif(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const valeur = window.localStorage.getItem(CLE_PROFIL_ACTIF);
    return valeur && valeur.length > 0 ? valeur : null;
  } catch {
    return null;
  }
}

/** Relit les profils de favoris mémorisés (retombe sur une liste vide). */
export function lireProfils(): ProfilFavoris[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_PROFILS);
    if (!brut) return [];
    const parsed = JSON.parse(brut);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.nom === "string" &&
          Array.isArray(p.favoris)
      )
      .map((p) => ({
        id: p.id,
        nom: p.nom,
        favoris: (p.favoris as unknown[]).filter((x) => typeof x === "string"),
      }));
  } catch {
    return [];
  }
}

/** Trie une liste de guides selon le mode choisi (par date ou par titre). */
export function trierGuides(guides: Article[], mode: TriGuidesMode): Article[] {
  const copie = [...guides];
  if (mode === "date-recent") {
    copie.sort((a, b) => parseDateFr(b.date) - parseDateFr(a.date));
  } else if (mode === "date-ancien") {
    copie.sort((a, b) => parseDateFr(a.date) - parseDateFr(b.date));
  } else if (mode === "titre") {
    copie.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }
  return copie;
}

/** Normalise une chaîne pour comparer sans tenir compte des accents ni de la casse. */
export function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}