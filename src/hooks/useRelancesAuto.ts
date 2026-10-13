import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateRelanceSettings } from "@/lib/artisanApi";
import {
  DECALAGE_DEFAUT,
  DECALAGE_OPTIONS,
  ESCALADE_RETARD_DEFAUT,
  ESCALADE_RETARD_OPTIONS,
  SEUIL_DEFAUT,
  SEUIL_OPTIONS,
} from "@/lib/relances";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

// Clés de préférences partagées entre la page Relances et le tableau de bord,
// pour piloter les relances automatiques depuis n'importe quel écran.
const AUTO_KEY = "artiflow.relances.auto";
const SEUIL_KEY = "artiflow.relances.seuil";
const DECALAGE_KEY = "artiflow.relances.decalage";
const ESCALADE_RETARD_KEY = "artiflow.relances.escaladeRetard";

export interface RelancesAuto {
  /** Relances automatiques globalement actives ou non. */
  auto: boolean;
  /** Seuil de reprogrammations avant escalade automatique. */
  seuil: number;
  /** Décalage par défaut (jours) des reports. */
  decalage: number;
  /** Seuil (jours de retard) avant escalade automatique. */
  escaladeRetard: number;
  /** Garde d'exécution unique de l'escalade automatique côté page. */
  autoEscalatedRef: RefObject<boolean>;
  toggleAuto: () => void;
  changeSeuil: (value: number) => void;
  changeDecalage: (value: number) => void;
  changeEscaladeRetard: (value: number) => void;
}

/**
 * Centralise les réglages des relances automatiques (activation, seuil d'escalade,
 * décalage des reports, retard déclenchant l'escalade). Les valeurs sont mémorisées
 * dans le navigateur et synchronisées avec le profil Backend pour que l'escalade
 * planifiée côté serveur utilise exactement les mêmes seuils.
 * Réutilisé par la page Relances ET le tableau de bord, donc les deux écrans
 * partagent le même réglage.
 */
export function useRelancesAuto(): RelancesAuto {
  const { user, profile } = useAuth();
  const [auto, setAuto] = useState(true);
  const [seuil, setSeuil] = useState<number>(SEUIL_DEFAUT);
  const [decalage, setDecalage] = useState<number>(DECALAGE_DEFAUT);
  const [escaladeRetard, setEscaladeRetard] = useState<number>(ESCALADE_RETARD_DEFAUT);
  const autoEscalatedRef = useRef(false);

  // Restaure les préférences locales au montage.
  useEffect(() => {
    const saved = lireBrut(AUTO_KEY);
    if (saved !== null) setAuto(saved === "true");
    const savedSeuil = Number(lireBrut(SEUIL_KEY));
    if (SEUIL_OPTIONS.includes(savedSeuil as (typeof SEUIL_OPTIONS)[number])) setSeuil(savedSeuil);
    const savedDecalage = Number(lireBrut(DECALAGE_KEY));
    if (DECALAGE_OPTIONS.includes(savedDecalage as (typeof DECALAGE_OPTIONS)[number])) setDecalage(savedDecalage);
    const savedEscaladeRetard = Number(lireBrut(ESCALADE_RETARD_KEY));
    if (ESCALADE_RETARD_OPTIONS.includes(savedEscaladeRetard as (typeof ESCALADE_RETARD_OPTIONS)[number]))
      setEscaladeRetard(savedEscaladeRetard);
  }, []);

  const appliedProfileRef = useRef(false);

  // Applique les réglages enregistrés côté Backend dès que le profil est chargé.
  useEffect(() => {
    if (!profile || appliedProfileRef.current) return;
    appliedProfileRef.current = true;
    if (typeof profile.relance_auto_actif === "boolean") setAuto(profile.relance_auto_actif);
    if (typeof profile.relance_seuil === "number" && profile.relance_seuil > 0) setSeuil(profile.relance_seuil);
    if (typeof profile.relance_escalade_retard === "number" && profile.relance_escalade_retard > 0)
      setEscaladeRetard(profile.relance_escalade_retard);
  }, [profile]);

  // Enregistre les réglages dans le profil Backend (best effort).
  const persist = useCallback(
    (next: { auto: boolean; seuil: number; escaladeRetard: number }) => {
      if (!user) return;
      updateRelanceSettings(user.id, next).catch(() => {
        /* l'app reste utilisable même si la synchro échoue */
      });
    },
    [user],
  );

  const toggleAuto = useCallback(() => {
    setAuto((prev) => {
      const next = !prev;
      ecrireBrut(AUTO_KEY, String(next));
      persist({ auto: next, seuil, escaladeRetard });
      return next;
    });
  }, [persist, seuil, escaladeRetard]);

  const changeSeuil = useCallback(
    (value: number) => {
      setSeuil(value);
      ecrireBrut(SEUIL_KEY, String(value));
      persist({ auto, seuil: value, escaladeRetard });
    },
    [persist, auto, escaladeRetard],
  );

  const changeDecalage = useCallback((value: number) => {
    setDecalage(value);
    ecrireBrut(DECALAGE_KEY, String(value));
  }, []);

  const changeEscaladeRetard = useCallback(
    (value: number) => {
      setEscaladeRetard(value);
      ecrireBrut(ESCALADE_RETARD_KEY, String(value));
      persist({ auto, seuil, escaladeRetard: value });
    },
    [persist, auto, seuil],
  );

  // Un changement de seuil doit ré-autoriser l'escalade automatique de la session.
  useEffect(() => {
    autoEscalatedRef.current = false;
  }, [seuil, escaladeRetard]);

  return {
    auto,
    seuil,
    decalage,
    escaladeRetard,
    autoEscalatedRef,
    toggleAuto,
    changeSeuil,
    changeDecalage,
    changeEscaladeRetard,
  };
}