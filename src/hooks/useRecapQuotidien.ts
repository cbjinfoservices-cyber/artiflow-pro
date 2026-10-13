import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateRecapSettings } from "@/lib/artisanApi";
import {
  CANAUX,
  CANAUX_DEFAUT,
  RECAP_DEVIS_SEUIL_DEFAUT,
  RECAP_RELANCE_FACTURE_SEUIL_DEFAUT,
  RELANCE_FACTURE_DELAI_DEFAUT,
} from "@/lib/relances";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

// Clés de préférences locales du récapitulatif quotidien, pour retrouver ses
// réglages même avant le chargement du profil Backend.
const ACTIF_KEY = "artiflow.recap.actif";
const CANAUX_KEY = "artiflow.recap.canaux";
const HEURE_KEY = "artiflow.recap.heure";
const DEVIS_SEUIL_KEY = "artiflow.recap.devis.seuil";
const RELANCE_FACTURE_AUTO_KEY = "artiflow.recap.relance.facture.auto";
const RELANCE_FACTURE_SEUIL_KEY = "artiflow.recap.relance.facture.seuil";
const RELANCE_FACTURE_DELAI_KEY = "artiflow.recap.relance.facture.delai";
const RAPPEL_ACTIF_KEY = "artiflow.recap.rappel.actif";
const RAPPEL_HEURE_KEY = "artiflow.recap.rappel.heure";

/** Heure d'envoi par défaut (heure de Paris) si l'artisan n'en choisit pas. */
export const RECAP_HEURE_DEFAUT = 8;

/** Heure d'envoi par défaut du rappel de la veille (heure de Paris). */
export const RAPPEL_HEURE_DEFAUT = 17;

export interface RecapQuotidien {
  /** Récapitulatif quotidien activé ou coupé. */
  actif: boolean;
  /** Canaux inclus dans le récapitulatif email. */
  canaux: string[];
  /** Heure d'envoi choisie (0-23, heure de Paris). */
  heure: number;
  /** Seuil (jours) au-delà duquel un devis est considéré « sans réponse ». */
  devisSeuil: number;
  /** Relance automatique des factures critiques depuis le récap. */
  relanceFactureAuto: boolean;
  /** Seuil (jours de retard) de la relance automatique des factures. */
  relanceFactureSeuil: number;
  /** Délai minimum (jours) entre deux rappels d'une même facture (anti-doublon). */
  relanceFactureDelai: number;
  /** Rappel à l'artisan la veille d'une relance programmée. */
  rappelActif: boolean;
  /** Heure d'envoi du rappel de la veille (0-23, heure de Paris). */
  rappelHeure: number;
  toggleActif: () => void;
  toggleCanal: (canal: string) => void;
  changeHeure: (heure: number) => void;
  changeDevisSeuil: (jours: number) => void;
  toggleRelanceFactureAuto: () => void;
  changeRelanceFactureSeuil: (jours: number) => void;
  changeRelanceFactureDelai: (jours: number) => void;
  toggleRappelActif: () => void;
  changeRappelHeure: (heure: number) => void;
}

/** Ensemble des valeurs persistées en une seule fois dans le profil Backend. */
interface RecapState {
  actif: boolean;
  canaux: string[];
  heure: number;
  devisSeuil: number;
  relanceFactureAuto: boolean;
  relanceFactureSeuil: number;
  relanceFactureDelai: number;
  rappelActif: boolean;
  rappelHeure: number;
}

function readLocalCanaux(): string[] {
  try {
    const raw = lireBrut(CANAUX_KEY);
    if (!raw) return [...CANAUX_DEFAUT];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...CANAUX_DEFAUT];
    const valid = parsed.map((c) => String(c)).filter((c) => (CANAUX as readonly string[]).includes(c));
    return valid.length > 0 ? valid : [...CANAUX_DEFAUT];
  } catch {
    return [...CANAUX_DEFAUT];
  }
}

