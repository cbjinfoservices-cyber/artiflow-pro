import JSZip from "jszip";
import { blobToBase64, telechargerBlob } from "@/lib/telechargement";

// Réexportés pour les appelants historiques de ce module.
export { blobToBase64, telechargerBlob };

export interface ZipEntry {
  /** Nom du fichier à l'intérieur de l'archive (ex. « abonnements.csv »). */
  name: string;
  /** Contenu texte du fichier (CSV, JSON, etc.). Ignoré si `blob` est fourni. */
  content?: string;
  /** Contenu binaire (image PNG, etc.). Prioritaire sur `content` quand il est fourni. */
  blob?: Blob;
  /**
   * Ne pas préfixer le contenu texte d'un BOM UTF-8. Utile pour le JSON : un BOM
   * gêne certains outils de lecture stricte (réimport), alors qu'il aide Excel pour le CSV.
   */
  sansBom?: boolean;
}

/** Résultat d'une génération d'archive ZIP : taille et nombre de fichiers, pour la confirmation. */
export interface ZipResult {
  /** Nombre de fichiers contenus dans l'archive. */
  entries: number;
  /** Taille de l'archive en octets. */
  size: number;
}

/** Archive ZIP construite en mémoire, prête à être téléchargée (éventuellement plusieurs fois). */
export interface ZipBuild extends ZipResult {
  /** Contenu binaire de l'archive. */
  blob: Blob;
}

/**
 * Construit une archive ZIP en mémoire à partir de plusieurs fichiers (texte et/ou binaires),
 * SANS déclencher de téléchargement. Chaque fichier texte est préfixé d'un BOM UTF-8 pour rester
 * lisible dans Excel FR une fois extrait ; les binaires sont ajoutés tels quels. Renvoyer le blob
 * (et non le télécharger directement) permet de le re-télécharger ensuite sous un autre nom.
 */
export async function creerZip(entries: ZipEntry[]): Promise<ZipBuild> {
  const zip = new JSZip();
  entries.forEach((entry) => {
    if (entry.blob) zip.file(entry.name, entry.blob);
    else zip.file(entry.name, entry.sansBom ? entry.content ?? "" : `\uFEFF${entry.content ?? ""}`);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, entries: entries.length, size: blob.size };
}

/**
 * Construit une archive ZIP en mémoire à partir de plusieurs fichiers (texte et/ou binaires),
 * puis déclenche son téléchargement. Renvoie la taille de l'archive et le nombre de fichiers
 * inclus (utile pour la confirmation).
 */
export async function downloadZip(filename: string, entries: ZipEntry[]): Promise<ZipResult> {
  const build = await creerZip(entries);
  telechargerBlob(filename, build.blob);
  return { entries: build.entries, size: build.size };
}