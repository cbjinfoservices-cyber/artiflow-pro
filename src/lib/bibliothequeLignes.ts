import { supabase } from "@/lib/supabase";
import { normalizeTvaRate } from "@/lib/artisanApi";

/** Ligne de désignation personnelle enregistrée par l'artisan (réutilisable dans les devis). */
export interface LigneBibliotheque {
  id: number;
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva: number;
  categorie: string;
  created_at: string;
}

/** Données saisies pour créer ou modifier une ligne personnelle. */
export interface LigneBibliothequeInput {
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva: number;
  categorie: string;
}

/** Ligne du catalogue métier fourni d'origine : lecture seule, clé stable « catalogue-… ». */
export interface LigneCatalogue {
  cle: string;
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva: number;
  categorie: string;
}

/** Une ligne prête à insérer dans un devis (sert au sélecteur). */
export interface LigneAInserer {
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva: number;
  origine: "catalogue" | "perso";
}

/** Catégories du catalogue métier, affichées comme filtres dans la bibliothèque. */
export const CATEGORIES_LIGNES = [
  "Plomberie",
  "Électricité",
  "Peinture",
  "Carrelage",
  "Menuiserie",
  "Maçonnerie",
  "Toiture",
  "Climatisation",
  "Facturation électronique",
  "Divers",
] as const;

/**
 * Catalogue métier de base : des lignes de désignation types du bâtiment,
 * déjà chiffrées (unité, prix unitaire, TVA). Elles servent de point de départ
 * rapide et peuvent être copiées dans les lignes personnelles pour être ajustées.
 */
