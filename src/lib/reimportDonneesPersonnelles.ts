/**
 * Assistant de réimport des données personnelles.
 *
 * Objectif : permettre à l'artisan de **restaurer** une sauvegarde produite par ArtiFlow-pro
 * (le fichier `donnees.json` contenu dans l'archive d'export). On lit le fichier côté navigateur,
 * on liste les tables qu'il contient avec leur nombre de lignes, puis on propose de les
 * **réinjecter une par une** (ou toutes, dans l'ordre logique) via `upsert`.
 *
 * Sécurité :
 *  — seules les tables déclarées par l'application (voir `TABLES`) sont acceptées : un fichier
 *    quelconque ne peut donc pas écrire dans une table arbitraire ;
 *  — toutes les écritures passent par la même instance `supabase` et restent soumises aux règles
 *    d'accès du Backend (RLS). Un artisan ne peut donc restaurer que dans **son propre** périmètre.
 *
 * Important : ce mécanisme réinjecte les enregistrements tels qu'ils ont été exportés, avec leurs
 * identifiants. Il est donc prévu pour **le même compte** (restauration après une perte, retour en
 * arrière, transfert entre environnements). Les lignes déjà présentes sont mises à jour.
 */

import { supabase } from "@/lib/supabase";
import { TABLES } from "@/lib/exportDonneesPersonnelles";

/** Description d'une table trouvée dans le fichier de sauvegarde. */
export interface TableReimport {
  /** Nom technique de la table. */
  table: string;
  /** Libellé humain. */
  libelle: string;
  /** Nombre de lignes prêtes à réinjecter. */
  lignes: number;
  /** Colonnes détectées (union des clés des lignes). */
  colonnes: string[];
}

/** Résultat de l'analyse d'un fichier de sauvegarde. */
export interface FichierReimport {
  /** Application à l'origine du fichier. */
  application: string;
  /** Date ISO de génération de la sauvegarde (vide si absente). */
  genereLe: string;
  /** Tables détectées, dans l'ordre logique de réinjection. */
  tables: TableReimport[];
  /** Données brutes par table. */
  donnees: Record<string, Array<Record<string, unknown>>>;
}

/** Résultat de la réinjection d'une table. */
export interface ResultatReinjection {
  table: string;
  ok: boolean;
  lignes: number;
  erreur?: string;
}

const TABLES_AUTORISEES = new Set(TABLES.map((t) => t.table));
const LIBELLES = new Map(TABLES.map((t) => [t.table, t.libelle]));

/** Vrai si la table fait partie des tables réimportables par l'application. */
export function tableReimportable(table: string): boolean {
  return TABLES_AUTORISEES.has(table);
}

/**
 * Lit un fichier `donnees.json` et en extrait les tables réimportables.
 * Lève une erreur explicite (à afficher telle quelle) si le fichier n'est pas exploitable.
 */
export async function lireFichierReimport(file: File): Promise<FichierReimport> {
  const texte = await file.text();
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error(
      "Ce fichier n'est pas un JSON valide. Sélectionnez le fichier « donnees.json » contenu dans une archive de sauvegarde ArtiFlow-pro.",
    );
  }
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) {
    throw new Error("Fichier illisible : la structure attendue est introuvable.");
  }

  const objet = brut as Record<string, unknown>;
  const tablesBrutes = objet.tables;
  if (!tablesBrutes || typeof tablesBrutes !== "object" || Array.isArray(tablesBrutes)) {
    throw new Error(
      "Ce fichier ne contient pas de sauvegarde exploitable (section « tables » absente). Vérifiez qu'il s'agit bien d'un export ArtiFlow-pro.",
    );
  }

  const source = tablesBrutes as Record<string, unknown>;
  const presentes = Object.keys(source);
  // On respecte l'ordre logique de TABLES (parents avant enfants) pour préserver les liens.
  const ordre = TABLES.map((t) => t.table)
    .filter((t) => presentes.includes(t))
    // Tables présentes mais inconnues : on les garde à la fin, elles seront refusées à la réinjection.
    .concat(presentes.filter((t) => !TABLES_AUTORISEES.has(t)));

  const donnees: Record<string, Array<Record<string, unknown>>> = {};
  const tables: TableReimport[] = [];
  ordre.forEach((table) => {
    const lignesBrutes = source[table];
    if (!Array.isArray(lignesBrutes)) return;
    const rows = lignesBrutes.filter(
      (l): l is Record<string, unknown> => !!l && typeof l === "object" && !Array.isArray(l),
    );
    donnees[table] = rows;
    const colonnes = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    tables.push({
      table,
      libelle: LIBELLES.get(table) ?? table,
      lignes: rows.length,
      colonnes,
    });
  });

  if (tables.length === 0) {
    throw new Error("Aucune table exploitable trouvée dans ce fichier.");
  }

  return {
    application: typeof objet.application === "string" ? objet.application : "ArtiFlow-pro",
    genereLe: typeof objet.genere_le === "string" ? objet.genere_le : "",
    tables,
    donnees,
  };
}

/**
 * Réinjecte une table (mise à jour des lignes existantes par identifiant, insertion des nouvelles).
 * Refuse toute table non déclarée par l'application. Renvoie le nombre de lignes traitées.
 */
export async function reinjecterTableReimport(
  table: string,
  rows: Array<Record<string, unknown>>,
): Promise<number> {
  if (!TABLES_AUTORISEES.has(table)) {
    throw new Error(`Table non autorisée : « ${table} ».`);
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

/**
 * Réinjecte toutes les tables d'un coup, dans l'ordre logique (parents d'abord) pour respecter
 * les liens entre enregistrements. Chaque table est indépendante : l'échec de l'une n'empêche
 * pas les suivantes, et on renvoie le détail.
 */
export async function reinjecterToutesLesTables(
  donnees: Record<string, Array<Record<string, unknown>>>,
): Promise<ResultatReinjection[]> {
  const resultats: ResultatReinjection[] = [];
  const ordre = TABLES.map((t) => t.table);
  for (const table of ordre) {
    const rows = donnees[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    try {
      const n = await reinjecterTableReimport(table, rows);
      resultats.push({ table, ok: true, lignes: n });
    } catch (e) {
      resultats.push({
        table,
        ok: false,
        lignes: 0,
        erreur: e instanceof Error ? e.message : "Réinjection impossible.",
      });
    }
  }
  return resultats;
}

/** Nombre total de lignes contenues dans un fichier analysé. */
export function totalLignesReimport(fichier: FichierReimport): number {
  return fichier.tables.reduce((somme, t) => somme + t.lignes, 0);
}