function readLocalHeure(): number {
  try {
    const raw = lireBrut(HEURE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RECAP_HEURE_DEFAUT;
}

function readLocalDevisSeuil(): number {
  try {
    const raw = lireBrut(DEVIS_SEUIL_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RECAP_DEVIS_SEUIL_DEFAUT;
}

function readLocalRelanceFactureAuto(): boolean {
  try {
    const raw = lireBrut(RELANCE_FACTURE_AUTO_KEY);
    if (raw !== null) return raw === "true";
  } catch {
    /* silencieux */
  }
  return true;
}

function readLocalRelanceFactureSeuil(): number {
  try {
    const raw = lireBrut(RELANCE_FACTURE_SEUIL_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RECAP_RELANCE_FACTURE_SEUIL_DEFAUT;
}

function readLocalRelanceFactureDelai(): number {
  try {
    const raw = lireBrut(RELANCE_FACTURE_DELAI_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RELANCE_FACTURE_DELAI_DEFAUT;
}

function readLocalRappelActif(): boolean {
  try {
    const raw = lireBrut(RAPPEL_ACTIF_KEY);
    if (raw !== null) return raw === "true";
  } catch {
    /* silencieux */
  }
  return true;
}

function readLocalRappelHeure(): number {
  try {
    const raw = lireBrut(RAPPEL_HEURE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RAPPEL_HEURE_DEFAUT;
}

/**
 * Centralise les réglages du récapitulatif quotidien par email : activation
 * (interrupteur par artisan), canaux inclus (Email / SMS / WhatsApp), heure
 * d'envoi, seuil des devis sans réponse, relance automatique des factures
 * critiques, délai anti-doublon entre deux rappels d'une même facture et rappel
 * de la veille d'une relance programmée.
 * Les valeurs sont mémorisées dans le navigateur et synchronisées avec le profil
 * Backend pour que la tâche planifiée quotidienne utilise exactement les mêmes réglages.
 */
export function useRecapQuotidien(): RecapQuotidien {
  const { user, profile } = useAuth();
  const [actif, setActif] = useState(true);
  const [canaux, setCanaux] = useState<string[]>(() => readLocalCanaux());
  const [heure, setHeure] = useState<number>(() => readLocalHeure());
  const [devisSeuil, setDevisSeuil] = useState<number>(() => readLocalDevisSeuil());
  const [relanceFactureAuto, setRelanceFactureAuto] = useState<boolean>(() => readLocalRelanceFactureAuto());
  const [relanceFactureSeuil, setRelanceFactureSeuil] = useState<number>(() => readLocalRelanceFactureSeuil());
  const [relanceFactureDelai, setRelanceFactureDelai] = useState<number>(() => readLocalRelanceFactureDelai());
  const [rappelActif, setRappelActif] = useState<boolean>(() => readLocalRappelActif());
  const [rappelHeure, setRappelHeure] = useState<number>(() => readLocalRappelHeure());

  // Restaure l'interrupteur au montage.
  useEffect(() => {
    const saved = lireBrut(ACTIF_KEY);
    if (saved !== null) setActif(saved === "true");
  }, []);

  const appliedProfileRef = useRef(false);

  // Applique les réglages enregistrés côté Backend dès que le profil est chargé.
  useEffect(() => {
    if (!profile || appliedProfileRef.current) return;
    appliedProfileRef.current = true;
    if (typeof profile.recap_quotidien_actif === "boolean") setActif(profile.recap_quotidien_actif);
    if (typeof profile.recap_heure === "number") setHeure(profile.recap_heure);
    if (typeof profile.recap_devis_seuil === "number" && profile.recap_devis_seuil > 0) {
      setDevisSeuil(profile.recap_devis_seuil);
    }
    if (typeof profile.relance_facture_auto_actif === "boolean") {
      setRelanceFactureAuto(profile.relance_facture_auto_actif);
    }
    if (typeof profile.relance_facture_seuil === "number" && profile.relance_facture_seuil > 0) {
      setRelanceFactureSeuil(profile.relance_facture_seuil);
    }
    if (typeof profile.relance_facture_delai_min === "number" && profile.relance_facture_delai_min >= 0) {
      setRelanceFactureDelai(profile.relance_facture_delai_min);
    }
    if (typeof profile.rappel_relance_actif === "boolean") setRappelActif(profile.rappel_relance_actif);
    if (typeof profile.rappel_relance_heure === "number") setRappelHeure(profile.rappel_relance_heure);
    if (Array.isArray(profile.recap_canaux) && profile.recap_canaux.length > 0) {
      const valid = profile.recap_canaux
        .map((c) => String(c))
        .filter((c) => (CANAUX as readonly string[]).includes(c));
      if (valid.length > 0) setCanaux(valid);
    }
  }, [profile]);

  const persist = useCallback(
    (next: RecapState) => {
      if (!user) return;
      updateRecapSettings(user.id, next).catch(() => {
        /* l'app reste utilisable même si la synchro échoue */
      });
    },
    [user],
  );

  // État courant, reconstruit à chaque rendu pour les persistance partielles.
  const current: RecapState = {
    actif,
    canaux,
    heure,
    devisSeuil,
    relanceFactureAuto,
    relanceFactureSeuil,
    relanceFactureDelai,
    rappelActif,
    rappelHeure,
  };

  const toggleActif = useCallback(() => {
    setActif((prev) => {
      const next = !prev;
      ecrireBrut(ACTIF_KEY, String(next));
      persist({ ...current, actif: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure]);

  const toggleCanal = useCallback(
    (canal: string) => {
      setCanaux((prev) => {
        const has = prev.includes(canal);
        // On garde toujours au moins un canal sélectionné.
        const next = has ? prev.filter((c) => c !== canal) : [...prev, canal];
        const safe = next.length > 0 ? next : prev;
        ecrireBrut(CANAUX_KEY, JSON.stringify(safe));
        persist({ ...current, canaux: safe });
        return safe;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  const changeHeure = useCallback(
    (value: number) => {
      const safe = Math.min(23, Math.max(0, Math.round(Number.isFinite(value) ? value : RECAP_HEURE_DEFAUT)));
      setHeure(safe);
      ecrireBrut(HEURE_KEY, String(safe));
      persist({ ...current, heure: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  const changeDevisSeuil = useCallback(
    (value: number) => {
      const safe = Math.max(1, Math.round(Number.isFinite(value) ? value : RECAP_DEVIS_SEUIL_DEFAUT));
      setDevisSeuil(safe);
      ecrireBrut(DEVIS_SEUIL_KEY, String(safe));
      persist({ ...current, devisSeuil: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  const toggleRelanceFactureAuto = useCallback(() => {
    setRelanceFactureAuto((prev) => {
      const next = !prev;
      ecrireBrut(RELANCE_FACTURE_AUTO_KEY, String(next));
      persist({ ...current, relanceFactureAuto: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure]);

  const changeRelanceFactureSeuil = useCallback(
    (value: number) => {
      const safe = Math.max(1, Math.round(Number.isFinite(value) ? value : RECAP_RELANCE_FACTURE_SEUIL_DEFAUT));
      setRelanceFactureSeuil(safe);
      ecrireBrut(RELANCE_FACTURE_SEUIL_KEY, String(safe));
      persist({ ...current, relanceFactureSeuil: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  const changeRelanceFactureDelai = useCallback(
    (value: number) => {
      const safe = Math.max(0, Math.round(Number.isFinite(value) ? value : RELANCE_FACTURE_DELAI_DEFAUT));
      setRelanceFactureDelai(safe);
      ecrireBrut(RELANCE_FACTURE_DELAI_KEY, String(safe));
      persist({ ...current, relanceFactureDelai: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  const toggleRappelActif = useCallback(() => {
    setRappelActif((prev) => {
      const next = !prev;
      ecrireBrut(RAPPEL_ACTIF_KEY, String(next));
      persist({ ...current, rappelActif: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure]);

  const changeRappelHeure = useCallback(
    (value: number) => {
      const safe = Math.min(23, Math.max(0, Math.round(Number.isFinite(value) ? value : RAPPEL_HEURE_DEFAUT)));
      setRappelHeure(safe);
      ecrireBrut(RAPPEL_HEURE_KEY, String(safe));
      persist({ ...current, rappelHeure: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, canaux, heure, devisSeuil, relanceFactureAuto, relanceFactureSeuil, relanceFactureDelai, rappelActif, rappelHeure],
  );

  return {
    actif,
    canaux,
    heure,
    devisSeuil,
    relanceFactureAuto,
    relanceFactureSeuil,
    relanceFactureDelai,
    rappelActif,
    rappelHeure,
    toggleActif,
    toggleCanal,
    changeHeure,
    changeDevisSeuil,
    toggleRelanceFactureAuto,
    changeRelanceFactureSeuil,
    changeRelanceFactureDelai,
    toggleRappelActif,
    changeRappelHeure,
  };
}