import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateEnvoisAutoRecapHebdo, type EnvoisAutoRecapHebdoCc } from "@/lib/artisanApi";

// Clés de préférences locales du récap hebdo des envois automatiques, pour retrouver ses
// réglages même avant le chargement du profil Backend.
const ACTIF_KEY = "artiflow.envoisauto.recaphebdo.actif";
const JOUR_KEY = "artiflow.envoisauto.recaphebdo.jour";
const HEURE_KEY = "artiflow.envoisauto.recaphebdo.heure";
const CC_KEY = "artiflow.envoisauto.recaphebdo.cc";

/** Jour d'envoi par défaut : lundi (1 = lundi … 7 = dimanche). */
export const RECAP_HEBDO_JOUR_DEFAUT = 1;
/** Heure d'envoi par défaut (heure de Paris). */
export const RECAP_HEBDO_HEURE_DEFAUT = 8;

/** Adresse mise en copie (Cc) du récap hebdo (comptable, collaborateur…). */
export type { EnvoisAutoRecapHebdoCc };

export interface RecapHebdoEnvoisAuto {
  /** Récap hebdo par email activé. */
  actif: boolean;
  /** Jour de la semaine d'envoi (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Adresses mises en copie (Cc) de chaque envoi. */
  cc: EnvoisAutoRecapHebdoCc[];
  toggleActif: () => void;
  changeJour: (jour: number) => void;
  changeHeure: (heure: number) => void;
  /** Remplace la liste des adresses en copie (une entrée vide est ignorée à l'enregistrement). */
  setCc: (cc: EnvoisAutoRecapHebdoCc[]) => void;
}

/** Valeurs persistées en une seule fois dans le profil Backend. */
interface RecapHebdoState {
  actif: boolean;
  jour: number;
  heure: number;
  cc: EnvoisAutoRecapHebdoCc[];
}

function readLocalActif(): boolean {
  try {
    const raw = localStorage.getItem(ACTIF_KEY);
    if (raw !== null) return raw === "true";
  } catch {
    /* silencieux */
  }
  return false;
}

function readLocalJour(): number {
  try {
    const n = Number(localStorage.getItem(JOUR_KEY));
    if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RECAP_HEBDO_JOUR_DEFAUT;
}

function readLocalHeure(): number {
  try {
    const n = Number(localStorage.getItem(HEURE_KEY));
    if (Number.isFinite(n) && n >= 0 && n <= 23) return Math.round(n);
  } catch {
    /* silencieux */
  }
  return RECAP_HEBDO_HEURE_DEFAUT;
}

/** Lit la liste des adresses en copie mémorisées dans le navigateur. */
function readLocalCc(): EnvoisAutoRecapHebdoCc[] {
  try {
    const raw = localStorage.getItem(CC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          nom: row.nom ? String(row.nom) : undefined,
          email: String(row.email ?? ""),
        };
      })
      .filter((a) => a.email.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Centralise les réglages du récapitulatif hebdomadaire par email de la synthèse des
 * envois automatiques : interrupteur d'activation, jour de la semaine, heure d'envoi et
 * adresses mises en copie (Cc). Les valeurs sont mémorisées dans le navigateur et
 * synchronisées avec le profil Backend pour que la tâche planifiée hebdomadaire utilise
 * exactement les mêmes réglages.
 */
export function useRecapHebdoEnvoisAuto(): RecapHebdoEnvoisAuto {
  const { user, profile } = useAuth();
  const [actif, setActif] = useState<boolean>(() => readLocalActif());
  const [jour, setJour] = useState<number>(() => readLocalJour());
  const [heure, setHeure] = useState<number>(() => readLocalHeure());
  const [cc, setCcState] = useState<EnvoisAutoRecapHebdoCc[]>(() => readLocalCc());

  const appliedProfileRef = useRef(false);

  // Applique les réglages enregistrés côté Backend dès que le profil est chargé.
  useEffect(() => {
    if (!profile || appliedProfileRef.current) return;
    appliedProfileRef.current = true;
    if (typeof profile.envois_auto_recap_hebdo_actif === "boolean") {
      setActif(profile.envois_auto_recap_hebdo_actif);
    }
    if (typeof profile.envois_auto_recap_hebdo_jour === "number" && profile.envois_auto_recap_hebdo_jour >= 1) {
      setJour(profile.envois_auto_recap_hebdo_jour);
    }
    if (typeof profile.envois_auto_recap_hebdo_heure === "number") {
      setHeure(profile.envois_auto_recap_hebdo_heure);
    }
    if (Array.isArray(profile.envois_auto_recap_hebdo_cc)) {
      const liste = profile.envois_auto_recap_hebdo_cc
        .map((a) => ({ nom: a.nom ? String(a.nom) : undefined, email: String(a.email ?? "") }))
        .filter((a) => a.email.trim().length > 0);
      setCcState(liste);
      try {
        localStorage.setItem(CC_KEY, JSON.stringify(liste));
      } catch {
        /* silencieux */
      }
    }
  }, [profile]);

  const persist = useCallback(
    (next: RecapHebdoState) => {
      if (!user) return;
      updateEnvoisAutoRecapHebdo(user.id, next).catch(() => {
        /* l'app reste utilisable même si la synchro échoue */
      });
    },
    [user],
  );

  const snapshot: RecapHebdoState = { actif, jour, heure, cc };

  const toggleActif = useCallback(() => {
    setActif((prev) => {
      const next = !prev;
      localStorage.setItem(ACTIF_KEY, String(next));
      persist({ ...snapshot, actif: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, actif, jour, heure, cc]);

  const changeJour = useCallback(
    (value: number) => {
      const safe = Math.min(7, Math.max(1, Math.round(Number.isFinite(value) ? value : RECAP_HEBDO_JOUR_DEFAUT)));
      setJour(safe);
      localStorage.setItem(JOUR_KEY, String(safe));
      persist({ ...snapshot, jour: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  const changeHeure = useCallback(
    (value: number) => {
      const safe = Math.min(23, Math.max(0, Math.round(Number.isFinite(value) ? value : RECAP_HEBDO_HEURE_DEFAUT)));
      setHeure(safe);
      localStorage.setItem(HEURE_KEY, String(safe));
      persist({ ...snapshot, heure: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  const setCc = useCallback(
    (liste: EnvoisAutoRecapHebdoCc[]) => {
      const safe = Array.isArray(liste) ? liste : [];
      setCcState(safe);
      try {
        localStorage.setItem(CC_KEY, JSON.stringify(safe));
      } catch {
        /* silencieux */
      }
      persist({ ...snapshot, cc: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  return { actif, jour, heure, cc, toggleActif, changeJour, changeHeure, setCc };
}