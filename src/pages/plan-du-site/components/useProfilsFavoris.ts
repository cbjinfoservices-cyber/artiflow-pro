import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { telechargerBlob } from "@/lib/telechargement";
import {
  type ProfilFavoris,
  CLE_PROFIL_ACTIF,
  CLE_PROFILS,
  lireProfilActif,
  lireProfils,
} from "@/pages/plan-du-site/components/equipePreferences";

type MessageProfils = { type: "ok" | "erreur"; texte: string };

type ParamsProfilsFavoris = {
  favoris: string[];
  setFavoris: Dispatch<SetStateAction<string[]>>;
  favorisOrigine: string[];
  setFavorisOrigine: Dispatch<SetStateAction<string[]>>;
};

/** Identifiant unique pour un nouveau profil mémorisé. */
function nouvelIdProfil(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Regroupe toute la logique des profils de favoris nommés : état, persistance
 * (dont le profil actif retrouvé appliqué au rechargement), renommage,
 * duplication, réordonnancement (flèches + glisser-déposer) et import / export.
 * Le composant section ne garde ainsi que la présentation.
 */
export function useProfilsFavoris({
  favoris,
  setFavoris,
  favorisOrigine,
  setFavorisOrigine,
}: ParamsProfilsFavoris) {
  const [profils, setProfils] = useState<ProfilFavoris[]>(() => lireProfils());
  const [profilActif, setProfilActif] = useState<string | null>(() => {
    const idActif = lireProfilActif();
    return idActif && lireProfils().some((p) => p.id === idActif) ? idActif : null;
  });
  const [popoverProfils, setPopoverProfils] = useState(false);
  const [nomProfil, setNomProfil] = useState("");
  const [profilEnRenommage, setProfilEnRenommage] = useState<string | null>(null);
  const [nomRenommage, setNomRenommage] = useState("");
  const [profilApercu, setProfilApercu] = useState<string | null>(null);
  const [messageProfils, setMessageProfils] = useState<MessageProfils | null>(null);
  // Suivi du glisser-déposer pour réordonner les profils mémorisés.
  const [dragProfilId, setDragProfilId] = useState<string | null>(null);
  const [dragProfilSurId, setDragProfilSurId] = useState<string | null>(null);
  const timerProfils = useRef<number | null>(null);
  const popoverProfilsRef = useRef<HTMLSpanElement | null>(null);
  const inputFichierRef = useRef<HTMLInputElement | null>(null);

  // Nettoie le minuteur du message de retour au démontage.
  useEffect(
    () => () => {
      if (timerProfils.current) window.clearTimeout(timerProfils.current);
    },
    []
  );

  // Mémorise les profils de favoris nommés pour les retrouver au prochain passage.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_PROFILS, JSON.stringify(profils));
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [profils]);

  // Mémorise le profil de favoris actif pour le retrouver appliqué au rechargement.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_PROFIL_ACTIF, profilActif ?? "");
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }, [profilActif]);

  // Ferme le popover des profils au clic à l'extérieur ou avec Échap.
  useEffect(() => {
    if (!popoverProfils) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (popoverProfilsRef.current && !popoverProfilsRef.current.contains(e.target as Node)) {
        setPopoverProfils(false);
      }
    };
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverProfils(false);
    };
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [popoverProfils]);

  // Affiche un court message de retour dans le popover des profils, puis l'efface.
  const afficherMessageProfils = (type: "ok" | "erreur", texte: string) => {
    setMessageProfils({ type, texte });
    if (timerProfils.current) window.clearTimeout(timerProfils.current);
    timerProfils.current = window.setTimeout(() => setMessageProfils(null), 3200);
  };

  // Enregistre la sélection de favoris actuelle sous un profil nommé.
  const enregistrerProfil = () => {
    const nom = nomProfil.trim();
    if (!nom || favoris.length === 0) return;
    const profil: ProfilFavoris = { id: nouvelIdProfil(), nom, favoris: [...favoris] };
    // Un profil du même nom est remplacé (plus simple que des doublons).
    setProfils((prev) => [...prev.filter((p) => p.nom !== nom), profil]);
    setProfilActif(profil.id);
    setNomProfil("");
  };

  // Charge un profil : remplace la sélection de favoris par celle du profil.
  const appliquerProfil = (id: string) => {
    const profil = profils.find((p) => p.id === id);
    if (!profil) return;
    setFavoris([...profil.favoris]);
    setProfilActif(id);
    setPopoverProfils(false);
  };

  // Duplique un profil mémorisé pour repartir d'une vue existante et la modifier.
  const dupliquerProfil = (id: string) => {
    const source = profils.find((p) => p.id === id);
    if (!source) return;
    const existants = new Set(profils.map((p) => p.nom));
    const base = `${source.nom} (copie)`;
    let nom = base;
    let n = 2;
    while (existants.has(nom)) {
      nom = `${base} ${n}`;
      n += 1;
    }
    const copie: ProfilFavoris = { id: nouvelIdProfil(), nom, favoris: [...source.favoris] };
    setProfils((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return [...prev, copie];
      const suivant = [...prev];
      suivant.splice(index + 1, 0, copie);
      return suivant;
    });
    afficherMessageProfils("ok", "Profil dupliqué");
  };

  // Supprime un profil mémorisé.
  const supprimerProfil = (id: string) => {
    setProfils((prev) => prev.filter((p) => p.id !== id));
    setProfilActif((prev) => (prev === id ? null : prev));
    setProfilEnRenommage((prev) => (prev === id ? null : prev));
  };

  // Réordonne les profils mémorisés (flèches haut / bas).
  const deplacerProfil = (id: string, direction: -1 | 1) => {
    setProfils((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return prev;
      const cible = index + direction;
      if (cible < 0 || cible >= prev.length) return prev;
      const suivant = [...prev];
      [suivant[index], suivant[cible]] = [suivant[cible], suivant[index]];
      return suivant;
    });
  };

  // Réordonne un profil en le déposant sur un autre (glisser-déposer).
  const deplacerProfilVers = (id: string, cibleId: string) => {
    if (id === cibleId) return;
    setProfils((prev) => {
      const depuis = prev.findIndex((p) => p.id === id);
      const vers = prev.findIndex((p) => p.id === cibleId);
      if (depuis === -1 || vers === -1) return prev;
      const suivant = [...prev];
      const [retire] = suivant.splice(depuis, 1);
      suivant.splice(vers, 0, retire);
      return suivant;
    });
  };

  // Ouvre l'édition en ligne du nom d'un profil mémorisé (sans le recréer).
  const demarrerRenommage = (profil: ProfilFavoris) => {
    setProfilEnRenommage(profil.id);
    setNomRenommage(profil.nom);
  };

  // Annule le renommage en cours sans rien modifier.
  const annulerRenommage = () => {
    setProfilEnRenommage(null);
    setNomRenommage("");
  };

  // Valide le nouveau nom : met à jour le profil en place, sans créer de doublon.
  const validerRenommage = () => {
    const id = profilEnRenommage;
    const nom = nomRenommage.trim();
    if (!id || !nom) return;
    setProfils((prev) => prev.map((p) => (p.id === id ? { ...p, nom } : p)));
    setProfilEnRenommage(null);
    setNomRenommage("");
    afficherMessageProfils("ok", "Profil renommé");
  };

  // Exporte un instantané complet (profils + favoris épinglés + ordre d'affichage)
  // dans un fichier JSON, pour le partager ou le transférer entre postes.
  const exporterProfils = () => {
    if (profils.length === 0 && favoris.length === 0) return;
    const contenu = JSON.stringify(
      { type: "artiflow-favoris-export", version: 2, favoris, favorisOrigine, profils },
      null,
      2
    );
    try {
      const blob = new Blob([contenu], { type: "application/json" });
      telechargerBlob("favoris-artiflow.json", blob);
      afficherMessageProfils(
        "ok",
        `${profils.length} profil${profils.length > 1 ? "s" : ""} et ${favoris.length} favori${favoris.length > 1 ? "s" : ""} exporté${profils.length + favoris.length > 1 ? "s" : ""}`
      );
    } catch {
      afficherMessageProfils("erreur", "Export impossible");
    }
  };

  // Importe un fichier JSON et fusionne son contenu avec l'existant.
  // Deux formats acceptés : la liste de profils seule (ancien export) ou
  // l'instantané complet (profils + favoris épinglés + ordre d'affichage).
  const importerProfils = async (fichier: File) => {
    try {
      const texte = await fichier.text();
      const parsed = JSON.parse(texte) as unknown;
      const objet = Array.isArray(parsed)
        ? null
        : (parsed as { profils?: unknown; favoris?: unknown; favorisOrigine?: unknown });
      const sourceProfils = Array.isArray(parsed) ? parsed : objet?.profils;
      const sourceFavoris = Array.isArray(objet?.favoris)
        ? (objet?.favoris as unknown[]).filter((x) => typeof x === "string")
        : null;

      const importes: ProfilFavoris[] = Array.isArray(sourceProfils)
        ? sourceProfils
            .filter(
              (p): p is { nom: string; favoris: unknown[] } =>
                Boolean(p) &&
                typeof (p as { nom?: unknown }).nom === "string" &&
                Array.isArray((p as { favoris?: unknown }).favoris)
            )
            .map((p) => ({
              id: nouvelIdProfil(),
              nom: p.nom,
              favoris: p.favoris.filter((x) => typeof x === "string"),
            }))
        : [];

      if (importes.length === 0 && sourceFavoris === null) throw new Error("format");

      if (importes.length > 0) {
        setProfils((prev) => {
          const nomsImportes = new Set(importes.map((p) => p.nom));
          return [...prev.filter((p) => !nomsImportes.has(p.nom)), ...importes];
        });
      }
      // Restaure les favoris épinglés et leur ordre d'affichage si présents.
      if (sourceFavoris !== null) {
        setFavoris(sourceFavoris);
        const origine = Array.isArray(objet?.favorisOrigine)
          ? (objet?.favorisOrigine as unknown[]).filter((x) => typeof x === "string")
          : sourceFavoris;
        setFavorisOrigine(origine.length > 0 ? origine : sourceFavoris);
      }

      afficherMessageProfils(
        "ok",
        sourceFavoris !== null
          ? `${importes.length} profil${importes.length > 1 ? "s" : ""} et ${sourceFavoris.length} favori${sourceFavoris.length > 1 ? "s" : ""} importé${importes.length + sourceFavoris.length > 1 ? "s" : ""}`
          : `${importes.length} profil${importes.length > 1 ? "s" : ""} importé${importes.length > 1 ? "s" : ""}`
      );
    } catch {
      afficherMessageProfils("erreur", "Fichier illisible ou invalide");
    }
  };

  // Remet à zéro les profils et le profil actif (utilisé par « Tout réinitialiser »).
  const reinitialiserProfils = () => {
    try {
      window.localStorage.removeItem(CLE_PROFILS);
      window.localStorage.removeItem(CLE_PROFIL_ACTIF);
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
    setProfils([]);
    setProfilActif(null);
    setProfilEnRenommage(null);
    setNomRenommage("");
    setNomProfil("");
    setProfilApercu(null);
    setMessageProfils(null);
    setPopoverProfils(false);
    setDragProfilId(null);
    setDragProfilSurId(null);
  };

  // Profil de favoris actuellement actif (affiché en badge à côté du titre).
  const profilActifObj = useMemo(
    () => profils.find((p) => p.id === profilActif) ?? null,
    [profils, profilActif]
  );

  return {
    profils,
    setProfils,
    profilActif,
    profilActifObj,
    popoverProfils,
    setPopoverProfils,
    popoverProfilsRef,
    inputFichierRef,
    nomProfil,
    setNomProfil,
    profilEnRenommage,
    nomRenommage,
    setNomRenommage,
    profilApercu,
    setProfilApercu,
    messageProfils,
    dragProfilId,
    dragProfilSurId,
    setDragProfilId,
    setDragProfilSurId,
    enregistrerProfil,
    appliquerProfil,
    dupliquerProfil,
    supprimerProfil,
    deplacerProfil,
    deplacerProfilVers,
    demarrerRenommage,
    annulerRenommage,
    validerRenommage,
    exporterProfils,
    importerProfils,
    reinitialiserProfils,
  };
}