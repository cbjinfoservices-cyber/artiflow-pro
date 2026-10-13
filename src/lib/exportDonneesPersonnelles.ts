import { supabase } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";
import { creerZip, type ZipBuild, type ZipEntry } from "@/lib/zip";

/**
 * Export de sauvegarde des données personnelles de l'artisan connecté.
 *
 * Objectif : permettre à chaque artisan de récupérer **ses propres données** (clients, devis,
 * factures, chantiers, relances…) sous forme d'une archive ZIP. Deux formats sont proposés :
 *  — **CSV** : un fichier par table (lisible dans Excel / LibreOffice), pour la consultation et
 *    l'archivage humain ;
 *  — **JSON** : un fichier `donnees.json` structuré (une entrée par table), pensé pour une future
 *    **restauration / réimport** — les données d'origine y sont conservées telles quelles (types
 *    inclus), sans la mise en forme du CSV.
 *
 * Sécurité : toutes les lectures passent par la même instance `supabase` et sont soumises aux
 * règles d'accès du Backend (RLS). Un artisan ne peut donc récupérer QUE ses lignes — jamais
 * celles des autres comptes. Aucune donnée sensible d'autrui n'est exposée ici.
 */

/** Description d'une table exportée vers un fichier CSV de l'archive. */
export interface TableExport {
  /** Nom de la table côté Backend. */
  table: string;
  /** Nom du fichier CSV dans l'archive. */
  fichier: string;
  /** Libellé humain (repris dans la synthèse). */
  libelle: string;
}

/**
 * Tables exportées, dans un ordre lisible. Toutes ont une règle d'accès qui ne renvoie
 * à l'artisan que **ses** lignes (directement par `user_id`, ou via la table parente pour
 * les lignes rattachées à un devis / un chantier / une relance).
 */
export const TABLES: TableExport[] = [
  { table: "profiles", fichier: "01-profil.csv", libelle: "Profil et réglages du compte" },
  { table: "clients", fichier: "02-clients.csv", libelle: "Clients" },
  { table: "devis", fichier: "03-devis.csv", libelle: "Devis" },
  { table: "lignes_devis", fichier: "04-lignes-devis.csv", libelle: "Lignes de devis" },
  { table: "devis_modeles", fichier: "05-modeles-devis.csv", libelle: "Modèles de devis" },
  { table: "factures", fichier: "06-factures.csv", libelle: "Factures" },
  { table: "chantiers", fichier: "07-chantiers.csv", libelle: "Chantiers" },
  { table: "etapes_chantier", fichier: "08-etapes-chantier.csv", libelle: "Étapes de chantier" },
  { table: "relances", fichier: "09-relances.csv", libelle: "Relances" },
  { table: "relances_client", fichier: "10-relances-client.csv", libelle: "Relances client programmées" },
  { table: "relance_reprogrammations", fichier: "11-relances-reprogrammees.csv", libelle: "Reprogrammations de relances" },
  { table: "relance_facture_envois", fichier: "12-relances-facture.csv", libelle: "Relances de factures envoyées" },
  { table: "planning_creneaux", fichier: "13-planning.csv", libelle: "Créneaux de planning" },
  { table: "intervenants", fichier: "14-intervenants.csv", libelle: "Intervenants" },
  { table: "lignes_bibliotheque", fichier: "15-bibliotheque-lignes.csv", libelle: "Bibliothèque de lignes" },
  { table: "envois_email", fichier: "16-envois-email.csv", libelle: "Historique des envois" },
  { table: "envois_auto_tests", fichier: "17-tests-envois-auto.csv", libelle: "Historique des tests d'envois auto" },
  { table: "comptable_remplacements", fichier: "18-comptable-remplacements.csv", libelle: "Remplacements comptables" },
  { table: "sante_scores", fichier: "19-sante-compte.csv", libelle: "Scores de santé du compte" },
  { table: "email_test_historique", fichier: "20-emails-test.csv", libelle: "Emails de test" },
  { table: "taux_alerte_historique", fichier: "21-alertes-taux.csv", libelle: "Alertes de taux" },
  { table: "mot_de_passe_alerte_historique", fichier: "22-alertes-mot-de-passe.csv", libelle: "Alertes mot de passe" },
  { table: "mot_de_passe_recap_historique", fichier: "23-recaps-mot-de-passe.csv", libelle: "Récaps mot de passe" },
  { table: "export_csv_mensuel_historique", fichier: "24-exports-csv.csv", libelle: "Exports CSV mensuels" },
  { table: "reessais_envoi_historique", fichier: "25-reessais-envoi.csv", libelle: "Réessais d'envoi" },
  { table: "recap_envois", fichier: "26-recaps-quotidiens.csv", libelle: "Récaps quotidiens" },
  { table: "recap_recontact_envois", fichier: "27-recaps-recontact.csv", libelle: "Récaps de recontact" },
  { table: "recap_alertes_artisan", fichier: "28-alertes-artisan.csv", libelle: "Alertes envoyées à l'artisan" },
  { table: "recap_echecs_blanc_envois", fichier: "29-recaps-echecs-blanc.csv", libelle: "Récaps d'échecs (test à blanc)" },
  { table: "recap_echecs_annuel_relances", fichier: "30-relances-recap-annuel.csv", libelle: "Relances du récap annuel" },
  { table: "rejeux_blanc_historique", fichier: "31-rejeux-blanc.csv", libelle: "Historique des rejeux test à blanc" },
  { table: "preferences_affichage", fichier: "32-preferences-affichage.csv", libelle: "Préférences d'affichage sauvegardées" },
];

