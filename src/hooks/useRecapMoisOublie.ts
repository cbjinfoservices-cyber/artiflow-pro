import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  cleCibleRecap,
  fetchRecapAutoSettings,
  libelleEcheanceRecap,
  type RecapAutoMode,
} from "@/lib/recapEnvoisGroupeesAuto";
import { libelleMoisRecap } from "@/lib/recapEnvoisGroupeesStats";
import { RECAP_OUBLIE_SNOOZE_EVENT, lireSnoozeRecap } from "@/lib/recapOublieSnooze";

/** Un mois dont le récap aurait dû partir (ou être archivé) mais qui n'a pas été traité. */
export interface RecapMoisOublie {
  /** Clé « AAAA-MM » du mois concerné (le mois écoulé). */
  cle: string;
  /** Libellé du mois (« septembre 2026 »). */
  moisLabel: string;
  /** Ce qui était prévu : envoi au comptable, ou archivage. */
  mode: RecapAutoMode;
  /** Jour et heure programmés (« le 1er à 08 h »). */
  echeanceLabel: string;
  /** Nombre de jours écoulés depuis l'échéance. */
  joursRetard: number;
}

/** Délai de grâce après l'échéance, le temps que la tâche planifiée passe. */
const HEURES_GRACE = 24;

/** Report en cours de l'alerte : le mois concerné et la date de retour. */
export interface RecapReport {
  /** Clé « AAAA-MM » du mois dont l'alerte est masquée. */
  cle: string;
  /** Libellé du mois concerné (« septembre 2026 »). */
  moisLabel: string;
  /** Date à laquelle l'alerte reviendra si le mois n'est toujours pas traité. */
  jusquA: Date;
}

/** État complet de l'alerte : le mois oublié (null s'il n'y en a pas) et le report actif. */
export interface RecapMoisOublieEtat {
  /** Récap resté en plan et non reporté (ce qui doit compter dans la cloche). */
  oublie: RecapMoisOublie | null;
  /** Report actif à afficher sous forme de bandeau annulable (null si aucun). */
  report: RecapReport | null;
}

const ETAT_VIDE: RecapMoisOublieEtat = { oublie: null, report: null };

/**
 * Repère le récap mensuel resté en plan : l'automatisation est activée, la date programmée
 * est passée de plus de 24 h, et le mois écoulé n'a été ni envoyé au comptable ni archivé.
 * Sert d'alerte dans la cloche pour ne pas laisser un mois sans trace. Un report manuel
 * n'efface pas l'alerte : il la transforme en bandeau « Reporté jusqu'au … » annulable.
 */
export function useRecapMoisOublie(refreshKey?: string): RecapMoisOublieEtat {
  const { user } = useAuth();
  const [etat, setEtat] = useState<RecapMoisOublieEtat>(ETAT_VIDE);
  // Report de 7 jours : un clic sur « Reporter » doit faire disparaître l'alerte aussitôt,
  // sans attendre un changement de page. On écoute donc l'événement du report.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const rafraichir = () => setTick((t) => t + 1);
    window.addEventListener(RECAP_OUBLIE_SNOOZE_EVENT, rafraichir);
    return () => window.removeEventListener(RECAP_OUBLIE_SNOOZE_EVENT, rafraichir);
  }, []);

  useEffect(() => {
    let annule = false;
    if (!user) {
      setEtat(ETAT_VIDE);
      return undefined;
    }

    fetchRecapAutoSettings(user.id)
      .then((settings) => {
        if (annule) return;
        if (!settings.actif) {
          setEtat(ETAT_VIDE);
          return;
        }
        const cle = cleCibleRecap();
        if (settings.dernierMois === cle) {
          setEtat(ETAT_VIDE);
          return;
        }
        const moisLabel = libelleMoisRecap(cle);
        // Alerte reportée à la main : on garde le mois en mémoire pour afficher un bandeau
        // « Reporté jusqu'au … » avec un bouton d'annulation, au lieu de masquer le bloc.
        const report = lireSnoozeRecap(cle);
        if (report && report.getTime() > Date.now()) {
          setEtat({ oublie: null, report: { cle, moisLabel, jusquA: report } });
          return;
        }
        // Échéance du mois en cours : jour + heure choisis.
        const [annee, mois] = cle.split("-").map((v) => Number(v));
        // Le récap du mois écoulé est traité le mois suivant : l'échéance se situe donc
        // le jour choisi du mois qui suit le mois récapitulé.
        const echeance = new Date(annee, mois, settings.jour, settings.heure, 0, 0, 0);
        const limite = echeance.getTime() + HEURES_GRACE * 3_600_000;
        const maintenant = Date.now();
        if (maintenant < limite) {
          setEtat(ETAT_VIDE);
          return;
        }
        setEtat({
          oublie: {
            cle,
            moisLabel,
            mode: settings.mode,
            echeanceLabel: libelleEcheanceRecap(settings),
            joursRetard: Math.max(1, Math.floor((maintenant - echeance.getTime()) / 86_400_000)),
          },
          report: null,
        });
      })
      .catch(() => {
        if (!annule) setEtat(ETAT_VIDE);
      });

    return () => {
      annule = true;
    };
  }, [user, refreshKey, tick]);

  return etat;
}