export const CATALOGUE_LIGNES: LigneCatalogue[] = [
  // Plomberie
  { cle: "catalogue-plomberie-1", designation: "Fourniture et pose d'un mitigeur lavabo", unite: "u", prix_unitaire: 180, taux_tva: 10, categorie: "Plomberie" },
  { cle: "catalogue-plomberie-2", designation: "Installation d'un chauffe-eau 200 L", unite: "u", prix_unitaire: 1450, taux_tva: 5.5, categorie: "Plomberie" },
  { cle: "catalogue-plomberie-3", designation: "Débouchage de canalisation", unite: "intervention", prix_unitaire: 220, taux_tva: 10, categorie: "Plomberie" },
  { cle: "catalogue-plomberie-4", designation: "Dépose et pose d'un WC suspendu", unite: "u", prix_unitaire: 480, taux_tva: 10, categorie: "Plomberie" },
  { cle: "catalogue-plomberie-5", designation: "Raccordement d'évacuation PVC", unite: "ml", prix_unitaire: 35, taux_tva: 10, categorie: "Plomberie" },
  // Électricité
  { cle: "catalogue-elec-1", designation: "Mise aux normes du tableau électrique", unite: "u", prix_unitaire: 890, taux_tva: 10, categorie: "Électricité" },
  { cle: "catalogue-elec-2", designation: "Pose d'une prise 2P+T", unite: "u", prix_unitaire: 85, taux_tva: 10, categorie: "Électricité" },
  { cle: "catalogue-elec-3", designation: "Installation d'un point lumineux", unite: "u", prix_unitaire: 120, taux_tva: 10, categorie: "Électricité" },
  { cle: "catalogue-elec-4", designation: "Remplacement d'un disjoncteur", unite: "u", prix_unitaire: 70, taux_tva: 10, categorie: "Électricité" },
  // Peinture
  { cle: "catalogue-peinture-1", designation: "Préparation et peinture des murs (2 couches)", unite: "m²", prix_unitaire: 28, taux_tva: 10, categorie: "Peinture" },
  { cle: "catalogue-peinture-2", designation: "Peinture des plafonds", unite: "m²", prix_unitaire: 32, taux_tva: 10, categorie: "Peinture" },
  { cle: "catalogue-peinture-3", designation: "Enduit de lissage", unite: "m²", prix_unitaire: 22, taux_tva: 10, categorie: "Peinture" },
  { cle: "catalogue-peinture-4", designation: "Pose de bande à joint", unite: "ml", prix_unitaire: 6, taux_tva: 10, categorie: "Peinture" },
  // Carrelage
  { cle: "catalogue-carrelage-1", designation: "Pose de carrelage au sol", unite: "m²", prix_unitaire: 55, taux_tva: 10, categorie: "Carrelage" },
  { cle: "catalogue-carrelage-2", designation: "Pose de faïence murale", unite: "m²", prix_unitaire: 60, taux_tva: 10, categorie: "Carrelage" },
  { cle: "catalogue-carrelage-3", designation: "Ragréage du support", unite: "m²", prix_unitaire: 18, taux_tva: 10, categorie: "Carrelage" },
  // Menuiserie
  { cle: "catalogue-menuiserie-1", designation: "Fourniture et pose d'une porte intérieure", unite: "u", prix_unitaire: 320, taux_tva: 10, categorie: "Menuiserie" },
  { cle: "catalogue-menuiserie-2", designation: "Pose d'une fenêtre PVC double vitrage", unite: "u", prix_unitaire: 650, taux_tva: 10, categorie: "Menuiserie" },
  { cle: "catalogue-menuiserie-3", designation: "Pose de plinthes", unite: "ml", prix_unitaire: 12, taux_tva: 10, categorie: "Menuiserie" },
  // Maçonnerie
  { cle: "catalogue-maconnerie-1", designation: "Démolition de cloison", unite: "m²", prix_unitaire: 30, taux_tva: 10, categorie: "Maçonnerie" },
  { cle: "catalogue-maconnerie-2", designation: "Coulage d'une dalle béton", unite: "m²", prix_unitaire: 75, taux_tva: 10, categorie: "Maçonnerie" },
  // Toiture
  { cle: "catalogue-toiture-1", designation: "Réparation d'une fuite de toiture", unite: "intervention", prix_unitaire: 350, taux_tva: 10, categorie: "Toiture" },
  { cle: "catalogue-toiture-2", designation: "Nettoyage des gouttières", unite: "ml", prix_unitaire: 8, taux_tva: 10, categorie: "Toiture" },
  // Climatisation
  { cle: "catalogue-clim-1", designation: "Fourniture et pose d'un split réversible 2,5 kW", unite: "u", prix_unitaire: 1490, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-2", designation: "Fourniture et pose d'un split réversible 3,5 kW", unite: "u", prix_unitaire: 1690, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-3", designation: "Fourniture et pose d'un gainable 4 pièces", unite: "forfait", prix_unitaire: 5800, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-4", designation: "Mise en service et contrôle d'étanchéité du circuit", unite: "forfait", prix_unitaire: 240, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-5", designation: "Liaison frigorifique supplémentaire", unite: "ml", prix_unitaire: 45, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-6", designation: "Contrat d'entretien annuel climatisation", unite: "intervention", prix_unitaire: 180, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-7", designation: "Dépose et évacuation d'un ancien climatiseur", unite: "forfait", prix_unitaire: 120, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-8", designation: "Fourniture et pose d'une pompe à chaleur air/eau", unite: "forfait", prix_unitaire: 12500, taux_tva: 5.5, categorie: "Climatisation" },
  { cle: "catalogue-clim-9", designation: "Percement de mur et rebouchage pour liaison frigorifique", unite: "u", prix_unitaire: 70, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-10", designation: "Pose d'un support mural pour groupe extérieur", unite: "u", prix_unitaire: 85, taux_tva: 10, categorie: "Climatisation" },
  { cle: "catalogue-clim-11", designation: "Forfait entretien annuel multi-split (3 unités)", unite: "contrat", prix_unitaire: 320, taux_tva: 10, categorie: "Climatisation" },
  // Facturation électronique
  { cle: "catalogue-efact-1", designation: "Préparation du fichier Factur-X d'une facture", unite: "facture", prix_unitaire: 15, taux_tva: 20, categorie: "Facturation électronique" },
  { cle: "catalogue-efact-2", designation: "Transmission d'une facture via plateforme agréée (PDP)", unite: "facture", prix_unitaire: 9, taux_tva: 20, categorie: "Facturation électronique" },
  { cle: "catalogue-efact-3", designation: "Accompagnement à la mise en conformité facturation électronique", unite: "forfait", prix_unitaire: 190, taux_tva: 20, categorie: "Facturation électronique" },
  { cle: "catalogue-efact-4", designation: "Paramétrage des mentions obligatoires sur les documents", unite: "forfait", prix_unitaire: 90, taux_tva: 20, categorie: "Facturation électronique" },
  { cle: "catalogue-efact-5", designation: "Reprise et retransmission après rejet d'une facture", unite: "u", prix_unitaire: 25, taux_tva: 20, categorie: "Facturation électronique" },
  // Divers
  { cle: "catalogue-divers-1", designation: "Déplacement et diagnostic sur site", unite: "forfait", prix_unitaire: 60, taux_tva: 20, categorie: "Divers" },
  { cle: "catalogue-divers-2", designation: "Évacuation des déchets de chantier", unite: "forfait", prix_unitaire: 180, taux_tva: 20, categorie: "Divers" },
  { cle: "catalogue-divers-3", designation: "Main d'œuvre supplémentaire", unite: "h", prix_unitaire: 45, taux_tva: 20, categorie: "Divers" },
];

/** Ramène une ligne brute de la base vers un objet exploitable. */
function mapLigne(row: Record<string, unknown>): LigneBibliotheque {
  return {
    id: Number(row.id),
    designation: String(row.designation ?? ""),
    unite: String(row.unite ?? "u"),
    prix_unitaire: Number(row.prix_unitaire ?? 0),
    taux_tva: normalizeTvaRate(row.taux_tva),
    categorie: String(row.categorie ?? "Général"),
    created_at: String(row.created_at ?? ""),
  };
}

/** Liste les lignes personnelles de l'artisan (RLS : ses lignes uniquement). */
export async function fetchLignesBibliotheque(userId: string): Promise<LigneBibliotheque[]> {
  const { data, error } = await supabase
    .from("lignes_bibliotheque")
    .select("id, designation, unite, prix_unitaire, taux_tva, categorie, created_at")
    .eq("user_id", userId)
    .order("categorie", { ascending: true })
    .order("designation", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapLigne);
}

/** Crée une nouvelle ligne personnelle réutilisable et renvoie la ligne créée. */
export async function createLigneBibliotheque(
  userId: string,
  payload: LigneBibliothequeInput,
): Promise<LigneBibliotheque | null> {
  const { data, error } = await supabase
    .from("lignes_bibliotheque")
    .insert({
      user_id: userId,
      designation: payload.designation.trim(),
      unite: payload.unite.trim() || "u",
      prix_unitaire: Number(payload.prix_unitaire) || 0,
      taux_tva: normalizeTvaRate(payload.taux_tva),
      categorie: payload.categorie.trim() || "Général",
    })
    .select("id, designation, unite, prix_unitaire, taux_tva, categorie, created_at")
    .single();
  if (error) throw error;
  return data ? mapLigne(data as Record<string, unknown>) : null;
}

/** Met à jour une ligne personnelle existante. */
export async function updateLigneBibliotheque(ligneId: number, payload: LigneBibliothequeInput): Promise<void> {
  const { error } = await supabase
    .from("lignes_bibliotheque")
    .update({
      designation: payload.designation.trim(),
      unite: payload.unite.trim() || "u",
      prix_unitaire: Number(payload.prix_unitaire) || 0,
      taux_tva: normalizeTvaRate(payload.taux_tva),
      categorie: payload.categorie.trim() || "Général",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ligneId);
  if (error) throw error;
}

/** Supprime une ligne personnelle. */
export async function deleteLigneBibliotheque(ligneId: number): Promise<void> {
  const { error } = await supabase.from("lignes_bibliotheque").delete().eq("id", ligneId);
  if (error) throw error;
}

/**
 * Duplique une ligne du catalogue métier dans les lignes personnelles (pour l'ajuster).
 * Renvoie la ligne créée pour pouvoir annuler cette copie unitaire d'un clic.
 */
export async function copierCatalogueVersPerso(
  userId: string,
  ligne: LigneCatalogue,
): Promise<LigneBibliotheque | null> {
  return createLigneBibliotheque(userId, {
    designation: ligne.designation,
    unite: ligne.unite,
    prix_unitaire: ligne.prix_unitaire,
    taux_tva: ligne.taux_tva,
    categorie: ligne.categorie,
  });
}

/**
 * Copie d'un coup plusieurs lignes du catalogue métier dans les lignes personnelles,
 * en ignorant celles dont la désignation est déjà présente (anti-doublon). Renvoie
 * le nombre de lignes copiées, le nombre ignorées et les identifiants des lignes
 * réellement créées (pour pouvoir annuler l'importation d'un seul coup).
 */
export async function copierCatalogueVersPersoMultiple(
  userId: string,
  lignes: LigneCatalogue[],
  designationsExistantes: string[],
): Promise<{ copies: number; ignores: number; ids: number[] }> {
  const existantes = new Set(designationsExistantes.map(normaliserDesignation));
  const ids: number[] = [];
  let copies = 0;
  let ignores = 0;
  for (const ligne of lignes) {
    const cle = normaliserDesignation(ligne.designation);
    if (!cle || existantes.has(cle)) {
      ignores += 1;
      continue;
    }
    const creee = await createLigneBibliotheque(userId, {
      designation: ligne.designation,
      unite: ligne.unite,
      prix_unitaire: ligne.prix_unitaire,
      taux_tva: ligne.taux_tva,
      categorie: ligne.categorie,
    });
    existantes.add(cle);
    copies += 1;
    if (creee) ids.push(creee.id);
  }
  return { copies, ignores, ids };
}

/**
 * Supprime d'un coup plusieurs lignes personnelles (sert à annuler une importation
 * groupée depuis le catalogue). RLS garantit que seules les lignes de l'artisan
 * connecté peuvent être supprimées.
 */
export async function supprimerLignesBibliotheque(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("lignes_bibliotheque").delete().in("id", ids);
  if (error) throw error;
}

/** Normalise une désignation pour comparer deux lignes (espaces et casse). */
export function normaliserDesignation(valeur: string): string {
  return valeur.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Vrai si une désignation est déjà présente dans les lignes personnelles (anti-doublon). */
export function designationDansBibliotheque(lignes: LigneBibliotheque[], designation: string): boolean {
  const cible = normaliserDesignation(designation);
  if (!cible) return false;
  return lignes.some((l) => normaliserDesignation(l.designation) === cible);
}

/** Transforme une ligne du catalogue en ligne prête à insérer dans un devis. */
export function catalogueVersInsertion(ligne: LigneCatalogue): LigneAInserer {
  return {
    designation: ligne.designation,
    unite: ligne.unite,
    prix_unitaire: ligne.prix_unitaire,
    taux_tva: ligne.taux_tva,
    origine: "catalogue",
  };
}

/** Transforme une ligne personnelle en ligne prête à insérer dans un devis. */
export function persoVersInsertion(ligne: LigneBibliotheque): LigneAInserer {
  return {
    designation: ligne.designation,
    unite: ligne.unite,
    prix_unitaire: ligne.prix_unitaire,
    taux_tva: ligne.taux_tva,
    origine: "perso",
  };
}