/** Format de l'archive de sauvegarde. */
export type FormatExportDonnees = "csv" | "json" | "complet";

const LISEZ_MOI = `ArtiFlow-pro — Sauvegarde de vos données
=========================================

Cette archive regroupe VOS données, table par table. Selon le format choisi, elle contient :

- des fichiers CSV (lisibles dans Excel, LibreOffice, Numbers… avec le séparateur point-virgule) ;
  un fichier = une catégorie (clients, devis, factures, chantiers, relances…), numérotés dans
  l'ordre logique ;
- « donnees.json » : l'ensemble de vos données au format JSON structuré (une entrée par table),
  destiné à une future restauration / réimport — les valeurs d'origine y sont conservées telles
  quelles. C'est le format à garder si vous prévoyez de tout réinjecter plus tard.
- « synthese.json » : récapitule, pour chaque table, le nombre de lignes exportées.
- « lisez-moi.txt » : ce fichier.

Rappels importants :
- Seules VOS données sont incluses : le Backend filtre automatiquement par compte.
- Une colonne vide (ou une entrée JSON absente) signifie simplement que la donnée n'a jamais été
  renseignée.
- Cette archive est destinée à l'archivage personnel ou à un changement d'outil. La réimport
  automatique n'est pas encore disponible : le format JSON est préparé pour l'accueillir.

Conservez ce fichier en lieu sûr : il contient des informations personnelles
(coordonnées de vos clients, montants, etc.).
`;

/** Résultat d'un export : archive prête à télécharger + statistiques pour le retour visuel. */
export interface ResultatExportDonnees {
  /** Archive ZIP construite en mémoire (non encore téléchargée). */
  zip: ZipBuild;
  /** Nombre de tables effectivement exportées (au moins une ligne). */
  tables: number;
  /** Nombre total de lignes exportées. */
  lignes: number;
  /** Format réellement produit (utile pour le message de confirmation). */
  format: FormatExportDonnees;
  /** Détail par table (y compris celles restées vides ou en erreur). */
  synthese: Array<{ table: string; libelle: string; lignes: number; erreur?: string }>;
}

/** Décrit les colonnes d'une liste de lignes (union des clés rencontrées, dans l'ordre). */
function entetes(rows: Array<Record<string, unknown>>): string[] {
  const vues = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => vues.add(k)));
  return Array.from(vues);
}

