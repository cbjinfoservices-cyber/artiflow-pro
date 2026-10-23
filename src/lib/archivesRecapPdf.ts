import { telechargerBlob } from "@/lib/telechargement";
/**
 * Petit archivage local des PDF de récap mensuel (IndexedDB).
 *
 * Les fichiers PDF ne peuvent pas tenir dans le stockage de réglages (localStorage) :
 * on les conserve donc dans une base IndexedDB dédiée, retrouvables par leur nom de
 * fichier depuis l'historique des exports. Rien ne quitte le navigateur.
 */

const DB_NAME = "artiflow-archives-recap";
const DB_VERSION = 1;
const STORE = "pdfs";

interface ArchivePdfRow {
  nom: string;
  date: string;
  bytes: ArrayBuffer;
}

function ouvrirBase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const requete = indexedDB.open(DB_NAME, DB_VERSION);
    requete.onupgradeneeded = () => {
      const db = requete.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "nom" });
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => resolve(null);
  });
}

/** Enregistre (ou remplace) le PDF d'un mois dans l'archive locale. */
export async function enregistrerPdfArchive(nom: string, date: string, bytes: ArrayBuffer): Promise<boolean> {
  const db = await ouvrirBase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ nom, date, bytes } satisfies ArchivePdfRow);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/** Relit le PDF archivé d'un mois, ou null s'il n'existe pas / n'est plus disponible. */
export async function lirePdfArchive(nom: string): Promise<Blob | null> {
  const db = await ouvrirBase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const requete = tx.objectStore(STORE).get(nom);
      requete.onsuccess = () => {
        const row = requete.result as ArchivePdfRow | undefined;
        db.close();
        resolve(row ? new Blob([row.bytes], { type: "application/pdf" }) : null);
      };
      requete.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Supprime l'archive d'un mois (utile quand l'historique des exports est vidé). */
export async function supprimerPdfArchive(nom: string): Promise<void> {
  const db = await ouvrirBase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(nom);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Télécharge un blob PDF sous le nom donné. */
export function telechargerPdfArchive(nom: string, blob: Blob): void {
  telechargerBlob(nom, blob);
}