import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Convertit un blob en chaîne base64 (sans préfixe data URI), pour l'envoyer
 * en pièce jointe à une fonction Backend (email). Lecture purement locale.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Application mobile : l'attribut `download` est ignoré par la WebView. On écrit le fichier dans
 * le cache de l'application puis on ouvre la feuille de partage (Enregistrer, Drive, email…).
 */
async function partagerFichierNatif(filename: string, blob: Blob): Promise<void> {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, files: [uri] });
}

/** Déclenche le téléchargement d'un blob sous le nom de fichier donné (web et application mobile). */
export function telechargerBlob(filename: string, blob: Blob): void {
  if (Capacitor.isNativePlatform()) {
    partagerFichierNatif(filename, blob).catch((erreur: unknown) => {
      // Fermer la feuille de partage sans choisir de cible n'est pas une erreur.
      if (erreur instanceof Error && /cancel/i.test(erreur.message)) return;
      console.error("Partage du fichier impossible", erreur);
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Déclenche le téléchargement d'un fichier déjà disponible sous forme d'URL (`blob:` ou `data:`). */
export function telechargerUrl(filename: string, url: string): void {
  if (Capacitor.isNativePlatform()) {
    fetch(url)
      .then((reponse) => reponse.blob())
      .then((blob) => telechargerBlob(filename, blob))
      .catch((erreur: unknown) => console.error("Lecture du fichier impossible", erreur));
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