/** Convertit une valeur de cellule en texte (les objets — JSONB — sont sérialisés). */
function cellule(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return "";
  if (typeof valeur === "object") {
    try {
      return JSON.stringify(valeur);
    } catch {
      return "";
    }
  }
  return String(valeur);
}

/** Construit le contenu CSV d'une table à partir de ses lignes. */
function csvDe(rows: Array<Record<string, unknown>>): string {
  const cols = entetes(rows);
  const lignes = rows.map((row) => cols.map((c) => cellule(row[c])));
  return toCsv(cols, lignes);
}

/** Charge une table (le Backend ne renvoie que les lignes accessibles à l'artisan). */
async function chargerTable(
  t: TableExport,
): Promise<{ table: string; libelle: string; fichier: string; rows: Array<Record<string, unknown>>; erreur?: string }> {
  try {
    const { data, error } = await supabase.from(t.table).select("*");
    if (error) {
      return { table: t.table, libelle: t.libelle, fichier: t.fichier, rows: [], erreur: error.message };
    }
    return { table: t.table, libelle: t.libelle, fichier: t.fichier, rows: (data ?? []) as Array<Record<string, unknown>> };
  } catch (e) {
    return {
      table: t.table,
      libelle: t.libelle,
      fichier: t.fichier,
      rows: [],
      erreur: e instanceof Error ? e.message : "lecture impossible",
    };
  }
}

/**
 * Rassemble toutes les données de l'artisan connecté dans une archive ZIP en mémoire.
 * Ne déclenche PAS de téléchargement (l'appelant choisit quand le faire), ce qui permet
 * d'afficher un récapitulatif avant/après, et de re-télécharger l'archive sous un autre nom.
 *
 * @param format « csv » (défaut), « json » ou « complet » (les deux).
 */
export async function construireExportDonnees(
  format: FormatExportDonnees = "csv",
): Promise<ResultatExportDonnees> {
  const resultats = await Promise.all(TABLES.map(chargerTable));

  const avecCsv = format === "csv" || format === "complet";
  const avecJson = format === "json" || format === "complet";

  const fichiers: ZipEntry[] = [{ name: "lisez-moi.txt", content: LISEZ_MOI }];
  const synthese: ResultatExportDonnees["synthese"] = [];
  const tablesJson: Record<string, Array<Record<string, unknown>>> = {};
  let nbTables = 0;
  let totalLignes = 0;

  resultats.forEach((r) => {
    synthese.push({ table: r.table, libelle: r.libelle, lignes: r.rows.length, erreur: r.erreur });
    if (r.rows.length > 0) {
      if (avecCsv) fichiers.push({ name: r.fichier, content: csvDe(r.rows) });
      if (avecJson) tablesJson[r.table] = r.rows;
      nbTables += 1;
      totalLignes += r.rows.length;
    }
  });

  if (avecCsv) {
    const syntheseCsv = JSON.stringify(
      {
        genere_le: new Date().toISOString(),
        tables_exportees: nbTables,
        lignes_exportees: totalLignes,
        detail: synthese,
      },
      null,
      2,
    );
    fichiers.push({ name: "synthese.json", content: syntheseCsv });
  }

  if (avecJson) {
    // Fichier structuré prêt pour un futur réimport : les données d'origine, table par table.
    const donnees = JSON.stringify(
      {
        application: "ArtiFlow-pro",
        type: "sauvegarde-donnees-artisan",
        format_version: 1,
        genere_le: new Date().toISOString(),
        compteurs: { tables_exportees: nbTables, lignes_exportees: totalLignes },
        tables: tablesJson,
      },
      null,
      2,
    );
    // Pas de BOM sur le JSON : certains lecteurs stricts le refusent.
    fichiers.push({ name: "donnees.json", content: donnees, sansBom: true });
  }

  const zip = await creerZip(fichiers);
  return { zip, tables: nbTables, lignes: totalLignes, format, synthese };
}