import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updatePauseVacances } from "@/lib/artisanApi";
import { addDays, toISODate } from "@/lib/dates";
import { estPauseActive, joursPauseRestants } from "@/lib/relances";
import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

// Clé de repli locale, pour retrouver l'état de pause même avant le chargement du profil.
const PAUSE_KEY = "artiflow.pause.jusquAu";

export interface PauseVacances {
  /** Date de fin de pause (ISO) ou null si aucune pause. */
  dateFin: string | null;
  /** La pause est-elle actuellement active ? */
  actif: boolean;
  /** Jours restants avant la fin de la pause. */
  joursRestants: number;
  /** Active une pause de N jours (aujourd'hui + N). */
  activer: (jours: number) => void;
  /** Lève immédiatement la pause. */
  lever: () => void;
}

function readLocal(): string | null {
  const raw = lireBrut(PAUSE_KEY);
  return raw && raw.length >= 10 ? raw : null;
}

/**
 * Gère le mode « pause vacances » : coupe le récapitulatif quotidien ET les relances
 * automatiques jusqu'à une date de fin. Le réglage est synchronisé avec le profil Backend
 * pour que les tâches planifiées côté serveur le respectent aussi.
 */
export function usePauseVacances(): PauseVacances {
  const { user, profile, refreshProfile } = useAuth();
  const [dateFin, setDateFin] = useState<string | null>(() => readLocal());

  // Le profil Backend fait foi dès qu'il est chargé.
  const profileFin = profile ? (profile.pause_jusqu_au ?? null) : null;
  const effective = profileFin ?? dateFin;

  const persist = useCallback(
    (next: string | null) => {
      if (next) ecrireBrut(PAUSE_KEY, next);
      else supprimer(PAUSE_KEY);
      if (user) {
        updatePauseVacances(user.id, next)
          .then(() => refreshProfile())
          .catch(() => {
            /* l'app reste utilisable même si la synchro échoue */
          });
      }
    },
    [user, refreshProfile],
  );

  const activer = useCallback(
    (jours: number) => {
      const fin = toISODate(addDays(new Date(), jours));
      setDateFin(fin);
      persist(fin);
    },
    [persist],
  );

  const lever = useCallback(() => {
    setDateFin(null);
    persist(null);
  }, [persist]);

  return {
    dateFin: effective,
    actif: estPauseActive(effective),
    joursRestants: joursPauseRestants(effective),
    activer,
    lever,
  };
}