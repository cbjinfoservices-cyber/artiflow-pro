import { useState } from "react";

/** Extension de fichier cohérente avec le type réel renvoyé par le serveur d'images. */
function extensionDepuis(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  return "jpg";
}

/** Déclenche le téléchargement d'un blob via un lien temporaire. */
function enregistrerBlob(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

type Etat = "repos" | "chargement" | "ok" | "nouvelOnglet";

/**
 * Bouton « Télécharger l'image » d'une carte du récapitulatif.
 *
 * Il récupère la vignette et l'enregistre en vrai fichier (au lieu de laisser un lien à
 * ouvrir). Si le navigateur bloque la lecture directe du visuel distant, on retombe
 * proprement sur l'ouverture de l'image dans un nouvel onglet : l'utilisateur a toujours
 * moyen de récupérer le visuel.
 */
export default function BoutonTelechargerImage({
  image,
  nomFichier,
}: {
  /** Adresse absolue du visuel de partage. */
  image?: string;
  /** Nom de fichier proposé au téléchargement, sans extension. */
  nomFichier: string;
}) {
  const [etat, setEtat] = useState<Etat>("repos");

  const telecharger = async () => {
    if (!image || etat === "chargement") return;
    setEtat("chargement");
    try {
      const reponse = await fetch(image, { mode: "cors" });
      if (!reponse.ok) throw new Error("Téléchargement refusé");
      const blob = await reponse.blob();
      const nomPropre = nomFichier.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").slice(0, 60);
      enregistrerBlob(blob, `${nomPropre || "artiflow-annonce"}.${extensionDepuis(blob.type)}`);
      setEtat("ok");
      window.setTimeout(() => setEtat("repos"), 2200);
    } catch {
      // Repli : on ouvre le visuel, l'utilisateur peut l'enregistrer depuis le navigateur.
      window.open(image, "_blank", "noopener,noreferrer");
      setEtat("nouvelOnglet");
      window.setTimeout(() => setEtat("repos"), 2600);
    }
  };

  const libelle =
    etat === "chargement"
      ? "Préparation…"
      : etat === "ok"
        ? "Image téléchargée"
        : etat === "nouvelOnglet"
          ? "Image ouverte dans un onglet"
          : "Télécharger l'image";

  const icone =
    etat === "chargement"
      ? "ri-loader-4-line animate-spin"
      : etat === "ok"
        ? "ri-check-line text-accent-600"
        : etat === "nouvelOnglet"
          ? "ri-external-link-line"
          : "ri-download-2-line";

  return (
    <button
      type="button"
      onClick={telecharger}
      disabled={!image || etat === "chargement"}
      title={image ? libelle : "Aucun visuel disponible"}
      aria-label={image ? libelle : "Aucun visuel disponible"}
      className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-md bg-background-50 border border-background-200 text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="w-4 h-4 flex items-center justify-center">
        <i className={icone}></i>
      </span>
    </button>
  );
}